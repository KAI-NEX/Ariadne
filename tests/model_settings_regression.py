"""Settings execution, historical read compatibility, and optional synthetic live smoke."""
import copy
import json
from pathlib import Path
import sys
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.model_settings import envelope, validate, apply_execution_settings
from src.runtime_binding import CODEX_MODEL, CODEX_CREDENTIAL
from src.codex_runtime import command, call_codex
from src.candidate_model_runtime import runtime_fingerprint

for effort in ("low", "medium", "high"):
    settings = envelope("codex", CODEX_MODEL, {"reasoning_effort": effort})
    snapshot = {"provider": "codex", "model": CODEX_MODEL, "execution_settings": settings}
    payload = apply_execution_settings({"model": CODEX_MODEL}, snapshot)
    assert payload["reasoning_effort"] == effort
    args = command(Path("/tmp"), [], reasoning_effort=payload["reasoning_effort"])
    assert f'model_reasoning_effort="{effort}"' in args
    assert "--ignore-user-config" in args and "--ignore-rules" in args and "read-only" in args
    changed = copy.deepcopy(snapshot); changed["execution_settings"]["selection_revision"] = "other"
    assert runtime_fingerprint(snapshot) == runtime_fingerprint(changed)
    changed["execution_settings"]["effective_settings"]["reasoning_effort"] = "high" if effort != "high" else "low"
    assert runtime_fingerprint(snapshot) != runtime_fingerprint(changed)
for invalid in (None, {}, {"reasoning_effort": "ultra"}, {"reasoning_effort": "low", "temperature": 0}):
    value = envelope("codex", CODEX_MODEL, invalid) if invalid is not None else None
    try: validate(value, "codex", CODEX_MODEL)
    except ValueError: pass
    else: raise AssertionError("invalid settings accepted")
deepseek = {"provider": "deepseek", "model": "deepseek-flash"}
deepseek["execution_settings"] = envelope(**deepseek)
assert apply_execution_settings({"model": deepseek["model"]}, deepseek) == {"model": deepseek["model"]}
with patch("src.codex_runtime.subprocess.Popen") as process, patch("src.codex_runtime.codex_enabled", return_value=True):
    try: call_codex(CODEX_CREDENTIAL, {"model": CODEX_MODEL})
    except ValueError as error: assert str(error) == "CODEX_REASONING_EFFORT_INVALID"
    else: raise AssertionError("missing settings executed")
    process.assert_not_called()
print("settings_validation_actual_cli_arguments_cache=PASS", flush=True)

if "--live" in sys.argv:
    for effort in ("low", "medium", "high"):
        # Invented, non-personal text only. This is a transport/settings smoke, not a new visual qualification.
        snapshot = {"provider": "codex", "model": CODEX_MODEL, "execution_settings": envelope("codex", CODEX_MODEL, {"reasoning_effort": effort})}
        payload = apply_execution_settings({"model": CODEX_MODEL, "messages": [{"role": "user", "content": 'Synthetic transport check. Return JSON {"status":"ok"} only.'}], "response_format": {"type": "json_object"}}, snapshot)
        status, response = call_codex(CODEX_CREDENTIAL, payload)
        assert status == 200 and json.loads(response["choices"][0]["message"]["content"])["status"] == "ok"
        print(json.dumps({"model": CODEX_MODEL, "requested_effort": effort, "live_transport": "PASS"}), flush=True)
