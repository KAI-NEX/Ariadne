"""Small, explicit runtime contracts for provider/model selection.

This module deliberately does not store credentials or make network calls.  It
keeps provider identity, protocol, declared capability, request shape and
response normalization together so that an account-discovered model is never
silently treated as a generic OpenAI chat model.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Callable


OPENAI_CHAT_COMPLETIONS = "OPENAI_CHAT_COMPLETIONS"
OPENAI_RESPONSES = "OPENAI_RESPONSES"
ACCOUNT_EXPERIMENTAL = "ACCOUNT_EXPERIMENTAL"
TEXT = "TEXT"
STRUCTURED_JSON = "STRUCTURED_JSON"
VISION = "VISION"
MULTIMODAL_UNVERIFIED = "UNVERIFIED"
MULTIMODAL_VERIFIED = "VERIFIED"
NOT_MULTIMODAL = "NOT_MULTIMODAL"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MULTIMODAL_SMOKE_INSTRUCTION = "Read the text in this image. Reply only with the text you see."
MULTIMODAL_SMOKE_EXPECTED_TEXT = "JOB RADAR TEST"


class ProviderRuntimeError(ValueError):
    """A safe, displayable provider-runtime contract failure."""

    def __init__(self, code: str, failure_layer: str):
        super().__init__(code)
        self.code = code
        self.failure_layer = failure_layer


@dataclass(frozen=True)
class ModelDescriptor:
    provider_id: str
    model_id: str
    display_name: str
    protocol: str
    capabilities: tuple[str, ...]
    discovery_source: str
    runtime_default: bool = False
    multimodal_readiness: str = NOT_MULTIMODAL
    runtime_capability_basis: str | None = None
    runtime_capabilities: dict[str, str] | None = None
    adapter_version: str | None = None
    delivery_method: str | None = None

    def to_public_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["capabilities"] = list(self.capabilities)
        return result


@dataclass(frozen=True)
class ConnectionRequest:
    endpoint: str
    payload: dict[str, Any]
    protocol: str


@dataclass(frozen=True)
class NormalizedResponse:
    text: str
    usage: dict[str, Any]
    response_id: str | None


def deepseek_model_descriptors(model_ids: list[str]) -> list[ModelDescriptor]:
    """Normalize an account listing without inventing capabilities for unknown IDs."""
    descriptors: list[ModelDescriptor] = []
    for model_id in model_ids:
        if model_id == "deepseek-v4-flash":
            descriptors.append(ModelDescriptor("deepseek", model_id, f"DeepSeek · {model_id}", OPENAI_RESPONSES, (TEXT,), "official_contract", True))
        elif model_id == "deepseek-v4-pro":
            descriptors.append(ModelDescriptor(
                "deepseek", model_id, f"DeepSeek · {model_id}", OPENAI_CHAT_COMPLETIONS,
                (TEXT, STRUCTURED_JSON), "qualification_2026-09-03", False, NOT_MULTIMODAL,
                "adapter_verified",
                {
                    "semantic_understanding": "supported",
                    "candidate_model_structuring": "unsupported",
                    "job_model_structuring": "unsupported",
                    "model_merge": "unsupported",
                    "ai_conversation": "supported",
                    "vision": "unsupported",
                },
                "deepseek-candidate-conversation-v1",
                None,
            ))
        elif model_id == "deepseek-v4-flash-vision-exp":
            # DeepSeek's 2026-08-21 official announcement names this exact model as
            # its experimental multimodal vision API model.  Chat Completions is kept
            # because it is the product's established PDF-page image route.
            descriptors.append(ModelDescriptor(
                "deepseek", model_id, f"DeepSeek · {model_id}", OPENAI_CHAT_COMPLETIONS,
                (TEXT, VISION), "qualification_2026-09-03", True, MULTIMODAL_VERIFIED,
                "adapter_verified",
                {
                    "semantic_understanding": "supported",
                    "candidate_model_structuring": "supported",
                    "job_model_structuring": "unsupported",
                    "model_merge": "unsupported",
                    "ai_conversation": "unsupported",
                    "vision": "supported",
                },
                "deepseek-candidate-pdf-v1",
                "rendered_pdf_pages",
            ))
        else:
            descriptors.append(ModelDescriptor("deepseek", model_id, f"DeepSeek · {model_id}", ACCOUNT_EXPERIMENTAL, (), "account_discovered"))
    return descriptors


def is_multimodal(descriptor: ModelDescriptor) -> bool:
    """A model is multimodal only when its declared contract accepts text and images."""
    return TEXT in descriptor.capabilities and VISION in descriptor.capabilities


def v1_selector_descriptors(descriptors: list[ModelDescriptor]) -> list[ModelDescriptor]:
    """Expose only model-level multimodal candidates, never provider-wide capability."""
    return [item for item in descriptors if is_multimodal(item) and item.multimodal_readiness in {MULTIMODAL_UNVERIFIED, MULTIMODAL_VERIFIED}]


def descriptor_for(model_id: str, descriptors: list[ModelDescriptor]) -> ModelDescriptor:
    for descriptor in descriptors:
        if descriptor.model_id == model_id:
            return descriptor
    raise ProviderRuntimeError("deepseek_model_unavailable", "model")


def resolve_credential_reference(
    credential_ref: str,
    expected_ref: str,
    reader: Callable[[], str | None],
    *,
    invalid_code: str = "credential_reference_invalid",
    missing_code: str = "credential_not_configured",
) -> str:
    """Resolve one opaque handle without logging or serializing its secret value."""
    if credential_ref != expected_ref:
        raise ProviderRuntimeError(invalid_code, "credential")
    credential = reader()
    if not credential:
        raise ProviderRuntimeError(missing_code, "credential")
    return credential


def connection_request(descriptor: ModelDescriptor) -> ConnectionRequest:
    """Build the smallest documented synthetic test for one selected protocol."""
    if is_multimodal(descriptor):
        raise ProviderRuntimeError("selected_model_requires_multimodal_smoke", "capability")
    if TEXT not in descriptor.capabilities:
        raise ProviderRuntimeError("selected_model_text_capability_unconfirmed", "capability")
    if descriptor.protocol == OPENAI_RESPONSES:
        return ConnectionRequest(
            endpoint=f"{DEEPSEEK_BASE_URL}/responses",
            protocol=OPENAI_RESPONSES,
            payload={"model": descriptor.model_id, "instructions": "Reply only: OK", "input": "connection test", "reasoning": {"effort": "none"}, "max_output_tokens": 16},
        )
    if descriptor.protocol == OPENAI_CHAT_COMPLETIONS:
        return ConnectionRequest(
            endpoint=f"{DEEPSEEK_BASE_URL}/chat/completions",
            protocol=OPENAI_CHAT_COMPLETIONS,
            payload={"model": descriptor.model_id, "messages": [{"role": "user", "content": "Reply only: OK"}], "thinking": {"type": "disabled"}, "max_tokens": 16, "temperature": 0},
        )
    raise ProviderRuntimeError("selected_model_protocol_unconfirmed", "protocol")


def multimodal_connection_request(descriptor: ModelDescriptor, image_data_url: str) -> ConnectionRequest:
    """Build a capability-matched, data-free text+image readiness smoke.

    The image is synthetic and supplied by the caller.  This function has no
    provider/model-ID branches: protocol adapters determine the request shape.
    """
    if not is_multimodal(descriptor):
        raise ProviderRuntimeError("selected_model_multimodal_capability_unconfirmed", "capability")
    if not image_data_url.startswith("data:image/") or ";base64," not in image_data_url:
        raise ProviderRuntimeError("multimodal_smoke_image_invalid", "request")
    if descriptor.protocol == OPENAI_CHAT_COMPLETIONS:
        return ConnectionRequest(
            endpoint=f"{DEEPSEEK_BASE_URL}/chat/completions",
            protocol=OPENAI_CHAT_COMPLETIONS,
            payload={
                "model": descriptor.model_id,
                "messages": [{"role": "user", "content": [
                    {"type": "text", "text": MULTIMODAL_SMOKE_INSTRUCTION},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ]}],
                "thinking": {"type": "disabled"}, "max_tokens": 32, "temperature": 0,
            },
        )
    raise ProviderRuntimeError("selected_model_protocol_unconfirmed", "protocol")


def multimodal_smoke_passed(text: str) -> bool:
    """Permit only the requested visual reading result, after harmless whitespace normalization."""
    normalized = " ".join(text.upper().split())
    return normalized == MULTIMODAL_SMOKE_EXPECTED_TEXT


def _usage(payload: dict[str, Any]) -> dict[str, Any]:
    usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
    return {key: usage[key] for key in ("input_tokens", "output_tokens", "total_tokens", "prompt_tokens", "completion_tokens") if key in usage}


def normalize_chat_completion(payload: dict[str, Any]) -> NormalizedResponse:
    try:
        message = payload["choices"][0]["message"]
        text = message.get("content") if isinstance(message, dict) else None
    except (KeyError, IndexError, TypeError) as error:
        raise ProviderRuntimeError("chat_response_malformed", "unexpected_response") from error
    if not isinstance(text, str) or not text.strip():
        raise ProviderRuntimeError("chat_response_empty_content", "unexpected_response")
    return NormalizedResponse(text.strip(), _usage(payload), str(payload.get("id")) if payload.get("id") else None)


def normalize_responses_response(payload: dict[str, Any]) -> NormalizedResponse:
    direct = payload.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return NormalizedResponse(direct.strip(), _usage(payload), str(payload.get("id")) if payload.get("id") else None)
    texts: list[str] = []
    for item in payload.get("output") or []:
        if not isinstance(item, dict):
            continue
        for content in item.get("content") or []:
            if isinstance(content, dict) and content.get("type") in {"output_text", "text"} and isinstance(content.get("text"), str):
                texts.append(content["text"])
    text = "".join(texts).strip()
    if not text:
        raise ProviderRuntimeError("responses_response_empty_content", "unexpected_response")
    return NormalizedResponse(text, _usage(payload), str(payload.get("id")) if payload.get("id") else None)


def normalize_response(protocol: str, payload: dict[str, Any]) -> NormalizedResponse:
    if protocol == OPENAI_CHAT_COMPLETIONS:
        return normalize_chat_completion(payload)
    if protocol == OPENAI_RESPONSES:
        return normalize_responses_response(payload)
    raise ProviderRuntimeError("response_protocol_unconfirmed", "protocol")
