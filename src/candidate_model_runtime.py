"""One verified Candidate multimodal Model Runtime adapter.

This module owns only the qualified DeepSeek rendered-page execution boundary.
It performs no persistence and never invokes local semantic extraction.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Callable

from src.runtime_binding import valid_binding, resolve_runtime_credential

from src.candidate_context import (
    CONTRACT_ID as CANDIDATE_SCHEMA_VERSION,
    PROMPT_VERSION,
    CandidateProposalError,
    build_deepseek_candidate_proposal_payload,
    extract_deepseek_candidate_proposal,
)
from src.execution_contract import ExecutionContractError, validate_runtime_snapshot
from src.provider_runtime import OPENAI_CHAT_COMPLETIONS, ProviderRuntimeError
from src.upload_limits import MAX_FILE_BYTES


PROVIDER_ID = "deepseek"
MODEL_ID = "deepseek-v4-flash-vision-exp"
ADAPTER_VERSION = "deepseek-candidate-multimodal-v2"
DELIVERY_METHOD = "source_or_rendered_images"
CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision"
MAX_SOURCE_BYTES = MAX_FILE_BYTES


class CandidateModelRuntimeError(ValueError):
    """A safe, user-displayable failure at the bounded Model adapter."""

    def __init__(self, code: str, failure_layer: str, network_call_made: bool = False, diagnostics: dict[str, Any] | None = None):
        super().__init__(code)
        self.code = code
        self.failure_layer = failure_layer
        self.network_call_made = network_call_made
        self.diagnostics = diagnostics or {}


@dataclass(frozen=True)
class CandidateModelRequest:
    source_document: dict[str, Any]
    source_bytes: bytes
    processing_run_id: str
    operation_id: str
    runtime_snapshot: dict[str, Any]
    consent_confirmed_at: str


class CandidateModelExecutionRegistry:
    """Process-local single-flight registry with no source or credential logging."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._active: set[str] = set()
        self._completed: dict[str, dict[str, Any]] = {}
        self._source_by_operation: dict[str, str] = {}
        self._invalidated: set[str] = set()

    def begin(self, operation_id: str, source_document_id: str) -> tuple[str, dict[str, Any] | None]:
        with self._lock:
            if operation_id in self._completed:
                return "COMPLETED", self._completed[operation_id]
            if operation_id in self._active:
                return "ACTIVE", None
            self._active.add(operation_id)
            self._source_by_operation[operation_id] = source_document_id
            return "CLAIMED", None

    def succeed(self, operation_id: str, result: dict[str, Any]) -> bool:
        with self._lock:
            self._active.discard(operation_id)
            if operation_id in self._invalidated:
                self._invalidated.discard(operation_id)
                self._source_by_operation.pop(operation_id, None)
                return False
            self._completed[operation_id] = result
            return True

    def fail(self, operation_id: str) -> None:
        with self._lock:
            self._active.discard(operation_id)
            self._invalidated.discard(operation_id)
            self._source_by_operation.pop(operation_id, None)

    def forget_source(self, source_document_id: str) -> int:
        with self._lock:
            operation_ids = {operation_id for operation_id, source_id in self._source_by_operation.items() if source_id == source_document_id}
            for operation_id in operation_ids:
                if operation_id in self._active:
                    self._invalidated.add(operation_id)
                else:
                    self._source_by_operation.pop(operation_id, None)
                self._completed.pop(operation_id, None)
            return len(operation_ids)


def _required_string(value: Any, code: str, maximum: int = 512) -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise CandidateModelRuntimeError(code, "request")
    return value.strip()


def _validate_snapshot(value: Any) -> dict[str, Any]:
    try:
        snapshot = validate_runtime_snapshot(value)
    except ExecutionContractError as error:
        raise CandidateModelRuntimeError("candidate_model_runtime_snapshot_invalid", "runtime") from error
    capabilities = snapshot.capabilities.to_dict()
    expected_capabilities = {
        "semantic_understanding": "supported",
        "candidate_model_structuring": "supported",
        "job_model_structuring": "unsupported",
        "model_merge": "unsupported",
        "ai_conversation": "unsupported",
        "vision": "supported",
    }
    if (
        snapshot.mode != "model"
        or not valid_binding(snapshot, ADAPTER_VERSION)
        or snapshot.prompt_version != PROMPT_VERSION
        or snapshot.schema_version != CANDIDATE_SCHEMA_VERSION
        or snapshot.operation != "CANDIDATE_IMAGE_IMPORT"
        or snapshot.delivery_method != DELIVERY_METHOD
        or any(capabilities.get(name) != state for name, state in expected_capabilities.items())
    ):
        raise CandidateModelRuntimeError("candidate_model_runtime_not_eligible", "runtime")
    return snapshot.to_dict()


