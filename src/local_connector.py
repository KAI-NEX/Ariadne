"""Origin-bound, revocable loopback access to the Ariadne semantic endpoints.

No Codex control socket, arbitrary proxy, credential endpoints, or filesystem
API is exposed. A one-use pairing code is generated in the local terminal.
"""
import hashlib
import hmac
import json
import io
import secrets
import threading
import time
from urllib.parse import urlparse

GET_PATHS = frozenset({
    "/api/conversation-attachment-capabilities",
    "/api/runtime-options", "/api/candidate-conversation-runtime-signature",
    "/api/job-conversation-runtime-signature", "/api/job-model-import-runtime-signature",
    "/api/personal-understanding-signature", "/api/job-overview-signature",
})
POST_PATHS = frozenset({
    "/api/candidate-model-structure", "/api/job-model-structure",
    "/api/candidate-conversation-turn", "/api/candidate-conversation-turn/cancel",
    "/api/job-conversation-turn", "/api/personal-understanding-turn", "/api/job-overview-turn",
    "/api/local-source-read", "/api/local-ocr-capability",
    "/api/local-candidate-extract", "/api/local-candidate-image-ocr", "/api/local-candidate-structure",
    "/api/local-job-extract", "/api/local-job-image-ocr",
    "/api/candidate-model-operation-state/delete",
})


class Pairing:
    def __init__(self, origin, code=None, *, clock=time.monotonic):
        parsed = urlparse(origin)
        if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost"}):
            raise ValueError("Connector requires HTTPS or loopback development origin")
        if parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password or not parsed.netloc:
            raise ValueError("Use an exact origin without path or credentials")
        self.origin, self.clock = origin, clock
        self.code = code or secrets.token_urlsafe(24)
        self.deadline = clock() + 300
        self.token_hash, self.expires = None, 0
        self.failures = 0
        self.lock = threading.Lock()

    def pair(self, code):
        with self.lock:
            if not self.code or self.clock() > self.deadline or self.failures >= 5:
                raise ValueError("CONNECTOR_PAIRING_EXPIRED")
            if not isinstance(code, str) or not hmac.compare_digest(self.code, code):
                self.failures += 1
                raise ValueError("CONNECTOR_PAIRING_INVALID")
            token = secrets.token_urlsafe(32)
            self.token_hash = hashlib.sha256(token.encode()).digest()
            self.expires, self.code = self.clock() + 8 * 3600, None
            return token

    def authorized(self, token):
        with self.lock:
            return bool(self.token_hash and self.clock() < self.expires and isinstance(token, str)
                        and hmac.compare_digest(self.token_hash, hashlib.sha256(token.encode()).digest()))

    def revoke(self):
        with self.lock:
            self.token_hash = None


def connector_handler(base_handler):
    class ConnectorHandler(base_handler):
        connector_authorized = False

        def log_message(self, *args):
            # Request paths, headers and bodies need not enter connector logs.
            pass

        def end_headers(self):
            origin = self.headers.get("Origin")
            if origin == self.server.pairing.origin:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Ariadne-Connector")
                self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def boundary(self, preflight=False):
            if (self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}"
                or self.headers.get("Origin") != self.server.pairing.origin
                or urlparse(self.path).query or urlparse(self.path).fragment):
                self.send_json(403, {"error": "CONNECTOR_ORIGIN_DENIED", "network_call_made": False})
                return False
            path = self.path
            method = self.headers.get("Access-Control-Request-Method") if preflight else self.command
            allowed = (GET_PATHS if method == "GET" else POST_PATHS | {"/api/connector/pair", "/api/connector/revoke"} if method == "POST" else set())
            if path not in allowed:
                self.send_json(404, {"error": "CONNECTOR_ROUTE_DENIED", "network_call_made": False})
                return False
            if not preflight and path != "/api/connector/pair" and not self.server.pairing.authorized(self.headers.get("X-Ariadne-Connector")):
                self.send_json(401, {"error": "CONNECTOR_PAIRING_REQUIRED", "network_call_made": False})
                return False
            return True

        def do_OPTIONS(self):
            if self.boundary(preflight=True):
                self.send_response(204); self.end_headers()

        def do_GET(self):
            if self.boundary():
                self.connector_authorized = True
                super().do_GET()

        def do_HEAD(self):
            self.boundary()  # HEAD is outside the connector allowlist.

        def runtime_options(self):
            # Paired web clients may select Codex only. The local application's
            # other configured providers and credentials are outside this grant.
            from src.runtime_binding import CODEX_MODEL, CODEX_PROTOCOL
            from src.provider_runtime import deepseek_model_descriptors
            descriptor = deepseek_model_descriptors(["deepseek-v4-flash-vision-exp"])[0].to_public_dict()
            descriptor.update(provider_id="codex", model_id=CODEX_MODEL, display_name=f"Codex · {CODEX_MODEL}",
                protocol=CODEX_PROTOCOL, adapter_version="codex-candidate-multimodal-v2",
                discovery_source="ariadne_codex_qualification_2026-09-09")
            self.send_json(200, {"provider": "codex", "models": [descriptor], "network_call_made": False, "career_data_sent": False})

        def do_POST(self):
            if not self.boundary():
                return
            self.connector_authorized = True
            if self.path == "/api/connector/revoke":
                self.server.pairing.revoke()
                self.send_json(200, {"revoked": True, "network_call_made": False})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 0 or length > 72_000_000:
                    raise ValueError("CONNECTOR_REQUEST_LIMIT")
                if length and self.headers.get_content_type() != "application/json":
                    raise ValueError("CONNECTOR_JSON_REQUIRED")
                if self.path == "/api/connector/pair":
                    if not 0 < length <= 256:
                        raise ValueError("CONNECTOR_PAIRING_INVALID")
                    payload = json.loads(self.rfile.read(length))
                    if set(payload) != {"code"}:
                        raise ValueError("CONNECTOR_PAIRING_INVALID")
                    token = self.server.pairing.pair(payload["code"])
                    self.send_json(200, {"token": token, "expires_in": 28800, "network_call_made": False})
                    return
                if self.path in {"/api/candidate-model-structure", "/api/job-model-structure", "/api/candidate-conversation-turn",
                                 "/api/job-conversation-turn", "/api/personal-understanding-turn", "/api/job-overview-turn"}:
                    raw = self.rfile.read(length)
                    payload = json.loads(raw)
                    if not isinstance(payload, dict):
                        raise ValueError("CONNECTOR_REQUEST_INVALID")
                    runtime = payload.get("runtime_snapshot", {})
                    if not isinstance(runtime, dict) or runtime.get("provider") != "codex" or runtime.get("mode") != "model":
                        raise ValueError("CONNECTOR_CODEX_ONLY")
                    self.rfile = io.BytesIO(raw)
            except (ValueError, TypeError, UnicodeDecodeError):
                self.send_json(400, {"error": "CONNECTOR_REQUEST_INVALID", "network_call_made": False})
                return
            super().do_POST()

    return ConnectorHandler
