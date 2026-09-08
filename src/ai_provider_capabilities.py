"""Capability contracts for P4.1B Career Material AI providers.

This catalogue intentionally models text, image and original-PDF input
separately.  A chat-compatible endpoint must never be treated as a document
understanding adapter without an explicit provider capability.
"""

from __future__ import annotations

from typing import Any
from src.provider_runtime import deepseek_model_descriptors, v1_runtime_selector_descriptors


GEMINI_MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions"
DEEPSEEK_MODELS_ENDPOINT = "https://api.deepseek.com/models"
# Exact official image + PDF input contracts, checked 2026-09-08. Listing methods
# alone are not evidence; these entries do not enable an Ariadne domain adapter.
GEMINI_DOCUMENT_MODELS = ("gemini-3.7-flash", "gemini-3.1-flash-lite")


def provider_catalog(credentials: dict[str, bool], gemini_model: str | None = None) -> list[dict[str, Any]]:
    """Return presentation-safe capability records; never include credentials."""
    return [
        {
            "provider_id": "deepseek", "model_id": None,
            "credential_status": "configured" if credentials.get("deepseek") else "not_configured",
            "supports_complete_document_review": True, "document_delivery": "rendered_pdf_pages",
            "supports_structured_output": True, "free_or_paid_status": "account_quota_or_paid_unknown",
            "privacy_notice": "完整职业资料会先在本机转为全部 PDF 页面图像，再由用户主动发送给 DeepSeek。",
            "limits": {"document_delivery": "rendered_pdf_pages"}, "enabled": True,
        },
        {
            "provider_id": "gemini", "model_id": gemini_model,
            "credential_status": "configured" if credentials.get("gemini") else "not_configured",
            "supports_complete_document_review": True, "document_delivery": "original_pdf",
            "supports_structured_output": True, "free_or_paid_status": "free_tier_possible_pending_model_check",
            "privacy_notice": "免费层的内容与响应可能用于改进 Google 产品，并可能由人工审核；发送前必须逐次确认。",
            "limits": {"inline_pdf_max_bytes": 50_000_000, "inline_pdf_max_pages": 1000}, "enabled": True,
        },
        {
            "provider_id": "groq", "model_id": None,
            "credential_status": "not_checked",
            "supports_complete_document_review": False, "document_delivery": "not_implemented",
            "supports_structured_output": True, "free_or_paid_status": "account_plan_unknown",
            "privacy_notice": "当前未接入完整职业资料验证。",
            "limits": {"document_delivery": "not_implemented"}, "enabled": False,
        },
    ]


def select_gemini_document_model(model_listing: dict[str, Any]) -> str | None:
    """Select only a model actually returned by the account's model listing."""
    candidates: list[str] = []
    for item in model_listing.get("models") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").removeprefix("models/").strip()
        methods = item.get("supportedGenerationMethods") or []
        if name in GEMINI_DOCUMENT_MODELS and ("generateContent" in methods or "interactions" in methods):
            candidates.append(name)
    candidates.sort(key=GEMINI_DOCUMENT_MODELS.index)
    return candidates[0] if candidates else None


def select_deepseek_document_model(model_ids: list[str]) -> str | None:
    """Use only the account-returned experimental vision model for rendered-page review."""
    eligible = v1_runtime_selector_descriptors(deepseek_model_descriptors(model_ids))
    return eligible[0].model_id if eligible else None
