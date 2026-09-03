"""Synthetic-only localhost server for browser acceptance of response resolution."""

from __future__ import annotations

import json
import os
import sys
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
    items = context_envelope["context"]["candidate"]["candidate_items"]
    if len(items) != 1 or items[0].get("item_id") != "item-edu-001" or items[0].get("title") != "Royal College of Art RCA":
        raise ValueError("synthetic_browser_target_required")
    if provider_payload["messages"][-1].get("content") != "Royal College of Art RCA → Royal College of Art":
        raise ValueError("synthetic_browser_current_human_required")
    semantic_action = {
        "action": "PATCH_ITEM",
        "message": "已更新这条 synthetic Candidate Working 信息。",
        "patch": {
            "target": "item-edu-001",
            "changes": [{"intent": "SET", "concept": "school_name", "value": "Royal College of Art"}],
        },
    }
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
