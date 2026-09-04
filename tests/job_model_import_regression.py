"""Offline contract regression for Job Model Import and Local isolation."""

from __future__ import annotations

import base64
import hashlib
import json
import sys
from dataclasses import replace
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.execution_contract import create_runtime_snapshot  # noqa: E402
from src.job_model_runtime import (  # noqa: E402
    CREDENTIAL_REF, MANIFEST, MODEL_ID, OPERATION, PREPARATION_CONTRACT,
    PROPOSAL_CONTRACT, PROVIDER_ID, REQUEST_CONTRACT, RESULT_CONTRACT, RUNTIME,
    JobModelRuntimeError, build_job_model_payload, execute_job_model_request,
    job_model_import_runtime_signature, job_model_operation_id, runtime_fingerprint,
    validate_job_model_request,
)
from src.provider_runtime import deepseek_model_descriptors  # noqa: E402


base_descriptor = deepseek_model_descriptors([MODEL_ID])[0]
descriptor = replace(
    base_descriptor,
    runtime_capabilities={**base_descriptor.runtime_capabilities, "job_model_structuring": "supported"},
    adapter_version=RUNTIME["adapter_version"],
    delivery_method=RUNTIME["delivery_method"],
)
snapshot = create_runtime_snapshot(
    {"mode": "model", "provider": PROVIDER_ID, "model": MODEL_ID},
    model_descriptor=descriptor,
    snapshot_id="runtime-snapshot-job-model-import", captured_at="2026-09-04T07:00:00Z",
    credential_ref=CREDENTIAL_REF, adapter_version=RUNTIME["adapter_version"],
    prompt_version=RUNTIME["prompt_version"], schema_version=PROPOSAL_CONTRACT,
    operation=OPERATION, capability_basis="adapter_verified",
    action_schema_version=PROPOSAL_CONTRACT, request_config_version=RUNTIME["request_config_version"],
    delivery_method=RUNTIME["delivery_method"],
).to_dict()
content_hash = "sha256:" + "a" * 64
source_id = "source-job-" + "a" * 64
source = {
    "contract_id": "ariadne-source-document-v1", "source_document_id": source_id,
    "source_type": "PASTED_TEXT", "filename": "job.txt", "label": None, "mime_type": "text/plain",
    "content_hash": content_hash, "created_at": "2026-09-04T07:00:00Z", "material_type": "JOB",
    "local_reference": "indexeddb://private/source", "batch_id": "job-batch-private",
    "provenance": {"supplied_by": "USER"}, "authority": "SOURCE_INPUT_ONLY",
}
blocks = [
    {"source_ref": "job-source-block-1", "location": "lines 1-3", "text": "AI Systems Product Manager\nAriadne Labs 科技公司\n工作地点：上海"},
    {"source_ref": "job-source-block-2", "location": "lines 4-6", "text": "任职要求\n有 AI 产品落地经验\n能设计 Human-in-the-loop 评估"},
]
preparation = {
    "contract_id": PREPARATION_CONTRACT, "source_document_id": source_id, "content_hash": content_hash,
    "source_type": "PASTED_TEXT", "mime_type": "text/plain", "extraction_method": "ephemeral_text_read_v1",
    "read_only": True, "writeback": False, "semantic_structuring": False,
    "blocks": blocks, "character_count": sum(len(block["text"]) for block in blocks),
}
consent = {
    "explicitly_confirmed": True, "consent_id": "consent-job-model-import-test",
    "source_document_id": source_id, "provider": PROVIDER_ID, "model": MODEL_ID,
    "delivery_method": RUNTIME["delivery_method"], "confirmed_at": "2026-09-04T07:00:01Z",
}
operation_id = job_model_operation_id(source_id, runtime_fingerprint(snapshot), consent["consent_id"])


def request() -> dict:
    return {
        "contract_id": REQUEST_CONTRACT, "source_document": source, "source_preparation": preparation,
        "runtime_snapshot": snapshot, "processing_run_id": f"run-{operation_id}", "consent": consent,
        "operation_identity": {
            "operation_id": operation_id, "operation_type": "JOB_MODEL_SEMANTIC_STRUCTURING",
            "source_document_id": source_id, "runtime_fingerprint": runtime_fingerprint(snapshot),
            "consent_id": consent["consent_id"],
        },
    }


def proposal() -> dict:
    return {
        "contract_id": PROPOSAL_CONTRACT,
        "title": {"value": "AI Systems Product Manager", "source_refs": ["job-source-block-1"]},
        "company": {"value": "Ariadne Labs 科技公司", "source_refs": ["job-source-block-1"]},
        "location": {"value": "上海", "source_refs": ["job-source-block-1"]},
        "summary": {"value": "负责证据驱动的 AI 产品系统。", "source_refs": ["job-source-block-2"]},
        "requirements": [
            {"label": "AI 产品落地", "detail": "有 AI 产品落地经验", "source_refs": ["job-source-block-2"]},
            {"label": "Human-in-the-loop", "detail": "能设计 Human-in-the-loop 评估", "source_refs": ["job-source-block-2"]},
        ],
        "uncertainties": [],
    }


