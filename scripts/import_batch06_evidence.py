"""Import the user's existing Batch 06 JD evidence into the local Job Radar.

This is deliberately an *evidence import*, not a re-fetcher.  The input is the
user-provided ``normalized.md`` plus its nearby raw screenshots.  In
particular, it never copies BOSS URLs with ``securityId`` query parameters into
the public-facing database.

Run:
    python3 scripts/import_batch06_evidence.py
    python3 scripts/import_batch06_evidence.py --dry-run

The import is idempotent: re-running it creates no second row and never
overwrites a user-owned ``application_status``.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from _runtime import PROJECT_ROOT
from app import connect, initialize_database


WORKSPACE_ROOT = PROJECT_ROOT.parent.parent
BATCH_ROOT = WORKSPACE_ROOT / "00_inbox" / "batch-06-jd-company-roles"
CANDIDATE_ROOT = PROJECT_ROOT / "data" / "batch06_candidates"
REPORT_PATH = PROJECT_ROOT / "data" / "batch06_import_report.json"
FIELD_ALIASES = {
    "company": ("Company",),
    "title": ("Role Title", "Role"),
    "location": ("Location",),
    "seniority": ("Seniority", "Experience"),
    "captured_date": ("Captured Date", "Captured date"),
    "published_date": ("Source Date", "Posted Date", "Posted date"),
    "source_name": ("Source",),
}


def clean_value(value: str) -> str:
    """Keep evidence text but remove Markdown wrappers and evidence citations."""
    value = value.strip().strip("`")
    value = re.sub(r"\s*\|.*$", "", value)
    return value.strip() or "unknown"


def table_fields(markdown: str) -> dict[str, str]:
    """Read two-column/three-column Markdown tables without assuming one format."""
    fields: dict[str, str] = {}
    for line in markdown.splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 2 or cells[0] in {"Field", "Category"} or set(cells[0]) <= {"-", " "}:
            continue
        fields[cells[0]] = clean_value(cells[1])
    return fields


def first_field(fields: dict[str, str], aliases: tuple[str, ...]) -> str:
    for alias in aliases:
        if alias in fields:
            return fields[alias]
    return "unknown"


def section_items(markdown: str, heading: str) -> list[str]:
    """Extract an evidence-backed list below one ``##`` heading."""
    match = re.search(
        rf"^## {re.escape(heading)}\s*$([\s\S]*?)(?=^## |\Z)",
        markdown,
        flags=re.MULTILINE,
    )
    if not match:
        return []
    items: list[str] = []
    for line in match.group(1).splitlines():
        item = re.match(r"^\s*(?:[-*]|\d+\.)\s+(.+?)\s*$", line)
        if not item:
            continue
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", item.group(1)).strip()
        if text.lower() != "unknown":
            items.append(text)
    return items


