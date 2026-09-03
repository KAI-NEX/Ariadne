"use strict";

(function attachRawSourceStorage(root, factory) {
  const truth = root.AriadneTruthPersistence
    || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const api = factory(truth);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneRawSourceStorage = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createRawSourceStorage(Truth) {
  if (!Truth) throw new Error("truth_persistence_required");

  const DB_NAME = Truth.DB_NAME;
  const STORE_NAME = "source_documents";
  const RECORD_TYPE = "ARIADNE_CANONICAL_RAW_SOURCE_V1";
  const PAYLOAD_KEY_PREFIX = "raw-source-payload-v1::";
  const LOCAL_REFERENCE_PREFIX = `indexeddb://${DB_NAME}/${STORE_NAME}/`;

  class RawSourceStorageError extends Error {
    constructor(code, message = code) {
      super(message);
      this.name = "RawSourceStorageError";
      this.code = code;
    }
  }

  function requiredSourceId(value) {
    const sourceId = String(value || "").trim();
    if (!sourceId) throw new RawSourceStorageError("raw_source_identity_required");
    return sourceId;
  }

  function payloadRecordIdFor(sourceId) {
    return `${PAYLOAD_KEY_PREFIX}${requiredSourceId(sourceId)}`;
  }

  function localReferenceFor(sourceId) {
    return `${LOCAL_REFERENCE_PREFIX}${encodeURIComponent(payloadRecordIdFor(sourceId))}`;
  }

  function parseLocalReference(localReference) {
    const reference = String(localReference || "");
    if (!reference) throw new RawSourceStorageError("raw_source_reference_missing");
    if (!reference.startsWith(LOCAL_REFERENCE_PREFIX)) throw new RawSourceStorageError("raw_source_reference_unsupported");
    const encodedKey = reference.slice(LOCAL_REFERENCE_PREFIX.length);
    if (!encodedKey || encodedKey.includes("/")) throw new RawSourceStorageError("raw_source_reference_invalid");
    let recordId;
    try { recordId = decodeURIComponent(encodedKey); }
    catch (_error) { throw new RawSourceStorageError("raw_source_reference_invalid"); }
    if (!recordId.startsWith(PAYLOAD_KEY_PREFIX)) throw new RawSourceStorageError("raw_source_reference_invalid");
    return Object.freeze({ database_name: DB_NAME, store_name: STORE_NAME, record_id: recordId });
  }

  function isBlobLike(value) {
    return Boolean(value && Number.isFinite(value.size) && value.size >= 0 && typeof value.arrayBuffer === "function");
  }

  async function sha256Blob(blob) {
    if (!isBlobLike(blob)) throw new RawSourceStorageError("raw_source_payload_invalid");
    let bytes;
    try { bytes = await blob.arrayBuffer(); }
    catch (_error) { throw new RawSourceStorageError("raw_source_payload_read_failed"); }
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  function payloadEnvelopeFor(sourceDocument, file, createdAt = new Date().toISOString()) {
    const source = Truth.validateSourceDocument(sourceDocument);
    if (!isBlobLike(file)) throw new RawSourceStorageError("raw_source_payload_invalid");
    const expectedReference = localReferenceFor(source.source_document_id);
    if (source.local_reference !== expectedReference) throw new RawSourceStorageError("raw_source_reference_mismatch");
    return Object.freeze({
      source_document_id: payloadRecordIdFor(source.source_document_id),
      record_type: RECORD_TYPE,
      canonical_source_document_id: source.source_document_id,
      content_hash: source.content_hash,
      filename: source.filename,
      mime_type: source.mime_type,
      byte_size: file.size,
      file_blob: file,
      created_at: createdAt,
    });
  }

  function isPayloadRecord(record) {
    return Boolean(record && record.record_type === RECORD_TYPE && String(record.source_document_id || "").startsWith(PAYLOAD_KEY_PREFIX));
  }

  function isPayloadRecordFor(record, sourceId) {
    const id = requiredSourceId(sourceId);
    return isPayloadRecord(record)
      && record.source_document_id === payloadRecordIdFor(id)
      && record.canonical_source_document_id === id;
  }

  function validatePayloadEnvelope(record, sourceDocument) {
    const source = Truth.validateSourceDocument(sourceDocument);
    if (!isPayloadRecordFor(record, source.source_document_id)) throw new RawSourceStorageError("raw_source_payload_envelope_invalid");
    if (record.content_hash !== source.content_hash
      || record.filename !== source.filename
      || record.mime_type !== source.mime_type
      || record.byte_size !== record.file_blob?.size
      || !isBlobLike(record.file_blob)) {
      throw new RawSourceStorageError("raw_source_payload_envelope_invalid");
    }
    return record;
  }

  function readRecord(database, key) {
    return new Promise((resolve, reject) => {
      let transaction;
      try { transaction = database.transaction(STORE_NAME, "readonly"); }
      catch (_error) { reject(new RawSourceStorageError("raw_source_storage_unavailable")); return; }
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new RawSourceStorageError("raw_source_read_failed"));
    });
  }

  async function sourceDocumentForId(database, sourceId) {
    const record = await readRecord(database, requiredSourceId(sourceId));
    if (!record) throw new RawSourceStorageError("raw_source_document_missing");
    if (record.contract_id !== "ariadne-source-document-v1") throw new RawSourceStorageError("raw_source_document_not_canonical");
    return Truth.validateSourceDocument(record);
  }

  async function resolveRawSource(database, sourceOrId) {
    const source = typeof sourceOrId === "string"
      ? await sourceDocumentForId(database, sourceOrId)
      : Truth.validateSourceDocument(sourceOrId);
    const reference = parseLocalReference(source.local_reference);
    const expectedRecordId = payloadRecordIdFor(source.source_document_id);
    if (reference.record_id !== expectedRecordId) throw new RawSourceStorageError("raw_source_reference_mismatch");
    const payload = await readRecord(database, reference.record_id);
    if (!payload) throw new RawSourceStorageError("raw_source_payload_missing");
    validatePayloadEnvelope(payload, source);
    const resolvedHash = await sha256Blob(payload.file_blob);
    if (resolvedHash !== source.content_hash) {
      throw new RawSourceStorageError("raw_source_integrity_mismatch", "raw source integrity mismatch");
    }
    const resolvedFile = typeof payload.file_blob.name === "string"
      ? payload.file_blob
      : (typeof File === "function" ? new File([payload.file_blob], payload.filename, { type: payload.mime_type || "", lastModified: 0 }) : payload.file_blob);
    return Object.freeze({
      source_document: source,
      file: resolvedFile,
      blob: payload.file_blob,
      metadata: Object.freeze({
        filename: payload.filename,
        mime_type: payload.mime_type,
        byte_size: payload.byte_size,
        content_hash: resolvedHash,
        local_reference: source.local_reference,
      }),
    });
  }

  async function persistDurableSource(database, sourceDocument, file) {
    const requested = Truth.validateSourceDocument(sourceDocument);
    const expectedReference = localReferenceFor(requested.source_document_id);
    if (requested.local_reference !== expectedReference) throw new RawSourceStorageError("raw_source_reference_mismatch");
    const incomingHash = await sha256Blob(file);
    if (incomingHash !== requested.content_hash) {
      throw new RawSourceStorageError("raw_source_integrity_mismatch", "raw source integrity mismatch");
    }

    const canonicalKey = requested.source_document_id;
    const payloadKey = payloadRecordIdFor(canonicalKey);
    const [existingCanonical, existingPayload] = await Promise.all([
      readRecord(database, canonicalKey),
      readRecord(database, payloadKey),
    ]);
    let canonicalToPersist = requested;
    if (existingCanonical) {
      if (existingCanonical.contract_id !== "ariadne-source-document-v1") throw new RawSourceStorageError("source_document_legacy_collision");
      const validated = Truth.validateSourceDocument(existingCanonical);
      if (validated.content_hash !== requested.content_hash || validated.material_type !== requested.material_type) {
        throw new RawSourceStorageError("source_document_canonical_collision");
      }
      if (validated.local_reference && validated.local_reference !== expectedReference) {
        throw new RawSourceStorageError("raw_source_reference_mismatch");
      }
      canonicalToPersist = Truth.validateSourceDocument({
        ...validated,
        local_reference: expectedReference,
        provenance: { ...validated.provenance, raw_source_recoverability: "DURABLE_BROWSER_LOCAL" },
      });
    }
    if (existingPayload) {
      validatePayloadEnvelope(existingPayload, canonicalToPersist);
      const existingHash = await sha256Blob(existingPayload.file_blob);
      if (existingHash !== canonicalToPersist.content_hash) {
        throw new RawSourceStorageError("raw_source_integrity_mismatch", "raw source integrity mismatch");
      }
    }
    const payloadToPersist = payloadEnvelopeFor(canonicalToPersist, file);

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      let canonicalRecord = null;
      let payloadRecord = null;
      let readsRemaining = 2;
      let contractError = null;
      const abortWith = (error) => {
        if (contractError) return;
        contractError = error;
        transaction.abort();
      };
      const writeWhenReady = () => {
        readsRemaining -= 1;
        if (readsRemaining) return;
        try {
          if (canonicalRecord) {
            if (canonicalRecord.contract_id !== "ariadne-source-document-v1") throw new RawSourceStorageError("source_document_legacy_collision");
            const validated = Truth.validateSourceDocument(canonicalRecord);
            if (validated.content_hash !== canonicalToPersist.content_hash || validated.material_type !== canonicalToPersist.material_type) {
              throw new RawSourceStorageError("source_document_canonical_collision");
            }
          }
          if (payloadRecord) validatePayloadEnvelope(payloadRecord, canonicalToPersist);
          store.put(structuredClone(canonicalToPersist));
          if (!payloadRecord) store.add(structuredClone(payloadToPersist));
        } catch (error) { abortWith(error); }
      };
      const canonicalRequest = store.get(canonicalKey);
      canonicalRequest.onsuccess = () => { canonicalRecord = canonicalRequest.result || null; writeWhenReady(); };
      canonicalRequest.onerror = () => abortWith(canonicalRequest.error || new RawSourceStorageError("raw_source_read_failed"));
      const payloadRequest = store.get(payloadKey);
      payloadRequest.onsuccess = () => { payloadRecord = payloadRequest.result || null; writeWhenReady(); };
      payloadRequest.onerror = () => abortWith(payloadRequest.error || new RawSourceStorageError("raw_source_read_failed"));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(contractError || transaction.error || new RawSourceStorageError("raw_source_persistence_failed"));
      transaction.onabort = () => reject(contractError || transaction.error || new RawSourceStorageError("raw_source_persistence_failed"));
    });

    return resolveRawSource(database, canonicalToPersist);
  }

  return Object.freeze({
    DB_NAME,
    STORE_NAME,
    RECORD_TYPE,
    PAYLOAD_KEY_PREFIX,
    RawSourceStorageError,
    payloadRecordIdFor,
    localReferenceFor,
    parseLocalReference,
    sha256Blob,
    payloadEnvelopeFor,
    isPayloadRecord,
    isPayloadRecordFor,
    readRecord,
    sourceDocumentForId,
    resolveRawSource,
    persistDurableSource,
  });
}));
