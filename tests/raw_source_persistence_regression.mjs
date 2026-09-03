import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Truth = require("../public/truth-persistence-domain.js");
const RawSource = require("../public/raw-source-storage-domain.js");
const Local = require("../public/local-candidate-extraction-domain.js");
const Review = require("../public/local-candidate-review-domain.js");
const CareerDomain = require("../public/career-evidence-domain.js");

const KEY_FIELDS = {
  source_documents: "source_document_id",
  runtime_snapshots: "snapshot_id",
  extraction_artifacts: "artifact_id",
  processing_runs: "run_id",
  processing_batches: "batch_id",
  context_proposals: "proposal_id",
  context_review_decisions: "review_id",
  candidate_context_revisions: "revision_id",
  candidate_context_lifecycle: "lifecycle_id",
  job_context_revisions: "revision_id",
};

function memoryDatabase() {
  const records = new Map(Object.keys(KEY_FIELDS).map((name) => [name, new Map()]));
  const database = {
    records,
    failWrites: false,
    transaction(requestedStores, mode = "readonly") {
      const storeNames = Array.isArray(requestedStores) ? requestedStores : [requestedStores];
      const working = new Map(storeNames.map((name) => [name, new Map(records.get(name) || [])]));
      let completionQueued = false;
      let ended = false;
      const transaction = {
        error: null,
        abort() {
          if (ended) return;
          ended = true;
          queueMicrotask(() => transaction.onabort?.());
        },
        objectStore(name) {
          if (!storeNames.includes(name)) throw new Error(`store_not_in_transaction:${name}`);
          const values = working.get(name);
          const keyField = KEY_FIELDS[name];
          const complete = () => {
            if (completionQueued || ended) return;
            completionQueued = true;
            queueMicrotask(() => {
              if (ended) return;
              if (database.failWrites) {
                ended = true;
                transaction.error = new Error("synthetic_raw_storage_failure");
                transaction.onerror?.();
                transaction.onabort?.();
                return;
              }
              working.forEach((items, storeName) => records.set(storeName, items));
              ended = true;
              transaction.oncomplete?.();
            });
          };
          return {
            get(key) {
              const request = {};
              queueMicrotask(() => { request.result = values.get(key); request.onsuccess?.(); });
              return request;
            },
            getAll() {
              const request = {};
              queueMicrotask(() => { request.result = [...values.values()].map((value) => structuredClone(value)); request.onsuccess?.(); });
              return request;
            },
            put(value) {
              values.set(value[keyField], structuredClone(value));
              complete();
            },
            add(value) {
              const key = value[keyField];
              if (values.has(key)) throw new Error(`duplicate_key:${key}`);
              values.set(key, structuredClone(value));
              complete();
            },
            delete(key) {
              values.delete(key);
              complete();
            },
          };
        },
      };
      return transaction;
    },
  };
  return database;
}

function exactFile(name, bytes, type) {
  return new File([Uint8Array.from(bytes)], name, { type, lastModified: 1_700_000_000_000 });
}

