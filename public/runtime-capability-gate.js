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
  const CANDIDATE_PDF_MODEL_ADAPTER = Object.freeze({
    provider_id: "deepseek",
    model_id: "deepseek-v4-flash-vision-exp",
    protocol: "OPENAI_CHAT_COMPLETIONS",
    capabilities: Object.freeze(["TEXT", "VISION"]),
    multimodal_readiness: "VERIFIED",
    discovery_source: "qualification_2026-09-03",
    runtime_capability_basis: "adapter_verified",
    runtime_capabilities: Object.freeze({
      semantic_understanding: "supported",
      candidate_model_structuring: "supported",
      job_model_structuring: "unsupported",
      model_merge: "unsupported",
      ai_conversation: "unsupported",
      vision: "supported",
    }),
    adapter_version: "deepseek-candidate-pdf-v1",
    delivery_method: "rendered_pdf_pages",
  });
  const CANDIDATE_CONVERSATION_MODEL_ADAPTER = Object.freeze({
    provider_id: "deepseek",
    model_id: "deepseek-v4-pro",
    protocol: "OPENAI_CHAT_COMPLETIONS",
    capabilities: Object.freeze(["TEXT", "STRUCTURED_JSON"]),
    multimodal_readiness: "NOT_MULTIMODAL",
    discovery_source: "qualification_2026-09-03",
    runtime_capability_basis: "adapter_verified",
    runtime_capabilities: Object.freeze({
      semantic_understanding: "supported",
      candidate_model_structuring: "unsupported",
      job_model_structuring: "unsupported",
      model_merge: "unsupported",
      ai_conversation: "supported",
      vision: "unsupported",
    }),
    adapter_version: "deepseek-candidate-conversation-v3",
    delivery_method: null,
  });
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
    const descriptor = runtime.mode === "model" ? modelDescriptorForRuntime(runtime) : null;
    const capabilities = runtime.mode === "local"
      ? Contract.resolveRuntimeCapability(runtime)
      : Contract.resolveRuntimeCapability(runtime, descriptor);
    return Object.freeze({ runtime, capabilities });
  }

  function modelDescriptorForRuntime(runtime) {
    const normalized = Contract.normalizeCurrentRuntime(runtime);
    if (normalized.mode !== "model") return null;
    if (normalized.provider === CANDIDATE_PDF_MODEL_ADAPTER.provider_id && normalized.model === CANDIDATE_PDF_MODEL_ADAPTER.model_id) {
      return CANDIDATE_PDF_MODEL_ADAPTER;
    }
    if (normalized.provider === CANDIDATE_CONVERSATION_MODEL_ADAPTER.provider_id && normalized.model === CANDIDATE_CONVERSATION_MODEL_ADAPTER.model_id) {
      return CANDIDATE_CONVERSATION_MODEL_ADAPTER;
    }
    return Object.freeze({
      provider_id: normalized.provider,
      model_id: normalized.model,
      discovery_source: "current_runtime_selection",
    });
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
    CANDIDATE_PDF_MODEL_ADAPTER,
    CANDIDATE_CONVERSATION_MODEL_ADAPTER,
    RuntimeGateError,
    readStoredRuntime,
    authorityFrom,
    modelDescriptorForRuntime,
    currentAuthority,
    operationGate,
    requireOperation,
    legacyProviderAction,
    subscribe,
  });
}));
