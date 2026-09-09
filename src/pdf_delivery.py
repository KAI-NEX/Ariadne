"""Shared complete-page PDF delivery; no semantic extraction or truncation."""
from __future__ import annotations
import subprocess
import tempfile
from pathlib import Path
from src.ai_career_ingestion import AICareerIngestionError

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
