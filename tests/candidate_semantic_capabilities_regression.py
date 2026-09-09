"""Generic semantics regressions; --live uses configured Codex on synthetic data only."""
import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys
import datetime

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
with contextlib.redirect_stdout(io.StringIO()):
    fixture = runpy.run_path(str(ROOT / "tests/candidate_conversation_runtime_regression.py"))
from src import candidate_conversation_runtime as runtime
from src.conversation_semantics import HUMAN_CONVERSATION_PRINCIPLES


def request_for(message, history=(), *, live=False):
    raw = copy.deepcopy(fixture["request_for"](message))
    template = copy.deepcopy(raw["working_model"]["payload"]["items"][0])
    items = []
    for index, (title, kind, subtype) in enumerate([
        ("合成山居研究", "PROJECT", "project"), ("合成公共空间", "PROJECT", "project"),
        ("合成声音实验", "PROJECT", "project"), ("合成设计学院", "EDUCATION", "education"),
        ("合成产品助理", "WORK_EXPERIENCE", "work_experience"),
    ], 1):
        item = {**copy.deepcopy(template), "item_id": f"synthetic-item-{index}", "title": title,
                "item_type": kind, "item_subtype": subtype, "summary": "仅用于测试，不是真实经历。",
                "facts": [{"fact_id": f"synthetic-role-{index}", "label": "角色", "value": "协作者"}], "uncertainties": []}
        items.append(item)
    raw["working_model"]["payload"]["items"] = items
    fp = "sha256:" + hashlib.sha256(json.dumps(raw["working_model"]["payload"], sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    raw["working_model"]["fingerprint"] = raw["observation"]["fingerprint"] = fp
    context = fixture["compiled_context_for"](raw)
    context["candidate"]["candidate_items"] = copy.deepcopy(items)
    context["bounded_history"] = [{"turn_id": f"synthetic-turn-{index}",
        "user": {"message_id": f"synthetic-user-{index}", "text": user, "created_at": "2026-09-09T01:00:00Z"},
        "assistant": {"message_id": f"synthetic-assistant-{index}", "text": assistant, "created_at": "2026-09-09T01:00:01Z"}}
        for index, (user, assistant) in enumerate(history)]
    context["diagnostics"].update(history_turn_count=len(history), candidate_item_count=len(items))
    for _ in range(10):
        size = len(json.dumps(context, ensure_ascii=False, separators=(",", ":")).encode())
        context["diagnostics"].update(serialized_size_bytes=size, estimated_tokens=(size + 3) // 4)
    raw["compiled_context"] = context
    if live:
        from src.runtime_binding import CODEX_MODEL, CODEX_PROTOCOL, CODEX_CREDENTIAL, adapter_for
        snapshot = raw["runtime_snapshot"]
        snapshot.update(provider="codex", model=CODEX_MODEL, protocol=CODEX_PROTOCOL, credential_ref=CODEX_CREDENTIAL,
                        adapter_version=adapter_for("codex", snapshot["adapter_version"]))
    return runtime.validate_candidate_conversation_request(raw)


def patch(card, value, *, concept="category", field_ref=None):
    change = {"intent": "SET", "concept": concept, "value": value}
    if field_ref:
        change["field_ref"] = field_ref
    return {"card_ref": f"card-{card}", "changes": [change]}


def offline():
    message = "合成山居研究与合成公共空间，标成建筑项目；合成声音实验保持原样。"
    request = request_for(message)
    semantic = {"action": "PATCH_MULTIPLE_ITEMS", "patches": [patch(1, "建筑项目"), patch(2, "建筑项目")],
                "intent_evidence": {"current_quote": message, "history_ref": None, "history_quote": None}}
    result = runtime.resolve_semantic_candidate_action(semantic, request)
    assert [entry["target_item_id"] for entry in result["patches"]] == ["synthetic-item-1", "synthetic-item-2"]
    assert all(entry["operations"][0]["field"] == "category" for entry in result["patches"])
    followup = request_for("就这样改", [(message, "可以按这个范围更新草稿。")])
    continued = {**semantic, "intent_evidence": {"current_quote": "就这样改", "history_ref": "history-1", "history_quote": message}}
    assert runtime.resolve_semantic_candidate_action(continued, followup)["action"] == "PATCH_MULTIPLE_ITEMS"
    for evidence in [dict(continued["intent_evidence"], current_quote="伪造授权"),
                     dict(continued["intent_evidence"], history_ref="history-99"),
                     dict(continued["intent_evidence"], history_quote="可以按这个范围更新草稿。")]:
        try:
            runtime.resolve_semantic_candidate_action({**continued, "intent_evidence": evidence}, followup)
        except runtime.CandidateConversationRuntimeError as error:
            assert error.code == "IMPLICIT_MULTI_VIOLATION"
        else:
            raise AssertionError("fabricated/non-user scope accepted")
    # Generic field references work for education, work and projects, without
    # special-casing institution/role/project vocabulary in the resolver.
    for card, field, value in [(4, "time", "2024–2026"), (5, "synthetic-role-5", "研究协调"), (1, "summary", "仅负责用户研究。")]:
        item = request.working_model["payload"]["items"][card - 1]
        descriptors = runtime.candidate_field_descriptors(item)
        index = next(i for i, entry in enumerate(descriptors, 1) if field in entry["storage_target"].values())
        output = runtime.resolve_semantic_candidate_action({"action": "PATCH_ITEM", "patches": [patch(card, value, concept="referenced_field", field_ref=f"field-{index}")]}, request)
        assert output["patches"][0]["operations"][0].get("value") == value
    precise = "你是想缩短摘要，还是减少负责内容的描述？"
    assert runtime.resolve_semantic_candidate_action({"action": "ASK_CLARIFICATION", "clarification": precise}, request)["clarification"] == precise
    try:
        runtime.resolve_semantic_candidate_action({"action": "PATCH_ITEM", "patches": [patch(1, "x", field_ref="field-999")]}, request)
    except runtime.CandidateConversationRuntimeError as error:
        assert error.code == "INVALID_OPERATION_TARGET"
    else:
        raise AssertionError("unknown field reference accepted")
    for module, prompt in [(runtime, runtime.candidate_conversation_prompt)]:
        assert HUMAN_CONVERSATION_PRINCIPLES in prompt()
    print("candidate_semantic_capabilities_offline=pass")


def live():
    from src.codex_runtime import call_codex
    from src.runtime_binding import CODEX_CREDENTIAL
    cases = [
        ("exclude_project", "除了合成声音实验，其余项目都打上建筑项目的分类标签。", (), {1, 2}, "category", "建筑项目"),
        ("follow_up", "就这样改", [("合成山居研究和合成公共空间可以标成研究项目吗？", "可以，分类标签可以设为研究项目，其他卡片保留。")], {1, 2}, "category", "研究项目"),
        ("education", "合成设计学院的就读时间改成2024–2026。", (), {4}, "time", "2024–2026"),
        ("work_role", "合成产品助理这段经历，我的角色其实是研究协调，标题不要动。", (), {5}, "fact_id", "研究协调"),
        ("discussion", "项目分类和项目标题有什么区别？先解释，不要修改。", (), set(), None, None),
        ("withdraw", "先别改，保留原样。", [("请把合成山居研究和合成公共空间标成研究项目", "可以更新草稿。")], set(), None, None),
        ("ambiguous", "帮我调整一下", (), set(), None, None),
    ]
    results = []
    output = ROOT / ".cache/semantic-conversation-20260909" / datetime.datetime.now().strftime("live-%H%M%S")
    output.mkdir(parents=True, exist_ok=True)
    for name, message, history, expected, field, value in cases:
        request = request_for(message, history, live=True)
        status, response = call_codex(CODEX_CREDENTIAL, runtime.build_candidate_conversation_payload(request))
        (output / f"{name}-provider.json").write_text(json.dumps(response, ensure_ascii=False, indent=2))
        action, usage = runtime.normalize_candidate_conversation_response(response, request, status)
        (output / f"{name}-action.json").write_text(json.dumps(action, ensure_ascii=False, indent=2))
        actual = {int(entry["target_item_id"].rsplit("-", 1)[1]) for entry in action["patches"]}
        assert actual == expected, (name, "wrong scope", action)
        if expected:
            for entry in action["patches"]:
                assert len(entry["operations"]) == 1, (name, "unrelated edit", action)
                operation = entry["operations"][0]
                assert operation.get("value") == value, (name, action)
                assert operation.get("field") == field if field != "fact_id" else operation.get("fact_id") == "synthetic-role-5"
        else:
            assert action["action"] in {"EXPLAIN", "ASK_CLARIFICATION", "NO_CHANGE"}, (name, action)
        results.append({"case": name, "action": action, "usage": usage})
        print(f"live_semantics {name}=pass", flush=True)
    (output / "live-results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    offline()
    if "--live" in sys.argv:
        live()
