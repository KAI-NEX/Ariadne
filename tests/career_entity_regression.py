"""Synthetic default regression for local CareerEntity extraction.

The tracked baseline is fully synthetic and does not require personal career
materials. An optional local-only regression can be supplied through
ARIADNE_PRIVATE_CAREER_REGRESSION_PATH; that path and its assertions must stay
under the ignored tests/private_fixtures/ boundary.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import zipfile
from collections import Counter
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = PROJECT_ROOT / "tests" / "fixtures" / "career_entity_synthetic" / "cases.json"
PRIVATE_REGRESSION_ENV = "ARIADNE_PRIVATE_CAREER_REGRESSION_PATH"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.career_evidence import _adaptive_resume_layout, _docx_pages, propose_entities


def load_fixture() -> dict:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    privacy = fixture.get("privacy", {})
    assert fixture.get("fixture_contract") == "ariadne-career-entity-synthetic-v1"
    assert privacy.get("classification") == "fully_synthetic"
    assert privacy.get("created_from") == "blank_fictional_scenario"
    assert privacy.get("not_derived_from_user_material") is True
    assert privacy.get("reserved_email_domain_only") is True
    return fixture


def entity_types(entities: list[dict]) -> Counter:
    return Counter(entity["entity_type"] for entity in entities)


def assert_entity_contract(entities: list[dict], source_id: str) -> None:
    assert entities
    assert all(entity["contract_id"] == "job-radar-career-entity-v1" for entity in entities)
    assert all(entity["review_status"] == "needs_review" for entity in entities)
    assert all(entity["source_document_ids"] == [source_id] for entity in entities)
    assert all(entity["entity_id"].startswith("entity-") for entity in entities)
    assert all(entity["field_provenance"] for entity in entities)
    for entity in entities:
        for anchors in entity["field_provenance"].values():
            for anchor in anchors:
                assert anchor["source_document_id"] == source_id
                assert anchor["anchor_id"].startswith("anchor-")
                assert anchor["source_location"]


def test_synthetic_resume_golden_path(fixture: dict) -> None:
    case = fixture["resume"]
    expected = case["expected"]
    entities, warnings, status = propose_entities(case["pages"], case["source_id"], "resume")

    assert status == "needs_review" and not warnings
    assert entity_types(entities) == Counter(expected["entity_type_counts"])
    assert_entity_contract(entities, case["source_id"])

    work = next(entity for entity in entities if entity["entity_type"] == "work_experience")
    assert work["data"]["name"] == expected["work_name"]
    assert work["data"]["position"] == expected["work_position"]
    assert work["data"]["startDate"] == expected["work_start"]
    assert work["data"]["endDate"] == expected["work_end"]
    assert len(work["data"]["unclassified_highlights"]) == 2

    project = next(entity for entity in entities if entity["entity_type"] == "project")
    assert project["data"]["name"] == expected["project_name"]
    assert project["data"]["project_kind"] == "software"
    assert project["data"]["unclassified_highlights"]

    education = next(entity for entity in entities if entity["entity_type"] == "education")
    assert education["data"]["institution"] == expected["education_institution"]
    assert education["data"]["startDate"] is None and education["data"]["endDate"] is None
    assert "missing_date" in education["extraction"]["warnings"]

    skill_group = next(entity for entity in entities if entity["entity_type"] == "skill_group")
    assert skill_group["data"]["name"] == expected["skill_group"]
    assert {"HTML", "JavaScript", "CSV"}.issubset(set(skill_group["data"]["keywords"]))

    languages = [entity["data"]["language"] for entity in entities if entity["entity_type"] == "language"]
    assert languages == expected["languages"]

    award = next(entity for entity in entities if entity["entity_type"] == "award")
    assert award["data"]["name"].startswith(expected["award_name_prefix"])
    assert award["data"]["date"] is None

    duplicate, duplicate_warnings, duplicate_status = propose_entities(
        case["pages"], case["source_id"], "resume"
    )
    assert duplicate_status == status and duplicate_warnings == warnings
    assert [entity["entity_id"] for entity in duplicate] == [entity["entity_id"] for entity in entities]


def test_synthetic_fail_closed_cases() -> None:
    source_id = "source-synthetic-fail-closed-v1"

    missing_date = [{"page": 1, "lines": [
        "Nova Quill", "Synthetic Systems Designer", "WORK EXPERIENCE",
        "Fictional Cooperative | Systems Designer", "- Documented a synthetic state map.",
    ]}]
    entities, _, status = propose_entities(missing_date, source_id, "resume")
    work = next(entity for entity in entities if entity["entity_type"] == "work_experience")
    assert status == "needs_review"
    assert work["data"]["startDate"] is None and work["data"]["endDate"] is None
    assert "missing_date" in work["extraction"]["warnings"]

    ambiguous = [{"page": 1, "lines": [
        "Nova Quill", "Synthetic Systems Designer", "WORK EXPERIENCE",
        "Signal Workshop 2022 - 2023", "- Built an invented review surface.",
    ]}]
    entities, _, _ = propose_entities(ambiguous, source_id, "resume")
    work = next(entity for entity in entities if entity["entity_type"] == "work_experience")
    assert work["data"]["position"] == ""
    assert "ambiguous_company_or_title" in work["extraction"]["warnings"]

    no_highlights = [{"page": 1, "lines": [
        "Nova Quill", "Synthetic Systems Designer", "WORK EXPERIENCE",
        "Paper Moon Lab | Researcher | 2020 - 2021",
    ]}]
    first, _, _ = propose_entities(no_highlights, source_id, "resume")
    second, _, _ = propose_entities(no_highlights, source_id, "resume")
    work = next(entity for entity in first if entity["entity_type"] == "work_experience")
    assert "no_highlights_detected" in work["extraction"]["warnings"]
    assert [entity["entity_id"] for entity in first] == [entity["entity_id"] for entity in second]

    entities, warnings, status = propose_entities(
        [{"page": 1, "lines": []}], source_id, "portfolio"
    )
    assert entities == [] and status == "needs_manual_selection"
    assert warnings == ["portfolio_projects_not_detected"]


def test_synthetic_numbered_portfolio_grouping(fixture: dict) -> None:
    case = fixture["numbered_portfolio"]
    expected = case["expected"]
    entities, warnings, status = propose_entities(case["pages"], case["source_id"], "portfolio")

    assert status == "needs_review" and not warnings
    assert entity_types(entities) == Counter({"project": 2})
    assert_entity_contract(entities, case["source_id"])
    assert [entity["data"]["name"] for entity in entities] == expected["project_names"]
    assert [entity["data"]["source_pages"] for entity in entities] == expected["source_pages"]
    assert [entity["data"]["role"] for entity in entities] == expected["roles"]
    assert entities[0]["data"]["tools"] == ["HTML", "JavaScript"]
    assert entities[1]["data"]["tools"] == ["CSV"]


def test_synthetic_coordinate_portfolio_mapping(fixture: dict) -> None:
    case = fixture["coordinate_portfolio"]
    expected = case["expected"]
    entities, warnings, status = propose_entities(case["pages"], case["source_id"], "portfolio")

    assert status == "needs_review" and not warnings and len(entities) == 1
    project = entities[0]
    assert project["data"]["name"] == expected["name"]
    assert project["data"]["role"] == expected["role"]
    assert project["data"]["problem"].startswith(expected["problem_prefix"])
    assert expected["excluded_neighbor"] not in project["data"]["role"]
    assert expected["excluded_neighbor"] not in project["data"]["problem"]
    assert project["data"]["tools"] == expected["tools"]
    assert "/role" in project["field_provenance"]
    assert "/problem" in project["field_provenance"]
    assert project["field_provenance"]["/role"][0]["source_region"]


def test_synthetic_local_correction_memory(fixture: dict) -> None:
    case = fixture["correction_case"]
    expected = case["expected"]
    entities, warnings, status = propose_entities(
        case["pages"], case["source_id"], "resume", case["corrections"]
    )

    assert status == "needs_review" and not warnings
    corrected = next(entity for entity in entities if entity["entity_type"] == expected["corrected_entity_type"])
    assert corrected["data"]["institution"] == expected["corrected_institution"]
    assert expected["warning"] in corrected["extraction"]["warnings"]
    assert corrected["extraction"]["confidence"] == "low"


def test_synthetic_adaptive_layout(fixture: dict) -> None:
    case = fixture["adaptive_layout"]
    ordered, changed = _adaptive_resume_layout(case["pages"])
    assert changed is True
    assert ordered[0]["lines"] == case["expected_lines"]

    native_pages = [{**case["pages"][0], "source_method": "native_pdf"}]
    native_ordered, native_changed = _adaptive_resume_layout(native_pages)
    assert native_changed is False
    assert "lines" not in native_ordered[0]


def _synthetic_docx(lines: list[str]) -> bytes:
    paragraphs = "".join(
        f"<w:p><w:r><w:t>{escape(line)}</w:t></w:r></w:p>" for line in lines
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{paragraphs}</w:body></w:document>"
    )
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def test_synthetic_docx_extraction(fixture: dict) -> None:
    case = fixture["resume"]
    lines = case["pages"][0]["lines"]
    pages = _docx_pages(_synthetic_docx(lines))
    assert pages == [{"page": 1, "lines": lines, "source_method": "native_document"}]

    entities, warnings, status = propose_entities(pages, "source-synthetic-docx-v1", "resume")
    assert status == "needs_review" and not warnings
    assert entity_types(entities) == Counter(case["expected"]["entity_type_counts"])


def run_optional_private_regression() -> str:
    configured = os.environ.get(PRIVATE_REGRESSION_ENV, "").strip()
    if not configured:
        return "not_configured"

    private_runner = Path(configured).expanduser().resolve()
    if private_runner == Path(__file__).resolve() or not private_runner.is_file():
        raise AssertionError("optional private career regression path is invalid")

    environment = os.environ.copy()
    environment.pop(PRIVATE_REGRESSION_ENV, None)
    result = subprocess.run(
        [sys.executable, str(private_runner)],
        cwd=PROJECT_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"optional private career regression failed with exit code {result.returncode}; "
            "run the configured local-only test directly for private diagnostics"
        )
    return "pass"


def main() -> None:
    fixture = load_fixture()
    test_synthetic_resume_golden_path(fixture)
    test_synthetic_fail_closed_cases()
    test_synthetic_numbered_portfolio_grouping(fixture)
    test_synthetic_coordinate_portfolio_mapping(fixture)
    test_synthetic_local_correction_memory(fixture)
    test_synthetic_adaptive_layout(fixture)
    test_synthetic_docx_extraction(fixture)
    private_status = run_optional_private_regression()
    print(json.dumps({
        "career_entity_synthetic_regression": "PASS",
        "synthetic_fixture_contract": fixture["fixture_contract"],
        "optional_private_regression": private_status,
        "model_call_made": False,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
