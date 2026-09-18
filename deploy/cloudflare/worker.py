"""Python Workers entry; Pages forwards /api/* using a service binding.

One Durable Object owns each origin/session/provider/key namespace. Only hashed
inference receipts are durable; keys, uploads and model answers remain transient.
Existing WSGI/domain code owns request validation and human-save boundaries.
"""
import os
os.environ["ARIADNE_CODEX_ENABLED"] = "0"

import hashlib
import io
import json
import logging
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse

from workers import WorkerEntrypoint, DurableObject, Response, wsgi
from pyodide.ffi import run_sync, to_js
import js

import app
from web_app import WebApplication, CHECK_PATHS, POST_PATHS, CONTROL_PATHS
from src.byok_providers import valid_key, PROVIDERS
from src.runtime_transport import PROVIDER_HTTP_OPEN
from src.pdf_delivery import PDF_RENDERER
from src.browser_pdf_delivery import BrowserPDFDelivery
from src.web_execution import WebBoundaryError

MAX_REQUEST = 12 * 1024 * 1024
ENDPOINTS = {app.DEEPSEEK_ENDPOINT, app.DEEPSEEK_MODELS_ENDPOINT, *(item["endpoint"] for item in PROVIDERS.values())}
logging.getLogger("pypdf").setLevel(logging.CRITICAL)


def error(code, status=400, network=False):
    return Response.json({"error": code, "network_call_made": network, "persistence": "not_written"},
                         status=status, headers={"Cache-Control": "no-store"})


def origins(env):
    return [value.strip().rstrip("/") for value in env.ARIADNE_WEB_ORIGINS.split(",") if value.strip()]


def allowed(request, env):
    url = urlparse(request.url)
    origin = f"{url.scheme}://{url.netloc}"
    return (origin in origins(env) and not url.query and not url.username
            and request.headers.get("Origin", origin) == origin
            and request.headers.get("Sec-Fetch-Site") != "cross-site")


async def read_body(request):
    chunks, size = [], 0
    if request.body:
        async for chunk in request.body:
            raw = chunk.to_bytes()
            size += len(raw)
            if size > MAX_REQUEST:
                raise ValueError("WEB_REQUEST_SIZE_INVALID")
            chunks.append(raw)
    return b"".join(chunks)


def namespace(request, body):
    path = urlparse(request.url).path
    provider = CHECK_PATHS.get(path, request.headers.get("X-Ariadne-Provider", "deepseek"))
    session = request.headers.get("X-Ariadne-Web-Session", "")
    if not re.fullmatch(r"[a-f0-9]{64}", session) or provider not in {"deepseek", "gemini", "qwen"}:
        raise ValueError("WEB_SESSION_REQUIRED")
    payload = json.loads(body)
    if not isinstance(payload, dict):
        raise ValueError("WEB_JSON_INVALID")
    key = payload.get("api_key") if path in CHECK_PATHS else request.headers.get("X-Ariadne-Provider-Key")
    if not valid_key(key):
        raise ValueError("WEB_OWN_API_KEY_REQUIRED")
    origin = request.headers.get("Origin", "")
    return hashlib.sha256((origin + "\0" + session + "\0" + provider + "\0" + key).encode()).hexdigest()


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        if not allowed(request, self.env):
            return error("WEB_ORIGIN_DENIED", 403)
        path = urlparse(request.url).path
        if request.method in {"GET", "HEAD"}:
            if path == "/api/web-runtime":
                return Response.json({"mode": "web", "byok": ["deepseek", "gemini", "qwen"], "storage": "browser",
                    "preview": True, "pdf_preparation": "browser_pdfjs_complete_pages_v1", "request_limit": MAX_REQUEST,
                    "network_call_made": False}, headers={"Cache-Control": "no-store"})
            return await wsgi.fetch(WebApplication(origins(self.env)), request, self.env)
        if request.method != "POST" or path not in POST_PATHS:
            return error("WEB_ROUTE_DENIED", 404)
        if request.headers.get("Origin") not in origins(self.env):
            return error("WEB_ORIGIN_REQUIRED", 403)
        if request.headers.get("Content-Type", "").split(";", 1)[0].lower() != "application/json":
            return error("WEB_JSON_REQUIRED", 415)
        try:
            body = await read_body(request)
            name = namespace(request, body)
        except (ValueError, TypeError, UnicodeError):
            return error("WEB_REQUEST_OR_CREDENTIAL_INVALID", 400)
        forwarded = js.Request.new(request.url, to_js({"method": "POST", "headers": dict(request.headers.items()),
            "body": body}, dict_converter=js.Object.fromEntries))
        stub = self.env.EXECUTIONS.get(self.env.EXECUTIONS.idFromName(name))
        return await stub.fetch(forwarded)


