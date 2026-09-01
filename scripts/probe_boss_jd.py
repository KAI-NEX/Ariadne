"""One manually authorized, no-login feasibility probe for one BOSS JD URL.

It is not a crawler: one invocation makes one GET, sends no cookies, follows no
redirects, and saves only a capped raw response fragment plus a redacted
metadata record. Query/visit parameters are never written to disk.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from _runtime import PROJECT_ROOT

RAW_DIR = PROJECT_ROOT / "data" / "raw"
MAX_BYTES = 512_000


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


def canonical_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.netloc not in {"www.zhipin.com", "zhipin.com"}:
        raise ValueError("only_https_boss_job_url_is_allowed")
    if not parsed.path.startswith("/job_detail/"):
        raise ValueError("only_boss_job_detail_path_is_allowed")
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/probe_boss_jd.py <one-user-authorized-boss-job-url>")
        return 2
    requested_url = sys.argv[1]
    try:
        safe_url = canonical_url(requested_url)
    except ValueError as error:
        print(json.dumps({"outcome": "rejected", "reason": str(error)}, ensure_ascii=False))
        return 1

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H%M%SZ")
    job_slug = safe_url.rstrip("/").split("/")[-1].removesuffix(".html")
    base = RAW_DIR / f"boss-{job_slug}-{stamp}"
    metadata = {
        "source_name": "BOSS直聘",
        "requested_canonical_url": safe_url,
        "request_policy": "single_get_no_login_no_cookie_no_redirect_no_retry",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    opener = build_opener(NoRedirect())
    request = Request(requested_url, headers={"User-Agent": "JobRadarLocalProbe/0.1"})
    try:
        with opener.open(request, timeout=15) as response:
            body = response.read(MAX_BYTES + 1)
            metadata.update({
                "outcome": "response_received",
                "http_status": response.status,
                "content_type": response.headers.get_content_type(),
                "bytes_captured": min(len(body), MAX_BYTES),
                "truncated": len(body) > MAX_BYTES,
            })
    except HTTPError as error:
        body = error.read(MAX_BYTES + 1)
        metadata.update({
            "outcome": "http_failure",
            "http_status": error.code,
            "content_type": error.headers.get_content_type() if error.headers else "unknown",
            "bytes_captured": min(len(body), MAX_BYTES),
            "truncated": len(body) > MAX_BYTES,
        })
    except (URLError, TimeoutError, OSError) as error:
        metadata.update({"outcome": "network_failure", "error_type": type(error).__name__})
        body = b""

    if body:
        body = body[:MAX_BYTES]
        raw_path = base.with_suffix(".bin")
        raw_path.write_bytes(body)
        metadata["raw_capture_path"] = str(raw_path.relative_to(PROJECT_ROOT))
        metadata["raw_capture_sha256"] = hashlib.sha256(body).hexdigest()
    metadata_path = base.with_suffix(".json")
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, ensure_ascii=False, indent=2))
    return 0 if metadata["outcome"] == "response_received" else 1


if __name__ == "__main__":
    raise SystemExit(main())
