"""Job-only runtime, fail-closed Provider boundary, and grounded read-only output."""
import copy
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.job_overview_runtime import (MODEL, TOOL, JobOverviewError, validate_request,
    validate_output, build_payload, execute, signature, prompt)
from src.personal_understanding_runtime import prompt as personal_prompt

request = json.loads(subprocess.check_output([os.environ.get("ARIADNE_NODE_BINARY", "node"), str(ROOT / "tests/job_overview_regression.mjs"), "--request"], text=True))
validate_request(request)
assert signature()["operation"] == "JOB_OVERVIEW_TURN"
payload = build_payload(request)
assert payload["model"] == MODEL
assert "No Candidate profile or personal memory is provided" in prompt("DISCUSS")
assert "past projects" in personal_prompt("DISCUSS")
assert "credential_ref" not in json.dumps(payload)
assert "source_document_id" not in json.dumps(payload)
assert payload["tools"][0]["function"]["strict"] is True
output = {"summary": "这些职位有不同侧重。", "insights": [{"text": "此职位关注用户研究。", "evidence_refs": [request["context"]["evidence"][0]["ref"]]}], "uncertainties": []}
counts = {"credentials": 0, "provider": 0}

def credential():
    counts["credentials"] += 1
    return "synthetic-secret"

def provider(key, value):
    assert key == "synthetic-secret"
    counts["provider"] += 1
    return 200, {"model": MODEL, "choices": [{"finish_reason": "tool_calls", "message": {"tool_calls": [{"function": {"name": TOOL, "arguments": json.dumps(output)}}]}}], "usage": {"prompt_tokens": 10, "private": "ignored"}}

def rejected(fn, code=None):
    try:
        fn()
    except JobOverviewError as error:
        if code: assert error.code == code, error.code
    else:
        raise AssertionError("unsafe input/output accepted")

result = execute(request, credential, provider)
assert result["persistence"] == "not_written"
assert result["authority"] == "NON_AUTHORITATIVE_JOB_OVERVIEW"
assert result["usage"] == {"prompt_tokens": 10}
baseline = dict(counts)
for field, value in [("mode", "local"), ("model", "deepseek-v4-pro"), ("adapter_version", "unverified")]:
    invalid = copy.deepcopy(request); invalid["runtime_snapshot"][field] = value
    rejected(lambda: execute(invalid, credential, provider)); assert counts == baseline
invalid = copy.deepcopy(request); invalid["consent"]["confirmed"] = False
rejected(lambda: execute(invalid, credential, provider), "JOB_OVERVIEW_CONSENT_REQUIRED"); assert counts == baseline
for field in ("candidate_context", "personal_memory", "source_document_id"):
    invalid = copy.deepcopy(request); invalid["context"][field] = "must not reach Provider"
    rejected(lambda: execute(invalid, credential, provider), "JOB_OVERVIEW_SCOPE_INVALID"); assert counts == baseline
invalid = copy.deepcopy(request); invalid["context"]["evidence"][0]["candidate"] = {"summary": "private"}
rejected(lambda: execute(invalid, credential, provider)); assert counts == baseline
invalid = copy.deepcopy(request); invalid["context"]["history"] = "中" * 48000
rejected(lambda: execute(invalid, credential, provider), "JOB_OVERVIEW_CONTEXT_LIMIT"); assert counts == baseline
invalid = copy.deepcopy(output); invalid["proposals"] = [{"operation": "EDIT"}]
rejected(lambda: validate_output(invalid, request))
invalid = copy.deepcopy(output); invalid["insights"][0]["evidence_refs"] = ["other-job"]
rejected(lambda: validate_output(invalid, request), "JOB_OVERVIEW_GROUNDING_INVALID")
invalid = copy.deepcopy(output); invalid["summary"] = "根据 job-1"
rejected(lambda: validate_output(invalid, request), "JOB_OVERVIEW_INTERNAL_REFERENCE_IN_PROSE")
distill = copy.deepcopy(request); distill.update(phase="DISTILL", human_message="", context={"scope": request["context"]["scope"], "evidence": [{"ref": "fragment-1", "title": "研究员", "text": "合成 JD", "part": 1, "total_parts": 1}]})
validate_request(distill)
validate_output({"summaries": [{"ref": "fragment-1", "summary": "研究岗位"}]}, distill)
rejected(lambda: validate_output({"summaries": []}, distill), "JOB_OVERVIEW_COVERAGE_INCOMPLETE")
empty = copy.deepcopy(request); empty["context"]["evidence"] = []
validate_request(empty); validate_output({"summary": "请先添加职位。", "insights": [], "uncertainties": []}, empty)
rejected(lambda: execute(request, credential, lambda *_: (503, {})), "JOB_OVERVIEW_PROVIDER_HTTP_ERROR")
rejected(lambda: execute(request, credential, lambda *_: (200, {"model": "wrong-model"})), "JOB_OVERVIEW_OUTPUT_INVALID")
print(json.dumps({"job_scope": "pass", "read_only_output": "pass", "runtime_and_consent_before_credentials": "pass", "grounding": "pass", "live_provider_calls": 0}))
