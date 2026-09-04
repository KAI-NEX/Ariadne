"use strict";

(function attachLocalJobExtraction(root, factory) {
  const truth = root.AriadneTruthPersistence
    || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const rawSource = root.AriadneRawSourceStorage
    || (typeof module === "object" && module.exports ? require("./raw-source-storage-domain.js") : null);
  const api = factory(truth, rawSource);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneLocalJobExtraction = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createLocalJobExtraction(Truth, RawSource) {
  if (!Truth || !RawSource) throw new Error("local_job_extraction_dependencies_required");

  const MAX_DOCUMENT_BYTES = 8_000_000;
  const MAX_IMAGE_BYTES = 5_000_000;
  const MIME_BY_EXTENSION = Object.freeze({
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  });
  const SOURCE_TYPE_BY_MIME = Object.freeze({
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "text/plain": "PASTED_TEXT",
    "image/png": "IMAGE",
    "image/jpeg": "IMAGE",
  });

  class LocalJobExtractionError extends Error {
    constructor(code) { super(code); this.name = "LocalJobExtractionError"; this.code = code; }
  }

  const nowIso = () => new Date().toISOString();
  const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

  function mediaTypeForFile(file) {
    const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
    const mediaType = MIME_BY_EXTENSION[extension];
    if (!mediaType) throw new LocalJobExtractionError("unsupported_document_type");
    return mediaType;
  }

  function assertFileSize(file, mediaType) {
    const maximum = SOURCE_TYPE_BY_MIME[mediaType] === "IMAGE" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
    if (!Number.isFinite(file?.size) || file.size <= 0) throw new LocalJobExtractionError("invalid_document_size");
    if (file.size > maximum) throw new LocalJobExtractionError(SOURCE_TYPE_BY_MIME[mediaType] === "IMAGE" ? "image_size_limit_exceeded" : "document_size_limit_exceeded");
  }

  async function sha256File(file) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  async function prepareSource(file, batchId, options = {}) {
    const mimeType = mediaTypeForFile(file);
    const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
    assertFileSize(file, mimeType);
    const contentHash = await sha256File(file);
    return Object.freeze({
      file,
      name: file.name,
      type: mimeType,
      size: file.size,
      extension,
      mime_type: mimeType,
      source_type: options.pasted === true ? "PASTED_TEXT" : SOURCE_TYPE_BY_MIME[mimeType],
      content_hash: contentHash,
      source_document_id: `source-job-${contentHash.slice(7)}`,
      batch_id: batchId,
      source_url: options.source_url || null,
      captured_via: options.pasted === true ? "JOB_TEXTAREA" : "JOB_FILE_PICKER",
    });
  }

  function pastedTextFile(text, name = "pasted-job-description.txt") {
    const normalized = String(text || "").trim();
    if (!normalized) throw new LocalJobExtractionError("source_text_required");
    if (typeof File === "function") return new File([normalized], name, { type: "text/plain", lastModified: 0 });
    const blob = new Blob([normalized], { type: "text/plain" });
    Object.defineProperty(blob, "name", { value: name, enumerable: true });
    return blob;
  }

  async function preparePastedText(text, batchId, sourceUrl = null) {
    return prepareSource(pastedTextFile(text), batchId, { pasted: true, source_url: sourceUrl });
  }

  function sourceDocumentFor(source, createdAt = nowIso()) {
    return Truth.validateSourceDocument({
      contract_id: "ariadne-source-document-v1",
      source_document_id: source.source_document_id,
      source_type: source.source_type,
      filename: source.file.name,
      label: null,
      mime_type: source.mime_type,
      content_hash: source.content_hash,
      created_at: createdAt,
      material_type: "JOB",
      local_reference: RawSource.localReferenceFor(source.source_document_id),
      batch_id: source.batch_id,
      provenance: {
        supplied_by: "USER",
        captured_via: source.captured_via,
        source_url: source.source_url,
        raw_source_recoverability: "DURABLE_BROWSER_LOCAL",
      },
      authority: Truth.AUTHORITY.source,
    });
  }

  function processingRunFor(source, snapshotId, status = "PENDING", patch = {}) {
    const timestamp = patch.timestamp || nowIso();
    const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
    return Truth.validateProcessingRun({
      contract_id: "ariadne-processing-run-v1",
      run_id: patch.run_id || id("run-job-extraction"),
      operation_type: "JOB_LOCAL_EXTRACTION",
      source_document_id: source.source_document_id,
      batch_id: source.batch_id,
      runtime_snapshot_id: snapshotId,
      started_at: status === "PENDING" ? null : (patch.started_at || timestamp),
      finished_at: terminal ? (patch.finished_at || timestamp) : null,
      status,
      error_code: patch.error_code || null,
      output_artifact_ids: patch.output_artifact_ids || [],
      proposal_ids: [],
      authority: Truth.AUTHORITY.execution,
    });
  }

  function sourceRefsFor(result, sourceId) {
    const refs = (result.document_blocks || []).slice(0, 160).map((block) => ({
      source_document_id: sourceId,
      location: Number.isInteger(block.page) ? `p. ${block.page}` : "document",
      excerpt_or_reference: String(block.text || "").trim(),
    })).filter((entry) => entry.excerpt_or_reference);
    return refs.length ? refs : [{ source_document_id: sourceId, location: "document", excerpt_or_reference: "No extractable text" }];
  }

  function artifactFor(source, run, result, createdAt = nowIso()) {
    return Truth.validateExtractionArtifact({
      contract_id: "ariadne-extraction-artifact-v1",
      artifact_id: id("artifact-job-extraction"),
      source_document_id: source.source_document_id,
      processing_run_id: run.run_id,
      extraction_method: String(result.extraction_method || "local_job_extraction"),
      payload: {
        pages: Array.isArray(result.pages) ? result.pages : [],
        document_blocks: Array.isArray(result.document_blocks) ? result.document_blocks : [],
        extracted_text: String(result.extracted_text || ""),
        byte_size: Number(result.byte_size) || 0,
        processing_boundary: String(result.processing_boundary || "localhost_transient_job_extraction"),
        material_type: "JOB",
      },
      source_refs: sourceRefsFor(result, source.source_document_id),
      quality: { page_count: Array.isArray(result.pages) ? result.pages.length : 0, local_ocr: String(result.extraction_method || "").includes("vision") },
      warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : [],
      errors: [],
      created_at: createdAt,
      authority: Truth.AUTHORITY.extraction,
    });
  }

  async function readAsDataURL(file, mediaType = mediaTypeForFile(file)) {
    if (typeof FileReader === "function") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new LocalJobExtractionError("document_read_failed"));
        reader.readAsDataURL(new Blob([file], { type: mediaType }));
      });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
  }

  function requestPayload(source, runtimeSnapshot) {
    return readAsDataURL(source.file, source.mime_type).then((documentDataUrl) => ({
      filename: source.file.name,
      media_type: source.mime_type,
      source_document_id: source.source_document_id,
      document_data_url: documentDataUrl,
      runtime_snapshot: runtimeSnapshot,
    }));
  }

  return Object.freeze({
    MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, MIME_BY_EXTENSION, SOURCE_TYPE_BY_MIME, LocalJobExtractionError,
    mediaTypeForFile, assertFileSize, sha256File, prepareSource, pastedTextFile, preparePastedText,
    sourceDocumentFor, processingRunFor, sourceRefsFor, artifactFor, readAsDataURL, requestPayload,
    persistCanonicalSource: RawSource.persistDurableSource,
    resolveRawSource: RawSource.resolveRawSource,
  });
}));