def _validate_source(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CandidateModelRuntimeError("candidate_model_source_invalid", "source")
    source_id = _required_string(value.get("source_document_id"), "candidate_model_source_invalid", 180)
    filename = _required_string(value.get("filename"), "candidate_model_source_invalid", 240)
    if Path(filename).name != filename:
        raise CandidateModelRuntimeError("candidate_model_source_invalid", "source")
    source_type = value.get("source_type")
    mime_type = value.get("mime_type")
    valid_pdf = source_type == "PDF" and mime_type == "application/pdf" and filename.lower().endswith(".pdf")
    valid_image = source_type == "IMAGE" and mime_type in {"image/png", "image/jpeg"} and filename.lower().endswith((".png", ".jpg", ".jpeg"))
    if (
        value.get("contract_id") != "ariadne-source-document-v1"
        or value.get("material_type") != "CANDIDATE"
        or value.get("authority") != "SOURCE_INPUT_ONLY"
        or not (valid_pdf or valid_image)
        or not source_id.startswith("source-candidate-")
    ):
        raise CandidateModelRuntimeError("candidate_model_multimodal_source_required", "source")
    _required_string(value.get("local_reference"), "candidate_model_source_reference_required", 512)
    content_hash = _required_string(value.get("content_hash"), "candidate_model_source_hash_invalid", 96)
    if not content_hash.startswith("sha256:") or len(content_hash) != 71:
        raise CandidateModelRuntimeError("candidate_model_source_hash_invalid", "source")
    return value


def _decode_source(data_url: Any, source: dict[str, Any]) -> bytes:
    expected_prefix = f"data:{source['mime_type']};base64,"
    if not isinstance(data_url, str) or not data_url.startswith(expected_prefix):
        raise CandidateModelRuntimeError("candidate_model_source_payload_invalid", "source")
    try:
        source_bytes = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    except (binascii.Error, ValueError) as error:
        raise CandidateModelRuntimeError("candidate_model_source_payload_invalid", "source") from error
    valid_signature = source["source_type"] == "PDF" and source_bytes.startswith(b"%PDF-")
    valid_signature = valid_signature or source["mime_type"] == "image/png" and source_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    valid_signature = valid_signature or source["mime_type"] == "image/jpeg" and source_bytes.startswith(b"\xff\xd8\xff")
    if not source_bytes or len(source_bytes) > MAX_SOURCE_BYTES or not valid_signature:
        raise CandidateModelRuntimeError("candidate_model_source_payload_invalid", "source")
    resolved_hash = "sha256:" + hashlib.sha256(source_bytes).hexdigest()
    if resolved_hash != source["content_hash"]:
        raise CandidateModelRuntimeError("raw_source_integrity_mismatch", "source")
    expected_source_id = f"source-candidate-{resolved_hash.removeprefix('sha256:')}"
    if source["source_document_id"] != expected_source_id:
        raise CandidateModelRuntimeError("candidate_model_source_identity_mismatch", "source")
    return source_bytes


def _validate_consent(value: Any, source: dict[str, Any], snapshot: dict[str, Any]) -> tuple[str, str]:
    if not isinstance(value, dict) or value.get("explicitly_confirmed") is not True:
        raise CandidateModelRuntimeError("candidate_model_consent_required", "consent")
    if (
        value.get("source_document_id") != source["source_document_id"]
        or value.get("provider") != snapshot["provider"]
        or value.get("model") != snapshot["model"]
        or value.get("delivery_method") != snapshot["delivery_method"]
    ):
        raise CandidateModelRuntimeError("candidate_model_consent_mismatch", "consent")
    return (
        _required_string(value.get("confirmed_at"), "candidate_model_consent_invalid", 64),
        _required_string(value.get("consent_id"), "candidate_model_consent_invalid", 180),
    )


def runtime_fingerprint(snapshot: dict[str, Any]) -> str:
    fields = {
        key: snapshot.get(key)
        for key in ("mode", "provider", "model", "protocol", "adapter_version", "prompt_version", "schema_version", "delivery_method")
    }
    encoded = json.dumps(fields, ensure_ascii=True, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def candidate_model_operation_id(source_id: str, fingerprint: str, consent_id: str) -> str:
    identity = f"{source_id}|CANDIDATE_MODEL_STRUCTURING|{fingerprint}|{consent_id}".encode("utf-8")
    return "candidate-model-op-" + hashlib.sha256(identity).hexdigest()


def _validate_operation(value: Any, source: dict[str, Any], snapshot: dict[str, Any], consent_id: str) -> str:
    if not isinstance(value, dict):
        raise CandidateModelRuntimeError("candidate_model_operation_identity_invalid", "request")
    fingerprint = runtime_fingerprint(snapshot)
    expected = candidate_model_operation_id(source["source_document_id"], fingerprint, consent_id)
    if (
        value.get("operation_id") != expected
        or value.get("operation_type") != "CANDIDATE_MODEL_STRUCTURING"
        or value.get("source_document_id") != source["source_document_id"]
        or value.get("runtime_fingerprint") != fingerprint
        or value.get("consent_id") != consent_id
    ):
        raise CandidateModelRuntimeError("candidate_model_operation_identity_invalid", "request")
    return expected


def validate_candidate_model_request(payload: Any) -> CandidateModelRequest:
    if not isinstance(payload, dict):
        raise CandidateModelRuntimeError("candidate_model_request_invalid", "request")
    snapshot = _validate_snapshot(payload.get("runtime_snapshot"))
    source = _validate_source(payload.get("source_document"))
    consent_at, consent_id = _validate_consent(payload.get("consent"), source, snapshot)
    run_id = _required_string(payload.get("processing_run_id"), "candidate_model_processing_run_required", 160)
    operation_id = _validate_operation(payload.get("operation_identity"), source, snapshot, consent_id)
    if run_id != f"run-{operation_id}":
        raise CandidateModelRuntimeError("candidate_model_operation_identity_invalid", "request")
    source_bytes = _decode_source(payload.get("document_data_url"), source)
    return CandidateModelRequest(source, source_bytes, run_id, operation_id, snapshot, consent_at)


def resolve_credential(credential_ref: str, reader: Callable[[], str | None]) -> str:
    try:
        return resolve_runtime_credential(
            credential_ref, CREDENTIAL_REF, reader,
            invalid_code="candidate_model_credential_reference_invalid",
            missing_code="deepseek_key_not_configured",
        )
    except ProviderRuntimeError as error:
        raise CandidateModelRuntimeError(error.code, error.failure_layer) from error


def response_diagnostics(provider_response: Any, http_status: int | None = None) -> dict[str, Any]:
    """Return a bounded, source-free summary of a Provider response for diagnosis."""
    details: dict[str, Any] = {
        "http_status": http_status,
        "response_type": type(provider_response).__name__,
    }
    if not isinstance(provider_response, dict):
        return details
    details["top_level_keys"] = sorted(str(key) for key in provider_response.keys())[:24]
    details["returned_model"] = provider_response.get("model") if isinstance(provider_response.get("model"), str) else None
    usage = provider_response.get("usage")
    if isinstance(usage, dict):
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            if isinstance(usage.get(key), int):
                details[key] = usage[key]
        completion_details = usage.get("completion_tokens_details")
        if isinstance(completion_details, dict) and isinstance(completion_details.get("reasoning_tokens"), int):
            details["reasoning_tokens"] = completion_details["reasoning_tokens"]
    choices = provider_response.get("choices")
    details["choices_count"] = len(choices) if isinstance(choices, list) else None
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        return details
    first_choice = choices[0]
    details["finish_reason"] = first_choice.get("finish_reason") if isinstance(first_choice.get("finish_reason"), str) else None
    message = first_choice.get("message")
    if not isinstance(message, dict):
        details["message_type"] = type(message).__name__
        return details
    content = message.get("content")
    details["content_type"] = type(content).__name__
    details["content_length"] = len(content) if isinstance(content, (str, list, dict)) else None
    details["reasoning_content_present"] = "reasoning_content" in message
    reasoning_content = message.get("reasoning_content")
    details["reasoning_content_empty"] = not bool(reasoning_content) if "reasoning_content" in message else None
    details["reasoning_content_length"] = len(reasoning_content) if isinstance(reasoning_content, str) else None
    return details


def execute_candidate_model_request(
    payload: Any,
    credential_reader: Callable[[], str | None],
    render_pages: Callable[[bytes], list[tuple[str, bytes]]],
    provider_call: Callable[[str, dict[str, Any]], tuple[int, dict[str, Any]]],
) -> dict[str, Any]:
    request = validate_candidate_model_request(payload)
    credential = resolve_credential(request.runtime_snapshot["credential_ref"], credential_reader)
    if request.source_document["source_type"] == "PDF":
        try:
            rendered_pages = render_pages(request.source_bytes)
        except Exception as error:
            raise CandidateModelRuntimeError("candidate_model_pdf_render_failed", "delivery") from error
        media_type = "image/jpeg"
    else:
        rendered_pages = [("1", request.source_bytes)]
        media_type = request.source_document["mime_type"]
    if not rendered_pages or any(not page_number or not image for page_number, image in rendered_pages):
        raise CandidateModelRuntimeError("candidate_model_source_delivery_failed", "delivery")
    provider_payload = build_deepseek_candidate_proposal_payload(
        request.source_document["source_document_id"], request.runtime_snapshot["model"], rendered_pages, media_type,
    )
    http_status, provider_response = provider_call(credential, provider_payload)
    diagnostics = response_diagnostics(provider_response, http_status)
    diagnostics["rendered_page_count"] = len(rendered_pages)
    diagnostics["request_max_tokens"] = provider_payload.get("max_tokens")
    if http_status != 200:
        raise CandidateModelRuntimeError("deepseek_provider_http_error", "provider", True, diagnostics)
    if not isinstance(provider_response, dict):
        raise CandidateModelRuntimeError("deepseek_response_malformed", "parsing", True, diagnostics)
    if provider_response.get("model") != request.runtime_snapshot["model"]:
        raise CandidateModelRuntimeError("deepseek_returned_model_mismatch", "model", True, diagnostics)
    if diagnostics.get("finish_reason") == "length":
        diagnostics.update({
            "parse_status": "not_attempted_truncated",
            "schema_status": "not_attempted",
            "grounding_status": "not_attempted",
        })
        raise CandidateModelRuntimeError("model_output_truncated", "model_output", True, diagnostics)
    try:
        candidate_proposal = extract_deepseek_candidate_proposal(
            provider_response, request.source_document["source_document_id"], request.processing_run_id, request.runtime_snapshot["model"], provider=request.runtime_snapshot["provider"],
        )
    except CandidateProposalError as error:
        detail = str(error)
        if "source_ref" in detail or "ground" in detail:
            code, layer = "candidate_model_grounding_validation_failed", "grounding"
        elif "malformed_json" in detail or "missing_content" in detail or "empty_content" in detail:
            code, layer = "deepseek_response_malformed", "parsing"
        else:
            code, layer = "candidate_model_proposal_contract_failed", "contract_validation"
        diagnostics["candidate_validation_code"] = detail[:240]
        raise CandidateModelRuntimeError(code, layer, True, diagnostics) from error
    return {
        "provider": request.runtime_snapshot["provider"],
        "model": request.runtime_snapshot["model"],
        "protocol": request.runtime_snapshot["protocol"],
        "adapter_version": request.runtime_snapshot["adapter_version"],
        "delivery_method": DELIVERY_METHOD,
        "runtime_snapshot_id": request.runtime_snapshot["snapshot_id"],
        "source_document_id": request.source_document["source_document_id"],
        "content_hash": request.source_document["content_hash"],
        "processing_run_id": request.processing_run_id,
        "operation_id": request.operation_id,
        "rendered_page_count": len(rendered_pages),
        "outbound_image_count": len(rendered_pages),
        "provider_response_id": provider_response.get("id"),
        "usage": provider_response.get("usage") if isinstance(provider_response.get("usage"), dict) else {},
        "candidate_proposal": candidate_proposal,
        "network_call_made": True,
        "persistence": "browser_working_projection_required",
    }
