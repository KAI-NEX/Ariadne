"""Hosted execution: real contracts, request isolation and no ambient authority."""
import base64
import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app
from web_app import WebApplication
from src.web_execution import Sessions, ImportRegistry, WebBoundaryError
from src.runtime_binding import BROWSER_CREDENTIAL
from src.candidate_model_runtime import runtime_fingerprint, candidate_model_operation_id
from src.job_model_runtime import job_model_operation_id
from src.web_source_read import read_source

ORIGIN = "https://ariadne.example"
KEY = "synthetic-web-request-key-one"
SESSION = "a" * 64


def invoke(application, path="/", payload=None, *, method=None, key=KEY, session=SESSION, **updates):
    body = json.dumps(payload).encode() if payload is not None else b""
    env = {"PATH_INFO": path, "REQUEST_METHOD": method or ("POST" if payload is not None else "GET"),
           "HTTP_HOST": "ariadne.example", "HTTP_ORIGIN": ORIGIN, "CONTENT_TYPE": "application/json",
           "CONTENT_LENGTH": str(len(body)), "HTTP_X_ARIADNE_PROVIDER_KEY": key,
           "HTTP_X_ARIADNE_WEB_SESSION": session, "wsgi.input": io.BytesIO(body)}
    env.update(updates)
    captured = []
    result = application(env, lambda status, headers: captured.append((int(status.split()[0]), dict(headers))))
    try:
        body = b"".join(result)
    finally:
        if hasattr(result, "close"):
            result.close()
    status, headers = captured[0]
    return status, headers, json.loads(body) if body and "json" in headers.get("Content-Type", "") else body


def own_request(value):
    value = copy.deepcopy(value() if callable(value) else value)
    value["runtime_snapshot"]["credential_ref"] = BROWSER_CREDENTIAL
    identity = value.get("operation_identity")
    if identity:
        identity["runtime_fingerprint"] = runtime_fingerprint(value["runtime_snapshot"])
        fn = candidate_model_operation_id if identity["operation_type"] == "CANDIDATE_MODEL_STRUCTURING" else job_model_operation_id
        identity["operation_id"] = fn(identity["source_document_id"], identity["runtime_fingerprint"], identity["consent_id"])
        value["processing_run_id"] = "run-" + identity["operation_id"]
    return value


with contextlib.redirect_stdout(io.StringIO()):
    FIXTURE = runpy.run_path(str(Path(__file__).with_name("candidate_model_runtime_regression.py")))


class HostedRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.web = WebApplication([ORIGIN])
        self.ambient = patch.object(app, "read_deepseek_key", side_effect=AssertionError("ambient key read"))
        self.ambient.start()
        self.addCleanup(self.ambient.stop)

    def test_entry_static_and_contracts(self):
        status, headers, page = invoke(self.web)
        self.assertEqual(status, 200)
        self.assertIn(b'runtime-selector', page)
        self.assertNotIn('返回工作空间'.encode(), page)
        self.assertEqual(headers["X-Frame-Options"], "DENY")
        self.assertEqual(invoke(self.web, method="HEAD")[2], b"")
        self.assertEqual(invoke(self.web, "/api/runtime-options")[2]["models"], [])
        self.assertEqual(invoke(self.web, "/api/web-runtime")[2]["storage"], "browser")
        self.assertEqual(invoke(self.web, "/workspace-storage-contract.js")[0], 200)

    def test_origin_methods_and_private_routes(self):
        for path in ["/api/workspace", "/api/jobs", "/api/local-vision-config", "/api/model-updates/verify", "/api/ai-career-ingest"]:
            self.assertEqual(invoke(self.web, path, {})[0], 404)
        self.assertEqual(invoke(self.web, HTTP_HOST="other.example")[0], 403)
        self.assertEqual(invoke(self.web, HTTP_ORIGIN="https://other.example")[0], 403)
        self.assertEqual(invoke(self.web, "/api/runtime-options", HTTP_SEC_FETCH_SITE="cross-site")[0], 403)
        self.assertEqual(invoke(self.web, "/api/runtime-options", QUERY_STRING="key=secret")[0], 400)
        self.assertEqual(invoke(self.web, "/api/runtime-options", method="OPTIONS")[0], 405)
        for path in ["/.git/config", "/../app.py", "/public/", "/v1-pages.js/../app.py"]:
            self.assertEqual(invoke(self.web, path)[0], 404)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); public = root / "public"; public.mkdir()
            (root / "private.json").write_text('"PRIVATE"')
            (public / "leak.json").symlink_to(root / "private.json")
            self.assertEqual(invoke(WebApplication([ORIGIN], public_path=public), "/leak.json")[0], 404)

    def test_request_requirements(self):
        path = "/api/runtime-check"
        for updates, status in [({"HTTP_ORIGIN": None}, 403), ({"CONTENT_TYPE": "text/plain"}, 415),
                                ({"CONTENT_LENGTH": "999999999"}, 413), ({"CONTENT_LENGTH": "bad"}, 400)]:
            self.assertEqual(invoke(self.web, path, {}, **updates)[0], status)
        self.assertEqual(invoke(self.web, path, {}, key=None)[0], 428)
        self.assertEqual(invoke(self.web, path, {}, session="guess")[0], 400)
        request = own_request(FIXTURE["request"])
        request["runtime_snapshot"]["provider"] = "codex"
        self.assertEqual(invoke(self.web, "/api/candidate-model-structure", request)[0], 422)
        request["runtime_snapshot"]["provider"] = "deepseek"
        request["runtime_snapshot"]["credential_ref"] = app.DEEPSEEK_CREDENTIAL
        self.assertEqual(invoke(self.web, "/api/candidate-model-structure", request)[0], 422)
        for identity in (None, [], "malformed"):
            request = own_request(FIXTURE["request"])
            request["operation_identity"] = identity
            self.assertIn(invoke(self.web, "/api/candidate-model-structure", request)[0], (400, 422))

    def test_import_replay_isolated_by_session_and_key(self):
        request = own_request(FIXTURE["request"])
        def execute(payload, reader, render, call):
            return {"synthetic_owner": reader(BROWSER_CREDENTIAL), "operation": payload["operation_identity"]["operation_id"]}
        with patch.object(app, "execute_candidate_model_request", side_effect=execute) as execute:
            path = "/api/candidate-model-structure"
            self.assertEqual(invoke(self.web, path, request)[0], 200)
            self.assertEqual(invoke(self.web, path, request)[0], 200)
            self.assertEqual(execute.call_count, 1)
            self.assertEqual(invoke(self.web, path, request, session="b" * 64)[0], 200)
            self.assertEqual(execute.call_count, 2)
            result = invoke(self.web, path, request, key="synthetic-other-user-key")
            self.assertEqual(result[2]["synthetic_owner"], "synthetic-other-user-key")
            self.assertEqual(execute.call_count, 3)
            changed = copy.deepcopy(request); changed["document_data_url"] += "x"
            self.assertEqual(invoke(self.web, path, changed)[0], 409)

    def test_cancellation_cannot_cross_users(self):
        with self.web.sessions.acquire(SESSION, KEY) as state:
            registry = state.registries["CANDIDATE_CONVERSATION_EXECUTIONS"]
            registry.begin("execution-one", "generation-one")
        path = "/api/candidate-conversation-turn/cancel"
        request = {"execution_id": "execution-one", "generation": "generation-one"}
        self.assertEqual(invoke(self.web, path, request, session="b" * 64)[2]["state"], "NOT_ACTIVE")
        self.assertEqual(invoke(self.web, path, request)[2]["state"], "CANCELLED")
        self.assertFalse(registry.accept("execution-one", "generation-one"))
        registry.begin("execution-one", "old")
        registry.cancel("execution-one", "old")
        registry.begin("execution-one", "new")
        self.assertFalse(registry.accept("execution-one", "old"))
        self.assertTrue(registry.accept("execution-one", "new"))

    def test_bounded_memory_and_capacity(self):
        registry = ImportRegistry(); registry.MAX_RESULT_BYTES = 1
        self.assertEqual(registry.begin("op", "source")[0], "CLAIMED")
        self.assertTrue(registry.succeed("op", {"data": "large"}))
        with self.assertRaises(WebBoundaryError):
            registry.begin("op", "source")
        self.web.slots.acquire(); self.web.slots.acquire()
        try:
            self.assertEqual(invoke(self.web, "/api/runtime-check", {})[0], 503)
            self.assertEqual(invoke(self.web, "/api/candidate-conversation-turn/cancel", {"execution_id": "a", "generation": "b"})[0], 200)
        finally:
            self.web.slots.release(); self.web.slots.release()
        clock = [0]
        sessions = Sessions(maximum=1, ttl=10, clock=lambda: clock[0])
        with sessions.acquire("a", KEY):
            clock[0] = 20
            with self.assertRaises(WebBoundaryError):
                with sessions.acquire("b", KEY): pass
        clock[0] = 31
        with sessions.acquire("b", KEY): pass
        self.assertEqual(len(sessions.states), 0)

    def test_portable_source_integrity_and_text(self):
        raw = '合成职位：负责产品设计。'.encode()
        value = {"runtime_snapshot": own_request(FIXTURE["request"])["runtime_snapshot"], "material_type": "JOB",
                 "source_document_id": "source-job-synthetic", "filename": "synthetic.txt", "media_type": "text/plain",
                 "expected_content_hash": "sha256:" + hashlib.sha256(raw).hexdigest(),
                 "document_data_url": "data:text/plain;base64," + base64.b64encode(raw).decode()}
        result = read_source(value)
        self.assertEqual(result["extracted_text"], raw.decode())
        self.assertFalse(result["model_call_made"])
        value["expected_content_hash"] = "sha256:incorrect"
        with self.assertRaises(ValueError): read_source(value)

    def test_six_real_domain_contracts_reach_own_key_transport(self):
        specs = [("candidate_model_runtime_regression.py", "request", "candidate-model-structure"),
                 ("job_model_import_regression.py", "request", "job-model-structure"),
                 ("candidate_conversation_runtime_regression.py", "request_for", "candidate-conversation-turn"),
                 ("job_conversation_runtime_regression.py", "request", "job-conversation-turn"),
                 ("personal_understanding_runtime_regression.py", "request", "personal-understanding-turn"),
                 ("job_overview_runtime_regression.py", "request", "job-overview-turn")]
        for file, name, route in specs:
            with contextlib.redirect_stdout(io.StringIO()):
                fixture = runpy.run_path(str(Path(__file__).with_name(file)))
            request = own_request(fixture[name])
            with patch.object(app, "render_complete_pdf_pages", return_value=[("1", b"synthetic-image")]), \
                 patch.object(app, "call_ariadne_model", side_effect=RuntimeError("synthetic transport stop")) as transport:
                invoke(self.web, "/api/" + route, request)
                self.assertEqual(transport.call_count, 1, route)
                self.assertEqual(transport.call_args.args[0], KEY)


if __name__ == "__main__":
    unittest.main()
