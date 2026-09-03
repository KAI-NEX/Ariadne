"""Qualified DeepSeek Candidate Conversation turn boundary.

The adapter accepts only an immutable Candidate Working Model observation and
returns one locally validated, non-authoritative action.  It does not read a
PDF, create a ProcessingRun, persist messages, or apply a Working Model patch.
"""

from __future__ import annotations

import json
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Callable, Mapping
from urllib.parse import quote

from src.execution_contract import ExecutionContractError, validate_runtime_snapshot
from src.provider_runtime import OPENAI_CHAT_COMPLETIONS, ProviderRuntimeError, resolve_credential_reference
from src.truth_persistence import TruthPersistenceError, validate_candidate_working_model


PROVIDER_ID = "deepseek"
MODEL_ID = "deepseek-v4-pro"
PROTOCOL = OPENAI_CHAT_COMPLETIONS
ADAPTER_VERSION = "deepseek-candidate-conversation-v1"
PROMPT_VERSION = "candidate-conversation-semantic-prompt-v1"
REQUEST_CONFIG_VERSION = "deepseek-candidate-conversation-request-v1"
CAPABILITY_BASIS = "adapter_verified"
CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision"
OPERATION = "CANDIDATE_CONVERSATION_TURN"
CONTRACT_ID = "ariadne-candidate-conversation-v1"
SUBJECT_TYPE = "CANDIDATE"

CONTRACT_MANIFEST_PATH = Path(__file__).resolve().parents[1] / "data" / "candidate_conversation_contract_v1.json"
CONTRACT_MANIFEST = json.loads(CONTRACT_MANIFEST_PATH.read_text(encoding="utf-8"))
ACTION_SCHEMA_VERSION = CONTRACT_MANIFEST["canonical_action_version"]
SEMANTIC_ACTION_SCHEMA_VERSION = CONTRACT_MANIFEST["semantic_action_version"]
ACTIONS = set(CONTRACT_MANIFEST["actions"])
UNSUPPORTED_ACTIONS = set(CONTRACT_MANIFEST["unsupported_actions"])
OPERATIONS = set(CONTRACT_MANIFEST["canonical_operations"])
ITEM_FIELDS = set(CONTRACT_MANIFEST["canonical_item_fields"])
CLEARABLE_ITEM_FIELDS = set(CONTRACT_MANIFEST["canonical_clearable_item_fields"])
UNCERTAINTY_STATUSES = set(CONTRACT_MANIFEST["uncertainty_statuses"])
TOP_LEVEL_KEYS = set(CONTRACT_MANIFEST["canonical_keys"]["top_level"])
OBSERVED_KEYS = set(CONTRACT_MANIFEST["canonical_keys"]["observed_working_model"])
PATCH_KEYS = set(CONTRACT_MANIFEST["canonical_keys"]["patch"])
OPERATION_KEYS = {name: set(keys) for name, keys in CONTRACT_MANIFEST["canonical_keys"]["operations"].items()}
LIMITS = CONTRACT_MANIFEST["limits"]
SEMANTIC_CONTRACT = CONTRACT_MANIFEST["semantic_contract"]
SEMANTIC_ACTIONS = set(CONTRACT_MANIFEST["actions"])
SEMANTIC_INTENTS = set(SEMANTIC_CONTRACT["intents"])
SEMANTIC_CONCEPTS = set(SEMANTIC_CONTRACT["concepts"])
DIAGNOSTIC_STAGES = {
    "PROVIDER_ENVELOPE", "MODEL_IDENTITY", "FINISH_REASON", "JSON_PARSE", "SEMANTIC_SCHEMA",
    "RESOLUTION", "CANONICAL_SCHEMA", "SEMANTIC_GUARD", "STALE", "AUTHORITY", "PERSISTENCE",
}
MULTI_INTENT_PATTERNS = (
    re.compile(r"(?:所有|全部|每一个|每个|统一这些|这些都|两项|这两|多个|跨(?:卡片|项目))"),
    re.compile(r"\b(?:all|every|both|multiple|across\s+(?:items|cards))\b", re.IGNORECASE),
)


class CandidateConversationRuntimeError(ValueError):
    """A safe fail-closed error code for this bounded adapter."""

    def __init__(self, code: str, failure_layer: str, network_call_made: bool = False, diagnostics: dict[str, Any] | None = None):
        super().__init__(code)
        self.code = code
        self.failure_layer = failure_layer
        self.network_call_made = network_call_made
        self.diagnostics = diagnostics or {}


def _diagnostic(stage: str, code: str, field_category: str | None = None, action_type: Any = None) -> dict[str, Any]:
    if stage not in DIAGNOSTIC_STAGES:
        raise ValueError("unsupported_candidate_conversation_diagnostic_stage")
    result: dict[str, Any] = {"stage": stage, "error_code": code}
    if field_category is not None:
        result["field_category"] = field_category
    if action_type in ACTIONS or action_type in UNSUPPORTED_ACTIONS:
        result["action_type"] = action_type
    return result


def _failure(code: str, layer: str, stage: str, field_category: str | None = None, action_type: Any = None) -> CandidateConversationRuntimeError:
    return CandidateConversationRuntimeError(code, layer, diagnostics=_diagnostic(stage, code, field_category, action_type))


@dataclass(frozen=True)
class CandidateConversationRequest:
    conversation: dict[str, Any]
    human_message: str
    observation: dict[str, Any]
    working_model: dict[str, Any]
    compiled_context: dict[str, Any] | None
    runtime_snapshot: dict[str, Any]
    draft: dict[str, Any] | None
    execution_id: str
    generation: str


