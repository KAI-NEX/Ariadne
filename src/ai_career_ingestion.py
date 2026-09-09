"""P4.1B direct multimodal career-document ingestion contracts.

This module deliberately does not import or call the local DocumentBlock/OCR
pipeline. It validates one preserved original document, builds a Gemini direct
document request with that original file, and validates the returned
high-fidelity Markdown before the browser may persist it.
"""

from __future__ import annotations

import base64
import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from src.upload_limits import MAX_FILE_BYTES


CONTRACT_ID = "job-radar-canonical-career-context-v1"
PROMPT_VERSION = "canonical_career_context_v2_flexible"
DEFAULT_MODEL = ""
MAX_ORIGINAL_BYTES = MAX_FILE_BYTES
SUPPORTED_DOCUMENT_TYPES = {"resume", "portfolio"}
SUPPORTED_MEDIA_TYPES = {"application/pdf"}
EPISTEMIC_MARKERS = (
    "[原文明确支持]",
    "[AI 解释]",
    "[原文未明确 / 未知]",
)


class AICareerIngestionError(ValueError):
    """A fail-closed input, provider-output, or contract error."""


@dataclass(frozen=True)
class OriginalDocument:
    filename: str
    media_type: str
    document_type: str
    content: bytes
    source_hash: str
    source_document_id: str
    data_url: str


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def decode_original_document(payload: dict) -> OriginalDocument:
    """Validate and hash the exact file bytes that will be sent to the provider."""
    try:
        filename = str(payload["filename"]).strip()
        media_type = str(payload["media_type"]).strip().lower()
        document_type = str(payload["document_type"]).strip().lower()
        data_url = str(payload["document_data_url"])
        header, encoded = data_url.split(",", 1)
    except (KeyError, TypeError, ValueError) as error:
        raise AICareerIngestionError("invalid_original_document") from error
    if not filename or len(filename) > 240 or document_type not in SUPPORTED_DOCUMENT_TYPES:
        raise AICareerIngestionError("invalid_original_document_metadata")
    if media_type not in SUPPORTED_MEDIA_TYPES or header != f"data:{media_type};base64":
        raise AICareerIngestionError("ai_mode_requires_original_pdf")
    try:
        content = base64.b64decode(encoded, validate=True)
    except ValueError as error:
        raise AICareerIngestionError("invalid_original_document_encoding") from error
    if not content or len(content) > MAX_ORIGINAL_BYTES:
        raise AICareerIngestionError("original_document_exceeds_provider_limit")
    source_hash = hashlib.sha256(content).hexdigest()
    expected_hash = str(payload.get("source_hash") or "").strip().lower()
    if expected_hash and expected_hash != source_hash:
        raise AICareerIngestionError("source_hash_mismatch")
    return OriginalDocument(
        filename=filename,
        media_type=media_type,
        document_type=document_type,
        content=content,
        source_hash=source_hash,
        source_document_id=f"source-{source_hash[:20]}",
        data_url=data_url,
    )


def canonical_instruction(document_type: str) -> str:
    """Loss-minimized Markdown contract with an explicit fact/interpretation boundary."""
    if document_type not in SUPPORTED_DOCUMENT_TYPES:
        raise AICareerIngestionError("unsupported_ai_document_type")
    shared = """请从所附原始职业材料创建可复用、高保真的 Canonical Career Context。阅读原文、版式、视觉层级、图片、图注及跨页关系；保留细节，不要写简短摘要。
绝不编造职位、职责、成果、指标、日期、工具、技能或关系。AI 的能力解释绝不可伪装成原文事实。

只返回 Markdown，不要代码围栏。每条事实或解释 bullet 都必须使用以下标记：
- [原文明确支持]：原文明确支持，并带页码，例如（来源：p. 3）或页码范围。
- [AI 解释]：有用的解释，绝不表述为原文事实，并带支持页码。
- [原文未明确 / 未知]：材料没有说明的必要信息。

必须严格从 `# 职业材料 Canonical Context` 开始，包含 `## 认识论标记` 和 `## 来源与页码`。保留歧义而非自行消解。人名、公司名、学校名、原始职位名、项目名、软件/工具、模型名、技术术语和原始引用保持原文语言。

这是灵活的材料模型，不是固定表单：不得为了填满 company、role、email、location、institution 等字段而猜测或错配文字。任何不能稳定归入标准类别的原文，应保留在最贴近的实体下，或放到 `## 待人工归类的原文片段`，保留页码、原文和不确定原因。每个实体只写原文实际支持的字段；缺失字段不要用其他文字硬填。"""
    if document_type == "resume":
        structure = """

使用以下中文章节：
## 认识论标记
## 来源与页码
## 基本信息
## 工作经历
每段工作将 company、role、dates、location、responsibilities、projects/contributions 和明确 outcomes 保持在同一条实体中。
## 教育经历
## 项目
## 技能与工具
## 语言
## 奖项
## 证书
## 出版物
## 志愿与其他经历
## 待人工归类的原文片段
## 不确定 / 原文未明确

不要因章节罕见而遗漏。空类别必须有一条 [原文未明确 / 未知]，不得编造。"""
    else:
        structure = """

使用以下中文章节：
## 认识论标记
## 来源与页码
## 作品集概览
## 项目
每个真实项目使用 `### 项目：<原始项目标题>`；CASE/分类标签只能作为元数据，不能代替项目名。每项目保留来源页、context、problem、用户 role/responsibility、process、decisions、methods、tools、outputs、明确 outcomes、视觉证据、跨页关系及 limitations。原文支持连续性时，将跨页项目保持为一个实体。概览、联系、目录、分类页或泛化流程页不得提升为假项目。
## 跨页关系
## 不确定 / 原文未明确

项目边界确有歧义时，记录候选读法及页码，不得强行确定。"""
    return shared + structure


