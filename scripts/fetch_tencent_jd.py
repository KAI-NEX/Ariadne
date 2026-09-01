"""One manual, bounded HTTP read for the currently allowed Tencent Careers JD.

This script captures evidence only. It does not normalize a job, write to SQLite,
or update the browser UI.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from _runtime import PROJECT_ROOT

RAW_DIRECTORY = PROJECT_ROOT / "data" / "raw"
ALLOWED_URL = "https://careers.tencent.com/jobdesc.html?postId=2055186895503273984"
ALLOWED_ASSET_URL = (
    "https://cdn.multilingualres.hr.tencent.com/tencentcareer/static/js/p_zh-cn_jobdesc.build.js"
)
ALLOWED_API_URL = (
    "https://careers.tencent.com/tencentcareer/api/post/ByPostId?"
    "postId=2055186895503273984&language=zh-cn"
)
ALLOWED_HOST = "careers.tencent.com"
ALLOWED_ASSET_HOST = "cdn.multilingualres.hr.tencent.com"
EXPECTED_EXTERNAL_JOB_ID = "2055186895503273984"
TIMEOUT_SECONDS = 15
MAX_CAPTURE_BYTES = 2 * 1024 * 1024


class RejectRedirects(HTTPRedirectHandler):
    """Keep one-source scope explicit rather than silently following redirects."""

    def redirect_request(self, request, fp, code, msg, headers, new_url):  # type: ignore[no-untyped-def]
        return None


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def write_metadata(timestamp: str, payload: dict) -> Path:
    RAW_DIRECTORY.mkdir(parents=True, exist_ok=True)
    filename = f"tencent-careers-{EXPECTED_EXTERNAL_JOB_ID}-{timestamp.replace(':', '')}.json"
    path = RAW_DIRECTORY / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def allowed_page_url(url: str) -> bool:
    parsed = urlparse(url)
    return (
        parsed.scheme == "https"
        and parsed.hostname == ALLOWED_HOST
        and parsed.path == "/jobdesc.html"
        and parse_qs(parsed.query).get("postId") == [EXPECTED_EXTERNAL_JOB_ID]
    )


def request_kind(url: str) -> str | None:
    if allowed_page_url(url):
        return "job_page"
    if url == ALLOWED_ASSET_URL:
        return "page_script"
    if url == ALLOWED_API_URL:
        return "job_api"
    return None


def main() -> int:
    source_url = sys.argv[1] if len(sys.argv) == 2 else ALLOWED_URL
    timestamp = utc_now()
    kind = request_kind(source_url)
    if kind is None:
        path = write_metadata(timestamp, {
            "outcome": "failed",
            "failure": "source_url_not_allowed",
            "requested_url": source_url,
            "allowed_urls": [ALLOWED_URL, ALLOWED_ASSET_URL, ALLOWED_API_URL],
            "attempted_at": timestamp,
        })
        print(f"FAILED source_url_not_allowed; record: {path.relative_to(PROJECT_ROOT)}")
        return 2

    headers = {"Accept": "text/html,application/xhtml+xml"}
    if kind in {"page_script", "job_api"}:
        headers.update({
            "Referer": ALLOWED_URL,
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
            ),
        })
    request = Request(source_url, headers=headers)
    opener = build_opener(RejectRedirects())
    try:
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            status = response.status
            content_type = response.headers.get_content_type()
            body = response.read(MAX_CAPTURE_BYTES + 1)
    except HTTPError as error:
        path = write_metadata(timestamp, {
            "outcome": "failed",
            "failure": "http_error",
            "requested_url": source_url,
            "http_status": error.code,
            "attempted_at": timestamp,
        })
        print(f"FAILED http_error ({error.code}); record: {path.relative_to(PROJECT_ROOT)}")
        return 1
    except (TimeoutError, URLError) as error:
        path = write_metadata(timestamp, {
            "outcome": "failed",
            "failure": "network_error",
            "requested_url": source_url,
            "error_type": type(error).__name__,
            "attempted_at": timestamp,
        })
        print(f"FAILED network_error ({type(error).__name__}); record: {path.relative_to(PROJECT_ROOT)}")
        return 1

    if len(body) > MAX_CAPTURE_BYTES:
        path = write_metadata(timestamp, {
            "outcome": "failed",
            "failure": "response_too_large",
            "requested_url": source_url,
            "http_status": status,
            "captured_limit_bytes": MAX_CAPTURE_BYTES,
            "attempted_at": timestamp,
        })
        print(f"FAILED response_too_large; record: {path.relative_to(PROJECT_ROOT)}")
        return 1

    extension = {"job_page": ".html", "page_script": ".js", "job_api": ".json"}[kind]
    raw_path = RAW_DIRECTORY / (
        f"tencent-careers-{EXPECTED_EXTERNAL_JOB_ID}-{kind}-{timestamp.replace(':', '')}{extension}"
    )
    RAW_DIRECTORY.mkdir(parents=True, exist_ok=True)
    raw_path.write_bytes(body)
    content_hash = hashlib.sha256(body).hexdigest()
    is_candidate_jd = (
        (kind == "job_page" and content_type == "text/html")
        or (kind == "job_api" and content_type == "application/json")
    ) and EXPECTED_EXTERNAL_JOB_ID.encode() in body
    outcome = "success" if is_candidate_jd else "needs_review"
    validity = "candidate_jd" if is_candidate_jd else "not_evaluated_as_jd"
    metadata_path = write_metadata(timestamp, {
        "outcome": outcome,
        "capture_kind": kind,
        "requested_url": source_url,
        "http_status": status,
        "content_type": content_type,
        "attempted_at": timestamp,
        "last_successful_fetch_at": timestamp,
        "external_job_id": EXPECTED_EXTERNAL_JOB_ID,
        "raw_capture_path": str(raw_path.relative_to(PROJECT_ROOT)),
        "raw_capture_bytes": len(body),
        "raw_capture_sha256": content_hash,
        "response_validity": validity,
        "normalization": "not_started",
    })
    print(f"{('SUCCESS' if is_candidate_jd else 'NEEDS_REVIEW')} kind={kind} status={status}; raw: "
          f"{raw_path.relative_to(PROJECT_ROOT)}; record: {metadata_path.relative_to(PROJECT_ROOT)}")
    return 0 if is_candidate_jd else 1


if __name__ == "__main__":
    raise SystemExit(main())
