"""Offline contract/runtime regressions for Candidate Conversation V1."""

from __future__ import annotations

import json
import hashlib
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.candidate_conversation_runtime import (  # noqa: E402
    ACTION_SCHEMA_VERSION,
    CONTRACT_MANIFEST,
    SEMANTIC_ACTION_SCHEMA_VERSION,
    ADAPTER_VERSION,
    CAPABILITY_BASIS,
    CONTRACT_ID,
    CREDENTIAL_REF,
    MODEL_ID,
    OPERATION,
    PROMPT_VERSION,
    REQUEST_CONFIG_VERSION,
    CandidateConversationExecutionRegistry,
    CandidateConversationRuntimeError,
    build_candidate_conversation_payload,
    execute_candidate_conversation_request,
    normalize_candidate_conversation_response,
    resolve_semantic_candidate_action,
    semantic_prompt_schema_fragment,
    validate_candidate_action,
    validate_candidate_conversation_request,
    validate_semantic_candidate_action,
)
from src.execution_contract import create_runtime_snapshot  # noqa: E402
from src.provider_runtime import deepseek_model_descriptors  # noqa: E402


CONTEXT_ID = "synthetic-candidate-context"
WORKING_MODEL = {
    "contract_id": "ariadne-candidate-working-model-v1",
    "working_model_id": "synthetic-working-model-v3",
    "source_document_id": "source-candidate-synthetic",
    "processing_run_id": "run-synthetic",
    "runtime_snapshot_id": "runtime-snapshot-synthetic-source",
    "proposal_ids": ["proposal-synthetic"],
    "version": 3,
    "previous_working_model_id": "synthetic-working-model-v2",
    "fingerprint": "sha256:" + "0" * 64,
    "created_at": "2026-09-03T07:00:00Z",
    "payload": {
        "contract_id": "ariadne-candidate-working-payload-v1",
        "material_type": "resume",
        "items": [
            {
                "item_id": "item-edu-001", "item_type": "EDUCATION", "item_subtype": "education",
                "title": "Royal College of Art RCA", "subtitle": "Synthetic programme", "time": "2024",
                "summary": "Synthetic education item.",
                "facts": [{"fact_id": "fact-degree-001", "label": "Degree", "value": "Synthetic degree"}],
                "ownership": None,
                "grounding_refs": [{"grounding_ref_id": "ground-edu-001", "source_document_id": "synthetic-source", "location": "synthetic:1", "excerpt_or_reference": "Synthetic only"}],
                "uncertainties": [{"uncertainty_id": "uncertain-edu-001", "question": "Synthetic question", "affects": "fact", "status": "OPEN"}],
                "review_status": "NEEDS_REVIEW", "item_version": 1, "content_origin": "MODEL_PROPOSAL",
            },
            {
                "item_id": "item-edu-002", "item_type": "EDUCATION", "item_subtype": "education",
                "title": "Service Design Exchange — RCA", "subtitle": "Synthetic programme", "time": "2025",
                "summary": "Second synthetic education item.",
                "facts": [{"fact_id": "fact-degree-002", "label": "Course", "value": "Synthetic course"}],
                "ownership": None,
                "grounding_refs": [], "uncertainties": [], "review_status": "NEEDS_REVIEW",
                "item_version": 1, "content_origin": "MODEL_PROPOSAL",
            },
        ],
    },
    "authority": "NON_AUTHORITATIVE_WORKING_MODEL",
}
FINGERPRINT = "sha256:" + hashlib.sha256(json.dumps(WORKING_MODEL["payload"], ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()
WORKING_MODEL["fingerprint"] = FINGERPRINT

DESCRIPTOR = deepseek_model_descriptors([MODEL_ID])[0]
SNAPSHOT = create_runtime_snapshot(
    {"mode": "model", "provider": "deepseek", "model": MODEL_ID},
    model_descriptor=DESCRIPTOR,
    snapshot_id="runtime-snapshot-candidate-conversation",
    captured_at="2026-09-03T07:01:00Z",
    credential_ref=CREDENTIAL_REF,
    adapter_version=ADAPTER_VERSION,
    prompt_version=PROMPT_VERSION,
    schema_version=ACTION_SCHEMA_VERSION,
    operation=OPERATION,
    capability_basis=CAPABILITY_BASIS,
    action_schema_version=ACTION_SCHEMA_VERSION,
    request_config_version=REQUEST_CONFIG_VERSION,
    delivery_method=None,
)


def request_for(message: str = "请解释这一项。", focus: dict | None = None) -> dict:
    return {
        "contract_id": f"{CONTRACT_ID}-runtime-request-v1",
        "conversation": {
            "contract_id": CONTRACT_ID,
            "conversation_id": f"candidate-conversation:{CONTEXT_ID}",
            "subject_type": "CANDIDATE",
            "subject_id": CONTEXT_ID,
            "created_at": "2026-09-03T07:02:00Z",
        },
        "human_message": message,
        "observation": {
            "contract_id": f"{CONTRACT_ID}-observation-v1",
            "candidate_context_id": CONTEXT_ID,
            "working_model_id": WORKING_MODEL["working_model_id"],
            "version": WORKING_MODEL["version"],
            "fingerprint": WORKING_MODEL["fingerprint"],
            "focus": focus or {"type": "CANDIDATE"},
        },
        "working_model": WORKING_MODEL,
        "runtime_snapshot": SNAPSHOT.to_dict(),
        "draft": None,
        "turn": {"execution_id": "turn-synthetic-001", "generation": "generation-synthetic-001"},
    }


def compiled_context_for(request: dict) -> dict:
    context = {
        "contract_id": "ariadne-candidate-conversation-context-v1",
        "compiler_version": "candidate-conversation-context-compiler-v1",
        "conversation_subject": {
            "conversation_id": request["conversation"]["conversation_id"],
            "subject_type": "CANDIDATE",
            "candidate_context_id": request["conversation"]["subject_id"],
            "source_document_id": request["working_model"]["source_document_id"],
        },
        "observed_working_model": {
            "working_model_id": request["observation"]["working_model_id"],
            "version": request["observation"]["version"],
            "fingerprint": request["observation"]["fingerprint"],
        },
        "focus": request["observation"]["focus"],
        "candidate": {
            "target_mode": "CANDIDATE",
            "candidate_items": [{"item_id": "item-edu-001", "title": "Synthetic item", "facts": [], "open_uncertainties": [], "grounding_refs": []}],
            "current_item": None,
            "persisted_item": None,
            "draft_item": None,
            "draft_fingerprint": None,
            "other_item_directory": [],
        },
        "open_uncertainties": [],
        "bounded_history": [{
            "turn_id": "history-turn-1",
            "user": {"message_id": "history-user-1", "text": "Synthetic earlier question.", "created_at": "2026-09-03T07:01:10Z"},
            "assistant": {"message_id": "history-assistant-1", "text": "Synthetic earlier answer.", "created_at": "2026-09-03T07:01:11Z"},
        }],
        "current_user_message": {"message_id": "current-user-1", "turn_id": request["turn"]["execution_id"], "text": request["human_message"], "created_at": "2026-09-03T07:02:01Z"},
        "summary": None,
        "diagnostics": {
            "serialized_size_bytes": 0,
            "estimated_tokens": 0,
            "history_turn_count": 1,
            "candidate_item_count": 2,
            "focus_type": request["observation"]["focus"]["type"],
            "compiler_version": "candidate-conversation-context-compiler-v1",
            "history_turn_limit": 8,
            "trimmed_history_turn_count": 0,
            "trimmed_directory_item_count": 0,
        },
    }
    previous_size = -1
    for _ in range(8):
        size = len(json.dumps(context, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        context["diagnostics"]["serialized_size_bytes"] = size
        context["diagnostics"]["estimated_tokens"] = (size + 3) // 4
        if size == previous_size:
            break
        previous_size = size
    return context


def observed(request: dict) -> dict:
    observation = request["observation"]
    return {key: observation[key] for key in ("candidate_context_id", "working_model_id", "version", "fingerprint")}


def action_for(request: dict, action: str, patches: list[dict] | None = None, message: str = "Synthetic response.", clarification: str | None = None) -> dict:
    return {
        "contract_id": ACTION_SCHEMA_VERSION,
        "action": action,
        "message": message,
        "observed_working_model": observed(request),
        "patches": patches or [],
        "clarification": clarification,
    }


def patch(target: str, operation: dict, evidence_refs: list[str] | None = None) -> dict:
    return {
        "target_item_id": target,
        "operations": [operation],
        "reason": "Synthetic requested correction.",
        "origin": "MODEL_PROPOSAL",
        "evidence_refs": evidence_refs or [],
    }


def semantic_no_change_basis(value: str = "Royal College of Art RCA") -> dict:
    return {"target_item_id": "item-edu-001", "concept": "institution_name", "value": value}


def semantic_action(action: str, patches=None, message: str = "Synthetic response.", clarification: str | None = None, no_change_basis: dict | None = None) -> dict:
    result = {"action": action, "message": message}
    if patches is not None:
        result["patches"] = patches
    if clarification is not None:
        result["clarification"] = clarification
    if action == "NO_CHANGE":
        result["no_change_basis"] = no_change_basis or semantic_no_change_basis()
    return result


def semantic_patch(target: str | None, concept: str, value: str, intent: str = "SET") -> dict:
    result = {"changes": [{"intent": intent, "concept": concept, "value": value}]}
    if target is not None:
        result["target_item_id"] = target
    return result


def expect_error(code: str, callback) -> None:
    try:
        callback()
        raise AssertionError(f"expected {code}")
    except CandidateConversationRuntimeError as error:
        assert error.code == code, (error.code, code)


# Capability + immutable snapshot: exact primary only, no PDF delivery semantics.
assert DESCRIPTOR.runtime_capabilities["ai_conversation"] == "supported"
assert DESCRIPTOR.runtime_capabilities["candidate_model_structuring"] == "unsupported"
assert SNAPSHOT.model == MODEL_ID and SNAPSHOT.protocol == "OPENAI_CHAT_COMPLETIONS"
assert SNAPSHOT.operation == OPERATION and SNAPSHOT.capability_basis == CAPABILITY_BASIS
assert SNAPSHOT.action_schema_version == ACTION_SCHEMA_VERSION
assert SNAPSHOT.request_config_version == REQUEST_CONFIG_VERSION
assert SNAPSHOT.delivery_method is None and SNAPSHOT.credential_ref == CREDENTIAL_REF
assert CONTRACT_MANIFEST["semantic_action_version"] == SEMANTIC_ACTION_SCHEMA_VERSION

base_request = request_for()
validated_request = validate_candidate_conversation_request(base_request)
provider_payload = build_candidate_conversation_payload(validated_request)
assert provider_payload["model"] == MODEL_ID
assert provider_payload["response_format"] == {"type": "json_object"}
assert provider_payload["thinking"] == {"type": "disabled"}
assert provider_payload["temperature"] == 0 and provider_payload["max_tokens"] == 1400
assert SEMANTIC_ACTION_SCHEMA_VERSION in provider_payload["messages"][0]["content"]
assert semantic_prompt_schema_fragment() in provider_payload["messages"][0]["content"]
assert "SET_ITEM_FIELD" not in provider_payload["messages"][0]["content"]
serialized_provider_request = json.dumps(provider_payload, ensure_ascii=False)
assert "%PDF" not in serialized_provider_request and "document_data_url" not in serialized_provider_request
assert "consent" not in serialized_provider_request and "CANDIDATE_MODEL_STRUCTURING" not in serialized_provider_request

# Compiled context is separately auditable: action rules, bounded context/history, then the exact current Human message.
compiled_request = request_for("Current synthetic compiled instruction.")
compiled_request["compiled_context"] = compiled_context_for(compiled_request)
validated_compiled = validate_candidate_conversation_request(compiled_request)
compiled_provider_payload = build_candidate_conversation_payload(validated_compiled)
assert [message["role"] for message in compiled_provider_payload["messages"]] == ["system", "user", "user", "assistant", "user"]
assert compiled_provider_payload["messages"][-1]["content"] == compiled_request["human_message"]
assert "COMPILED_CANDIDATE_CONTEXT" in compiled_provider_payload["messages"][1]["content"]
assert "Synthetic item" not in compiled_provider_payload["messages"][0]["content"]
private_context_request = json.loads(json.dumps(compiled_request))
private_context_request["compiled_context"]["candidate"]["credential"] = "not-stored"
expect_error("CONTEXT_PRIVATE_MATERIAL_FORBIDDEN", lambda: validate_candidate_conversation_request(private_context_request))
wrong_size_request = json.loads(json.dumps(compiled_request))
wrong_size_request["compiled_context"]["diagnostics"]["serialized_size_bytes"] = 999999
expect_error("CONTEXT_LIMIT_EXCEEDED", lambda: validate_candidate_conversation_request(wrong_size_request))

# Subject identity is stable when turn focus changes.
item_request = request_for(focus={"type": "ITEM", "item_id": "item-edu-001"})
draft_request = request_for(focus={"type": "ITEM_DRAFT", "item_id": "item-edu-001", "draft_fingerprint": "sha256:" + "b" * 64})
draft_item = {**WORKING_MODEL["payload"]["items"][0], "title": "Unsaved synthetic draft"}
draft_fingerprint = "sha256:" + hashlib.sha256(json.dumps(draft_item, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()
draft_request["observation"]["focus"]["draft_fingerprint"] = draft_fingerprint
draft_request["draft"] = {"item_id": "item-edu-001", "item": draft_item, "draft_fingerprint": draft_fingerprint}
assert base_request["conversation"] == item_request["conversation"] == draft_request["conversation"]

# A-E/F: all five action paths and both patch cardinalities.
validate_candidate_action(action_for(base_request, "NO_CHANGE", message="No change is needed."), validated_request)
one_patch = patch("item-edu-001", {"operation": "SET_ITEM_FIELD", "field": "title", "value": "Royal College of Art"}, ["ground-edu-001"])
validate_candidate_action(action_for(base_request, "PATCH_ITEM", [one_patch], "Updated the requested title."), validated_request)
validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("item-edu-001", {"operation": "SET_FACT_VALUE", "fact_id": "fact-degree-001", "value": "Updated synthetic degree"})], "Updated the requested fact."), validated_request)
validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("item-edu-001", {"operation": "SET_UNCERTAINTY_STATUS", "uncertainty_id": "uncertain-edu-001", "status": "RESOLVED"})], "Resolved the requested uncertainty."), validated_request)
multi_request = request_for("请把所有教育项目中的 RCA 都统一展开。")
validated_multi = validate_candidate_conversation_request(multi_request)
two_patches = [
    patch("item-edu-001", {"operation": "SET_ITEM_FIELD", "field": "title", "value": "Royal College of Art"}),
    patch("item-edu-002", {"operation": "SET_ITEM_FIELD", "field": "title", "value": "Service Design Exchange — Royal College of Art"}),
]
validate_candidate_action(action_for(multi_request, "PATCH_MULTIPLE_ITEMS", two_patches, "Updated all requested items."), validated_multi)
implicit_request = request_for("RCA 就是 Royal College of Art。")
expect_error("IMPLICIT_MULTI_VIOLATION", lambda: validate_candidate_action(action_for(implicit_request, "PATCH_MULTIPLE_ITEMS", two_patches), validate_candidate_conversation_request(implicit_request)))
validate_candidate_action(action_for(base_request, "ASK_CLARIFICATION", clarification="你指的是哪一项？"), validated_request)
expect_error("ACTION_CLARIFICATION_SHAPE_INVALID", lambda: validate_candidate_action(
    action_for(base_request, "ASK_CLARIFICATION", clarification="x" * (CONTRACT_MANIFEST["limits"]["clarification"] + 1)), validated_request,
))
validate_candidate_action(action_for(base_request, "EXPLAIN", message="这是一条纯 synthetic 说明。"), validated_request)

