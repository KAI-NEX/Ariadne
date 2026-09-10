"""Provider-agnostic RuntimeCapability and immutable RuntimeSnapshot contracts.

This module normalizes the accepted browser Runtime selection and consumes an
existing provider/model descriptor.  It deliberately contains no Provider
registry, credential storage, network client, or business-operation routing.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNTIME_SNAPSHOT_SCHEMA_PATH = PROJECT_ROOT / "data" / "runtime_snapshot_v1.schema.json"
RUNTIME_SNAPSHOT_SCHEMA = json.loads(RUNTIME_SNAPSHOT_SCHEMA_PATH.read_text(encoding="utf-8"))
SNAPSHOT_FIELDS = tuple(RUNTIME_SNAPSHOT_SCHEMA["required"])
SNAPSHOT_OPTIONAL_FIELDS = tuple(name for name in RUNTIME_SNAPSHOT_SCHEMA["properties"] if name not in SNAPSHOT_FIELDS)
CAPABILITY_NAMES = tuple(RUNTIME_SNAPSHOT_SCHEMA["properties"]["capabilities"]["required"])
CAPABILITY_STATES = tuple(RUNTIME_SNAPSHOT_SCHEMA["$defs"]["capabilityState"]["enum"])

SUPPORTED = "supported"
UNSUPPORTED = "unsupported"
UNVERIFIED = "unverified"
LOCAL = "local"
MODEL = "model"

_LOCAL_CAPABILITY_NAMES = ("local_extraction", "local_ocr", "deterministic_structuring")
_MODEL_CAPABILITY_NAMES = tuple(name for name in CAPABILITY_NAMES if name not in _LOCAL_CAPABILITY_NAMES)
_PROVIDER_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")
_MODEL_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$")
_SNAPSHOT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_CONTROL_CHARACTER_PATTERN = re.compile(r"[\x00-\x1f\x7f]")
_UUID_REFERENCE_PATTERN = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.IGNORECASE)
_UNSTRUCTURED_TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9+/_=-]{24,}$")
_SENSITIVE_KEY_PATTERN = re.compile(r"(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|bearer|secret)", re.IGNORECASE)
_SECRET_VALUE_PATTERNS = (
    re.compile(r"\bBearer\s+\S+", re.IGNORECASE),
    re.compile(r"\b(?:sk|rk|pk|sess)-[A-Za-z0-9_-]{8,}"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"\b(?:api[_ -]?key|authorization|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+", re.IGNORECASE),
)


class ExecutionContractError(ValueError):
    """Safe contract failure that never includes the rejected value."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class RuntimeCapability:
    local_extraction: str
    local_ocr: str
    deterministic_structuring: str
    semantic_understanding: str
    candidate_model_structuring: str
    job_model_structuring: str
    model_merge: str
    ai_conversation: str
    vision: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class RuntimeSnapshot:
    snapshot_id: str
    captured_at: str
    mode: str
    provider: str | None
    model: str | None
    protocol: str | None
    capabilities: RuntimeCapability
    adapter_version: str | None
    prompt_version: str | None
    schema_version: str | None
    operation: str | None
    capability_basis: str | None
    action_schema_version: str | None
    request_config_version: str | None
    delivery_method: str | None
    credential_ref: str | None
    execution_settings: dict | None = None

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["capabilities"] = self.capabilities.to_dict()
        if self.execution_settings is None:
            result.pop("execution_settings")
        return result


def _local_runtime_capability(local_ocr_state: str = UNVERIFIED) -> RuntimeCapability:
    if local_ocr_state not in CAPABILITY_STATES:
        raise ExecutionContractError("runtime_capability_state_invalid")
    return RuntimeCapability(
        local_extraction=SUPPORTED,
        local_ocr=local_ocr_state,
        deterministic_structuring=SUPPORTED,
        semantic_understanding=UNSUPPORTED,
        candidate_model_structuring=UNSUPPORTED,
        job_model_structuring=UNSUPPORTED,
        model_merge=UNSUPPORTED,
        ai_conversation=UNSUPPORTED,
        vision=UNSUPPORTED,
    )


