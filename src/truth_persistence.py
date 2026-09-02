"""Slice 3 truth, review, revision, and persistence-boundary contracts.

These validators define epistemic roles; serializing an object never promotes
it to authoritative product truth.  This module performs no extraction,
Provider execution, model call, UI action, or persistence write.
"""

from __future__ import annotations

import copy
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Mapping

from src.execution_contract import RuntimeSnapshot, validate_runtime_snapshot


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = PROJECT_ROOT / "data" / "truth_persistence_v1.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
CONTRACT_ID = SCHEMA["x-contract-id"]
DB_NAME = SCHEMA["x-indexeddb-name"]
DB_VERSION = SCHEMA["x-indexeddb-version"]
STORE_SPECS = tuple((item["name"], item["keyPath"], item["lifecycle"]) for item in SCHEMA["x-stores"])
NEW_STORE_SPECS = tuple(item for item in STORE_SPECS if item[2] == "new")

SOURCE_TYPES = tuple(SCHEMA["$defs"]["sourceDocument"]["properties"]["source_type"]["enum"])
MATERIAL_TYPES = tuple(SCHEMA["$defs"]["sourceDocument"]["properties"]["material_type"]["enum"])
PROCESSING_STATUSES = tuple(SCHEMA["$defs"]["processingRun"]["properties"]["status"]["enum"])
BATCH_STATUSES = tuple(SCHEMA["$defs"]["processingBatch"]["properties"]["status"]["enum"])
PROPOSAL_TYPES = tuple(SCHEMA["$defs"]["proposal"]["properties"]["proposal_type"]["enum"])
PROPOSAL_STATUSES = tuple(SCHEMA["$defs"]["proposal"]["properties"]["status"]["enum"])
REVIEW_DECISIONS = tuple(SCHEMA["$defs"]["reviewDecision"]["properties"]["decision"]["enum"])
CONTEXT_TYPES = tuple(SCHEMA["$defs"]["contextRevision"]["properties"]["context_type"]["enum"])
CANDIDATE_CONTEXT_LIFECYCLE_STATES = ("REMOVED",)
CANCEL_REASON = "USER_CANCELLED_UPLOAD"
AUTHORITY = {
    "source": "SOURCE_INPUT_ONLY",
    "extraction": "NON_AUTHORITATIVE_EXTRACTION",
    "execution": "EXECUTION_HISTORY",
    "proposal": "NON_AUTHORITATIVE_PROPOSAL",
    "review": "AUTHORITATIVE_USER_DECISION",
    "revision": "AUTHORITATIVE_CONFIRMED_CONTEXT",
    "lifecycle": "AUTHORITATIVE_USER_DECISION",
}
FIELDS = {
    "source": tuple(SCHEMA["$defs"]["sourceDocument"]["required"]),
    "extraction": tuple(SCHEMA["$defs"]["extractionArtifact"]["required"]),
    "run": tuple(SCHEMA["$defs"]["processingRun"]["required"]),
    "batch": tuple(SCHEMA["$defs"]["processingBatch"]["required"]),
    "proposal": tuple(SCHEMA["$defs"]["proposal"]["required"]),
    "review": tuple(SCHEMA["$defs"]["reviewDecision"]["required"]),
    "revision": tuple(SCHEMA["$defs"]["contextRevision"]["required"]),
    "lifecycle": tuple(SCHEMA["$defs"]["candidateContextLifecycle"]["required"]),
}

_SECRET_KEY_PATTERN = re.compile(r"(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|bearer|secret)", re.IGNORECASE)
_EMBEDDED_BYTES_KEY_PATTERN = re.compile(r"(?:file[_-]?blob|file[_-]?bytes|raw[_-]?bytes|document[_-]?data[_-]?url|image[_-]?data[_-]?url|base64[_-]?data)", re.IGNORECASE)
_EMBEDDED_BYTES_VALUE_PATTERN = re.compile(r"^data:(?:application|image)/[^;,]+;base64,", re.IGNORECASE)
_SECRET_VALUE_PATTERNS = (
    re.compile(r"\bBearer\s+\S+", re.IGNORECASE),
    re.compile(r"\b(?:sk|rk|pk|sess)-[A-Za-z0-9_-]{8,}"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"\b(?:api[_ -]?key|authorization|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+", re.IGNORECASE),
)