# G-J: target, focus, action and exact-key failures.
expect_error("INVALID_TARGET", lambda: validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("missing-item", {"operation": "SET_ITEM_FIELD", "field": "title", "value": "No"})]), validated_request))
validated_item = validate_candidate_conversation_request(item_request)
expect_error("FOCUS_VIOLATION", lambda: validate_candidate_action(action_for(item_request, "PATCH_ITEM", [two_patches[1]]), validated_item))
expect_error("UNSUPPORTED_ACTION", lambda: validate_candidate_action(action_for(base_request, "REMOVE_ITEM"), validated_request))
with_extra = action_for(base_request, "NO_CHANGE", message="No change is needed.")
with_extra["bypass"] = True
expect_error("ACTION_TOP_LEVEL_SHAPE_INVALID", lambda: validate_candidate_action(with_extra, validated_request))
expect_error("UNSUPPORTED_OPERATION", lambda: validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("item-edu-001", {"operation": "MERGE_ITEMS"})]), validated_request))
expect_error("INVALID_EVIDENCE_REF", lambda: validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("item-edu-001", {"operation": "SET_ITEM_FIELD", "field": "title", "value": "X"}, ["invented-grounding"])]), validated_request))

# K-N: model identity and output failure taxonomy use the model-facing semantic contract.
valid_action = semantic_action("NO_CHANGE", message="No change is needed.")
valid_response = {"id": "response-synthetic", "model": MODEL_ID, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(valid_action)}}], "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}}
action, usage = normalize_candidate_conversation_response(valid_response, validated_request)
assert action["action"] == "NO_CHANGE" and usage["total_tokens"] == 120
expect_error("WRONG_RETURNED_MODEL", lambda: normalize_candidate_conversation_response({**valid_response, "model": "wrong-model"}, validated_request))
expect_error("MALFORMED_RESPONSE", lambda: normalize_candidate_conversation_response({**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": "{bad"}}]}, validated_request))
expect_error("EMPTY_RESPONSE", lambda: normalize_candidate_conversation_response({**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": " "}}]}, validated_request))
expect_error("TRUNCATED_OUTPUT", lambda: normalize_candidate_conversation_response({**valid_response, "choices": [{"finish_reason": "length", "message": {"content": "{}"}}]}, validated_request))

# Semantic action message contract is action-specific and manifest-driven. ASK_CLARIFICATION
# alone permits an omitted or empty message because its user-facing copy is clarification.
semantic_action_fixtures = {
    "PATCH_ITEM": semantic_action("PATCH_ITEM", [semantic_patch("item-edu-001", "institution_name", "Royal College of Art")]),
    "PATCH_MULTIPLE_ITEMS": semantic_action("PATCH_MULTIPLE_ITEMS", [
        semantic_patch("item-edu-001", "institution_name", "Royal College of Art"),
        semantic_patch("item-edu-002", "institution_name", "Service Design Exchange — Royal College of Art"),
    ]),
    "ASK_CLARIFICATION": semantic_action("ASK_CLARIFICATION", [], clarification="Which synthetic education item do you mean?"),
    "EXPLAIN": semantic_action("EXPLAIN", []),
    "NO_CHANGE": semantic_action("NO_CHANGE", []),
}
for action_type, fixture in semantic_action_fixtures.items():
    assert validate_semantic_candidate_action(fixture)["action"] == action_type
    missing = dict(fixture)
    missing.pop("message", None)
    if action_type == "ASK_CLARIFICATION":
        assert validate_semantic_candidate_action(missing)["message"] == ""
    else:
        expect_error("ACTION_MESSAGE_SHAPE_INVALID", lambda value=missing: validate_semantic_candidate_action(value))
    for invalid_message in (None, "", "   ", "x" * (CONTRACT_MANIFEST["limits"]["message"] + 1), 7):
        malformed = {**fixture, "message": invalid_message}
        if action_type == "ASK_CLARIFICATION" and invalid_message in {"", "   "}:
            assert validate_semantic_candidate_action(malformed)["message"] == ""
        else:
            expect_error("ACTION_MESSAGE_SHAPE_INVALID", lambda value=malformed: validate_semantic_candidate_action(value))

# Provider-shaped local acceptance: a clear correction resolves to one canonical PATCH_ITEM.
provider_patch_response = {**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps({
    "action": "PATCH_ITEM", "message": "Updated the synthetic institution.",
    "patch": {"target": "item-edu-001", "changes": [{"intent": "SET", "concept": "school_name", "value": "Royal College of Art"}]},
})}}]}
provider_patch_action, _ = normalize_candidate_conversation_response(provider_patch_response, validated_request)
assert provider_patch_action["action"] == "PATCH_ITEM"
assert provider_patch_action["patches"][0]["operations"] == [{"operation": "SET_ITEM_FIELD", "field": "title", "value": "Royal College of Art"}]

# Provider-shaped NO_CHANGE is valid only when its model-owned basis matches the current canonical value.
provider_no_change_response = {**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(semantic_action("NO_CHANGE", [], "Synthetic value already matches."))}}]}
provider_no_change_action, _ = normalize_candidate_conversation_response(provider_no_change_response, validated_request)
assert provider_no_change_action["action"] == "NO_CHANGE" and provider_no_change_action["patches"] == []
wrong_no_change_response = {**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(semantic_action("NO_CHANGE", [], "Synthetic value already matches.", no_change_basis=semantic_no_change_basis("Royal College of Art")))}}]}
expect_error("NO_CHANGE_STATE_MISMATCH", lambda: normalize_candidate_conversation_response(wrong_no_change_response, validated_request))
missing_no_change_basis = semantic_action("NO_CHANGE", [], "Synthetic value already matches.")
missing_no_change_basis.pop("no_change_basis")
expect_error("SEMANTIC_SCHEMA_INVALID", lambda: validate_semantic_candidate_action(missing_no_change_basis))

