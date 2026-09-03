"""Offline RuntimeCapability/RuntimeSnapshot regression; no credentials or network."""

from dataclasses import FrozenInstanceError
from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.execution_contract import (  # noqa: E402
    CAPABILITY_NAMES,
    CAPABILITY_STATES,
    LOCAL_RUNTIME_CAPABILITY,
    SNAPSHOT_FIELDS,
    ExecutionContractError,
    create_runtime_snapshot,
    deserialize_runtime_snapshot,
    normalize_current_runtime,
    serialize_runtime_snapshot,
    validate_runtime_snapshot,
)
from src.provider_runtime import deepseek_model_descriptors  # noqa: E402


SCHEMA = json.loads((ROOT / "data" / "runtime_snapshot_v1.schema.json").read_text(encoding="utf-8"))
assert tuple(SCHEMA["required"]) == SNAPSHOT_FIELDS
assert tuple(SCHEMA["properties"]["capabilities"]["required"]) == CAPABILITY_NAMES
assert tuple(SCHEMA["$defs"]["capabilityState"]["enum"]) == CAPABILITY_STATES

local = create_runtime_snapshot(
    {"mode": "local", "provider": "local", "model": None},
    snapshot_id="runtime-snapshot-local-test",
    captured_at="2026-09-01T12:00:00Z",
)
assert local.mode == "local" and local.provider is None and local.model is None
assert local.capabilities == LOCAL_RUNTIME_CAPABILITY
assert local.capabilities.local_extraction == "supported"
assert local.capabilities.local_ocr == "unverified"  # Local mode alone is not OCR evidence.
assert local.capabilities.deterministic_structuring == "supported"
assert local.capabilities.semantic_understanding == "unsupported"
assert local.capabilities.ai_conversation == "unsupported"
assert local.capabilities.model_merge == "unsupported"
assert local.capabilities.vision == "unsupported"  # Native model vision, not Apple Vision OCR.
assert local.credential_ref is None

try:
    local.mode = "model"
    raise AssertionError("RuntimeSnapshot must be immutable")
except FrozenInstanceError:
    pass

local_ocr_supported = create_runtime_snapshot(
    {"mode": "local"},
    environment_capabilities={"local_ocr": "supported"},
    snapshot_id="runtime-snapshot-local-ocr-supported",
    captured_at="2026-09-01T12:00:01Z",
)
local_ocr_unsupported = create_runtime_snapshot(
    {"mode": "local"},
    environment_capabilities={"local_ocr": "unsupported"},
    snapshot_id="runtime-snapshot-local-ocr-unsupported",
    captured_at="2026-09-01T12:00:02Z",
)
assert local_ocr_supported.capabilities.local_ocr == "supported"
assert local_ocr_unsupported.capabilities.local_ocr == "unsupported"
assert local_ocr_supported.capabilities.local_extraction == "supported"
assert local_ocr_unsupported.capabilities.deterministic_structuring == "supported"
assert local_ocr_supported.capabilities.vision == "unsupported"

try:
    local.capabilities.semantic_understanding = "supported"
    raise AssertionError("RuntimeCapability must be immutable")
except FrozenInstanceError:
    pass

descriptor = {
    "provider_id": "deepseek",
    "model_id": "deepseek-v4-flash-vision-exp",
    "protocol": "OPENAI_CHAT_COMPLETIONS",
    "capabilities": ["TEXT", "VISION"],
    "multimodal_readiness": "VERIFIED",
    "adapter_version": "provider-runtime-v1",
    "delivery_method": "rendered_pdf_pages",
    "runtime_capability_basis": "adapter_verified",
    "runtime_capabilities": {
        "semantic_understanding": "supported",
        "candidate_model_structuring": "supported",
        "job_model_structuring": "supported",
        "model_merge": "supported",
        "ai_conversation": "supported",
        "vision": "supported",
    },
}
model = create_runtime_snapshot(
    {"mode": "ai", "provider": "DeepSeek", "model": "deepseek-v4-flash-vision-exp"},
    model_descriptor=descriptor,
    snapshot_id="runtime-snapshot-model-test",
    captured_at="2026-09-01T12:01:00+00:00",
    credential_ref="provider:deepseek:default",
    environment_capabilities={"local_ocr": "supported"},
    prompt_version="candidate-proposal-v1",
    schema_version="candidate-proposal-v1",
)
assert model.mode == "model" and model.provider == "deepseek"
assert model.protocol == "OPENAI_CHAT_COMPLETIONS"
assert model.capabilities.semantic_understanding == "supported"
assert model.capabilities.local_ocr == "supported"
assert model.capabilities.vision == "supported"
assert model.credential_ref == "provider:deepseek:default"

