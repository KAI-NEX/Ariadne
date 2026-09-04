"""Qualified Job Model Import boundary over provider-safe prepared text blocks.

The adapter receives mechanically prepared source evidence. It never invokes
Local Job semantic structuring and performs no persistence.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping

from src.candidate_model_runtime import runtime_fingerprint
from src.execution_contract import ExecutionContractError, validate_runtime_snapshot
from src.provider_runtime import OPENAI_CHAT_COMPLETIONS, ProviderRuntimeError, resolve_credential_reference


MANIFEST_PATH = Path(__file__).resolve().parents[1] / "data" / "job_intelligence_contract_v1.json"
MANIFEST = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
RUNTIME = MANIFEST["job_model_import_runtime_contracts"]
PROVIDER_ID = "deepseek"
MODEL_ID = "deepseek-v4-pro"
PROTOCOL = OPENAI_CHAT_COMPLETIONS
OPERATION = "JOB_MODEL_IMPORT"
CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision"
REQUEST_CONTRACT = RUNTIME["request_contract_version"]
RESULT_CONTRACT = RUNTIME["result_contract_version"]
PROPOSAL_CONTRACT = MANIFEST["job_model_import_proposal_version"]
PREPARATION_CONTRACT = MANIFEST["job_model_import_source_preparation_version"]
SOURCE_REF = re.compile(r"^job-source-block-[1-9][0-9]{0,2}$")
FORBIDDEN_PROVIDER_VALUES = re.compile(
    r"(?:source-job-[a-f0-9]{16,}|sha256:[a-f0-9]{32,}|indexeddb://|/(?:Users|home)/)", re.IGNORECASE,
)


class JobModelRuntimeError(ValueError):
    def __init__(self, code: str, failure_layer: str, network_call_made: bool = False):
        super().__init__(code)
        self.code = code
        self.failure_layer = failure_layer
        self.network_call_made = network_call_made


@dataclass(frozen=True)
class JobModelRequest:
    source_document: dict[str, Any]
    source_preparation: dict[str, Any]
    runtime_snapshot: dict[str, Any]
    processing_run_id: str
    operation_id: str


def _mapping(value: Any, code: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise JobModelRuntimeError(code, "contract_validation")
    return value


def _text(value: Any, code: str, maximum: int = 12000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise JobModelRuntimeError(code, "contract_validation")
    return value.strip()


def _optional_text(value: Any, code: str, maximum: int = 12000) -> str | None:
    return None if value is None else _text(value, code, maximum)


def job_model_import_runtime_signature() -> dict[str, str]:
    return {
        "manifest_version": MANIFEST["manifest_version"],
        "runtime_request_contract_version": REQUEST_CONTRACT,
        "runtime_result_contract_version": RESULT_CONTRACT,
        "adapter_version": RUNTIME["adapter_version"],
        "prompt_version": RUNTIME["prompt_version"],
        "request_config_version": RUNTIME["request_config_version"],
        "proposal_version": PROPOSAL_CONTRACT,
        "source_preparation_version": PREPARATION_CONTRACT,
    }


def _validate_snapshot(value: Any) -> dict[str, Any]:
    try:
        snapshot = validate_runtime_snapshot(value)
    except ExecutionContractError as error:
        raise JobModelRuntimeError("job_model_runtime_snapshot_invalid", "runtime") from error
    if (
        snapshot.mode != "model" or snapshot.provider != PROVIDER_ID or snapshot.model != MODEL_ID
        or snapshot.protocol != PROTOCOL or snapshot.adapter_version != RUNTIME["adapter_version"]
        or snapshot.prompt_version != RUNTIME["prompt_version"] or snapshot.schema_version != PROPOSAL_CONTRACT
        or snapshot.operation != OPERATION or snapshot.action_schema_version != PROPOSAL_CONTRACT
        or snapshot.request_config_version != RUNTIME["request_config_version"]
        or snapshot.delivery_method != RUNTIME["delivery_method"]
        or snapshot.credential_ref != CREDENTIAL_REF
        or snapshot.capabilities.semantic_understanding != "supported"
        or snapshot.capabilities.job_model_structuring != "supported"
    ):
        raise JobModelRuntimeError("job_model_runtime_not_eligible", "runtime")
    return snapshot.to_dict()


def _validate_source(value: Any) -> dict[str, Any]:
    source = dict(_mapping(value, "job_model_source_invalid"))
    source_id = _text(source.get("source_document_id"), "job_model_source_invalid", 180)
    filename = _text(source.get("filename"), "job_model_source_invalid", 240)
    content_hash = _text(source.get("content_hash"), "job_model_source_hash_invalid", 96)
    if (
        source.get("contract_id") != "ariadne-source-document-v1" or source.get("material_type") != "JOB"
        or source.get("authority") != "SOURCE_INPUT_ONLY" or Path(filename).name != filename
        or not source_id.startswith("source-job-") or not content_hash.startswith("sha256:") or len(content_hash) != 71
        or source_id != f"source-job-{content_hash.removeprefix('sha256:')}"
    ):
        raise JobModelRuntimeError("job_model_source_invalid", "source")
    _text(source.get("local_reference"), "job_model_source_reference_required", 512)
    return source


def _validate_preparation(value: Any, source: Mapping[str, Any]) -> dict[str, Any]:
    preparation = dict(_mapping(value, "job_model_source_preparation_invalid"))
    if (
        preparation.get("contract_id") != PREPARATION_CONTRACT
        or preparation.get("source_document_id") != source["source_document_id"]
        or preparation.get("content_hash") != source["content_hash"]
        or preparation.get("source_type") != source.get("source_type")
        or preparation.get("mime_type") != source.get("mime_type")
        or preparation.get("read_only") is not True or preparation.get("writeback") is not False
        or preparation.get("semantic_structuring") is not False
    ):
        raise JobModelRuntimeError("job_model_source_preparation_invalid", "source_preparation")
    blocks = preparation.get("blocks")
    if not isinstance(blocks, list) or not 1 <= len(blocks) <= 48:
        raise JobModelRuntimeError("job_model_source_preparation_invalid", "source_preparation")
    refs: set[str] = set()
    validated_blocks = []
    total = 0
    for raw in blocks:
        block = _mapping(raw, "job_model_source_preparation_invalid")
        if set(block) != {"source_ref", "location", "text"}:
            raise JobModelRuntimeError("job_model_source_preparation_invalid", "source_preparation")
        source_ref = _text(block.get("source_ref"), "job_model_source_preparation_invalid", 64)
        if not SOURCE_REF.fullmatch(source_ref) or source_ref in refs:
            raise JobModelRuntimeError("job_model_source_preparation_invalid", "source_preparation")
        refs.add(source_ref)
        text = _text(block.get("text"), "job_model_source_preparation_invalid", 1200)
        total += len(text)
        validated_blocks.append({"source_ref": source_ref, "location": _text(block.get("location"), "job_model_source_preparation_invalid", 128), "text": text})
    if total > 48_000 or preparation.get("character_count") != total:
        raise JobModelRuntimeError("job_model_source_preparation_invalid", "source_preparation")
    return {**preparation, "blocks": validated_blocks}


def _validate_consent(value: Any, source: Mapping[str, Any], snapshot: Mapping[str, Any]) -> str:
    consent = _mapping(value, "job_model_consent_required")
    if consent.get("explicitly_confirmed") is not True:
        raise JobModelRuntimeError("job_model_consent_required", "consent")
    if (
        consent.get("source_document_id") != source["source_document_id"]
        or consent.get("provider") != snapshot["provider"] or consent.get("model") != snapshot["model"]
        or consent.get("delivery_method") != snapshot["delivery_method"]
    ):
        raise JobModelRuntimeError("job_model_consent_mismatch", "consent")
    _text(consent.get("confirmed_at"), "job_model_consent_invalid", 64)
    return _text(consent.get("consent_id"), "job_model_consent_invalid", 180)


def job_model_operation_id(source_id: str, fingerprint: str, consent_id: str) -> str:
    value = f"{source_id}|JOB_MODEL_SEMANTIC_STRUCTURING|{fingerprint}|{consent_id}".encode("utf-8")
    return "job-model-import-op-" + hashlib.sha256(value).hexdigest()


def validate_job_model_request(payload: Any) -> JobModelRequest:
    value = _mapping(payload, "job_model_request_invalid")
    if set(value) != {"contract_id", "source_document", "source_preparation", "runtime_snapshot", "processing_run_id", "consent", "operation_identity"} or value.get("contract_id") != REQUEST_CONTRACT:
        raise JobModelRuntimeError("job_model_request_invalid", "request")
    snapshot = _validate_snapshot(value["runtime_snapshot"])
    source = _validate_source(value["source_document"])
    preparation = _validate_preparation(value["source_preparation"], source)
    consent_id = _validate_consent(value["consent"], source, snapshot)
    operation = _mapping(value["operation_identity"], "job_model_operation_identity_invalid")
    fingerprint = runtime_fingerprint(snapshot)
    expected_operation = job_model_operation_id(source["source_document_id"], fingerprint, consent_id)
    if (
        operation.get("operation_id") != expected_operation or operation.get("operation_type") != "JOB_MODEL_SEMANTIC_STRUCTURING"
        or operation.get("source_document_id") != source["source_document_id"] or operation.get("runtime_fingerprint") != fingerprint
        or operation.get("consent_id") != consent_id
    ):
        raise JobModelRuntimeError("job_model_operation_identity_invalid", "request")
    run_id = _text(value["processing_run_id"], "job_model_processing_run_required", 180)
    if run_id != f"run-{expected_operation}":
        raise JobModelRuntimeError("job_model_operation_identity_invalid", "request")
    return JobModelRequest(source, preparation, snapshot, run_id, expected_operation)


def _assert_provider_safe(value: Any) -> None:
    serialized = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if FORBIDDEN_PROVIDER_VALUES.search(serialized):
        raise JobModelRuntimeError("job_model_provider_payload_private_reference_forbidden", "privacy")


def job_model_prompt() -> str:
    schema = {
        "contract_id": PROPOSAL_CONTRACT,
        "title": {"value": "string", "source_refs": ["job-source-block-N"]},
        "company": {"value": "string|null", "source_refs": ["job-source-block-N"]},
        "location": {"value": "string|null", "source_refs": ["job-source-block-N"]},
        "summary": {"value": "string|null", "source_refs": ["job-source-block-N"]},
        "requirements": [{"label": "string", "detail": "string", "source_refs": ["job-source-block-N"]}],
        "uncertainties": [{"field": "title|company|location|summary|requirements", "reason": "string"}],
    }
    return f"""You are Ariadne's Job Import semantic adapter.
