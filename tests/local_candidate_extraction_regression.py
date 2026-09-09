"""Offline Slice 4A regression for real Local Candidate extraction boundaries."""

from __future__ import annotations

import base64
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import app  # noqa: E402
import src.career_evidence as career_evidence  # noqa: E402
from src.career_evidence import CareerDocumentError, extract_career_document_only  # noqa: E402


SOURCE_ID = "source-candidate-" + "a" * 64


def data_url(media_type: str, content: bytes) -> str:
    return f"data:{media_type};base64," + base64.b64encode(content).decode("ascii")


def document_payload(filename: str, media_type: str, content: bytes) -> dict:
    return {
        "filename": filename,
        "media_type": media_type,
        "source_document_id": SOURCE_ID,
        "document_data_url": data_url(media_type, content),
    }


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


def test_real_text_docx_markdown_content() -> None:
    txt = b"Real candidate evidence A"
    markdown = b"# Real candidate evidence B\n\n- Project detail"
    docx = docx_bytes("Real candidate evidence C")
    txt_result = extract_career_document_only(document_payload("candidate.txt", "text/plain", txt), Path("unused"))
    markdown_result = extract_career_document_only(document_payload("candidate.md", "text/markdown", markdown), Path("unused"))
    docx_result = extract_career_document_only(document_payload("candidate.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx), Path("unused"))
    assert txt_result["content_hash"] == "sha256:" + hashlib.sha256(txt).hexdigest()
    assert markdown_result["content_hash"] == "sha256:" + hashlib.sha256(markdown).hexdigest()
    assert txt_result["content_hash"] != markdown_result["content_hash"]
    assert txt_result["extracted_text"] == "Real candidate evidence A"
    assert "Project detail" in markdown_result["extracted_text"]
    assert docx_result["pages"][0]["lines"] == ["Real candidate evidence C"]
    assert not {"candidate_entities", "proposal", "review_required"}.intersection(txt_result)


def test_pdf_ocr_authority_is_passed_to_existing_selective_extractor() -> None:
    original = career_evidence._selective_pdf_pages
    observed = []

    def fake_selective(content, pdf_script, visual_script):
        observed.append(visual_script)
        return ([{"page": 1, "lines": [content.decode("ascii")], "source_method": "native_pdf"}], "native_pdf", ["pdf_pages_without_usable_text"] if visual_script is None else [])

    career_evidence._selective_pdf_pages = fake_selective
    try:
        payload = document_payload("candidate.pdf", "application/pdf", b"PDF A")
        second_payload = document_payload("candidate.pdf", "application/pdf", b"PDF B")
        unavailable = extract_career_document_only(payload, Path("native"), None)
        supported = extract_career_document_only(payload, Path("native"), Path("vision"))
        changed = extract_career_document_only(second_payload, Path("native"), None)
    finally:
        career_evidence._selective_pdf_pages = original
    assert observed == [None, Path("vision"), None]
    assert unavailable["warnings"] == ["pdf_pages_without_usable_text"]
    assert supported["content_hash"] == unavailable["content_hash"]
    assert changed["content_hash"] != unavailable["content_hash"]


def test_truthful_input_failures_and_pdf_no_ocr_fail_closed() -> None:
    def expect(code: str, callback) -> None:
        try:
            callback()
            raise AssertionError(f"expected {code}")
        except CareerDocumentError as error:
            assert str(error) == code

    expect("document_extension_mismatch", lambda: extract_career_document_only(document_payload("candidate.pdf", "text/plain", b"text"), Path("unused")))
    expect("text_document_not_utf8", lambda: extract_career_document_only(document_payload("candidate.txt", "text/plain", b"\xff"), Path("unused")))
    expect("docx_text_extraction_failed", lambda: extract_career_document_only(document_payload("candidate.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"broken"), Path("unused")))
    expect("invalid_document_size", lambda: extract_career_document_only(document_payload("candidate.txt", "text/plain", b"x" * 30_000_001), Path("unused")))

    original_pages, original_visual = career_evidence._pdf_pages, career_evidence._pdf_visual_pages
    try:
        career_evidence._pdf_pages = lambda *_args: [{"page": 1, "lines": []}]
        career_evidence._pdf_visual_pages = lambda *_args: (_ for _ in ()).throw(AssertionError("OCR must not run"))
        expect("pdf_visual_ocr_unavailable", lambda: extract_career_document_only(document_payload("candidate.pdf", "application/pdf", b"empty"), Path("native"), None))
    finally:
        career_evidence._pdf_pages, career_evidence._pdf_visual_pages = original_pages, original_visual


def bare_handler(payload: dict):
    handler = object.__new__(app.JobRadarHandler)
    body = json.dumps(payload).encode("utf-8")
    handler.headers = {"Content-Length": str(len(body))}
    handler.rfile = io.BytesIO(body)
    calls = []
    handler.send_json = lambda status, value: calls.append((status, value))
    return handler, calls


def test_candidate_image_temp_cleanup_on_success_and_failure() -> None:
    snapshot = {"snapshot_id": "runtime-snapshot-local-image", "capabilities": {"local_ocr": "supported"}}
    originals = app.local_snapshot_from_payload, app.decode_image_data_urls, app.run_apple_vision_ocr
    seen_paths = []
    try:
        app.local_snapshot_from_payload = lambda _payload: snapshot
        app.decode_image_data_urls = lambda _payload: [("image/png", b"synthetic-image")]

        def success(path):
            seen_paths.append(path)
            assert path.is_file()
            return {"text": "Synthetic OCR", "line_count": 1}

        app.run_apple_vision_ocr = success
        handler, calls = bare_handler({"filename": "candidate.png", "source_document_id": SOURCE_ID})
        handler.extract_local_candidate_image()
        assert calls[0][0] == 200 and calls[0][1]["model_call_made"] is False
        assert not seen_paths[0].exists()

        def failure(path):
            seen_paths.append(path)
            assert path.is_file()
            raise CareerDocumentError("local_ocr_failed")

        app.run_apple_vision_ocr = failure
        handler, calls = bare_handler({"filename": "candidate.png", "source_document_id": SOURCE_ID})
        handler.extract_local_candidate_image()
        assert calls[0][0] == 400 and calls[0][1]["error"] == "local_ocr_failed"
        assert not seen_paths[1].exists()
    finally:
        app.local_snapshot_from_payload, app.decode_image_data_urls, app.run_apple_vision_ocr = originals


def test_probe_requires_executed_swift_vision_boundary() -> None:
    original_uname, original_run = app.os.uname, app.subprocess.run
    try:
        app.os.uname = lambda: SimpleNamespace(sysname="Darwin")
        app.subprocess.run = lambda *args, **kwargs: SimpleNamespace(returncode=0, stdout='{"local_ocr":"supported"}')
        assert app.local_ocr_environment_capability() == "supported"
        app.subprocess.run = lambda *args, **kwargs: SimpleNamespace(returncode=1, stdout="")
        assert app.local_ocr_environment_capability() == "unsupported"
        app.os.uname = lambda: SimpleNamespace(sysname="Linux")
        assert app.local_ocr_environment_capability() == "unsupported"
    finally:
        app.os.uname, app.subprocess.run = original_uname, original_run


def main() -> None:
    test_real_text_docx_markdown_content()
    test_pdf_ocr_authority_is_passed_to_existing_selective_extractor()
    test_truthful_input_failures_and_pdf_no_ocr_fail_closed()
    test_candidate_image_temp_cleanup_on_success_and_failure()
    test_probe_requires_executed_swift_vision_boundary()
    print(json.dumps({
        "real_content_extraction": "pass",
        "pdf_ocr_authority": "pass",
        "candidate_image_temp_cleanup": "pass",
        "local_ocr_probe": "pass",
        "provider_call_made": False,
    }))


if __name__ == "__main__":
    main()
