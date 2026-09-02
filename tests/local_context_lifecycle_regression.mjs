import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Lifecycle = require("../public/local-context-lifecycle-domain.js");
const JobLifecycle = require("../public/local-job-lifecycle-domain.js");

const file = (name, text) => {
  const bytes = new TextEncoder().encode(text);
  return { name, type: "application/pdf", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};

const batchId = "batch-a-b";
const [sourceA, duplicateA, sourceB] = await Promise.all([
  Lifecycle.prepareFileSource(file("A.pdf", "source A"), { batchId, namespace: "candidate", allowedExtensions: ["pdf"] }),
  Lifecycle.prepareFileSource(file("A-copy.pdf", "source A"), { batchId, namespace: "candidate", allowedExtensions: ["pdf"] }),
  Lifecycle.prepareFileSource(file("B.pdf", "source B"), { batchId, namespace: "candidate", allowedExtensions: ["pdf"] }),
]);
assert.equal(sourceA.source_document_id, duplicateA.source_document_id);
assert.notEqual(sourceA.source_document_id, sourceB.source_document_id);
assert.deepEqual(Lifecycle.uniqueSources([sourceA, duplicateA, sourceB]).map((source) => source.source_document_id), [sourceA.source_document_id, sourceB.source_document_id]);
assert.equal(sourceA.batch_id, sourceB.batch_id);
assert.equal(Lifecycle.deriveSourceState({ sourceExists: false }), "NEW");
assert.equal(Lifecycle.deriveSourceState({ sourceExists: true, hasPending: true }), "PENDING_REVIEW");
assert.equal(Lifecycle.deriveSourceState({ sourceExists: true, hasPending: false, hasActive: true }), "ACTIVE");
assert.equal(Lifecycle.deriveSourceState({ sourceExists: true, hasPending: false, hasActive: false, lastRunStatus: "FAILED" }), "RETRY");

const jobDraft = (id, source, status = "NEEDS_REVIEW") => ({
  job_context_id: id,
  title: id,
  company: "Example",
  location: "Remote",
  summary: "Lifecycle fixture only",
  requirements: [],
  imported_from: { source_document_id: source.source_document_id, content_hash: source.content_hash, batch_id: source.batch_id, name: source.name },
  review_status: status,
  import_status: status === "CONFIRMED" ? "ACTIVE" : "PENDING_REVIEW",
});
const storageRecords = new Map([
  ["job-a", jobDraft("job-a", sourceA)],
  ["job-a-2", jobDraft("job-a-2", sourceA, "CONFIRMED")],
  ["job-b", jobDraft("job-b", sourceB, "CONFIRMED")],
]);
const storage = {
  async get(_store, id) { return structuredClone(storageRecords.get(id) || null); },
  async getAll() { return [...storageRecords.values()].map((record) => structuredClone(record)); },
  async put(_store, record) { storageRecords.set(record.job_context_id, structuredClone(record)); },
  async persistJobImport(record) { storageRecords.set(record.job_context_id, structuredClone(record)); },
  async remove(store, id) { if (store !== "source_documents") storageRecords.delete(id); },
};

assert.equal(JobLifecycle.sourceImportState(sourceA.source_document_id, await storage.getAll()), "PENDING_REVIEW");
assert.equal(JobLifecycle.sourceImportState(sourceB.source_document_id, await storage.getAll()), "ACTIVE");
assert.deepEqual(JobLifecycle.pendingJobs(await storage.getAll()).map((job) => job.job_context_id), ["job-a"]);
assert.deepEqual(JobLifecycle.libraryJobs(await storage.getAll()).map((job) => job.job_context_id).sort(), ["job-a-2", "job-b"]);

const proposed = JobLifecycle.pendingJob({ ...jobDraft("job-new", sourceB), imported_from: undefined }, sourceB);
assert.equal(proposed.imported_from.source_document_id, sourceB.source_document_id);
assert.equal(proposed.imported_from.batch_id, batchId);
assert.equal(proposed.imported_from.network_sent, false);
assert.equal(proposed.imported_from.content_read_for_identity_only, true);
assert.equal(proposed.review_status, "NEEDS_REVIEW");
assert.equal(JSON.stringify(proposed).match(/provider|model_metadata|review_decision|revision_id/), null);
const persistedDraft = await JobLifecycle.persistPendingImport(storage, { ...jobDraft("job-new", sourceB), imported_from: undefined }, sourceB);
assert.equal(storageRecords.get(persistedDraft.job_context_id).review_status, "NEEDS_REVIEW");

const confirmed = await JobLifecycle.confirm(storage, "jobs", storageRecords.get("job-a"), { ...storageRecords.get("job-a"), title: "Confirmed A" });
assert.equal(confirmed.review_status, "CONFIRMED");
assert.equal(storageRecords.get("job-a").title, "Confirmed A");
assert.deepEqual(JobLifecycle.pendingJobs(await storage.getAll()).map((job) => job.job_context_id), ["job-new"]); // The queue remains open for the other source.
await JobLifecycle.reject(storage, "jobs", "job-a-2");
assert.equal(storageRecords.has("job-a-2"), false);
const removedB = await JobLifecycle.removeCard(storage, "jobs", "job-b");
assert.equal(removedB.review_status, "REMOVED");
assert.equal(JobLifecycle.libraryJobs(await storage.getAll()).some((job) => job.job_context_id === "job-b"), false);
await JobLifecycle.reject(storage, "jobs", "job-new");
assert.equal(JobLifecycle.pendingJobs(await storage.getAll()).length, 0); // Completion is possible only after every pending source is resolved.

// A and B share batch_id, but hard delete is rooted at exact source_document_id.
const plan = await JobLifecycle.hardDeleteSource(storage, "jobs", sourceA.source_document_id);
assert.deepEqual(plan.removed_job_context_ids, ["job-a"]);
assert.equal(storageRecords.has("job-a"), false);
assert.equal(storageRecords.get("job-b").review_status, "REMOVED");
assert.equal(storageRecords.get("job-b").imported_from.source_document_id, sourceB.source_document_id);

console.log("local_context_lifecycle=pass");
