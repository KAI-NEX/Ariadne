"""Slice 2 fail-closed regression for passive runtime reads and legacy Provider routes."""

from http import HTTPStatus
from pathlib import Path
import inspect
import sys
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app  # noqa: E402


expected_legacy_paths = {
    "/api/ai-providers/deepseek/text-preflight",
    "/api/ai-providers/deepseek/document-preflight",
    "/api/ai-providers/gemini/document-preflight",
    "/api/ai-career-ingest",
    "/api/vision-extract",
}
assert app.LEGACY_PROVIDER_ACTION_PATHS == expected_legacy_paths


def bare_handler(path: str = "/"):
    handler = object.__new__(app.JobRadarHandler)
    handler.path = path
    handler.headers = {"Host": "127.0.0.1:8000", "Origin": "http://127.0.0.1:8000"}
    handler.server = SimpleNamespace(server_port=8000)
    calls = []
    handler.send_json = lambda status, payload: calls.append((status, payload))
    return handler, calls


handler, calls = bare_handler()
handler.legacy_provider_action_unavailable()
assert calls == [(HTTPStatus.CONFLICT, {
    "error": "legacy_provider_action_disabled_pending_runtime_adapter",
    "failure_layer": "capability",
    "network_call_made": False,
})]

for legacy_path in expected_legacy_paths:
    handler, calls = bare_handler(legacy_path)
    handler.do_POST()
    assert len(calls) == 1
    assert calls[0][0] == HTTPStatus.CONFLICT
    assert calls[0][1]["network_call_made"] is False

original_discovery = app.deepseek_runtime_models
app.deepseek_runtime_models = lambda: (_ for _ in ()).throw(AssertionError("passive runtime options must not call Provider discovery"))
try:
    handler, calls = bare_handler()
    handler.runtime_options()
finally:
    app.deepseek_runtime_models = original_discovery

assert len(calls) == 1 and calls[0][0] == HTTPStatus.OK
runtime_payload = calls[0][1]
assert runtime_payload["provider"] == "deepseek"
assert runtime_payload["models"]
assert [model["model_id"] for model in runtime_payload["models"]] == [
    "deepseek-v4-flash-vision-exp",
]
job_conversation_option = runtime_payload["models"][0]
assert job_conversation_option["runtime_capabilities"]["vision"] == "supported"
assert job_conversation_option["supports_complete_document_review"] is True
assert runtime_payload["network_call_made"] is False
assert runtime_payload["career_data_sent"] is False

post_source = inspect.getsource(app.JobRadarHandler.do_POST)
assert post_source.index("parsed.path in LEGACY_PROVIDER_ACTION_PATHS") < post_source.index('parsed.path == "/api/runtime-check"')
for forbidden_dispatch in (
    "self.preflight_deepseek_text()",
    "self.preflight_deepseek_document()",
    "self.preflight_gemini_document()",
    "self.run_ai_career_ingestion()",
    "self.run_vision_extraction()",
):
    assert forbidden_dispatch not in post_source

print("runtime_capability_gating_python=pass")