class CandidateConversationExecutionRegistry:
    """Process-local generation guard; cancellation does not claim Provider abort."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._active: dict[str, str] = {}
        self._cancelled: set[tuple[str, str]] = set()

    def begin(self, execution_id: str, generation: str) -> bool:
        with self._lock:
            if execution_id in self._active:
                return False
            self._active[execution_id] = generation
            return True

    def cancel(self, execution_id: str, generation: str) -> bool:
        with self._lock:
            active_generation = self._active.get(execution_id)
            if active_generation != generation:
                return False
            self._cancelled.add((execution_id, generation))
            self._active.pop(execution_id, None)
            return True

    def accept(self, execution_id: str, generation: str) -> bool:
        with self._lock:
            accepted = self._active.get(execution_id) == generation and (execution_id, generation) not in self._cancelled
            self._active.pop(execution_id, None)
            self._cancelled.discard((execution_id, generation))
            return accepted

    def fail(self, execution_id: str, generation: str) -> None:
        with self._lock:
            if self._active.get(execution_id) == generation:
                self._active.pop(execution_id, None)
            self._cancelled.discard((execution_id, generation))


def _mapping(value: Any, code: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise CandidateConversationRuntimeError(code, "contract_validation")
    return value


def _exact(value: Any, keys: set[str], code: str = "EXACT_SCHEMA_FAILURE") -> Mapping[str, Any]:
    result = _mapping(value, code)
    if set(result) != keys:
        raise CandidateConversationRuntimeError(code, "contract_validation")
    return result


def _string(value: Any, code: str = "EXACT_SCHEMA_FAILURE", maximum: int = 8000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise CandidateConversationRuntimeError(code, "contract_validation")
    return value.strip()


def _has_explicit_multi_intent(message: str) -> bool:
    return any(pattern.search(message) for pattern in MULTI_INTENT_PATTERNS)


def _fingerprint(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def _validate_snapshot(value: Any) -> dict[str, Any]:
    try:
        snapshot = validate_runtime_snapshot(value)
    except ExecutionContractError as error:
        raise CandidateConversationRuntimeError("RUNTIME_SNAPSHOT_INVALID", "runtime") from error
    capabilities = snapshot.capabilities.to_dict()
    if (
        snapshot.mode != "model"
        or snapshot.provider != PROVIDER_ID
        or snapshot.model != MODEL_ID
        or snapshot.protocol != PROTOCOL
        or snapshot.adapter_version != ADAPTER_VERSION
        or snapshot.prompt_version != PROMPT_VERSION
        or snapshot.operation != OPERATION
        or snapshot.capability_basis != CAPABILITY_BASIS
        or snapshot.action_schema_version != ACTION_SCHEMA_VERSION
        or snapshot.request_config_version != REQUEST_CONFIG_VERSION
        or snapshot.delivery_method is not None
        or snapshot.credential_ref != CREDENTIAL_REF
        or capabilities.get("ai_conversation") != "supported"
        or capabilities.get("semantic_understanding") != "supported"
    ):
        raise CandidateConversationRuntimeError("RUNTIME_NOT_ELIGIBLE", "runtime")
    return snapshot.to_dict()


def _validate_conversation(value: Any) -> dict[str, Any]:
    conversation = _exact(value, {"contract_id", "conversation_id", "subject_type", "subject_id", "created_at"})
    subject_id = _string(conversation.get("subject_id"), "CONVERSATION_IDENTITY_INVALID", 256)
    encoded_subject_id = quote(subject_id, safe="~()*!.'-")
    expected_id = f"candidate-conversation:{encoded_subject_id}"
    if (conversation.get("contract_id") != CONTRACT_ID or conversation.get("subject_type") != SUBJECT_TYPE
            or conversation.get("conversation_id") != expected_id):
        raise CandidateConversationRuntimeError("CONVERSATION_IDENTITY_INVALID", "contract_validation")
    _string(conversation.get("created_at"), "CONVERSATION_IDENTITY_INVALID", 64)
    return dict(conversation)


def _validate_focus(value: Any, item_ids: set[str]) -> dict[str, Any]:
    focus = _mapping(value, "FOCUS_INVALID")
    focus_type = focus.get("type")
    expected = {"type"} if focus_type == "CANDIDATE" else {"type", "item_id"} if focus_type == "ITEM" else {"type", "item_id", "draft_fingerprint"} if focus_type == "ITEM_DRAFT" else set()
    if not expected or set(focus) != expected:
        raise CandidateConversationRuntimeError("FOCUS_INVALID", "contract_validation")
    if focus_type != "CANDIDATE" and focus.get("item_id") not in item_ids:
        raise CandidateConversationRuntimeError("INVALID_TARGET", "contract_validation")
    if focus_type == "ITEM_DRAFT" and not re.fullmatch(r"sha256:[a-f0-9]{64}", str(focus.get("draft_fingerprint") or "")):
        raise CandidateConversationRuntimeError("FOCUS_INVALID", "contract_validation")
    return dict(focus)


def _validate_observation(value: Any, working_model: dict[str, Any], conversation: dict[str, Any]) -> dict[str, Any]:
    observation = _exact(value, {"contract_id", "candidate_context_id", "working_model_id", "version", "fingerprint", "focus"})
    if observation.get("contract_id") != f"{CONTRACT_ID}-observation-v1":
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
    if (observation.get("candidate_context_id") != conversation["subject_id"]
            or observation.get("working_model_id") != working_model["working_model_id"]
            or observation.get("version") != working_model["version"]
            or observation.get("fingerprint") != working_model["fingerprint"]):
        raise CandidateConversationRuntimeError("STALE_WORKING_OBSERVATION", "stale")
    normalized = dict(observation)
    normalized["focus"] = _validate_focus(observation.get("focus"), {str(item.get("item_id")) for item in working_model["payload"].get("items") or []})
    return normalized


_CONTEXT_FORBIDDEN_KEY = re.compile(r"(?:api[_-]?key|authorization|credential|access[_-]?token|refresh[_-]?token|raw[_-]?(?:pdf|response|http)|pdf[_-]?bytes|rendered[_-]?page|image[_-]?data)", re.IGNORECASE)
_CONTEXT_FORBIDDEN_VALUE = re.compile(r"(?:\bBearer\s+\S+|\b(?:sk|rk|pk|sess)-[A-Za-z0-9_-]{8,}|^data:(?:application|image)/|%PDF)", re.IGNORECASE)


def _assert_compiled_context_safe(value: Any) -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            if not isinstance(key, str) or _CONTEXT_FORBIDDEN_KEY.search(key):
                raise CandidateConversationRuntimeError("CONTEXT_PRIVATE_MATERIAL_FORBIDDEN", "context")
            _assert_compiled_context_safe(nested)
    elif isinstance(value, list):
        for item in value:
            _assert_compiled_context_safe(item)
    elif isinstance(value, str) and _CONTEXT_FORBIDDEN_VALUE.search(value):
        raise CandidateConversationRuntimeError("CONTEXT_PRIVATE_MATERIAL_FORBIDDEN", "context")


def _validate_compiled_context(value: Any, conversation: dict[str, Any], observation: dict[str, Any], working_model: dict[str, Any], human_message: str) -> dict[str, Any]:
    context = _exact(value, {
        "contract_id", "compiler_version", "conversation_subject", "observed_working_model", "focus",
        "candidate", "open_uncertainties", "bounded_history", "current_user_message", "summary", "diagnostics",
    }, "COMPILED_CONTEXT_INVALID")
    if context.get("contract_id") != "ariadne-candidate-conversation-context-v1" or context.get("compiler_version") != "candidate-conversation-context-compiler-v1":
        raise CandidateConversationRuntimeError("COMPILED_CONTEXT_INVALID", "context")
    subject = _exact(context.get("conversation_subject"), {"conversation_id", "subject_type", "candidate_context_id", "source_document_id"}, "COMPILED_CONTEXT_INVALID")
    observed = _exact(context.get("observed_working_model"), {"working_model_id", "version", "fingerprint"}, "COMPILED_CONTEXT_INVALID")
    current = _exact(context.get("current_user_message"), {"message_id", "turn_id", "text", "created_at"}, "COMPILED_CONTEXT_INVALID")
    diagnostics = _mapping(context.get("diagnostics"), "COMPILED_CONTEXT_INVALID")
    if (subject.get("conversation_id") != conversation["conversation_id"] or subject.get("subject_type") != SUBJECT_TYPE
            or subject.get("candidate_context_id") != conversation["subject_id"] or subject.get("source_document_id") != working_model["source_document_id"]
            or dict(observed) != {key: observation[key] for key in ("working_model_id", "version", "fingerprint")}
            or context.get("focus") != observation["focus"] or current.get("text") != human_message
            or not isinstance(context.get("candidate"), Mapping) or not isinstance(context.get("open_uncertainties"), list)
            or not isinstance(context.get("bounded_history"), list) or context.get("summary") is not None):
        raise CandidateConversationRuntimeError("COMPILED_CONTEXT_INVALID", "context")
    _assert_compiled_context_safe(context)
    serialized_size = len(json.dumps(context, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    if diagnostics.get("serialized_size_bytes") != serialized_size or serialized_size > 64 * 1024:
        raise CandidateConversationRuntimeError("CONTEXT_LIMIT_EXCEEDED", "context")
    if diagnostics.get("history_turn_count") != len(context["bounded_history"]) or diagnostics.get("focus_type") != observation["focus"]["type"]:
        raise CandidateConversationRuntimeError("COMPILED_CONTEXT_INVALID", "context")
    return json.loads(json.dumps(context, ensure_ascii=False))


def validate_candidate_conversation_request(payload: Any) -> CandidateConversationRequest:
    request = _mapping(payload, "EXACT_SCHEMA_FAILURE")
    base_keys = {"contract_id", "conversation", "human_message", "observation", "working_model", "runtime_snapshot", "draft", "turn"}
    if set(request) not in (base_keys, base_keys | {"compiled_context"}):
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
    if request.get("contract_id") != f"{CONTRACT_ID}-runtime-request-v1":
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
    conversation = _validate_conversation(request.get("conversation"))
    human_message = _string(request.get("human_message"), "HUMAN_MESSAGE_INVALID", LIMITS["human_message"])
    try:
        working_model = validate_candidate_working_model(request.get("working_model"))
    except TruthPersistenceError as error:
        raise CandidateConversationRuntimeError("WORKING_MODEL_INVALID", "contract_validation") from error
    if working_model["fingerprint"] != _fingerprint(working_model["payload"]):
        raise CandidateConversationRuntimeError("WORKING_MODEL_INVALID", "contract_validation")
    observation = _validate_observation(request.get("observation"), working_model, conversation)
    compiled_context = None
    if "compiled_context" in request:
        compiled_context = _validate_compiled_context(request.get("compiled_context"), conversation, observation, working_model, human_message)
    snapshot = _validate_snapshot(request.get("runtime_snapshot"))
    draft_value = request.get("draft")
    draft = None
    if observation["focus"]["type"] == "ITEM_DRAFT":
        draft_mapping = _exact(draft_value, {"item_id", "item", "draft_fingerprint"})
        if (draft_mapping.get("item_id") != observation["focus"]["item_id"]
                or draft_mapping.get("draft_fingerprint") != observation["focus"]["draft_fingerprint"]
                or not isinstance(draft_mapping.get("item"), Mapping)
                or draft_mapping["item"].get("item_id") != draft_mapping.get("item_id")
                or draft_mapping.get("draft_fingerprint") != _fingerprint(draft_mapping.get("item"))):
            raise CandidateConversationRuntimeError("STALE_WORKING_OBSERVATION", "stale")
        draft = {"item_id": draft_mapping["item_id"], "item": dict(draft_mapping["item"]), "draft_fingerprint": draft_mapping["draft_fingerprint"]}
    elif draft_value is not None:
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
    turn = _exact(request.get("turn"), {"execution_id", "generation"})
    execution_id = _string(turn.get("execution_id"), "TURN_EXECUTION_ID_INVALID", 256)
    generation = _string(turn.get("generation"), "TURN_GENERATION_INVALID", 256)
    return CandidateConversationRequest(conversation, human_message, observation, working_model, compiled_context, snapshot, draft, execution_id, generation)


def _source_ref_ids(item: Mapping[str, Any]) -> set[str]:
    result: set[str] = set()
    for ref in item.get("grounding_refs") or []:
        if isinstance(ref, Mapping):
            for key in ("source_ref_id", "grounding_ref_id"):
                if isinstance(ref.get(key), str) and ref[key].strip():
                    result.add(ref[key].strip())
    return result


def _validate_operation(value: Any, item: Mapping[str, Any]) -> dict[str, Any]:
    operation = _mapping(value, "UNSUPPORTED_OPERATION")
    operation_type = operation.get("operation")
    if operation_type not in OPERATIONS:
        raise CandidateConversationRuntimeError("UNSUPPORTED_OPERATION", "contract_validation")
    if operation_type == "SET_ITEM_FIELD":
        _exact(operation, OPERATION_KEYS[operation_type], "ACTION_OPERATION_SHAPE_INVALID")
        if operation.get("field") not in ITEM_FIELDS:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
        _string(operation.get("value"), "ACTION_OPERATION_SHAPE_INVALID", LIMITS["message"])
    elif operation_type == "CLEAR_ITEM_FIELD":
        _exact(operation, OPERATION_KEYS[operation_type], "ACTION_OPERATION_SHAPE_INVALID")
        if operation.get("field") not in CLEARABLE_ITEM_FIELDS:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
    elif operation_type == "SET_FACT_VALUE":
        _exact(operation, OPERATION_KEYS[operation_type], "ACTION_OPERATION_SHAPE_INVALID")
        _string(operation.get("value"), "ACTION_OPERATION_SHAPE_INVALID", LIMITS["message"])
        fact_id = _string(operation.get("fact_id"), "INVALID_OPERATION_TARGET", LIMITS["identifier"])
        if fact_id not in {fact.get("fact_id") for fact in item.get("facts") or [] if isinstance(fact, Mapping)}:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
    else:
        _exact(operation, OPERATION_KEYS[operation_type], "ACTION_OPERATION_SHAPE_INVALID")
        if operation.get("status") not in UNCERTAINTY_STATUSES:
            raise CandidateConversationRuntimeError("ACTION_OPERATION_SHAPE_INVALID", "contract_validation")
        uncertainty_id = _string(operation.get("uncertainty_id"), "INVALID_OPERATION_TARGET", LIMITS["identifier"])
        if uncertainty_id not in {entry.get("uncertainty_id") for entry in item.get("uncertainties") or [] if isinstance(entry, Mapping)}:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
    return dict(operation)


def _validate_patch(value: Any, item_by_id: dict[str, Mapping[str, Any]]) -> dict[str, Any]:
    patch = _exact(value, PATCH_KEYS, "ACTION_PATCH_SHAPE_INVALID")
    target = _string(patch.get("target_item_id"), "INVALID_TARGET", LIMITS["identifier"])
    item = item_by_id.get(target)
    if item is None:
        raise CandidateConversationRuntimeError("INVALID_TARGET", "contract_validation")
    operations = patch.get("operations")
    if not isinstance(operations, list) or not 1 <= len(operations) <= LIMITS["changes_per_patch"]:
        raise CandidateConversationRuntimeError("ACTION_PATCH_SHAPE_INVALID", "contract_validation")
    _string(patch.get("reason"), "ACTION_PATCH_SHAPE_INVALID", LIMITS["reason"])
    if patch.get("origin") != "MODEL_PROPOSAL":
        raise CandidateConversationRuntimeError("ACTION_PATCH_SHAPE_INVALID", "contract_validation")
    evidence_refs = patch.get("evidence_refs")
    if not isinstance(evidence_refs, list) or any(not isinstance(ref, str) or not ref.strip() for ref in evidence_refs):
        raise CandidateConversationRuntimeError("ACTION_PATCH_SHAPE_INVALID", "contract_validation")
    if any(ref not in _source_ref_ids(item) for ref in evidence_refs):
        raise CandidateConversationRuntimeError("INVALID_EVIDENCE_REF", "grounding")
    return {
        "target_item_id": target,
        "operations": [_validate_operation(operation, item) for operation in operations],
        "reason": patch["reason"].strip(),
        "origin": "MODEL_PROPOSAL",
        "evidence_refs": list(evidence_refs),
    }


def validate_candidate_action(raw_action: Any, request: CandidateConversationRequest) -> dict[str, Any]:
    action = _exact(raw_action, TOP_LEVEL_KEYS, "ACTION_TOP_LEVEL_SHAPE_INVALID")
    if action.get("contract_id") != ACTION_SCHEMA_VERSION:
        raise CandidateConversationRuntimeError("ACTION_TOP_LEVEL_SHAPE_INVALID", "contract_validation", True)
    action_type = action.get("action")
    if action_type in UNSUPPORTED_ACTIONS or action_type not in ACTIONS:
        raise CandidateConversationRuntimeError("UNSUPPORTED_ACTION", "contract_validation", True)
    if not isinstance(action.get("message"), str) or len(action["message"].strip()) > LIMITS["message"]:
        raise CandidateConversationRuntimeError("ACTION_MESSAGE_SHAPE_INVALID", "contract_validation", True)
    if not isinstance(action.get("patches"), list) or len(action["patches"]) > LIMITS["patches"]:
        raise CandidateConversationRuntimeError("ACTION_PATCH_SHAPE_INVALID", "contract_validation", True)
    clarification = action.get("clarification")
    if clarification is not None and (not isinstance(clarification, str) or not clarification.strip() or len(clarification.strip()) > LIMITS["clarification"]):
        raise CandidateConversationRuntimeError("ACTION_CLARIFICATION_SHAPE_INVALID", "contract_validation", True)
    observed = _exact(action.get("observed_working_model"), OBSERVED_KEYS, "ACTION_TOP_LEVEL_SHAPE_INVALID")
    expected_observed = {key: request.observation[key] for key in OBSERVED_KEYS}
    if dict(observed) != expected_observed:
        raise CandidateConversationRuntimeError("STALE_WORKING_OBSERVATION", "stale", True)

    item_by_id = {str(item.get("item_id")): item for item in request.working_model["payload"].get("items") or [] if isinstance(item, Mapping)}
    if request.draft is not None:
        item_by_id[request.draft["item_id"]] = request.draft["item"]
    patches = [_validate_patch(patch, item_by_id) for patch in action["patches"]]
    targets = {patch["target_item_id"] for patch in patches}
    if action_type in {"NO_CHANGE", "ASK_CLARIFICATION", "EXPLAIN"} and patches:
        raise CandidateConversationRuntimeError("ACTION_CARDINALITY_INVALID", "contract_validation", True)
    if action_type == "PATCH_ITEM" and (len(targets) != 1 or not patches):
        raise CandidateConversationRuntimeError("ACTION_CARDINALITY_INVALID", "contract_validation", True)
    if action_type == "PATCH_MULTIPLE_ITEMS" and (len(targets) < 2 or len(patches) < 2):
        raise CandidateConversationRuntimeError("ACTION_CARDINALITY_INVALID", "contract_validation", True)
    if action_type == "PATCH_MULTIPLE_ITEMS" and not _has_explicit_multi_intent(request.human_message):
        raise CandidateConversationRuntimeError("IMPLICIT_MULTI_VIOLATION", "intent", True)
    if action_type == "ASK_CLARIFICATION" and clarification is None:
        raise CandidateConversationRuntimeError("ACTION_CLARIFICATION_SHAPE_INVALID", "contract_validation", True)
    if action_type != "ASK_CLARIFICATION" and clarification is not None:
        raise CandidateConversationRuntimeError("ACTION_CLARIFICATION_SHAPE_INVALID", "contract_validation", True)
    if action_type != "ASK_CLARIFICATION" and not action["message"].strip():
        raise CandidateConversationRuntimeError("ACTION_MESSAGE_SHAPE_INVALID", "contract_validation", True)

    focus = request.observation["focus"]
    if focus["type"] == "ITEM_DRAFT" and any(target != focus["item_id"] for target in targets):
        raise CandidateConversationRuntimeError("FOCUS_VIOLATION", "focus", True)
    if focus["type"] == "ITEM" and any(target != focus["item_id"] for target in targets):
        if action_type != "PATCH_MULTIPLE_ITEMS" or not _has_explicit_multi_intent(request.human_message) or focus["item_id"] not in targets:
            raise CandidateConversationRuntimeError("FOCUS_VIOLATION", "focus", True)
    normalized = dict(action)
    normalized["patches"] = patches
    return normalized


def _semantic_object(
    value: Any,
    required: set[str],
    optional: set[str],
    aliases: Mapping[str, str],
    category: str,
    action_type: Any = None,
) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise _failure("SEMANTIC_SCHEMA_INVALID", "contract_validation", "SEMANTIC_SCHEMA", category, action_type)
    normalized: dict[str, Any] = {}
    for raw_key, raw_value in value.items():
        key = aliases.get(raw_key, raw_key)
        if key not in required | optional or key in normalized:
            raise _failure("SEMANTIC_SCHEMA_INVALID", "contract_validation", "SEMANTIC_SCHEMA", category, action_type)
        normalized[key] = raw_value
    if not required.issubset(normalized):
        raise _failure("SEMANTIC_SCHEMA_INVALID", "contract_validation", "SEMANTIC_SCHEMA", category, action_type)
    return normalized


def validate_semantic_candidate_action(raw_action: Any) -> dict[str, Any]:
    """Validate and apply only manifest-declared representation normalization."""
    top_required = set(SEMANTIC_CONTRACT["top_level_required"])
    top_optional = set(SEMANTIC_CONTRACT["top_level_optional"])
    top_aliases = SEMANTIC_CONTRACT["key_aliases"]["top_level"]
    action_hint = raw_action.get("action") if isinstance(raw_action, Mapping) else None
    action = _semantic_object(raw_action, top_required, top_optional, top_aliases, "semantic_action.top_level", action_hint)
    action_type = action.get("action")
    if action_type in UNSUPPORTED_ACTIONS or action_type not in SEMANTIC_ACTIONS:
        raise _failure("UNSUPPORTED_ACTION", "contract_validation", "SEMANTIC_GUARD", "semantic_action.action", action_type)
    action_shape = SEMANTIC_CONTRACT["action_shapes"][action_type]

    message = action.get("message", "")
    clarification = action.get("clarification", SEMANTIC_CONTRACT["defaults"]["clarification"])
    patches_value = action.get("patches", SEMANTIC_CONTRACT["defaults"]["patches"])
    no_change_basis_value = action.get("no_change_basis")
    if isinstance(patches_value, Mapping) and SEMANTIC_CONTRACT["allow_single_patch_object"]:
        patches_value = [patches_value]
    if not isinstance(message, str) or len(message.strip()) > LIMITS["message"]:
        raise _failure("ACTION_MESSAGE_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.message", action_type)
    if action_shape["message"] == "REQUIRED_NONEMPTY_STRING" and not message.strip():
        raise _failure("ACTION_MESSAGE_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.message", action_type)
    if clarification is not None and (not isinstance(clarification, str) or not clarification.strip() or len(clarification.strip()) > LIMITS["clarification"]):
        raise _failure("ACTION_CLARIFICATION_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.clarification", action_type)
    if not isinstance(patches_value, list) or len(patches_value) > LIMITS["patches"]:
        raise _failure("ACTION_PATCH_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.patches", action_type)

    no_change_basis = None
    if action_shape["no_change_basis"] == "REQUIRED_CURRENT_VALUE_ASSERTION":
        no_change_basis = _semantic_object(
            no_change_basis_value,
            set(SEMANTIC_CONTRACT["no_change_basis_required"]),
            set(SEMANTIC_CONTRACT["no_change_basis_optional"]),
            {},
            "semantic_action.no_change_basis",
            action_type,
        )
        target = _string(no_change_basis.get("target_item_id"), "INVALID_TARGET", LIMITS["identifier"])
        concept_value = no_change_basis.get("concept")
        if not isinstance(concept_value, str) or not concept_value.strip():
            raise _failure("NO_CHANGE_BASIS_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.no_change_basis.concept", action_type)
        concept = SEMANTIC_CONTRACT["concept_aliases"].get(concept_value.strip(), concept_value.strip())
        if concept not in SEMANTIC_CONCEPTS:
            raise _failure("UNKNOWN_CONCEPT", "contract_validation", "RESOLUTION", "semantic_action.no_change_basis.concept", action_type)
        no_change_basis = {"target_item_id": target, "concept": concept, "value": _string(no_change_basis.get("value"), "NO_CHANGE_BASIS_SHAPE_INVALID", LIMITS["message"])}
    elif no_change_basis_value is not None or "no_change_basis" in action:
        raise _failure("NO_CHANGE_BASIS_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.no_change_basis", action_type)

    patch_required = set(SEMANTIC_CONTRACT["patch_required"])
    patch_optional = set(SEMANTIC_CONTRACT["patch_optional"])
    patch_aliases = SEMANTIC_CONTRACT["key_aliases"]["patch"]
    change_required = set(SEMANTIC_CONTRACT["change_required"])
    change_optional = set(SEMANTIC_CONTRACT["change_optional"])
    change_aliases = SEMANTIC_CONTRACT["key_aliases"]["change"]
    patches: list[dict[str, Any]] = []
    for patch_value in patches_value:
        semantic_patch = _semantic_object(patch_value, patch_required, patch_optional, patch_aliases, "semantic_action.patch", action_type)
        target = semantic_patch.get("target_item_id")
        if target is not None:
            semantic_patch["target_item_id"] = _string(target, "INVALID_TARGET", LIMITS["identifier"])
        changes_value = semantic_patch.get("changes")
        if not isinstance(changes_value, list) or not 1 <= len(changes_value) <= LIMITS["changes_per_patch"]:
            raise _failure("ACTION_PATCH_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.patch.changes", action_type)
        changes: list[dict[str, Any]] = []
        for change_value in changes_value:
            change = _semantic_object(change_value, change_required, change_optional, change_aliases, "semantic_action.change", action_type)
            intent = change.get("intent")
            concept_value = change.get("concept")
            if intent not in SEMANTIC_INTENTS:
                raise _failure("UNSUPPORTED_MUTATION", "contract_validation", "SEMANTIC_GUARD", "semantic_action.change.intent", action_type)
            if not isinstance(concept_value, str) or not concept_value.strip():
                raise _failure("SEMANTIC_SCHEMA_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.change.concept", action_type)
            concept = SEMANTIC_CONTRACT["concept_aliases"].get(concept_value.strip(), concept_value.strip())
            if concept not in SEMANTIC_CONCEPTS:
                raise _failure("UNKNOWN_CONCEPT", "contract_validation", "RESOLUTION", "semantic_action.change.concept", action_type)
            normalized_change: dict[str, Any] = {"intent": intent, "concept": concept}
            if intent == "SET":
                normalized_change["value"] = _string(change.get("value"), "SEMANTIC_SCHEMA_INVALID", LIMITS["message"])
                if "reference_id" in change:
                    raise _failure("SEMANTIC_SCHEMA_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.change.reference_id", action_type)
            elif intent == "CLEAR":
                if "value" in change or "reference_id" in change:
                    raise _failure("SEMANTIC_SCHEMA_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.change.clear", action_type)
            else:
                normalized_change["value"] = _string(change.get("value"), "SEMANTIC_SCHEMA_INVALID", 64)
                normalized_change["reference_id"] = _string(change.get("reference_id"), "INVALID_OPERATION_TARGET", LIMITS["identifier"])
            changes.append(normalized_change)
        semantic_patch["changes"] = changes
        patches.append(semantic_patch)

    patch_shape = action_shape["patches"]
    if not patch_shape["minimum"] <= len(patches) <= patch_shape["maximum"]:
        raise _failure("ACTION_CARDINALITY_INVALID", "contract_validation", "SEMANTIC_GUARD", "semantic_action.cardinality", action_type)
    if action_type == "ASK_CLARIFICATION" and clarification is None:
        raise _failure("ACTION_CLARIFICATION_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.clarification", action_type)
    if action_type != "ASK_CLARIFICATION" and clarification is not None:
        raise _failure("ACTION_CLARIFICATION_SHAPE_INVALID", "contract_validation", "SEMANTIC_SCHEMA", "semantic_action.clarification", action_type)
    return {
        "action": action_type,
        "message": message.strip(),
        "patches": patches,
        "clarification": clarification.strip() if isinstance(clarification, str) else None,
        "no_change_basis": no_change_basis,
    }


_AUTHORITY_ESCALATION = re.compile(
    r"(?:已保存到个人资料|已确认|已写入正式资料|confirmed\s+profile|saved\s+to\s+(?:the\s+)?profile)",
    re.IGNORECASE,
)


def _canonical_clarification(request: CandidateConversationRequest, copy: str) -> dict[str, Any]:
    return validate_candidate_action({
        "contract_id": ACTION_SCHEMA_VERSION,
        "action": "ASK_CLARIFICATION",
        "message": "",
        "observed_working_model": {key: request.observation[key] for key in OBSERVED_KEYS},
        "patches": [],
        "clarification": copy,
    }, request)


def _matching_concept_mappings(item: Mapping[str, Any], concept: str) -> list[Mapping[str, Any]]:
    item_type = str(item.get("item_type") or "")
    item_subtype = str(item.get("item_subtype") or "")
    matches = []
    for mapping in CONTRACT_MANIFEST["concept_mappings"]:
        if mapping.get("concept") != concept:
            continue
        item_types = mapping.get("item_types") or []
        item_subtypes = mapping.get("item_subtypes") or []
        if "*" not in item_types and item_type not in item_types:
            continue
        if item_subtypes and item_subtype not in item_subtypes:
            continue
        matches.append(mapping)
    return matches


def _resolve_semantic_change(change: Mapping[str, Any], item: Mapping[str, Any], action_type: str) -> dict[str, Any] | None:
    mappings = _matching_concept_mappings(item, str(change["concept"]))
    if not mappings:
        raise _failure("CONCEPT_MAPPING_NOT_FOUND", "contract_validation", "RESOLUTION", "semantic_action.change.concept", action_type)
    if len(mappings) != 1:
        return None
    mapping = mappings[0]
    intent = change["intent"]
    if intent not in mapping["allowed_intents"]:
        raise _failure("UNSUPPORTED_MUTATION", "contract_validation", "SEMANTIC_GUARD", "semantic_action.change.intent", action_type)
    destination = mapping["destination"]
    if destination["kind"] == "ITEM_FIELD":
        field = destination["field"]
        if intent == "SET":
            return {"operation": "SET_ITEM_FIELD", "field": field, "value": change["value"]}
        if field not in CLEARABLE_ITEM_FIELDS:
            raise _failure("UNSUPPORTED_MUTATION", "contract_validation", "SEMANTIC_GUARD", "semantic_action.change.intent", action_type)
        return {"operation": "CLEAR_ITEM_FIELD", "field": field}
    if destination["kind"] == "FACT_BY_LABEL":
        labels = {str(label).strip().casefold() for label in destination["labels"]}
        facts = [fact for fact in item.get("facts") or [] if isinstance(fact, Mapping) and str(fact.get("label") or "").strip().casefold() in labels]
        if not facts:
            raise _failure("CONCEPT_MAPPING_NOT_FOUND", "contract_validation", "RESOLUTION", "semantic_action.change.concept", action_type)
        if len(facts) != 1:
            return None
        fact_id = facts[0].get("fact_id")
        if not isinstance(fact_id, str) or not fact_id.strip():
            raise _failure("INVALID_OPERATION_TARGET", "contract_validation", "SEMANTIC_GUARD", "semantic_action.change.reference", action_type)
        return {"operation": "SET_FACT_VALUE", "fact_id": fact_id, "value": change["value"]}
    reference_id = change.get("reference_id")
    if change.get("value") not in UNCERTAINTY_STATUSES:
        raise _failure("INVALID_UNCERTAINTY_STATUS", "contract_validation", "SEMANTIC_GUARD", "semantic_action.change.value", action_type)
    if reference_id not in {entry.get("uncertainty_id") for entry in item.get("uncertainties") or [] if isinstance(entry, Mapping)}:
        raise _failure("INVALID_OPERATION_TARGET", "contract_validation", "SEMANTIC_GUARD", "semantic_action.change.reference", action_type)
    return {"operation": "SET_UNCERTAINTY_STATUS", "uncertainty_id": reference_id, "status": change["value"]}


def _assert_no_change_basis(basis: Mapping[str, Any], item_by_id: Mapping[str, Mapping[str, Any]], request: CandidateConversationRequest) -> None:
    target = basis["target_item_id"]
    item = item_by_id.get(target)
    if item is None:
        raise _failure("INVALID_TARGET", "contract_validation", "SEMANTIC_GUARD", "semantic_action.no_change_basis.target", "NO_CHANGE")
    focus = request.observation["focus"]
    if focus["type"] in {"ITEM", "ITEM_DRAFT"} and target != focus["item_id"]:
        raise _failure("FOCUS_VIOLATION", "focus", "SEMANTIC_GUARD", "semantic_action.no_change_basis.target", "NO_CHANGE")
    operation = _resolve_semantic_change({"intent": "SET", "concept": basis["concept"], "value": basis["value"]}, item, "NO_CHANGE")
    if operation is None:
        raise _failure("NO_CHANGE_BASIS_UNRESOLVED", "contract_validation", "SEMANTIC_GUARD", "semantic_action.no_change_basis", "NO_CHANGE")
    if operation["operation"] == "SET_ITEM_FIELD":
        current_value = item.get(operation["field"])
        expected_value = operation["value"]
    elif operation["operation"] == "SET_FACT_VALUE":
        current_value = next((fact.get("value") for fact in item.get("facts") or [] if isinstance(fact, Mapping) and fact.get("fact_id") == operation["fact_id"]), None)
        expected_value = operation["value"]
    else:
        current_value = next((entry.get("status") for entry in item.get("uncertainties") or [] if isinstance(entry, Mapping) and entry.get("uncertainty_id") == operation["uncertainty_id"]), None)
        expected_value = operation["status"]
    if not isinstance(current_value, str) or current_value.strip() != str(expected_value).strip():
        raise _failure("NO_CHANGE_STATE_MISMATCH", "contract_validation", "SEMANTIC_GUARD", "semantic_action.no_change_basis", "NO_CHANGE")


def resolve_semantic_candidate_action(raw_action: Any, request: CandidateConversationRequest) -> dict[str, Any]:
    semantic = validate_semantic_candidate_action(raw_action)
    action_type = semantic["action"]
    user_copy = semantic["clarification"] if action_type == "ASK_CLARIFICATION" else semantic["message"]
    if _AUTHORITY_ESCALATION.search(user_copy or ""):
        raise _failure("AUTHORITY_COPY_INVALID", "authority", "AUTHORITY", "semantic_action.user_copy", action_type)
    if action_type == "PATCH_MULTIPLE_ITEMS" and not _has_explicit_multi_intent(request.human_message):
        raise _failure("IMPLICIT_MULTI_VIOLATION", "intent", "SEMANTIC_GUARD", "semantic_action.cardinality", action_type)

    item_by_id = {str(item.get("item_id")): item for item in request.working_model["payload"].get("items") or [] if isinstance(item, Mapping)}
    if request.draft is not None:
        item_by_id[request.draft["item_id"]] = request.draft["item"]
    if action_type == "NO_CHANGE":
        _assert_no_change_basis(semantic["no_change_basis"], item_by_id, request)
    canonical_patches: list[dict[str, Any]] = []
    for semantic_patch in semantic["patches"]:
        target = semantic_patch.get("target_item_id")
        if target is None:
            focus = request.observation["focus"]
            if focus["type"] in {"ITEM", "ITEM_DRAFT"}:
                target = focus["item_id"]
            elif len(item_by_id) == 1:
                target = next(iter(item_by_id))
            else:
                return _canonical_clarification(request, "请明确要修改哪一张 Candidate Card。")
        item = item_by_id.get(target)
        if item is None:
            raise _failure("INVALID_TARGET", "contract_validation", "SEMANTIC_GUARD", "semantic_action.patch.target", action_type)
        operations: list[dict[str, Any]] = []
        for change in semantic_patch["changes"]:
            operation = _resolve_semantic_change(change, item, action_type)
            if operation is None:
                return _canonical_clarification(request, "请确认这项信息应更新到哪个现有字段。")
            operations.append(operation)
        canonical_patches.append({
            "target_item_id": target,
            "operations": operations,
            "reason": "Resolved from a bounded semantic candidate action.",
            "origin": "MODEL_PROPOSAL",
            "evidence_refs": [],
        })

    canonical = {
        "contract_id": ACTION_SCHEMA_VERSION,
        "action": action_type,
        "message": semantic["message"],
        "observed_working_model": {key: request.observation[key] for key in OBSERVED_KEYS},
        "patches": canonical_patches,
        "clarification": semantic["clarification"],
    }
    return validate_candidate_action(canonical, request)


def semantic_prompt_schema_fragment() -> str:
    fragment = {
        "schema_version": SEMANTIC_ACTION_SCHEMA_VERSION,
        "actions": CONTRACT_MANIFEST["actions"],
        "unsupported_actions": CONTRACT_MANIFEST["unsupported_actions"],
        "shape": CONTRACT_MANIFEST["semantic_contract"],
        "concepts": CONTRACT_MANIFEST["semantic_contract"]["concepts"],
        "concept_aliases": CONTRACT_MANIFEST["semantic_contract"]["concept_aliases"],
    }
    return json.dumps(fragment, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def candidate_conversation_prompt() -> str:
    """Semantic model-facing contract; storage bindings remain local."""
    return f"""You are Ariadne's Candidate conversation semantic action planner.
