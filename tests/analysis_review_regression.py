"""Run a rollback-only human-review persistence regression with local mock output."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app import connect, initialize_database
from src.validate_model_output import validate

CONTRACT_PATH = PROJECT_ROOT / "data" / "model_contracts" / "jd_analysis_v0.json"
OUTPUT_PATH = PROJECT_ROOT / "data" / "model_contracts" / "compliant_model_output.json"


def analysis_snapshot(connection) -> dict:
    row = connection.execute(
        """
        SELECT analysis_id, job_id, analysis_contract_id, input_raw_capture_sha256,
               review_status, reviewed_by, reviewed_at, review_note
        FROM job_analyses
        WHERE analysis_id = 'AN-REG-001'
        """
    ).fetchone()
    return dict(row) if row else {"analysis_record": "absent"}


def main() -> int:
    """Create pending, reject it as a test reviewer, then roll everything back."""
    initialize_database()
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    output = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    validation = validate(contract, output)
    if not validation["contract_valid"]:
        print(json.dumps({"regression_passed": False, "validation": validation}, ensure_ascii=False))
        return 1

    with connect() as connection:
        job_before = dict(connection.execute(
            "SELECT job_id, title, application_status FROM jobs WHERE job_id = 'JD-001'"
        ).fetchone())
        raw_hash = connection.execute(
            "SELECT raw_capture_sha256 FROM jobs WHERE job_id = 'JD-001'"
        ).fetchone()["raw_capture_sha256"]
        if not raw_hash:
            raise RuntimeError("JD-001 has no raw source hash for provenance")

        connection.execute("BEGIN")
        try:
            connection.execute(
                """
                INSERT INTO job_analyses (
                    analysis_id, job_id, analysis_contract_id, input_raw_capture_sha256,
                    output_json, review_status
                ) VALUES (?, ?, ?, ?, ?, 'needs_review')
                """,
                ("AN-REG-001", "JD-001", contract["contract_id"], raw_hash,
                 json.dumps(output, ensure_ascii=False)),
            )
            pending = analysis_snapshot(connection)
            reviewed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            connection.execute(
                """
                UPDATE job_analyses
                SET review_status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ?
                WHERE analysis_id = 'AN-REG-001' AND review_status = 'needs_review'
                """,
                ("test_human_reviewer", reviewed_at,
                 "Local regression simulation; not a user decision."),
            )
            rejected = analysis_snapshot(connection)
            job_after = dict(connection.execute(
                "SELECT job_id, title, application_status FROM jobs WHERE job_id = 'JD-001'"
            ).fetchone())
            unchanged = job_before == job_after
        finally:
            connection.rollback()

    print(json.dumps({
        "regression_passed": unchanged and pending["review_status"] == "needs_review"
        and rejected["review_status"] == "rejected",
        "validation": validation,
        "pending_analysis": pending,
        "rejected_analysis": rejected,
        "job_before": job_before,
        "job_after": job_after,
        "job_facts_unchanged": unchanged,
        "transaction_rolled_back": True,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
