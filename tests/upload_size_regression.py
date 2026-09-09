"""Offline upload boundary tests; no OCR or Provider requests."""

import base64
import hashlib
import io
import json
import unittest
from unittest.mock import patch

import app
from src.career_evidence import CareerDocumentError, _decode_data_url
from src.candidate_model_runtime import CandidateModelRuntimeError, _decode_source
from src.job_model_runtime import JobModelRuntimeError, _validate_source_inputs
from src.upload_limits import MAX_FILE_REQUEST_BYTES, MAX_IMAGE_BATCH_REQUEST_BYTES


def data_url(mime, body):
    return f"data:{mime};base64," + base64.b64encode(body).decode("ascii")


class UploadSizeTests(unittest.TestCase):
    def test_decoded_file_boundary_and_integrity(self):
        for mime, signature, kind in [("application/pdf", b"%PDF-", "PDF"),
                                      ("image/png", b"\x89PNG\r\n\x1a\n", "IMAGE"),
                                      ("image/jpeg", b"\xff\xd8\xff", "IMAGE")]:
            body = signature + b"x" * (30_000_000 - len(signature))
            digest = hashlib.sha256(body).hexdigest()
            source = {"mime_type": mime, "source_type": kind, "content_hash": "sha256:" + digest,
                      "source_document_id": "source-candidate-" + digest}
            encoded = data_url(mime, body)
            self.assertEqual(_decode_source(encoded, source), body)
            self.assertEqual(_decode_data_url(encoded, mime), body)
            if kind == "IMAGE":
                self.assertEqual(app.decode_image_data_urls({"image_data_url": encoded})[0][1], body)
                inputs = [{"source_document_id": source["source_document_id"], "image_data_url": encoded}]
                self.assertEqual(len(_validate_source_inputs(inputs, [source])), 1)
            with self.assertRaisesRegex(CandidateModelRuntimeError, "raw_source_integrity_mismatch"):
                _decode_source(encoded, {**source, "content_hash": "sha256:" + "0" * 64})
            oversized = data_url(mime, body + b"x")
            with self.assertRaisesRegex(CareerDocumentError, "invalid_document_size"):
                _decode_data_url(oversized, mime)
            with self.assertRaisesRegex(CandidateModelRuntimeError, "source_payload_invalid"):
                _decode_source(oversized, source)
            if kind == "IMAGE":
                with self.assertRaisesRegex(ValueError, "invalid_image_size"):
                    app.decode_image_data_urls({"image_data_url": oversized})
                with self.assertRaisesRegex(JobModelRuntimeError, "source_inputs_invalid"):
                    _validate_source_inputs([{**inputs[0], "image_data_url": oversized}], [source])

    def test_http_envelopes_reach_validation_and_remain_bounded(self):
        # Exercise real request readers with a full 30 MB file. Downstream semantic
        # work is stopped at validation; this is not a model quality test.
        body = json.dumps({"document_data_url": data_url("application/pdf", b"x" * 30_000_000)}).encode()
        routes = [
            ("structure_model_candidate_proposal", "validate_candidate_model_request", CandidateModelRuntimeError("validation_probe", "source"), MAX_FILE_REQUEST_BYTES),
            ("structure_model_job_proposal", "validate_job_model_request", JobModelRuntimeError("validation_probe", "source"), MAX_IMAGE_BATCH_REQUEST_BYTES),
            ("extract_career_document_candidate", "extract_career_document", CareerDocumentError("validation_probe"), MAX_FILE_REQUEST_BYTES),
            ("extract_local_candidate_source", "local_snapshot_from_payload", CareerDocumentError("validation_probe"), MAX_FILE_REQUEST_BYTES),
            ("extract_local_candidate_image", "local_snapshot_from_payload", CareerDocumentError("validation_probe"), MAX_FILE_REQUEST_BYTES),
            ("extract_local_job_source", "local_snapshot_from_payload", CareerDocumentError("validation_probe"), MAX_FILE_REQUEST_BYTES),
            ("extract_local_job_image", "local_snapshot_from_payload", CareerDocumentError("validation_probe"), MAX_FILE_REQUEST_BYTES),
            ("read_local_source_for_model", "validate_runtime_snapshot", CareerDocumentError("validation_probe"), MAX_FILE_REQUEST_BYTES),
        ]
        for method, validator, error, limit in routes:
            with self.subTest(route=method):
                handler = object.__new__(app.JobRadarHandler)
                handler.headers = {"Content-Length": str(len(body))}
                handler.rfile = io.BytesIO(body)
                replies = []
                handler.send_json = lambda status, result: replies.append(result)
                with patch.object(app, validator, side_effect=error) as validate:
                    getattr(handler, method)()
                    validate.assert_called_once()
                self.assertEqual(replies[-1]["error"], "validation_probe")
                handler.headers = {"Content-Length": str(limit + 1)}
                handler.rfile = io.BytesIO(b"")
                with patch.object(app, validator) as validate:
                    getattr(handler, method)()
                    validate.assert_not_called()
                self.assertIn("size", replies[-1]["error"])


if __name__ == "__main__":
    unittest.main()