known_descriptor = deepseek_model_descriptors(["deepseek-v4-flash-vision-exp"])[0]
verified_candidate_product = create_runtime_snapshot(
    {"mode": "model", "provider": "deepseek", "model": known_descriptor.model_id},
    model_descriptor=known_descriptor,
    snapshot_id="runtime-snapshot-known-model",
    captured_at="2026-09-01T12:02:00Z",
)
assert verified_candidate_product.capabilities.vision == "supported"
assert verified_candidate_product.capabilities.local_ocr == "unverified"
assert verified_candidate_product.capabilities.semantic_understanding == "supported"
assert verified_candidate_product.capabilities.candidate_model_structuring == "supported"
assert verified_candidate_product.capabilities.job_model_structuring == "unsupported"
assert verified_candidate_product.capabilities.model_merge == "unsupported"
assert verified_candidate_product.capabilities.ai_conversation == "unsupported"

conversation_descriptor = deepseek_model_descriptors(["deepseek-v4-pro"])[0]
verified_conversation = create_runtime_snapshot(
    {"mode": "model", "provider": "deepseek", "model": conversation_descriptor.model_id},
    model_descriptor=conversation_descriptor,
    snapshot_id="runtime-snapshot-candidate-conversation",
    captured_at="2026-09-03T07:00:00Z",
    operation="CANDIDATE_CONVERSATION_TURN",
    capability_basis="adapter_verified",
    action_schema_version="ariadne-candidate-conversation-action-v1",
    request_config_version="deepseek-candidate-conversation-request-v1",
)
assert verified_conversation.capabilities.ai_conversation == "supported"
assert verified_conversation.capabilities.candidate_model_structuring == "unsupported"
assert verified_conversation.operation == "CANDIDATE_CONVERSATION_TURN"
assert verified_conversation.action_schema_version == "ariadne-candidate-conversation-action-v1"
assert verified_conversation.request_config_version == "deepseek-candidate-conversation-request-v1"
legacy_snapshot = {key: value for key, value in verified_conversation.to_dict().items() if key in SNAPSHOT_FIELDS}
assert validate_runtime_snapshot(legacy_snapshot).operation is None

serialized = serialize_runtime_snapshot(model)
restored = deserialize_runtime_snapshot(serialized)
assert restored == model
assert restored.snapshot_id == model.snapshot_id
assert "provider:deepseek:default" in serialized
assert "Authorization" not in serialized and "Bearer" not in serialized

for safe_credential_ref in (
    "credential-handle",
    "keychain://com.ariadne/deepseek/default",
    "session-memory#credential-42",
    "550e8400-e29b-41d4-a716-446655440000",
):
    validated = validate_runtime_snapshot({**model.to_dict(), "credential_ref": safe_credential_ref})
    assert validated.credential_ref == safe_credential_ref


def expect_error(code: str, callback) -> None:
    try:
        callback()
        raise AssertionError(f"expected {code}")
    except ExecutionContractError as error:
        assert error.code == code, (error.code, code)


