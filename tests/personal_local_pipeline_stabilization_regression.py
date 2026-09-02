"""Synthetic regression for Personal Local parser layout stabilization."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from src.career_evidence import propose_entities


ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "career_entity_synthetic" / "layout_anomaly_resume.json"


def main() -> None:
    case = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert case["fixture_contract"] == "ariadne-career-entity-layout-anomaly-synthetic-v1"
    assert case["privacy"]["not_derived_from_user_material"] is True

    entities, warnings, status = propose_entities(case["pages"], case["source_id"], "resume")
    counts = Counter(entity["entity_type"] for entity in entities)
    assert status == "needs_review" and warnings == []
    assert counts["work_experience"] == 3
    assert counts["education"] == 2
    assert counts["custom_section"] == 1
    assert counts["award"] == 2
    assert counts["skill_group"] == 1
    assert len(entities) > 1

    work = [entity for entity in entities if entity["entity_type"] == "work_experience"]
    assert all(entity["data"]["position"] for entity in work)
    unknown_date = next(entity for entity in work if entity["data"]["name"] == "Company C")
    assert unknown_date["data"]["startDate"] is None and unknown_date["data"]["endDate"] is None
    assert "missing_date" in unknown_date["extraction"]["warnings"]

    education = [entity for entity in entities if entity["entity_type"] == "education"]
    assert {entity["data"]["institution"] for entity in education} == {"School A", "School B"}
    assert {entity["data"]["studyType"] for entity in education} == {"硕士", "本科"}

    for entity in entities:
        assert entity["field_provenance"]
        anchors = [anchor for values in entity["field_provenance"].values() for anchor in values]
        assert all(anchor["source_document_id"] == case["source_id"] for anchor in anchors)
        assert all(anchor["source_location"] for anchor in anchors)
    assert any("source_region" in anchor for entity in entities for values in entity["field_provenance"].values() for anchor in values)

    print(json.dumps({"personal_local_layout_stabilization": "pass", "entity_count": len(entities), "provider_call_made": False}))


if __name__ == "__main__":
    main()