# Response resolution: the old storage-level path rejects this representation, while the bounded semantic path normalizes it.
representation_fixture = {
    "action": "PATCH_ITEM",
    "message": "Updated the synthetic institution name.",
    "patch": {
        "target": "item-edu-001",
        "changes": [{"intent": "SET", "concept": "institution", "value": "Royal College of Art"}],
    },
}
expect_error("ACTION_TOP_LEVEL_SHAPE_INVALID", lambda: validate_candidate_action(representation_fixture, validated_request))
semantic_normalized = validate_semantic_candidate_action(representation_fixture)
assert semantic_normalized["patches"][0]["target_item_id"] == "item-edu-001"
assert semantic_normalized["patches"][0]["changes"][0]["concept"] == "institution_name"
resolved = resolve_semantic_candidate_action(representation_fixture, validated_request)
assert resolved["contract_id"] == ACTION_SCHEMA_VERSION
assert resolved["observed_working_model"] == observed(base_request)
assert resolved["clarification"] is None
assert resolved["patches"][0]["origin"] == "MODEL_PROPOSAL"
assert resolved["patches"][0]["evidence_refs"] == []
assert resolved["patches"][0]["operations"] == [{"operation": "SET_ITEM_FIELD", "field": "title", "value": "Royal College of Art"}]