expect_error("local_runtime_identity_conflict", lambda: normalize_current_runtime({"mode": "local", "provider": "deepseek", "model": None}))
expect_error("local_runtime_identity_conflict", lambda: normalize_current_runtime({"mode": "local", "provider": "local", "model": "fake-model"}))
expect_error("model_runtime_provider_required", lambda: normalize_current_runtime({"mode": "model", "model": "fixture-model"}))
expect_error("model_runtime_model_required", lambda: normalize_current_runtime({"mode": "model", "provider": "fixture"}))
expect_error("current_runtime_mode_invalid", lambda: normalize_current_runtime({"mode": "hybrid"}))
expect_error("current_runtime_capability_claim_forbidden", lambda: normalize_current_runtime({"mode": "local", "capabilities": {}}))
expect_error("runtime_snapshot_secret_field_forbidden", lambda: normalize_current_runtime({"mode": "local", "api_key": "example-placeholder"}))
expect_error("runtime_model_descriptor_required", lambda: create_runtime_snapshot({"mode": "model", "provider": "fixture", "model": "fixture-model"}))
expect_error(
    "runtime_model_descriptor_identity_mismatch",
    lambda: create_runtime_snapshot(
        {"mode": "model", "provider": "fixture", "model": "fixture-model"},
        model_descriptor={"provider_id": "other", "model_id": "fixture-model"},
    ),
)
expect_error(
    "runtime_model_descriptor_unverified",
    lambda: create_runtime_snapshot(
        {"mode": "model", "provider": "fixture", "model": "fixture-model"},
        model_descriptor={"provider_id": "fixture", "model_id": "fixture-model"},
    ),
)
expect_error(
    "runtime_snapshot_secret_field_forbidden",
    lambda: create_runtime_snapshot(
        {"mode": "model", "provider": "fixture", "model": "fixture-model"},
        model_descriptor={"provider_id": "fixture", "model_id": "fixture-model", "connection_verified": True, "api_key": "example-placeholder"},
    ),
)
expect_error(
    "runtime_capability_claim_unsupported",
    lambda: create_runtime_snapshot(
        {"mode": "model", "provider": "fixture", "model": "fixture-model"},
        model_descriptor={"provider_id": "fixture", "model_id": "fixture-model", "connection_verified": True, "runtime_capabilities": {"telepathy": "supported"}},
    ),
)
expect_error(
    "runtime_capability_claim_unverified",
    lambda: create_runtime_snapshot(
        {"mode": "model", "provider": "fixture", "model": "fixture-model"},
        model_descriptor={"provider_id": "fixture", "model_id": "fixture-model", "connection_verified": True, "runtime_capabilities": {"semantic_understanding": "supported"}},
    ),
)
expect_error(
    "model_semantic_capability_inconsistent",
    lambda: create_runtime_snapshot(
        {"mode": "model", "provider": "fixture", "model": "fixture-model"},
        model_descriptor={"provider_id": "fixture", "model_id": "fixture-model", "runtime_capability_basis": "adapter_verified", "runtime_capabilities": {"ai_conversation": "supported"}},
    ),
)
for secret_like_credential in (
    "sk-proj-exampleplaceholder123456",
    "Bearer example-placeholder-token",
    "Authorization: example-placeholder",
    "access_token=example-placeholder",
    "AIza012345678901234567890123456789",
    "AbCdEfGhIjKlMnOpQrStUvWxYz012345",
):
    expect_error(
        "runtime_snapshot_secret_value_forbidden",
        lambda secret_like_credential=secret_like_credential: create_runtime_snapshot(
            {"mode": "model", "provider": "fixture", "model": "fixture-model"},
            model_descriptor={"provider_id": "fixture", "model_id": "fixture-model", "connection_verified": True},
            credential_ref=secret_like_credential,
        ),
    )
expect_error(
    "runtime_credential_ref_invalid",
    lambda: validate_runtime_snapshot({**model.to_dict(), "credential_ref": "unsafe\nreference"}),
)
expect_error(
    "runtime_capability_state_invalid",
    lambda: create_runtime_snapshot({"mode": "local"}, environment_capabilities={"local_ocr": "assumed"}),
)
expect_error(
    "runtime_environment_capability_claim_unsupported",
    lambda: create_runtime_snapshot({"mode": "local"}, environment_capabilities={"vision": "supported"}),
)
expect_error(
    "runtime_snapshot_secret_field_forbidden",
    lambda: validate_runtime_snapshot({**local.to_dict(), "Authorization": "example-placeholder"}),
)
expect_error("runtime_snapshot_shape_invalid", lambda: validate_runtime_snapshot({key: value for key, value in local.to_dict().items() if key != "captured_at"}))
expect_error("runtime_snapshot_serialized_invalid", lambda: deserialize_runtime_snapshot("not-json"))
expect_error("local_runtime_credential_ref_forbidden", lambda: create_runtime_snapshot({"mode": "local"}, credential_ref="provider:local:default"))

source = (ROOT / "src" / "execution_contract.py").read_text(encoding="utf-8")
assert "urlopen" not in source and "requests." not in source and "Authorization" not in source
print("runtime_execution_python_contract=pass")