def provider_response(body: dict | None = None) -> dict:
    return {"model": MODEL_ID, "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(body or proposal(), ensure_ascii=False)}}], "usage": {"prompt_tokens": 20, "completion_tokens": 30}}


def expect(code: str, callback) -> None:
    try:
        callback()
        raise AssertionError(f"expected {code}")
    except JobModelRuntimeError as error:
        assert error.code == code, (error.code, code)


validated = validate_job_model_request(request())
payload = build_job_model_payload(validated)
serialized = json.dumps(payload, ensure_ascii=False)
assert payload["model"] == MODEL_ID and payload["temperature"] == 0
for forbidden in [source_id, content_hash, "indexeddb://", "/Users/", "job-batch-private"]:
    assert forbidden not in serialized
assert "job-source-block-1" in serialized and "AI Systems Product Manager" in serialized

calls = []
result = execute_job_model_request(request(), lambda: "synthetic-key", lambda key, body: (calls.append((key, body)) or (200, provider_response())))
assert len(calls) == 1
assert result["contract_id"] == RESULT_CONTRACT and result["network_call_made"] is True
assert result["persistence"] == "browser_working_job_save_required"
assert result["job_proposal"]["requirements"][0]["source_refs"] == ["job-source-block-2"]

invalid = proposal()
invalid["requirements"][0]["source_refs"] = ["source-job-private"]
expect("job_model_grounding_validation_failed", lambda: execute_job_model_request(request(), lambda: "synthetic-key", lambda *_: (200, provider_response(invalid))))

failed_calls = []
expect("deepseek_provider_http_error", lambda: execute_job_model_request(request(), lambda: "synthetic-key", lambda key, body: (failed_calls.append((key, body)) or (503, {}))))
assert len(failed_calls) == 1

missing_key_calls = []
expect("deepseek_key_not_configured", lambda: execute_job_model_request(request(), lambda: None, lambda *_: missing_key_calls.append(True)))
assert missing_key_calls == []
assert job_model_import_runtime_signature()["adapter_version"] == "deepseek-job-multimodal-import-v2"

second_image = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
second_hash = "sha256:" + hashlib.sha256(second_image).hexdigest()
second_source_id = "source-job-" + second_hash.removeprefix("sha256:")
second_source = {
    **source,
    "source_document_id": second_source_id,
    "content_hash": second_hash,
    "filename": "job-page-2.png",
    "source_type": "IMAGE",
    "mime_type": "image/png",
}
second_preparation = {
    **preparation,
    "source_document_id": second_source_id,
    "content_hash": second_hash,
    "source_type": "IMAGE",
    "mime_type": "image/png",
    "blocks": [{"source_ref": "job-source-2-block-1", "location": "lines 1-4", "text": "任职要求\n具备 AI 产品系统经验\n网站服务\n隐私与法律信息"}],
}
second_preparation["character_count"] = sum(len(block["text"]) for block in second_preparation["blocks"])
bundle_id = "job-source-bundle-" + "c" * 64
bundle_snapshot = {**snapshot, "operation": "JOB_IMAGE_IMPORT", "snapshot_id": "runtime-snapshot-job-model-image-import"}
bundle_consent = {**consent, "source_document_id": bundle_id, "consent_id": "consent-job-model-bundle-regression"}
bundle_operation_id = job_model_operation_id(bundle_id, runtime_fingerprint(bundle_snapshot), bundle_consent["consent_id"])
bundle_request = {
    "contract_id": REQUEST_CONTRACT,
    "source_bundle": {
        "contract_id": "ariadne-source-bundle-v1",
        "source_bundle_id": bundle_id,
        "source_document_ids": [source_id, second_source_id],
        "source_count": 2,
        "ordering": "USER_SUPPLIED",
    },
    "source_documents": [source, second_source],
    "source_preparations": [
        {**preparation, "blocks": [{**blocks[0], "source_ref": "job-source-1-block-1"}], "character_count": len(blocks[0]["text"])},
        second_preparation,
    ],
    "source_inputs": [{
        "source_document_id": second_source_id,
        "image_data_url": "data:image/png;base64," + base64.b64encode(second_image).decode("ascii"),
    }],
    "runtime_snapshot": bundle_snapshot,
    "processing_run_id": f"run-{bundle_operation_id}",
    "consent": bundle_consent,
    "operation_identity": {
        "operation_id": bundle_operation_id,
        "operation_type": "JOB_MODEL_SEMANTIC_STRUCTURING",
        "source_document_id": bundle_id,
        "runtime_fingerprint": runtime_fingerprint(bundle_snapshot),
        "consent_id": bundle_consent["consent_id"],
    },
}
bundle_proposal = proposal()
for field in ("title", "company", "location"):
    bundle_proposal[field]["source_refs"] = ["job-source-1-block-1"]
bundle_proposal["requirements"] = [{"label": "AI 产品系统", "detail": "具备 AI 产品系统经验", "source_refs": ["job-source-2-block-1"]}]
bundle_proposal["summary"] = {"value": None, "source_refs": []}
bundle_calls = []
bundle_result = execute_job_model_request(bundle_request, lambda: "synthetic-key", lambda key, body: (bundle_calls.append(body) or (200, provider_response(bundle_proposal))))
assert len(bundle_calls) == 1
assert len(bundle_calls[0]["messages"][1]["content"]) == 3
assert len(json.loads(bundle_calls[0]["messages"][1]["content"][0]["text"])["job_source"]["sources"]) == 2
assert bundle_calls[0]["messages"][1]["content"][2]["image_url"]["url"].startswith("data:image/png;base64,")
assert bundle_result["source_document_ids"] == [source_id, second_source_id]
assert bundle_result["source_bundle_id"] == bundle_id
assert "page chrome" in build_job_model_payload(validate_job_model_request(bundle_request))["messages"][0]["content"]

print(json.dumps({
    "job_model_source_preparation_only": "pass",
    "provider_safe_source_refs": "pass",
    "provider_calls_per_model_import": 1,
    "model_failure_no_local_fallback": "pass",
    "runtime_signature": "pass",
    "ordered_multi_source_bundle": "pass",
    "page_chrome_semantic_boundary": "pass",
}))