const fixtures = [
  exactFile("resume.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], "application/pdf"),
  exactFile("portfolio.docx", [0x50, 0x4b, 0x03, 0x04, 0x11, 0x22], "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
  exactFile("portrait.png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], "image/png"),
  exactFile("portrait.jpg", [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], "image/jpeg"),
  exactFile("notes.txt", [0x20, 0x72, 0x61, 0x77, 0x0a, 0x20], "text/plain"),
  exactFile("notes.md", [0x23, 0x20, 0x52, 0x61, 0x77, 0x0a], "text/markdown"),
];

const database = memoryDatabase();
const sources = [];
for (const [index, file] of fixtures.entries()) {
  const prepared = await Local.prepareSource(file, "batch-shared", "Resume");
  const source = Local.sourceDocumentFor(prepared, `2026-09-02T20:00:0${index}Z`);
  const resolved = await RawSource.persistDurableSource(database, source, file);
  assert.equal(resolved.metadata.content_hash, source.content_hash);
  assert.deepEqual(new Uint8Array(await resolved.blob.arrayBuffer()), new Uint8Array(await file.arrayBuffer()));
  assert.equal(RawSource.parseLocalReference(source.local_reference).record_id, RawSource.payloadRecordIdFor(source.source_document_id));
  assert.equal(Object.hasOwn(database.records.get("source_documents").get(source.source_document_id), "file_blob"), false);
  sources.push({ prepared, source, file });
}
assert.equal(database.records.get("source_documents").size, fixtures.length * 2);

// A fresh module/runtime resolves only from SourceDocument + IndexedDB-backed records.
delete require.cache[require.resolve("../public/raw-source-storage-domain.js")];
const ReloadedRawSource = require("../public/raw-source-storage-domain.js");
const reloaded = await ReloadedRawSource.resolveRawSource(database, sources[0].source.source_document_id);
assert.deepEqual(new Uint8Array(await reloaded.blob.arrayBuffer()), new Uint8Array(await sources[0].file.arrayBuffer()));

// Exact-source dedupe reuses one canonical identity and one raw payload envelope.
const beforeDedupeCount = database.records.get("source_documents").size;
const renamedDuplicate = exactFile("renamed.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31], "application/pdf");
const duplicatePrepared = await Local.prepareSource(renamedDuplicate, "batch-later", "Other");
assert.equal(duplicatePrepared.source_document_id, sources[0].source.source_document_id);
await RawSource.persistDurableSource(database, Local.sourceDocumentFor(duplicatePrepared), renamedDuplicate);
assert.equal(database.records.get("source_documents").size, beforeDedupeCount);

// Legacy File/Blob records and canonical payload envelopes remain independently keyed and discriminated.
database.records.get("source_documents").set("legacy-source", { source_document_id: "legacy-source", original_filename: "legacy.pdf", file_blob: fixtures[0] });
assert.equal(database.records.get("source_documents").get("legacy-source").record_type, undefined);
assert(RawSource.isPayloadRecord(database.records.get("source_documents").get(RawSource.payloadRecordIdFor(sources[0].source.source_document_id))));
const exported = CareerDomain.buildEntityExport([], [...database.records.get("source_documents").values()], [], new Date("2026-09-02T21:00:00Z"));
assert(exported.source_documents.every((record) => record.record_type !== RawSource.RECORD_TYPE && !Object.hasOwn(record, "file_blob")));

// Missing and corrupted payloads fail closed; no filename lookup or unrelated fallback is attempted.
const corruptedKey = RawSource.payloadRecordIdFor(sources[1].source.source_document_id);
const originalPayload = database.records.get("source_documents").get(corruptedKey);
database.records.get("source_documents").set(corruptedKey, { ...originalPayload, file_blob: exactFile(originalPayload.filename, [9, 9, 9, 9, 9, 9], originalPayload.mime_type) });
await assert.rejects(RawSource.resolveRawSource(database, sources[1].source), (error) => error.code === "raw_source_integrity_mismatch" && error.message === "raw source integrity mismatch");
database.records.get("source_documents").set(corruptedKey, originalPayload);
const missingKey = RawSource.payloadRecordIdFor(sources[2].source.source_document_id);
const missingPayload = database.records.get("source_documents").get(missingKey);
database.records.get("source_documents").delete(missingKey);
await assert.rejects(RawSource.resolveRawSource(database, sources[2].source), (error) => error.code === "raw_source_payload_missing");
database.records.get("source_documents").set(missingKey, missingPayload);

// Remove Card writes lifecycle state only; the underlying raw payload remains resolvable.
const candidateSource = sources[0].source;
const proposal = Truth.validateProposal({
  contract_id: "ariadne-context-proposal-v1",
  proposal_id: "proposal-raw-removal",
  proposal_type: "CANDIDATE_CONTEXT",
  source_document_ids: [candidateSource.source_document_id],
  processing_run_id: "run-raw-removal",
  runtime_snapshot_id: "runtime-snapshot-local-raw",
  status: "AWAITING_REVIEW",
  created_at: "2026-09-02T21:10:00Z",
  payload: { contract_id: "ariadne-local-candidate-proposal-payload-v1", extraction_artifact_id: "artifact-raw-removal", candidate_material_type: "resume", candidate_material_type_source: "USER_SELECTED", rule_profile: "career-entity-deterministic-v2", items: [{ item_id: "candidate-raw-removal", item_type: "PROJECT", title: "Raw persistence", subtitle: null, time: null, summary: null, facts: [], grounding_refs: [{ source_document_id: candidateSource.source_document_id, location: "p. 1", excerpt_or_reference: "Raw persistence" }], confidence: "medium", warnings: [], uncertainties: [], review_status: "NEEDS_REVIEW" }], manual_review_required: false, unstructured_evidence_reason: null },
  grounding_refs: [{ source_document_id: candidateSource.source_document_id, location: "p. 1", excerpt_or_reference: "Raw persistence" }],
  warnings: [],
  uncertainties: [],
  authority: Truth.AUTHORITY.proposal,
});
const revision = Review.outcomeFor({ proposal, decision: "CONFIRM", acceptedPayload: proposal.payload, currentRevision: null }).revision;
database.records.get("candidate_context_revisions").set(revision.revision_id, revision);
await Review.persistRemoval(database, revision, "candidate-raw-removal");
assert.equal((await RawSource.resolveRawSource(database, candidateSource)).metadata.content_hash, candidateSource.content_hash);

// Source-scoped hard delete removes A's raw payload, leaves same-batch B intact, and permits clean re-import.
await Review.persistSourceHardDelete(database, candidateSource.source_document_id);
await assert.rejects(RawSource.resolveRawSource(database, candidateSource.source_document_id), (error) => error.code === "raw_source_document_missing");
assert.equal((await RawSource.resolveRawSource(database, sources[1].source)).metadata.content_hash, sources[1].source.content_hash);
await RawSource.persistDurableSource(database, Local.sourceDocumentFor(sources[0].prepared), sources[0].file);
assert.equal((await RawSource.resolveRawSource(database, candidateSource.source_document_id)).metadata.content_hash, candidateSource.content_hash);

// A failed raw write transaction cannot leave a canonical source claiming durable success.
const failingDatabase = memoryDatabase();
failingDatabase.failWrites = true;
const failingPrepared = await Local.prepareSource(exactFile("failure.txt", [1, 2, 3], "text/plain"), "batch-failure", "Other");
const failingSource = Local.sourceDocumentFor(failingPrepared);
await assert.rejects(RawSource.persistDurableSource(failingDatabase, failingSource, failingPrepared.file), /synthetic_raw_storage_failure/);
assert.equal(failingDatabase.records.get("source_documents").size, 0);

const rawModuleText = fs.readFileSync(path.join(root, "public", "raw-source-storage-domain.js"), "utf8");
assert.doesNotMatch(rawModuleText, /\bfetch\s*\(|XMLHttpRequest|Provider|MODEL_CALL/);
assert.match(fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8"), /sourceForExtraction = \{ \.\.\.source, file: durableSource\.file \}/);

console.log(JSON.stringify({
  raw_write_read_types: fixtures.length,
  reload_resolve: "pass",
  hash_revalidation: "pass",
  canonical_byte_free: "pass",
  legacy_coexistence: "pass",
  remove_card_keeps_raw: "pass",
  source_hard_delete_isolated: "pass",
  hard_delete_reimport: "pass",
  storage_failure_atomic: "pass",
  provider_calls: 0,
}));
