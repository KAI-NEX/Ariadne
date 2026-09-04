"""Synthetic-only localhost server for browser acceptance of response resolution."""

from __future__ import annotations

import json
import os
import sys
import time
from http import HTTPStatus
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import app  # noqa: E402
from src.candidate_conversation_runtime import MODEL_ID  # noqa: E402


SEED_SCRIPT = ROOT / "tests" / "candidate_conversation_browser_seed.js"
HARNESS_HTML = ROOT / "tests" / "candidate_conversation_browser_harness.html"
HARNESS_SCRIPT = ROOT / "tests" / "candidate_conversation_browser_harness.js"


class SyntheticHandler(app.JobRadarHandler):
    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path == "/synthetic-browser-seed.js":
            body = SEED_SCRIPT.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path in {"/synthetic-browser-harness.html", "/synthetic-browser-harness.js"}:
            artifact = HARNESS_HTML if path.endswith(".html") else HARNESS_SCRIPT
            body = artifact.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8" if path.endswith(".html") else "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def synthetic_provider(_credential: str, provider_payload: dict, *, response_limit: int) -> tuple[int, dict]:
    if response_limit != 2_000_000 or provider_payload.get("model") != MODEL_ID:
        raise ValueError("synthetic_provider_contract_invalid")
    context_envelope = json.loads(provider_payload["messages"][1]["content"])
    candidate = context_envelope["context"]["candidate"]
    visible_refs = {item.get("card_ref") for item in candidate["candidate_items"] + candidate["other_item_directory"]}
    if candidate.get("current_item"):
        visible_refs.add(candidate["current_item"].get("card_ref"))
    if visible_refs != {"card-1", "card-2", "card-3"}:
        raise ValueError("synthetic_browser_target_required")
    focus = context_envelope["context"]["focus"]
    human_message = provider_payload["messages"][-1].get("content")
    if human_message == "我的角色是助理设计师。":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"changes": [{"intent": "SET", "concept": "role_title", "value": "助理设计师"}]}],
        }
    elif human_message == "这段经历的标题改成产品开发与供应链协作（实习）。":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"changes": [{"intent": "SET", "concept": "experience_title", "value": "产品开发与供应链协作（实习）"}]}],
        }
    elif human_message == "这里不是长期兼职，是实习。":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"changes": [{"intent": "SET", "concept": "work_arrangement", "value": "实习"}]}],
        }
    elif human_message == "这里的时间改成 2026 年 4 月。":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"changes": [{"intent": "SET", "concept": "time_range", "value": "2026 年 4 月"}]}],
        }
    elif human_message == "只修改当前卡片。":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"card_ref": "card-2", "changes": [{"intent": "SET", "concept": "role_title", "value": "Rejected Escape"}]}],
        }
    elif human_message == "把这里改一下。":
        semantic_action = {"action": "ASK_CLARIFICATION", "clarification": "你希望修改当前 synthetic 卡片的哪一项？"}
    elif human_message == "解释这张卡片的当前信息。":
        semantic_action = {"action": "EXPLAIN", "message": "这是当前 synthetic Working head 中的卡片信息。"}
    elif human_message == "延迟更新当前摘要。":
        time.sleep(0.8)
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"changes": [{"intent": "SET", "concept": "summary", "value": "Delayed synthetic detail update."}]}],
        }
    elif human_message == "把补充信息里现在是2025的那项改成RCA硕士作业。":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"changes": [{
                "intent": "SET", "concept": "referenced_field", "selector": "2025", "value": "RCA硕士作业",
            }]}],
        }
    elif human_message == "把副标题改成RCA Design Research。":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"changes": [{"intent": "SET", "concept": "subtitle", "value": "RCA Design Research"}]}],
        }
    elif human_message == "这个卡片里补充一条背景信息。":
        semantic_action = {
            "action": "ASK_CLARIFICATION",
            "clarification": "请选择 item-project-duplicate-fields 或 synthetic-a。",
        }
    elif human_message == "解释这张卡片的当前信息并避免内部编号。":
        semantic_action = {
            "action": "EXPLAIN",
            "message": "当前卡片 item-project-duplicate-fields 的 fact synthetic-b 来自 Working synthetic-browser-slice-b-working-v1。",
        }
    elif human_message == "Royal College of Art RCA → Royal College of Art":
        semantic_action = {
            "action": "PATCH_ITEM",
            "patches": [{"card_ref": "card-1", "changes": [{"intent": "SET", "concept": "institution_name", "value": "Royal College of Art"}]}],
        }
    else:
        raise ValueError("synthetic_browser_current_human_required")
    return HTTPStatus.OK, {
        "id": "synthetic-browser-response-resolution",
        "model": MODEL_ID,
        "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(semantic_action, ensure_ascii=False)}}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
    }


if __name__ == "__main__":
    port = int(os.environ.get("ARIADNE_SYNTHETIC_PORT", "8014"))
    app.read_deepseek_key = lambda: "synthetic-browser-credential"
    app.call_deepseek_chat_completions = synthetic_provider
    server = app.ThreadingHTTPServer(("127.0.0.1", port), SyntheticHandler)
    print(f"Synthetic Ariadne response-resolution server: http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
