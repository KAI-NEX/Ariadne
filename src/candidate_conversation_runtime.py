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
PROMPT_VERSION = "candidate-conversation-prompt-v1"
ACTION_SCHEMA_VERSION = "ariadne-candidate-conversation-action-v1"
REQUEST_CONFIG_VERSION = "deepseek-candidate-conversation-request-v1"
CAPABILITY_BASIS = "adapter_verified"
CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision"
OPERATION = "CANDIDATE_CONVERSATION_TURN"
CONTRACT_ID = "ariadne-candidate-conversation-v1"
SUBJECT_TYPE = "CANDIDATE"

ACTIONS = {"NO_CHANGE", "PATCH_ITEM", "PATCH_MULTIPLE_ITEMS", "ASK_CLARIFICATION", "EXPLAIN"}
UNSUPPORTED_ACTIONS = {"CREATE_ITEM", "REMOVE_ITEM", "MERGE_ITEMS"}
OPERATIONS = {"SET_ITEM_FIELD", "CLEAR_ITEM_FIELD", "SET_FACT_VALUE", "SET_UNCERTAINTY_STATUS"}
ITEM_FIELDS = {"title", "subtitle", "time", "summary", "ownership"}
CLEARABLE_ITEM_FIELDS = {"subtitle", "time", "ownership"}
UNCERTAINTY_STATUSES = {"OPEN", "RESOLVED", "DISMISSED"}
TOP_LEVEL_KEYS = {"contract_id", "action", "message", "observed_working_model", "patches", "clarification"}
OBSERVED_KEYS = {"candidate_context_id", "working_model_id", "version", "fingerprint"}
PATCH_KEYS = {"target_item_id", "operations", "reason", "origin", "evidence_refs"}
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


@dataclass(frozen=True)
class CandidateConversationRequest:
    conversation: dict[str, Any]
    human_message: str
    observation: dict[str, Any]
    working_model: dict[str, Any]
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


def validate_candidate_conversation_request(payload: Any) -> CandidateConversationRequest:
    request = _exact(payload, {"contract_id", "conversation", "human_message", "observation", "working_model", "runtime_snapshot", "draft", "turn"})
    if request.get("contract_id") != f"{CONTRACT_ID}-runtime-request-v1":
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
    conversation = _validate_conversation(request.get("conversation"))
    human_message = _string(request.get("human_message"), "HUMAN_MESSAGE_INVALID")
    try:
        working_model = validate_candidate_working_model(request.get("working_model"))
    except TruthPersistenceError as error:
        raise CandidateConversationRuntimeError("WORKING_MODEL_INVALID", "contract_validation") from error
    if working_model["fingerprint"] != _fingerprint(working_model["payload"]):
        raise CandidateConversationRuntimeError("WORKING_MODEL_INVALID", "contract_validation")
    observation = _validate_observation(request.get("observation"), working_model, conversation)
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
    return CandidateConversationRequest(conversation, human_message, observation, working_model, snapshot, draft, execution_id, generation)


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
        _exact(operation, {"operation", "field", "value"})
        if operation.get("field") not in ITEM_FIELDS:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
        _string(operation.get("value"))
    elif operation_type == "CLEAR_ITEM_FIELD":
        _exact(operation, {"operation", "field"})
        if operation.get("field") not in CLEARABLE_ITEM_FIELDS:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
    elif operation_type == "SET_FACT_VALUE":
        _exact(operation, {"operation", "fact_id", "value"})
        _string(operation.get("value"))
        if operation.get("fact_id") not in {fact.get("fact_id") for fact in item.get("facts") or [] if isinstance(fact, Mapping)}:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
    else:
        _exact(operation, {"operation", "uncertainty_id", "status"})
        if operation.get("status") not in UNCERTAINTY_STATUSES:
            raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
        if operation.get("uncertainty_id") not in {entry.get("uncertainty_id") for entry in item.get("uncertainties") or [] if isinstance(entry, Mapping)}:
            raise CandidateConversationRuntimeError("INVALID_OPERATION_TARGET", "contract_validation")
    return dict(operation)


