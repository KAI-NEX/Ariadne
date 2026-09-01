"""Save approved Tencent source evidence onto an existing matched job record.

The merge policy deliberately preserves curated display fields and user-owned
application status. It writes source evidence only.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from _runtime import PROJECT_ROOT
from app import connect, initialize_database


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/sync_tencent_candidate.py <candidate.json> <reconciliation_plan.json>")
        return 2

    candidate = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    plan = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    if plan.get("match_status") != "existing_record_matched" or not plan.get("target_job_id"):
        print("FAILED candidate_not_matched_to_existing_record")
        return 1
    if plan.get("user_owned_field_policy") != "preserve_application_status":
        print("FAILED unsafe_user_owned_field_policy")
        return 1

    initialize_database()
    with connect() as connection:
        cursor = connection.execute(
            """
            UPDATE jobs
            SET external_source_name = :source_name,
                external_job_id = :external_job_id,
                source_title = :source_title,
                source_location = :source_location,
                source_seniority = :source_seniority,
                raw_capture_path = :raw_capture_path,
                raw_capture_sha256 = :raw_capture_sha256,
                last_successful_fetch_at = :last_successful_fetch_at
            WHERE job_id = :job_id
            """,
            {
                "source_name": candidate["source_name"],
                "external_job_id": candidate["external_job_id"],
                "source_title": candidate["title"],
                "source_location": candidate["location"],
                "source_seniority": candidate["seniority"],
                "raw_capture_path": candidate["raw_capture_path"],
                "raw_capture_sha256": candidate["raw_capture_sha256"],
                "last_successful_fetch_at": candidate["last_successful_fetch_at"],
                "job_id": plan["target_job_id"],
            },
        )
        if cursor.rowcount != 1:
            print("FAILED matched_record_not_updated")
            return 1
        row = connection.execute(
            """
            SELECT job_id, company, title, location, seniority, application_status,
                   external_source_name, external_job_id, source_title, source_location,
                   source_seniority, raw_capture_path, raw_capture_sha256,
                   last_successful_fetch_at
            FROM jobs WHERE job_id = ?
            """,
            (plan["target_job_id"],),
        ).fetchone()
    print(json.dumps(dict(row), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