class ProviderResponse(io.BytesIO):
    def __init__(self, data, status):
        super().__init__(data)
        self.status = status


class ExecutionSession(DurableObject):
    def __init__(self, ctx, env):
        self.ctx, self.env = ctx, env
        self.application = WebApplication(origins(env))
        self.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS receipts (identity TEXT PRIMARY KEY, fingerprint TEXT NOT NULL)")
        self.active = 0

    async def fetch(self, request):
        if not allowed(request, self.env):
            return error("WEB_ORIGIN_DENIED", 403)
        path = urlparse(request.url).path
        control = path in CONTROL_PATHS
        if self.active >= 2 and not control:
            return error("WEB_SESSION_BUSY", 429)
        self.active += 1
        try:
            raw = await read_body(request)
            payload = json.loads(raw)
            if not isinstance(payload, dict):
                return error("WEB_JSON_INVALID")
            prepared = payload.pop("_cloudflare_pdf_pages", [])
            renderer = BrowserPDFDelivery(prepared)
            clean = json.dumps(payload, ensure_ascii=False).encode()
            fingerprint = hashlib.sha256(clean).hexdigest()
            operation = payload.get("operation_identity") or {}
            if not isinstance(operation, dict):
                return error("WEB_OPERATION_IDENTITY_INVALID", 422)
            identity = operation.get("operation_id")
            if not identity:
                turn = payload.get("turn") or {}
                if not isinstance(turn, dict):
                    return error("WEB_OPERATION_IDENTITY_INVALID", 422)
                identity = payload.get("request_id") or (f"{turn.get('execution_id')}:{turn.get('generation')}" if turn.get("execution_id") else None)
            receipt = hashlib.sha256((path + "\0" + identity).encode()).hexdigest() if isinstance(identity, str) else None

            async def provider_open_async(outbound, timeout):
                if outbound.full_url not in ENDPOINTS or outbound.get_method() not in {"GET", "POST"}:
                    raise ValueError("PROVIDER_ENDPOINT_DENIED")
                # Replays after eviction are refused even though transient answers
                # were lost. No background retry can spend another API request.
                if outbound.get_method() == "POST" and receipt:
                    rows = list(self.ctx.storage.sql.exec("SELECT fingerprint FROM receipts WHERE identity = ?", receipt))
                    if rows:
                        code = "WEB_RESULT_EXPIRED_REVIEW_BEFORE_RETRY" if rows[0].fingerprint == fingerprint else "WEB_OPERATION_CONTENT_CONFLICT"
                        raise WebBoundaryError(code, 409)
                    count = self.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM receipts").one().n
                    if count >= 256:
                        raise WebBoundaryError("WEB_SESSION_OPERATION_LIMIT", 429)
                    self.ctx.storage.sql.exec("INSERT INTO receipts VALUES (?, ?)", receipt, fingerprint)
                options = {"method": outbound.get_method(), "headers": dict(outbound.header_items()),
                    "redirect": "manual", "signal": js.AbortSignal.timeout(int(timeout * 1000))}
                if outbound.data is not None:
                    options["body"] = outbound.data
                try:
                    response = await js.fetch(outbound.full_url, to_js(options, dict_converter=js.Object.fromEntries))
                    if response.status != 200:
                        await response.body.cancel()
                        raise HTTPError(outbound.full_url, response.status, "PROVIDER_HTTP_ERROR", {}, None)
                    reader = response.body.getReader()
                    chunks, size = [], 0
                    try:
                        while True:
                            part = await reader.read()
                            if part.done:
                                break
                            chunk = part.value.to_bytes()
                            size += len(chunk)
                            if size > 8_000_000:
                                await reader.cancel()
                                raise ValueError("PROVIDER_RESPONSE_TOO_LARGE")
                            chunks.append(chunk)
                    finally:
                        reader.releaseLock()
                    return ProviderResponse(b"".join(chunks), response.status)
                except (HTTPError, ValueError):
                    raise
                except Exception:
                    raise URLError("PROVIDER_NETWORK_FAILED") from None

            def provider_open(outbound, *, timeout):
                return run_sync(provider_open_async(outbound, timeout))

            provider_token = PROVIDER_HTTP_OPEN.set(provider_open)
            pdf_token = PDF_RENDERER.set(renderer)
            try:
                def application(environ, start_response):
                    environ["wsgi.input"] = io.BytesIO(clean)
                    environ["CONTENT_LENGTH"] = str(len(clean))
                    return self.application(environ, start_response)
                return await wsgi.fetch(application, request, self.env)
            finally:
                PDF_RENDERER.reset(pdf_token)
                PROVIDER_HTTP_OPEN.reset(provider_token)
        except (ValueError, TypeError, KeyError, UnicodeError):
            return error("WEB_REQUEST_OR_PDF_INVALID", 422)
        finally:
            self.active -= 1