# Missing exact target is clarification-safe when Candidate focus contains multiple Cards.
ambiguous_target = semantic_action("PATCH_ITEM", semantic_patch(None, "institution_name", "Royal College of Art"), "Update the institution.")
ambiguous_target_resolved = resolve_semantic_candidate_action(ambiguous_target, validated_request)
assert ambiguous_target_resolved["action"] == "ASK_CLARIFICATION" and ambiguous_target_resolved["patches"] == []

# Negative semantic safety: no unknown concepts, targets, implicit multi, focus escape, authority escalation, or extra keys.
expect_error("UNKNOWN_CONCEPT", lambda: resolve_semantic_candidate_action(
    semantic_action("PATCH_ITEM", [semantic_patch("item-edu-001", "imagined_concept", "No")], "No."), validated_request,
))
expect_error("INVALID_TARGET", lambda: resolve_semantic_candidate_action(
    semantic_action("PATCH_ITEM", [semantic_patch("hallucinated-item", "institution_name", "No")], "No."), validated_request,
))
semantic_multi = semantic_action("PATCH_MULTIPLE_ITEMS", [
    semantic_patch("item-edu-001", "institution_name", "Royal College of Art"),
    semantic_patch("item-edu-002", "institution_name", "Royal College of Art"),
], "Updated both.")
expect_error("IMPLICIT_MULTI_VIOLATION", lambda: resolve_semantic_candidate_action(semantic_multi, validate_candidate_conversation_request(implicit_request)))
expect_error("FOCUS_VIOLATION", lambda: resolve_semantic_candidate_action(
    semantic_action("PATCH_ITEM", [semantic_patch("item-edu-002", "institution_name", "No")], "No."), validated_item,
))
expect_error("UNSUPPORTED_ACTION", lambda: validate_semantic_candidate_action({"action": "CREATE_ITEM", "message": "No."}))
expect_error("UNSUPPORTED_ACTION", lambda: validate_semantic_candidate_action({"action": "REMOVE_ITEM", "message": "No."}))
expect_error("UNSUPPORTED_ACTION", lambda: validate_semantic_candidate_action({"action": "MERGE_ITEMS", "message": "No."}))
expect_error("UNSUPPORTED_ACTION", lambda: validate_semantic_candidate_action({"action": "DELETE_ITEM", "message": "No."}))
expect_error("UNSUPPORTED_MUTATION", lambda: resolve_semantic_candidate_action({
    "action": "PATCH_ITEM", "message": "No.", "patches": [{"target_item_id": "item-edu-001", "changes": [{"intent": "CLEAR", "concept": "institution_name"}]}],
}, validated_request))
expect_error("UNSUPPORTED_MUTATION", lambda: validate_semantic_candidate_action({
    "action": "PATCH_ITEM", "message": "No.", "patches": [{"target_item_id": "item-edu-001", "changes": [{"intent": "DELETE", "concept": "institution_name"}]}],
}))
expect_error("SEMANTIC_SCHEMA_INVALID", lambda: validate_semantic_candidate_action({**valid_action, "arbitrary": True}))
expect_error("SEMANTIC_SCHEMA_INVALID", lambda: validate_semantic_candidate_action({
    "action": "PATCH_ITEM", "message": "No.", "patches": [{**semantic_patch("item-edu-001", "institution_name", "No"), "evidence_refs": ["invented"]}],
}))
expect_error("AUTHORITY_COPY_INVALID", lambda: resolve_semantic_candidate_action(
    semantic_action("NO_CHANGE", message="已保存到个人资料。"), validated_request,
))
expect_error("INVALID_UNCERTAINTY_STATUS", lambda: resolve_semantic_candidate_action({
    "action": "PATCH_ITEM", "message": "No.", "patches": [{"target_item_id": "item-edu-001", "changes": [{"intent": "SET_STATUS", "concept": "uncertainty_status", "reference_id": "uncertain-edu-001", "value": "CONFIRMED"}]}],
}, validated_request))
expect_error("INVALID_OPERATION_TARGET", lambda: resolve_semantic_candidate_action({
    "action": "PATCH_ITEM", "message": "No.", "patches": [{"target_item_id": "item-edu-001", "changes": [{"intent": "SET_STATUS", "concept": "uncertainty_status", "reference_id": "invented-uncertainty", "value": "RESOLVED"}]}],
}, validated_request))

