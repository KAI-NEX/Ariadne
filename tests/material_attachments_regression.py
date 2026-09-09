"""Synthetic DOCX and all four conversation transports; no model call by default."""
import base64
import contextlib
import copy
import hashlib
import io
import json
import runpy
import zipfile
from pathlib import Path
from unittest.mock import patch
from src.material_delivery import DOCX, material_parts
from src.conversation_attachments import CONTRACT, augment_payload
from src.candidate_model_runtime import execute_candidate_model_request, candidate_model_operation_id, runtime_fingerprint
from src.candidate_conversation_runtime import execute_candidate_conversation_request, CandidateConversationRuntimeError
from src.job_conversation_runtime import execute_job_conversation_request
from src.personal_understanding_runtime import execute as personal_execute
from src.job_overview_runtime import execute as overview_execute

ROOT = Path(__file__).resolve().parents[1]
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=")

def docx(extra=None, image=PNG):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>合成研究项目：负责用户研究，未负责工程实现。</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格证据 2024–2025</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>')
        archive.writestr("word/header1.xml", '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>合成页眉</w:t></w:r></w:p></w:hdr>')
        archive.writestr("word/media/image1.png", image)
        for name, value in (extra or {}).items(): archive.writestr(name, value)
    return output.getvalue()

def envelope(request, files):
    snapshot = request["runtime_snapshot"]
    return {"contract_id": CONTRACT, "request_id": request.get("turn", {}).get("execution_id") or request.get("request_id"),
        "files": [{"name": name, "mime_type": mime, "size": len(raw), "content_hash": "sha256:" + hashlib.sha256(raw).hexdigest(), "data_url": f"data:{mime};base64," + base64.b64encode(raw).decode()} for name, mime, raw in files],
        "consent": {"confirmed": True, "provider": snapshot["provider"], "model": snapshot["model"], "purpose": "CURRENT_CONVERSATION_TURN"}}

def fixture(name):
    with contextlib.redirect_stdout(io.StringIO()): return runpy.run_path(str(ROOT / "tests" / name))

def main():
    parts = material_parts(DOCX, docx())
    assert sum(p["type"] == "image_url" for p in parts) == 1
    assert all(s in json.dumps(parts, ensure_ascii=False) for s in ("表格证据", "合成页眉", "未负责工程实现"))
    for raw in (b"bad", docx({"word/embeddings/object.bin": b"x"}), docx({"word/media/vector.svg": b"<svg/>"})):
        try: material_parts(DOCX, raw)
        except ValueError: pass
        else: raise AssertionError("invalid/incomplete DOCX accepted")
    rendered = material_parts("application/pdf", b"%PDF-synthetic", lambda _: [("1", b"\xff\xd8\xffpage1"), ("2", b"\xff\xd8\xffpage2")])
    assert sum(p["type"] == "image_url" for p in rendered) == 2
    f = fixture("candidate_model_runtime_regression.py"); request = f["request"](); raw = docx()
    digest = "sha256:" + hashlib.sha256(raw).hexdigest(); source_id = "source-candidate-" + digest[7:]
    request["source_document"].update(source_type="DOCX", mime_type=DOCX, filename="synthetic.docx", content_hash=digest, source_document_id=source_id, local_reference="indexeddb://synthetic/docx")
    request["document_data_url"] = f"data:{DOCX};base64," + base64.b64encode(raw).decode()
    request["consent"]["source_document_id"] = source_id
    op = candidate_model_operation_id(source_id, runtime_fingerprint(request["runtime_snapshot"]), request["consent"]["consent_id"])
    request["operation_identity"].update(operation_id=op, source_document_id=source_id)
    request["processing_run_id"] = "run-" + op
    item = f["valid_item"](); item["source_refs"][0]["source_document_id"] = source_id
    captured = []
    def provider(_, body):
        captured.append(body)
        return 200, f["response"](item)
    result = execute_candidate_model_request(request, lambda: "synthetic", lambda _: (_ for _ in ()).throw(AssertionError("DOCX passed to PDF renderer")), provider)
    assert result["rendered_page_count"] == 0 and result["outbound_image_count"] == 1
    assert result["source_delivery"] == "docx_text_and_embedded_images_v1" and "表格证据" in json.dumps(captured, ensure_ascii=False)
    c = fixture("candidate_conversation_runtime_regression.py")
    j = fixture("job_conversation_runtime_regression.py")
    p = fixture("personal_understanding_runtime_regression.py")
    o = fixture("job_overview_runtime_regression.py")
    cases = [("candidate", c["base_request"], execute_candidate_conversation_request, c["valid_response"]),
             ("job", j["request"](), execute_job_conversation_request, j["provider_response"](j["semantic"]())),
             ("personal", p["request"], personal_execute, None), ("overview", o["request"], overview_execute, None)]
    for name, request, execute, response in cases:
        request = copy.deepcopy(request)
        request["attachments"] = envelope(request, [("image.png", "image/png", PNG), ("source.docx", DOCX, docx()), ("readme.md", "text/markdown", b"Synthetic evidence")])
        captured = []
        def call(_, body):
            captured.append(body)
            if response is not None: return 200, response
            fixture_module = p if name == "personal" else o
            return fixture_module["provider"]("synthetic-secret-never-output" if name == "personal" else "synthetic-secret", body)
        execute(request, lambda: "synthetic", call)
        assert len(captured) == 1
        assert sum(part.get("type") == "image_url" for msg in captured[0]["messages"] if isinstance(msg["content"], list) for part in msg["content"]) == 2
        assert "data_url" not in json.dumps(captured[0]) and "CURRENT_CONVERSATION_TURN" not in json.dumps(captured[0])
        for change in (lambda r: r["attachments"]["consent"].update(confirmed=False), lambda r: r["attachments"].update(request_id="different-turn"),
                       lambda r: r["attachments"]["files"][0].update(content_hash="sha256:bad"), lambda r: r["attachments"].update(files=[])):
            invalid = copy.deepcopy(request); change(invalid)
            try: execute(invalid, lambda: "synthetic", lambda *_: (_ for _ in ()).throw(AssertionError("Provider called on invalid attachment")))
            except ValueError: pass
            else: raise AssertionError(name + " accepted invalid attachments")
    print("docx_import_and_four_conversation_attachment_transports=PASS")

if __name__ == "__main__": main()