class TruthPersistenceError(ValueError):
    """A persistence contract failed closed without exposing rejected data."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def _clone(value: Any) -> Any:
    try:
        return json.loads(json.dumps(value, ensure_ascii=False, allow_nan=False))
    except (TypeError, ValueError, OverflowError, RecursionError) as error:
        raise TruthPersistenceError("record_not_json_serializable") from error


def _plain_mapping(value: Any, code: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise TruthPersistenceError(code)
    return dict(value)


def _assert_no_secret_like(value: Any) -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            if not isinstance(key, str) or not key:
                raise TruthPersistenceError("record_key_invalid")
            if _SECRET_KEY_PATTERN.search(key):
                raise TruthPersistenceError("persistence_secret_field_forbidden")
            _assert_no_secret_like(nested)
        return
    if isinstance(value, list):
        for item in value:
            _assert_no_secret_like(item)
        return
    if isinstance(value, str) and any(pattern.search(value) for pattern in _SECRET_VALUE_PATTERNS):
        raise TruthPersistenceError("persistence_secret_value_forbidden")


def _assert_no_embedded_source_bytes(value: Any) -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            if _EMBEDDED_BYTES_KEY_PATTERN.search(str(key)):
                raise TruthPersistenceError("embedded_source_bytes_forbidden")
            _assert_no_embedded_source_bytes(nested)
        return
    if isinstance(value, list):
        for item in value:
            _assert_no_embedded_source_bytes(item)
        return
    if isinstance(value, str) and _EMBEDDED_BYTES_VALUE_PATTERN.search(value):
        raise TruthPersistenceError("embedded_source_bytes_forbidden")


def _prepare(value: Any, fields: tuple[str, ...], code: str) -> dict[str, Any]:
    record = _plain_mapping(value, f"{code}_malformed")
    record = _clone(record)
    _assert_no_secret_like(record)
    _assert_no_embedded_source_bytes(record)
    if set(record) != set(fields):
        raise TruthPersistenceError(f"{code}_shape_invalid")
    return record


def _required_string(value: Any, code: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TruthPersistenceError(code)
    return value.strip()


def _nullable_string(value: Any, code: str) -> str | None:
    if value is None:
        return None
    return _required_string(value, code)


def _valid_iso(value: Any, code: str, *, nullable: bool = False) -> str | None:
    if nullable and value is None:
        return None
    if not isinstance(value, str) or not re.search(r"(?:Z|[+-]\d{2}:\d{2})$", value):
        raise TruthPersistenceError(code)
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise TruthPersistenceError(code) from error
    return value


def _string_list(value: Any, code: str, *, non_empty: bool = False) -> list[str]:
    if not isinstance(value, list):
        raise TruthPersistenceError(code)
    result = [_required_string(item, code) for item in value]
    if non_empty and not result:
        raise TruthPersistenceError(code)
    if len(set(result)) != len(result):
        raise TruthPersistenceError(f"{code}_duplicate")
    return result


def _source_ref(value: Any) -> dict[str, str]:
    record = _plain_mapping(value, "source_ref_malformed")
    if set(record) != {"source_document_id", "location", "excerpt_or_reference"}:
        raise TruthPersistenceError("source_ref_shape_invalid")
    return {
        "source_document_id": _required_string(record["source_document_id"], "source_ref_source_id_invalid"),
        "location": _required_string(record["location"], "source_ref_location_invalid"),
        "excerpt_or_reference": _required_string(record["excerpt_or_reference"], "source_ref_excerpt_invalid"),
    }


def validate_source_document(source: Any) -> dict[str, Any]:
    value = _prepare(source, FIELDS["source"], "source_document")
    if value["contract_id"] != "ariadne-source-document-v1":
        raise TruthPersistenceError("source_document_contract_invalid")
    if value["source_type"] not in SOURCE_TYPES:
        raise TruthPersistenceError("source_document_type_invalid")
    if value["material_type"] not in MATERIAL_TYPES:
        raise TruthPersistenceError("source_document_material_type_invalid")
    filename = _nullable_string(value["filename"], "source_document_filename_invalid")
    label = _nullable_string(value["label"], "source_document_label_invalid")
    if filename is None and label is None:
        raise TruthPersistenceError("source_document_name_required")
    if value["authority"] != AUTHORITY["source"]:
        raise TruthPersistenceError("source_document_authority_invalid")
    return {
        "contract_id": value["contract_id"],
        "source_document_id": _required_string(value["source_document_id"], "source_document_id_invalid"),
        "source_type": value["source_type"],
        "filename": filename,
        "label": label,
        "mime_type": _nullable_string(value["mime_type"], "source_document_mime_type_invalid"),
        "content_hash": _required_string(value["content_hash"], "source_document_hash_invalid"),
        "created_at": _valid_iso(value["created_at"], "source_document_created_at_invalid"),
        "material_type": value["material_type"],
        "local_reference": _nullable_string(value["local_reference"], "source_document_local_reference_invalid"),
        "batch_id": _nullable_string(value["batch_id"], "source_document_batch_id_invalid"),
        "provenance": _clone(_plain_mapping(value["provenance"], "source_document_provenance_invalid")),
        "authority": value["authority"],
    }


def validate_extraction_artifact(artifact: Any) -> dict[str, Any]:
    value = _prepare(artifact, FIELDS["extraction"], "extraction_artifact")
    if value["contract_id"] != "ariadne-extraction-artifact-v1":
        raise TruthPersistenceError("extraction_artifact_contract_invalid")
    if value["authority"] != AUTHORITY["extraction"]:
        raise TruthPersistenceError("extraction_artifact_authority_invalid")
    if not isinstance(value["source_refs"], list):
        raise TruthPersistenceError("extraction_artifact_source_refs_invalid")
    refs = [_source_ref(ref) for ref in value["source_refs"]]
    source_id = _required_string(value["source_document_id"], "extraction_artifact_source_id_invalid")
    if any(ref["source_document_id"] != source_id for ref in refs):
        raise TruthPersistenceError("extraction_artifact_source_ref_mismatch")
    quality = None if value["quality"] is None else _clone(_plain_mapping(value["quality"], "extraction_artifact_quality_invalid"))
    return {
        "contract_id": value["contract_id"],
        "artifact_id": _required_string(value["artifact_id"], "extraction_artifact_id_invalid"),
        "source_document_id": source_id,
        "processing_run_id": _required_string(value["processing_run_id"], "extraction_artifact_run_id_invalid"),
        "extraction_method": _required_string(value["extraction_method"], "extraction_artifact_method_invalid"),
        "payload": _clone(_plain_mapping(value["payload"], "extraction_artifact_payload_invalid")),
        "source_refs": refs,
        "quality": quality,
        "warnings": _string_list(value["warnings"], "extraction_artifact_warnings_invalid"),
        "errors": _string_list(value["errors"], "extraction_artifact_errors_invalid"),
        "created_at": _valid_iso(value["created_at"], "extraction_artifact_created_at_invalid"),
        "authority": value["authority"],
    }


def validate_processing_run(run: Any) -> dict[str, Any]:
    value = _prepare(run, FIELDS["run"], "processing_run")
    if value["contract_id"] != "ariadne-processing-run-v1":
        raise TruthPersistenceError("processing_run_contract_invalid")
    if value["status"] not in PROCESSING_STATUSES:
        raise TruthPersistenceError("processing_run_status_invalid")
    if value["authority"] != AUTHORITY["execution"]:
        raise TruthPersistenceError("processing_run_authority_invalid")
    source_id = _nullable_string(value["source_document_id"], "processing_run_source_id_invalid")
    batch_id = _nullable_string(value["batch_id"], "processing_run_batch_id_invalid")
    if source_id is None and batch_id is None:
        raise TruthPersistenceError("processing_run_scope_required")
    started_at = _valid_iso(value["started_at"], "processing_run_started_at_invalid", nullable=True)
    finished_at = _valid_iso(value["finished_at"], "processing_run_finished_at_invalid", nullable=True)
    error_code = _nullable_string(value["error_code"], "processing_run_error_code_invalid")
    status = value["status"]
    if status == "PENDING" and (started_at is not None or finished_at is not None or error_code is not None):
        raise TruthPersistenceError("processing_run_pending_state_invalid")
    if status == "RUNNING" and (started_at is None or finished_at is not None or error_code is not None):
        raise TruthPersistenceError("processing_run_running_state_invalid")
    if status == "SUCCEEDED" and (started_at is None or finished_at is None or error_code is not None):
        raise TruthPersistenceError("processing_run_succeeded_state_invalid")
    if status == "FAILED" and (finished_at is None or error_code is None):
        raise TruthPersistenceError("processing_run_failed_state_invalid")
    if status == "CANCELLED" and finished_at is None:
        raise TruthPersistenceError("processing_run_cancelled_state_invalid")
    proposal_ids = _string_list(value["proposal_ids"], "processing_run_proposal_ids_invalid")
    if status == "CANCELLED" and proposal_ids:
        raise TruthPersistenceError("cancelled_run_proposal_forbidden")
    return {
        "contract_id": value["contract_id"],
        "run_id": _required_string(value["run_id"], "processing_run_id_invalid"),
        "operation_type": _required_string(value["operation_type"], "processing_run_operation_invalid"),
        "source_document_id": source_id,
        "batch_id": batch_id,
        "runtime_snapshot_id": _required_string(value["runtime_snapshot_id"], "processing_run_snapshot_id_invalid"),
        "started_at": started_at,
        "finished_at": finished_at,
        "status": status,
        "error_code": error_code,
        "output_artifact_ids": _string_list(value["output_artifact_ids"], "processing_run_artifact_ids_invalid"),
        "proposal_ids": proposal_ids,
        "authority": value["authority"],
    }


def validate_processing_batch(batch: Any) -> dict[str, Any]:
    value = _prepare(batch, FIELDS["batch"], "processing_batch")
    if value["contract_id"] != "ariadne-processing-batch-v1":
        raise TruthPersistenceError("processing_batch_contract_invalid")
    if value["status"] not in BATCH_STATUSES:
        raise TruthPersistenceError("processing_batch_status_invalid")
    if value["authority"] != AUTHORITY["execution"]:
        raise TruthPersistenceError("processing_batch_authority_invalid")
    source_ids = _string_list(value["source_document_ids"], "processing_batch_source_ids_invalid", non_empty=True)
    completed = _string_list(value["completed_source_ids"], "processing_batch_completed_ids_invalid")
    not_started = _string_list(value["not_started_source_ids"], "processing_batch_not_started_ids_invalid")
    cancelled_source_id = _nullable_string(value["cancelled_source_id"], "processing_batch_cancelled_source_invalid")
    finished_at = _valid_iso(value["finished_at"], "processing_batch_finished_at_invalid", nullable=True)
    cancelled_at = _valid_iso(value["cancelled_at"], "processing_batch_cancelled_at_invalid", nullable=True)
    cancel_reason = _nullable_string(value["cancel_reason"], "processing_batch_cancel_reason_invalid")
    partition = completed + not_started + ([cancelled_source_id] if cancelled_source_id else [])
    if any(item not in source_ids for item in partition):
        raise TruthPersistenceError("processing_batch_source_partition_invalid")
    if len(set(partition)) != len(partition):
        raise TruthPersistenceError("processing_batch_source_partition_overlap")
    if value["status"] == "CANCELLED":
        if not cancelled_source_id or not cancelled_at or not finished_at or cancel_reason != CANCEL_REASON:
            raise TruthPersistenceError("processing_batch_cancel_contract_invalid")
        if len(partition) != len(source_ids):
            raise TruthPersistenceError("processing_batch_cancel_partition_incomplete")
    elif cancelled_source_id is not None or cancelled_at is not None or cancel_reason is not None:
        raise TruthPersistenceError("processing_batch_non_cancelled_metadata_invalid")
    return {
        "contract_id": value["contract_id"],
        "batch_id": _required_string(value["batch_id"], "processing_batch_id_invalid"),
        "operation_type": _required_string(value["operation_type"], "processing_batch_operation_invalid"),
        "source_document_ids": source_ids,
        "completed_source_ids": completed,
        "cancelled_source_id": cancelled_source_id,
        "not_started_source_ids": not_started,
        "status": value["status"],
        "created_at": _valid_iso(value["created_at"], "processing_batch_created_at_invalid"),
        "finished_at": finished_at,
        "cancelled_at": cancelled_at,
        "cancel_reason": cancel_reason,
        "authority": value["authority"],
    }


def validate_proposal(proposal: Any) -> dict[str, Any]:
    value = _prepare(proposal, FIELDS["proposal"], "proposal")
    if value["contract_id"] != "ariadne-context-proposal-v1":
        raise TruthPersistenceError("proposal_contract_invalid")
    if value["proposal_type"] not in PROPOSAL_TYPES:
        raise TruthPersistenceError("proposal_type_invalid")
    if value["status"] not in PROPOSAL_STATUSES:
        raise TruthPersistenceError("proposal_status_invalid")
    if value["authority"] != AUTHORITY["proposal"]:
        raise TruthPersistenceError("proposal_authority_invalid")
    source_ids = _string_list(value["source_document_ids"], "proposal_source_ids_invalid", non_empty=True)
    if not isinstance(value["grounding_refs"], list) or not value["grounding_refs"]:
        raise TruthPersistenceError("proposal_grounding_refs_invalid")
    refs = [_source_ref(ref) for ref in value["grounding_refs"]]
    if any(ref["source_document_id"] not in source_ids for ref in refs):
        raise TruthPersistenceError("proposal_grounding_source_mismatch")
    if not isinstance(value["uncertainties"], list):
        raise TruthPersistenceError("proposal_uncertainties_invalid")
    return {
        "contract_id": value["contract_id"],
        "proposal_id": _required_string(value["proposal_id"], "proposal_id_invalid"),
        "proposal_type": value["proposal_type"],
        "source_document_ids": source_ids,
        "processing_run_id": _required_string(value["processing_run_id"], "proposal_run_id_invalid"),
        "runtime_snapshot_id": _required_string(value["runtime_snapshot_id"], "proposal_snapshot_id_invalid"),
        "status": value["status"],
        "created_at": _valid_iso(value["created_at"], "proposal_created_at_invalid"),
        "payload": _clone(_plain_mapping(value["payload"], "proposal_payload_invalid")),
        "grounding_refs": refs,
        "warnings": _string_list(value["warnings"], "proposal_warnings_invalid"),
        "uncertainties": _clone(value["uncertainties"]),
        "authority": value["authority"],
    }


def cancel_processing_run(run: Any, cancelled_at: str) -> dict[str, Any]:
    value = validate_processing_run(run)
    if value["status"] not in {"PENDING", "RUNNING"}:
        raise TruthPersistenceError("processing_run_not_cancellable")
    if value["proposal_ids"]:
        raise TruthPersistenceError("processing_run_with_proposal_not_cancellable")
    return validate_processing_run({
        **value,
        "status": "CANCELLED",
        "finished_at": _valid_iso(cancelled_at, "processing_run_cancelled_at_invalid"),
        "error_code": CANCEL_REASON,
        "proposal_ids": [],
    })


def cancel_proposal(proposal: Any) -> dict[str, Any]:
    value = validate_proposal(proposal)
    if value["status"] == "CANCELLED_BY_USER":
        return value
    if value["status"] != "AWAITING_REVIEW":
        raise TruthPersistenceError("proposal_not_user_cancellable")
    return validate_proposal({**value, "status": "CANCELLED_BY_USER"})


def validate_cancelled_workflow_state(input_value: Mapping[str, Any]) -> dict[str, Any]:
    value = _plain_mapping(input_value, "cancelled_workflow_malformed")
    batch = validate_processing_batch(value.get("processing_batch"))
    run = validate_processing_run(value.get("processing_run"))
    proposal_raw = value.get("proposal")
    proposal = None if proposal_raw is None else validate_proposal(proposal_raw)
    if batch["status"] != "CANCELLED":
        raise TruthPersistenceError("workflow_batch_not_cancelled")
    if not run["source_document_id"] or batch["cancelled_source_id"] != run["source_document_id"] or batch["batch_id"] != run["batch_id"]:
        raise TruthPersistenceError("cancelled_workflow_scope_mismatch")
    if run["status"] not in {"RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"}:
        raise TruthPersistenceError("cancelled_workflow_run_state_invalid")
    if run["status"] == "CANCELLED" and proposal is not None:
        raise TruthPersistenceError("cancelled_run_proposal_forbidden")
    if run["status"] in {"RUNNING", "FAILED"} and proposal is not None:
        raise TruthPersistenceError("incomplete_run_proposal_forbidden")
    if proposal is not None:
        if run["status"] != "SUCCEEDED":
            raise TruthPersistenceError("proposal_requires_succeeded_run")
        if proposal["status"] != "CANCELLED_BY_USER":
            raise TruthPersistenceError("cancelled_workflow_proposal_reviewable")
        if proposal["processing_run_id"] != run["run_id"] or proposal["runtime_snapshot_id"] != run["runtime_snapshot_id"]:
            raise TruthPersistenceError("cancelled_workflow_proposal_linkage_mismatch")
        if run["source_document_id"] not in proposal["source_document_ids"]:
            raise TruthPersistenceError("cancelled_workflow_proposal_source_mismatch")
    return {"processing_batch": batch, "processing_run": run, "proposal": proposal}


def validate_review_decision(review: Any) -> dict[str, Any]:
    value = _prepare(review, FIELDS["review"], "review_decision")
    if value["contract_id"] != "ariadne-context-review-decision-v1":
        raise TruthPersistenceError("review_decision_contract_invalid")
    if value["decision"] not in REVIEW_DECISIONS:
        raise TruthPersistenceError("review_decision_value_invalid")
    if value["authority"] != AUTHORITY["review"]:
        raise TruthPersistenceError("review_decision_authority_invalid")
    accepted_payload = None if value["accepted_payload"] is None else _clone(_plain_mapping(value["accepted_payload"], "review_decision_payload_invalid"))
    if value["decision"] == "REJECT" and accepted_payload is not None:
        raise TruthPersistenceError("rejected_review_payload_forbidden")
    if value["decision"] != "REJECT" and accepted_payload is None:
        raise TruthPersistenceError("confirmed_review_payload_required")
    return {
        "contract_id": value["contract_id"],
        "review_id": _required_string(value["review_id"], "review_decision_id_invalid"),
        "proposal_id": _required_string(value["proposal_id"], "review_decision_proposal_id_invalid"),
        "decision": value["decision"],
        "reviewed_at": _valid_iso(value["reviewed_at"], "review_decision_reviewed_at_invalid"),
        "accepted_payload": accepted_payload,
        "authority": value["authority"],
    }


def validate_context_revision(revision: Any) -> dict[str, Any]:
    value = _prepare(revision, FIELDS["revision"], "context_revision")
    if value["contract_id"] != "ariadne-context-revision-v1":
        raise TruthPersistenceError("context_revision_contract_invalid")
    if value["context_type"] not in CONTEXT_TYPES:
        raise TruthPersistenceError("context_revision_type_invalid")
    if value["authority"] != AUTHORITY["revision"]:
        raise TruthPersistenceError("context_revision_authority_invalid")
    version = value["version"]
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        raise TruthPersistenceError("context_revision_version_invalid")
    previous_revision_id = _nullable_string(value["previous_revision_id"], "context_revision_previous_id_invalid")
    if (version == 1) != (previous_revision_id is None):
        raise TruthPersistenceError("context_revision_linkage_invalid")
    provenance = _plain_mapping(value["provenance"], "context_revision_provenance_invalid")
    if set(provenance) != {"source_document_ids", "processing_run_id", "runtime_snapshot_id"}:
        raise TruthPersistenceError("context_revision_provenance_shape_invalid")
    normalized_provenance = {
        "source_document_ids": _string_list(provenance["source_document_ids"], "context_revision_source_ids_invalid", non_empty=True),
        "processing_run_id": _required_string(provenance["processing_run_id"], "context_revision_run_id_invalid"),
        "runtime_snapshot_id": _required_string(provenance["runtime_snapshot_id"], "context_revision_snapshot_id_invalid"),
    }
    return {
        "contract_id": value["contract_id"],
        "context_type": value["context_type"],
        "context_id": _required_string(value["context_id"], "context_revision_context_id_invalid"),
        "revision_id": _required_string(value["revision_id"], "context_revision_id_invalid"),
        "version": version,
        "previous_revision_id": previous_revision_id,
        "confirmed_from_proposal_id": _required_string(value["confirmed_from_proposal_id"], "context_revision_proposal_id_invalid"),
        "review_decision_id": _required_string(value["review_decision_id"], "context_revision_review_id_invalid"),
        "created_at": _valid_iso(value["created_at"], "context_revision_created_at_invalid"),
        "provenance": normalized_provenance,
        "payload": _clone(_plain_mapping(value["payload"], "context_revision_payload_invalid")),
        "authority": value["authority"],
    }


def validate_candidate_context_lifecycle(record: Any) -> dict[str, Any]:
    value = _prepare(record, FIELDS["lifecycle"], "candidate_context_lifecycle")
    if value["contract_id"] != "ariadne-candidate-context-lifecycle-v1":
        raise TruthPersistenceError("candidate_context_lifecycle_contract_invalid")
    if value["state"] not in CANDIDATE_CONTEXT_LIFECYCLE_STATES:
        raise TruthPersistenceError("candidate_context_lifecycle_state_invalid")
    if value["reason"] != "USER_REMOVED":
        raise TruthPersistenceError("candidate_context_lifecycle_reason_invalid")
    if value["authority"] != AUTHORITY["lifecycle"]:
        raise TruthPersistenceError("candidate_context_lifecycle_authority_invalid")
    return {
        "contract_id": value["contract_id"],
        "lifecycle_id": _required_string(value["lifecycle_id"], "candidate_context_lifecycle_id_invalid"),
        "context_id": _required_string(value["context_id"], "candidate_context_lifecycle_context_id_invalid"),
        "item_id": _required_string(value["item_id"], "candidate_context_lifecycle_item_id_invalid"),
        "state": value["state"],
        "removed_from_revision_id": _required_string(value["removed_from_revision_id"], "candidate_context_lifecycle_revision_id_invalid"),
        "removed_at": _valid_iso(value["removed_at"], "candidate_context_lifecycle_removed_at_invalid"),
        "reason": value["reason"],
        "authority": value["authority"],
    }


def validate_runtime_snapshot_record(snapshot: RuntimeSnapshot | Mapping[str, Any]) -> dict[str, Any]:
    try:
        return validate_runtime_snapshot(snapshot).to_dict()
    except Exception as error:
        raise TruthPersistenceError("runtime_snapshot_invalid") from error


def validate_execution_chain(input_value: Mapping[str, Any]) -> dict[str, Any]:
    value = _plain_mapping(input_value, "execution_chain_malformed")
    snapshot = validate_runtime_snapshot_record(value.get("runtime_snapshot"))
    run = validate_processing_run(value.get("processing_run"))
    proposal = validate_proposal(value.get("proposal"))
    raw_sources = value.get("source_documents")
    if not isinstance(raw_sources, list):
        raise TruthPersistenceError("execution_chain_sources_invalid")
    sources = [validate_source_document(source) for source in raw_sources]
    source_ids = {source["source_document_id"] for source in sources}
    if run["runtime_snapshot_id"] != snapshot["snapshot_id"] or proposal["runtime_snapshot_id"] != snapshot["snapshot_id"]:
        raise TruthPersistenceError("runtime_snapshot_linkage_mismatch")
    if proposal["processing_run_id"] != run["run_id"]:
        raise TruthPersistenceError("proposal_run_linkage_mismatch")
    if any(source_id not in source_ids for source_id in proposal["source_document_ids"]):
        raise TruthPersistenceError("proposal_source_linkage_mismatch")
    if run["source_document_id"] and run["source_document_id"] not in proposal["source_document_ids"]:
        raise TruthPersistenceError("processing_run_source_linkage_mismatch")
    return {"runtime_snapshot": snapshot, "processing_run": run, "proposal": proposal, "source_documents": sources}


def apply_review_decision(input_value: Mapping[str, Any]) -> dict[str, Any]:
    value = _plain_mapping(input_value, "review_application_malformed")
    proposal = validate_proposal(value.get("proposal"))
    review = validate_review_decision(value.get("review_decision"))
    if proposal["status"] != "AWAITING_REVIEW":
        raise TruthPersistenceError("proposal_not_reviewable")
    if review["proposal_id"] != proposal["proposal_id"]:
        raise TruthPersistenceError("review_proposal_linkage_mismatch")
    if review["decision"] == "CONFIRM" and review["accepted_payload"] != proposal["payload"]:
        raise TruthPersistenceError("review_confirm_payload_mismatch")
    if review["decision"] == "REJECT":
        return {"proposal": {**proposal, "status": "REJECTED"}, "review_decision": review, "revision": None}
    context_type = "CANDIDATE" if proposal["proposal_type"] == "CANDIDATE_CONTEXT" else "JOB"
    current_raw = value.get("current_revision")
    current = None if current_raw is None else validate_context_revision(current_raw)
    expected_version = value.get("expected_version")
    actual_version = current["version"] if current else 0
    if not isinstance(expected_version, int) or isinstance(expected_version, bool) or expected_version < 0 or expected_version != actual_version:
        raise TruthPersistenceError("context_version_conflict")
    context_id = _required_string(value.get("context_id"), "context_revision_context_id_invalid")
    if current and (current["context_id"] != context_id or current["context_type"] != context_type):
        raise TruthPersistenceError("context_revision_base_mismatch")
    revision = validate_context_revision({
        "contract_id": "ariadne-context-revision-v1",
        "context_type": context_type,
        "context_id": context_id,
        "revision_id": _required_string(value.get("revision_id"), "context_revision_id_invalid"),
        "version": actual_version + 1,
        "previous_revision_id": current["revision_id"] if current else None,
        "confirmed_from_proposal_id": proposal["proposal_id"],
        "review_decision_id": review["review_id"],
        "created_at": review["reviewed_at"],
        "provenance": {
            "source_document_ids": proposal["source_document_ids"],
            "processing_run_id": proposal["processing_run_id"],
            "runtime_snapshot_id": proposal["runtime_snapshot_id"],
        },
        "payload": review["accepted_payload"],
        "authority": AUTHORITY["revision"],
    })
    return {"proposal": {**proposal, "status": "ACCEPTED"}, "review_decision": review, "revision": revision}


def validate_for_store(store_name: str, value: Any) -> dict[str, Any]:
    validators: dict[str, Callable[[Any], dict[str, Any]]] = {
        "source_documents": validate_source_document,
        "runtime_snapshots": validate_runtime_snapshot_record,
        "extraction_artifacts": validate_extraction_artifact,
        "processing_runs": validate_processing_run,
        "processing_batches": validate_processing_batch,
        "context_proposals": validate_proposal,
        "context_review_decisions": validate_review_decision,
        "candidate_context_revisions": validate_context_revision,
        "candidate_context_lifecycle": validate_candidate_context_lifecycle,
        "job_context_revisions": validate_context_revision,
    }
    validator = validators.get(store_name)
    if validator is None:
        raise TruthPersistenceError("persistence_store_unsupported")
    validated = validator(value)
    if store_name == "candidate_context_revisions" and validated["context_type"] != "CANDIDATE":
        raise TruthPersistenceError("context_revision_store_mismatch")
    if store_name == "job_context_revisions" and validated["context_type"] != "JOB":
        raise TruthPersistenceError("context_revision_store_mismatch")
    return copy.deepcopy(validated)
