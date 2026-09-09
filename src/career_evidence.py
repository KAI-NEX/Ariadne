"""Local-only Career Entity extraction for resume and portfolio documents.

The source document remains immutable. Extraction creates review-only entity
proposals; Career Evidence is derived later from human-confirmed entities in
the browser domain layer.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from difflib import SequenceMatcher
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree

from src.upload_limits import MAX_FILE_BYTES


MAX_DOCUMENT_BYTES = MAX_FILE_BYTES
ENTITY_CONTRACT_ID = "job-radar-career-entity-v1"
EXTRACTOR_VERSION = "career-entity-deterministic-v2-document-block"
DOCUMENT_BLOCK_CONTRACT_ID = "job-radar-document-block-v1"
ALLOWED_TYPES = {
    "application/pdf": {".pdf"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "text/plain": {".txt"},
    "text/markdown": {".md", ".markdown"},
}
SECTION_HEADINGS = {
    "工作经历": "work",
    "工作经验": "work",
    "职业经历": "work",
    "精选项目": "projects",
    "项目经历": "projects",
    "项目": "projects",
    "教育与工具": "education_and_tools",
    "教育经历": "education",
    "教育背景": "education",
    "其他经历": "other_experience",
    "社会经历": "other_experience",
    "技能": "skills",
    "专业技能": "skills",
    "核心能力": "skills",
    "核心技能": "skills",
    "获奖情况": "awards",
    "获奖经历": "awards",
    "荣誉奖项": "awards",
    "核心匹配": "summary",
    "个人简介": "summary",
    "WORK EXPERIENCE": "work",
    "PROFESSIONAL EXPERIENCE": "work",
    "EXPERIENCE": "work",
    "EMPLOYMENT": "work",
    "SELECTED PROJECTS": "projects",
    "PROJECT EXPERIENCE": "projects",
    "PROJECTS": "projects",
    "EDUCATION": "education",
    "ACADEMIC BACKGROUND": "education",
    "SKILLS": "skills",
    "TECHNICAL SKILLS": "skills",
    "CORE SKILLS": "skills",
    "SUMMARY": "summary",
    "PROFILE": "summary",
    "AWARDS": "awards",
    "CERTIFICATIONS": "certifications",
}
BULLET_PATTERN = re.compile(r"^[•●▪‣·\-*]\s*(.+)$")
EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
PHONE_PATTERN = re.compile(r"\+?\d[\d\s-]{7,}\d")
DATE_TOKEN = r"\d{4}(?:[./-]\d{1,2})?(?:[./-]\d{1,2})?"
DATE_RANGE_PATTERN = re.compile(
    rf"(?P<start>{DATE_TOKEN})\s*[–—-]\s*(?P<end>至今|现在|Present|{DATE_TOKEN})",
    re.IGNORECASE,
)
TRAILING_YEAR_PATTERN = re.compile(r"(?P<year>\d{4})\s*$")
ENTITY_HEADER_DELIMITER = re.compile(r"\s*[|｜]\s*")
INSTITUTION_PATTERN = re.compile(r"^(.+?(?:大学|学院)(?:\s+[A-Z]{2,})?)\s+(.+)$")
SKILL_LABEL_PATTERN = re.compile(
    r"(AI\s*/\s*原型|视觉\s*/\s*计算|语言|Skills?|Tools?|Languages?)[：:]",
    re.IGNORECASE,
)
ENGLISH_SKILL_CATEGORY_PATTERN = re.compile(
    r"^(?P<label>[A-Za-z][A-Za-z0-9 &/+.-]{1,60})\s*[:：]\s*(?P<value>.+)$"
)
AWARD_RECORD_PATTERN = re.compile(
    r"^(?P<result>Finalist|Winner|Runner[- ]?up|Merit Award|Award of Excellence|[A-Za-z][A-Za-z ]+ Award)\s*,\s*(?P<name>.+)$",
    re.IGNORECASE,
)
CHINESE_AWARD_RECORD_PATTERN = re.compile(
    r"^[•●▪‣·\-*]?\s*(?P<name>.+?)\s+(?P<result>入围总决赛|特等奖|一等奖|二等奖|三等奖|优秀奖|入围奖|金奖|银奖|铜奖|获奖|入选)$"
)
ROLE_CONTINUATION_PATTERN = re.compile(
    r"(?:负责人|经理|总监|设计师|研究员|策展人|工程师|顾问|实习生|项目支持|产品开发|供应链协作|策划|运营|"
    r"Director|Designer|Manager|Researcher|Engineer|Lead|Consultant|Intern)",
    re.IGNORECASE,
)


class CareerDocumentError(ValueError):
    """A bounded input/extraction failure safe to expose as an API error code."""


def _decode_data_url(data_url: object, media_type: str) -> bytes:
    if not isinstance(data_url, str) or "," not in data_url:
        raise CareerDocumentError("invalid_document_data")
    header, encoded = data_url.split(",", 1)
    if header != f"data:{media_type};base64":
        raise CareerDocumentError("document_media_type_mismatch")
    try:
        content = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise CareerDocumentError("invalid_document_base64") from error
    if not content or len(content) > MAX_DOCUMENT_BYTES:
        raise CareerDocumentError("invalid_document_size")
    return content


def _validate_identity(filename: object, media_type: object) -> tuple[str, str]:
    if not isinstance(filename, str) or not filename.strip() or Path(filename).name != filename:
        raise CareerDocumentError("invalid_document_filename")
    if not isinstance(media_type, str) or media_type not in ALLOWED_TYPES:
        raise CareerDocumentError("unsupported_document_type")
    if Path(filename).suffix.lower() not in ALLOWED_TYPES[media_type]:
        raise CareerDocumentError("document_extension_mismatch")
    return filename.strip(), media_type


def _pdf_pages(content: bytes, pdf_script_path: Path) -> list[dict]:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as temporary_pdf:
        temporary_pdf.write(content)
        temporary_pdf.flush()
        try:
            result = subprocess.run(
                ["swift", str(pdf_script_path), temporary_pdf.name],
                check=True,
                capture_output=True,
                text=True,
                timeout=60,
            )
            payload = json.loads(result.stdout)
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError) as error:
            raise CareerDocumentError("pdf_text_extraction_failed") from error
    pages = payload.get("pages")
    if not isinstance(pages, list):
        raise CareerDocumentError("pdf_text_extraction_failed")
    return pages


def _pdf_visual_pages(
    content: bytes,
    visual_ocr_script_path: Path,
    selected_pages: list[int] | None = None,
    config: str = "VISION_V1_AUTO",
) -> list[dict]:
    """Render PDF pages locally, then OCR them with macOS Vision.

    This is intentionally a Portfolio-only fallback. It preserves the same
    page/line contract as native PDF text extraction and never sends the
    document to a model or remote service.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf") as temporary_pdf:
        temporary_pdf.write(content)
        temporary_pdf.flush()
        try:
            command = ["swift", str(visual_ocr_script_path), temporary_pdf.name, config]
            if selected_pages:
                command.append(",".join(str(page) for page in selected_pages))
            result = subprocess.run(
                command,
                check=True,
                capture_output=True,
                text=True,
                timeout=180,
            )
            payload = json.loads(result.stdout)
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError) as error:
            raise CareerDocumentError("pdf_visual_ocr_failed") from error
    pages = payload.get("pages")
    if not isinstance(pages, list):
        raise CareerDocumentError("pdf_visual_ocr_failed")
    return pages


def _page_text_size(page: dict) -> int:
    return len(re.sub(r"\W+", "", " ".join(str(line) for line in page.get("lines", [])), flags=re.UNICODE))


def _selective_pdf_pages(
    content: bytes,
    pdf_script_path: Path,
    visual_ocr_script_path: Path | None,
) -> tuple[list[dict], str, list[str]]:
    """Prefer native PDF text and OCR only pages without a usable text layer.

    This deliberately avoids region-level native/OCR fusion: benchmarked
    overlap fusion duplicated content and changed CareerEntity grouping. A
    page is replaced, never appended, so downstream parsers see one source of
    truth per page while provenance still records the chosen source method.
    """
    pages = _pdf_pages(content, pdf_script_path)
    unusable_pages = [int(page["page"]) for page in pages if isinstance(page.get("page"), int) and _page_text_size(page) < 30]
    if not unusable_pages:
        return pages, "macos_pdfkit_native_blocks_v1", []
    if visual_ocr_script_path is None:
        if len(unusable_pages) == len(pages):
            raise CareerDocumentError("pdf_visual_ocr_unavailable")
        return pages, "macos_pdfkit_native_blocks_v1", ["pdf_pages_without_usable_text"]
    ocr_pages = _pdf_visual_pages(content, visual_ocr_script_path, unusable_pages)
    ocr_by_page = {page.get("page"): {**page, "source_method": "apple_vision"} for page in ocr_pages}
    merged = []
    for page in pages:
        page_number = page.get("page")
        if page_number in ocr_by_page:
            merged.append(ocr_by_page[page_number])
        else:
            merged.append({**page, "source_method": "native_pdf"})
    return merged, "native_pdf+selective_apple_vision_v1_auto", [
        "selective_ocr_pages:" + ",".join(str(page) for page in unusable_pages)
    ]


