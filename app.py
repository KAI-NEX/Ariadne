"""AI Job Radar V0: a dependency-free local HTTP API over a SQLite database."""

from __future__ import annotations

import json
import base64
import hashlib
import os
import re
import sqlite3
import subprocess
import tempfile
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

from src.career_evidence import CareerDocumentError, _document_blocks, extract_career_document, extract_career_document_only, propose_entities
from src.execution_contract import ExecutionContractError, validate_runtime_snapshot
from src.ai_career_ingestion import (
    AICareerIngestionError,
    DEFAULT_MODEL as AI_CAREER_DEFAULT_MODEL,
    PROMPT_VERSION as AI_CAREER_PROMPT_VERSION,
    build_gemini_payload,
    build_deepseek_payload,
    decode_original_document,
    extract_gemini_markdown,
    extract_deepseek_markdown,
    response_metadata as ai_response_metadata,
    utc_timestamp as ai_utc_timestamp,
    validate_canonical_markdown,
)
from src.ai_provider_capabilities import (
    DEEPSEEK_MODELS_ENDPOINT, GEMINI_INTERACTIONS_ENDPOINT, GEMINI_MODELS_ENDPOINT,
    provider_catalog, select_deepseek_document_model, select_gemini_document_model,
)
from src.provider_runtime import (
    ProviderRuntimeError, connection_request, deepseek_model_descriptors, descriptor_for,
    is_multimodal, multimodal_connection_request, multimodal_smoke_passed, normalize_response, v1_selector_descriptors,
)
from src.candidate_model_runtime import (
    CandidateModelExecutionRegistry,
    CandidateModelRuntimeError,
    execute_candidate_model_request,
    validate_candidate_model_request,
)
from src.candidate_conversation_runtime import (
    CandidateConversationExecutionRegistry,
    CandidateConversationRuntimeError,
    execute_candidate_conversation_request,
    validate_candidate_conversation_request,
)


PROJECT_ROOT = Path(__file__).parent
DATA_PATH = PROJECT_ROOT / "data" / "jd-001.json"
DATABASE_PATH = PROJECT_ROOT / "data" / "job_radar.db"
SCHEMA_PATH = PROJECT_ROOT / "data" / "schema.sql"
PUBLIC_PATH = PROJECT_ROOT / "public"
OCR_SCRIPT_PATH = PROJECT_ROOT / "src" / "extraction" / "ocr_with_vision.swift"
PDF_TEXT_SCRIPT_PATH = PROJECT_ROOT / "src" / "extraction" / "extract_pdf_text.swift"
PDF_VISUAL_OCR_SCRIPT_PATH = PROJECT_ROOT / "src" / "extraction" / "extract_pdf_visual_text.swift"
OCR_UPLOAD_PATH = PROJECT_ROOT / "data" / "local_ocr_uploads"
RAW_CAPTURE_PATH = PROJECT_ROOT / "data" / "raw"
DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions"
DEEPSEEK_VISION_MODEL = "deepseek-v4-flash-vision-exp"
QWEN_CHAT_COMPLETIONS_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
QWEN_V1_MULTIMODAL_MODEL = "qwen3.8-max"
MULTIMODAL_SMOKE_IMAGE_PATH = PUBLIC_PATH / "job-radar-multimodal-smoke.jpg"
VISION_PROMPT_VERSION = "vision_extract_v1_full"
VISION_PROMPT_VERSION_COMPACT = "vision_extract_v2_compact"
KEYCHAIN_SERVICE = "AI-Learning-OS.JobRadar.DeepSeek"
KEYCHAIN_ACCOUNT = "local-vision"
GEMINI_KEYCHAIN_SERVICE = "AI-Learning-OS.JobRadar.Gemini"
GEMINI_KEYCHAIN_ACCOUNT = "career-ingestion"
APPLICATION_STATUSES = {
    "unknown", "not_applied", "applied", "interviewing", "rejected", "offer", "withdrawn"
}
LEGACY_PROVIDER_ACTION_PATHS = frozenset({
    "/api/ai-providers/deepseek/text-preflight",
    "/api/ai-providers/deepseek/document-preflight",
    "/api/ai-providers/gemini/document-preflight",
    "/api/ai-career-ingest",
    "/api/vision-extract",
})
CANDIDATE_MODEL_EXECUTIONS = CandidateModelExecutionRegistry()
CANDIDATE_CONVERSATION_EXECUTIONS = CandidateConversationExecutionRegistry()


# These patterns deliberately produce review candidates, never authoritative Job fields.
# They cover visible, repeated signals in the user's real BOSS screenshots without
# assuming that every employer uses the same layout or section heading.
RESPONSIBILITY_HEADINGS = (
    "岗位职责", "职位职责", "工作职责", "职责描述", "你会做的事情",
    "需要解决的问题", "工作内容",
)
REQUIREMENT_HEADINGS = (
    "任职要求", "岗位要求", "职位要求", "任职资格", "我们要找的人", "我们希望你", "我们需要你",
)
GENERIC_HEADINGS = ("职位详情", "职位描述", "关于我们", "公司介绍", "福利待遇")
ROLE_MARKERS = ("产品经理", "工程师", "设计师", "运营", "专员", "顾问", "总监", "负责人", "实习生", "builder")
LOCATION_PATTERN = re.compile(
    r"(?:北京|上海|深圳|广州|杭州|厦门|成都|武汉|南京|苏州|长沙|西安|重庆|香港|澳门|台北)(?:[·・\s]?[\u4e00-\u9fff]{1,8}(?:区|县|市))?"
)
SENIORITY_PATTERN = re.compile(r"(?:经验不限|应届(?:生)?|实习|\d{1,2}\s*[-~—]\s*\d{1,2}\s*年|\d{1,2}\s*年以上)")
SALARY_PATTERN = re.compile(r"\d{1,3}\s*[-~—]\s*\d{1,3}\s*[kK](?:\s*[·.]\s*\d+\s*薪)?")


class RejectRedirects(HTTPRedirectHandler):
    """Keep a source probe bounded: no automatic redirect, login or retry."""

    def redirect_request(self, request, fp, code, msg, headers, new_url):  # type: ignore[no-untyped-def]
        return None


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def numbered_items(text: str) -> list[str]:
    matches = list(re.finditer(r"(?m)^\s*\d+[.、]\s*", text))
    if not matches:
        return [text.strip()] if text.strip() else []
    return [text[match.end(): matches[index + 1].start() if index + 1 < len(matches) else None].strip()
            for index, match in enumerate(matches)]


def source_text(value: object) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else "unknown"


def source_evidence(label: str) -> list[dict]:
    return [{"source": label}]


def tencent_link_details(url: str) -> tuple[str, str] | None:
    parsed = urlparse(url.strip())
    post_id = parse_qs(parsed.query).get("postId", [None])[0]
    if (parsed.scheme != "https" or parsed.hostname != "careers.tencent.com"
            or parsed.path != "/jobdesc.html" or not isinstance(post_id, str) or not post_id.isdigit()):
        return None
    canonical_url = f"https://careers.tencent.com/jobdesc.html?postId={post_id}"
    return post_id, canonical_url


def tencent_extraction(data: dict, post_id: str) -> dict:
    evidence = source_evidence(f"Tencent Careers API · postId {post_id}")
    fields = {
        "company": source_text(data.get("ComName")),
        "title": source_text(data.get("RecruitPostName")),
        "location": source_text(data.get("LocationName")),
        "seniority": source_text(data.get("RequireWorkYearsName")),
        "salary": "unknown",
    }
    candidate_fields = {
        name: proposed(value, evidence, "tencent_api_source_field") if value != "unknown" else unknown_candidate()
        for name, value in fields.items()
    }
    sections = {}
    for name, api_key in (("responsibilities", "Responsibility"), ("requirements", "Requirement")):
        values = numbered_items(source_text(data.get(api_key)))
        sections[name] = ([{
            "text": "\n".join(values), "evidence": evidence, "heading_evidence": evidence[0],
            "status": "proposed", "reason": "tencent_api_numbered_items",
        }] if values and values != ["unknown"] else [])
    return {
        "extractor": "tencent_careers_api_v1", "fields": candidate_fields, "sections": sections,
        "ocr_pages": [], "model_assist_recommendation": {"recommended": False, "reasons": [], "boundary": "source_api_candidate"},
        "review_required": True,
    }


def decode_image_data_urls(payload: dict) -> list[tuple[str, bytes]]:
    """Accept only the bounded image payload shared by local OCR and vision extraction."""
    data_urls = payload.get("image_data_urls") or [payload["image_data_url"]]
    if not isinstance(data_urls, list) or not 1 <= len(data_urls) <= 4:
        raise ValueError("invalid_image_count")
    decoded_images: list[tuple[str, bytes]] = []
    for data_url in data_urls:
        header, encoded = data_url.split(",", 1)
        mime_type = header.removeprefix("data:").removesuffix(";base64")
        if mime_type not in {"image/png", "image/jpeg"}:
            raise ValueError("invalid_image_type")
        image_bytes = base64.b64decode(encoded, validate=True)
        if not image_bytes or len(image_bytes) > 5_000_000:
            raise ValueError("invalid_image_size")
        decoded_images.append((mime_type, image_bytes))
    if sum(len(image_bytes) for _, image_bytes in decoded_images) > 12_000_000:
        raise ValueError("request_too_large")
    return decoded_images


