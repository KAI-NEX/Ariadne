"""Disk authority, atomic migration, original integrity and conflict boundaries."""
import base64
import json
from pathlib import Path
import tempfile
from unittest.mock import patch
from src.workspace_storage import WorkspaceStorage, WorkspaceError, CONTRACT, digest


def rejected(code, callback):
    try:
        callback()
        raise AssertionError("expected " + code)
    except WorkspaceError as error:
        assert error.code == code, (error.code, code)


with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    store = WorkspaceStorage(root)
    workspace, database = "a" * 32, "job-radar-local-first-v1"
    names = ["demo_candidate_items", "source_documents"]
    original = b"  source\x00\xff\n\n "
    record = {"source_document_id": "source-1", "filename": "resume.pdf", "file_blob": {"$blob": "base64", "data": base64.b64encode(original).decode(), "type": "application/pdf"}}
    # Real historical source shape: bare SHA-256, original_filename, extraction
    # fields and opaque unknown prose must survive alongside canonical sources.
    legacy_workspace = "c" * 32
    historical = {**record, "source_document_id": "legacy-source", "original_filename": "resume.pdf",
                  "content_hash": digest(original), "document_type": "resume", "extracted_pages": [],
                  "unknown_note": "  Historical wording\n\n ", "model_call_made": False}
    mixed = [historical, {**record, "content_hash": "sha256:" + digest(original)},
             {**historical, "source_document_id": "legacy-uppercase", "content_hash": digest(original).upper()}]
    mixed_writes = [{"store": "source_documents", "operation": "add", "value": row} for row in mixed]
    store.commit(legacy_workspace, database, {"source_documents": None}, mixed_writes, initialize=True)
    restored = store.read(legacy_workspace, database, ["source_documents"])
    assert {r["source_document_id"]: r for r in restored["stores"]["source_documents"]} == {r["source_document_id"]: r for r in mixed}
    unchanged_head = (root / legacy_workspace / "HEAD.json").read_bytes()
    staged_legacy = store.stage_blob(legacy_workspace, record["file_blob"], record["filename"])
    for blob in (record["file_blob"], staged_legacy):
        for invalid_hash in ("0" * 64, "sha256:" + "0" * 64, "sha256:wrong", "md5:" + digest(original), 123):
            rejected("WORKSPACE_SOURCE_HASH_MISMATCH", lambda: store.commit(legacy_workspace, database, restored["versions"],
                     [{"store": "source_documents", "operation": "put", "value": {**historical, "file_blob": blob, "content_hash": invalid_hash}}]))
            assert (root / legacy_workspace / "HEAD.json").read_bytes() == unchanged_head
    markdown = '---\n' + json.dumps({"format": "ariadne-markdown-v1", "record": {"item_id": "card-1", "title": None}, "fields": [["title"]], "fence": "```"}) + '\n---\n\n## title\n\n```text\nSame title\n```\n'
    card = {"item_id": "card-1", "content_format": "ariadne-markdown-v1", "markdown": markdown}
    writes = [{"store": "demo_candidate_items", "operation": "add", "value": card}, {"store": "source_documents", "operation": "add", "value": record}]
    with patch("src.workspace_storage.os.replace", side_effect=OSError("interrupted original write")):
        try:
            store.stage_blob(workspace, record["file_blob"], record["filename"])
            raise AssertionError("must fail")
        except OSError:
            pass
    assert not list((root / workspace).rglob("resume.pdf")), "partial bytes cannot occupy the final original path"
    assert list((root / workspace).rglob("*.tmp")), "interrupted artifacts remain for diagnosis"
    staged = store.stage_blob(workspace, record["file_blob"], record["filename"])
    assert staged["path"].endswith("/resume.pdf")
    assert not (root / workspace / "HEAD.json").exists(), "staging original bytes must not activate content"
    assert store.blob(workspace, staged) == record["file_blob"]
    staged_record = {**record, "file_blob": staged, "content_hash": "sha256:" + digest(original)}
    rejected("WORKSPACE_SOURCE_HASH_MISMATCH", lambda: store.commit(workspace, database, dict.fromkeys(names), [{"store": "source_documents", "operation": "add", "value": {**staged_record, "content_hash": "sha256:wrong"}}], initialize=True))
    assert not (root / workspace / "HEAD.json").exists()
    assert not store.read(workspace, database, names)["initialized"]
    saved = store._save_record
    def fail_second(*args):
        if args[2] == "source_documents":
            raise OSError("synthetic full disk")
        return saved(*args)
    with patch.object(store, "_save_record", side_effect=fail_second):
        try:
            store.commit(workspace, database, dict.fromkeys(names), writes, initialize=True)
            raise AssertionError("must fail")
        except OSError:
            pass
    assert not (root / workspace / "HEAD.json").exists(), "partial migration must never activate"
    store.commit(workspace, database, dict.fromkeys(names), writes, initialize=True)
    first = store.read(workspace, database, names)
    assert first["stores"] == {"demo_candidate_items": [card], "source_documents": [record]}
    # A point read verifies only the requested object and returns a lazy blob.
    with patch.object(store, "_load_record", wraps=store._load_record) as loaded:
        point = store.read_record(workspace, database, "source_documents", "source-1")
        assert loaded.call_count == 1
    assert point["record"]["file_blob"]["$blob"] == "file"
    assert store.blob(workspace, point["record"]["file_blob"]) == record["file_blob"]
    assert store.read_record(workspace, database, "source_documents", "missing")["record"] is None
    assert store.read_record(workspace, database, "demo_candidate_items", "card-1")["record"] == card
    rejected("WORKSPACE_STORE_INVALID", lambda: store.read_record(workspace, database, "private_files", "source-1"))
    rejected("WORKSPACE_RECORD_ID_INVALID", lambda: store.read_record(workspace, database, "source_documents", []))
    receipt = store.commit(workspace, database, first["versions"], [], transaction_id="1" * 32)
    assert store.commit(workspace, database, first["versions"], [], transaction_id="1" * 32) == receipt
    rejected("WORKSPACE_TRANSACTION_REUSED", lambda: store.commit(workspace, database, first["versions"], writes, transaction_id="1" * 32))
    rejected("WORKSPACE_ALREADY_INITIALIZED", lambda: store.commit(workspace, database, dict.fromkeys(names), [], initialize=True))
    manifest_before = (root / workspace / "HEAD.json").read_bytes()
    assert "Same title" not in manifest_before.decode(), "manifest must have no second semantic body"
    markdown_paths = list((root / workspace / "documents").rglob("*.md"))
    assert len(markdown_paths) == 1 and markdown_paths[0].read_text() == markdown
    assert next((root / workspace / "originals").rglob("resume.pdf")).read_bytes() == original
    changed = {**card, "markdown": markdown.replace("Same title", "New title")}
    store.commit(workspace, database, first["versions"], [{"store": "demo_candidate_items", "operation": "put", "value": changed}])
    assert markdown_paths[0].read_text() == markdown, "old file retained"
    rejected("WORKSPACE_VERSION_CONFLICT", lambda: store.commit(workspace, database, first["versions"], writes))
    latest = store.read(workspace, database, names)
    rejected("WORKSPACE_RECORD_EXISTS", lambda: store.commit(workspace, database, latest["versions"], writes))
    assert store.read(workspace, database, names) == latest
    # Losing a referenced original prevents its restoration, never an empty blob.
    binary = next((root / workspace / "originals").rglob("resume.pdf"))
    binary.write_bytes(b"changed")
    rejected("WORKSPACE_FILE_CHANGED", lambda: store.read(workspace, database, names))
    rejected("WORKSPACE_FILE_CHANGED", lambda: store.blob(workspace, point["record"]["file_blob"]))
    binary.write_bytes(original)
    # Explicit deletion changes only the current index; originals/history persist.
    store.commit(workspace, database, latest["versions"], [{"store": "demo_candidate_items", "operation": "delete", "key": "card-1"}])
    assert not store.read(workspace, database, names)["stores"]["demo_candidate_items"]
    assert markdown_paths[0].exists() and binary.exists()
    rejected("WORKSPACE_ID_INVALID", lambda: store.read("../../private", database, names))
    rejected("WORKSPACE_STORE_INVALID", lambda: store.read(workspace, database, ["private_files"]))
    other = store.read("b" * 32, database, names)
    assert not other["initialized"], "workspaces never merge by filename or title"
print("PASS workspace files: atomic migration, originals, no semantic mirror, history, corruption, conflicts, scope")