def _document_blocks(pages: list[dict], source_id: str, source_sha256: str) -> list[dict]:
    """Normalize parser-compatible page blocks into DocumentBlock v1."""
    output: list[dict] = []
    for page in pages:
        page_number = page.get("page")
        if not isinstance(page_number, int):
            continue
        method = page.get("source_method") if page.get("source_method") in {"native_pdf", "native_document", "apple_vision"} else "native_document"
        raw_blocks = page.get("blocks", [])
        if not raw_blocks:
            raw_blocks = [
                {"text": line, "confidence": 1.0, "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "coordinate_precision": "unavailable_nonpaginated_source"}
                for line in page.get("lines", [])
            ]
        for order, raw in enumerate(raw_blocks):
            if not isinstance(raw, dict) or not str(raw.get("text", "")).strip():
                continue
            x = max(0.0, min(1.0, float(raw.get("x", 0.0))))
            y_bottom = max(0.0, min(1.0, float(raw.get("y", 0.0))))
            width = max(0.0, min(1.0, float(raw.get("width", 0.0))))
            height = max(0.0, min(1.0, float(raw.get("height", 0.0))))
            y_top = max(0.0, min(1.0, 1.0 - (y_bottom + height)))
            identity = f"{source_id}|{page_number}|{method}|{order}|{raw['text']}"
            output.append({
                "contract_id": DOCUMENT_BLOCK_CONTRACT_ID,
                "block_id": "block-" + hashlib.sha256(identity.encode()).hexdigest()[:24],
                "page": page_number,
                "text": str(raw["text"]).strip(),
                "bbox": {"x": x, "y": y_top, "width": width, "height": height, "coordinate_system": "normalized_top_left"},
                "confidence": float(raw.get("confidence", 1.0)) if isinstance(raw.get("confidence", 1.0), (int, float)) else None,
                "source_method": method,
                "layout_label": None,
                "region": None,
                "column": None,
                "reading_order": order,
                "source_ref": {"document_id": source_id, "source_sha256": source_sha256, "page": page_number, "engine_ref": f"{method}-page-{page_number}-block-{order}"},
                "raw_engine": dict(raw),
            })
    return output


def _adaptive_resume_layout(pages: list[dict]) -> tuple[list[dict], bool]:
    """Apply whitespace-column ordering only to OCR Resume pages.

    Benchmarking showed GapTree-style ordering repairs image-only, multi-column
    Resumes but splits reliable native Resumes into false work groups. The
    source-method gate is therefore part of the architecture, not a filename
    exception.
    """
    changed = False

    def top(block: dict) -> float:
        return 1.0 - (float(block.get("y", 0.0)) + float(block.get("height", 0.0)))

    def recursive(blocks: list[dict]) -> list[dict]:
        if len(blocks) < 4:
            return sorted(blocks, key=lambda block: (top(block), float(block.get("x", 0.0))))
        centers = sorted((float(block.get("x", 0.0)) + float(block.get("width", 0.0)) / 2, index) for index, block in enumerate(blocks))
        gaps = [(centers[index + 1][0] - centers[index][0], index) for index in range(len(centers) - 1)]
        gap, gap_index = max(gaps, default=(0.0, 0))
        if gap < 0.12:
            return sorted(blocks, key=lambda block: (top(block), float(block.get("x", 0.0))))
        split = (centers[gap_index][0] + centers[gap_index + 1][0]) / 2
        spanning = [block for block in blocks if float(block.get("x", 0.0)) < split < float(block.get("x", 0.0)) + float(block.get("width", 0.0))]
        if spanning and min(top(block) for block in spanning) < 0.18:
            header_bottom = max(top(block) + float(block.get("height", 0.0)) for block in spanning)
            headers = [block for block in blocks if top(block) <= header_bottom]
            body = [block for block in blocks if block not in headers]
            return sorted(headers, key=lambda block: (top(block), float(block.get("x", 0.0)))) + recursive(body)
        left = [block for block in blocks if float(block.get("x", 0.0)) + float(block.get("width", 0.0)) / 2 <= split]
        right = [block for block in blocks if block not in left]
        if not left or not right:
            return sorted(blocks, key=lambda block: (top(block), float(block.get("x", 0.0))))
        return recursive(left) + recursive(right)

    output = []
    for page in pages:
        blocks = page.get("blocks") if isinstance(page.get("blocks"), list) else []
        if page.get("source_method") != "apple_vision" or len(blocks) < 4:
            output.append(page)
            continue
        ordered = recursive(blocks)
        if [block.get("text") for block in ordered] != [block.get("text") for block in blocks]:
            changed = True
        output.append({**page, "blocks": ordered, "lines": [str(block.get("text", "")) for block in ordered if str(block.get("text", "")).strip()]})
    return output, changed


def _docx_pages(content: bytes) -> list[dict]:
    try:
        with zipfile.ZipFile(BytesIO(content)) as archive:
            document_xml = archive.read("word/document.xml")
        root = ElementTree.fromstring(document_xml)
    except (KeyError, zipfile.BadZipFile, ElementTree.ParseError) as error:
        raise CareerDocumentError("docx_text_extraction_failed") from error
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    lines = []
    for paragraph in root.iter(namespace + "p"):
        text = "".join(node.text or "" for node in paragraph.iter(namespace + "t")).strip()
        if text:
            lines.append(text)
    return [{"page": 1, "lines": lines, "source_method": "native_document"}]


def _text_pages(content: bytes) -> list[dict]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise CareerDocumentError("text_document_not_utf8") from error
    return [{"page": 1, "lines": [line.strip() for line in text.splitlines() if line.strip()], "source_method": "native_document"}]


def _location(page: int | None, start: int, end: int) -> str:
    prefix = f"page {page}" if page else "document"
    return f"{prefix}, line {start}" if start == end else f"{prefix}, lines {start}-{end}"


def _line_records(pages: list[dict]) -> list[dict]:
    records = []
    for page in pages:
        page_number = page.get("page") if isinstance(page.get("page"), int) else None
        blocks = page.get("blocks") if isinstance(page.get("blocks"), list) else []
        raw_records = blocks if blocks else page.get("lines") if isinstance(page.get("lines"), list) else []
        page_records = []
        for line_number, raw_line in enumerate(raw_records, 1):
            text = str(raw_line.get("text", "")).strip() if isinstance(raw_line, dict) else str(raw_line).strip()
            if text:
                record = {"page": page_number, "line": line_number, "text": text}
                if isinstance(raw_line, dict):
                    for key in ("x", "y", "width", "height", "confidence"):
                        if isinstance(raw_line.get(key), (int, float)):
                            record[key] = float(raw_line[key])
                page_records.append(record)

        # PDFKit can split one visual header row into a left-hand label and a
        # right-hand date block. Coalesce only date-bearing aligned rows so
        # unrelated multi-column Resume content remains under engine ordering.
        consumed: set[int] = set()
        coalesced: list[dict] = []
        for index, record in enumerate(page_records):
            if index in consumed:
                continue
            aligned = [
                (other_index, other)
                for other_index, other in enumerate(page_records)
                if other_index not in consumed
                and "x" in record and "y" in record and "x" in other and "y" in other
                and abs(float(other["y"]) - float(record["y"])) <= 0.006
            ]
            if len(aligned) > 1 and any(DATE_RANGE_PATTERN.search(item["text"]) for _, item in aligned):
                ordered = sorted(aligned, key=lambda pair: float(pair[1]["x"]))
                members = [item for _, item in ordered]
                consumed.update(member_index for member_index, _ in aligned)
                left = min(float(item["x"]) for item in members)
                right = max(float(item["x"]) + float(item.get("width", 0.0)) for item in members)
                coalesced.append({
                    **members[0],
                    "line": min(item["line"] for item in members),
                    "text": " ".join(item["text"] for item in members),
                    "x": left,
                    "y": max(float(item["y"]) for item in members),
                    "width": max(0.0, right - left),
                    "height": max(float(item.get("height", 0.0)) for item in members),
                })
            else:
                consumed.add(index)
                coalesced.append(record)

        # Use bbox to repair only an evidenced heading-order anomaly: a raw
        # heading emitted after content that is visually below that heading.
        normalized_headings = {_normalized_section_heading(heading) for heading in SECTION_HEADINGS}
        anomaly = any(
            "y" in heading
            and _normalized_section_heading(heading["text"]) in normalized_headings
            and any("y" in earlier and float(earlier["y"]) < float(heading["y"]) for earlier in coalesced[:heading_index])
            for heading_index, heading in enumerate(coalesced)
        )
        if anomaly:
            coalesced.sort(key=lambda item: (-float(item.get("y", 0.0)), float(item.get("x", 0.0))))
        records.extend({**record, "line": line_number} for line_number, record in enumerate(coalesced, 1))
    return records


def _anchor(source_id: str, records: list[dict], excerpt: str | None = None) -> dict:
    first = records[0]
    last = records[-1]
    same_page = first["page"] == last["page"]
    page = first["page"] if same_page else None
    start_line = first["line"]
    end_line = last["line"] if same_page else first["line"]
    raw_excerpt = excerpt or " ".join(record["text"] for record in records)
    identity = f"{source_id}|{first['page']}|{first['line']}|{last['page']}|{last['line']}|{raw_excerpt}"
    return {
        "anchor_id": f"anchor-{hashlib.sha256(identity.encode()).hexdigest()[:20]}",
        "source_document_id": source_id,
        "page": page,
        "start_line": start_line,
        "end_line": end_line,
        "source_location": _location(page, start_line, end_line),
        "source_excerpt": raw_excerpt,
        "precision": "approximate_text_location",
        **({"source_region": {key: first[key] for key in ("x", "y", "width", "height") if key in first}} if "x" in first else {}),
    }


def _field_provenance(anchor: dict, *paths: str) -> dict:
    return {path: [anchor] for path in paths}


def _merge_provenance(target: dict, source: dict) -> None:
    for path, anchors in source.items():
        target.setdefault(path, []).extend(anchors)


def _normalize_date(value: str | None) -> str | None:
    if not value:
        return None
    if value.lower() == "present" or value in {"至今", "现在"}:
        return None
    return value.replace(".", "-").replace("/", "-")


def _date_precision(value: str | None) -> str | None:
    if not value:
        return None
    separators = value.count(".") + value.count("/") + value.count("-")
    return "day" if separators >= 2 else "month" if separators == 1 else "year"


def _split_outside_parentheses(value: str, delimiter: str = "、") -> list[str]:
    parts: list[str] = []
    active: list[str] = []
    depth = 0
    for character in value:
        if character in "（(":
            depth += 1
        elif character in "）)" and depth:
            depth -= 1
        if character == delimiter and depth == 0:
            part = "".join(active).strip()
            if part:
                parts.append(part)
            active = []
        else:
            active.append(character)
    part = "".join(active).strip()
    if part:
        parts.append(part)
    return parts


def _split_list_outside_parentheses(value: str, delimiters: str = "、,，") -> list[str]:
    """Split a displayed list without breaking parenthesized tool names."""
    parts: list[str] = []
    active: list[str] = []
    depth = 0
    for character in value:
        if character in "（(":
            depth += 1
        elif character in "）)" and depth:
            depth -= 1
        if character in delimiters and depth == 0:
            part = "".join(active).strip()
            if part:
                parts.append(part)
            active = []
        else:
            active.append(character)
    part = "".join(active).strip()
    if part:
        parts.append(part)
    return parts


def _visual_record_order(records: list[dict]) -> list[dict]:
    """Restore top-to-bottom order inside a section when OCR coordinates exist."""
    if not records or not all("y" in record and "x" in record for record in records):
        return list(records)
    return sorted(records, key=lambda record: (
        record.get("page") or 0,
        -float(record["y"]),
        float(record["x"]),
    ))


def _entity(source_id: str, entity_type: str, order: int, data: dict, provenance: dict, limitations: list[str] | None = None) -> dict:
    anchors = [anchor for values in provenance.values() for anchor in values]
    first_anchor = anchors[0] if anchors else {"anchor_id": f"no-anchor-{order}"}
    primary = str(data.get("name") or data.get("institution") or data.get("language") or entity_type)
    identity = f"{source_id}|{entity_type}|{first_anchor['anchor_id']}|{primary}"
    return {
        "entity_id": f"entity-{hashlib.sha256(identity.encode()).hexdigest()[:20]}",
        "contract_id": ENTITY_CONTRACT_ID,
        "entity_type": entity_type,
        "order": order,
        "data": data,
        "source_document_ids": [source_id],
        "field_provenance": provenance,
        "extraction": {"method": EXTRACTOR_VERSION, "confidence": "medium", "warnings": []},
        "review_status": "needs_review",
        "limitations": list(dict.fromkeys(limitations or [])),
    }


def _normalized_section_heading(value: str) -> str:
    return re.sub(r"[^A-Z0-9\u4e00-\u9fff]+", "", value.upper())


def _safe_local_corrections(value: object, document_type: str) -> list[dict]:
    if not isinstance(value, list):
        return []
    allowed_kinds = {"ocr_replacement", "section_alias", "classification_correction"}
    result = []
    for correction in value[:100]:
        if not isinstance(correction, dict) or correction.get("kind") not in allowed_kinds:
            continue
        if correction.get("document_type") not in {None, "", document_type}:
            continue
        source_text = correction.get("source_text")
        target_value = correction.get("target_value")
        if not isinstance(source_text, str) or not source_text.strip() or len(source_text) > 240:
            continue
        if not isinstance(target_value, str) or not target_value.strip() or len(target_value) > 240:
            continue
        result.append({"kind": correction["kind"], "source_text": source_text.strip(), "target_value": target_value.strip()})
    return result


def _apply_ocr_corrections(pages: list[dict], corrections: list[dict]) -> list[dict]:
    replacements = [(item["source_text"], item["target_value"]) for item in corrections if item["kind"] == "ocr_replacement"]
    if not replacements:
        return pages
    updated = []
    for page in pages:
        copied = {**page}
        for key in ("lines", "blocks"):
            values = page.get(key)
            if not isinstance(values, list):
                continue
            output = []
            for item in values:
                if isinstance(item, dict):
                    next_item = {**item}
                    text = str(next_item.get("text", ""))
                    for source_text, target_value in replacements:
                        text = text.replace(source_text, target_value)
                    next_item["text"] = text
                    output.append(next_item)
                else:
                    text = str(item)
                    for source_text, target_value in replacements:
                        text = text.replace(source_text, target_value)
                    output.append(text)
            copied[key] = output
        updated.append(copied)
    return updated


def _sections(records: list[dict], corrections: list[dict] | None = None) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {"basics": []}
    aliases = {
        _normalized_section_heading(item["source_text"]): item["target_value"]
        for item in corrections or []
        if item["kind"] == "section_alias" and item["target_value"] in {"work", "projects", "education", "skills", "summary", "awards", "other_experience"}
    }
    current = "basics"
    canonical_headings = {_normalized_section_heading(heading): section for heading, section in SECTION_HEADINGS.items()}
    for record in records:
        normalized = _normalized_section_heading(record["text"])
        section = SECTION_HEADINGS.get(record["text"]) or canonical_headings.get(normalized) or aliases.get(normalized)
        if not section and 4 <= len(normalized) <= 32 and len(record["text"].split()) <= 4:
            # OCR commonly inserts or drops one glyph in all-caps headings
            # (for example SKLILLS). Fuzzy matching is intentionally bounded
            # to short heading-like lines, never arbitrary body text.
            best = max(canonical_headings, key=lambda heading: SequenceMatcher(None, normalized, heading).ratio())
            if SequenceMatcher(None, normalized, best).ratio() >= 0.9:
                section = canonical_headings[best]
        if section:
            current = section
            grouped.setdefault(current, [])
            continue
        grouped.setdefault(current, []).append(record)
    return grouped


MONTH_FIRST_DATE_RANGE_PATTERN = re.compile(
    r"^(?P<start>\d{1,2}/\d{4})\s*[–—-]\s*(?P<end>PRESENT|PRE[A-Z]+|\d{1,2}/\d{4})$",
    re.IGNORECASE,
)
ENGLISH_ROLE_COMPANY_PATTERN = re.compile(
    r"^(?P<role>(?:[A-Za-z]+\s+){0,3}(?:Director|Designer|Assistant|Manager|Engineer|Lead|Consultant|Architect|Intern|Researcher))\s+(?P<company>.+)$",
    re.IGNORECASE,
)


def _canonical_month_first_range(text: str) -> str | None:
    match = MONTH_FIRST_DATE_RANGE_PATTERN.fullmatch(text.strip())
    if not match:
        return None
    month, year = match.group("start").split("/")
    end = match.group("end")
    if re.match(r"^PRE[A-Z]+$", end, re.IGNORECASE):
        normalized_end = "Present"
    else:
        end_month, end_year = end.split("/")
        normalized_end = f"{end_year}/{int(end_month):02d}"
    return f"{year}/{int(month):02d} - {normalized_end}"


def _english_work_records(records: list[dict]) -> list[dict]:
    """Normalize common date-line + role/company-line Resume layouts."""
    output: list[dict] = []
    pending_date: tuple[str, dict] | None = None
    pending_header: tuple[re.Match, dict] | None = None

    def emit_header(match: re.Match, record: dict, date: str | None) -> None:
        company = match.group("company").strip()
        role = match.group("role").strip()
        location = ""
        location_match = re.search(r"\s*\(([^()]+)\)\s*$", company)
        if location_match:
            location = location_match.group(1).strip()
            company = company[:location_match.start()].strip()
        text = f"{company} | {role}"
        if date:
            text += f" {date}"
        if location:
            text += f" | {location}"
        output.append({**record, "text": text})

    for record in records:
        date = _canonical_month_first_range(record["text"])
        if date:
            if pending_header:
                emit_header(*pending_header, date)
                pending_header = None
            else:
                pending_date = (date, record)
            continue
        role_company = None if "|" in record["text"] or "｜" in record["text"] else ENGLISH_ROLE_COMPANY_PATTERN.match(record["text"].strip())
        if role_company:
            if pending_header:
                emit_header(*pending_header, None)
            if pending_date:
                emit_header(role_company, record, pending_date[0])
                pending_date = None
            else:
                pending_header = (role_company, record)
            continue
        if pending_header:
            emit_header(*pending_header, None)
            pending_header = None
        if pending_date:
            output.append(pending_date[1])
            pending_date = None
        output.append(record)
    if pending_header:
        emit_header(*pending_header, None)
    if pending_date:
        output.append(pending_date[1])
    return output


def _parse_basics(source_id: str, sections: dict[str, list[dict]], order: int) -> dict | None:
    records = sections.get("basics", [])
    if not records:
        return None
    contact_record = next((record for record in records if EMAIL_PATTERN.search(record["text"]) or PHONE_PATTERN.search(record["text"])), None)
    non_contact = [record for record in records if record is not contact_record]
    if not non_contact:
        return None
    name_record = non_contact[0]
    label_record = non_contact[1] if len(non_contact) > 1 else None
    summary_records = non_contact[2:] + sections.get("summary", [])
    email_match = EMAIL_PATTERN.search(contact_record["text"]) if contact_record else None
    phone_match = PHONE_PATTERN.search(contact_record["text"]) if contact_record else None
    data = {
        "name": name_record["text"],
        "label": label_record["text"] if label_record else "",
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
        "url": "",
        "summary": " ".join(record["text"] for record in summary_records),
        "location": "",
        "profiles": [],
    }
    provenance = _field_provenance(_anchor(source_id, [name_record]), "/name")
    if label_record:
        _merge_provenance(provenance, _field_provenance(_anchor(source_id, [label_record]), "/label"))
    if contact_record:
        contact_anchor = _anchor(source_id, [contact_record])
        if data["email"]:
            _merge_provenance(provenance, _field_provenance(contact_anchor, "/email"))
        if data["phone"]:
            _merge_provenance(provenance, _field_provenance(contact_anchor, "/phone"))
    if summary_records:
        _merge_provenance(provenance, _field_provenance(_anchor(source_id, summary_records), "/summary"))
    return _entity(source_id, "basics", order, data, provenance, ["private_contact_fields_not_career_evidence"])


def _header_parts(text: str, include_location: bool) -> dict | None:
    date_match = DATE_RANGE_PATTERN.search(text)
    single_year = None if date_match else TRAILING_YEAR_PATTERN.search(text)
    match = date_match or single_year
    before = text[:match.start()].strip(" |｜") if match else text.strip(" |｜")
    after = text[match.end():].strip(" |｜") if match else ""
    parts = ENTITY_HEADER_DELIMITER.split(before, maxsplit=2)
    if len(parts) < 2 and not match:
        return None
    start_raw = date_match.group("start") if date_match else single_year.group("year") if single_year else None
    end_raw = date_match.group("end") if date_match else single_year.group("year") if single_year else None
    warnings = []
    if len(parts) < 2:
        parts = [before, ""]
        warnings.append("ambiguous_company_or_title")
    if not match:
        warnings.append("missing_date")
    location = after if include_location else ""
    if include_location and not location and len(parts) > 2:
        location = parts[2].strip()
    return {
        "primary": parts[0].strip(),
        "secondary": parts[1].strip(),
        "rawDate": match.group(0) if match else "",
        "startDate": _normalize_date(start_raw),
        "endDate": _normalize_date(end_raw),
        "datePrecision": _date_precision(start_raw),
        "current": bool(date_match and date_match.group("end").lower() in {"至今", "现在", "present"}),
        "location": location,
        "warnings": warnings,
    }


def _parse_grouped_entities(source_id: str, records: list[dict], entity_type: str, start_order: int) -> list[dict]:
    if entity_type == "work_experience":
        records = _english_work_records(records)
    entities = []
    current: dict | None = None
    active_highlight: dict | None = None

    def flush_highlight() -> None:
        nonlocal active_highlight
        if current is None or active_highlight is None:
            return
        text = " ".join(record["text"] for record in active_highlight["records"])
        current["highlights"].append(text)
        current["highlight_records"].append(active_highlight["records"])
        active_highlight = None

    def flush_entity() -> None:
        nonlocal current
        if current is None:
            return
        flush_highlight()
        header = current["header"]
        header_anchor = _anchor(source_id, current["header_records"])
        if entity_type == "work_experience":
            data = {
                "name": header["primary"], "position": header["secondary"], "location": header["location"], "url": "",
                "startDate": header["startDate"], "endDate": header["endDate"], "rawDate": header["rawDate"],
                "datePrecision": header["datePrecision"], "current": header["current"], "summary": "",
                "responsibilities": [], "achievements": [], "unclassified_highlights": current["highlights"],
                "skills": [], "employmentType": "", "department": "",
            }
            paths = ("/name", "/position", "/rawDate", "/startDate", "/endDate", "/location")
        elif entity_type == "project":
            description = header["secondary"]
            project_kind = "software" if re.search(r"(?:HTML|JavaScript|React|网站|软件)", description, re.I) else "design"
            data = {
                "name": header["primary"], "project_kind": project_kind, "context": description, "description": description, "status": "",
                "startDate": header["startDate"], "endDate": header["endDate"], "rawDate": header["rawDate"],
                "timeframe": header["rawDate"], "organization": "", "role": "", "roles": [], "ownership_scope": "",
                "problem": "", "audience": "", "responsibilities": [], "process": [], "tools": [], "outputs": [],
                "outcomes": [], "unclassified_highlights": current["highlights"], "skills": [], "keywords": [], "artifacts": [],
                "collaborators": [], "ai_assistance": "" if not re.search(r"\bAI\b|Codex|Lovable", description, re.I) else description,
                "boundaries": [item for item in current["highlights"] if re.search(r"不宣称|不包含|未包含|责任边界", item)],
            }
            paths = ("/name", "/description", "/rawDate", "/startDate", "/endDate")
        else:
            data = {
                "name": header["primary"], "title": header["secondary"], "section": "其他经历",
                "location": header["location"], "startDate": header["startDate"], "endDate": header["endDate"],
                "rawDate": header["rawDate"], "summary": "", "unclassified_highlights": current["highlights"],
            }
            paths = ("/name", "/title", "/section", "/rawDate", "/startDate", "/endDate", "/location")
        provenance = _field_provenance(header_anchor, *paths)
        highlight_path = "/unclassified_highlights"
        for index, highlight_records in enumerate(current["highlight_records"]):
            highlight_anchor = _anchor(source_id, highlight_records)
            _merge_provenance(provenance, _field_provenance(highlight_anchor, f"{highlight_path}/{index}"))
            if entity_type == "project" and re.search(r"不宣称|不包含|未包含|责任边界", current["highlights"][index]):
                boundary_index = data["boundaries"].index(current["highlights"][index])
                _merge_provenance(provenance, _field_provenance(highlight_anchor, f"/boundaries/{boundary_index}"))
        all_text = " ".join(current["highlights"] + [header["secondary"]])
        limitations = ["self_reported_resume_claim_not_independently_verified"]
        if re.search(r"\bAI\b|Codex|Lovable|全栈|React", all_text, re.I):
            limitations.append("ai_assisted_work_not_independent_coding_evidence")
        entity = _entity(source_id, entity_type, start_order + len(entities), data, provenance, limitations)
        entity["extraction"]["warnings"] = list(header.get("warnings", []))
        if not current["highlights"]:
            entity["extraction"]["warnings"].append("no_highlights_detected")
        if entity["extraction"]["warnings"]:
            entity["extraction"]["confidence"] = "low"
        entities.append(entity)
        current = None

    for record in records:
        bullet = BULLET_PATTERN.match(record["text"])
        if bullet and current:
            flush_highlight()
            active_highlight = {"records": [{**record, "text": bullet.group(1).strip()}]}
            continue
        header = None if bullet else _header_parts(record["text"], include_location=entity_type == "work_experience")
        if header:
            flush_entity()
            current = {"header": header, "header_records": [record], "highlights": [], "highlight_records": []}
        elif active_highlight:
            active_highlight["records"].append(record)
        elif current and not current["header"]["secondary"] and ROLE_CONTINUATION_PATTERN.search(record["text"]) and len(record["text"]) <= 90 and not re.search(r"[。；;]", record["text"]):
            current["header"]["secondary"] = record["text"].strip()
            current["header_records"].append(record)
        elif current and not _canonical_month_first_range(record["text"]):
            # Some Resume layouts use one visual line per responsibility
            # without bullet glyphs. Preserve each as unclassified evidence;
            # review remains required before any CareerEvidence derivation.
            active_highlight = {"records": [record]}
    flush_entity()
    return entities


def _parse_education(source_id: str, records: list[dict], start_order: int) -> tuple[list[dict], list[dict]]:
    entities = []
    consumed_records = []
    for record_index, record in enumerate(records):
        matches = list(DATE_RANGE_PATTERN.finditer(record["text"]))
        if not matches:
            continue
        consumed_records.append(record)
        cursor = 0
        for match in matches:
            chunk = record["text"][cursor:match.end()].strip()
            cursor = match.end()
            body = chunk[:chunk.rfind(match.group(0))].strip(" |｜")
            tokens = ENTITY_HEADER_DELIMITER.split(body)
            core = tokens[0].strip()
            institution_match = INSTITUTION_PATTERN.match(core)
            institution = institution_match.group(1).strip() if institution_match else core
            study = institution_match.group(2).strip() if institution_match else ""
            adjacent = records[record_index + 1] if record_index + 1 < len(records) else None
            adjacent_degree = re.search(r"(博士|硕士|本科|学士|Master|Bachelor|PhD)", adjacent["text"], re.I) if adjacent and not DATE_RANGE_PATTERN.search(adjacent["text"]) else None
            inline_degree = re.search(r"(博士|硕士|本科|学士|Master|Bachelor|PhD)", study, re.I)
            degree_match = inline_degree or adjacent_degree
            uses_adjacent_degree = bool(adjacent_degree and not inline_degree)
            study_type = degree_match.group(1) if degree_match else study
            degree_source = study if inline_degree else adjacent["text"] if uses_adjacent_degree else ""
            area = re.sub(r"^[•●▪‣·\-*]\s*", "", degree_source[:degree_match.start()]).strip(" -（(") if degree_match else ""
            data = {
                "institution": institution, "url": "", "area": area, "studyType": study_type,
                "location": tokens[1].strip() if len(tokens) > 1 else "", "startDate": _normalize_date(match.group("start")),
                "endDate": _normalize_date(match.group("end")), "rawDate": match.group(0), "score": "", "courses": [],
                "summary": "", "highlights": [],
            }
            anchor_records = [record, adjacent] if uses_adjacent_degree else [record]
            anchor = _anchor(source_id, anchor_records, excerpt=" ".join(item["text"] for item in anchor_records))
            provenance = _field_provenance(anchor, "/institution", "/area", "/studyType", "/location", "/rawDate", "/startDate", "/endDate")
            entities.append(_entity(source_id, "education", start_order + len(entities), data, provenance, ["self_reported_resume_claim_not_independently_verified"]))
            if uses_adjacent_degree and adjacent not in consumed_records:
                consumed_records.append(adjacent)

    # English CVs often put institution and degree on separate lines and omit
    # dates. Preserve the Education entity with unknown dates instead of
    # dropping the whole record or inventing a period.
    institution_pattern = re.compile(r"\b(?:University|College|School|Institute)\b", re.IGNORECASE)
    degree_pattern = re.compile(r"\b(?P<degree>Master|Bachelor|PhD|Doctorate)\b(?:\s+of\s+(?P<area>[^()]+))?", re.IGNORECASE)
    for index, record in enumerate(records):
        if record in consumed_records or not institution_pattern.search(record["text"]):
            continue
        degree_record = records[index + 1] if index + 1 < len(records) and degree_pattern.search(records[index + 1]["text"]) else None
        if not degree_record:
            continue
        match = degree_pattern.search(degree_record["text"])
        assert match is not None
        institution_parts = [part.strip() for part in record["text"].split(",", 1)]
        data = {
            "institution": institution_parts[0], "url": "", "area": (match.group("area") or "").strip(),
            "studyType": match.group("degree"), "location": institution_parts[1] if len(institution_parts) > 1 else "",
            "startDate": None, "endDate": None, "rawDate": "", "score": "", "courses": [], "summary": "", "highlights": [],
        }
        anchor = _anchor(source_id, [record, degree_record])
        provenance = _field_provenance(anchor, "/institution", "/area", "/studyType", "/location")
        entity = _entity(source_id, "education", start_order + len(entities), data, provenance, ["self_reported_resume_claim_not_independently_verified"])
        entity["extraction"]["confidence"] = "low"
        entity["extraction"]["warnings"] = ["missing_date"]
        entities.append(entity)
        consumed_records.extend([record, degree_record])
    return entities, consumed_records


def _parse_skills(source_id: str, records: list[dict], start_order: int) -> list[dict]:
    if not records:
        return []
    ordered_records = _visual_record_order(records)

    # English visual CVs commonly use one explicit category per line. Parse
    # those records before the compact inline fallback so category names and
    # language identities are not flattened or dropped.
    if any(ENGLISH_SKILL_CATEGORY_PATTERN.match(record["text"]) for record in ordered_records):
        parsed: list[tuple[str, str, list[str], list[dict]]] = []
        active_group: dict | None = None

        def flush_group() -> None:
            nonlocal active_group
            if active_group is None:
                return
            parsed.append((
                "skill_group",
                active_group["label"],
                _split_list_outside_parentheses(active_group["value"].rstrip(" ,，")),
                active_group["records"],
            ))
            active_group = None

        for record in ordered_records:
            match = ENGLISH_SKILL_CATEGORY_PATTERN.match(record["text"])
            if match:
                flush_group()
                label = match.group("label").strip()
                value = match.group("value").strip()
                if label.lower().startswith("language"):
                    for language in _split_list_outside_parentheses(value, delimiters="|;；"):
                        parsed.append(("language", language, [], [record]))
                else:
                    active_group = {"label": label, "value": value, "records": [record]}
                continue
            if active_group and not EMAIL_PATTERN.search(record["text"]) and not PHONE_PATTERN.search(record["text"]):
                active_group["value"] = f"{active_group['value']} {record['text']}".strip()
                active_group["records"].append(record)
        flush_group()

        entities = []
        for entity_type, name, keywords, source_records in parsed:
            anchor = _anchor(source_id, source_records)
            if entity_type == "language":
                data = {"language": name, "fluency": ""}
                provenance = _field_provenance(anchor, "/language", "/fluency")
                limitations = ["self_reported_language_not_independently_verified"]
            else:
                data = {"name": name, "level": "", "keywords": keywords}
                provenance = _field_provenance(anchor, "/name", "/keywords")
                limitations = ["self_reported_skill_not_demonstrated_by_work_evidence"]
            entities.append(_entity(source_id, entity_type, start_order + len(entities), data, provenance, limitations))
        return entities

    combined = " ".join(record["text"] for record in records)
    combined = re.split(r"\s+Targeted\s+for\s+", combined, maxsplit=1, flags=re.IGNORECASE)[0].strip()
    labels = list(SKILL_LABEL_PATTERN.finditer(combined))
    entities = []
    anchor = _anchor(source_id, records, excerpt=combined)
    if not labels:
        data = {"name": "Skills", "level": "", "keywords": [part.strip() for part in re.split(r"[、,，]", combined) if part.strip()]}
        return [_entity(source_id, "skill_group", start_order, data, _field_provenance(anchor, "/name", "/keywords"), ["self_reported_skill_not_demonstrated_by_work_evidence"])]
    for index, match in enumerate(labels):
        label = match.group(1).strip()
        end = labels[index + 1].start() if index + 1 < len(labels) else len(combined)
        value = combined[match.end():end].strip()
        if not value:
            continue
        if label == "语言" or label.lower().startswith("language"):
            value = re.split(r"\s+Targeted\s+for\s+", value, maxsplit=1, flags=re.IGNORECASE)[0].strip()
            for language in _split_list_outside_parentheses(value, delimiters="、|;；"):
                data = {"language": language, "fluency": ""}
                entities.append(_entity(source_id, "language", start_order + len(entities), data, _field_provenance(anchor, "/language", "/fluency"), ["self_reported_language_not_independently_verified"]))
        else:
            keywords = [part.strip() for part in re.split(r"[、,，]", value) if part.strip()]
            data = {"name": label, "level": "", "keywords": keywords}
            entities.append(_entity(source_id, "skill_group", start_order + len(entities), data, _field_provenance(anchor, "/name", "/keywords"), ["self_reported_skill_not_demonstrated_by_work_evidence"]))
    return entities


def _parse_awards(source_id: str, records: list[dict], start_order: int) -> list[dict]:
    """Map only explicitly labelled Resume awards; absent dates stay unknown."""
    ordered = _visual_record_order(records)
    starts = [
        (index, AWARD_RECORD_PATTERN.match(record["text"]), CHINESE_AWARD_RECORD_PATTERN.match(record["text"]))
        for index, record in enumerate(ordered)
    ]
    starts = [(index, english, chinese) for index, english, chinese in starts if english or chinese]
    entities = []
    for position, (index, english_match, chinese_match) in enumerate(starts):
        match = english_match or chinese_match
        assert match is not None
        next_index = starts[position + 1][0] if position + 1 < len(starts) else len(ordered)
        start_record = ordered[index]
        source_records = [start_record]
        continuation = []
        for record in ordered[index + 1:next_index]:
            text = record["text"].strip()
            if EMAIL_PATTERN.search(text) or PHONE_PATTERN.search(text):
                continue
            same_column = (
                "x" in start_record and "x" in record
                and abs(float(start_record["x"]) - float(record["x"])) <= 0.08
            )
            text_continuation = text.startswith("(") or bool(re.fullmatch(r"[a-z]{2,20}", text))
            if same_column or ("x" not in start_record and text_continuation):
                continuation.append(text)
                source_records.append(record)
        name = match.group("name").strip()
        for part in continuation:
            name = f"{name[:-1]}{part}" if name.endswith("-") and re.fullmatch(r"[A-Za-z]+", part) else f"{name} {part}"
        data = {
            "name": name.strip(),
            "title": name.strip(),
            "result": match.group("result").strip(),
            "date": None,
            "awarder": "",
            "location": "",
            "summary": "",
        }
        anchor = _anchor(source_id, source_records)
        entity = _entity(
            source_id,
            "award",
            start_order + len(entities),
            data,
            _field_provenance(anchor, "/name", "/title", "/result"),
            ["self_reported_award_not_independently_verified"],
        )
        entity["extraction"]["confidence"] = "low"
        entity["extraction"]["warnings"] = ["missing_date"]
        entities.append(entity)
    return entities


PORTFOLIO_CASE_PATTERN = re.compile(r"^CASE\s*0?(?P<number>\d+)\s*[•.．·:：-]+\s*(?P<title>.+)$", re.IGNORECASE)
PORTFOLIO_FIELD_LABELS = {
    "role": "/role",
    "problem": "/problem",
    "boundary": "/boundaries",
    "what i can claim": "/responsibilities",
    "what l can claim": "/responsibilities",
    "design response": "/responsibilities",
    "discover": "/process",
    "define": "/process",
    "validate": "/process",
}
PORTFOLIO_SECTION_BREAKS = set(PORTFOLIO_FIELD_LABELS) | {"what i learned", "what l learned"}
PORTFOLIO_NUMBER_PATTERN = re.compile(r"^0?(?P<number>[1-9]\d?)$")
PORTFOLIO_EXERCISE_PATTERN = re.compile(
    r"^(?P<category>[A-Z][A-Z ]{2,50}(?:EXERCISE|PROJECT))\s*[•.．·:：-]+\s*(?P<label>.+)$",
    re.IGNORECASE,
)
PORTFOLIO_CATEGORY_LABEL_PATTERN = re.compile(
    r"^(?:0\s*[→-]\s*1\s+PRODUCT|AI[- ]ASSISTED WEBSITE|TOOL PRODUCT|EXPERIENCE JUDGMENT)$",
    re.IGNORECASE,
)


def _portfolio_project_name(title: str) -> tuple[str, str]:
    """Separate the explicit project title from a displayed subtitle."""
    parts = re.split(r"\s*/\s*", title, maxsplit=1)
    name = parts[0].strip()
    subtitle = parts[1].strip() if len(parts) == 2 else ""
    return name, subtitle


def _portfolio_resolved_title(group: dict) -> tuple[str, str, dict]:
    """Prefer an explicit project name while retaining CASE text as metadata."""
    records = group["records"]
    header = group["header"]
    header_index = records.index(header)
    category = group.get("category_label", "")
    category_is_metadata = (
        bool(PORTFOLIO_CATEGORY_LABEL_PATTERN.fullmatch(category))
        or str(group.get("case_number", "")).startswith("exercise-page-")
    )
    if not category_is_metadata:
        name, subtitle = _portfolio_project_name(group["title"])
        return name, subtitle, header
    candidates = [
        record for record in records[header_index + 1:header_index + 12]
        if record.get("page") == header.get("page")
    ]
    for record in candidates:
        match = re.match(r"^(?P<name>[^:：]{2,80})\s*[:：]\s*(?P<context>.+)$", record["text"].strip())
        if not match:
            continue
        name = match.group("name").strip()
        if (
            any(character.isalpha() for character in name)
            and name.lower() not in PORTFOLIO_FIELD_LABELS
            and not EMAIL_PATTERN.search(name)
        ):
            return name, match.group("context").strip(), record

    if PORTFOLIO_CATEGORY_LABEL_PATTERN.fullmatch(category):
        for record in candidates:
            text = record["text"].strip()
            words = text.split()
            if (
                1 <= len(words) <= 6
                and re.fullmatch(r"[A-Za-z][A-Za-z0-9]*(?:\s+[A-Za-z][A-Za-z0-9]*){0,5}", text)
                and any(word[:1].isupper() for word in words)
                and text.lower() not in PORTFOLIO_FIELD_LABELS
            ):
                prefix = [item["text"].strip() for item in candidates[:candidates.index(record)] if item["text"].strip()]
                return text, " ".join(prefix), record
    name, subtitle = _portfolio_project_name(group["title"])
    return name, subtitle, header


def _portfolio_section_break(text: str) -> bool:
    normalized = text.strip().lower()
    return normalized in PORTFOLIO_SECTION_BREAKS or bool(re.fullmatch(r"what\s+i\s*learned", normalized))


def _portfolio_value_records(records: list[dict], start: int, stop_labels: set[str], label_record: dict | None = None) -> list[dict]:
    """Return text belonging to a field label using layout when available.

    OCR line order is only a fallback.  Coordinate-aware Portfolio OCR keeps a
    field inside the column directly below its label, which avoids borrowing
    decorative labels or a neighbouring card from a multi-column page.
    """
    if label_record and all(key in label_record for key in ("x", "y", "width")):
        label_x = label_record["x"]
        label_y = label_record["y"]
        label_width = label_record["width"]
        same_column = []
        next_label_y = max((record["y"] for record in records
                            if record.get("page") == label_record.get("page")
                            and "y" in record
                            and _portfolio_section_break(record["text"])
                            and record["y"] < label_y - 0.012), default=None)
        for record in records:
            if record.get("page") != label_record.get("page") or "x" not in record or "y" not in record:
                continue
            vertical_gap = label_y - record["y"]
            horizontal_gap = abs(record["x"] - label_x)
            confidence = record.get("confidence", 1.0)
            before_next_label = next_label_y is None or record["y"] > next_label_y + 0.01
            if before_next_label and 0.012 <= vertical_gap <= 0.32 and horizontal_gap <= max(0.07, label_width * 0.75):
                if confidence >= 0.45 and record["text"].strip().lower() not in stop_labels and not PORTFOLIO_CASE_PATTERN.match(record["text"]):
                    same_column.append(record)
        same_column.sort(key=lambda item: item["y"], reverse=True)
        if same_column:
            return same_column[:6]
    values: list[dict] = []
    for record in records[start:]:
        text = record["text"].strip()
        if PORTFOLIO_CASE_PATTERN.match(text) or text.lower() in stop_labels:
            break
        if re.fullmatch(r"0?\d{1,2}", text):
            continue
        values.append(record)
    return values


def _portfolio_role_value(records: list[dict], start: int, stop_labels: set[str], label_record: dict | None = None) -> tuple[str, list[dict]]:
    """Pick an explicit role label, never arbitrary nearby visual text."""
    candidates = _portfolio_value_records(records, start, stop_labels, label_record)[:8]
    role_pattern = re.compile(r"\b(?:lead|designer|manager|director|researcher|engineer|strategist)\b", re.IGNORECASE)
    for record in candidates:
        if role_pattern.search(record["text"]):
            return record["text"], [record]
    return "", []


def _numbered_portfolio_heading(records: list[dict]) -> tuple[str, dict] | None:
    """Find a conservative `01` + display-title project boundary.

    The number must occur near the top of the page and the following text must
    look like a display heading. This supports conventional multi-project
    portfolios without treating every page number or decorative phrase as a
    new Career Project.
    """
    for index, record in enumerate(records[:6]):
        match = PORTFOLIO_NUMBER_PATTERN.fullmatch(record["text"].strip())
        if not match:
            continue
        for candidate in records[index + 1:index + 4]:
            title = candidate["text"].strip()
            letters = [char for char in title if char.isalpha()]
            if len(letters) >= 6 and title.upper() == title and len(title) <= 120:
                return match.group("number"), candidate
    return None


def _single_project_heading(page_records: dict[int | None, list[dict]]) -> dict | None:
    ignored = re.compile(r"^(?:project brief|final assessment|student|author|contents?|introduction)\b", re.IGNORECASE)
    for records in list(page_records.values())[:3]:
        for record in records[:16]:
            text = record["text"].strip(" -–—:：")
            if ignored.match(text) or re.fullmatch(r"\d+", text):
                continue
            if 4 <= sum(char.isalpha() for char in text) and len(text) <= 100:
                return record
    return None


def _parse_portfolio_projects(source_id: str, pages: list[dict], start_order: int, allow_single_project: bool = False) -> list[dict]:
    """Group one or more Portfolio pages into conservative Project Entities.

    Fields are populated only from labelled or plainly adjacent text.  Visual
    appearance is never treated as evidence of a role, contribution or result.
    """
    page_records: dict[int | None, list[dict]] = {}
    for record in _line_records(pages):
        page_records.setdefault(record["page"], []).append(record)
    groups: list[dict] = []
    active: dict | None = None
    for page, records in page_records.items():
        case_record = next((record for record in records if PORTFOLIO_CASE_PATTERN.match(record["text"])), None)
        if case_record:
            match = PORTFOLIO_CASE_PATTERN.match(case_record["text"])
            assert match is not None
            case_number = match.group("number")
            title = match.group("title").strip()
            # A repeated case number is a continuation page, not a new entity.
            if active and active["case_number"] == case_number:
                active["pages"].append(page)
                active["records"].extend(records)
                continue
            active = {
                "case_number": case_number,
                "title": title,
                "category_label": title,
                "section_label": case_record["text"].strip(),
                "pages": [page],
                "records": list(records),
                "header": case_record,
            }
            groups.append(active)
            continue
        exercise_record = next((record for record in records if PORTFOLIO_EXERCISE_PATTERN.match(record["text"])), None)
        if exercise_record:
            match = PORTFOLIO_EXERCISE_PATTERN.match(exercise_record["text"])
            assert match is not None
            active = {
                "case_number": f"exercise-page-{page}",
                "title": match.group("label").strip(),
                "category_label": match.group("category").strip(),
                "section_label": exercise_record["text"].strip(),
                "pages": [page],
                "records": list(records),
                "header": exercise_record,
            }
            groups.append(active)
        # Do not attach unlabelled following pages. A Portfolio can contain a
        # working-method section, cover or contact page after a case; merging
        # it would create false project provenance. A continuation needs the
        # same explicit CASE number (handled above) until a stronger document
        # layout signal is available.

    # A second, schema-independent boundary convention is common in visual
    # portfolios: a standalone section number followed by an uppercase project
    # title. Only use it when no CASE contract exists in the document. In this
    # convention, unlabelled pages are genuine continuations until the next
    # numbered project or an explicit non-project appendix heading.
    if not groups:
        active = None
        for page, records in page_records.items():
            heading = _numbered_portfolio_heading(records)
            if heading:
                number, header = heading
                active = {
                    "case_number": f"numbered-{number}",
                    "title": header["text"].strip(),
                    "category_label": "",
                    "section_label": header["text"].strip(),
                    "pages": [page],
                    "records": list(records),
                    "header": header,
                }
                groups.append(active)
                continue
            if active and not any(re.match(r"^(?:THE\s+)?OTHER\s+WORK", record["text"].strip(), re.IGNORECASE) for record in records):
                active["pages"].append(page)
                active["records"].extend(records)
            elif active:
                active = None

    # A file explicitly classified by the user as a project description is a
    # single Project Entity even when it has no CASE/numbered portfolio chrome.
    # This never runs for a generic multi-project Portfolio, so a weak title
    # guess cannot collapse unrelated projects into one entity.
    if not groups and allow_single_project:
        header = _single_project_heading(page_records)
        records = [record for page in page_records.values() for record in page]
        if header and records:
            groups.append({
                "case_number": "single-document-project",
                "title": header["text"].strip(),
                "category_label": "",
                "section_label": header["text"].strip(),
                "pages": [page for page, page_lines in page_records.items() if page is not None and page_lines],
                "records": records,
                "header": header,
            })

    entities: list[dict] = []
    known_labels = set(PORTFOLIO_FIELD_LABELS)
    for group in groups:
        name, subtitle, title_record = _portfolio_resolved_title(group)
        records = group["records"]
        header_anchor = _anchor(source_id, [group["header"]])
        title_anchor = _anchor(source_id, [title_record])
        category = group.get("category_label", "") if title_record is not group["header"] else ""
        data = {
            "name": name,
            "category": category,
            "section_label": group.get("section_label", ""),
            "project_kind": "other",
            "context": subtitle,
            "description": subtitle,
            "status": "",
            "startDate": None,
            "endDate": None,
            "rawDate": "",
            "timeframe": "",
            "organization": "",
            "role": "",
            "roles": [],
            "ownership_scope": "",
            "problem": "",
            "audience": "",
            "responsibilities": [],
            "process": [],
            "tools": [],
            "outputs": [],
            "outcomes": [],
            "unclassified_highlights": [],
            "skills": [],
            "keywords": [],
            "artifacts": [],
            "collaborators": [],
            "ai_assistance": "",
            "boundaries": [],
            "source_pages": [page for page in group["pages"] if page is not None],
            "source_assets": [{"asset_type": "source_page", "source_document_id": source_id, "page": page} for page in group["pages"] if page is not None],
        }
        provenance = _field_provenance(title_anchor, "/name")
        if category:
            _merge_provenance(provenance, _field_provenance(header_anchor, "/category", "/section_label"))
        if subtitle:
            _merge_provenance(provenance, _field_provenance(title_anchor, "/context", "/description"))

        # The first explicit sentence after the header is a context, not a claim.
        header_index = records.index(title_record)
        adjacent = _portfolio_value_records(records, header_index + 1, known_labels)
        if not data["context"] and adjacent:
            data["context"] = adjacent[0]["text"]
            data["description"] = data["context"]
            context_anchor = _anchor(source_id, [adjacent[0]])
            _merge_provenance(provenance, _field_provenance(context_anchor, "/context", "/description"))

        for index, record in enumerate(records):
            label = record["text"].strip().lower()
            path = PORTFOLIO_FIELD_LABELS.get(label)
            if not path:
                continue
            values = _portfolio_value_records(records, index + 1, known_labels, record)
            if not values:
                continue
            value_records = values[:4]
            value = " ".join(item["text"] for item in value_records).strip()
            value_anchor = _anchor(source_id, [record, *value_records])
            if path == "/role" and not data["role"]:
                role_value, role_records = _portfolio_role_value(records, index + 1, known_labels, record)
                if role_value:
                    data["role"] = role_value
                    _merge_provenance(provenance, _field_provenance(_anchor(source_id, [record, *role_records]), path))
            elif path == "/problem" and not data["problem"]:
                data["problem"] = value
                _merge_provenance(provenance, _field_provenance(value_anchor, path))
            elif path in {"/responsibilities", "/process", "/boundaries"}:
                field = path.removeprefix("/")
                data[field].append(f"{record['text'].strip()}: {value}" if label in {"discover", "define", "validate"} else value)
                _merge_provenance(provenance, _field_provenance(value_anchor, f"{path}/{len(data[field]) - 1}"))

        # Explicit technology tokens are recorded as tools only when literally present.
        for record in records:
            for tool in re.findall(r"\b(HTML|JavaScript|CSV)\b", record["text"], re.IGNORECASE):
                if tool.lower() not in {item.lower() for item in data["tools"]}:
                    data["tools"].append(tool)
                    _merge_provenance(provenance, _field_provenance(_anchor(source_id, [record]), f"/tools/{len(data['tools']) - 1}"))
        for record in records:
            text = record["text"]
            if re.search(r"^(?:MVP|Documented prototype|HTML \+ JavaScript front-end|CSV import and export|Manual material entry|Card UI and AR visual exploration)$", text, re.IGNORECASE):
                data["outputs"].append(text)
                _merge_provenance(provenance, _field_provenance(_anchor(source_id, [record]), f"/outputs/{len(data['outputs']) - 1}"))
            if re.search(r"AI-assisted", text, re.IGNORECASE):
                data["ai_assistance"] = text
                _merge_provenance(provenance, _field_provenance(_anchor(source_id, [record]), "/ai_assistance"))
            if re.match(r"^(?:No verified|Not claimed:)", text, re.IGNORECASE) and not any(item.startswith(text) or text.startswith(item) for item in data["boundaries"]):
                data["boundaries"].append(text)
                _merge_provenance(provenance, _field_provenance(_anchor(source_id, [record]), f"/boundaries/{len(data['boundaries']) - 1}"))

        source_anchor = _anchor(source_id, records)
        _merge_provenance(provenance, _field_provenance(source_anchor, "/source_pages", "/source_assets"))
        limitations = ["portfolio_text_ocr_requires_human_review", "self_reported_portfolio_claim_not_independently_verified"]
        if data["ai_assistance"]:
            limitations.append("ai_assisted_work_not_independent_coding_evidence")
        entity = _entity(source_id, "project", start_order + len(entities), data, provenance, limitations)
        entity["entity_origin"] = "portfolio"
        entity["extraction"]["method"] = "career-portfolio-entity-grouping-v2"
        entity["extraction"]["confidence"] = "low"
        entity["extraction"]["warnings"] = ["ocr_text_requires_entity_review"]
        entities.append(entity)
    return entities


def _apply_classification_corrections(entities: list[dict], corrections: list[dict]) -> None:
    """Apply bounded, review-only local type suggestions to matching entities."""
    for entity in entities:
        name = str(entity.get("data", {}).get("name") or entity.get("data", {}).get("institution") or "")
        for correction in corrections:
            if correction["kind"] != "classification_correction" or correction["source_text"] != name:
                continue
            target = correction["target_value"]
            if target not in {"work_experience", "education", "project"} or entity["entity_type"] == target:
                continue
            if target == "education":
                data = entity["data"]
                entity["data"] = {
                    "institution": name, "url": "", "area": "", "studyType": "", "location": data.get("location", ""),
                    "startDate": data.get("startDate"), "endDate": data.get("endDate"), "rawDate": data.get("rawDate", ""),
                    "score": "", "courses": [], "summary": data.get("summary", ""), "highlights": data.get("unclassified_highlights", []),
                }
            entity["entity_type"] = target
            entity["extraction"]["warnings"].append("local_classification_memory_applied")
            entity["extraction"]["confidence"] = "low"


def propose_entities(pages: list[dict], source_id: str, document_type: str, local_corrections: list[dict] | None = None) -> tuple[list[dict], list[str], str]:
    records = _line_records(pages)
    sections = _sections(records, local_corrections)
    entities: list[dict] = []
    warnings: list[str] = []
    if document_type == "resume":
        basics = _parse_basics(source_id, sections, len(entities))
        if basics:
            entities.append(basics)
        entities.extend(_parse_grouped_entities(source_id, sections.get("work", []), "work_experience", len(entities)))
        entities.extend(_parse_grouped_entities(source_id, sections.get("other_experience", []), "custom_section", len(entities)))
        entities.extend(_parse_grouped_entities(source_id, sections.get("projects", []), "project", len(entities)))
        education_records = sections.get("education", []) + sections.get("education_and_tools", [])
        education, consumed = _parse_education(source_id, education_records, len(entities))
        entities.extend(education)
        skill_records = sections.get("skills", []) + [record for record in sections.get("education_and_tools", []) if record not in consumed]
        entities.extend(_parse_skills(source_id, skill_records, len(entities)))
        entities.extend(_parse_awards(source_id, sections.get("awards", []), len(entities)))
    elif document_type in {"portfolio", "project_description"}:
        entities.extend(_parse_portfolio_projects(source_id, pages, len(entities), allow_single_project=document_type == "project_description"))
        if not entities:
            warnings.append("portfolio_projects_not_detected")
    else:
        warnings.append("unsupported_entity_document_type")
    _apply_classification_corrections(entities, local_corrections or [])
    status = "needs_review" if entities else "needs_manual_selection"
    return entities, warnings, status


def extract_career_document(payload: dict, pdf_script_path: Path, visual_ocr_script_path: Path | None = None) -> dict:
    filename, media_type = _validate_identity(payload.get("filename"), payload.get("media_type"))
    content = _decode_data_url(payload.get("document_data_url"), media_type)
    document_type = payload.get("document_type", "resume")
    if document_type not in {"resume", "portfolio", "project_description", "other"}:
        raise CareerDocumentError("unsupported_career_document_type")
    extraction_warnings: list[str] = []
    if media_type == "application/pdf":
        pages, source_extraction_method, extraction_warnings = _selective_pdf_pages(content, pdf_script_path, visual_ocr_script_path)
        if document_type == "resume":
            pages, layout_changed = _adaptive_resume_layout(pages)
            if layout_changed:
                source_extraction_method += "+adaptive_gaptree_resume"
                extraction_warnings.append("adaptive_multicolumn_reading_order")
    elif media_type.endswith("wordprocessingml.document"):
        pages = _docx_pages(content)
        source_extraction_method = "docx_xml_text_v0"
    else:
        pages = _text_pages(content)
        source_extraction_method = "utf8_text_v0"
    local_corrections = _safe_local_corrections(payload.get("local_corrections"), document_type)
    pages = _apply_ocr_corrections(pages, local_corrections)
    content_hash = hashlib.sha256(content).hexdigest()
    source_id = f"source-{content_hash[:20]}"
    entities, warnings, status = propose_entities(pages, source_id, document_type, local_corrections)
    warnings = extraction_warnings + warnings
    document_blocks = _document_blocks(pages, source_id, content_hash)
    run_identity = f"{source_id}|{EXTRACTOR_VERSION}|{document_type}"
    extraction_run_id = f"run-{hashlib.sha256(run_identity.encode()).hexdigest()[:20]}"
    for entity in entities:
        entity["extraction"]["run_id"] = extraction_run_id
    return {
        "source_document": {
            "source_document_id": source_id, "original_filename": filename, "media_type": media_type,
            "content_hash": content_hash, "byte_size": len(content), "document_type": document_type,
            "extraction_method": source_extraction_method, "extraction_status": status,
        },
        "extraction_run": {
            "extraction_run_id": extraction_run_id, "contract_id": ENTITY_CONTRACT_ID,
            "source_document_id": source_id, "document_type": document_type, "extractor_version": EXTRACTOR_VERSION,
            "input_content_hash": content_hash, "status": status, "entity_count": len(entities),
            "warnings": warnings, "model_call_made": False,
        },
        "pages": pages,
        "document_blocks": document_blocks,
        "candidate_entities": entities,
        "processing_boundary": "localhost_transient_document_extraction",
        "model_call_made": False,
        "review_required": bool(entities),
    }


def _extract_document_only(
    payload: dict,
    pdf_script_path: Path,
    visual_ocr_script_path: Path | None = None,
    *,
    source_prefix: str,
    invalid_source_code: str,
    processing_boundary: str,
) -> dict:
    """Extract one bounded local source without semantic structuring."""
    filename, media_type = _validate_identity(payload.get("filename"), payload.get("media_type"))
    source_id = payload.get("source_document_id")
    if not isinstance(source_id, str) or not source_id.startswith(source_prefix) or len(source_id) > 160:
        raise CareerDocumentError(invalid_source_code)
    content = _decode_data_url(payload.get("document_data_url"), media_type)
    extraction_warnings: list[str] = []
    if media_type == "application/pdf":
        pages, extraction_method, extraction_warnings = _selective_pdf_pages(
            content,
            pdf_script_path,
            visual_ocr_script_path,
        )
    elif media_type.endswith("wordprocessingml.document"):
        pages = _docx_pages(content)
        extraction_method = "docx_xml_text_v0"
    else:
        pages = _text_pages(content)
        extraction_method = "utf8_text_v0"
    content_hash = hashlib.sha256(content).hexdigest()
    document_blocks = _document_blocks(pages, source_id, content_hash)
    extracted_text = "\n\n".join(
        "\n".join(str(line) for line in page.get("lines", []) if str(line).strip())
        for page in pages
    ).strip()
    return {
        "filename": filename,
        "media_type": media_type,
        "content_hash": "sha256:" + content_hash,
        "byte_size": len(content),
        "pages": pages,
        "document_blocks": document_blocks,
        "extracted_text": extracted_text,
        "extraction_method": extraction_method,
        "warnings": extraction_warnings,
        "model_call_made": False,
        "processing_boundary": processing_boundary,
    }


def extract_career_document_only(
    payload: dict,
    pdf_script_path: Path,
    visual_ocr_script_path: Path | None = None,
) -> dict:
    """Extract a bounded local Candidate source without proposing CareerEntities."""
    return _extract_document_only(
        payload,
        pdf_script_path,
        visual_ocr_script_path,
        source_prefix="source-candidate-",
        invalid_source_code="invalid_candidate_source_document_id",
        processing_boundary="localhost_transient_candidate_extraction",
    )


def extract_job_document_only(
    payload: dict,
    pdf_script_path: Path,
    visual_ocr_script_path: Path | None = None,
) -> dict:
    """Extract a bounded local Job source without proposing Job semantics."""
    return _extract_document_only(
        payload,
        pdf_script_path,
        visual_ocr_script_path,
        source_prefix="source-job-",
        invalid_source_code="invalid_job_source_document_id",
        processing_boundary="localhost_transient_job_extraction",
    )