# An actual Working item with two equally valid fact destinations is clarification-safe, never guessed.
ambiguous_mapping_request = request_for("把 location 改成 Synthetic City。")
ambiguous_payload = json.loads(json.dumps(WORKING_MODEL["payload"]))
ambiguous_payload["items"][0]["facts"].extend([
    {"fact_id": "fact-location-a", "label": "Location", "value": "Synthetic A"},
    {"fact_id": "fact-location-b", "label": "Location", "value": "Synthetic B"},
])
ambiguous_mapping_request["working_model"] = {**WORKING_MODEL, "payload": ambiguous_payload, "fingerprint": ""}
ambiguous_mapping_request["working_model"]["fingerprint"] = "sha256:" + hashlib.sha256(json.dumps(ambiguous_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()
ambiguous_mapping_request["observation"]["fingerprint"] = ambiguous_mapping_request["working_model"]["fingerprint"]
ambiguous_mapping_validated = validate_candidate_conversation_request(ambiguous_mapping_request)
ambiguous_mapping_result = resolve_semantic_candidate_action(
    semantic_action("PATCH_ITEM", [semantic_patch("item-edu-001", "location", "Synthetic City")], "Updated location."),
    ambiguous_mapping_validated,
)
assert ambiguous_mapping_result["action"] == "ASK_CLARIFICATION"

# Safe diagnostics identify the stage/category without response content or Candidate values.
diagnostic_response = {**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps({"action": "PATCH_ITEM", "message": "No.", "patches": [{"target_item_id": "item-edu-001", "changes": [{"intent": "SET", "concept": "unknown", "value": "Private-like value must not appear"}]}]})}}]}
try:
    normalize_candidate_conversation_response(diagnostic_response, validated_request)
    raise AssertionError("expected safe response diagnostic")
