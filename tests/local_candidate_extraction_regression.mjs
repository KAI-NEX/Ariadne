import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Runtime = require("../public/runtime-capabilities.js");
const Truth = require("../public/truth-persistence-domain.js");
const Local = require("../public/local-candidate-extraction-domain.js");
const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");

function file(name, text, type = "text/plain") {
  const bytes = new TextEncoder().encode(text);
  return { name, type, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

const batchId = "batch-candidate-test";
const first = await Local.prepareSource(file("one.txt", "real source one"), batchId);
const second = await Local.prepareSource(file("two.md", "# real source two"), batchId);
assert.notEqual(first.content_hash, second.content_hash);
assert.match(first.source_document_id, /^source-candidate-[a-f0-9]{64}$/);

const snapshot = Runtime.createRuntimeSnapshot({ mode: "local" }, {
  snapshotId: "runtime-snapshot-candidate-batch",
  capturedAt: "2026-09-02T10:00:00Z",
  environmentCapabilities: { local_ocr: "unsupported" },
});
const firstRun = Local.processingRunFor(first, snapshot.snapshot_id, "PENDING", "2026-09-02T10:00:01Z");
const secondRun = Local.processingRunFor(second, snapshot.snapshot_id, "PENDING", "2026-09-02T10:00:01Z");
assert.equal(firstRun.runtime_snapshot_id, snapshot.snapshot_id);
assert.equal(secondRun.runtime_snapshot_id, snapshot.snapshot_id);
const changedCurrentRuntime = Runtime.createRuntimeSnapshot({ mode: "local" }, { snapshotId: "runtime-snapshot-later", capturedAt: "2026-09-02T10:00:02Z", environmentCapabilities: { local_ocr: "supported" } });
assert.notEqual(changedCurrentRuntime.snapshot_id, secondRun.runtime_snapshot_id);

const source = Local.sourceDocumentFor(first, "2026-09-02T10:00:00Z");
assert.equal(source.local_reference, null);
assert.equal(source.authority, Truth.AUTHORITY.source);
await assert.rejects(
  Local.prepareSource({ ...first.file, size: Local.MAX_DOCUMENT_BYTES + 1 }, batchId),
  /invalid_document_size/,
);

const artifact = Local.artifactFor(first, { ...firstRun, status: "RUNNING", started_at: "2026-09-02T10:00:01Z" }, {
  pages: [{ page: 1, lines: ["real source one"], source_method: "native_document" }],
  document_blocks: [{ page: 1, text: "real source one" }],
  extracted_text: "real source one",
  extraction_method: "utf8_text_v0",
  byte_size: first.file.size,
  warnings: [],
  processing_boundary: "localhost_transient_candidate_extraction",
}, "2026-09-02T10:00:03Z");
assert.equal(artifact.authority, Truth.AUTHORITY.extraction);
assert.equal(artifact.source_document_id, first.source_document_id);

const cancelled = Local.batchFor([first, second], "CANCELLED", "2026-09-02T10:00:04Z", {
  completed_source_ids: [first.source_document_id],
  cancelled_source_id: second.source_document_id,
  not_started_source_ids: [],
});
assert.equal(cancelled.status, "CANCELLED");
assert.deepEqual(cancelled.completed_source_ids, [first.source_document_id]);

const legacyDatabase = {
  transaction() {
    return { objectStore() { return { get() { const request = {}; queueMicrotask(() => { request.result = { source_document_id: first.source_document_id, file_blob: "legacy" }; request.onsuccess?.(); }); return request; } }; } };
  },
};
await assert.rejects(Local.persistCanonicalSource(legacyDatabase, source), /source_document_legacy_collision/);

function memoryDatabase() {
  const specs = new Map(Truth.STORE_SPECS.map((spec) => [spec.name, spec]));
  const records = new Map([...specs].map(([name]) => [name, new Map()]));
  return {
    records,
    transaction() {
      let completionQueued = false;
      const tx = {
        objectStore(name) {
          const spec = specs.get(name);
          const complete = () => {
            if (completionQueued) return;
            completionQueued = true;
            queueMicrotask(() => tx.oncomplete?.());
          };
          return {
            get(key) { const request = {}; queueMicrotask(() => { request.result = records.get(name).get(key); request.onsuccess?.(); }); return request; },
            put(value) { records.get(name).set(value[spec.keyPath], structuredClone(value)); complete(); },
            add(value) { records.get(name).set(value[spec.keyPath], structuredClone(value)); complete(); },
          };
        },
      };
      return tx;
    },
  };
}

const memoryDb = memoryDatabase();
await Local.persistCanonicalSource(memoryDb, source);
await Truth.persistRecord(memoryDb, "runtime_snapshots", snapshot);
await Truth.persistRecord(memoryDb, "processing_runs", { ...firstRun, status: "SUCCEEDED", started_at: "2026-09-02T10:00:01Z", finished_at: "2026-09-02T10:00:03Z", output_artifact_ids: [artifact.artifact_id] });
await Truth.persistRecord(memoryDb, "extraction_artifacts", artifact);
assert.equal(memoryDb.records.get("context_proposals").size, 0);
assert.equal(memoryDb.records.get("candidate_context_revisions").size, 0);

assert.doesNotMatch(pages, /Demo\.createLocalCandidateFixtures\(/);
assert.doesNotMatch(pages, /Demo\.persistCandidateImport\(/);
assert.doesNotMatch(pages, /Demo\.findCandidateDuplicates\(/);
assert.match(pages, /createRuntimeSnapshot\(\s*\{ mode: "local" \}/);
assert.match(pages, /runtime_snapshot: snapshot/);
assert.match(pages, /local-candidate-image-ocr/);
assert.doesNotMatch(pages, /fetch\("\/api\/local-ocr"/);
assert.match(pages, /cancelled_source_id: source\.source_document_id/);
assert.match(pages, /not_started_source_ids: sources\.slice\(index \+ 1\)\.map/);
assert.match(pages, /if \(result\.cancelled\) \{[\s\S]*?return;/);

console.log(JSON.stringify({
  batch_runtime_snapshot: "pass",
  source_namespace_collision_protection: "pass",
  extraction_artifact_only: "pass",
  no_fixture_candidate_path: "pass",
  no_jd_ocr_dependency: "pass",
  proposal_count: 0,
  candidate_revision_count: 0,
}));
