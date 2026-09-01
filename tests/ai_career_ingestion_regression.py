"""Offline P4.1B contract regression; never performs a provider call."""

from __future__ import annotations

import base64
import hashlib
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.ai_career_ingestion import (  # noqa: E402
    AICareerIngestionError,
    PROMPT_VERSION,
    build_gemini_payload,
    build_deepseek_payload,
    decode_original_document,
    extract_gemini_markdown,
    extract_deepseek_markdown,
    validate_canonical_markdown,
)


def data_url(content: bytes) -> str:
    return "data:application/pdf;base64," + base64.b64encode(content).decode("ascii")


def valid_markdown(document_type: str) -> str:
    if document_type == "resume":
        sections = [
            "认识论标记", "来源与页码", "基本信息", "工作经历", "教育经历",
            "项目", "技能与工具", "语言", "奖项", "证书", "出版物", "志愿与其他经历", "待人工归类的原文片段", "不确定 / 原文未明确",
        ]
    else:
        sections = ["认识论标记", "来源与页码", "作品集概览", "项目", "跨页关系", "不确定 / 原文未明确"]
    body = ["# 职业材料 Canonical Context"]
    for index, section in enumerate(sections, start=1):
        body.extend([
            f"## {section}",
            f"- [原文明确支持] 保留原文明确细节 {index}，不压缩、不改写原始关系，并记录可追溯页码（来源：p. {index}）。",
            "- [AI 解释] 有边界的解释，明确标注支持范围，不成为原文主张，也不补充未给出的事实（来源：p. 1）。",
            "- [原文未明确 / 未知] 未获来源支持的字段保持未知，不能基于视觉、常识或上下文臆测补全。",
        ])
    return "\n".join(body)


def main() -> None:
    original_bytes = b"%PDF-1.7\nfixture original career material\n%%EOF"
    source_hash = hashlib.sha256(original_bytes).hexdigest()
    document = decode_original_document({
        "filename": "real-shape-resume.pdf",
        "media_type": "application/pdf",
        "document_type": "resume",
        "document_data_url": data_url(original_bytes),
        "source_hash": source_hash,
    })
    assert document.source_hash == source_hash
    assert document.source_document_id == f"source-{source_hash[:20]}"
    payload = build_gemini_payload(document, "account-returned-model")
    file_input = payload["input"][0]
    assert file_input["type"] == "document" and file_input["mime_type"] == "application/pdf"
    assert "DocumentBlock" not in json.dumps(payload["input"], ensure_ascii=False)
    assert "local OCR" not in json.dumps(payload["input"], ensure_ascii=False)
    assert "[原文明确支持]" in payload["input"][1]["text"]
    deepseek_payload = build_deepseek_payload(document, "account-vision-model", [("1", b"jpeg-page-one"), ("2", b"jpeg-page-two")])
    assert deepseek_payload["messages"][0]["content"][2]["type"] == "image_url"
    assert "第 2 页" in deepseek_payload["messages"][0]["content"][3]["text"]
    assert PROMPT_VERSION == "canonical_career_context_v2_flexible"
    assert "固定表单" in payload["input"][1]["text"]
    assert "待人工归类的原文片段" in payload["input"][1]["text"]

    resume_markdown = valid_markdown("resume")
    portfolio_markdown = valid_markdown("portfolio")
    assert not validate_canonical_markdown(resume_markdown, "resume")
    assert not validate_canonical_markdown(portfolio_markdown, "portfolio")
    assert "canonical_markdown_too_short" in validate_canonical_markdown("# 职业材料 Canonical Context", "resume")
    assert extract_gemini_markdown({"steps": [{"content": [{"text": resume_markdown}]}]}) == resume_markdown
    assert extract_deepseek_markdown({"choices": [{"message": {"content": resume_markdown}}]}) == resume_markdown

    try:
        decode_original_document({
            "filename": "resume.docx", "media_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "document_type": "resume", "document_data_url": "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAAA",
        })
    except AICareerIngestionError as error:
        assert str(error) == "ai_mode_requires_original_pdf"
    else:
        raise AssertionError("DOCX must fail closed in the first original-file multimodal slice")

    try:
        decode_original_document({
            "filename": "resume.pdf", "media_type": "application/pdf", "document_type": "resume",
            "document_data_url": data_url(original_bytes), "source_hash": "0" * 64,
        })
    except AICareerIngestionError as error:
        assert str(error) == "source_hash_mismatch"
    else:
        raise AssertionError("source identity mismatch must fail closed")

    print(json.dumps({
        "direct_original_file_payload": "pass",
        "deepseek_complete_document_payload": "pass",
        "canonical_resume_contract": "pass",
        "canonical_portfolio_contract": "pass",
        "source_identity": "pass",
        "unsupported_input_fails_closed": "pass",
        "network_call_made": False,
    }, indent=2))


if __name__ == "__main__":
    main()