def candidate_from_directory(directory: Path) -> dict:
    normalized_path = directory / "normalized.md"
    extracted_path = directory / "extracted.md"
    normalized = normalized_path.read_text(encoding="utf-8")
    extracted = extracted_path.read_text(encoding="utf-8") if extracted_path.exists() else ""
    fields = table_fields(normalized)
    extracted_fields = table_fields(extracted)
    composite_identity = fields.get("Company / Role / Location", "")
    composite_seniority = fields.get("Seniority / Education", "")
    composite_dates = fields.get("Source Date / Captured Date", "")
    role_title_family = fields.get("Role Title / Family", "")
    job_match = re.search(r"\bJD-(\d{3})\b", normalized)
    if not job_match:
        raise ValueError(f"missing JD ID: {normalized_path}")
    job_id = f"JD-{job_match.group(1)}"

    def value(key: str) -> str:
        normalized_value = first_field(fields, FIELD_ALIASES[key])
        if normalized_value != "unknown":
            return normalized_value
        extracted_value = first_field(extracted_fields, FIELD_ALIASES[key])
        if extracted_value != "unknown":
            return extracted_value
        if key in {"company", "title", "location"} and composite_identity:
            parts = [part.strip() for part in composite_identity.split("/")]
            index = {"company": 0, "title": 1, "location": 2}[key]
            if len(parts) == 3:
                return parts[index]
        if key == "title" and role_title_family:
            return role_title_family.split("/")[0].strip()
        if key == "seniority" and composite_seniority:
            return composite_seniority.split("/")[0].strip()
        if key == "captured_date" and composite_dates:
            parts = [part.strip() for part in composite_dates.split("/")]
            if len(parts) == 2:
                return parts[1]
        return "unknown"

    responsibilities = section_items(normalized, "Responsibilities")
    requirements = section_items(normalized, "Requirements")
    # A few normalized records intentionally point to extracted.md for the
    # full list.  Prefer that list when the normalized file contains no items.
    if not responsibilities:
        responsibilities = section_items(extracted, "Responsibilities")
    if not requirements:
        requirements = section_items(extracted, "Requirements")
    captured_date = value("captured_date")
    if captured_date == "unknown":
        captured_date = "unknown"
    published_date = value("published_date")
    if published_date == "unknown":
        published_date = None
    return {
        "job_id": job_id,
        "company": value("company"),
        "title": value("title"),
        "location": value("location"),
        "seniority": value("seniority"),
        "source_path": str(normalized_path.relative_to(WORKSPACE_ROOT)),
        "source_url": None,
        "external_source_name": (
            value("source_name")
            if value("source_name") != "unknown"
            else "user-provided Batch 06 screenshot evidence"
        ),
        "external_job_id": None,
        "source_title": value("title"),
        "source_location": value("location"),
        "source_seniority": value("seniority"),
        "raw_capture_path": None,
        "raw_capture_sha256": None,
        "last_successful_fetch_at": None,
        "responsibilities": responsibilities,
        "requirements": requirements,
        "captured_date": captured_date,
        "published_date": published_date,
        "posting_status": "unknown",
        "application_status": "unknown",
        "import_note": (
            "Imported from user-provided Batch 06 normalized evidence; source URL "
            "intentionally omitted because supplied BOSS URLs may contain access parameters."
        ),
    }


def write_candidates(candidates: list[dict]) -> None:
    CANDIDATE_ROOT.mkdir(parents=True, exist_ok=True)
    for candidate in candidates:
        path = CANDIDATE_ROOT / f"{candidate['job_id'].lower()}.json"
        path.write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def persist(candidates: list[dict]) -> tuple[list[str], list[str]]:
    inserted: list[str] = []
    existing: list[str] = []
    initialize_database()
    with connect() as connection:
        for candidate in candidates:
            payload = {
                **candidate,
                "responsibilities_json": json.dumps(candidate["responsibilities"], ensure_ascii=False),
                "requirements_json": json.dumps(candidate["requirements"], ensure_ascii=False),
            }
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO jobs (
                    job_id, company, title, location, seniority, source_path, source_url,
                    external_source_name, external_job_id, source_title, source_location,
                    source_seniority, raw_capture_path, raw_capture_sha256,
                    last_successful_fetch_at, responsibilities_json, requirements_json,
                    captured_date, published_date, posting_status, application_status
                ) VALUES (
                    :job_id, :company, :title, :location, :seniority, :source_path, :source_url,
                    :external_source_name, :external_job_id, :source_title, :source_location,
                    :source_seniority, :raw_capture_path, :raw_capture_sha256,
                    :last_successful_fetch_at, :responsibilities_json, :requirements_json,
                    :captured_date, :published_date, :posting_status, :application_status
                )
                """,
                payload,
            )
            (inserted if cursor.rowcount == 1 else existing).append(candidate["job_id"])
    return inserted, existing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="write candidates/report but do not write SQLite")
    args = parser.parse_args()
    directories = sorted(
        path for path in BATCH_ROOT.glob("JD-*")
        if path.is_dir() and (path / "normalized.md").is_file()
    )
    candidates = [candidate_from_directory(directory) for directory in directories]
    candidates = [candidate for candidate in candidates if candidate["job_id"] != "JD-001"]
    if len(candidates) != 13:
        raise ValueError(f"expected 13 Batch 06 candidates (JD-002…JD-014), got {len(candidates)}")
    write_candidates(candidates)
    inserted, existing = ([], []) if args.dry_run else persist(candidates)
    report = {
        "import_kind": "user_provided_batch06_evidence",
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "candidate_count": len(candidates),
        "inserted_job_ids": inserted,
        "existing_job_ids": existing,
        "source_url_policy": "omit supplied BOSS URLs with possible access parameters",
        "application_status_policy": "new records start unknown; re-runs do not update existing rows",
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
