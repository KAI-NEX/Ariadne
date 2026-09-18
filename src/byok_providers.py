"""Fixed-endpoint Gemini/Qwen transports for the shared domain contracts.

Only request-owned credentials are accepted. No SDK, ambient key, redirect,
arbitrary endpoint, model substitution or automatic paid retry is used here.
"""
from dataclasses import dataclass, field
import copy
import json
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener

PROVIDERS = {
    "gemini": {"model": "gemini-3.7-flash", "endpoint": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"},
    "qwen": {"model": "qwen3.8-max", "endpoint": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"},
}
BROWSER_REFERENCES = {f"browser-key://{provider}/request": provider for provider in ("deepseek", *PROVIDERS)}


def valid_key(value):
    return isinstance(value, str) and 12 <= len(value) <= 2000 and value.isascii() and not any(c.isspace() for c in value)


@dataclass(frozen=True)
class RequestCredential:
    provider: str
    key: str = field(repr=False)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise HTTPError(req.full_url, code, "PROVIDER_REDIRECT_DENIED", headers, fp)


HTTP = build_opener(NoRedirect())


def provider_payload(credential, payload):
    provider = PROVIDERS.get(credential.provider)
    if not provider or payload.get("model") != provider["model"] or not valid_key(credential.key):
        raise ValueError("PROVIDER_CREDENTIAL_MODEL_MISMATCH")
    result = copy.deepcopy(payload)
    result.pop("thinking", None)  # DeepSeek-specific request parameter.
    if credential.provider == "qwen":
        result["enable_thinking"] = False
    else:
        # Gemini 3 cannot disable thinking. Its documented low effort keeps the
        # response budget bounded without forwarding DeepSeek's off switch.
        result["reasoning_effort"] = "low"
        result["max_tokens"] = max(8192, result.get("max_tokens", 0))
    return result


def call_provider(credential, payload, *, response_limit, timeout=240):
    body = provider_payload(credential, payload)
    request = Request(PROVIDERS[credential.provider]["endpoint"],
                      data=json.dumps(body, ensure_ascii=False).encode(),
                      headers={"Authorization": f"Bearer {credential.key}", "Content-Type": "application/json"}, method="POST")
    with HTTP.open(request, timeout=timeout) as response:
        raw = response.read(response_limit + 1)
        if len(raw) > response_limit:
            raise ValueError("PROVIDER_RESPONSE_TOO_LARGE")
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError("PROVIDER_RESPONSE_MALFORMED")
        return response.status, result


def visual_check_payload(provider, pages):
    import base64
    if provider not in PROVIDERS or len(pages) != 2 or [p[0] for p in pages] != ["1", "2"]:
        raise ValueError("PROVIDER_VISUAL_CHECK_INCOMPLETE")
    return {
        "model": PROVIDERS[provider]["model"],
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": 'Read the large text on each of these two pages in order. Return JSON only: {"pages":["first page text","second page text"]}.'},
            *[{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(raw).decode()}} for _, raw in pages],
        ]}], "response_format": {"type": "json_object"}, "temperature": 0, "max_tokens": 256,
    }


def visual_check_passed(provider, result):
    try:
        choice = result["choices"][0]
        return (result["model"] == PROVIDERS[provider]["model"] and choice["finish_reason"] == "stop"
                and not choice["message"].get("refusal")
                and json.loads(choice["message"]["content"]) == {"pages": ["ARIADNE PAGE ONE", "ARIADNE PAGE TWO"]})
    except (KeyError, IndexError, TypeError, ValueError):
        return False
