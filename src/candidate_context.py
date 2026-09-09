"""Step 1 CandidateContext proposal contract and DeepSeek request boundary.

This module validates an AI proposal before it can enter the browser working
projection. It never confirms a candidate fact or writes browser persistence.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Any


CONTRACT_ID = "job-radar-candidate-context-v2-step1"
PROMPT_VERSION = "candidate_workspace_v3_atomic_awards"
ITEM_TYPES = {"WORK_EXPERIENCE", "PROJECT", "EDUCATION", "OTHER"}
ITEM_SUBTYPES = {"WORK_EXPERIENCE": {"work_experience"}, "PROJECT": {"project"}, "EDUCATION": {"education"}, "OTHER": {"award", "skill_group", "language", "custom_section"}}
SUPPORT_RELATIONS = {"EXPLICIT_SOURCE", "AI_DERIVED"}
REVIEW_STATUS = "NEEDS_REVIEW"
MATERIAL_TYPES = {"resume", "portfolio", "project", "other"}


class CandidateProposalError(ValueError):
    """An input or provider response cannot safely become a working proposal."""


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalized_material_type(material_type: str) -> str:
    """Keep model-inferred material types on the bounded output enum."""
    normalized = str(material_type or "").strip().lower()
    if normalized not in MATERIAL_TYPES:
        raise CandidateProposalError("unsupported_candidate_material_type")
    return normalized


def candidate_proposal_instruction() -> str:
    """Ask only for the compact, grounded working-proposal contract."""
    return """Read the supplied career-material pages, infer the overall material type, and produce Candidate Proposal JSON for a non-authoritative working workspace.

Output rules:
- Return one valid JSON object only. No Markdown, prose, explanation, or reasoning outside JSON.
- Do not write a resume summary, career advice, optimization advice, match score, or PROFILE item.
- Use concise values. Summary <= 160 characters; each evidence excerpt <= 120 characters.
- Include at most 3 key facts and 2 unresolved uncertainties per item.
- Omit optional subtitle, time, and ownership when absent; do not emit null or empty optional fields.
- Do not repeat filename, provider, model, or source metadata. source_document_id appears only inside source_refs.
- Return only source-supported items. Never invent an item to avoid an empty result.
- Infer material_type as exactly one of resume, portfolio, project, or other.
- For item_type use exactly one of __ITEM_TYPES__ (case-sensitive). These are card types, not material_type values.
- Use PROJECT for a coherent project, EDUCATION for education, WORK_EXPERIENCE for employment, and OTHER only for other supported material. Do not invent alternative type names or copy the example's employment type onto every item.
- Resume extracts supported work, project, and education items; portfolio emphasizes distinct cases; project keeps coherent projects; other stays conservative and preserves ambiguity.
- For each award/competition result use OTHER with item_subtype "award". One independently supported award/result per card, not one card for an Awards/Honours section. Title is the specific competition or award name, never a repeated category such as 获奖情况/获奖经历. Subtitle carries the supported module and result (e.g. H模块 · 优秀奖); distinguish shortlisted/入围 from winning. Summary and facts only add supported details, not generic praise or repeated lists of other awards.
- Split distinct competitions mentioned together only when the source establishes their separate names and results. Deduplicate repeated mentions of the same award/result. Do not invent missing years, issuers, project associations or individual contribution. Preserve genuine ambiguity as uncertainties and attach each award's own source_refs. If only an unnamed aggregate award claim is supported, preserve it conservatively as OTHER/custom_section with an explicit unresolved question; do not fabricate named awards.
- Optional item_subtype, when supplied, must match item_type: WORK_EXPERIENCE/work_experience, PROJECT/project, EDUCATION/education, OTHER/award|skill_group|language|custom_section. Classification is your semantic judgment from the material, not a keyword in a fact label.

Use exactly this shape:
{{
  "material_type": "resume",
  "items": [
    {{
      "item_id": "work-1",
      "item_type": "WORK_EXPERIENCE",
      "title": "source title",
      "summary": "concise source-grounded description",
      "facts": [{{"fact_id": "fact-1", "label": "Role", "value": "concise supported fact"}}],
      "source_refs": [{{"source_ref_id": "ref-1", "source_document_id": "SOURCE_DOCUMENT_ID", "location": "p. 1", "excerpt_or_reference": "short excerpt", "support_relation": "EXPLICIT_SOURCE"}}],
      "uncertainties": [{{"uncertainty_id": "u1", "question": "concise unresolved question", "affects": "outcome", "status": "OPEN"}}],
      "review_status": "NEEDS_REVIEW",
      "item_version": 1
    }}
  ]
}}

Replace SOURCE_DOCUMENT_ID with the supplied ID. Use EXPLICIT_SOURCE for direct evidence and AI_DERIVED only for a concise marked interpretation. Every item needs at least one short source_ref. For affects use only fact, ownership, outcome, or matching use; use status OPEN for unresolved questions. Use an empty uncertainties array when none exist. If nothing is supported, still return the inferred material_type with an empty items array.""".replace("__ITEM_TYPES__", json.dumps(sorted(ITEM_TYPES)))


def build_deepseek_candidate_proposal_payload(
    source_document_id: str, model: str, rendered_pages: list[tuple[str, bytes]], media_type: str = "image/jpeg",
) -> dict[str, Any]:
    """Build a JSON-mode vision request for one already-consented career material."""
    if not source_document_id or not model or not rendered_pages:
        raise CandidateProposalError("candidate_proposal_request_incomplete")
    content: list[dict[str, Any]] = [{"type": "text", "text": candidate_proposal_instruction()}]
    for page_number, image_bytes in rendered_pages:
        if not image_bytes:
            raise CandidateProposalError("candidate_proposal_page_missing")
        content.append({"type": "text", "text": f"Career-material page {page_number}. Source document ID: {source_document_id}."})
        content.append({"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"}})
    return {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
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
    try:
        material_type = normalized_material_type(raw.get("material_type"))
    except CandidateProposalError:
        return None, ["invalid_candidate_material_type"]
    items = raw.get("items")
    # The model instruction explicitly permits {"items": []} when the source
    # contains no grounded candidate experience.  An empty proposal is a valid,
    # review-only result; a missing or non-list value is not.
    if not isinstance(items, list):
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
        if "item_subtype" in item and (not isinstance(item["item_subtype"], str) or item["item_subtype"] not in ITEM_SUBTYPES.get(item.get("item_type"), set())):
            errors.append("invalid_item_subtype")
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
    return {"contract_id": CONTRACT_ID, "material_type": material_type, "items": normalized_items}, []


def extract_deepseek_candidate_proposal(
    provider_response: dict[str, Any], source_document_id: str, processing_run_id: str, model: str, *, provider: str = "deepseek",
) -> dict[str, Any]:
    """Parse JSON output into a non-authoritative proposal; never confirmed context."""
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
        "provider": provider,
        "model": model,
        "prompt_version": PROMPT_VERSION,
        "review_status": REVIEW_STATUS,
        "created_at": utc_timestamp(),
        "usage": usage,
        **normalized,
    }