def build_gemini_payload(document: OriginalDocument, model: str) -> dict:
    selected_model = str(model or "").strip()
    if not selected_model or len(selected_model) > 120:
        raise AICareerIngestionError("invalid_model_id")
    return {
        "model": selected_model,
        "input": [{"type": "document", "data": base64.b64encode(document.content).decode("ascii"), "mime_type": document.media_type},
                  {"type": "text", "text": canonical_instruction(document.document_type)}],
    }


def build_deepseek_payload(document: OriginalDocument, model: str, rendered_pages: list[tuple[str, bytes]]) -> dict:
    if not model or not rendered_pages:
        raise AICareerIngestionError("deepseek_rendered_pages_required")
    content: list[dict] = [{"type": "text", "text": canonical_instruction(document.document_type)}]
    for page_number, image_bytes in rendered_pages:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        content.append({"type": "text", "text": f"以下是原始职业 PDF 第 {page_number} 页。"})
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded}"}})
    return {"model": model, "messages": [{"role": "user", "content": content}], "temperature": 0}


def extract_deepseek_markdown(provider_response: dict) -> str:
    try:
        return str(provider_response["choices"][0]["message"]["content"]).strip()
    except (KeyError, IndexError, TypeError) as error:
        raise AICareerIngestionError("deepseek_response_missing_content") from error


def extract_gemini_markdown(provider_response: dict) -> str:
    direct = provider_response.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    parts: list[str] = []
    for step in provider_response.get("steps") or []:
        for content in step.get("content") or []:
            if isinstance(content, dict) and isinstance(content.get("text"), str): parts.append(content["text"])
    for candidate in provider_response.get("candidates") or []:
        for content in (candidate.get("content") or {}).get("parts") or []:
            if isinstance(content, dict) and isinstance(content.get("text"), str): parts.append(content["text"])
    return "\n".join(parts).strip()


def validate_canonical_markdown(markdown: str, document_type: str) -> list[str]:
    errors: list[str] = []
    text = str(markdown or "").strip()
    if len(text) < 800:
        errors.append("canonical_markdown_too_short")
    if not text.startswith("# 职业材料 Canonical Context"):
        errors.append("canonical_markdown_heading_missing")
    required = ["认识论标记", "来源与页码", "不确定 / 原文未明确"]
    required += (["基本信息", "工作经历", "教育经历", "项目", "技能与工具"]
                 if document_type == "resume" else ["作品集概览", "项目", "跨页关系"])
    headings = {match.group(1).strip() for match in re.finditer(r"(?m)^##\s+(.+?)\s*$", text)}
    errors.extend(f"canonical_section_missing:{section}" for section in required if section not in headings)
    errors.extend(f"epistemic_marker_missing:{marker}" for marker in EPISTEMIC_MARKERS if marker not in text)
    if "```" in text:
        errors.append("canonical_markdown_code_fence_not_allowed")
    return errors


def response_metadata(provider_response: dict) -> dict:
    usage = provider_response.get("usage") if isinstance(provider_response.get("usage"), dict) else {}
    return {
        "provider_response_id": provider_response.get("id"),
        "usage": usage,
        "provider_status": provider_response.get("status", "unknown"),
    }
