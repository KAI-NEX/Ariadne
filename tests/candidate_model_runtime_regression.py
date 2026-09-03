"""No-network regression for the single qualified Candidate PDF model adapter."""

from __future__ import annotations

import base64
import hashlib
import json
import unittest
from urllib.error import URLError

from src.candidate_context import CONTRACT_ID, PROMPT_VERSION
from src.candidate_model_runtime import (
    ADAPTER_VERSION,
    CREDENTIAL_REF,
    DELIVERY_METHOD,
    MODEL_ID,
    CandidateModelExecutionRegistry,
    CandidateModelRuntimeError,
    candidate_model_operation_id,
    execute_candidate_model_request,
    runtime_fingerprint,
)
from src.execution_contract import create_runtime_snapshot
from src.provider_runtime import deepseek_model_descriptors


PDF_BYTES = b"%PDF-1.4\nsynthetic candidate fixture\n%%EOF"
HASH = "sha256:" + hashlib.sha256(PDF_BYTES).hexdigest()
SOURCE_ID = "source-candidate-" + HASH.removeprefix("sha256:")


def snapshot() -> dict:
    descriptor = deepseek_model_descriptors([MODEL_ID])[0]
    return create_runtime_snapshot(
        {"mode": "model", "provider": "deepseek", "model": MODEL_ID},
        model_descriptor=descriptor,
        snapshot_id="runtime-snapshot-candidate-model-test",
        captured_at="2026-09-03T09:00:00Z",
        credential_ref=CREDENTIAL_REF,
        adapter_version=ADAPTER_VERSION,
        prompt_version=PROMPT_VERSION,
        schema_version=CONTRACT_ID,
        delivery_method=DELIVERY_METHOD,
    ).to_dict()


def source() -> dict:
    return {
        "contract_id": "ariadne-source-document-v1",
        "source_document_id": SOURCE_ID,
        "source_type": "PDF",
        "filename": "synthetic-candidate.pdf",
        "label": None,
        "mime_type": "application/pdf",
        "content_hash": HASH,
        "created_at": "2026-09-03T09:00:00Z",
        "material_type": "CANDIDATE",
        "local_reference": f"indexeddb://job-radar-local-first-v1/source_documents/raw-source-payload-v1%3A%3A{SOURCE_ID}",
        "batch_id": "batch-candidate-model-test",
        "provenance": {"supplied_by": "USER", "raw_source_recoverability": "DURABLE_BROWSER_LOCAL"},
        "authority": "SOURCE_INPUT_ONLY",
    }


def request() -> dict:
    runtime = snapshot()
    consent_id = "consent-candidate-model-test"
    fingerprint = runtime_fingerprint(runtime)
    operation_id = candidate_model_operation_id(SOURCE_ID, fingerprint, consent_id)
    return {
        "source_document": source(),
        "document_data_url": "data:application/pdf;base64," + base64.b64encode(PDF_BYTES).decode("ascii"),
        "runtime_snapshot": runtime,
        "processing_run_id": f"run-{operation_id}",
        "operation_identity": {
            "operation_id": operation_id,
            "operation_type": "CANDIDATE_MODEL_STRUCTURING",
            "source_document_id": SOURCE_ID,
            "runtime_fingerprint": fingerprint,
            "consent_id": consent_id,
        },
        "consent": {
            "explicitly_confirmed": True,
            "consent_id": consent_id,
            "source_document_id": SOURCE_ID,
            "provider": "deepseek",
            "model": MODEL_ID,
            "delivery_method": DELIVERY_METHOD,
            "confirmed_at": "2026-09-03T09:01:00Z",
        },
    }


def valid_item() -> dict:
    return {
        "item_id": "work-1",
        "item_type": "WORK_EXPERIENCE",
        "title": "Product Designer",
        "subtitle": "Synthetic Studio",
        "time": "2024",
        "summary": "Designed a documented product flow.",
        "facts": [{"fact_id": "fact-1", "label": "Role", "value": "Product Designer"}],
        "ownership": None,
        "source_refs": [{
            "source_ref_id": "ref-1",
            "source_document_id": SOURCE_ID,
            "location": "p. 2",
            "excerpt_or_reference": "Product Designer",
            "support_relation": "EXPLICIT_SOURCE",
        }],
        "uncertainties": [],
        "review_status": "NEEDS_REVIEW",
        "item_version": 1,
    }


