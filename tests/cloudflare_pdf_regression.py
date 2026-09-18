"""Cloudflare PDF transport completeness and request-local isolation, offline."""
import base64
import copy
import hashlib
import unittest
from pathlib import Path
from src.browser_pdf_delivery import BrowserPDFDelivery, VERSION
from src.pdf_delivery import PDF_RENDERER, render_complete_pdf_pages
from src.runtime_transport import PROVIDER_HTTP_OPEN

ROOT = Path(__file__).resolve().parents[1]
RAW = (ROOT / "public/provider-visual-check.pdf").read_bytes()
JPEG = (ROOT / "public/job-radar-multimodal-smoke.jpg").read_bytes()

def manifest():
    return {"version": VERSION, "source_hash": "sha256:" + hashlib.sha256(RAW).hexdigest(),
            "page_count": 2, "pages": [{"number": n, "image": "data:image/jpeg;base64," + base64.b64encode(JPEG).decode(),
            "sha256": hashlib.sha256(JPEG).hexdigest()} for n in (1, 2)]}

class CloudflarePDFTest(unittest.TestCase):
    def delivery(self, value):
        return BrowserPDFDelivery(value, page_counter=lambda raw: 2)

    def test_ordered_complete_pages_use_platform_hook(self):
        token = PDF_RENDERER.set(self.delivery([manifest()]))
        try:
            self.assertEqual(render_complete_pdf_pages(RAW), [("1", JPEG), ("2", JPEG)])
        finally:
            PDF_RENDERER.reset(token)
        self.assertIsNone(PDF_RENDERER.get())
        self.assertIsNone(PROVIDER_HTTP_OPEN.get())

    def test_missing_or_different_original_is_rejected(self):
        for manifests, raw in [([], RAW), ([manifest()], RAW + b"\n")]:
            with self.assertRaises(ValueError): self.delivery(manifests)(raw)

    def test_partial_reordered_corrupt_and_wrong_version_rejected(self):
        cases = []
        item = manifest(); item["pages"].pop(); cases.append(item)
        item = manifest(); item["pages"].reverse(); cases.append(item)
        item = manifest(); item["pages"][0]["sha256"] = "0" * 64; cases.append(item)
        item = manifest(); item["pages"][0]["image"] += "bad"; cases.append(item)
        item = manifest(); item["version"] = "untrusted"; cases.append(item)
        item = manifest(); item["page_count"] = True; cases.append(item)
        for item in cases:
            with self.subTest(item=item.keys()), self.assertRaises(ValueError): self.delivery([item])(RAW)

    def test_manifest_cannot_alias_another_source_or_request(self):
        with self.assertRaises(ValueError): self.delivery([manifest(), manifest()])
        good = self.delivery([manifest()]); good(RAW)
        with self.assertRaises(ValueError): self.delivery([])(RAW)
        wrong = manifest(); wrong["source_hash"] = "sha256:" + "0" * 64
        with self.assertRaises(ValueError): self.delivery([wrong])(RAW)

    def test_actual_pdf_parser_when_available(self):
        try: import pypdf
        except ImportError: self.skipTest("pypdf belongs to the Cloudflare deployment only")
        self.assertEqual(BrowserPDFDelivery([manifest()])(RAW), [("1", JPEG), ("2", JPEG)])

if __name__ == "__main__": unittest.main()
