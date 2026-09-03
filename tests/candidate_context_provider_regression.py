"""No-network regression for the Step 1 DeepSeek CandidateProposal boundary."""

from __future__ import annotations

import json
import unittest

from src.candidate_context import (
    CandidateProposalError,
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

    def test_material_type_routes_to_distinct_grounded_prompts(self) -> None:
        prompts = {material_type: candidate_proposal_instruction(material_type) for material_type in ["Resume", "Portfolio", "Project", "Other"]}
        self.assertEqual(len(set(prompts.values())), 4)
        self.assertIn("distinct cases", prompts["Portfolio"])
        self.assertIn("one coherent PROJECT item", prompts["Project"])
        self.assertIn("uncategorized career source", prompts["Other"])
        payload = build_deepseek_candidate_proposal_payload(SOURCE_ID, "model", [("2", b"jpeg")], "Portfolio")
        self.assertIn("Portfolio page 2", payload["messages"][0]["content"][1]["text"])

    def test_unsupported_material_type_fails_closed(self) -> None:
        with self.assertRaisesRegex(CandidateProposalError, "unsupported_candidate_material_type"):
            candidate_proposal_instruction("Unknown")

    def test_valid_json_becomes_review_only_proposal(self) -> None:
        proposal = extract_deepseek_candidate_proposal(self.response(json.dumps({"items": [VALID_ITEM]})), SOURCE_ID, "run-1", "deepseek-v4-flash-vision-exp")
        self.assertEqual(proposal["review_status"], "NEEDS_REVIEW")
        self.assertEqual(proposal["items"][0]["review_status"], "NEEDS_REVIEW")
        self.assertEqual(proposal["usage"]["prompt_tokens"], 123)

    def test_explicit_empty_items_is_a_valid_no_proposal_result(self) -> None:
        proposal = extract_deepseek_candidate_proposal(self.response(json.dumps({"items": []})), SOURCE_ID, "run-1", "deepseek-v4-flash-vision-exp")
        self.assertEqual(proposal["items"], [])
        self.assertEqual(proposal["review_status"], "NEEDS_REVIEW")

    def test_empty_malformed_and_ungrounded_output_fail_closed(self) -> None:
        with self.assertRaisesRegex(CandidateProposalError, "empty_content"):
            extract_deepseek_candidate_proposal(self.response(""), SOURCE_ID, "run-1", "model")
        with self.assertRaisesRegex(CandidateProposalError, "malformed_json"):
            extract_deepseek_candidate_proposal(self.response("not json"), SOURCE_ID, "run-1", "model")
        ungrounded = {**VALID_ITEM, "source_refs": []}
        with self.assertRaisesRegex(CandidateProposalError, "contract_failed"):
            extract_deepseek_candidate_proposal(self.response(json.dumps({"items": [ungrounded]})), SOURCE_ID, "run-1", "model")


if __name__ == "__main__":
    unittest.main()
