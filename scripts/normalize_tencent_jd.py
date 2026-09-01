"""Create a reviewable normalized candidate from one saved Tencent API response.

This is deliberately not a SQLite import. It preserves the raw evidence link and
keeps unsupported external facts as unknown/NULL for user review.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from _runtime import PROJECT_ROOT

OUTPUT_DIRECTORY = PROJECT_ROOT / "data" / "normalized_candidates"


def numbered_items(text: str) -> list[str]:
    """Split source text only at its visible numbered-item boundaries."""
    matches = list(re.finditer(r"(?m)^\s*\d+[.、]\s*", text))
    if not matches:
        return [text.strip()] if text.strip() else []
    return [
        text[match.end(): matches[index + 1].start() if index + 1 < len(matches) else None].strip()
        for index, match in enumerate(matches)
    ]


def source_value(data: dict, key: str) -> str:
    value = data.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else "unknown"


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/normalize_tencent_jd.py <raw_api.json> <fetch_metadata.json>")
        return 2

    raw_path = Path(sys.argv[1]).resolve()
    metadata_path = Path(sys.argv[2]).resolve()
    response = json.loads(raw_path.read_text(encoding="utf-8"))
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    data = response.get("Data")
    if response.get("Code") != 200 or not isinstance(data, dict) or not data.get("PostId"):
        print("FAILED raw_api_not_a_verified_job_response")
        return 1

    external_job_id = str(data["PostId"])
    candidate = {
        "normalization_status": "needs_user_review",
        "source_name": "Tencent Careers",
        "external_job_id": external_job_id,
        "duplicate_key": f"Tencent Careers:{external_job_id}",
        "title": source_value(data, "RecruitPostName"),
        "company": source_value(data, "ComName"),
        "location": source_value(data, "LocationName"),
        "seniority": source_value(data, "RequireWorkYearsName"),
        "responsibilities": numbered_items(source_value(data, "Responsibility")),
        "requirements": numbered_items(source_value(data, "Requirement")),
        "published_date": None,
        "posting_status": "unknown",
        "source_last_update_time": source_value(data, "LastUpdateTime"),
        "source_url": metadata["requested_url"],
        "raw_capture_path": str(raw_path.relative_to(PROJECT_ROOT)),
        "raw_capture_sha256": hashlib.sha256(raw_path.read_bytes()).hexdigest(),
        "last_successful_fetch_at": metadata["last_successful_fetch_at"],
        "application_status": "not_mapped_user_owned",
    }
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIRECTORY / f"tencent-careers-{external_job_id}.json"
    output_path.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"NORMALIZED_CANDIDATE {output_path.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