def response(item: dict | None = None, *, model: str = MODEL_ID, content: str | None = None, finish_reason: str = "stop", reasoning_content: str | None = None, usage: dict | None = None) -> dict:
    model_content = content if content is not None else json.dumps({"material_type": "resume", "items": [item or valid_item()]})
    message = {"content": model_content}
    if reasoning_content is not None:
        message["reasoning_content"] = reasoning_content
    return {"id": "response-synthetic-1", "model": model, "choices": [{"finish_reason": finish_reason, "message": message}], "usage": usage or {"prompt_tokens": 12, "completion_tokens": 24, "total_tokens": 36}}


class CandidateModelRuntimeRegression(unittest.TestCase):
    def execute(self, payload: dict, provider_response: dict | None = None):
        observations = {"rendered": 0, "provider": 0, "images": 0}

        def renderer(pdf_bytes: bytes):
            self.assertEqual(pdf_bytes, PDF_BYTES)
            observations["rendered"] += 1
            return [("1", b"jpeg-page-one"), ("2", b"jpeg-page-two"), ("3", b"jpeg-page-three")]

        def provider(api_key: str, provider_payload: dict):
            self.assertEqual(api_key, "synthetic-key-from-reader")
            self.assertEqual(provider_payload["model"], MODEL_ID)
            self.assertEqual(provider_payload["thinking"], {"type": "disabled"})
            self.assertEqual(provider_payload["max_tokens"], 8000)
            self.assertIn('"material_type": "resume"', provider_payload["messages"][0]["content"][0]["text"])
            self.assertNotIn("candidate_material_type", payload)
            images = [part for message in provider_payload["messages"] for part in message["content"] if part["type"] == "image_url"]
            observations["images"] = len(images)
            observations["provider"] += 1
            return 200, provider_response or response()

        result = execute_candidate_model_request(payload, lambda: "synthetic-key-from-reader", renderer, provider)
        return result, observations

    def test_exact_adapter_sends_every_rendered_page_and_returns_review_proposal(self) -> None:
        result, observations = self.execute(request())
        self.assertEqual(observations, {"rendered": 1, "provider": 1, "images": 3})
        self.assertEqual(result["model"], MODEL_ID)
        self.assertEqual(result["delivery_method"], "rendered_pdf_pages")
        self.assertEqual(result["rendered_page_count"], 3)
        self.assertEqual(result["outbound_image_count"], 3)
        self.assertEqual(result["operation_id"], request()["operation_identity"]["operation_id"])
        self.assertEqual(result["candidate_proposal"]["material_type"], "resume")
        self.assertTrue(result["network_call_made"])
        self.assertEqual(result["candidate_proposal"]["review_status"], "NEEDS_REVIEW")

    def test_explicit_empty_items_completes_without_creating_a_false_proposal(self) -> None:
        result, observations = self.execute(request(), response(content=json.dumps({"material_type": "other", "items": []})))
        self.assertEqual(observations, {"rendered": 1, "provider": 1, "images": 3})
        self.assertEqual(result["candidate_proposal"]["items"], [])
        self.assertEqual(result["candidate_proposal"]["material_type"], "other")

    def test_length_finish_is_explicit_truncation_and_never_repairs_json(self) -> None:
        truncated = response(
            content='{"items":[',
            finish_reason="length",
            reasoning_content="synthetic reasoning metadata fixture",
            usage={
                "prompt_tokens": 1763,
                "completion_tokens": 8000,
                "total_tokens": 9763,
                "completion_tokens_details": {"reasoning_tokens": 6751},
            },
        )
        with self.assertRaises(CandidateModelRuntimeError) as raised:
            self.execute(request(), truncated)
        error = raised.exception
        self.assertEqual(error.code, "model_output_truncated")
        self.assertEqual(error.failure_layer, "model_output")
        self.assertTrue(error.network_call_made)
        self.assertEqual(error.diagnostics["finish_reason"], "length")
        self.assertEqual(error.diagnostics["reasoning_tokens"], 6751)
        self.assertEqual(error.diagnostics["parse_status"], "not_attempted_truncated")
        self.assertEqual(error.diagnostics["schema_status"], "not_attempted")
        self.assertEqual(error.diagnostics["grounding_status"], "not_attempted")
        self.assertEqual(error.diagnostics["rendered_page_count"], 3)

    def test_consent_and_integrity_fail_before_render_or_provider(self) -> None:
        for mutate, code in [
            (lambda payload: payload.__setitem__("consent", None), "candidate_model_consent_required"),
            (lambda payload: payload["source_document"].__setitem__("content_hash", "sha256:" + "0" * 64), "raw_source_integrity_mismatch"),
        ]:
            payload = request()
            mutate(payload)
            calls = {"render": 0, "provider": 0}
            with self.assertRaisesRegex(CandidateModelRuntimeError, code):
                execute_candidate_model_request(
                    payload,
                    lambda: "synthetic-key-from-reader",
                    lambda _pdf: calls.__setitem__("render", calls["render"] + 1) or [("1", b"image")],
                    lambda _key, _body: calls.__setitem__("provider", calls["provider"] + 1) or (200, response()),
                )
            self.assertEqual(calls, {"render": 0, "provider": 0})

    def test_missing_credential_fails_before_delivery(self) -> None:
        calls = {"render": 0, "provider": 0}
        with self.assertRaisesRegex(CandidateModelRuntimeError, "deepseek_key_not_configured"):
            execute_candidate_model_request(
                request(), lambda: None,
                lambda _pdf: calls.__setitem__("render", 1) or [("1", b"image")],
                lambda _key, _body: calls.__setitem__("provider", 1) or (200, response()),
            )
        self.assertEqual(calls, {"render": 0, "provider": 0})

    def test_wrong_model_malformed_schema_and_grounding_fail_closed(self) -> None:
        cases = [
            (response(model="another-model"), "deepseek_returned_model_mismatch"),
            (response(content="not-json"), "deepseek_response_malformed"),
            (response({**valid_item(), "title": ""}), "candidate_model_proposal_contract_failed"),
            (response({**valid_item(), "source_refs": []}), "candidate_model_grounding_validation_failed"),
        ]
        for provider_response, code in cases:
            with self.assertRaisesRegex(CandidateModelRuntimeError, code):
                self.execute(request(), provider_response)

    def test_provider_transport_failure_never_becomes_success(self) -> None:
        with self.assertRaises(URLError):
            execute_candidate_model_request(
                request(), lambda: "synthetic-key-from-reader", lambda _pdf: [("1", b"image")],
                lambda _key, _body: (_ for _ in ()).throw(URLError("synthetic-network-failure")),
            )

    def test_operation_identity_and_single_flight_fail_closed(self) -> None:
        payload = request()
        payload["operation_identity"]["runtime_fingerprint"] = "sha256:" + "0" * 64
        calls = {"render": 0, "provider": 0}
        with self.assertRaisesRegex(CandidateModelRuntimeError, "candidate_model_operation_identity_invalid"):
            execute_candidate_model_request(
                payload, lambda: "synthetic-key-from-reader",
                lambda _pdf: calls.__setitem__("render", 1) or [("1", b"image")],
                lambda _key, _body: calls.__setitem__("provider", 1) or (200, response()),
            )
        self.assertEqual(calls, {"render": 0, "provider": 0})
        registry = CandidateModelExecutionRegistry()
        operation_id = request()["operation_identity"]["operation_id"]
        self.assertEqual(registry.begin(operation_id, SOURCE_ID), ("CLAIMED", None))
        self.assertEqual(registry.begin(operation_id, SOURCE_ID), ("ACTIVE", None))
        self.assertTrue(registry.succeed(operation_id, {"operation_id": operation_id}))
        self.assertEqual(registry.begin(operation_id, SOURCE_ID), ("COMPLETED", {"operation_id": operation_id}))
        self.assertEqual(registry.forget_source(SOURCE_ID), 1)
        self.assertEqual(registry.begin(operation_id, SOURCE_ID), ("CLAIMED", None))
        self.assertEqual(registry.forget_source(SOURCE_ID), 1)
        self.assertFalse(registry.succeed(operation_id, {"operation_id": operation_id}))


if __name__ == "__main__":
    unittest.main()