except CandidateConversationRuntimeError as error:
    assert error.code == "UNKNOWN_CONCEPT"
    assert error.diagnostics["stage"] == "RESOLUTION"
    assert error.diagnostics["field_category"] == "semantic_action.change.concept"
    assert error.diagnostics["action_type"] == "PATCH_ITEM"
    serialized_diagnostics = json.dumps(error.diagnostics, ensure_ascii=False)
    assert "Private-like value" not in serialized_diagnostics and "item-edu-001" not in serialized_diagnostics

# O: old response cannot bind to another Working head.
stale_request = request_for()
stale_payload = json.loads(json.dumps(WORKING_MODEL["payload"]))
stale_payload["items"][0]["title"] = "Synthetic V4 title"
stale_fingerprint = "sha256:" + hashlib.sha256(json.dumps(stale_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")).hexdigest()
stale_request["working_model"] = {**WORKING_MODEL, "payload": stale_payload, "fingerprint": stale_fingerprint}
expect_error("STALE_WORKING_OBSERVATION", lambda: validate_candidate_conversation_request(stale_request))

# P: cancellation invalidates the generation; a late result cannot be accepted.
registry = CandidateConversationExecutionRegistry()
assert registry.begin("turn-cancel", "generation-1")
assert registry.cancel("turn-cancel", "generation-1")
assert not registry.accept("turn-cancel", "generation-1")

# Q: adapter output is explicitly non-authoritative and cannot publish context.
captured = {}
def fake_provider_call(_credential: str, payload: dict) -> tuple[int, dict]:
    captured.update(payload)
    return 200, valid_response

result = execute_candidate_conversation_request(base_request, lambda: "synthetic-credential-never-logged", fake_provider_call)
assert result["authority"] == "NON_AUTHORITATIVE_WORKING_ACTION"
assert result["persistence"] == "not_written"
assert "workspace_acceptance" not in result and "confirmed_context" not in result
assert captured["model"] == MODEL_ID

# R/S: the frozen runtime remains separate while Slice A wires the Workspace list root.
pages_source = (ROOT / "public" / "v1-pages.js").read_text(encoding="utf-8")
assert "applyCandidateWorkspaceCorrection" in pages_source
assert "CandidateModel.editedCandidateWorkingModel" in pages_source
assert 'fetch("/api/candidate-conversation-turn"' in pages_source
assert "CandidateWorkspaceConversationRuntime.executeListTurn" in pages_source
truth_source = (ROOT / "public" / "truth-persistence-domain.js").read_text(encoding="utf-8")
assert 'name: "conversation_sessions"' in truth_source
assert 'name: "conversation_messages"' in truth_source
assert 'name: "conversation_turn_executions"' in truth_source
assert 'name: "candidate_actions"' in truth_source
assert "applyWorkspaceAcceptance" in truth_source and "AUTHORITATIVE_CONFIRMED_CONTEXT" in truth_source

print("candidate_conversation_runtime_contract=pass")
