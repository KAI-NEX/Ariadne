"""Step 1 CandidateContext proposal contract and DeepSeek request boundary.

This module validates an AI proposal before it can enter browser review.  It
never confirms a candidate fact or writes browser persistence.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any


CONTRACT_ID = "job-radar-candidate-context-v2-step1"
PROMPT_VERSION = "candidate_item_proposal_v2_material_routed"
ITEM_TYPES = {"WORK_EXPERIENCE", "PROJECT", "EDUCATION", "OTHER"}
SUPPORT_RELATIONS = {"EXPLICIT_SOURCE", "AI_DERIVED"}
REVIEW_STATUS = "NEEDS_REVIEW"
MATERIAL_TYPES = {"Resume", "Portfolio", "Project", "Other"}
MATERIAL_TYPE_GUIDANCE = {
    "Resume": (
        "Treat the material as a resume. Prioritize explicitly stated work experience, projects, "
        "and education. Preserve the source's role names, organizations, and dates; do not infer "
        "seniority, impact, or ownership from formatting or position on the page."
    ),
    "Portfolio": (
        "Treat the material as a portfolio. Focus on clearly demonstrated cases, the person's "
        "explicitly stated role, process, deliverables, and outcomes. Create PROJECT items for "
        "distinct cases, and never attribute team output to the person unless the source does."
    ),
    "Project": (
        "Treat the material as a project case study. Prefer one coherent PROJECT item per distinct "
        "project, preserving the problem, scope, contribution, evidence, and unresolved outcomes. "
        "Do not split process stages into separate experiences or invent business results."
    ),
    "Other": (
        "Treat the material as an uncategorized career source. Classify conservatively and create "
        "WORK_EXPERIENCE, PROJECT, EDUCATION, or OTHER items only when the source explicitly supports "
        "that classification. Keep ambiguous content as an uncertainty instead of guessing."
    ),
}


class CandidateProposalError(ValueError):
    """An input or provider response cannot safely become a review proposal."""


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalized_material_type(material_type: str) -> str:
    """Keep the provider prompt on one of the four UI material contracts."""
    normalized = str(material_type or "Resume").strip().title()
    if normalized not in MATERIAL_TYPES:
        raise CandidateProposalError("unsupported_candidate_material_type")
    return normalized


def candidate_proposal_instruction(material_type: str = "Resume") -> str:
    """Ask for the small V2 review contract, not Markdown or a resume schema."""
    material_type = normalized_material_type(material_type)
    material_guidance = MATERIAL_TYPE_GUIDANCE[material_type]
    routing_instruction = f"""Read the supplied career-material pages and return one JSON object only. Do not return Markdown or code fences.

Material type: {material_type}.
{material_guidance}
"""
    return routing_instruction + """

Your task is to propose candidate experience items for human review. Return only items actually supported by the supplied material pages. Do not create a PROFILE item, capability score, career advice, job match, or any information absent from the source.

For each WORK_EXPERIENCE, PROJECT, EDUCATION, or OTHER item, include a stable item_id, title, optional subtitle/time/ownership, a short summary, 3–5 important facts where available, source_refs with page location and short source excerpt, and open uncertainties when role, ownership, outcome, or fact is unclear. Every AI-created item must have review_status "NEEDS_REVIEW" and item_version 1. Use support_relation "EXPLICIT_SOURCE" for source-supported material; use "AI_DERIVED" only when explicitly marking a concise interpretation rather than a source fact.

The JSON object must use exactly this top-level shape:
{
  "items": [
    {
      "item_id": "work-1",
      "item_type": "WORK_EXPERIENCE",
      "title": "Original role or project name",
      "subtitle": "Organization or program when source-supported",
      "time": "Raw source date when present",
      "summary": "Short AI understanding",
      "facts": [{"fact_id": "work-1-fact-1", "label": "Role", "value": "source-supported statement"}],
      "ownership": "Only if source-supported; otherwise null",
      "source_refs": [{"source_ref_id": "work-1-ref-1", "source_document_id": "SOURCE_DOCUMENT_ID", "location": "p. 1", "excerpt_or_reference": "short source excerpt", "support_relation": "EXPLICIT_SOURCE"}],
      "uncertainties": [{"uncertainty_id": "work-1-uncertain-1", "question": "What outcome resulted?", "affects": "outcome", "status": "OPEN"}],
      "review_status": "NEEDS_REVIEW",
      "item_version": 1
    }
  ]
}

