"""Offline contract checks for the data-free DeepSeek runtime connection path."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app


class FakeResponse:
    def __init__(self, payload): self.payload = payload
    def read(self, _limit): return json.dumps(self.payload).encode("utf-8")
    def __enter__(self): return self
    def __exit__(self, *_args): return False


calls = []
original_key, original_urlopen = app.read_deepseek_key, app.urlopen
app.read_deepseek_key = lambda: "test-key"

def fake_urlopen(request, timeout):
    calls.append((request.full_url, timeout))
    if request.full_url == app.DEEPSEEK_MODELS_ENDPOINT:
        return FakeResponse({"data": [{"id": "deepseek-v4-flash"}, {"id": "deepseek-flash"}]})
    if request.full_url == "https://api.deepseek.com/responses":
        payload = json.loads(request.data.decode("utf-8"))
        assert payload["input"] == "connection test"
        assert payload["reasoning"] == {"effort": "none"}
        assert payload["max_output_tokens"] == 16
        return FakeResponse({"id": "connection-test-response", "output_text": "OK", "usage": {"input_tokens": 3, "output_tokens": 1, "total_tokens": 4}})
    assert request.full_url == "https://api.deepseek.com/chat/completions"
    payload = json.loads(request.data.decode("utf-8"))
    parts = payload["messages"][0]["content"]
    assert parts[0]["text"] == "Read the text in this image. Reply only with the text you see."
    assert parts[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert payload["max_tokens"] == 32
    return FakeResponse({"id": "vision-test-response", "choices": [{"message": {"content": "JOB RADAR TEST"}}]})

app.urlopen = fake_urlopen
try:
    available = app.deepseek_runtime_models()
    assert available["ok"] and available["models"] == ["deepseek-v4-flash", "deepseek-flash"]
    assert available["descriptors"][0].protocol == "OPENAI_RESPONSES"
    before = len(calls)
    for model in ["deepseek-v4-flash", "deepseek-v4-pro", "invented-vision"]:
        result = app.deepseek_runtime_connection_check(model)
        assert not result["ok"] and result["error"] == "runtime_requires_image_and_pdf"
        assert result["network_call_made"] is False and len(calls) == before
    experimental = app.deepseek_runtime_connection_check("deepseek-flash", "data:image/jpeg;base64,ZmFrZQ==")
    assert experimental["ok"] and experimental["diagnostics"]["purpose"] == "MULTIMODAL_CONNECTION_TEST"
    assert experimental["diagnostics"]["multimodal_connection_ready"] is True
    assert experimental["diagnostics"]["structured_output_verified"] is False
    text_only_vision = app.deepseek_runtime_connection_check("deepseek-flash")
    assert text_only_vision["ok"] and text_only_vision["diagnostics"]["multimodal_connection_ready"]
    unavailable = app.deepseek_runtime_connection_check("invented-model")
    assert not unavailable["ok"] and unavailable["failure_layer"] == "capability"
finally:
    app.read_deepseek_key, app.urlopen = original_key, original_urlopen

app.read_deepseek_key = lambda: None
try:
    missing = app.deepseek_runtime_models()
    assert not missing["ok"] and missing["failure_layer"] == "credential" and not missing["network_call_made"]
finally:
    app.read_deepseek_key = original_key

assert calls.count((app.DEEPSEEK_MODELS_ENDPOINT, 30)) >= 3
assert ("https://api.deepseek.com/responses", 60) not in calls
print("runtime_connection_contract=pass")
