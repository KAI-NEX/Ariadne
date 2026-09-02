"use strict";

(function attachLocalContextLifecycle(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneLocalContextLifecycle = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createLocalContextLifecycle() {
  const hex = (buffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
  const extensionFor = (name) => String(name || "").split(".").pop()?.toLowerCase() || "";

  async function sha256(bytes) {
    if (!globalThis.crypto?.subtle) throw new Error("sha256_unavailable");
    return hex(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  }

  async function prepareFileSource(file, { batchId, namespace, allowedExtensions }) {
    const extension = extensionFor(file?.name);
    if (!file || !allowedExtensions.includes(extension)) throw new Error("unsupported_document_type");
    const bytes = await file.arrayBuffer();
    const hash = await sha256(bytes);
    return Object.freeze({
      source_document_id: `source-${namespace}-${hash}`,
      content_hash: `sha256:${hash}`,
      batch_id: batchId,
      file,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      extension,
      source_type: "BROWSER_FILE_METADATA",
    });
  }

  async function prepareTextSource(text, { batchId, namespace, name = "pasted-text.txt" }) {
    const normalized = String(text || "").trim();
    if (!normalized) throw new Error("source_text_required");
    const bytes = new TextEncoder().encode(normalized);
    const hash = await sha256(bytes);
    return Object.freeze({
      source_document_id: `source-${namespace}-${hash}`,
      content_hash: `sha256:${hash}`,
      batch_id: batchId,
      text: normalized,
      name,
      type: "text/plain",
      size: bytes.byteLength,
      extension: "txt",
      source_type: "PASTED_TEXT_METADATA",
    });
  }

  function uniqueSources(sources) {
    return [...new Map((sources || []).map((source) => [source.source_document_id, source])).values()];
  }

  function deriveSourceState({ sourceExists, hasPending, hasActive, lastRunStatus }) {
    if (!sourceExists) return "NEW";
    if (hasPending) return "PENDING_REVIEW";
    if (hasActive) return "ACTIVE";
    if (["FAILED", "CANCELLED"].includes(lastRunStatus)) return "RETRY";
    return "RETRY";
  }

  function recordsForSource(records, sourceId, sourceIdFor) {
    return (records || []).filter((record) => sourceIdFor(record) === sourceId);
  }

  return Object.freeze({ sha256, prepareFileSource, prepareTextSource, uniqueSources, deriveSourceState, recordsForSource });
}));
