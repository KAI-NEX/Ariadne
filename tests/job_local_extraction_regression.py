"""Offline regression for real Local Job extraction and read-only source access."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app  # noqa: E402
from src.career_evidence import CareerDocumentError, extract_job_document_only  # noqa: E402
from src.execution_contract import create_runtime_snapshot  # noqa: E402
from src.job_conversation_runtime import (  # noqa: E402
    CREDENTIAL_REF, MANIFEST, MODEL_ID, OPERATION, PROVIDER_ID, RUNTIME,
)
from src.provider_runtime import deepseek_model_descriptors  # noqa: E402


SOURCE_ID = "source-job-" + "d" * 64


def data_url(media_type: str, content: bytes) -> str:
    return f"data:{media_type};base64," + base64.b64encode(content).decode("ascii")


def payload(filename: str, media_type: str, content: bytes, snapshot: dict | None = None) -> dict:
    value = {
        "filename": filename,
        "media_type": media_type,
        "source_document_id": SOURCE_ID,
        "document_data_url": data_url(media_type, content),
    }
    if snapshot is not None:
        value["runtime_snapshot"] = snapshot
    return value


def docx_bytes(text: str) -> bytes:
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>"
    )
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def real_pdf_bytes(text: str) -> bytes:
    with tempfile.TemporaryDirectory(prefix="ariadne-job-test-pdf-") as directory:
        source = Path(directory) / "real-job.txt"
        source.write_text(text, encoding="utf-8")
        result = subprocess.run(
            ["/usr/sbin/cupsfilter", "-m", "application/pdf", str(source)],
            check=True, capture_output=True, timeout=30,
        )
    assert result.stdout.startswith(b"%PDF")
    return result.stdout


def handler_for(request_payload: dict):
    handler = object.__new__(app.JobRadarHandler)
    body = json.dumps(request_payload).encode("utf-8")
    handler.headers = {"Content-Length": str(len(body))}
    handler.rfile = io.BytesIO(body)
    responses = []
    handler.send_json = lambda status, value: responses.append((status, value))
    return handler, responses


LOCAL_SNAPSHOT = create_runtime_snapshot(
    {"mode": "local"}, snapshot_id="runtime-snapshot-job-local-python",
    captured_at="2026-09-04T03:00:00Z", operation="JOB_LOCAL_IMPORT",
    schema_version=MANIFEST["job_context_payload_version"],
    environment_capabilities={"local_ocr": "supported"},
).to_dict()


MODEL_SNAPSHOT = create_runtime_snapshot(
    {"mode": "model", "provider": PROVIDER_ID, "model": MODEL_ID},
    model_descriptor=deepseek_model_descriptors([MODEL_ID])[0],
    snapshot_id="runtime-snapshot-job-source-read", captured_at="2026-09-04T03:10:00Z",
    credential_ref=CREDENTIAL_REF, adapter_version=RUNTIME["adapter_version"],
    prompt_version=RUNTIME["prompt_version"], schema_version=MANIFEST["semantic_output_version"],
    operation=OPERATION, capability_basis="adapter_verified",
    action_schema_version=MANIFEST["semantic_output_version"],
    request_config_version=RUNTIME["request_config_version"], delivery_method=None,
).to_dict()


def test_real_pdf_docx_and_pasted_job_content() -> None:
    pdf_text = "AI Systems Product Manager\nRequirements\nHuman in the loop"
    pdf = real_pdf_bytes(pdf_text)
    pdf_result = extract_job_document_only(
        payload("real-job.pdf", "application/pdf", pdf), app.PDF_TEXT_SCRIPT_PATH,
        app.PDF_VISUAL_OCR_SCRIPT_PATH,
    )
    assert "AI Systems Product Manager" in pdf_result["extracted_text"]
    assert pdf_result["content_hash"] == "sha256:" + hashlib.sha256(pdf).hexdigest()
    assert pdf_result["model_call_made"] is False

    docx = docx_bytes("Real DOCX Job Requirement: evidence-grounded AI systems")
    docx_result = extract_job_document_only(
        payload("real-job.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx),
        Path("unused"),
    )
    assert "evidence-grounded AI systems" in docx_result["extracted_text"]
    pasted = "Real pasted Job body\n- Preserve this requirement".encode()
    pasted_result = extract_job_document_only(payload("pasted-job.txt", "text/plain", pasted), Path("unused"))
    assert pasted_result["extracted_text"].endswith("Preserve this requirement")
    assert pasted_result["processing_boundary"] == "localhost_transient_job_extraction"


def test_local_route_uses_real_content_without_provider() -> None:
    content = b"Real local route Job\nRequirements\n- deterministic extraction"
    handler, responses = handler_for(payload("pasted-job.txt", "text/plain", content, LOCAL_SNAPSHOT))
    original_provider = app.call_deepseek_chat_completions
    app.call_deepseek_chat_completions = lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("Local Job must never call Provider"))
    try:
        handler.extract_local_job_source()
    finally:
        app.call_deepseek_chat_completions = original_provider
    assert responses[0][0] == 200
    assert responses[0][1]["extracted_text"].startswith("Real local route Job")
    assert responses[0][1]["model_call_made"] is False
    assert responses[0][1]["content_hash"] == "sha256:" + hashlib.sha256(content).hexdigest()


def test_job_image_temp_cleanup_success_and_failure() -> None:
    originals = app.decode_image_data_urls, app.run_apple_vision_ocr
    seen = []
    try:
        app.decode_image_data_urls = lambda _payload: [("image/png", b"synthetic-job-image")]

        def success(path: Path) -> dict:
            seen.append(path)
            assert path.is_file()
            return {"text": "Image Job Requirement", "line_count": 1}

        app.run_apple_vision_ocr = success
        handler, responses = handler_for({"filename": "job.png", "source_document_id": SOURCE_ID, "runtime_snapshot": LOCAL_SNAPSHOT})
        handler.extract_local_job_image()
        assert responses[0][0] == 200 and responses[0][1]["model_call_made"] is False
        assert not seen[0].exists()

        def failure(path: Path) -> dict:
            seen.append(path)
            assert path.is_file()
            raise CareerDocumentError("local_ocr_failed")

        app.run_apple_vision_ocr = failure
        handler, responses = handler_for({"filename": "job.png", "source_document_id": SOURCE_ID, "runtime_snapshot": LOCAL_SNAPSHOT})
        handler.extract_local_job_image()
        assert responses[0][0] == 400 and responses[0][1]["error"] == "local_ocr_failed"
        assert not seen[1].exists()
    finally:
        app.decode_image_data_urls, app.run_apple_vision_ocr = originals


def test_model_source_read_is_ephemeral_and_integrity_checked() -> None:
    content = b"Source-only detail: exact responsibility wording"
    request = {
        **payload("pasted-job.txt", "text/plain", content, MODEL_SNAPSHOT),
        "material_type": "JOB",
        "expected_content_hash": "sha256:" + hashlib.sha256(content).hexdigest(),
    }
    handler, responses = handler_for(request)
    original_provider = app.call_deepseek_chat_completions
    app.call_deepseek_chat_completions = lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("Source read must never call Provider"))
    try:
        handler.read_local_source_for_model()
    finally:
        app.call_deepseek_chat_completions = original_provider
    assert responses[0][0] == 200
    result = responses[0][1]
    assert result["extracted_text"].startswith("Source-only detail")
    assert result["read_only"] is True and result["writeback"] is False
    assert result["model_call_made"] is False and result["network_call_made"] is False

    corrupt = {**request, "expected_content_hash": "sha256:" + "0" * 64}
    handler, responses = handler_for(corrupt)
    handler.read_local_source_for_model()
    assert responses[0][0] == 422
    assert responses[0][1]["error"] == "source_read_integrity_mismatch"


def main() -> None:
    test_real_pdf_docx_and_pasted_job_content()
    test_local_route_uses_real_content_without_provider()
    test_job_image_temp_cleanup_success_and_failure()
    test_model_source_read_is_ephemeral_and_integrity_checked()
    print(json.dumps({
        "real_pdf_docx_pasted": "pass",
        "real_local_route": "pass",
        "image_temp_cleanup": "pass",
        "source_read_only": "pass",
        "local_provider_calls": 0,
    }))


if __name__ == "__main__":
    main()
