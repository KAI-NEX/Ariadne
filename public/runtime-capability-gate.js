"use strict";

(function attachRuntimeCapabilityGate(root, factory) {
  const contract = root.AriadneRuntimeExecution
    || (typeof module === "object" && module.exports ? require("./runtime-capabilities.js") : null);
  const api = factory(contract);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.JobRadarRuntimeGate = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createRuntimeCapabilityGate(Contract) {
  if (!Contract) throw new Error("runtime_execution_contract_required");

  const CURRENT_RUNTIME_STORAGE_KEY = "job-radar-selected-runtime";
  const OPERATION_CAPABILITIES = Object.freeze({
    candidate_import: Object.freeze({ local: "deterministic_structuring", model: "candidate_model_structuring" }),
    job_import: Object.freeze({ local: "deterministic_structuring", model: "job_model_structuring" }),
    ai_conversation: Object.freeze({ local: "ai_conversation", model: "ai_conversation" }),
    model_merge: Object.freeze({ local: "model_merge", model: "model_merge" }),
    legacy_candidate_semantic: Object.freeze({ local: "candidate_model_structuring", model: "candidate_model_structuring" }),
    legacy_job_semantic: Object.freeze({ local: "job_model_structuring", model: "job_model_structuring" }),
  });

  class RuntimeGateError extends Error {
    constructor(code) { super(code); this.name = "RuntimeGateError"; this.code = code; }
  }

  function readStoredRuntime(storage = globalThis.localStorage) {
    if (!storage || typeof storage.getItem !== "function") return { mode: "local" };
    const serialized = storage.getItem(CURRENT_RUNTIME_STORAGE_KEY);
    if (!serialized) return { mode: "local" };
    try { return JSON.parse(serialized); }
    catch (_error) { throw new RuntimeGateError("current_runtime_storage_malformed"); }
  }

  function authorityFrom(currentRuntime) {
    let runtime;
    try { runtime = Contract.normalizeCurrentRuntime(currentRuntime); }
    catch (_error) { throw new RuntimeGateError("current_runtime_invalid"); }
    const capabilities = runtime.mode === "local"
      ? Contract.resolveRuntimeCapability(runtime)
      : Contract.resolveRuntimeCapability(runtime, {
        provider_id: runtime.provider,
        model_id: runtime.model,
        discovery_source: "current_runtime_selection",
      });
    return Object.freeze({ runtime, capabilities });
  }

  function currentAuthority(storage = globalThis.localStorage) {
    return authorityFrom(readStoredRuntime(storage));
  }

  function operationGate(operation, authority = currentAuthority()) {
    const requirement = OPERATION_CAPABILITIES[operation];
    if (!requirement) throw new RuntimeGateError("runtime_operation_unknown");
    const capability = requirement[authority.runtime.mode];
    const state = authority.capabilities[capability];
    return Object.freeze({
      allowed: state === "supported",
      operation,
      capability,
      state,
      authority,
    });
  }

  function requireOperation(operation, authority = currentAuthority()) {
    const gate = operationGate(operation, authority);
    if (!gate.allowed) throw new RuntimeGateError(`runtime_capability_${gate.state}`);
    return gate;
  }

  function legacyProviderAction({ provider, model = null, capability }, authority = currentAuthority()) {
    const runtime = authority.runtime;
    const state = authority.capabilities[capability];
    const identityMatches = runtime.mode === "model"
      && runtime.provider === String(provider || "").trim().toLowerCase()
      && (!model || runtime.model === String(model).trim());
    return Object.freeze({
      allowed: identityMatches && state === "supported",
      capability,
      state,
      identity_matches: identityMatches,
      authority,
    });
  }

  function subscribe(listener, eventTarget = globalThis) {
    if (!eventTarget || typeof eventTarget.addEventListener !== "function") return () => {};
    const handler = (event) => {
      if (event.key === CURRENT_RUNTIME_STORAGE_KEY || event.key === null) listener(currentAuthority());
    };
    eventTarget.addEventListener("storage", handler);
    return () => eventTarget.removeEventListener("storage", handler);
  }

  return Object.freeze({
    CURRENT_RUNTIME_STORAGE_KEY,
    OPERATION_CAPABILITIES,
    RuntimeGateError,
    readStoredRuntime,
    authorityFrom,
    currentAuthority,
    operationGate,
    requireOperation,
    legacyProviderAction,
    subscribe,
  });
}));