def render_complete_pdf_pages(pdf_bytes: bytes) -> list[tuple[str, bytes]]:
    """Render every original PDF page transiently for an account-enabled vision model.

    This is a transport adapter, not Local Mode entity extraction: no OCR text,
    DocumentBlock or CareerEntity is created before the provider response.
    """
    with tempfile.TemporaryDirectory(prefix="job-radar-career-pages-") as directory:
        root = Path(directory)
        source = root / "source.pdf"
        source.write_bytes(pdf_bytes)
        output_prefix = root / "page"
        try:
            subprocess.run(
                ["pdftoppm", "-jpeg", "-r", "120", "-jpegopt", "quality=82", str(source), str(output_prefix)],
                check=True, capture_output=True, timeout=120,
            )
        except (subprocess.SubprocessError, OSError) as error:
            raise AICareerIngestionError("pdf_page_render_failed") from error
        paths = sorted(root.glob("page-*.jpg"), key=lambda path: int(path.stem.rsplit("-", 1)[1]))
        if not paths:
            raise AICareerIngestionError("pdf_page_render_empty")
        pages = [(str(index), path.read_bytes()) for index, path in enumerate(paths, start=1)]
        if sum(len(image) for _, image in pages) > 40_000_000:
            raise AICareerIngestionError("rendered_pages_exceed_request_limit")
        return pages


def save_local_evidence(decoded_images: list[tuple[str, bytes]]) -> list[dict]:
    """Persist original screenshots locally before either OCR or a cloud model sees them."""
    OCR_UPLOAD_PATH.mkdir(parents=True, exist_ok=True)
    images: list[dict] = []
    for image_index, (mime_type, image_bytes) in enumerate(decoded_images, start=1):
        suffix = ".png" if mime_type == "image/png" else ".jpg"
        image_path = OCR_UPLOAD_PATH / f"ocr-{uuid.uuid4()}-{image_index}{suffix}"
        image_path.write_bytes(image_bytes)
        images.append({
            "image_index": image_index,
            "mime_type": mime_type,
            "image_bytes": image_bytes,
            "evidence_path": str(image_path.relative_to(PROJECT_ROOT)),
        })
    return images


