"""Direct backend regression for Slice 4B local deterministic structuring."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import app  # noqa: E402

SOURCE_ID = "source-candidate-" + "b" * 64
SNAPSHOT = {"snapshot_id": "runtime-snapshot-local-4b", "capabilities": {"local_ocr": "unsupported"}}


def invoke(payload: dict) -> tuple[int, dict]:
    handler = object.__new__(app.JobRadarHandler)
    body = json.dumps(payload).encode("utf-8")
    handler.headers = {"Content-Length": str(len(body))}
    handler.rfile = io.BytesIO(body)
    responses = []
    handler.send_json = lambda status, value: responses.append((int(status), value))
    handler.structure_local_candidate_proposal()
    return responses[0]


def request(material_type: str | None, pages: list[dict]) -> dict:
    value = {"source_document_id": SOURCE_ID, "runtime_snapshot": SNAPSHOT, "pages": pages}
    if material_type is not None:
        value["candidate_material_type"] = material_type
    return value


def main() -> None:
    original = app.local_snapshot_from_payload
    app.local_snapshot_from_payload = lambda _payload: SNAPSHOT
    try:
        status, resume = invoke(request("resume", [{"page": 1, "lines": ["WORK EXPERIENCE", "Example Studio | Product Designer | 2023 - 2024", "- Designed explicit source-supported flows.", "PROJECTS", "Ariadne | Local evidence workflow | 2025", "- Built an explicit prototype."]}]))
        assert status == 200 and resume["model_call_made"] is False
        assert resume["runtime_snapshot_id"] == SNAPSHOT["snapshot_id"]
        assert any(entity["entity_type"] == "work_experience" for entity in resume["entities"])

        status, portfolio = invoke(request("portfolio", [{"page": 1, "lines": ["CASE 01: Explicit Portfolio Project", "Role", "Designer"]}]))
        assert status == 200 and any(entity["entity_type"] == "project" for entity in portfolio["entities"])

        status, project = invoke(request("project_description", [{"page": 1, "lines": ["Explicit Project Description", "A concrete local project case."]}]))
        assert status == 200 and any(entity["entity_type"] == "project" for entity in project["entities"])

        status, other = invoke(request("other", [{"page": 1, "lines": ["Do not infer this material type."]}]))
        assert status == 200 and other["entities"] == [] and other["model_call_made"] is False

        for invalid in (None, "resume-from-filename", ""):
            status, failure = invoke(request(invalid, [{"page": 1, "lines": ["WORK EXPERIENCE", "Example Studio | Product Designer"]}]))
            assert status == 400 and failure["error"] == "invalid_candidate_material_type" and failure["model_call_made"] is False
    finally:
        app.local_snapshot_from_payload = original
    print(json.dumps({"local_candidate_structure_route": "pass", "provider_call_made": False, "review_decisions_written": 0, "candidate_revisions_written": 0}))


if __name__ == "__main__":
    main()
