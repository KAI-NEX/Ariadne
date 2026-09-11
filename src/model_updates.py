"""Account discovery is not qualification. Only reviewed adapters may be verified."""
from __future__ import annotations
import base64
import copy
import hashlib
import json
import threading
import time
from src.model_settings import CATALOG
from src.provider_runtime import deepseek_model_descriptors, is_runtime_eligible
from src.pdf_delivery import render_complete_pdf_pages

CHECK_VERSION = "image-two-page-pdf-structured-v1"
KNOWN_OLD_MODELS = {"deepseek-v4-pro", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"}


def synthetic_pdf(lines=("ARIADNE PAGE ONE", "ARIADNE PAGE TWO")):
    """Tiny reproducible PDF fixture; no user input, OCR or external assets."""
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>",
               ("<< /Type /Pages /Kids [" + " ".join(f"{4 + i * 2} 0 R" for i in range(len(lines))) + f"] /Count {len(lines)} >>").encode(),
               b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    for index, line in enumerate(lines):
        content = ("BT /F1 20 Tf 36 180 Td (" + line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") Tj ET").encode("ascii")
        objects.extend([f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 240] /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + index * 2} 0 R >>".encode(),
                        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream"])
    result = b"%PDF-1.4\n"; offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(result)); result += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    start = len(result)
    result += f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode()
    result += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    return result + f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF".encode()


def catalog_entry(model):
    return next((item for item in CATALOG["models"] if item["provider"] == "deepseek" and item["model"] == model), None)


def reviewed(model):
    return bool(catalog_entry(model)) and is_runtime_eligible(deepseek_model_descriptors([model])[0])


class ModelUpdates:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.Lock()
        self.cached = None
        self.checked_at = 0
        self.verifying = set()

    def discover(self, listing):
        # Bound provider reads across pages; discoveries never grant capability.
        with self.lock:
            if self.cached is not None and self.clock() - self.checked_at < 900:
                return copy.deepcopy({**self.cached, "cached": True, "network_call_made": False})
            value = listing()
            if not value.get("ok"):
                return {"ok": False, "error": "MODEL_DISCOVERY_UNAVAILABLE", "models": [], "network_call_made": value.get("network_call_made", False)}
            ids = sorted(set(value["models"]))[:100]
            entries = []
            for model in ids:
                if model in KNOWN_OLD_MODELS:
                    continue
                item = catalog_entry(model)
                entries.append({"model": model, "label": item["short_label"] if item else model,
                                "revision": item["descriptor_revision"] if item else None,
                                "can_verify": reviewed(model),
                                "status": "READY_TO_VERIFY" if reviewed(model) else "ADAPTER_REQUIRED"})
            self.checked_at = self.clock()
            revision = hashlib.sha256(json.dumps(entries, sort_keys=True).encode()).hexdigest()
            self.cached = {"ok": True, "models": entries, "listing_revision": revision, "cached": False, "network_call_made": True}
            return copy.deepcopy(self.cached)

    def verify(self, model, revision, listing, image_url, provider_call):
        item = catalog_entry(model)
        if not item or not reviewed(model) or revision != item["descriptor_revision"]:
            raise ValueError("MODEL_ADAPTER_REQUIRED")
        with self.lock:
            if model in self.verifying:
                raise ValueError("MODEL_VERIFICATION_BUSY")
            self.verifying.add(model)
        try:
            current = listing()
            if not current.get("ok") or model not in current.get("models", []):
                raise ValueError("MODEL_NO_LONGER_AVAILABLE")
            pages = render_complete_pdf_pages(synthetic_pdf())
            if [number for number, _ in pages] != ["1", "2"]:
                raise ValueError("MODEL_PDF_DELIVERY_FAILED")
            parts = [{"type": "text", "text": "Read the exact text of the three images, in order. First is a standalone image; the next two are every page of a PDF. Return the three readings in order using the function. Do not infer unseen text."},
                     {"type": "image_url", "image_url": {"url": image_url}}]
            parts.extend({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(data).decode()}} for _, data in pages)
            payload = {"model": model, "messages": [{"role": "user", "content": parts}],
                       "thinking": {"type": "disabled"}, "temperature": 0, "max_tokens": 200,
                       "tools": [{"type": "function", "function": {"name": "verify_visual_reading", "strict": True,
                                 "parameters": {"type": "object", "properties": {"readings": {"type": "array", "items": {"type": "string"}}},
                                                "required": ["readings"], "additionalProperties": False}}}],
                       "tool_choice": {"type": "function", "function": {"name": "verify_visual_reading"}}}
            status, response = provider_call(payload)
            try:
                choice = response["choices"][0]
                calls = choice["message"]["tool_calls"]
                output = json.loads(calls[0]["function"]["arguments"])
                if (status != 200 or response["model"] != model or choice["finish_reason"] != "tool_calls"
                    or len(calls) != 1 or calls[0]["function"]["name"] != "verify_visual_reading"
                    or output != {"readings": ["JOB RADAR TEST", "ARIADNE PAGE ONE", "ARIADNE PAGE TWO"]}):
                    raise ValueError()
            except (KeyError, TypeError, IndexError, ValueError):
                raise ValueError("MODEL_VERIFICATION_FAILED") from None
            return {"ok": True, "model": model, "revision": revision, "check_version": CHECK_VERSION,
                    "checks": ["image", "complete_pdf_pages", "structured_output", "response_model"],
                    "network_call_made": True, "career_data_sent": False}
        finally:
            with self.lock:
                self.verifying.discard(model)