def local_ocr_environment_capability() -> str:
    """Return evidence-backed Local OCR availability without a Provider call."""
    if os.uname().sysname != "Darwin":
        return "unsupported"
    try:
        result = subprocess.run(
            ["swift", str(OCR_SCRIPT_PATH), "--probe"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return "unsupported"
    if result.returncode != 0:
        return "unsupported"
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return "unverified"
    return "supported" if payload.get("local_ocr") == "supported" else "unverified"


def local_snapshot_from_payload(payload: dict) -> dict:
    """Validate the batch snapshot supplied to a local extraction route."""
    try:
        snapshot = validate_runtime_snapshot(payload.get("runtime_snapshot"))
    except ExecutionContractError as error:
        raise CareerDocumentError("invalid_runtime_snapshot") from error
    if snapshot.mode != "local":
        raise CareerDocumentError("candidate_local_runtime_required")
    return snapshot.to_dict()


def run_apple_vision_ocr(image_path: Path) -> dict:
    try:
        result = subprocess.run(
            ["swift", str(OCR_SCRIPT_PATH), str(image_path)],
            check=True,
            capture_output=True,
            text=True,
            timeout=45,
        )
        payload = json.loads(result.stdout)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError) as error:
        raise CareerDocumentError("local_ocr_failed") from error
    if not isinstance(payload.get("text", ""), str) or not isinstance(payload.get("line_count", 0), int):
        raise CareerDocumentError("local_ocr_failed")
    return payload


def keychain_has_deepseek_key() -> bool:
    result = subprocess.run(
        ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT],
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.returncode == 0


def store_deepseek_key(api_key: str) -> None:
    subprocess.run(
        ["security", "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w", api_key],
        check=True,
        capture_output=True,
        text=True,
        timeout=15,
    )


def read_deepseek_key() -> str | None:
    result = subprocess.run(
        ["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    return result.stdout.strip() if result.returncode == 0 and result.stdout.strip() else None


def call_deepseek_chat_completions(api_key: str, payload: dict, *, response_limit: int, timeout: int = 240) -> tuple[int, dict]:
    """Shared fixed-endpoint transport; callers own operation-specific normalization."""
    request = Request(
        DEEPSEEK_ENDPOINT,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed Provider endpoint
        response_body = response.read(response_limit + 1)
        if len(response_body) > response_limit:
            raise ValueError("provider_response_too_large")
        try:
            return response.status, json.loads(response_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("provider_response_malformed") from error


def deepseek_runtime_models() -> dict:
    """Return account-visible DeepSeek models for the runtime selector only."""
    api_key = read_deepseek_key()
    if not api_key:
        return {"ok": False, "status": HTTPStatus.PRECONDITION_REQUIRED, "error": "deepseek_key_not_configured", "failure_layer": "credential", "network_call_made": False}
    try:
        with urlopen(Request(DEEPSEEK_MODELS_ENDPOINT, headers={"Authorization": f"Bearer {api_key}"}), timeout=30) as response:  # noqa: S310
            listing = json.loads(response.read(1_000_000).decode("utf-8"))
        models = [str(item.get("id")) for item in listing.get("data") or [] if isinstance(item, dict) and item.get("id")]
        if not models:
            raise ValueError("deepseek_model_listing_empty")
    except HTTPError as error:
        layer = "credential" if error.code in {401, 403} else "provider"
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": "deepseek_provider_http_error", "failure_layer": layer, "provider_http_status": error.code, "network_call_made": True}
    except (URLError, TimeoutError, OSError) as error:
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": str(error) or "deepseek_transport_error", "failure_layer": "transport", "network_call_made": True}
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": str(error) or "deepseek_model_listing_failed", "failure_layer": "provider", "network_call_made": True}
    descriptors = deepseek_model_descriptors(models)
    return {"ok": True, "status": HTTPStatus.OK, "models": models, "descriptors": descriptors, "network_call_made": True}


def qwen_runtime_connection_check(api_key: str) -> dict:
    """Run the smallest real Qwen text+image readiness check without storing its key."""
    if not 20 <= len(api_key) <= 2_000:
        return {"ok": False, "status": HTTPStatus.BAD_REQUEST, "error": "invalid_provider_api_key", "network_call_made": False}
    try:
        payload = {
            "model": QWEN_V1_MULTIMODAL_MODEL,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": "Read the text in this image. Reply only with the text you see."},
                {"type": "image_url", "image_url": {"url": synthetic_multimodal_smoke_image_data_url()}},
            ]}],
            "max_tokens": 32,
            "temperature": 0,
        }
        request = Request(QWEN_CHAT_COMPLETIONS_ENDPOINT, data=json.dumps(payload).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=30) as response:  # noqa: S310 - fixed official Qwen endpoint
            result = json.loads(response.read(2_000_000).decode("utf-8"))
        content = str((((result.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
        if "JOB RADAR TEST" not in content.upper():
            raise ValueError("qwen_multimodal_smoke_mismatch")
        return {"ok": True, "status": HTTPStatus.OK, "models": [QWEN_V1_MULTIMODAL_MODEL], "verified_model_id": QWEN_V1_MULTIMODAL_MODEL, "network_call_made": True}
    except HTTPError as error:
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": "qwen_provider_http_error", "provider_http_status": error.code, "network_call_made": True}
    except (URLError, TimeoutError, OSError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": "qwen_model_listing_failed", "network_call_made": True}


def synthetic_multimodal_smoke_image_data_url() -> str:
    """Load the fixed, non-user JPEG used only for an approved capability check."""
    return "data:image/jpeg;base64," + base64.b64encode(MULTIMODAL_SMOKE_IMAGE_PATH.read_bytes()).decode("ascii")


def deepseek_runtime_connection_check(model: str, synthetic_image_data_url: str | None = None) -> dict:
    """Perform the capability-matched runtime check when explicitly authorized."""
    options = deepseek_runtime_models()
    if not options["ok"]:
        return options
    try:
        descriptor = descriptor_for(model, options["descriptors"])
        test_request = (multimodal_connection_request(descriptor, synthetic_image_data_url)
                        if synthetic_image_data_url else connection_request(descriptor))
    except ProviderRuntimeError as error:
        return {"ok": False, "status": HTTPStatus.UNPROCESSABLE_ENTITY, "error": error.code, "failure_layer": error.failure_layer, "network_call_made": True}

    api_key = read_deepseek_key()
    if not api_key:  # Credential can disappear between listing and ping.
        return {"ok": False, "status": HTTPStatus.PRECONDITION_REQUIRED, "error": "deepseek_key_not_configured", "failure_layer": "credential", "network_call_made": False}
    check_id = f"connection-test-{uuid.uuid4()}"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        request = Request(test_request.endpoint, data=json.dumps(test_request.payload).encode("utf-8"), headers=headers, method="POST")
        with urlopen(request, timeout=60) as response:  # noqa: S310 - fixed official provider endpoint
            result = json.loads(response.read(1_000_000).decode("utf-8"))
        normalized = normalize_response(test_request.protocol, result)
        if synthetic_image_data_url and not multimodal_smoke_passed(normalized.text):
            raise ProviderRuntimeError("multimodal_smoke_expected_text_not_returned", "unexpected_response")
    except HTTPError as error:
        layer = "credential" if error.code in {401, 403} else "model" if error.code == 404 else "provider"
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": "deepseek_provider_http_error", "failure_layer": layer, "provider_http_status": error.code, "network_call_made": True}
    except (URLError, TimeoutError, OSError) as error:
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": str(error) or "deepseek_transport_error", "failure_layer": "transport", "network_call_made": True}
    except ProviderRuntimeError as error:
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": error.code, "failure_layer": error.failure_layer, "network_call_made": True}
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        return {"ok": False, "status": HTTPStatus.BAD_GATEWAY, "error": str(error) or "deepseek_unexpected_response", "failure_layer": "unexpected_response", "network_call_made": True}

    return {
        "ok": True, "status": HTTPStatus.OK, "provider": "deepseek", "model": model,
        "network_call_made": True,
        "diagnostics": {
            "check_id": check_id, "purpose": "MULTIMODAL_CONNECTION_TEST" if synthetic_image_data_url else "CONNECTION_TEST", "credential": "read_from_macos_keychain",
            "career_data_sent": False, "protocol": test_request.protocol, "endpoint": test_request.endpoint,
            "response_id": normalized.response_id, "multimodal_connection_ready": bool(synthetic_image_data_url),
            "structured_output_verified": False,
            "usage": normalized.usage,
        },
    }


def store_gemini_key(api_key: str) -> None:
    subprocess.run(
        ["security", "add-generic-password", "-U", "-s", GEMINI_KEYCHAIN_SERVICE,
         "-a", GEMINI_KEYCHAIN_ACCOUNT, "-w", api_key],
        check=True,
        capture_output=True,
        text=True,
        timeout=15,
    )


def read_gemini_key() -> str | None:
    """Prefer a process-scoped environment credential, then the local Keychain."""
    environment_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if environment_key:
        return environment_key
    result = subprocess.run(
        ["security", "find-generic-password", "-s", GEMINI_KEYCHAIN_SERVICE,
         "-a", GEMINI_KEYCHAIN_ACCOUNT, "-w"],
        capture_output=True,
        text=True,
        timeout=15,
    )
    return result.stdout.strip() if result.returncode == 0 and result.stdout.strip() else None


def vision_instruction(version: str = VISION_PROMPT_VERSION) -> str:
    if version == VISION_PROMPT_VERSION_COMPACT:
        return """Read the supplied JD screenshots. Use only visible job facts; ignore recruiter info, CTA/buttons, ads and company-card metadata. If unreadable or absent, use \"unknown\"; never infer.
Return JSON only:
{"fields":{"company":"...|unknown","title":"...|unknown","location":"...|unknown","seniority":"...|unknown","salary":"...|unknown"},"responsibilities":["..."],"requirements":["..."],"evidence":[{"field":"company|title|location|seniority|salary|responsibilities|requirements","image_index":1,"quote":"visible proof, max 50 chars"}]}
Every non-unknown field and non-empty list needs evidence. image_index refers to an input screenshot."""
    return """You extract a job-description candidate from the supplied screenshots.
Read only visible evidence. Ignore recruiter profile/name/activity, chat buttons, download-app prompts, ads, company-card metadata and unrelated UI.
Use \"unknown\" when a field is not visible or readable; never invent facts. Keep each responsibility/requirement as a separate concise visible item.
Return JSON only, exactly with this shape:
{
  "fields":{"company":"...|unknown","title":"...|unknown","location":"...|unknown","seniority":"...|unknown","salary":"...|unknown"},
  "responsibilities":["..."],
  "requirements":["..."],
  "evidence":[{"field":"company|title|location|seniority|salary|responsibilities|requirements","image_index":1,"quote":"short visible text proving this value"}]
}
Every non-unknown field and every non-empty list must have at least one evidence item. image_index must refer to a supplied screenshot."""


def validate_vision_output(raw_response: str, image_count: int) -> tuple[dict | None, str | None]:
    """Validate syntax and the evidence boundary before a model result reaches the review UI."""
    try:
        result = json.loads(raw_response)
        fields = result["fields"]
        responsibilities = result["responsibilities"]
        requirements = result["requirements"]
        evidence = result["evidence"]
    except (TypeError, KeyError, json.JSONDecodeError):
        return None, "model_output_not_expected_json"
    field_names = {"company", "title", "location", "seniority", "salary"}
    allowed_evidence_fields = field_names | {"responsibilities", "requirements"}
    if set(result) != {"fields", "responsibilities", "requirements", "evidence"} or set(fields) != field_names:
        return None, "model_output_schema_mismatch"
    if any(not isinstance(value, str) or len(value) > 160 for value in fields.values()):
        return None, "model_output_invalid_field"
    if not all(isinstance(items, list) and all(isinstance(item, str) and 0 < len(item) <= 600 for item in items)
               for items in (responsibilities, requirements)):
        return None, "model_output_invalid_section"
    if not isinstance(evidence, list) or not evidence:
        return None, "model_output_missing_evidence"
    evidence_by_field: dict[str, list[dict]] = {name: [] for name in allowed_evidence_fields}
    for item in evidence:
        if (not isinstance(item, dict) or set(item) != {"field", "image_index", "quote"}
                or item["field"] not in allowed_evidence_fields
                or not isinstance(item["image_index"], int) or not 1 <= item["image_index"] <= image_count
                or not isinstance(item["quote"], str) or not item["quote"].strip() or len(item["quote"]) > 240):
            return None, "model_output_invalid_evidence"
        evidence_by_field[item["field"]].append(item)
    for name, value in fields.items():
        if value != "unknown" and not evidence_by_field[name]:
            return None, "model_output_field_without_evidence"
    if responsibilities and not evidence_by_field["responsibilities"]:
        return None, "model_output_responsibilities_without_evidence"
    if requirements and not evidence_by_field["requirements"]:
        return None, "model_output_requirements_without_evidence"
    return result, None


def vision_result_as_extraction(result: dict) -> dict:
    evidence_by_field: dict[str, list[dict]] = {}
    for item in result["evidence"]:
        evidence_by_field.setdefault(item["field"], []).append({
            "image_index": item["image_index"], "quote": item["quote"],
        })
    fields = {
        name: proposed(value, evidence_by_field.get(name, []), "vision_model_visible_evidence")
        if value != "unknown" else unknown_candidate()
        for name, value in result["fields"].items()
    }
    sections = {}
    for name in ("responsibilities", "requirements"):
        section_evidence = evidence_by_field.get(name, [])
        sections[name] = ([{
            "text": "\n".join(result[name]), "evidence": section_evidence,
            "heading_evidence": section_evidence[0], "status": "proposed",
            "reason": "vision_model_visible_evidence",
        }] if result[name] else [])
    return {
        "extractor": "deepseek_vision_extraction_v0",
        "fields": fields,
        "sections": sections,
        "ocr_pages": [],
        "model_assist_recommendation": {"recommended": False, "reasons": [], "boundary": "vision_call_completed"},
        "review_required": True,
    }


def evidence_ref(record: dict) -> dict:
    return {"image_index": record["image_index"], "line": record["line"]}


def proposed(value: str, evidence: list[dict], reason: str) -> dict:
    """A reviewable extraction result, not a claim that the value is correct."""
    return {
        "value": value,
        "status": "proposed",
        "evidence": evidence,
        "reason": reason,
    }


def unknown_candidate() -> dict:
    return {"value": "unknown", "status": "unknown", "evidence": [], "reason": "no_explicit_signal"}


def heading_kind(text: str) -> str | None:
    normalized = re.sub(r"\s", "", text).lower()
    if any(heading.lower() in normalized for heading in RESPONSIBILITY_HEADINGS):
        return "responsibilities"
    if any(heading.lower() in normalized for heading in REQUIREMENT_HEADINGS):
        return "requirements"
    if any(heading.lower() in normalized for heading in GENERIC_HEADINGS):
        return "generic"
    return None


def extract_ocr_candidates(text: str) -> dict:
    return extract_ocr_candidates_from_pages([text])


def extract_ocr_candidates_from_pages(page_texts: list[str]) -> dict:
    """Create evidence-backed candidates from OCR text using narrow, fail-closed rules."""
    numbered = [
        {"image_index": image_index, "line": line_number, "text": line.strip()}
        for image_index, page_text in enumerate(page_texts, start=1)
        for line_number, line in enumerate(page_text.splitlines(), start=1)
        if line.strip()
    ]
    fields = {
        "company": unknown_candidate(),
        "title": unknown_candidate(),
        "location": unknown_candidate(),
        "seniority": unknown_candidate(),
        "salary": unknown_candidate(),
    }

    # A company is proposed only when the screenshot explicitly labels it as a recruiter.
    for record in numbered:
        recruiter = re.search(r"^(.{2,40}?)[·・]\s*招聘者", record["text"])
        if recruiter:
            fields["company"] = proposed(recruiter.group(1).strip(), [evidence_ref(record)], "explicit_recruiter_label")
            break

    # Desktop BOSS screenshots often label a right-side company card. A candidate is
    # proposed only after that exact heading, while obvious company-card metadata is skipped.
    if fields["company"]["status"] == "unknown":
        for index, record in enumerate(numbered):
            if re.sub(r"\s", "", record["text"]) != "公司基本信息":
                continue
            for candidate in numbered[index + 1:index + 6]:
                value = candidate["text"].strip()
                if (len(value) >= 2 and len(value) <= 40 and not re.search(
                    r"^(?:[A-E]\d+|已上市|未上市|\d+人|互联网|人工智能|查看全部职位|下载App|找工作|上BOSS)", value
                )):
                    fields["company"] = proposed(value, [evidence_ref(candidate)], "company_card_after_explicit_heading")
                    break
            break

    # BOSS headers normally occur near the beginning of the OCR result. We require a
    # recognisable role marker and reject generic headings to avoid treating prose as a title.
    for record in numbered[:20]:
        line = record["text"]
        compact = re.sub(r"\s", "", line)
        if (2 <= len(compact) <= 50 and heading_kind(compact) is None
                and any(marker.lower() in compact.lower() for marker in ROLE_MARKERS)):
            title = SALARY_PATTERN.sub("", line).strip(" ·-—~")
            if title:
                fields["title"] = proposed(title, [evidence_ref(record)], "early_line_with_role_marker")
            break

    for field_name, pattern, reason in (
        ("location", LOCATION_PATTERN, "visible_city_or_district_pattern"),
        ("seniority", SENIORITY_PATTERN, "visible_experience_pattern"),
        ("salary", SALARY_PATTERN, "visible_salary_pattern"),
    ):
        for record in numbered[:30]:
            match = pattern.search(record["text"])
            if match:
                fields[field_name] = proposed(match.group(0), [evidence_ref(record)], reason)
                break

    sections: dict[str, list[dict]] = {"responsibilities": [], "requirements": []}
    active_kind: str | None = None
    active_start: dict | None = None
    active_lines: list[dict] = []

    def flush_section() -> None:
        nonlocal active_kind, active_start, active_lines
        if active_kind and active_lines:
            sections[active_kind].append({
                "text": "\n".join(item["text"] for item in active_lines),
                "evidence": [evidence_ref(item) for item in active_lines],
                "heading_evidence": evidence_ref(active_start),
                "status": "proposed",
                "reason": "explicit_section_heading",
            })
        active_kind, active_start, active_lines = None, None, []

    for record in numbered:
        kind = heading_kind(record["text"])
        if kind in {"responsibilities", "requirements"}:
            flush_section()
            active_kind, active_start = kind, record
            continue
        if kind == "generic":
            flush_section()
            continue
        if active_kind:
            active_lines.append(record)
    flush_section()

    unknown_core_fields = [
        name for name in ("company", "title", "location", "seniority")
        if fields[name]["status"] == "unknown"
    ]
    model_assist_reasons: list[str] = []
    if len(unknown_core_fields) >= 2 and len(numbered) >= 12:
        model_assist_reasons.append("multiple_core_fields_unknown_despite_ocr_text")
    if not sections["responsibilities"] and not sections["requirements"] and len(numbered) >= 20:
        model_assist_reasons.append("long_ocr_text_without_recognized_role_sections")

    return {
        "extractor": "rule_assisted_ocr_v1",
        "fields": fields,
        "sections": sections,
        "ocr_pages": [
            {
                "image_index": image_index,
                "lines": [
                    {"line": record["line"], "text": record["text"]}
                    for record in numbered if record["image_index"] == image_index
                ],
            }
            for image_index in range(1, len(page_texts) + 1)
        ],
        "model_assist_recommendation": {
            "recommended": bool(model_assist_reasons),
            "reasons": model_assist_reasons,
            "boundary": "recommendation_only_no_model_request",
        },
        "review_required": True,
    }


def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    """Create the table and seed the real JD exactly once."""
    with connect() as connection:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(jobs)")}
        if "source_url" not in columns:
            connection.execute("ALTER TABLE jobs ADD COLUMN source_url TEXT")
        if "responsibilities_json" not in columns:
            connection.execute(
                "ALTER TABLE jobs ADD COLUMN responsibilities_json TEXT NOT NULL DEFAULT '[]'"
            )
        if "requirements_json" not in columns:
            connection.execute(
                "ALTER TABLE jobs ADD COLUMN requirements_json TEXT NOT NULL DEFAULT '[]'"
            )
        for column, definition in {
            "external_source_name": "TEXT",
            "external_job_id": "TEXT",
            "source_title": "TEXT",
            "source_location": "TEXT",
            "source_seniority": "TEXT",
            "raw_capture_path": "TEXT",
            "raw_capture_sha256": "TEXT",
            "last_successful_fetch_at": "TEXT",
        }.items():
            if column not in columns:
                connection.execute(f"ALTER TABLE jobs ADD COLUMN {column} {definition}")
        analysis_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(job_analyses)")
        }
        for column, definition in {
            "instruction_version": "TEXT NOT NULL DEFAULT 'unknown'",
            "provider_name": "TEXT NOT NULL DEFAULT 'unknown'",
            "model_name": "TEXT NOT NULL DEFAULT 'unknown'",
            "input_json": "TEXT NOT NULL DEFAULT '{}'",
        }.items():
            if column not in analysis_columns:
                connection.execute(f"ALTER TABLE job_analyses ADD COLUMN {column} {definition}")
        job = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        job["responsibilities_json"] = json.dumps(job.pop("responsibilities"), ensure_ascii=False)
        job["requirements_json"] = json.dumps(job.pop("requirements"), ensure_ascii=False)
        connection.execute(
            """
            INSERT OR IGNORE INTO jobs (
                job_id, company, title, location, seniority, source_path,
                source_url, responsibilities_json, requirements_json, captured_date,
                published_date, posting_status, application_status
            ) VALUES (
                :job_id, :company, :title, :location, :seniority, :source_path,
                :source_url, :responsibilities_json, :requirements_json, :captured_date,
                :published_date, :posting_status, :application_status
            )
            """,
            job,
        )
        connection.execute(
            "UPDATE jobs SET source_url = ? WHERE job_id = ? AND source_url IS NULL",
            (job["source_url"], job["job_id"]),
        )
        connection.execute(
            """
            UPDATE jobs
            SET responsibilities_json = ?, requirements_json = ?
            WHERE job_id = ?
              AND responsibilities_json = '[]'
              AND requirements_json = '[]'
            """,
            (job["responsibilities_json"], job["requirements_json"], job["job_id"]),
        )


def job_payload(row: sqlite3.Row) -> dict:
    """Turn SQLite JSON text into API lists for detail responses."""
    job = dict(row)
    for field in ("responsibilities_json", "requirements_json"):
        if field in job:
            job[field.removesuffix("_json")] = json.loads(job.pop(field))
    return job


class JobRadarHandler(SimpleHTTPRequestHandler):
    """Serve the browser UI plus two read-only API routes."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PUBLIC_PATH), **kwargs)

    def end_headers(self) -> None:
        """Keep local HTML/JS in step with the localhost API during development."""
        if urlparse(self.path).path.endswith((".html", ".js")) or urlparse(self.path).path == "/":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802 - required by the standard library
        parsed = urlparse(self.path)
        if parsed.path == "/api/runtime-options":
            self.runtime_options()
            return
        if parsed.path == "/api/ai-career-ingestion-config":
            self.send_json(HTTPStatus.OK, {
                "providers": provider_catalog({"deepseek": bool(read_deepseek_key()), "gemini": bool(read_gemini_key())}),
                "prompt_version": AI_CAREER_PROMPT_VERSION,
                "supported_media_types": ["application/pdf"],
                "supported_document_types": ["resume", "portfolio"],
                "network_call_made": False,
            })
            return
        if parsed.path == "/api/local-vision-config":
            self.send_json(HTTPStatus.OK, {
                "key_configured": keychain_has_deepseek_key(),
                "model": DEEPSEEK_VISION_MODEL,
                "storage": "macos_keychain",
                "network_call_made": False,
            })
            return
        if parsed.path == "/api/source-link-status":
            self.source_link_status(parse_qs(parsed.query).get("url", [""])[0])
            return
        if parsed.path.startswith("/api/local-ocr-evidence/"):
            self.get_local_ocr_evidence(parsed.path.removeprefix("/api/local-ocr-evidence/"))
            return
        if parsed.path == "/api/jobs":
            self.list_jobs(parse_qs(parsed.query))
            return
        if parsed.path.startswith("/api/jobs/"):
            self.get_job(parsed.path.removeprefix("/api/jobs/"))
            return
        super().do_GET()

    def get_local_ocr_evidence(self, filename: str) -> None:
        safe_name = Path(filename).name
        if safe_name != filename or not safe_name.startswith("ocr-") or not safe_name.endswith((".png", ".jpg")):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "ocr_evidence_not_found"})
            return
        image_path = OCR_UPLOAD_PATH / safe_name
        if not image_path.is_file():
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "ocr_evidence_not_found"})
            return
        body = image_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "image/png" if safe_name.endswith(".png") else "image/jpeg")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 - required by the standard library
        parsed = urlparse(self.path)
        if parsed.path in LEGACY_PROVIDER_ACTION_PATHS:
            self.legacy_provider_action_unavailable()
            return
        if parsed.path == "/api/runtime-check":
            self.runtime_check()
            return
        if parsed.path == "/api/runtime-providers/qwen/connection-check":
            self.qwen_runtime_connection_check()
            return
        if parsed.path == "/api/ai-career-ingestion-config":
            self.configure_ai_career_ingestion()
            return
        if parsed.path == "/api/local-vision-config":
            self.configure_local_vision()
            return
        if parsed.path == "/api/local-ocr-capability":
            self.local_ocr_capability()
            return
        if parsed.path == "/api/source-link-import":
            self.import_source_link()
            return
        if parsed.path == "/api/text-candidate":
            self.create_text_candidate()
            return
        if parsed.path == "/api/local-ocr":
            self.run_local_ocr()
            return
        if parsed.path == "/api/local-candidate-extract":
            self.extract_local_candidate_source()
            return
        if parsed.path == "/api/local-candidate-image-ocr":
            self.extract_local_candidate_image()
            return
        if parsed.path == "/api/local-candidate-structure":
            self.structure_local_candidate_proposal()
            return
        if parsed.path == "/api/candidate-model-structure":
            self.structure_model_candidate_proposal()
            return
        if parsed.path == "/api/candidate-model-operation-state/delete":
            self.delete_candidate_model_operation_state()
            return
        if parsed.path == "/api/candidate-conversation-turn":
            self.run_candidate_conversation_turn()
            return
        if parsed.path == "/api/candidate-conversation-turn/cancel":
            self.cancel_candidate_conversation_turn()
            return
        if parsed.path == "/api/career-document-extract":
            self.extract_career_document_candidate()
            return
        prefix = "/api/jobs/"
        suffix = "/application-status"
        if parsed.path.startswith(prefix) and parsed.path.endswith(suffix):
            job_id = parsed.path[len(prefix):-len(suffix)]
            self.update_application_status(job_id)
            return
        self.send_json(HTTPStatus.NOT_FOUND, {"error": "route_not_found"})

    def runtime_options(self) -> None:
        """List current runtime choices without sending career material or an inference."""
        descriptors = deepseek_model_descriptors([DEEPSEEK_VISION_MODEL])
        self.send_json(HTTPStatus.OK, {
            "provider": "deepseek", "models": [item.to_public_dict() for item in v1_selector_descriptors(descriptors)], "network_call_made": False,
            "career_data_sent": False,
        })

    def local_ocr_capability(self) -> None:
        """Probe the actual local Swift/Vision execution boundary once per caller batch."""
        state = local_ocr_environment_capability()
        self.send_json(HTTPStatus.OK, {
            "local_ocr": state,
            "network_call_made": False,
            "processing_boundary": "localhost_apple_vision_probe",
        })

    def legacy_provider_action_unavailable(self) -> None:
        """Fail closed until legacy Provider actions consume Current Runtime authority."""
        self.send_json(HTTPStatus.CONFLICT, {
            "error": "legacy_provider_action_disabled_pending_runtime_adapter",
            "failure_layer": "capability",
            "network_call_made": False,
        })

    def runtime_check(self) -> None:
        """Validate one selected DeepSeek model using a minimal, data-free ping."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 4_000:
                raise ValueError
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            model = str(body["model"]).strip()
            if not model or len(model) > 200:
                raise ValueError
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_runtime_model", "failure_layer": "ui", "network_call_made": False})
            return
        result = deepseek_runtime_connection_check(model)
        if not result["ok"]:
            self.send_json(result["status"], {key: value for key, value in result.items() if key not in {"ok", "status"}})
            return
        self.send_json(HTTPStatus.OK, {key: value for key, value in result.items() if key not in {"ok", "status"}})

    def structure_model_candidate_proposal(self) -> None:
        """Execute the one qualified Candidate PDF adapter after explicit consent."""
        claimed_operation_id = None
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 12_000_000:
                raise CandidateModelRuntimeError("candidate_model_request_size_invalid", "request")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            validated_request = validate_candidate_model_request(payload)
            claim_state, cached_result = CANDIDATE_MODEL_EXECUTIONS.begin(validated_request.operation_id, validated_request.source_document["source_document_id"])
            if claim_state == "COMPLETED":
                self.send_json(HTTPStatus.OK, cached_result)
                return
            if claim_state == "ACTIVE":
                self.send_json(HTTPStatus.CONFLICT, {
                    "error": "candidate_model_execution_in_progress",
                    "failure_layer": "idempotency",
                    "network_call_made": False,
                    "persistence": "not_written",
                })
                return
            claimed_operation_id = validated_request.operation_id

            def provider_call(api_key: str, provider_payload: dict) -> tuple[int, dict]:
                try:
                    return call_deepseek_chat_completions(api_key, provider_payload, response_limit=8_000_000)
                except ValueError as error:
                    code = "deepseek_response_too_large" if str(error) == "provider_response_too_large" else "deepseek_response_malformed"
                    raise CandidateModelRuntimeError(code, "parsing", True) from error

            result = execute_candidate_model_request(
                payload,
                read_deepseek_key,
                render_complete_pdf_pages,
                provider_call,
            )
        except CandidateModelRuntimeError as error:
            if claimed_operation_id:
                CANDIDATE_MODEL_EXECUTIONS.fail(claimed_operation_id)
            status = HTTPStatus.PRECONDITION_REQUIRED if error.failure_layer == "credential" else HTTPStatus.BAD_GATEWAY if error.failure_layer in {"provider", "transport"} else HTTPStatus.UNPROCESSABLE_ENTITY
            diagnostic = {"error": error.code, "failure_layer": error.failure_layer, "network_call_made": error.network_call_made, "diagnostics": error.diagnostics}
            print(f"candidate_model_failure_diagnostic {json.dumps(diagnostic, ensure_ascii=False, sort_keys=True)}", flush=True)
            self.send_json(status, {
                "error": error.code,
                "failure_layer": error.failure_layer,
                "network_call_made": error.network_call_made,
                "diagnostics": error.diagnostics,
                "persistence": "not_written",
            })
            return
        except HTTPError as error:
            if claimed_operation_id:
                CANDIDATE_MODEL_EXECUTIONS.fail(claimed_operation_id)
            layer = "credential" if error.code in {401, 403} else "model" if error.code == 404 else "provider"
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": "deepseek_provider_http_error",
                "failure_layer": layer,
                "provider_http_status": error.code,
                "network_call_made": True,
                "persistence": "not_written",
            })
            return
        except (URLError, TimeoutError, OSError):
            if claimed_operation_id:
                CANDIDATE_MODEL_EXECUTIONS.fail(claimed_operation_id)
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": "deepseek_network_error",
                "failure_layer": "transport",
                "network_call_made": True,
                "persistence": "not_written",
            })
            return
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
            if claimed_operation_id:
                CANDIDATE_MODEL_EXECUTIONS.fail(claimed_operation_id)
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": "candidate_model_request_invalid",
                "failure_layer": "request",
                "network_call_made": False,
                "persistence": "not_written",
            })
            return
        if not CANDIDATE_MODEL_EXECUTIONS.succeed(claimed_operation_id, result):
            self.send_json(HTTPStatus.CONFLICT, {
                "error": "candidate_model_processing_run_stale",
                "failure_layer": "idempotency",
                "network_call_made": True,
                "persistence": "not_written",
            })
            return
        self.send_json(HTTPStatus.OK, result)

    def run_candidate_conversation_turn(self) -> None:
        """Run one qualified Candidate turn without UI or persistence semantics."""
        execution_id = None
        generation = None
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 2_000_000:
                raise CandidateConversationRuntimeError("REQUEST_SIZE_INVALID", "request")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            validated = validate_candidate_conversation_request(payload)
            execution_id, generation = validated.execution_id, validated.generation
            if not CANDIDATE_CONVERSATION_EXECUTIONS.begin(execution_id, generation):
                self.send_json(HTTPStatus.CONFLICT, {
                    "error": "TURN_ALREADY_ACTIVE", "failure_layer": "generation",
                    "network_call_made": False, "persistence": "not_written",
                })
                return

            def provider_call(api_key: str, provider_payload: dict) -> tuple[int, dict]:
                try:
                    return call_deepseek_chat_completions(api_key, provider_payload, response_limit=2_000_000)
                except ValueError as error:
                    raise CandidateConversationRuntimeError("MALFORMED_RESPONSE", "parsing", True) from error

            result = execute_candidate_conversation_request(payload, read_deepseek_key, provider_call)
            if not CANDIDATE_CONVERSATION_EXECUTIONS.accept(execution_id, generation):
                self.send_json(HTTPStatus.CONFLICT, {
                    "error": "CANCELLED_TURN", "failure_layer": "generation",
                    "network_call_made": True, "persistence": "not_written",
                    "provider_request_may_have_completed": True,
                })
                return
        except CandidateConversationRuntimeError as error:
            if execution_id and generation:
                CANDIDATE_CONVERSATION_EXECUTIONS.fail(execution_id, generation)
            status = HTTPStatus.PRECONDITION_REQUIRED if error.failure_layer == "credential" else HTTPStatus.BAD_GATEWAY if error.failure_layer in {"provider", "transport"} else HTTPStatus.UNPROCESSABLE_ENTITY
            self.send_json(status, {
                "error": error.code, "failure_layer": error.failure_layer,
                "network_call_made": error.network_call_made, "diagnostics": error.diagnostics,
                "persistence": "not_written",
            })
            return
        except HTTPError as error:
            if execution_id and generation:
                CANDIDATE_CONVERSATION_EXECUTIONS.fail(execution_id, generation)
            layer = "credential" if error.code in {401, 403} else "model" if error.code == 404 else "provider"
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": "PROVIDER_HTTP_ERROR", "failure_layer": layer,
                "provider_http_status": error.code, "network_call_made": True,
                "persistence": "not_written",
            })
            return
        except (URLError, TimeoutError, OSError):
            if execution_id and generation:
                CANDIDATE_CONVERSATION_EXECUTIONS.fail(execution_id, generation)
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": "PROVIDER_TRANSPORT_ERROR", "failure_layer": "transport",
                "network_call_made": True, "persistence": "not_written",
            })
            return
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
            if execution_id and generation:
                CANDIDATE_CONVERSATION_EXECUTIONS.fail(execution_id, generation)
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": "REQUEST_INVALID", "failure_layer": "request",
                "network_call_made": False, "persistence": "not_written",
            })
            return
        self.send_json(HTTPStatus.OK, result)

    def cancel_candidate_conversation_turn(self) -> None:
        """Invalidate one generation; this does not promise Provider-side abort."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 2_000:
                raise ValueError
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if set(payload) != {"execution_id", "generation"}:
                raise ValueError
            execution_id = str(payload["execution_id"]).strip()
            generation = str(payload["generation"]).strip()
            if not execution_id or not generation:
                raise ValueError
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "TURN_CANCEL_REQUEST_INVALID", "network_call_made": False})
            return
        invalidated = CANDIDATE_CONVERSATION_EXECUTIONS.cancel(execution_id, generation)
        self.send_json(HTTPStatus.OK, {
            "execution_id": execution_id, "generation": generation,
            "state": "CANCELLED" if invalidated else "NOT_ACTIVE",
            "working_mutation": "NONE", "provider_abort_guaranteed": False,
            "persistence": "not_written", "network_call_made": False,
        })

    def delete_candidate_model_operation_state(self) -> None:
        """Forget consent-scoped server idempotency state during source hard delete."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 1_000:
                raise ValueError
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            source_id = str(body["source_document_id"]).strip()
            if not source_id.startswith("source-candidate-") or len(source_id) > 180:
                raise ValueError
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "candidate_model_source_invalid", "network_call_made": False})
            return
        cleared = CANDIDATE_MODEL_EXECUTIONS.forget_source(source_id)
        self.send_json(HTTPStatus.OK, {"source_document_id": source_id, "operation_states_cleared": cleared, "network_call_made": False})

    def qwen_runtime_connection_check(self) -> None:
        """Forward one approved Qwen synthetic image check from the local process only."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 5_000:
                raise ValueError
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            api_key = str(body["api_key"]).strip()
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_qwen_connection_request", "network_call_made": False})
            return
        result = qwen_runtime_connection_check(api_key)
        self.send_json(result["status"], {key: value for key, value in result.items() if key not in {"ok", "status"}})

    def configure_ai_career_ingestion(self) -> None:
        """Store an explicitly entered Gemini key in macOS Keychain, never project data."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 20_000:
                raise ValueError
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            provider = str(body["provider_id"]).strip()
            api_key = str(body["api_key"]).strip()
            if len(api_key) < 20:
                raise ValueError
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_provider_api_key", "network_call_made": False})
            return
        if provider != "gemini":
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "provider_credential_not_configurable_here", "network_call_made": False})
            return
        try:
            store_gemini_key(api_key)
        except (subprocess.SubprocessError, OSError):
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": "keychain_write_failed", "network_call_made": False})
            return
        self.send_json(HTTPStatus.OK, {
            "provider": "gemini", "key_configured": True,
            "storage": "macos_keychain", "network_call_made": False,
        })

    def preflight_deepseek_text(self) -> None:
        """User-authorized small real text call; no career document is transmitted."""
        api_key = read_deepseek_key()
        if not api_key:
            self.send_json(HTTPStatus.PRECONDITION_REQUIRED, {"error": "deepseek_key_not_configured", "network_call_made": False})
            return
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            with urlopen(Request(DEEPSEEK_MODELS_ENDPOINT, headers=headers), timeout=30) as response:  # noqa: S310
                listing = json.loads(response.read(1_000_000).decode("utf-8"))
            models = [str(item.get("id")) for item in listing.get("data") or [] if isinstance(item, dict) and item.get("id")]
            preferred = next((item for item in models if item in {"deepseek-chat", "deepseek-v4-flash"}), models[0] if models else None)
            if not preferred:
                raise ValueError("deepseek_model_listing_empty")
            payload = {"model": preferred, "messages": [{"role": "user", "content": "请只回复：预检成功"}], "max_tokens": 60, "temperature": 0}
            with urlopen(Request(DEEPSEEK_ENDPOINT, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST"), timeout=60) as response:  # noqa: S310
                result = json.loads(response.read(1_000_000).decode("utf-8"))
            text = str((((result.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
            if not text:
                raise ValueError("deepseek_text_response_empty")
        except HTTPError as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "deepseek_provider_http_error", "provider_http_status": error.code, "network_call_made": True})
            return
        except (URLError, TimeoutError, OSError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": str(error) or "deepseek_preflight_failed", "network_call_made": True})
            return
        self.send_json(HTTPStatus.OK, {"provider": "deepseek", "model": preferred, "provider_status": "available", "text_capability": "supported", "direct_pdf_capability": "unsupported", "response_text": text[:500], "network_call_made": True})

    def preflight_deepseek_document(self) -> None:
        """Confirm an account-visible vision model; no career material is sent."""
        api_key = read_deepseek_key()
        if not api_key:
            self.send_json(HTTPStatus.PRECONDITION_REQUIRED, {"error": "deepseek_key_not_configured", "network_call_made": False})
            return
        try:
            with urlopen(Request(DEEPSEEK_MODELS_ENDPOINT, headers={"Authorization": f"Bearer {api_key}"}), timeout=30) as response:  # noqa: S310
                listing = json.loads(response.read(1_000_000).decode("utf-8"))
            model = select_deepseek_document_model([str(item.get("id")) for item in listing.get("data") or [] if isinstance(item, dict) and item.get("id")])
            if not model:
                raise ValueError("deepseek_vision_model_not_available")
        except HTTPError as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "deepseek_provider_http_error", "provider_http_status": error.code, "network_call_made": True})
            return
        except (URLError, TimeoutError, OSError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": str(error) or "deepseek_document_preflight_failed", "network_call_made": True})
            return
        self.send_json(HTTPStatus.OK, {"provider": "deepseek", "model": model, "provider_status": "ready", "document_delivery": "rendered_pdf_pages", "network_call_made": True})

    def preflight_gemini_document(self) -> None:
        """List account-visible models only; no career material is sent."""
        api_key = read_gemini_key()
        if not api_key:
            self.send_json(HTTPStatus.PRECONDITION_REQUIRED, {"error": "gemini_key_not_configured", "network_call_made": False})
            return
        try:
            with urlopen(Request(GEMINI_MODELS_ENDPOINT, headers={"x-goog-api-key": api_key}), timeout=30) as response:  # noqa: S310
                listing = json.loads(response.read(2_000_000).decode("utf-8"))
            model = select_gemini_document_model(listing)
            if not model:
                raise ValueError("no_account_visible_gemini_document_model")
        except HTTPError as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "gemini_provider_http_error", "provider_http_status": error.code, "network_call_made": True})
            return
        except (URLError, TimeoutError, OSError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": str(error) or "gemini_preflight_failed", "network_call_made": True})
            return
        self.send_json(HTTPStatus.OK, {"provider": "gemini", "model": model, "provider_status": "ready", "direct_pdf_capability": "supported", "free_or_paid_status": "account_tier_to_be_confirmed_before_send", "privacy_notice_required": True, "network_call_made": True})

    def run_ai_career_ingestion(self) -> None:
        """Send one complete preserved career PDF through its provider delivery adapter."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 72_000_000:
                raise AICareerIngestionError("invalid_ai_career_request_size")
            request_payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if request_payload.get("prompt_version", AI_CAREER_PROMPT_VERSION) != AI_CAREER_PROMPT_VERSION:
                raise AICareerIngestionError("invalid_prompt_version")
            original = decode_original_document(request_payload)
            provider = str(request_payload.get("provider") or "").strip()
            model = str(request_payload.get("model") or AI_CAREER_DEFAULT_MODEL).strip()
            if provider == "gemini":
                provider_payload = build_gemini_payload(original, model)
                api_key = read_gemini_key()
                endpoint = GEMINI_INTERACTIONS_ENDPOINT
                headers = {"x-goog-api-key": api_key or "", "Content-Type": "application/json"}
                delivery = "original_pdf"
            elif provider == "deepseek":
                rendered_pages = render_complete_pdf_pages(original.content)
                provider_payload = build_deepseek_payload(original, model, rendered_pages)
                api_key = read_deepseek_key()
                endpoint = DEEPSEEK_ENDPOINT
                headers = {"Authorization": f"Bearer {api_key}" if api_key else "", "Content-Type": "application/json"}
                delivery = "rendered_pdf_pages"
            else:
                raise AICareerIngestionError("provider_not_enabled_for_complete_document_review")
        except (AICareerIngestionError, KeyError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": str(error), "network_call_made": False, "persistence": "not_written",
            })
            return
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": "invalid_ai_career_request", "network_call_made": False, "persistence": "not_written",
            })
            return

        api_key = headers.get("x-goog-api-key") or (headers.get("Authorization") or "").removeprefix("Bearer ")
        if not api_key:
            self.send_json(HTTPStatus.PRECONDITION_REQUIRED, {
                "error": f"{provider}_key_not_configured",
                "required": f"{provider.upper()}_API_KEY or macOS Keychain credential entered in AI Mode",
                "provider": provider, "model": model,
                "source_hash": original.source_hash,
                "source_document_id": original.source_document_id,
                "network_call_made": False, "persistence": "not_written",
            })
            return

        request = Request(
            endpoint,
            data=json.dumps(provider_payload, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=240) as response:  # noqa: S310 - fixed official provider endpoint
                provider_http_status = response.status
                response_body = response.read(8_000_001)
                if len(response_body) > 8_000_000:
                    raise AICareerIngestionError("provider_response_too_large")
        except HTTPError as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": f"{provider}_provider_http_error", "provider_http_status": error.code,
                "network_call_made": True, "persistence": "not_written",
            })
            return
        except (URLError, TimeoutError, OSError):
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": f"{provider}_network_error", "network_call_made": True, "persistence": "not_written",
            })
            return
        except AICareerIngestionError as error:
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": str(error), "network_call_made": True, "persistence": "not_written",
            })
            return

        try:
            provider_response = json.loads(response_body.decode("utf-8"))
            canonical_markdown = extract_gemini_markdown(provider_response) if provider == "gemini" else extract_deepseek_markdown(provider_response)
        except (AICareerIngestionError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": f"{provider}_response_not_usable", "network_call_made": True, "persistence": "not_written",
            })
            return
        validation_errors = validate_canonical_markdown(canonical_markdown, original.document_type)
        if validation_errors:
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": "canonical_markdown_contract_failed", "validation_errors": validation_errors,
                "network_call_made": True, "persistence": "not_written",
            })
            return
        metadata = ai_response_metadata(provider_response)
        self.send_json(HTTPStatus.OK, {
            "contract_id": "job-radar-canonical-career-context-v1",
            "canonical_markdown": canonical_markdown,
            "source_hash": original.source_hash,
            "source_document_id": original.source_document_id,
            "provider": provider, "model": model,
            "prompt_version": AI_CAREER_PROMPT_VERSION,
            "generated_at": ai_utc_timestamp(),
            "provider_http_status": provider_http_status,
            "processing_boundary": f"user_triggered_complete_pdf_to_{provider}_{delivery}",
            "network_call_made": True,
            "persistence": "browser_review_required",
            **metadata,
        })

    def extract_career_document_candidate(self) -> None:
        """Extract one bounded career file locally and return review-only Career Entities."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 12_000_000:
                raise CareerDocumentError("invalid_document_request_size")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise CareerDocumentError("invalid_document_request")
            result = extract_career_document(payload, PDF_TEXT_SCRIPT_PATH, PDF_VISUAL_OCR_SCRIPT_PATH)
        except (CareerDocumentError, KeyError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": str(error) or "career_document_extraction_failed",
                "persistence": "not_written",
                "model_call_made": False,
            })
            return
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": "invalid_document_request",
                "persistence": "not_written",
                "model_call_made": False,
            })
            return
        self.send_json(HTTPStatus.OK, result)

    def extract_local_candidate_source(self) -> None:
        """Slice 4A mechanical document extraction; never creates a Candidate Proposal."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 12_000_000:
                raise CareerDocumentError("invalid_document_request_size")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise CareerDocumentError("invalid_document_request")
            snapshot = local_snapshot_from_payload(payload)
            visual_ocr_script_path = PDF_VISUAL_OCR_SCRIPT_PATH if snapshot["capabilities"]["local_ocr"] == "supported" else None
            result = extract_career_document_only(payload, PDF_TEXT_SCRIPT_PATH, visual_ocr_script_path)
            result["runtime_snapshot_id"] = snapshot["snapshot_id"]
        except (CareerDocumentError, KeyError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": str(error) or "candidate_local_extraction_failed",
                "persistence": "not_written",
                "model_call_made": False,
            })
            return
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": "invalid_document_request",
                "persistence": "not_written",
                "model_call_made": False,
            })
            return
        self.send_json(HTTPStatus.OK, result)

    def extract_local_candidate_image(self) -> None:
        """Use only the pure local Apple Vision OCR core for one Candidate image."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 12_000_000:
                raise CareerDocumentError("invalid_document_request_size")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise CareerDocumentError("invalid_document_request")
            snapshot = local_snapshot_from_payload(payload)
            if snapshot["capabilities"]["local_ocr"] != "supported":
                raise CareerDocumentError("local_ocr_unavailable")
            filename = payload.get("filename")
            source_id = payload.get("source_document_id")
            if not isinstance(filename, str) or not filename.strip() or Path(filename).name != filename:
                raise CareerDocumentError("invalid_document_filename")
            if not isinstance(source_id, str) or not source_id.startswith("source-candidate-") or len(source_id) > 160:
                raise CareerDocumentError("invalid_candidate_source_document_id")
            decoded = decode_image_data_urls(payload)
            if len(decoded) != 1:
                raise CareerDocumentError("candidate_image_count_invalid")
            mime_type, image_bytes = decoded[0]
            extension = Path(filename).suffix.lower()
            if (mime_type == "image/png" and extension != ".png") or (mime_type == "image/jpeg" and extension not in {".jpg", ".jpeg"}):
                raise CareerDocumentError("document_extension_mismatch")
            with tempfile.TemporaryDirectory(prefix="ariadne-candidate-ocr-") as directory:
                image_path = Path(directory) / ("source.png" if mime_type == "image/png" else "source.jpg")
                image_path.write_bytes(image_bytes)
                ocr = run_apple_vision_ocr(image_path)
            lines = [line.strip() for line in ocr["text"].splitlines() if line.strip()]
            content_hash = hashlib.sha256(image_bytes).hexdigest()
            pages = [{"page": 1, "lines": lines, "source_method": "apple_vision"}]
            result = {
                "filename": filename.strip(),
                "media_type": mime_type,
                "content_hash": "sha256:" + content_hash,
                "byte_size": len(image_bytes),
                "pages": pages,
                "document_blocks": _document_blocks(pages, source_id, content_hash),
                "extracted_text": "\n".join(lines),
                "extraction_method": "apple_vision_image_v1",
                "warnings": [],
                "model_call_made": False,
                "processing_boundary": "localhost_transient_candidate_image_ocr",
                "runtime_snapshot_id": snapshot["snapshot_id"],
            }
        except (CareerDocumentError, KeyError, ValueError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": str(error) or "candidate_local_image_ocr_failed",
                "persistence": "not_written",
                "model_call_made": False,
            })
            return
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {
                "error": "invalid_document_request",
                "persistence": "not_written",
                "model_call_made": False,
            })
            return
        self.send_json(HTTPStatus.OK, result)

    def structure_local_candidate_proposal(self) -> None:
        """Run existing deterministic CareerEntity rules over an ExtractionArtifact payload only."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 4_000_000:
                raise CareerDocumentError("invalid_candidate_structure_request")
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise CareerDocumentError("invalid_candidate_structure_request")
            snapshot = local_snapshot_from_payload(payload)
            source_id = payload.get("source_document_id")
            material_type = payload.get("candidate_material_type")
            pages = payload.get("pages")
            if not isinstance(source_id, str) or not source_id.startswith("source-candidate-"):
                raise CareerDocumentError("invalid_candidate_source_document_id")
            if material_type not in {"resume", "portfolio", "project_description", "other"}:
                raise CareerDocumentError("invalid_candidate_material_type")
            if not isinstance(pages, list) or len(pages) > 500:
                raise CareerDocumentError("invalid_candidate_structure_pages")
            entities, warnings, status = propose_entities(pages, source_id, material_type)
            self.send_json(HTTPStatus.OK, {
                "entities": entities,
                "warnings": warnings,
                "status": status,
                "runtime_snapshot_id": snapshot["snapshot_id"],
                "model_call_made": False,
                "processing_boundary": "localhost_deterministic_candidate_structuring",
            })
        except (CareerDocumentError, KeyError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error) or "candidate_local_structuring_failed", "model_call_made": False})
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_candidate_structure_request", "model_call_made": False})

    def run_local_ocr(self) -> None:
        """Run macOS Vision OCR locally; never forwards the image to the internet."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 18_000_000:
                raise ValueError
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            decoded_images = decode_image_data_urls(payload)
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_local_ocr_image"})
            return

        evidence_images = save_local_evidence(decoded_images)
        ocr_pages: list[dict] = []
        for image in evidence_images:
            image_index = image["image_index"]
            image_path = PROJECT_ROOT / image["evidence_path"]
            try:
                ocr = run_apple_vision_ocr(image_path)
            except CareerDocumentError:
                self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": "local_ocr_failed", "image_index": image_index})
                return
            ocr_pages.append({
                "image_index": image_index,
                "text": ocr.get("text", ""),
                "line_count": ocr.get("line_count", 0),
                "evidence_path": image["evidence_path"],
            })
        combined_text = "\n\n".join(
            f"【截图 {page['image_index']}】\n{page['text']}" for page in ocr_pages
        )
        self.send_json(HTTPStatus.OK, {
            "text": combined_text,
            "line_count": sum(page["line_count"] for page in ocr_pages),
            "images": ocr_pages,
            "extraction": extract_ocr_candidates_from_pages([page["text"] for page in ocr_pages]),
            "processing_boundary": "localhost_macos_vision",
        })

    def configure_local_vision(self) -> None:
        """Store a user-entered credential in macOS Keychain, never IndexedDB or a project file."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 20_000:
                raise ValueError
            api_key = json.loads(self.rfile.read(content_length).decode("utf-8"))["api_key"].strip()
            if len(api_key) < 12:
                raise ValueError
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_api_key"})
            return
        try:
            store_deepseek_key(api_key)
        except (subprocess.SubprocessError, OSError):
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": "keychain_write_failed"})
            return
        self.send_json(HTTPStatus.OK, {
            "key_configured": True, "storage": "macos_keychain", "network_call_made": False,
        })

    def source_link_status(self, url: str) -> None:
        """Classify locally. Only a future explicit import click can read a supported source."""
        if tencent_link_details(url):
            self.send_json(HTTPStatus.OK, {"status": "supported", "source": "Tencent Careers", "can_import": True})
            return
        parsed = urlparse(url.strip())
        if parsed.hostname and parsed.hostname.endswith("zhipin.com"):
            message = "当前 BOSS 链接无允许的直接读取路径；请截图或粘贴 JD 原文。"
        elif parsed.hostname and parsed.hostname.endswith("linkedin.com") and "/jobs/search" in parsed.path:
            message = "这是 LinkedIn 搜索页，不是一条稳定 JD；请使用岗位详情链接或截图。"
        elif parsed.hostname and parsed.hostname.endswith("linkedin.com"):
            message = "LinkedIn 详情链接尚未有允许的 source contract；请截图或粘贴 JD 原文。"
        else:
            message = "此来源尚未支持直接读取；请截图或粘贴 JD 原文。"
        self.send_json(HTTPStatus.OK, {"status": "fallback_required", "can_import": False, "message": message})

    def import_source_link(self) -> None:
        """One explicit user-click import for the allowed Tencent Careers API only."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 20_000:
                raise ValueError
            source_url = json.loads(self.rfile.read(content_length).decode("utf-8"))["source_url"]
            details = tencent_link_details(source_url)
            if not details:
                raise ValueError
            post_id, canonical_url = details
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "source_link_not_supported", "network_call_made": False})
            return
        api_url = "https://careers.tencent.com/tencentcareer/api/post/ByPostId?" + urlencode({"postId": post_id, "language": "zh-cn"})
        request = Request(api_url, headers={
            "Accept": "application/json", "Referer": canonical_url,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
        })
        try:
            with build_opener(RejectRedirects()).open(request, timeout=20) as response:
                body = response.read(2 * 1024 * 1024 + 1)
                status = response.status
        except HTTPError as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "source_http_error", "http_status": error.code, "network_call_made": True})
            return
        except (URLError, TimeoutError, OSError):
            self.send_json(HTTPStatus.BAD_GATEWAY, {"error": "source_network_error", "network_call_made": True})
            return
        if len(body) > 2 * 1024 * 1024:
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": "source_response_too_large", "network_call_made": True})
            return
        try:
            response_json = json.loads(body.decode("utf-8"))
            data = response_json["Data"]
            if response_json.get("Code") != 200 or not isinstance(data, dict) or str(data.get("PostId")) != post_id:
                raise ValueError
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": "source_response_not_verified_job", "network_call_made": True})
            return
        RAW_CAPTURE_PATH.mkdir(parents=True, exist_ok=True)
        timestamp = utc_timestamp().replace(":", "")
        raw_path = RAW_CAPTURE_PATH / f"tencent-careers-{post_id}-local-link-{timestamp}.json"
        raw_path.write_bytes(body)
        self.send_json(HTTPStatus.OK, {
            "source_name": "Tencent Careers", "source_url": canonical_url, "external_job_id": post_id,
            "raw_capture_path": str(raw_path.relative_to(PROJECT_ROOT)),
            "raw_capture_sha256": hashlib.sha256(body).hexdigest(), "http_status": status,
            "raw_text": json.dumps(data, ensure_ascii=False, indent=2),
            "extraction": tencent_extraction(data, post_id),
            "network_call_made": True, "persistence": "needs_review_only",
        })

    def create_text_candidate(self) -> None:
        """Keep pasted JD text local, then create the same review-only candidate shape."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 120_000:
                raise ValueError
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            raw_text = payload["raw_text"].strip()
            if not raw_text:
                raise ValueError
            source_url = payload.get("source_url") or None
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_pasted_jd"})
            return
        self.send_json(HTTPStatus.OK, {
            "raw_text": raw_text, "source_url": source_url,
            "extraction": extract_ocr_candidates(raw_text), "processing_boundary": "localhost_text_rules",
        })

    def run_vision_extraction(self) -> None:
        """Make exactly one user-triggered vision call; failed calls never create a job."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 18_000_000:
                raise ValueError
            request_payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            prompt_version = request_payload.get("prompt_version", VISION_PROMPT_VERSION)
            if prompt_version not in {VISION_PROMPT_VERSION, VISION_PROMPT_VERSION_COMPACT}:
                raise ValueError("invalid_prompt_version")
            decoded_images = decode_image_data_urls(request_payload)
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_vision_images", "network_call_made": False})
            return
        api_key = read_deepseek_key()
        if not api_key:
            self.send_json(HTTPStatus.PRECONDITION_REQUIRED, {
                "error": "deepseek_key_not_configured", "network_call_made": False,
            })
            return
        evidence_images = save_local_evidence(decoded_images)
        image_content = [{"type": "text", "text": "Extract the job candidate from these screenshots."}]
        for image in evidence_images:
            encoded = base64.b64encode(image["image_bytes"]).decode("ascii")
            image_content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{image['mime_type']};base64,{encoded}"},
            })
        payload = {
            "model": DEEPSEEK_VISION_MODEL,
            "messages": [
                {"role": "system", "content": vision_instruction(prompt_version)},
                {"role": "user", "content": image_content},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0,
        }
        try:
            request = Request(
                DEEPSEEK_ENDPOINT,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(request, timeout=60) as response:  # noqa: S310 - fixed provider endpoint
                http_status = response.status
                provider_response = response.read().decode("utf-8")
        except HTTPError as error:
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": "deepseek_provider_http_error", "provider_http_status": error.code,
                "network_call_made": True, "persistence": "not_written",
            })
            return
        except (URLError, OSError):
            self.send_json(HTTPStatus.BAD_GATEWAY, {
                "error": "deepseek_network_error", "network_call_made": True, "persistence": "not_written",
            })
            return
        try:
            provider_json = json.loads(provider_response)
            raw_output = provider_json["choices"][0]["message"]["content"]
            usage = provider_json.get("usage", {})
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": "deepseek_response_missing_content", "network_call_made": True, "persistence": "not_written",
            })
            return
        structured_output, validation_error = validate_vision_output(raw_output, len(evidence_images))
        if validation_error:
            self.send_json(HTTPStatus.UNPROCESSABLE_ENTITY, {
                "error": validation_error, "network_call_made": True, "persistence": "not_written",
            })
            return
        self.send_json(HTTPStatus.OK, {
            "extraction": vision_result_as_extraction(structured_output),
            "raw_provider_response": raw_output,
            "usage": usage,
            "images": [{key: image[key] for key in ("image_index", "evidence_path")} for image in evidence_images],
            "provider": "deepseek", "model": DEEPSEEK_VISION_MODEL,
            "prompt_version": prompt_version,
            "processing_boundary": "user_triggered_localhost_to_deepseek",
            "network_call_made": True, "persistence": "needs_review_only",
        })

    def list_jobs(self, query: dict[str, list[str]]) -> None:
        search = query.get("q", [""])[0].strip()
        sql = """
            SELECT job_id, company, title, location, seniority, source_url,
                   captured_date, published_date, posting_status, application_status
            FROM jobs
        """
        parameters: tuple[str, ...] = ()
        if search:
            sql += " WHERE company LIKE ? OR title LIKE ? OR location LIKE ?"
            parameters = (f"%{search}%",) * 3
        sql += " ORDER BY job_id"

        with connect() as connection:
            rows = [dict(row) for row in connection.execute(sql, parameters)]
        self.send_json(HTTPStatus.OK, {"jobs": rows, "count": len(rows)})

    def get_job(self, job_id: str) -> None:
        with connect() as connection:
            row = connection.execute(
                "SELECT * FROM jobs WHERE job_id = ?", (job_id,)
            ).fetchone()
        if row is None:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "job_not_found", "job_id": job_id})
            return
        self.send_json(HTTPStatus.OK, {"job": job_payload(row)})

    def update_application_status(self, job_id: str) -> None:
        """Validate a user-owned status, save it, then return the updated record."""
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
            return

        application_status = payload.get("application_status")
        if application_status not in APPLICATION_STATUSES:
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"error": "invalid_application_status", "allowed": sorted(APPLICATION_STATUSES)},
            )
            return

        with connect() as connection:
            cursor = connection.execute(
                "UPDATE jobs SET application_status = ? WHERE job_id = ?",
                (application_status, job_id),
            )
            if cursor.rowcount == 0:
                self.send_json(HTTPStatus.NOT_FOUND, {"error": "job_not_found", "job_id": job_id})
                return
            row = connection.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        self.send_json(HTTPStatus.OK, {"job": job_payload(row)})

    def send_json(self, status: HTTPStatus, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    initialize_database()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), JobRadarHandler)
    print("AI Job Radar running at http://127.0.0.1:8000")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
