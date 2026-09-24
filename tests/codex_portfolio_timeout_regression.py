"""Bounded long-document waits and recoverable Candidate HTTP failures; no model calls."""
import copy
import io
import http.client
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import threading
from http.server import ThreadingHTTPServer
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import app
from src.codex_runtime import call_codex, CodexTimeoutError, execution_timeout
from src.runtime_binding import CODEX_CREDENTIAL, CODEX_MODEL, CODEX_PROTOCOL, adapter_for
from src.model_settings import envelope
from src.candidate_model_runtime import CandidateModelExecutionRegistry, candidate_model_operation_id, runtime_fingerprint
from src.codex_app_server import Channel, overrides
from src.codex_runtime import DISABLED_FEATURES

assert execution_timeout(0) == execution_timeout(1) == 180
assert execution_timeout(2) == 210
assert execution_timeout(25) == execution_timeout(80) == 900

# A completed response after 200 virtual seconds must survive for all 25 images,
# while a short request or an explicit deadline must still terminate and clean up.
events = [
    {"method": "item/completed", "params": {"threadId":"thread", "turnId":"turn", "item": {"id":"final", "type": "agentMessage", "text": '{"ok":true}', "phase":"final_answer"}}},
    {"method": "turn/completed", "params": {"threadId":"thread", "turn": {"id":"turn", "status":"completed"}}},
]
payload = {"model": CODEX_MODEL, "reasoning_effort": "medium", "messages": [{"role": "user", "content": [
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,aW1hZ2U="}} for _ in range(25)
]}]}
for image_count, override, should_timeout in [(25, None, False), (1, None, True), (25, 10, True)]:
    clock, children = [0], []
    current = copy.deepcopy(payload)
    current["messages"][0]["content"] = current["messages"][0]["content"][:image_count]

    class Child:
        pid = 123456789
        def __init__(self, args, **kwargs):
            assert args[1:3] == ['app-server', '--stdio']
            assert 'model_reasoning_effort="medium"' in args
            self.stdin, self.stdout = io.BytesIO(), io.BytesIO()
            self.cwd = kwargs['cwd']
            self.done = False
            children.append(self)
        def wait(self, timeout=None):
            self.done = True
            return 0
        def poll(self):
            return 0 if self.done else None

    class Protocol(Channel):
        def request(self, method, params):
            if method == 'initialize': return {}
            if method == 'config/read': return {'config': {'features': {k:False for k in DISABLED_FEATURES}}}
            if method == 'skills/list': return {'data': []}
            if method == 'mcpServerStatus/list': return {'data': []}
            if method == 'thread/start':
                assert params['model'] == CODEX_MODEL
                return {'model': CODEX_MODEL, 'modelProvider':'ariadne-openai', 'cwd':str(self.process.cwd), 'approvalPolicy':'never', 'sandbox':{'type':'readOnly'}, 'thread':{'id':'thread','ephemeral':True}, 'reasoningEffort':'medium'}
            assert method == 'turn/start'
            images = [part for part in params['input'] if part['type']=='localImage']
            assert len(images) == image_count and all(Path(part['path']).read_bytes()==b'image' for part in images)
            assert params['model'] == CODEX_MODEL and params['effort']=='medium'
            self.index=0
            return {'turn':{'id':'turn'}}
        def read(self):
            clock[0]=200
            if self.deadline <= clock[0]:
                # Use the real deadline branch, not a test-only timeout error.
                return super().read()
            value=events[self.index]; self.index+=1
            return value

    with patch.dict(os.environ, {"ARIADNE_CODEX_ENABLED": "1"}), \
         patch("src.codex_app_server.subprocess.Popen", Child), \
         patch("src.codex_app_server.Channel", Protocol), \
         patch("src.codex_app_server.time.monotonic", side_effect=lambda: clock[0]), \
         patch("src.codex_app_server.os.killpg") as kill:
        try:
            status, result = call_codex(CODEX_CREDENTIAL, current, timeout=override)
        except CodexTimeoutError as error:
            assert should_timeout
            assert str(error) == "CODEX_TIMEOUT"
            assert error.diagnostics == {"provider": "codex", "timeout_seconds": override or 180, "input_image_count": image_count}
            kill.assert_called_once()
        else:
            assert not should_timeout and status == 200
            assert json.loads(result["choices"][0]["message"]["content"]) == {"ok": True}
            kill.assert_called_once()  # Per-request App Server is stopped on success too.
        assert children[0].done

fixture = runpy.run_path(str(ROOT / "tests/candidate_model_runtime_regression.py"))
request = fixture["request"]()
runtime = request["runtime_snapshot"]
runtime.update(provider="codex", model=CODEX_MODEL, protocol=CODEX_PROTOCOL, credential_ref=CODEX_CREDENTIAL,
               adapter_version=adapter_for("codex", runtime["adapter_version"]), execution_settings=envelope("codex", CODEX_MODEL))
request["consent"].update(provider="codex", model=CODEX_MODEL)
identity = request["operation_identity"]
identity["runtime_fingerprint"] = runtime_fingerprint(runtime)
identity["operation_id"] = candidate_model_operation_id(identity["source_document_id"], identity["runtime_fingerprint"], identity["consent_id"])
request["processing_run_id"] = "run-" + identity["operation_id"]

server = ThreadingHTTPServer(("127.0.0.1", 0), app.JobRadarHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
def post():
    connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
    connection.request("POST", "/api/candidate-model-structure", json.dumps(request), {"Content-Type": "application/json"})
    response = connection.getresponse()
    result = response.status, json.loads(response.read())
    connection.close()
    return result

try:
    pages = [(str(n), b"synthetic-image") for n in range(1, 26)]
    response = fixture["response"](model=CODEX_MODEL)
    with patch.dict(os.environ, {"ARIADNE_CODEX_ENABLED": "1"}), \
         patch.object(app, "CANDIDATE_MODEL_EXECUTIONS", CandidateModelExecutionRegistry()), \
         patch.object(app, "render_complete_pdf_pages", return_value=pages), \
         patch.object(app, "read_deepseek_key", side_effect=AssertionError("Codex must not read API keys")), \
         patch.object(app, "call_ariadne_model", side_effect=[CodexTimeoutError(900, 25), (200, response)]) as provider:
        status, result = post()
        assert status == 502 and result["error"] == "codex_timeout"
        assert result["failure_layer"] == "transport" and result["persistence"] == "not_written"
        assert result["diagnostics"] == {"provider": "codex", "timeout_seconds": 900, "input_image_count": 25}
        assert "candidate_proposal" not in result
        # Failure releases the operation, so retry is allowed and remains a proposal.
        status, result = post()
        assert status == 200 and result["rendered_page_count"] == result["outbound_image_count"] == 25
        assert result["persistence"] == "browser_working_projection_required"
        assert result["candidate_proposal"]["review_status"] == "NEEDS_REVIEW"
        assert provider.call_count == 2
        transported = provider.call_args.args[1]
        assert sum(p["type"] == "image_url" for p in transported["messages"][0]["content"]) == 25
finally:
    server.shutdown()
    server.server_close()

print(json.dumps({"bounded_document_timeout": "pass", "all_25_images_preserved": "pass",
                  "short_and_explicit_timeout_cleanup": "pass", "safe_http_timeout_and_retry": "pass", "live_provider_calls": 0}))