Return exactly one JSON object, no Markdown and no chain-of-thought.
Use this exact shape: {json.dumps(schema, ensure_ascii=False, separators=(',', ':'))}
Understand only the supplied real Job source blocks. Do not invent employer, location, requirements, benefits or responsibilities.
Every non-null field and every requirement must cite one or more supplied source_refs. Use no other references.
Unknown fields must be null and explained in uncertainties. Keep source wording distinguishable from semantic summarization.
This output becomes a NON_AUTHORITATIVE Working Job. It becomes confirmed truth only after Human Workspace Save. Never emit IDs, hashes, file paths, storage targets, Candidate data or match scores."""


def build_job_model_payload(request: JobModelRequest) -> dict[str, Any]:
    provider_source = {
        "source_format": request.source_preparation["source_type"],
        "blocks": request.source_preparation["blocks"],
    }
    _assert_provider_safe(provider_source)
    return {
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": job_model_prompt()},
            {"role": "user", "content": json.dumps({"job_source": provider_source}, ensure_ascii=False, separators=(",", ":"))},
        ],
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "temperature": 0,
        "max_tokens": 2400,
    }


def _refs(value: Any, allowed: set[str], *, required: bool) -> list[str]:
    if not isinstance(value, list) or (required and not value) or any(not isinstance(ref, str) or ref not in allowed for ref in value):
        raise JobModelRuntimeError("job_model_grounding_validation_failed", "grounding", True)
    return list(value)


def _field(value: Any, allowed: set[str], code: str, *, required: bool = False, maximum: int = 12000) -> dict[str, Any]:
    field = _mapping(value, code)
    if set(field) != {"value", "source_refs"}:
        raise JobModelRuntimeError(code, "semantic", True)
    field_value = _text(field["value"], code, maximum) if required else _optional_text(field["value"], code, maximum)
    return {"value": field_value, "source_refs": _refs(field["source_refs"], allowed, required=field_value is not None)}


def validate_job_model_proposal(value: Any, preparation: Mapping[str, Any]) -> dict[str, Any]:
    proposal = _mapping(value, "job_model_proposal_contract_failed")
    required = {"contract_id", "title", "company", "location", "summary", "requirements", "uncertainties"}
    if set(proposal) != required or proposal.get("contract_id") != PROPOSAL_CONTRACT:
        raise JobModelRuntimeError("job_model_proposal_contract_failed", "semantic", True)
    allowed = {block["source_ref"] for block in preparation["blocks"]}
    requirements = proposal["requirements"]
    if not isinstance(requirements, list) or len(requirements) > 60:
        raise JobModelRuntimeError("job_model_proposal_contract_failed", "semantic", True)
    validated_requirements = []
    for raw in requirements:
        item = _mapping(raw, "job_model_proposal_contract_failed")
        if set(item) != {"label", "detail", "source_refs"}:
            raise JobModelRuntimeError("job_model_proposal_contract_failed", "semantic", True)
        validated_requirements.append({
            "label": _text(item["label"], "job_model_proposal_contract_failed", 240),
            "detail": _text(item["detail"], "job_model_proposal_contract_failed", 4000),
            "source_refs": _refs(item["source_refs"], allowed, required=True),
        })
    uncertainties = proposal["uncertainties"]
    if not isinstance(uncertainties, list) or len(uncertainties) > 24:
        raise JobModelRuntimeError("job_model_proposal_contract_failed", "semantic", True)
    validated_uncertainties = []
    for raw in uncertainties:
        item = _mapping(raw, "job_model_proposal_contract_failed")
        if set(item) != {"field", "reason"} or item.get("field") not in {"title", "company", "location", "summary", "requirements"}:
            raise JobModelRuntimeError("job_model_proposal_contract_failed", "semantic", True)
        validated_uncertainties.append({"field": item["field"], "reason": _text(item["reason"], "job_model_proposal_contract_failed", 1000)})
    result = {
        "contract_id": PROPOSAL_CONTRACT,
        "title": _field(proposal["title"], allowed, "job_model_proposal_contract_failed", required=True, maximum=500),
        "company": _field(proposal["company"], allowed, "job_model_proposal_contract_failed", maximum=500),
        "location": _field(proposal["location"], allowed, "job_model_proposal_contract_failed", maximum=500),
        "summary": _field(proposal["summary"], allowed, "job_model_proposal_contract_failed", maximum=12000),
        "requirements": validated_requirements,
        "uncertainties": validated_uncertainties,
    }
    _assert_provider_safe(result)
    return result


def normalize_job_model_response(provider_response: Any, request: JobModelRequest, http_status: int = 200) -> tuple[dict[str, Any], dict[str, Any]]:
    if http_status != 200:
        raise JobModelRuntimeError("deepseek_provider_http_error", "provider", True)
    response = _mapping(provider_response, "deepseek_response_malformed")
    if response.get("model") != MODEL_ID:
        raise JobModelRuntimeError("deepseek_returned_model_mismatch", "model", True)
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], Mapping) or choices[0].get("finish_reason") != "stop":
        raise JobModelRuntimeError("deepseek_response_malformed", "model_output", True)
    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, Mapping) else None
    if not isinstance(content, str) or not content.strip():
        raise JobModelRuntimeError("deepseek_response_malformed", "parsing", True)
    try:
        decoded = json.loads(content)
    except json.JSONDecodeError as error:
        raise JobModelRuntimeError("deepseek_response_malformed", "parsing", True) from error
    return validate_job_model_proposal(decoded, request.source_preparation), dict(response.get("usage") or {})


def execute_job_model_request(payload: Any, credential_reader: Callable[[], str | None], provider_call: Callable[[str, dict[str, Any]], tuple[int, dict[str, Any]]]) -> dict[str, Any]:
    request = validate_job_model_request(payload)
    try:
        credential = resolve_credential_reference(
            request.runtime_snapshot["credential_ref"], CREDENTIAL_REF, credential_reader,
            invalid_code="job_model_credential_reference_invalid", missing_code="deepseek_key_not_configured",
        )
    except ProviderRuntimeError as error:
        raise JobModelRuntimeError(error.code, error.failure_layer) from error
    provider_payload = build_job_model_payload(request)
    status, response = provider_call(credential, provider_payload)
    proposal, usage = normalize_job_model_response(response, request, status)
    return {
        "contract_id": RESULT_CONTRACT,
        "provider": PROVIDER_ID,
        "model": MODEL_ID,
        "protocol": PROTOCOL,
        "adapter_version": RUNTIME["adapter_version"],
        "runtime_snapshot_id": request.runtime_snapshot["snapshot_id"],
        "source_document_id": request.source_document["source_document_id"],
        "processing_run_id": request.processing_run_id,
        "operation_id": request.operation_id,
        "usage": usage,
        "job_proposal": proposal,
        "network_call_made": True,
        "persistence": "browser_working_job_save_required",
    }