def _validate_patch(value: Any, item_by_id: dict[str, Mapping[str, Any]]) -> dict[str, Any]:
    patch = _exact(value, PATCH_KEYS)
    target = _string(patch.get("target_item_id"), "INVALID_TARGET", 256)
    item = item_by_id.get(target)
    if item is None:
        raise CandidateConversationRuntimeError("INVALID_TARGET", "contract_validation")
    operations = patch.get("operations")
    if not isinstance(operations, list) or not 1 <= len(operations) <= 32:
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
    _string(patch.get("reason"), maximum=2000)
    if patch.get("origin") != "MODEL_PROPOSAL":
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
    evidence_refs = patch.get("evidence_refs")
    if not isinstance(evidence_refs, list) or any(not isinstance(ref, str) or not ref.strip() for ref in evidence_refs):
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation")
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
    action = _exact(raw_action, TOP_LEVEL_KEYS)
    if action.get("contract_id") != ACTION_SCHEMA_VERSION:
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    action_type = action.get("action")
    if action_type in UNSUPPORTED_ACTIONS or action_type not in ACTIONS:
        raise CandidateConversationRuntimeError("UNSUPPORTED_ACTION", "contract_validation", True)
    if not isinstance(action.get("message"), str) or not isinstance(action.get("patches"), list):
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    clarification = action.get("clarification")
    if clarification is not None and (not isinstance(clarification, str) or not clarification.strip()):
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    observed = _exact(action.get("observed_working_model"), OBSERVED_KEYS)
    expected_observed = {key: request.observation[key] for key in OBSERVED_KEYS}
    if dict(observed) != expected_observed:
        raise CandidateConversationRuntimeError("STALE_WORKING_OBSERVATION", "stale", True)

    item_by_id = {str(item.get("item_id")): item for item in request.working_model["payload"].get("items") or [] if isinstance(item, Mapping)}
    if request.draft is not None:
        item_by_id[request.draft["item_id"]] = request.draft["item"]
    patches = [_validate_patch(patch, item_by_id) for patch in action["patches"]]
    targets = {patch["target_item_id"] for patch in patches}
    if action_type in {"NO_CHANGE", "ASK_CLARIFICATION", "EXPLAIN"} and patches:
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    if action_type == "PATCH_ITEM" and (len(targets) != 1 or not patches):
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    if action_type == "PATCH_MULTIPLE_ITEMS" and (len(targets) < 2 or len(patches) < 2):
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    if action_type == "PATCH_MULTIPLE_ITEMS" and not _has_explicit_multi_intent(request.human_message):
        raise CandidateConversationRuntimeError("IMPLICIT_MULTI_VIOLATION", "intent", True)
    if action_type == "ASK_CLARIFICATION" and clarification is None:
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    if action_type != "ASK_CLARIFICATION" and clarification is not None:
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)
    if action_type != "ASK_CLARIFICATION" and not action["message"].strip():
        raise CandidateConversationRuntimeError("EXACT_SCHEMA_FAILURE", "contract_validation", True)

    focus = request.observation["focus"]
    if focus["type"] == "ITEM_DRAFT" and any(target != focus["item_id"] for target in targets):
        raise CandidateConversationRuntimeError("FOCUS_VIOLATION", "focus", True)
    if focus["type"] == "ITEM" and any(target != focus["item_id"] for target in targets):
        if action_type != "PATCH_MULTIPLE_ITEMS" or not _has_explicit_multi_intent(request.human_message) or focus["item_id"] not in targets:
            raise CandidateConversationRuntimeError("FOCUS_VIOLATION", "focus", True)
    normalized = dict(action)
    normalized["patches"] = patches
    return normalized


def candidate_conversation_prompt() -> str:
    """Frozen prompt guard paired with the local validator."""
    return f"""You are Ariadne's Candidate Working Model conversation action planner.
Return exactly one JSON object and no Markdown or reasoning. The action contract_id is {ACTION_SCHEMA_VERSION}.
Allowed actions only: NO_CHANGE, PATCH_ITEM, PATCH_MULTIPLE_ITEMS, ASK_CLARIFICATION, EXPLAIN.
Never create, remove, or merge items. Never invent an item, fact, uncertainty, or evidence ID.
Use PATCH_MULTIPLE_ITEMS only when the literal human message explicitly requests all/every/both/multiple items. If more than one target is plausible without explicit multi intent, return ASK_CLARIFICATION.
ITEM focus normally permits only its active item. ITEM_DRAFT permits only that draft item.
Patches are non-authoritative proposals. origin must be MODEL_PROPOSAL. evidence_refs may be empty and otherwise must use only IDs present in the input.
Use only typed operations:
- {{"operation":"SET_ITEM_FIELD","field":"title|subtitle|time|summary|ownership","value":"non-empty string"}}
- {{"operation":"CLEAR_ITEM_FIELD","field":"subtitle|time|ownership"}}
- {{"operation":"SET_FACT_VALUE","fact_id":"existing fact_id","value":"non-empty string"}}
- {{"operation":"SET_UNCERTAINTY_STATUS","uncertainty_id":"existing uncertainty_id","status":"OPEN|RESOLVED|DISMISSED"}}
Return exactly these top-level keys: contract_id, action, message, observed_working_model, patches, clarification.
Each patch has exactly: target_item_id, operations, reason, origin, evidence_refs.
NO_CHANGE, EXPLAIN, and ASK_CLARIFICATION have patches=[]. Every action except ASK_CLARIFICATION requires a non-empty user-facing message. ASK_CLARIFICATION requires clarification. All other clarification values are null."""


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
    return {
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": candidate_conversation_prompt()},
            {"role": "user", "content": json.dumps(_model_input(request), ensure_ascii=False, separators=(",", ":"))},
        ],
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
        raise CandidateConversationRuntimeError("PROVIDER_HTTP_ERROR", "provider", True, diagnostics)
    if not isinstance(provider_response, Mapping):
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "parsing", True, diagnostics)
    if provider_response.get("model") != MODEL_ID:
        raise CandidateConversationRuntimeError("WRONG_RETURNED_MODEL", "model", True, diagnostics)
    choices = provider_response.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], Mapping):
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "parsing", True, diagnostics)
    if choices[0].get("finish_reason") == "length":
        raise CandidateConversationRuntimeError("TRUNCATED_OUTPUT", "model_output", True, diagnostics)
    if choices[0].get("finish_reason") != "stop":
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "model_output", True, diagnostics)
    message = choices[0].get("message")
    content = message.get("content") if isinstance(message, Mapping) else None
    if not isinstance(content, str) or not content.strip():
        raise CandidateConversationRuntimeError("EMPTY_RESPONSE", "parsing", True, diagnostics)
    try:
        raw_action = json.loads(content)
    except json.JSONDecodeError as error:
        raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "parsing", True, diagnostics) from error
    try:
        action = validate_candidate_action(raw_action, request)
    except CandidateConversationRuntimeError as error:
        raise CandidateConversationRuntimeError(error.code, error.failure_layer, True, diagnostics) from error
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
