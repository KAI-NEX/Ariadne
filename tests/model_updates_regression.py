"""Offline update qualification, historical identity and HTTP consent boundaries."""
import copy
import io
import json
from pathlib import Path
import sys
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app
from src.model_updates import ModelUpdates, catalog_entry, synthetic_pdf
from src.model_settings import envelope, validate
from src.runtime_binding import valid_binding, DEEPSEEK_CREDENTIAL
from types import SimpleNamespace

MODEL = "deepseek-flash"
OLD = "deepseek-v4-flash-vision-exp"
REV = catalog_entry(MODEL)["descriptor_revision"]
clock = Mock(return_value=1000)
updates = ModelUpdates(clock)
listing = Mock(return_value={"ok": True, "models": [MODEL, OLD, "deepseek-v4-pro", "deepseek-future"]})
found = updates.discover(listing)
assert [x["model"] for x in found["models"]] == [MODEL, "deepseek-future"]
assert found["models"][0]["can_verify"] is True
assert found["models"][1]["status"] == "ADAPTER_REQUIRED"
assert updates.discover(listing)["cached"] and listing.call_count == 1
assert updates.discover(listing)["network_call_made"] is False
found["models"].clear()
assert len(updates.discover(listing)["models"]) == 2
clock.return_value += 901
listing.return_value = {"ok": False, "network_call_made": False}
assert updates.discover(listing)["ok"] is False
listing.return_value = {"ok": True, "models": [MODEL]}
response = {"model": MODEL, "choices": [{"finish_reason": "tool_calls", "message": {"tool_calls": [
    {"function": {"name": "verify_visual_reading", "arguments": json.dumps({"readings": ["JOB RADAR TEST", "ARIADNE PAGE ONE", "ARIADNE PAGE TWO"]})}}
]}}]}
provider = Mock(return_value=(200, response))

def verify(model=MODEL, revision=REV):
    return updates.verify(model, revision, listing, "data:image/jpeg;base64,c3ludGhldGlj", provider)

def rejected(code, fn=verify):
    try: fn()
    except ValueError as error: assert str(error) == code, str(error)
    else: raise AssertionError("unsafe verification accepted")

with patch("src.model_updates.render_complete_pdf_pages", return_value=[("1", b"page1"), ("2", b"page2")]) as render:
    assert verify()["career_data_sent"] is False
    payload = provider.call_args.args[0]
    assert len([p for p in payload["messages"][0]["content"] if p["type"] == "image_url"]) == 3
    assert b"/Count 2" in render.call_args.args[0] and b"ARIADNE PAGE TWO" in synthetic_pdf()
    provider.reset_mock()
    rejected("MODEL_ADAPTER_REQUIRED", lambda: verify("deepseek-future"))
    rejected("MODEL_ADAPTER_REQUIRED", lambda: verify(revision="stale"))
    rejected("MODEL_ADAPTER_REQUIRED", lambda: verify(OLD))
    provider.assert_not_called()
    updates.verifying.add(MODEL)
    rejected("MODEL_VERIFICATION_BUSY")
    updates.verifying.clear()
    listing.return_value = {"ok": True, "models": []}
    rejected("MODEL_NO_LONGER_AVAILABLE")
    provider.assert_not_called()
    listing.return_value = {"ok": True, "models": [MODEL]}
    render.return_value = [("1", b"page1")]
    rejected("MODEL_PDF_DELIVERY_FAILED")
    render.return_value = [("1", b"page1"), ("2", b"page2")]
    for field in ("model", "finish", "content", "http"):
        invalid = copy.deepcopy(response)
        if field == "model": invalid["model"] = OLD
        if field == "finish": invalid["choices"][0]["finish_reason"] = "length"
        if field == "content": invalid["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"] = '{}'
        provider.return_value = (502 if field == "http" else 200, invalid)
        rejected("MODEL_VERIFICATION_FAILED")
        assert not updates.verifying

old_settings = envelope("deepseek", OLD)
assert validate(old_settings, "deepseek", OLD) == old_settings
assert old_settings["descriptor_revision"] != envelope("deepseek", MODEL)["descriptor_revision"]
assert not valid_binding(SimpleNamespace(provider="deepseek", model=OLD, protocol="OPENAI_CHAT_COMPLETIONS",
    credential_ref=DEEPSEEK_CREDENTIAL, adapter_version="deepseek-candidate-multimodal-v2", execution_settings=old_settings), "deepseek-candidate-multimodal-v2")

class Handler:
    def __init__(self, value):
        raw = json.dumps(value).encode()
        self.headers = {"Content-Length": str(len(raw))}; self.rfile = io.BytesIO(raw)
    def send_json(self, status, value): self.result = (status, value)

with patch.object(app.MODEL_UPDATES, "verify", return_value={"ok": True}) as verify_endpoint:
    for value in ({}, {"provider": "deepseek", "model": MODEL, "revision": REV, "confirmed": False},
                  {"provider": "deepseek", "model": MODEL, "revision": REV, "confirmed": True, "source": "not allowed"}):
        handler = Handler(value); app.JobRadarHandler.verify_model_update(handler)
        assert handler.result[0] == 422
    verify_endpoint.assert_not_called()
    handler = Handler({"provider": "deepseek", "model": MODEL, "revision": REV, "confirmed": True})
    app.JobRadarHandler.verify_model_update(handler)
    assert handler.result[0] == 200 and verify_endpoint.call_count == 1
print("model_updates_discovery_validation_history_consent=PASS")
