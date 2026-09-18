"""Shared complete-page PDF delivery; no semantic extraction or truncation."""
from __future__ import annotations
import subprocess
import tempfile
import re
from contextvars import ContextVar
from pathlib import Path
from src.ai_career_ingestion import AICareerIngestionError

PUBLIC_PDF_LIMITS = ContextVar("ariadne_public_pdf_limits", default=False)
PDF_RENDERER = ContextVar("ariadne_pdf_renderer", default=None)

def render_complete_pdf_pages(pdf_bytes: bytes) -> list[tuple[str, bytes]]:
    """Render every original PDF page transiently for an account-enabled vision model.

    This is a transport adapter, not Local Mode entity extraction: no OCR text,
    DocumentBlock or CareerEntity is created before the provider response.
    """
    renderer = PDF_RENDERER.get()
    if renderer is not None:
        return renderer(pdf_bytes)
    with tempfile.TemporaryDirectory(prefix="job-radar-career-pages-") as directory:
        root = Path(directory)
        source = root / "source.pdf"
        source.write_bytes(pdf_bytes)
        output_prefix = root / "page"
        expected_pages = None
        try:
            if PUBLIC_PDF_LIMITS.get():
                info = subprocess.run(["pdfinfo", str(source)], check=True, capture_output=True, timeout=10)
                match = re.search(rb"(?m)^Pages:\s*(\d+)\s*$", info.stdout)
                expected_pages = int(match.group(1)) if match else 0
                if not 1 <= expected_pages <= 48:
                    raise AICareerIngestionError("pdf_complete_page_limit")
            subprocess.run(
                ["pdftoppm", "-jpeg", "-r", "120", "-jpegopt", "quality=82",
                 *(["-scale-to", "2048"] if PUBLIC_PDF_LIMITS.get() else []), str(source), str(output_prefix)],
                check=True, capture_output=True, timeout=120,
            )
        except (subprocess.SubprocessError, OSError) as error:
            raise AICareerIngestionError("pdf_page_render_failed") from error
        paths = sorted(root.glob("page-*.jpg"), key=lambda path: int(path.stem.rsplit("-", 1)[1]))
        if not paths:
            raise AICareerIngestionError("pdf_page_render_empty")
        if expected_pages is not None and len(paths) != expected_pages:
            raise AICareerIngestionError("pdf_page_render_incomplete")
        pages = [(str(index), path.read_bytes()) for index, path in enumerate(paths, start=1)]
        if sum(len(image) for _, image in pages) > 40_000_000:
            raise AICareerIngestionError("rendered_pages_exceed_request_limit")
        return pages
