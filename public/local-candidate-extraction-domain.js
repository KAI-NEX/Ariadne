"use strict";

(function attachLocalCandidateExtraction(root, factory) {
  const truth = root.AriadneTruthPersistence
    || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const api = factory(truth);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneLocalCandidateExtraction = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createLocalCandidateExtraction(Truth) {
  if (!Truth) throw new Error("truth_persistence_required");

  const MAX_DOCUMENT_BYTES = 8_000_000;
  const MAX_IMAGE_BYTES = 5_000_000;
  const MIME_BY_EXTENSION = Object.freeze({
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  });
  const SOURCE_TYPE_BY_MIME = Object.freeze({
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "text/plain": "TXT",
    "text/markdown": "MARKDOWN",
    "image/png": "IMAGE",
    "image/jpeg": "IMAGE",
  });
  const CANDIDATE_MATERIAL_TYPES = Object.freeze({
    Resume: "resume",
    Portfolio: "portfolio",
    Project: "project_description",
    Other: "other",
  });

  class LocalCandidateExtractionError extends Error {
    constructor(code) { super(code); this.name = "LocalCandidateExtractionError"; this.code = code; }
  }

  const now = () => new Date().toISOString();
  const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

  function mediaTypeForFile(file) {
    const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
    const mediaType = MIME_BY_EXTENSION[extension];
    if (!mediaType) throw new LocalCandidateExtractionError("unsupported_document_type");
    return mediaType;
  }

  function sourceTypeForMediaType(mediaType) {
    const sourceType = SOURCE_TYPE_BY_MIME[mediaType];
    if (!sourceType) throw new LocalCandidateExtractionError("unsupported_document_type");
    return sourceType;
  }

  function assertFileSize(file, mediaType) {
    const maximum = SOURCE_TYPE_BY_MIME[mediaType] === "IMAGE" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
    if (!Number.isFinite(file?.size) || file.size <= 0 || file.size > maximum) throw new LocalCandidateExtractionError("invalid_document_size");
  }

  async function sha256File(file) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  async function readAsDataURL(file, mediaType = mediaTypeForFile(file)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new LocalCandidateExtractionError("document_read_failed"));
      reader.readAsDataURL(new Blob([file], { type: mediaType }));
    });
  }

  async function prepareSource(file, batchId, selectedMaterialType) {
    const mimeType = mediaTypeForFile(file);
    assertFileSize(file, mimeType);
    const contentHash = await sha256File(file);
    const hashValue = contentHash.replace(/^sha256:/, "");
    const sourceDocumentId = `source-candidate-${hashValue}`;
    const candidateMaterialType = CANDIDATE_MATERIAL_TYPES[selectedMaterialType];
    if (!candidateMaterialType) throw new LocalCandidateExtractionError("unsupported_candidate_material_type");
    return Object.freeze({
      file,
      mime_type: mimeType,
      source_type: sourceTypeForMediaType(mimeType),
      content_hash: contentHash,
      source_document_id: sourceDocumentId,
      batch_id: batchId,
      candidate_material_type: candidateMaterialType,
      candidate_material_type_source: "USER_SELECTED",
    });
  }

  function sourceDocumentFor(source, createdAt = now()) {
    return Truth.validateSourceDocument({
      contract_id: "ariadne-source-document-v1",
      source_document_id: source.source_document_id,
      source_type: source.source_type,
      filename: source.file.name,
      label: null,
      mime_type: source.mime_type,
      content_hash: source.content_hash,
      created_at: createdAt,
      material_type: "CANDIDATE",
      local_reference: null,
      batch_id: source.batch_id,
      provenance: { supplied_by: "USER", captured_via: "PERSONAL_FILE_PICKER", raw_source_recoverability: "SAME_SESSION_ONLY" },
      authority: Truth.AUTHORITY.source,
    });
  }

  function processingRunFor(source, snapshotId, status = "PENDING", createdAt = now(), patch = {}) {
    const running = status === "RUNNING";
    const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
    return Truth.validateProcessingRun({
      contract_id: "ariadne-processing-run-v1",
      run_id: patch.run_id || id("run-candidate-extraction"),
      operation_type: "CANDIDATE_LOCAL_EXTRACTION",
      source_document_id: source.source_document_id,
      batch_id: source.batch_id,
      runtime_snapshot_id: snapshotId,
      started_at: running || terminal ? (patch.started_at || createdAt) : null,
      finished_at: terminal ? (patch.finished_at || createdAt) : null,
      status,
      error_code: patch.error_code || null,
      output_artifact_ids: patch.output_artifact_ids || [],
      proposal_ids: [],
      authority: Truth.AUTHORITY.execution,
    });
  }

  function batchFor(sources, status = "PENDING", createdAt = now(), patch = {}) {
    const terminal = ["COMPLETED", "FAILED", "CANCELLED"].includes(status);
    return Truth.validateProcessingBatch({
      contract_id: "ariadne-processing-batch-v1",
      batch_id: patch.batch_id || sources[0]?.batch_id || id("batch-candidate-extraction"),
      operation_type: "CANDIDATE_LOCAL_EXTRACTION",
      source_document_ids: sources.map((source) => source.source_document_id),
      completed_source_ids: patch.completed_source_ids || [],
      cancelled_source_id: patch.cancelled_source_id || null,
      not_started_source_ids: patch.not_started_source_ids || [],
      status,
      created_at: patch.created_at || createdAt,
      finished_at: terminal ? (patch.finished_at || createdAt) : null,
      cancelled_at: status === "CANCELLED" ? (patch.cancelled_at || createdAt) : null,
      cancel_reason: status === "CANCELLED" ? "USER_CANCELLED_UPLOAD" : null,
      authority: Truth.AUTHORITY.execution,
    });
  }

  function sourceRefsFor(result, sourceId) {
    const blocks = Array.isArray(result.document_blocks) ? result.document_blocks : [];
    const refs = blocks.slice(0, 120).map((block) => ({
      source_document_id: sourceId,
      location: block.page ? `p. ${block.page}` : "document",
      excerpt_or_reference: String(block.text || "").trim(),
    })).filter((ref) => ref.excerpt_or_reference);
    return refs.length ? refs : [{ source_document_id: sourceId, location: "document", excerpt_or_reference: "No extractable text" }];
  }

  function artifactFor(source, run, result, createdAt = now()) {
    const artifactId = id("artifact-candidate-extraction");
    return Truth.validateExtractionArtifact({
      contract_id: "ariadne-extraction-artifact-v1",
      artifact_id: artifactId,
      source_document_id: source.source_document_id,
      processing_run_id: run.run_id,
      extraction_method: String(result.extraction_method || "local_candidate_extraction"),
      payload: {
        pages: Array.isArray(result.pages) ? result.pages : [],
        document_blocks: Array.isArray(result.document_blocks) ? result.document_blocks : [],
        extracted_text: String(result.extracted_text || ""),
        byte_size: Number(result.byte_size) || 0,
        processing_boundary: String(result.processing_boundary || "localhost_transient_candidate_extraction"),
        candidate_material_type: source.candidate_material_type,
        candidate_material_type_source: source.candidate_material_type_source,
      },
      source_refs: sourceRefsFor(result, source.source_document_id),
      quality: { page_count: Array.isArray(result.pages) ? result.pages.length : 0, local_ocr: result.extraction_method?.includes("vision") === true },
      warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : [],
      errors: [],
      created_at: createdAt,
      authority: Truth.AUTHORITY.extraction,
    });
  }

  function readRecord(database, storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new LocalCandidateExtractionError("persistence_read_failed"));
    });
  }

  async function persistCanonicalSource(database, sourceDocument) {
    const existing = await readRecord(database, "source_documents", sourceDocument.source_document_id);
    if (existing === null) return Truth.persistRecord(database, "source_documents", sourceDocument);
    if (existing.contract_id !== "ariadne-source-document-v1") throw new LocalCandidateExtractionError("source_document_legacy_collision");
    const validated = Truth.validateSourceDocument(existing);
    if (validated.content_hash !== sourceDocument.content_hash || validated.material_type !== "CANDIDATE") {
      throw new LocalCandidateExtractionError("source_document_canonical_collision");
    }
    return validated;
  }

  return Object.freeze({
    MAX_DOCUMENT_BYTES,
    MAX_IMAGE_BYTES,
    MIME_BY_EXTENSION,
    CANDIDATE_MATERIAL_TYPES,
    LocalCandidateExtractionError,
    mediaTypeForFile,
    sourceTypeForMediaType,
    sha256File,
    readAsDataURL,
    prepareSource,
    sourceDocumentFor,
    processingRunFor,
    batchFor,
    artifactFor,
    readRecord,
    persistCanonicalSource,
  });
}));