Return exactly one JSON object and no Markdown or reasoning.
Follow this versioned semantic schema exactly: {semantic_prompt_schema_fragment()}
Use only exact item_id values present in the input when a target is clear. Never guess a Card by nearest name. If no unique target is clear, return ASK_CLARIFICATION.
Express changes only as semantic intent + concept + desired value. Do not output storage fields, fact IDs, contract IDs, Working observation echoes, origin, authority, provenance, or evidence_refs.
Use PATCH_MULTIPLE_ITEMS only when the literal human message explicitly requests all/every/both/multiple items. Otherwise ambiguity must return ASK_CLARIFICATION.
The final USER message is the current turn intent and overrides history. History only supplies context; it never proves that the current request was already applied.
Compare that final USER message against the current value in the supplied Candidate Working item. If a clear requested desired value differs from that current value, return PATCH_ITEM or ASK_CLARIFICATION, never NO_CHANGE.
NO_CHANGE is allowed only when a current value already satisfies the final USER request. Its required no_change_basis must name the exact target_item_id, manifest concept, and current value that proves this. Do not use NO_CHANGE when that proof is unavailable.
Never create, remove, merge, or delete items. Never invent IDs. Explain-only requests return EXPLAIN; already-satisfied requests return NO_CHANGE.
System-owned fields and canonical typed mutations are bound and validated locally."""


def _model_input(request: CandidateConversationRequest) -> dict[str, Any]:
    items = []
    for item in request.working_model["payload"].get("items") or []:
        if not isinstance(item, Mapping):
            continue
        items.append({
            key: item.get(key)
            for key in ("item_id", "item_type", "item_subtype", "title", "subtitle", "time", "summary", "facts", "ownership", "uncertainties")
        })
    if request.draft is not None:
        draft_id = request.draft["item_id"]
        items = [item for item in items if item.get("item_id") != draft_id]
        items.append({key: request.draft["item"].get(key) for key in ("item_id", "item_type", "item_subtype", "title", "subtitle", "time", "summary", "facts", "ownership", "uncertainties")})
    return {
        "conversation": {"subject_type": SUBJECT_TYPE, "subject_id": request.conversation["subject_id"]},
        "observed_working_model": {key: request.observation[key] for key in OBSERVED_KEYS},
        "focus": request.observation["focus"],
        "candidate_working_items": items,
        "human_message": request.human_message,
    }


def build_candidate_conversation_payload(request: CandidateConversationRequest) -> dict[str, Any]:
    if request.compiled_context is None:
        messages = [
            {"role": "system", "content": candidate_conversation_prompt()},
            {"role": "user", "content": json.dumps(_model_input(request), ensure_ascii=False, separators=(",", ":"))},
        ]
    else:
        context_only = {key: value for key, value in request.compiled_context.items() if key not in {"bounded_history", "current_user_message"}}
        messages = [
            {"role": "system", "content": candidate_conversation_prompt()},
            {"role": "user", "content": json.dumps({"message_type": "COMPILED_CANDIDATE_CONTEXT", "context": context_only}, ensure_ascii=False, separators=(",", ":"))},
        ]
        for turn in request.compiled_context["bounded_history"]:
            messages.append({"role": "user", "content": str(turn["user"]["text"])})
            messages.append({"role": "assistant", "content": str(turn["assistant"]["text"])})
        messages.append({"role": "user", "content": request.human_message})
    return {
        "model": MODEL_ID,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "temperature": 0,
        "max_tokens": 1400,
    }


def response_diagnostics(provider_response: Any, http_status: int | None = None) -> dict[str, Any]:
    diagnostics: dict[str, Any] = {"http_status": http_status, "response_type": type(provider_response).__name__}
    if not isinstance(provider_response, Mapping):
        return diagnostics
    diagnostics["returned_model"] = provider_response.get("model") if isinstance(provider_response.get("model"), str) else None
    choices = provider_response.get("choices")
    diagnostics["choices_count"] = len(choices) if isinstance(choices, list) else None
    if isinstance(choices, list) and choices and isinstance(choices[0], Mapping):
        diagnostics["finish_reason"] = choices[0].get("finish_reason")
        message = choices[0].get("message")
        content = message.get("content") if isinstance(message, Mapping) else None
        diagnostics["content_length"] = len(content) if isinstance(content, str) else None
    usage = provider_response.get("usage")
    if isinstance(usage, Mapping):
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            if isinstance(usage.get(key), int):
                diagnostics[key] = usage[key]
    return diagnostics


def normalize_candidate_conversation_response(provider_response: Any, request: CandidateConversationRequest, http_status: int = 200) -> tuple[dict[str, Any], dict[str, Any]]:
    diagnostics = response_diagnostics(provider_response, http_status)
    if http_status != 200:
        raise CandidateConversationRuntimeError("PROVIDER_HTTP_ERROR", "provider", True, {**diagnostics, **_diagnostic("PROVIDER_ENVELOPE", "PROVIDER_HTTP_ERROR")})
    if not isinstance(provider_response, Mapping):
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "parsing", True, {**diagnostics, **_diagnostic("PROVIDER_ENVELOPE", "MALFORMED_RESPONSE")})
    if provider_response.get("model") != MODEL_ID:
        raise CandidateConversationRuntimeError("WRONG_RETURNED_MODEL", "model", True, {**diagnostics, **_diagnostic("MODEL_IDENTITY", "WRONG_RETURNED_MODEL")})
    choices = provider_response.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], Mapping):
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "parsing", True, {**diagnostics, **_diagnostic("PROVIDER_ENVELOPE", "MALFORMED_RESPONSE")})
    if choices[0].get("finish_reason") == "length":
        raise CandidateConversationRuntimeError("TRUNCATED_OUTPUT", "model_output", True, {**diagnostics, **_diagnostic("FINISH_REASON", "TRUNCATED_OUTPUT")})
    if choices[0].get("finish_reason") != "stop":
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "model_output", True, {**diagnostics, **_diagnostic("FINISH_REASON", "MALFORMED_RESPONSE")})
    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, Mapping) else None
    if not isinstance(content, str) or not content.strip():
        raise CandidateConversationRuntimeError("EMPTY_RESPONSE", "parsing", True, {**diagnostics, **_diagnostic("JSON_PARSE", "EMPTY_RESPONSE")})
    try:
        raw_action = json.loads(content)
    except json.JSONDecodeError as error:
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "parsing", True, {**diagnostics, **_diagnostic("JSON_PARSE", "MALFORMED_RESPONSE")}) from error
    try:
        action = resolve_semantic_candidate_action(raw_action, request)
    except CandidateConversationRuntimeError as error:
        error_diagnostics = error.diagnostics
        if not error_diagnostics:
            stage = "STALE" if error.code == "STALE_WORKING_OBSERVATION" else "CANONICAL_SCHEMA" if error.code.startswith("ACTION_") else "SEMANTIC_GUARD"
            error_diagnostics = _diagnostic(stage, error.code)
        raise CandidateConversationRuntimeError(error.code, error.failure_layer, True, {**diagnostics, **error_diagnostics}) from error
    usage = provider_response.get("usage") if isinstance(provider_response.get("usage"), Mapping) else {}
    return action, dict(usage)


def execute_candidate_conversation_request(
    payload: Any,
    credential_reader: Callable[[], str | None],
    provider_call: Callable[[str, dict[str, Any]], tuple[int, dict[str, Any]]],
) -> dict[str, Any]:
    request = validate_candidate_conversation_request(payload)
    try:
        credential = resolve_credential_reference(
            request.runtime_snapshot["credential_ref"], CREDENTIAL_REF, credential_reader,
            invalid_code="CREDENTIAL_REFERENCE_INVALID", missing_code="deepseek_key_not_configured",
        )
    except ProviderRuntimeError as error:
        raise CandidateConversationRuntimeError(error.code, error.failure_layer) from error
    provider_payload = build_candidate_conversation_payload(request)
    http_status, provider_response = provider_call(credential, provider_payload)
    action, usage = normalize_candidate_conversation_response(provider_response, request, http_status)
    return {
        "contract_id": f"{CONTRACT_ID}-runtime-result-v1",
        "execution_id": request.execution_id,
        "generation": request.generation,
        "conversation_id": request.conversation["conversation_id"],
        "operation": OPERATION,
        "provider": PROVIDER_ID,
        "model": MODEL_ID,
        "protocol": PROTOCOL,
        "runtime_snapshot_id": request.runtime_snapshot["snapshot_id"],
        "finish_reason": "stop",
        "usage": usage,
        "action": action,
        "authority": "NON_AUTHORITATIVE_WORKING_ACTION",
        "network_call_made": True,
        "persistence": "not_written",
    }
