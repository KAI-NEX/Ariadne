"use strict";

(function attachModelImportLifecycle(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneModelImportLifecycle = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createModelImportLifecycle() {
  const STATES = Object.freeze({
    SOURCE_SELECTED: "SOURCE_SELECTED",
    SOURCE_STORED: "SOURCE_STORED",
    MODEL_PROCESSING: "MODEL_PROCESSING",
    WORKING: "WORKING",
    PROPOSAL_READY: "PROPOSAL_READY",
    REVIEWING: "REVIEWING",
    READY_TO_SAVE: "READY_TO_SAVE",
    SAVED: "SAVED",
    MODEL_FAILED: "MODEL_FAILED",
  });
  const TRANSITIONS = Object.freeze({
    SOURCE_SELECTED: Object.freeze([STATES.SOURCE_STORED]),
    SOURCE_STORED: Object.freeze([STATES.MODEL_PROCESSING]),
    MODEL_PROCESSING: Object.freeze([STATES.WORKING, STATES.PROPOSAL_READY, STATES.MODEL_FAILED]),
    WORKING: Object.freeze([STATES.SAVED, STATES.MODEL_FAILED]),
    PROPOSAL_READY: Object.freeze([STATES.REVIEWING, STATES.READY_TO_SAVE]),
    REVIEWING: Object.freeze([STATES.REVIEWING, STATES.READY_TO_SAVE]),
    READY_TO_SAVE: Object.freeze([STATES.SAVED]),
    SAVED: Object.freeze([]),
    MODEL_FAILED: Object.freeze([]),
  });

  function createStateMachine(initialState = STATES.SOURCE_SELECTED) {
    if (!Object.hasOwn(TRANSITIONS, initialState)) throw new Error("import_lifecycle_state_invalid");
    let current = initialState;
    return Object.freeze({
      get state() { return current; },
      transition(nextState) {
        if (!TRANSITIONS[current]?.includes(nextState)) throw new Error(`import_lifecycle_transition_invalid:${current}:${nextState}`);
        current = nextState;
        return current;
      },
      proposalReady(unresolvedCount) {
        if (!Number.isInteger(unresolvedCount) || unresolvedCount < 0) throw new Error("import_lifecycle_review_count_invalid");
        if (current !== STATES.PROPOSAL_READY) throw new Error(`import_lifecycle_transition_invalid:${current}:review_resolution`);
        current = unresolvedCount ? STATES.REVIEWING : STATES.READY_TO_SAVE;
        return current;
      },
      reviewProgress(unresolvedCount) {
        if (!Number.isInteger(unresolvedCount) || unresolvedCount < 0 || current !== STATES.REVIEWING) throw new Error("import_lifecycle_review_progress_invalid");
        current = unresolvedCount ? STATES.REVIEWING : STATES.READY_TO_SAVE;
        return current;
      },
    });
  }

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function sha256(value) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function runtimeFingerprint(snapshot) {
    const fields = Object.fromEntries(["mode", "provider", "model", "protocol", "adapter_version", "prompt_version", "schema_version", "delivery_method"].map((key) => [key, snapshot[key]]));
    if (snapshot.execution_settings) fields.execution_settings = Object.fromEntries(["contract_version", "connection_id", "descriptor_revision", "settings_schema_version", "effective_settings"].map(key => [key, snapshot.execution_settings[key]]));
    return `sha256:${await sha256(canonicalJson(fields))}`;
  }

  async function operationIdentityFor({ source_document_id: sourceDocumentId, operation_type: operationType, operation_prefix: operationPrefix, snapshot, consent_id: consentId }) {
    const fingerprint = await runtimeFingerprint(snapshot);
    const operationId = `${operationPrefix}-${await sha256(`${sourceDocumentId}|${operationType}|${fingerprint}|${consentId}`)}`;
    return Object.freeze({ operation_id: operationId, operation_type: operationType, source_document_id: sourceDocumentId, runtime_fingerprint: fingerprint, consent_id: consentId });
  }

  function consentFor({ source_document_id: sourceDocumentId, snapshot, confirmed_at: confirmedAt, consent_id: consentId }) {
    return Object.freeze({
      explicitly_confirmed: true,
      consent_id: consentId,
      source_document_id: sourceDocumentId,
      provider: snapshot.provider,
      model: snapshot.model,
      delivery_method: snapshot.delivery_method,
      confirmed_at: confirmedAt,
    });
  }

  function claimProcessingRun(database, pendingRun, failureCode = "model_import_processing_run_claim_failed") {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["processing_runs"], "readwrite");
      let claimed = true;
      let failure = null;
      const request = transaction.objectStore("processing_runs").add(structuredClone(pendingRun));
      request.onerror = (event) => {
        if (request.error?.name === "ConstraintError") {
          event?.preventDefault?.();
          event?.stopPropagation?.();
          claimed = false;
          return;
        }
        failure = request.error || new Error(failureCode);
      };
      transaction.oncomplete = () => resolve(claimed);
      transaction.onerror = () => reject(failure || transaction.error || new Error(failureCode));
      transaction.onabort = () => reject(failure || transaction.error || new Error(failureCode));
    });
  }

  function persistClaimedProposals(database, { running_run: runningRun, succeeded_run: succeededRun, proposals, signal, is_active: isActive = () => true, validate_run: validateRun = (value) => value, stale_code: staleCode, read_code: readCode, persistence_code: persistenceCode, abort_error: abortError }) {
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["processing_runs", "context_proposals"], "readwrite");
      let contractError = null;
      const onAbort = () => transaction.abort();
      signal?.addEventListener?.("abort", onAbort, { once: true });
      const request = transaction.objectStore("processing_runs").get(runningRun.run_id);
      request.onsuccess = () => {
        try {
          const current = request.result ? validateRun(request.result) : null;
          if (!current || current.status !== "RUNNING" || current.runtime_snapshot_id !== runningRun.runtime_snapshot_id || current.source_document_id !== runningRun.source_document_id) throw new Error(staleCode);
          if (signal?.aborted) throw abortError();
          if (!isActive()) throw new Error(staleCode);
          proposals.forEach((proposal) => transaction.objectStore("context_proposals").add(structuredClone(proposal)));
          transaction.objectStore("processing_runs").put(structuredClone(succeededRun));
        } catch (error) { contractError = error; transaction.abort(); }
      };
      request.onerror = () => { contractError = request.error || new Error(readCode); transaction.abort(); };
      const cleanup = () => signal?.removeEventListener?.("abort", onAbort);
      transaction.oncomplete = () => { cleanup(); resolve(succeededRun); };
      transaction.onerror = () => { cleanup(); reject(contractError || transaction.error || new Error(persistenceCode)); };
      transaction.onabort = () => { cleanup(); reject(contractError || (signal?.aborted ? abortError() : transaction.error || new Error(persistenceCode))); };
    });
  }

  return Object.freeze({ STATES, TRANSITIONS, createStateMachine, canonicalJson, sha256, runtimeFingerprint, operationIdentityFor, consentFor, claimProcessingRun, persistClaimedProposals });
}));
