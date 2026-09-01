"""Safely inspect the configuration boundary before any real Model API request."""

from __future__ import annotations

import argparse
import json

from _runtime import PROJECT_ROOT  # noqa: F401
from src.model_analysis_pipeline import build_request
from src.provider_registry import preflight
from run_model_analysis import load_job


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=("openai", "deepseek"), required=True)
    parser.add_argument("--model", required=True, help="Provider model ID; never put an API key here.")
    parser.add_argument("--job-id", default="JD-001")
    args = parser.parse_args()

    job = load_job(args.job_id)
    if job is None:
        print(json.dumps({"preflight_status": "stopped", "error": "job_not_found"}, ensure_ascii=False))
        return 1
    result = preflight(args.provider, build_request(job), args.model)
    result["preflight_status"] = "ready" if result["ready_for_network_call"] else "credential_not_configured"
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
