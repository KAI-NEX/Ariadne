"""Image/PDF admission applies to every Provider and every new execution."""
import contextlib
from dataclasses import replace
import io
from pathlib import Path
import runpy

from src.provider_runtime import deepseek_model_descriptors, is_runtime_eligible

ROOT = Path(__file__).resolve().parent.parent
vision = deepseek_model_descriptors(["deepseek-flash"])[0]
for provider in ["deepseek", "gemini", "qwen", "future-provider"]:
    qualified = replace(vision, provider_id=provider)
    assert is_runtime_eligible(qualified)
    assert is_runtime_eligible(replace(qualified, document_delivery="original_pdf"))
    for override in [
        {"capabilities": ("TEXT",)}, {"multimodal_readiness": "UNVERIFIED"},
        {"supports_complete_document_review": False}, {"document_delivery": "text_extraction"},
        {"document_delivery": None}, {"runtime_capability_basis": "account_discovered"},
        {"runtime_capabilities": {**vision.runtime_capabilities, "vision": "unsupported"}},
    ]:
        assert not is_runtime_eligible(replace(qualified, **override))

for domain, builder, executor in [
    ("candidate", "request_for", "execute_candidate_conversation_request"),
    ("job", "request", "execute_job_conversation_request"),
]:
    with contextlib.redirect_stdout(io.StringIO()):
        suite = runpy.run_path(str(ROOT / f"tests/{domain}_conversation_runtime_regression.py"))
    for model in ["deepseek-v4-pro", "deepseek-v4-flash", "invented-vision"]:
        request = suite[builder]()
        request["runtime_snapshot"]["model"] = model
        calls = []
        try:
            suite[executor](request, lambda: calls.append("credential"), lambda *_: calls.append("provider"))
            raise AssertionError("text/unknown runtime executed")
        except ValueError as error:
            assert getattr(error, "failure_layer", None) == "runtime"
        assert calls == []

print("multimodal_runtime_policy=pass; text_and_unknown_conversation_blocked_before_credentials")