LOCAL_RUNTIME_CAPABILITY = _local_runtime_capability()


def _plain_mapping(value: Any, code: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ExecutionContractError(code)
    return value


def _optional_string(value: Any, code: str, maximum: int = 128) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise ExecutionContractError(code)
    return value.strip()


def _required_string(value: Any, code: str, maximum: int) -> str:
    normalized = _optional_string(value, code, maximum)
    if normalized is None:
        raise ExecutionContractError(code)
    return normalized


def _assert_no_secret_like(value: Any) -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            if _SENSITIVE_KEY_PATTERN.search(str(key)) and str(key) != "credential_ref":
                raise ExecutionContractError("runtime_snapshot_secret_field_forbidden")
            _assert_no_secret_like(nested)
        return
    if isinstance(value, (list, tuple)):
        for nested in value:
            _assert_no_secret_like(nested)
        return
    if isinstance(value, str) and any(pattern.search(value) for pattern in _SECRET_VALUE_PATTERNS):
        raise ExecutionContractError("runtime_snapshot_secret_value_forbidden")


def normalize_current_runtime(current_runtime: Mapping[str, Any]) -> dict[str, str | None]:
    """Normalize the accepted localStorage shape without migrating stored data."""
    runtime = _plain_mapping(current_runtime, "current_runtime_malformed")
    _assert_no_secret_like(runtime)
    if "capabilities" in runtime:
        raise ExecutionContractError("current_runtime_capability_claim_forbidden")
    raw_mode = str(runtime.get("mode") or "").strip().lower()
    mode = MODEL if raw_mode == "ai" else raw_mode
    if mode not in {LOCAL, MODEL}:
        raise ExecutionContractError("current_runtime_mode_invalid")

    provider_value = runtime.get("provider")
    model_value = runtime.get("model")
    if mode == LOCAL:
        if provider_value not in (None, "", "local") or model_value not in (None, ""):
            raise ExecutionContractError("local_runtime_identity_conflict")
        return {"mode": LOCAL, "provider": None, "model": None}

    provider = _required_string(provider_value, "model_runtime_provider_required", 64).lower()
    model = _required_string(model_value, "model_runtime_model_required", 200)
    if not _PROVIDER_PATTERN.fullmatch(provider):
        raise ExecutionContractError("model_runtime_provider_invalid")
    if not _MODEL_PATTERN.fullmatch(model):
        raise ExecutionContractError("model_runtime_model_invalid")
    return {"mode": MODEL, "provider": provider, "model": model}


def _descriptor_mapping(model_descriptor: Any) -> Mapping[str, Any]:
    if hasattr(model_descriptor, "to_public_dict"):
        model_descriptor = model_descriptor.to_public_dict()
    return _plain_mapping(model_descriptor, "runtime_model_descriptor_required")


def _runtime_capability(values: Mapping[str, Any]) -> RuntimeCapability:
    value_keys = set(values)
    if value_keys != set(CAPABILITY_NAMES):
        raise ExecutionContractError("runtime_capability_shape_invalid")
    if any(value not in CAPABILITY_STATES for value in values.values()):
        raise ExecutionContractError("runtime_capability_state_invalid")
    return RuntimeCapability(**{name: str(values[name]) for name in CAPABILITY_NAMES})


def _environment_local_ocr_state(environment_capabilities: Any | None) -> str:
    if environment_capabilities is None:
        return UNVERIFIED
    environment = _plain_mapping(environment_capabilities, "runtime_environment_capability_malformed")
    if set(environment) - {"local_ocr"}:
        raise ExecutionContractError("runtime_environment_capability_claim_unsupported")
    state = environment.get("local_ocr", UNVERIFIED)
    if state not in CAPABILITY_STATES:
        raise ExecutionContractError("runtime_capability_state_invalid")
    return str(state)


def _validate_local_capability_consistency(capability: RuntimeCapability) -> None:
    if capability.local_extraction != SUPPORTED or capability.deterministic_structuring != SUPPORTED:
        raise ExecutionContractError("local_runtime_capability_invalid")
    if any(getattr(capability, name) != UNSUPPORTED for name in _MODEL_CAPABILITY_NAMES):
        raise ExecutionContractError("local_runtime_capability_invalid")


def _validate_model_capability_consistency(capability: RuntimeCapability) -> None:
    if capability.local_extraction != SUPPORTED or capability.deterministic_structuring != SUPPORTED:
        raise ExecutionContractError("model_local_preprocessing_capability_invalid")
    dependent = ("candidate_model_structuring", "job_model_structuring", "model_merge", "ai_conversation")
    if any(getattr(capability, name) == SUPPORTED for name in dependent) and capability.semantic_understanding != SUPPORTED:
        raise ExecutionContractError("model_semantic_capability_inconsistent")


def resolve_runtime_capability(
    normalized_runtime: Mapping[str, Any],
    model_descriptor: Any | None = None,
    environment_capabilities: Mapping[str, Any] | None = None,
) -> RuntimeCapability:
    """Resolve contract invariants plus current environment/model evidence."""
    runtime = normalize_current_runtime(normalized_runtime)
    local_ocr_state = _environment_local_ocr_state(environment_capabilities)
    if runtime["mode"] == LOCAL:
        if model_descriptor is not None:
            raise ExecutionContractError("local_runtime_descriptor_forbidden")
        return _local_runtime_capability(local_ocr_state)

    descriptor = _descriptor_mapping(model_descriptor)
    _assert_no_secret_like(descriptor)
    descriptor_provider = _required_string(descriptor.get("provider_id", descriptor.get("provider")), "runtime_model_descriptor_provider_required", 64)
    descriptor_model = _required_string(descriptor.get("model_id", descriptor.get("model")), "runtime_model_descriptor_model_required", 200)
    if descriptor_provider.lower() != runtime["provider"] or descriptor_model != runtime["model"]:
        raise ExecutionContractError("runtime_model_descriptor_identity_mismatch")
    identity_validated = (
        descriptor.get("connection_verified") is True
        or isinstance(descriptor.get("discovery_source"), str) and bool(descriptor["discovery_source"].strip())
        or descriptor.get("runtime_capability_basis") == "adapter_verified"
    )
    if not identity_validated:
        raise ExecutionContractError("runtime_model_descriptor_unverified")

    values = {name: UNVERIFIED for name in CAPABILITY_NAMES}
    values["local_extraction"] = SUPPORTED
    values["local_ocr"] = local_ocr_state
    values["deterministic_structuring"] = SUPPORTED

    raw_runtime_capabilities = descriptor.get("runtime_capabilities")
    if raw_runtime_capabilities is not None:
        claims = _plain_mapping(raw_runtime_capabilities, "runtime_capability_claim_malformed")
        unknown = set(claims) - set(_MODEL_CAPABILITY_NAMES)
        if unknown:
            raise ExecutionContractError("runtime_capability_claim_unsupported")
        for name, state in claims.items():
            if state not in CAPABILITY_STATES:
                raise ExecutionContractError("runtime_capability_state_invalid")
            values[name] = str(state)
        product_capabilities = ("semantic_understanding", "candidate_model_structuring", "job_model_structuring", "model_merge", "ai_conversation")
        if any(claims.get(name) == SUPPORTED for name in product_capabilities) and descriptor.get("runtime_capability_basis") != "adapter_verified":
            raise ExecutionContractError("runtime_capability_claim_unverified")

    provider_capabilities = descriptor.get("capabilities")
    readiness = str(descriptor.get("multimodal_readiness") or "").upper()
    if raw_runtime_capabilities is None or "vision" not in raw_runtime_capabilities:
        if readiness == "VERIFIED":
            values["vision"] = SUPPORTED
        elif isinstance(provider_capabilities, (list, tuple)) and "VISION" in provider_capabilities:
            values["vision"] = UNVERIFIED
        elif isinstance(provider_capabilities, (list, tuple)) or readiness == "NOT_MULTIMODAL":
            values["vision"] = UNSUPPORTED

    capability = _runtime_capability(values)
    _validate_model_capability_consistency(capability)
    return capability


def _credential_reference(value: Any) -> str | None:
    credential_ref = _optional_string(value, "runtime_credential_ref_invalid", 512)
    if credential_ref is not None and _CONTROL_CHARACTER_PATTERN.search(credential_ref):
        raise ExecutionContractError("runtime_credential_ref_invalid")
    if credential_ref is not None and _UNSTRUCTURED_TOKEN_PATTERN.fullmatch(credential_ref) and not _UUID_REFERENCE_PATTERN.fullmatch(credential_ref):
        raise ExecutionContractError("runtime_snapshot_secret_value_forbidden")
    return credential_ref


def _descriptor_optional(descriptor: Mapping[str, Any] | None, *names: str) -> Any:
    if descriptor is None:
        return None
    for name in names:
        if descriptor.get(name) is not None:
            return descriptor[name]
    return None


def create_runtime_snapshot(
    current_runtime: Mapping[str, Any],
    *,
    model_descriptor: Any | None = None,
    snapshot_id: str | None = None,
    captured_at: str | None = None,
    credential_ref: str | None = None,
    adapter_version: str | None = None,
    prompt_version: str | None = None,
    schema_version: str | None = None,
    operation: str | None = None,
    capability_basis: str | None = None,
    action_schema_version: str | None = None,
    request_config_version: str | None = None,
    delivery_method: str | None = None,
    environment_capabilities: Mapping[str, Any] | None = None,
) -> RuntimeSnapshot:
    """Create an immutable snapshot without making a Provider call."""
    runtime = normalize_current_runtime(current_runtime)
    descriptor = _descriptor_mapping(model_descriptor) if model_descriptor is not None else None
    capability = resolve_runtime_capability(runtime, descriptor, environment_capabilities)
    if runtime["mode"] == LOCAL and credential_ref is not None:
        raise ExecutionContractError("local_runtime_credential_ref_forbidden")
    payload = {
        "snapshot_id": snapshot_id or f"runtime-snapshot-{uuid.uuid4()}",
        "captured_at": captured_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "mode": runtime["mode"],
        "provider": runtime["provider"],
        "model": runtime["model"],
        "protocol": _descriptor_optional(descriptor, "protocol"),
        "capabilities": capability.to_dict(),
        "adapter_version": adapter_version if adapter_version is not None else _descriptor_optional(descriptor, "adapter_version"),
        "prompt_version": prompt_version,
        "schema_version": schema_version,
        "operation": operation,
        "capability_basis": capability_basis if capability_basis is not None else _descriptor_optional(descriptor, "runtime_capability_basis"),
        "action_schema_version": action_schema_version,
        "request_config_version": request_config_version,
        "delivery_method": delivery_method if delivery_method is not None else _descriptor_optional(descriptor, "delivery_method", "document_delivery"),
        "credential_ref": credential_ref,
    }
    from src.model_settings import envelope
    settings = current_runtime["execution_settings"] if "execution_settings" in current_runtime else envelope(runtime["provider"], runtime["model"])
    if runtime["mode"] == MODEL and settings is not None:
        payload["execution_settings"] = settings
    return validate_runtime_snapshot(payload)


def _validate_captured_at(value: Any) -> str:
    if not isinstance(value, str) or not re.search(r"(?:Z|[+-]\d{2}:\d{2})$", value):
        raise ExecutionContractError("runtime_snapshot_captured_at_invalid")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ExecutionContractError("runtime_snapshot_captured_at_invalid") from error
    if parsed.tzinfo is None:
        raise ExecutionContractError("runtime_snapshot_captured_at_invalid")
    return value


def validate_runtime_snapshot(snapshot: RuntimeSnapshot | Mapping[str, Any]) -> RuntimeSnapshot:
    """Validate shape, identity, capability consistency and the secret boundary."""
    payload = snapshot.to_dict() if isinstance(snapshot, RuntimeSnapshot) else dict(_plain_mapping(snapshot, "runtime_snapshot_malformed"))
    _assert_no_secret_like(payload)
    if not set(SNAPSHOT_FIELDS).issubset(payload) or set(payload) - set(RUNTIME_SNAPSHOT_SCHEMA["properties"]):
        raise ExecutionContractError("runtime_snapshot_shape_invalid")

    snapshot_id = _optional_string(payload["snapshot_id"], "runtime_snapshot_id_invalid", 128)
    assert snapshot_id is not None
    if not _SNAPSHOT_ID_PATTERN.fullmatch(snapshot_id):
        raise ExecutionContractError("runtime_snapshot_id_invalid")
    captured_at = _validate_captured_at(payload["captured_at"])
    mode = payload["mode"]
    if mode not in {LOCAL, MODEL}:
        raise ExecutionContractError("runtime_snapshot_mode_invalid")
    capability = _runtime_capability(_plain_mapping(payload["capabilities"], "runtime_capability_shape_invalid"))

    provider = payload["provider"]
    model = payload["model"]
    credential_ref = _credential_reference(payload["credential_ref"])
    if mode == LOCAL:
        if provider is not None or model is not None:
            raise ExecutionContractError("local_runtime_identity_conflict")
        _validate_local_capability_consistency(capability)
        if credential_ref is not None:
            raise ExecutionContractError("local_runtime_credential_ref_forbidden")
    else:
        provider = _required_string(provider, "model_runtime_provider_required", 64)
        model = _required_string(model, "model_runtime_model_required", 200)
        if provider != provider.lower() or not _PROVIDER_PATTERN.fullmatch(provider):
            raise ExecutionContractError("model_runtime_provider_invalid")
        if not _MODEL_PATTERN.fullmatch(model):
            raise ExecutionContractError("model_runtime_model_invalid")
        _validate_model_capability_consistency(capability)

    execution_settings = payload.get("execution_settings")
    if execution_settings is not None:
        from src.model_settings import validate
        try:
            if mode != MODEL:
                raise ValueError("local_runtime_settings_forbidden")
            execution_settings = validate(execution_settings, provider, model)
        except ValueError as error:
            raise ExecutionContractError(str(error)) from error
    normalized = RuntimeSnapshot(
        execution_settings=execution_settings,
        snapshot_id=snapshot_id,
        captured_at=captured_at,
        mode=mode,
        provider=provider,
        model=model,
        protocol=_optional_string(payload["protocol"], "runtime_snapshot_protocol_invalid"),
        capabilities=capability,
        adapter_version=_optional_string(payload["adapter_version"], "runtime_snapshot_adapter_version_invalid"),
        prompt_version=_optional_string(payload["prompt_version"], "runtime_snapshot_prompt_version_invalid"),
        schema_version=_optional_string(payload["schema_version"], "runtime_snapshot_schema_version_invalid"),
        operation=_optional_string(payload.get("operation"), "runtime_snapshot_operation_invalid"),
        capability_basis=_optional_string(payload.get("capability_basis"), "runtime_snapshot_capability_basis_invalid"),
        action_schema_version=_optional_string(payload.get("action_schema_version"), "runtime_snapshot_action_schema_version_invalid"),
        request_config_version=_optional_string(payload.get("request_config_version"), "runtime_snapshot_request_config_version_invalid"),
        delivery_method=_optional_string(payload["delivery_method"], "runtime_snapshot_delivery_method_invalid"),
        credential_ref=credential_ref,
    )
    _assert_no_secret_like(normalized.to_dict())
    return normalized


def serialize_runtime_snapshot(snapshot: RuntimeSnapshot | Mapping[str, Any]) -> str:
    """Serialize only a validated snapshot; never serialize an arbitrary Runtime object."""
    validated = validate_runtime_snapshot(snapshot)
    return json.dumps(validated.to_dict(), ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def deserialize_runtime_snapshot(serialized: str) -> RuntimeSnapshot:
    if not isinstance(serialized, str):
        raise ExecutionContractError("runtime_snapshot_serialized_invalid")
    try:
        payload = json.loads(serialized)
    except (json.JSONDecodeError, TypeError) as error:
        raise ExecutionContractError("runtime_snapshot_serialized_invalid") from error
    return validate_runtime_snapshot(payload)
