"""Contract checks for the one-time Qwen multimodal connection check."""
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
original_urlopen = app.urlopen


def fake_urlopen(request, timeout):
    calls.append((request.full_url, timeout, request.get_header("Authorization")))
    payload = json.loads(request.data.decode("utf-8"))
    assert payload["model"] == "qwen3.8-max"
    assert payload["messages"][0]["content"][0]["text"] == "Read the text in this image. Reply only with the text you see."
    assert payload["messages"][0]["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert payload["max_tokens"] == 32
    return FakeResponse({"choices": [{"message": {"content": "JOB RADAR TEST"}}]})


app.urlopen = fake_urlopen
try:
    result = app.qwen_runtime_connection_check("k" * 20)
    assert result["ok"] and result["models"] == ["qwen3.8-max"]
    assert result["verified_model_id"] == "qwen3.8-max"
    assert calls[0][0] == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    assert calls[0][1] == 30 and calls[0][2] == "Bearer " + "k" * 20
finally:
    app.urlopen = original_urlopen

assert not app.qwen_runtime_connection_check("short")["network_call_made"]
print("qwen_runtime_connection_contract=pass")