Replace SOURCE_DOCUMENT_ID with the supplied source document ID. The word json is intentional: return valid JSON even when information is sparse. If no supported experience item exists, return {"items": []}; do not invent one."""


def build_deepseek_candidate_proposal_payload(
    source_document_id: str, model: str, rendered_pages: list[tuple[str, bytes]], material_type: str = "Resume",
) -> dict[str, Any]:
    """Build a JSON-mode vision request for one already-consented career material."""
    if not source_document_id or not model or not rendered_pages:
        raise CandidateProposalError("candidate_proposal_request_incomplete")
    material_type = normalized_material_type(material_type)
    content: list[dict[str, Any]] = [{"type": "text", "text": candidate_proposal_instruction(material_type)}]
    for page_number, image_bytes in rendered_pages:
        if not image_bytes:
            raise CandidateProposalError("candidate_proposal_page_missing")
        content.append({"type": "text", "text": f"{material_type} page {page_number}. Source document ID: {source_document_id}."})
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64.b64encode(image_bytes).decode('ascii')}"}})
    return {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "response_format": {"type": "json_object"},
        "temperature": 0,
        "max_tokens": 8000,
    }


def _required_string(value: Any, field: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"invalid_{field}")


def _validate_source_ref(value: Any, source_document_id: str, errors: list[str]) -> None:
    if not isinstance(value, dict):
        errors.append("invalid_source_ref")
        return
    _required_string(value.get("source_ref_id"), "source_ref_id", errors)
    if value.get("source_document_id") != source_document_id:
        errors.append("source_ref_document_mismatch")
    _required_string(value.get("location"), "source_ref_location", errors)
    _required_string(value.get("excerpt_or_reference"), "source_ref_excerpt_or_reference", errors)
    if value.get("support_relation") not in SUPPORT_RELATIONS:
        errors.append("invalid_source_ref_support_relation")


def validate_candidate_proposal(raw: Any, source_document_id: str) -> tuple[dict[str, Any] | None, list[str]]:
    """Validate provider JSON locally and fail closed on any contract violation."""
    if not isinstance(raw, dict):
        return None, ["candidate_proposal_not_object"]
    items = raw.get("items")
    if not isinstance(items, list) or not items:
        return None, ["candidate_proposal_items_required"]
    errors: list[str] = []
    item_ids: set[str] = set()
    normalized_items: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            errors.append("invalid_candidate_item")
            continue
        item_id = item.get("item_id")
        _required_string(item_id, "item_id", errors)
        if isinstance(item_id, str):
            if item_id in item_ids:
                errors.append("duplicate_item_id")
            item_ids.add(item_id)
        if item.get("item_type") not in ITEM_TYPES:
            errors.append("invalid_item_type")
        _required_string(item.get("title"), "item_title", errors)
        _required_string(item.get("summary"), "item_summary", errors)
        if item.get("review_status") != REVIEW_STATUS:
            errors.append("proposal_item_must_need_review")
        if item.get("item_version") != 1:
            errors.append("proposal_item_version_must_be_one")
        facts = item.get("facts")
        if not isinstance(facts, list):
            errors.append("invalid_item_facts")
        else:
            for fact in facts:
                if not isinstance(fact, dict):
                    errors.append("invalid_fact")
                    continue
                _required_string(fact.get("fact_id"), "fact_id", errors)
                _required_string(fact.get("label"), "fact_label", errors)
                _required_string(fact.get("value"), "fact_value", errors)
        source_refs = item.get("source_refs")
        if not isinstance(source_refs, list) or not source_refs:
            errors.append("item_source_refs_required")
        else:
            for source_ref in source_refs:
                _validate_source_ref(source_ref, source_document_id, errors)
        uncertainties = item.get("uncertainties")
        if not isinstance(uncertainties, list):
            errors.append("invalid_item_uncertainties")
        else:
            for uncertainty in uncertainties:
                if not isinstance(uncertainty, dict):
                    errors.append("invalid_uncertainty")
                    continue
                _required_string(uncertainty.get("uncertainty_id"), "uncertainty_id", errors)
                _required_string(uncertainty.get("question"), "uncertainty_question", errors)
                if uncertainty.get("affects") not in {"fact", "ownership", "outcome", "matching use"}:
                    errors.append("invalid_uncertainty_affects")
                if uncertainty.get("status") not in {"OPEN", "RESOLVED", "DISMISSED"}:
                    errors.append("invalid_uncertainty_status")
        normalized_items.append(item)
    if errors:
        return None, sorted(set(errors))
    return {"contract_id": CONTRACT_ID, "items": normalized_items}, []


def extract_deepseek_candidate_proposal(
    provider_response: dict[str, Any], source_document_id: str, processing_run_id: str, model: str,
) -> dict[str, Any]:
    """Parse JSON mode output and return a review-only proposal; never a confirmed context."""
    try:
        content = provider_response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise CandidateProposalError("deepseek_response_missing_content") from error
    if not isinstance(content, str) or not content.strip():
        raise CandidateProposalError("deepseek_response_empty_content")
    try:
        raw = json.loads(content)
    except json.JSONDecodeError as error:
        raise CandidateProposalError("deepseek_response_malformed_json") from error
    normalized, errors = validate_candidate_proposal(raw, source_document_id)
    if errors or normalized is None:
        raise CandidateProposalError(f"candidate_proposal_contract_failed:{','.join(errors)}")
    usage = provider_response.get("usage") if isinstance(provider_response.get("usage"), dict) else {}
    return {
        "candidate_proposal_id": f"candidate-proposal-{processing_run_id}",
        "source_document_id": source_document_id,
        "processing_run_id": processing_run_id,
        "provider": "deepseek",
        "model": model,
        "prompt_version": PROMPT_VERSION,
        "review_status": REVIEW_STATUS,
        "created_at": utc_timestamp(),
        "usage": usage,
        **normalized,
    }
