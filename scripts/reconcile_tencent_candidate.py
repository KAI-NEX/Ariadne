"""Match one reviewed Tencent candidate to an existing local job without writing it."""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from _runtime import PROJECT_ROOT

DATABASE_PATH = PROJECT_ROOT / "data" / "job_radar.db"
OUTPUT_DIRECTORY = PROJECT_ROOT / "data" / "reconciliation_plans"


def post_id_from_source_url(source_url: str | None) -> str | None:
    if not source_url:
        return None
    return parse_qs(urlparse(source_url).query).get("postId", [None])[0]


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/reconcile_tencent_candidate.py <normalized_candidate.json>")
        return 2

    candidate_path = Path(sys.argv[1]).resolve()
    candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
    external_job_id = candidate.get("external_job_id")
    if candidate.get("source_name") != "Tencent Careers" or not external_job_id:
        print("FAILED candidate_missing_tencent_duplicate_key")
        return 1

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            "SELECT job_id, source_url, application_status FROM jobs WHERE source_url IS NOT NULL"
        ).fetchall()
    matches = [row for row in rows if post_id_from_source_url(row["source_url"]) == external_job_id]
    if len(matches) > 1:
        print("FAILED duplicate_key_matches_multiple_local_records")
        return 1

    plan = {
        "candidate_path": str(candidate_path.relative_to(PROJECT_ROOT)),
        "duplicate_key": candidate["duplicate_key"],
        "match_status": "existing_record_matched" if matches else "new_record_required",
        "target_job_id": matches[0]["job_id"] if matches else None,
        "match_evidence": "source_url.postId equals external_job_id" if matches else None,
        "external_field_policy": "review_before_sync",
        "user_owned_field_policy": "preserve_application_status",
        "existing_application_status": matches[0]["application_status"] if matches else None,
        "storage_action": "not_written",
    }
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    plan_path = OUTPUT_DIRECTORY / f"tencent-careers-{external_job_id}.json"
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"RECONCILIATION_PLAN {plan_path.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
