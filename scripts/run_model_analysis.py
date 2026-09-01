"""Run the provider-independent JD analysis slice using a local deterministic mock."""

from __future__ import annotations

import argparse
import hashlib
import json

from _runtime import PROJECT_ROOT  # noqa: F401
from app import connect, initialize_database, job_payload
from src.model_analysis_pipeline import CONTRACT_DIR, build_request, get_provider
from src.validate_model_output import validate_serialized_output


def load_job(job_id: str) -> dict | None:
    with connect() as connection:
        row = connection.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
    return job_payload(row) if row else None


def input_preflight(request: dict) -> list[str]:
    input_data = request["input"]
    required = ("job_id", "title", "company", "location", "seniority", "responsibilities",
                "requirements", "external_source_name", "external_job_id", "raw_capture_path",
                "raw_capture_sha256", "last_successful_fetch_at")
    return [f"missing_input:{field}" for field in required if not input_data.get(field)]


def stable_analysis_id(request: dict, provider_name: str = "mock", model_name: str = "deterministic-fixture-v0") -> str:
    """Keep old Mock IDs stable; distinguish real-provider analyses of the same JD input."""
    identity = request if provider_name == "mock" and model_name == "deterministic-fixture-v0" else {
        "request": request,
        "provider_name": provider_name,
        "model_name": model_name,
    }
    fingerprint = json.dumps(identity, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return "AN-" + hashlib.sha256(fingerprint).hexdigest()[:16]


def persist_pending(request: dict, response, output: dict) -> tuple[str, bool]:
    analysis_id = stable_analysis_id(request, response.provider_name, response.model_name)
    contract = json.loads((CONTRACT_DIR / "jd_analysis_v0.json").read_text(encoding="utf-8"))
    with connect() as connection:
        cursor = connection.execute(
            """
            INSERT OR IGNORE INTO job_analyses (
                analysis_id, job_id, analysis_contract_id, instruction_version,
                provider_name, model_name, input_raw_capture_sha256, input_json,
                output_json, review_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review')
            """,
            (
                analysis_id, request["input"]["job_id"], contract["contract_id"],
                request["instruction_version"], response.provider_name, response.model_name,
                request["input"]["raw_capture_sha256"],
                json.dumps(request["input"], ensure_ascii=False, sort_keys=True),
                json.dumps(output, ensure_ascii=False, sort_keys=True),
            ),
        )
    return analysis_id, cursor.rowcount == 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", default="JD-001")
    parser.add_argument("--provider", default="mock")
    parser.add_argument(
        "--scenario",
        choices=("compliant", "invalid", "misleading", "missing_capability_evidence"),
        default="compliant",
    )
    args = parser.parse_args()

    initialize_database()
    job = load_job(args.job_id)
    if job is None:
        print(json.dumps({"pipeline_status": "stopped", "failure_layer": "input", "error": "job_not_found"}, ensure_ascii=False))
        return 1
    request = build_request(job)
    preflight_errors = input_preflight(request)
    if preflight_errors:
        print(json.dumps({"pipeline_status": "stopped", "failure_layer": "input_contract", "errors": preflight_errors}, ensure_ascii=False))
        return 1

    response = get_provider(args.provider).analyze(request, args.scenario)
    contract = json.loads((CONTRACT_DIR / "jd_analysis_v0.json").read_text(encoding="utf-8"))
    validation, structured_output = validate_serialized_output(contract, response.raw_output)
    result = {
        "pipeline_status": "model_response_received",
        "provider": {"name": response.provider_name, "model": response.model_name},
        "request": request,
        "raw_provider_response": response.raw_output,
        "validation": validation,
        "grounding_limit": "field-reference validation only; semantic truth remains for human review",
    }
    if not validation["contract_valid"]:
        result.update({"persistence": "not_written", "failure_layer": "syntax_schema_or_boundary"})
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1

    analysis_id, created = persist_pending(request, response, structured_output)
    result.update({
        "persistence": {"analysis_id": analysis_id, "review_status": "needs_review", "created": created},
        "human_review": "required before factual/semantic acceptance",
    })
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
