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
    validate_candidate_action,
    validate_candidate_conversation_request,
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

base_request = request_for()
validated_request = validate_candidate_conversation_request(base_request)
provider_payload = build_candidate_conversation_payload(validated_request)
assert provider_payload["model"] == MODEL_ID
assert provider_payload["response_format"] == {"type": "json_object"}
assert provider_payload["thinking"] == {"type": "disabled"}
assert provider_payload["temperature"] == 0 and provider_payload["max_tokens"] == 1400
serialized_provider_request = json.dumps(provider_payload, ensure_ascii=False)
assert "%PDF" not in serialized_provider_request and "document_data_url" not in serialized_provider_request
assert "consent" not in serialized_provider_request and "CANDIDATE_MODEL_STRUCTURING" not in serialized_provider_request

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
validate_candidate_action(action_for(base_request, "EXPLAIN", message="这是一条纯 synthetic 说明。"), validated_request)

# G-J: target, focus, action and exact-key failures.
expect_error("INVALID_TARGET", lambda: validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("missing-item", {"operation": "SET_ITEM_FIELD", "field": "title", "value": "No"})]), validated_request))
validated_item = validate_candidate_conversation_request(item_request)
expect_error("FOCUS_VIOLATION", lambda: validate_candidate_action(action_for(item_request, "PATCH_ITEM", [two_patches[1]]), validated_item))
expect_error("UNSUPPORTED_ACTION", lambda: validate_candidate_action(action_for(base_request, "REMOVE_ITEM"), validated_request))
with_extra = action_for(base_request, "NO_CHANGE", message="No change is needed.")
with_extra["bypass"] = True
expect_error("EXACT_SCHEMA_FAILURE", lambda: validate_candidate_action(with_extra, validated_request))
expect_error("UNSUPPORTED_OPERATION", lambda: validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("item-edu-001", {"operation": "MERGE_ITEMS"})]), validated_request))
expect_error("INVALID_EVIDENCE_REF", lambda: validate_candidate_action(action_for(base_request, "PATCH_ITEM", [patch("item-edu-001", {"operation": "SET_ITEM_FIELD", "field": "title", "value": "X"}, ["invented-grounding"])]), validated_request))

# K-N: model identity and output failure taxonomy.
valid_action = action_for(base_request, "NO_CHANGE", message="No change is needed.")
valid_response = {"id": "response-synthetic", "model": MODEL_ID, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(valid_action)}}], "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120}}
action, usage = normalize_candidate_conversation_response(valid_response, validated_request)
assert action["action"] == "NO_CHANGE" and usage["total_tokens"] == 120
expect_error("WRONG_RETURNED_MODEL", lambda: normalize_candidate_conversation_response({**valid_response, "model": "wrong-model"}, validated_request))
expect_error("MALFORMED_RESPONSE", lambda: normalize_candidate_conversation_response({**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": "{bad"}}]}, validated_request))
expect_error("EMPTY_RESPONSE", lambda: normalize_candidate_conversation_response({**valid_response, "choices": [{"finish_reason": "stop", "message": {"content": " "}}]}, validated_request))
expect_error("TRUNCATED_OUTPUT", lambda: normalize_candidate_conversation_response({**valid_response, "choices": [{"finish_reason": "length", "message": {"content": "{}"}}]}, validated_request))

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

# R/S: new runtime is separate; old deterministic correction and Workspace wiring remain untouched.
pages_source = (ROOT / "public" / "v1-pages.js").read_text(encoding="utf-8")
assert "applyCandidateWorkspaceCorrection" in pages_source
assert "CandidateModel.editedCandidateWorkingModel" in pages_source
assert 'fetch("/api/candidate-conversation-turn"' not in pages_source
truth_source = (ROOT / "public" / "truth-persistence-domain.js").read_text(encoding="utf-8")
assert 'name: "conversation_sessions"' not in truth_source
assert 'name: "conversation_messages"' not in truth_source
assert "applyWorkspaceAcceptance" in truth_source and "AUTHORITATIVE_CONFIRMED_CONTEXT" in truth_source

print("candidate_conversation_runtime_contract=pass")
