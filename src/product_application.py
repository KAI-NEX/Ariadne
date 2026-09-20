"""Composition boundary: shared domains, separate Web and Skill products."""
import io
import json
from urllib.parse import urlparse

from src.runtime_binding import CODEX_MODEL, codex_enabled

WEB_CONFIG = {"kind": "web", "storage": "browser", "providers": ["deepseek", "gemini", "qwen"]}
MODEL_PATHS = frozenset({
    "/api/candidate-model-structure", "/api/job-model-structure",
    "/api/candidate-conversation-turn", "/api/job-conversation-turn",
    "/api/personal-understanding-turn", "/api/job-overview-turn", "/api/local-source-read",
})


def config_script(config):
    return ("globalThis.AriadneProductConfig = Object.freeze(" + json.dumps(config) + ");\n").encode()


def skill_handler(base):
    class SkillHandler(base):
        def read_local_source_for_model(self):
            from src.web_source_read import read_portable_source
            return read_portable_source(self)

        def do_GET(self):
            if not self.local_request_allowed():
                return
            path = urlparse(self.path).path
            if path == "/product-config.js":
                body = config_script({"kind": "skill", "storage": "filesystem", "providers": ["codex"],
                    "runtime": {"mode": "model", "provider": "codex", "model": CODEX_MODEL},
                    "agent_ready": codex_enabled()})
                self.send_response(200)
                self.send_header("Content-Type", "application/javascript; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if path in {"/", "/index.html", "/codex-connect.html", "/gemini-connect.html"}:
                self.send_response(302)
                self.send_header("Location", "/workspace.html")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            if path == "/api/skill-runtime":
                self.send_json(200, {"product": "ariadne-skill", "mode": "local-ui"})
                return
            if path == "/api/model-updates":
                self.send_json(200, {"ok": True, "models": [], "network_call_made": False})
                return
            super().do_GET()

        def runtime_options(self):
            # Reuse qualified descriptors; API services do not enter this product.
            original = self.send_json
            def filtered(status, value):
                value = {**value, "provider": "codex", "local_preference": None,
                         "models": [item for item in value.get("models", []) if item["provider_id"] == "codex"]}
                original(status, value)
            self.send_json = filtered
            try:
                super().runtime_options()
            finally:
                self.send_json = original

        def do_POST(self):
            if not self.local_request_allowed():
                return
            path = urlparse(self.path).path
            if path.startswith("/api/runtime-") or path in {"/api/model-updates/verify", "/api/local-vision-config", "/api/ai-career-ingestion-config"}:
                self.send_json(403, {"error": "SKILL_AGENT_ONLY", "network_call_made": False})
                return
            original_input = None
            if path in MODEL_PATHS:
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    if not 0 < length <= 41_000_000:
                        raise ValueError()
                    body = self.rfile.read(length)
                    payload = json.loads(body)
                    snapshot = payload.get("runtime_snapshot", {})
                    if snapshot.get("provider") != "codex" or snapshot.get("model") != CODEX_MODEL:
                        self.send_json(422, {"error": "SKILL_AGENT_ONLY", "network_call_made": False})
                        return
                    if not codex_enabled():
                        self.send_json(503, {"error": "SKILL_AGENT_UNAVAILABLE", "network_call_made": False})
                        return
                    original_input = self.rfile
                    self.rfile = io.BytesIO(body)
                except (ValueError, TypeError, AttributeError):
                    self.send_json(400, {"error": "SKILL_REQUEST_INVALID", "network_call_made": False})
                    return
            try:
                super().do_POST()
            finally:
                if original_input is not None:
                    self.rfile = original_input
    return SkillHandler
