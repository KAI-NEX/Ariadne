"""No-network regression for the Step 1 DeepSeek CandidateProposal boundary."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

from src.candidate_context import (
    CandidateProposalError,
    ITEM_TYPES,
    PROMPT_VERSION,
    build_deepseek_candidate_proposal_payload,
    candidate_proposal_instruction,
    extract_deepseek_candidate_proposal,
)


SOURCE_ID = "source-123"
VALID_ITEM = {
    "item_id": "work-1", "item_type": "WORK_EXPERIENCE", "title": "Product Designer",
    "subtitle": "Example Studio", "time": "2024–2026", "summary": "Designed product experience.",
    "facts": [{"fact_id": "work-1-fact-1", "label": "Role", "value": "Product Designer"}],
    "ownership": "Owned interaction design.",
    "source_refs": [{"source_ref_id": "work-1-ref-1", "source_document_id": SOURCE_ID, "location": "p. 1", "excerpt_or_reference": "Product Designer", "support_relation": "EXPLICIT_SOURCE"}],
    "uncertainties": [{"uncertainty_id": "work-1-uncertain-1", "question": "Outcome is not stated.", "affects": "outcome", "status": "OPEN"}],
    "review_status": "NEEDS_REVIEW", "item_version": 1,
}


class CandidateContextProviderRegression(unittest.TestCase):
    def test_explicit_award_classification_is_validated_and_preserved(self) -> None:
        item = {**VALID_ITEM, "item_type": "OTHER", "item_subtype": "award", "title": "Synthetic Design Challenge", "subtitle": "H module · Shortlisted"}
        proposal = extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "resume", "items": [item]})), SOURCE_ID, "run-1", "model")
        self.assertEqual(proposal["items"][0]["item_subtype"], "award")
        self.assertEqual(proposal["items"][0]["source_refs"], item["source_refs"])
        for invalid in ("AWARD", "education", None, [], {}):
            with self.subTest(invalid=invalid), self.assertRaisesRegex(CandidateProposalError, "invalid_item_subtype"):
                extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "resume", "items": [{**item, "item_subtype": invalid}]})), SOURCE_ID, "run-1", "model")

    def test_prompt_card_types_match_validation_authority(self) -> None:
        prompt = candidate_proposal_instruction()
        self.assertIn(json.dumps(sorted(ITEM_TYPES)), prompt)
        self.assertIn("Use PROJECT for a coherent project", prompt)
        frontend = (Path(__file__).resolve().parents[1] / "public/candidate-model-runtime-domain.js").read_text()
        self.assertIn(f'const PROMPT_VERSION = "{PROMPT_VERSION}"', frontend)

    def test_all_valid_card_types_remain_review_only(self) -> None:
        for item_type in ITEM_TYPES:
            with self.subTest(item_type=item_type):
                item = {**VALID_ITEM, "item_type": item_type}
                proposal = extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "project", "items": [item]})), SOURCE_ID, "run-1", "model")
                self.assertEqual(proposal["items"][0]["item_type"], item_type)
                self.assertEqual(proposal["review_status"], "NEEDS_REVIEW")

    def test_invalid_project_type_is_not_silently_rewritten(self) -> None:
        for item_type in ("project", "PROJECT_EXPERIENCE", "PROFILE", "SKILL"):
            with self.subTest(item_type=item_type), self.assertRaisesRegex(CandidateProposalError, "invalid_item_type"):
                item = {**VALID_ITEM, "item_type": item_type}
                extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "project", "items": [item]})), SOURCE_ID, "run-1", "model")

    def response(self, content: str) -> dict:
        return {"id": "response-1", "usage": {"prompt_tokens": 123, "completion_tokens": 45}, "choices": [{"message": {"content": content}}]}

    def test_builds_json_mode_vision_payload(self) -> None:
        payload = build_deepseek_candidate_proposal_payload(SOURCE_ID, "deepseek-v4-flash-vision-exp", [("1", b"jpeg-bytes")])
        self.assertEqual(payload["response_format"], {"type": "json_object"})
        self.assertEqual(payload["thinking"], {"type": "disabled"})
        self.assertEqual(payload["max_tokens"], 8000)
        self.assertIn("json", payload["messages"][0]["content"][0]["text"].lower())
        self.assertIn("No Markdown, prose, explanation, or reasoning outside JSON", payload["messages"][0]["content"][0]["text"])
        self.assertIn("Omit optional subtitle, time, and ownership when absent", payload["messages"][0]["content"][0]["text"])
        self.assertEqual(payload["messages"][0]["content"][2]["type"], "image_url")

    def test_material_type_is_model_inferred_on_a_bounded_enum(self) -> None:
        prompt = candidate_proposal_instruction()
        for material_type in ["resume", "portfolio", "project", "other"]:
            self.assertIn(material_type, prompt)
        self.assertIn('"material_type": "resume"', prompt)
        payload = build_deepseek_candidate_proposal_payload(SOURCE_ID, "model", [("2", b"jpeg")])
        self.assertIn("Career-material page 2", payload["messages"][0]["content"][1]["text"])

    def test_unsupported_material_type_fails_closed(self) -> None:
        with self.assertRaisesRegex(CandidateProposalError, "invalid_candidate_material_type"):
            extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "unknown", "items": []})), SOURCE_ID, "run-1", "model")

    def test_valid_json_becomes_review_only_proposal(self) -> None:
        proposal = extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "resume", "items": [VALID_ITEM]})), SOURCE_ID, "run-1", "deepseek-v4-flash-vision-exp")
        self.assertEqual(proposal["review_status"], "NEEDS_REVIEW")
        self.assertEqual(proposal["items"][0]["review_status"], "NEEDS_REVIEW")
        self.assertEqual(proposal["usage"]["prompt_tokens"], 123)
        self.assertEqual(proposal["material_type"], "resume")

    def test_explicit_empty_items_is_a_valid_no_proposal_result(self) -> None:
        proposal = extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "other", "items": []})), SOURCE_ID, "run-1", "deepseek-v4-flash-vision-exp")
        self.assertEqual(proposal["items"], [])
        self.assertEqual(proposal["review_status"], "NEEDS_REVIEW")

    def test_empty_malformed_and_ungrounded_output_fail_closed(self) -> None:
        with self.assertRaisesRegex(CandidateProposalError, "empty_content"):
            extract_deepseek_candidate_proposal(self.response(""), SOURCE_ID, "run-1", "model")
        with self.assertRaisesRegex(CandidateProposalError, "malformed_json"):
            extract_deepseek_candidate_proposal(self.response("not json"), SOURCE_ID, "run-1", "model")
        ungrounded = {**VALID_ITEM, "source_refs": []}
        with self.assertRaisesRegex(CandidateProposalError, "contract_failed"):
            extract_deepseek_candidate_proposal(self.response(json.dumps({"material_type": "resume", "items": [ungrounded]})), SOURCE_ID, "run-1", "model")


if __name__ == "__main__":
    unittest.main()
