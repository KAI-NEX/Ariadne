"use strict";

(function attachLocalJobLifecycle(root, factory) {
  const lifecycle = root.AriadneLocalContextLifecycle || (typeof module === "object" && module.exports ? require("./local-context-lifecycle-domain.js") : null);
  const api = factory(lifecycle);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneLocalJobLifecycle = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createLocalJobLifecycle(Lifecycle) {
  if (!Lifecycle) throw new Error("local_context_lifecycle_required");

  function sourceIdFor(job) {
    return job?.imported_from?.source_document_id || job?.source_document_id || `legacy-job-source-${job?.job_context_id || "unknown"}`;
  }

  function isManagedDraft(job) { return Boolean(job?.imported_from?.source_document_id); }
  function pendingJobs(jobs) { return (jobs || []).filter((job) => isManagedDraft(job) && job.review_status === "NEEDS_REVIEW"); }
  function libraryJobs(jobs) { return (jobs || []).filter((job) => job.review_status !== "REMOVED" && (!isManagedDraft(job) || job.review_status === "CONFIRMED")); }

  function sourceImportState(sourceId, jobs) {
    const related = Lifecycle.recordsForSource(jobs, sourceId, sourceIdFor);
    return Lifecycle.deriveSourceState({
      sourceExists: related.length > 0,
      hasPending: related.some((job) => job.review_status === "NEEDS_REVIEW"),
      hasActive: related.some((job) => job.review_status === "CONFIRMED"),
      lastRunStatus: related.at(-1)?.import_status || null,
    });
  }

  function pendingJob(job, source) {
    return Object.freeze({
      ...structuredClone(job),
      imported_from: {
        source_document_id: source.source_document_id,
        content_hash: source.content_hash,
        batch_id: source.batch_id,
        source_type: source.source_type,
        name: source.name,
        type: source.type,
        size: source.size,
        extension: source.extension,
        source_url: source.source_url || null,
        recognition_mode: "LOCAL_DEMO",
        content_read_for_identity_only: true,
        network_sent: false,
      },
      review_status: "NEEDS_REVIEW",
      import_status: "PENDING_REVIEW",
    });
  }

  async function persistPendingImport(storage, job, source) {
    const draft = pendingJob(job, source);
    await storage.persistJobImport(draft, source);
    return draft;
  }

  async function confirm(storage, storeName, job, editedJob = job) {
    const confirmed = { ...structuredClone(editedJob), review_status: "CONFIRMED", import_status: "ACTIVE", confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await storage.put(storeName, confirmed);
    return confirmed;
  }

  async function reject(storage, storeName, jobId) {
    await storage.remove(storeName, jobId);
  }

  async function removeCard(storage, storeName, jobId) {
    const job = await storage.get(storeName, jobId);
    if (!job) throw new Error("job_context_not_found");
    const removed = { ...structuredClone(job), review_status: "REMOVED", import_status: "REMOVED", removed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    await storage.put(storeName, removed);
    return removed;
  }

  async function hardDeleteSource(storage, storeName, sourceId, sourceStoreName = "source_documents") {
    const jobs = await storage.getAll(storeName);
    const related = Lifecycle.recordsForSource(jobs, sourceId, sourceIdFor);
    if (!related.length) throw new Error("job_source_not_found");
    if (typeof storage.openDatabase === "function") {
      const database = await storage.openDatabase();
      try {
        await new Promise((resolve, reject) => {
          const transaction = database.transaction([storeName, sourceStoreName], "readwrite");
          related.forEach((job) => transaction.objectStore(storeName).delete(job.job_context_id));
          transaction.objectStore(sourceStoreName).delete(sourceId);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error || new Error("job_source_delete_failed"));
          transaction.onabort = () => reject(transaction.error || new Error("job_source_delete_aborted"));
        });
        return Object.freeze({ source_document_id: sourceId, removed_job_context_ids: related.map((job) => job.job_context_id) });
      } finally { database.close(); }
    }
    await Promise.all(related.map((job) => storage.remove(storeName, job.job_context_id)));
    await storage.remove(sourceStoreName, sourceId);
    return Object.freeze({ source_document_id: sourceId, removed_job_context_ids: related.map((job) => job.job_context_id) });
  }

  return Object.freeze({ sourceIdFor, isManagedDraft, pendingJobs, libraryJobs, sourceImportState, pendingJob, persistPendingImport, confirm, reject, removeCard, hardDeleteSource });
}));
