"""Validate a local model-analysis JSON against the planning-only contract."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def validate(contract: dict, output: dict) -> dict:
    """Return structural/boundary validation, without judging factual truth."""
    errors: list[str] = []
    required = contract["output_contract"]["required"]
    missing = [field for field in required if field not in output]
    if missing:
        errors.append(f"missing_required_fields:{','.join(missing)}")
    if "application_status" in output:
        errors.append("forbidden_user_owned_field:application_status")
    if output.get("analysis_status") != "needs_review":
        errors.append("model_must_not_auto_approve")

    allowed_evidence_fields = set(contract["input_contract"]["required_job_fields"])
    for index, capability in enumerate(output.get("capabilities", [])):
        evidence_fields = capability.get("evidence_fields", [])
        if not evidence_fields:
            errors.append(f"capability_without_evidence_fields:{index}")
            continue
        unsupported = set(evidence_fields) - allowed_evidence_fields
        if unsupported:
            errors.append(
                f"unsupported_capability_evidence_fields:{','.join(sorted(unsupported))}"
            )
    for item in output.get("evidence", []):
        source_fields = item.get("source_fields", [])
        if not source_fields:
            errors.append("claim_without_evidence_fields")
            continue
        unsupported = set(source_fields) - allowed_evidence_fields
        if unsupported:
            errors.append(f"unsupported_evidence_fields:{','.join(sorted(unsupported))}")

    if errors:
        return {"contract_valid": False, "errors": errors, "storage_action": "do_not_persist"}
    return {"contract_valid": True, "storage_action": "await_human_review"}


def validate_serialized_output(contract: dict, raw_output: str) -> tuple[dict, dict | None]:
    """Separate JSON syntax failure from schema/boundary failure."""
    try:
        output = json.loads(raw_output)
    except json.JSONDecodeError:
        return ({
            "contract_valid": False,
            "errors": ["syntax_validation_failed:invalid_json"],
            "storage_action": "do_not_persist",
        }, None)
    if not isinstance(output, dict):
        return ({
            "contract_valid": False,
            "errors": ["schema_validation_failed:output_must_be_object"],
            "storage_action": "do_not_persist",
        }, None)
    return validate(contract, output), output


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 src/validate_model_output.py <contract.json> <model_output.json>")
        return 2

    contract = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    result, _ = validate_serialized_output(
        contract, Path(sys.argv[2]).read_text(encoding="utf-8")
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["contract_valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
