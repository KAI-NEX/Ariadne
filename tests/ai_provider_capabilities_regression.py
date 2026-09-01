"""Offline P4.1B provider capability regression; no credentials or network."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.ai_provider_capabilities import provider_catalog, select_deepseek_document_model, select_gemini_document_model

catalog = {item["provider_id"]: item for item in provider_catalog({"deepseek": True, "gemini": False})}
required = {"provider_id", "model_id", "credential_status", "supports_complete_document_review", "document_delivery", "supports_structured_output", "free_or_paid_status", "privacy_notice", "limits", "enabled"}
assert all(required <= set(item) for item in catalog.values())
assert catalog["deepseek"]["supports_complete_document_review"] and catalog["deepseek"]["document_delivery"] == "rendered_pdf_pages"
assert catalog["gemini"]["supports_complete_document_review"] and catalog["gemini"]["credential_status"] == "not_configured"
assert not catalog["groq"]["supports_complete_document_review"]
assert select_deepseek_document_model(["deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]) == "deepseek-v4-flash-vision-exp"
assert select_gemini_document_model({"models": [{"name": "models/account-model", "supportedGenerationMethods": ["generateContent"]}]}) == "account-model"
assert select_gemini_document_model({"models": []}) is None
print("provider_capability_contract=pass")
