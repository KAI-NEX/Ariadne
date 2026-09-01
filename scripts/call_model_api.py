"""Make one explicit real Model API call after a safe local credential setup."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from _runtime import PROJECT_ROOT
from app import initialize_database
from src.model_analysis_pipeline import ProviderResponse, build_request
from src.provider_registry import PROVIDERS, build_provider_payload
from run_model_analysis import input_preflight, load_job, persist_pending
from src.validate_model_output import validate_serialized_output


def post_json(endpoint: str, api_key: str, payload: dict) -> tuple[int, str]:
    """POST without logging the credential; caller handles every response as untrusted."""
    request = Request(
        endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urlopen(request, timeout=45) as response:  # noqa: S310 - endpoint is fixed registry data
        return response.status, response.read().decode("utf-8")


def extract_deepseek_output(raw_response: str) -> str | None:
    """Extract final model content; empty content is a provider/model failure, not success."""
    try:
        payload = json.loads(raw_response)
        return payload["choices"][0]["message"]["content"]
    except (IndexError, KeyError, TypeError, json.JSONDecodeError):
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=("deepseek",), default="deepseek")
    parser.add_argument("--model", required=True, help="A DeepSeek model ID available to your account.")
    parser.add_argument("--job-id", default="JD-001")
    args = parser.parse_args()

    initialize_database()
    spec = PROVIDERS[args.provider]
    api_key = os.environ.get(spec.credential_env)
    if not api_key:
        print(json.dumps({
            "pipeline_status": "stopped",
            "failure_layer": "credential",
            "error": "credential_not_configured",
            "credential_env": spec.credential_env,
            "network_call_made": False,
        }, ensure_ascii=False))
        return 2

    job = load_job(args.job_id)
    if job is None:
        print(json.dumps({"pipeline_status": "stopped", "failure_layer": "input", "error": "job_not_found"}, ensure_ascii=False))
        return 1
    model_request = build_request(job)
    preflight_errors = input_preflight(model_request)
    if preflight_errors:
        print(json.dumps({"pipeline_status": "stopped", "failure_layer": "input_contract", "errors": preflight_errors}, ensure_ascii=False))
        return 1

    payload = build_provider_payload(args.provider, model_request, args.model)
    try:
        http_status, raw_provider_response = post_json(spec.endpoint, api_key, payload)
    except HTTPError as error:
        print(json.dumps({
            "pipeline_status": "provider_failed", "failure_layer": "authentication_or_provider",
            "http_status": error.code, "network_call_made": True, "persistence": "not_written",
        }, ensure_ascii=False))
        return 1
    except URLError:
        print(json.dumps({
            "pipeline_status": "provider_failed", "failure_layer": "network",
            "network_call_made": True, "persistence": "not_written",
        }, ensure_ascii=False))
        return 1

    raw_output = extract_deepseek_output(raw_provider_response)
    if not raw_output or not raw_output.strip():
        print(json.dumps({
            "pipeline_status": "provider_response_incomplete", "failure_layer": "missing_output",
            "http_status": http_status, "network_call_made": True, "persistence": "not_written",
        }, ensure_ascii=False))
        return 1

    contract_path = PROJECT_ROOT / "data" / "model_contracts" / "jd_analysis_v0.json"
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    validation, structured_output = validate_serialized_output(contract, raw_output)
    result = {
        "pipeline_status": "model_response_received",
        "provider": {"name": args.provider, "model": args.model},
        "http_status": http_status,
        "network_call_made": True,
        "validation": validation,
    }
    if not validation["contract_valid"]:
        result.update({"failure_layer": "syntax_schema_or_boundary", "persistence": "not_written"})
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1

    response = ProviderResponse(args.provider, args.model, raw_output)
    analysis_id, created = persist_pending(model_request, response, structured_output)
    result.update({
        "persistence": {"analysis_id": analysis_id, "review_status": "needs_review", "created": created},
        "human_review": "required for semantic/grounding acceptance",
    })
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
