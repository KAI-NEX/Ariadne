"use strict";

(function attachRuntimeExecutionContract(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AriadneRuntimeExecution = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createRuntimeExecutionContract() {
  const CAPABILITY_NAMES = Object.freeze([
    "local_extraction",
    "local_ocr",
    "deterministic_structuring",
    "semantic_understanding",
    "candidate_model_structuring",
    "job_model_structuring",
    "model_merge",
    "ai_conversation",
    "vision",
  ]);
  const CAPABILITY_STATES = Object.freeze(["supported", "unsupported", "unverified"]);
  const SNAPSHOT_FIELDS = Object.freeze([
    "snapshot_id",
    "captured_at",
    "mode",
    "provider",
    "model",
    "protocol",
    "capabilities",
    "adapter_version",
    "prompt_version",
    "schema_version",
    "delivery_method",
    "credential_ref",
  ]);
  const SNAPSHOT_OPTIONAL_FIELDS = Object.freeze(["operation", "capability_basis", "action_schema_version", "request_config_version"]);
  const LOCAL_CAPABILITY_NAMES = Object.freeze(["local_extraction", "local_ocr", "deterministic_structuring"]);
  const MODEL_CAPABILITY_NAMES = Object.freeze(CAPABILITY_NAMES.filter((name) => !LOCAL_CAPABILITY_NAMES.includes(name)));
  const SUPPORTED = "supported";
  const UNSUPPORTED = "unsupported";
  const UNVERIFIED = "unverified";
  const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
  const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
  const SNAPSHOT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
  const UUID_REFERENCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const UNSTRUCTURED_TOKEN_PATTERN = /^[A-Za-z0-9+/_=-]{24,}$/;
  const SENSITIVE_KEY_PATTERN = /(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|bearer|secret)/i;
  const SECRET_VALUE_PATTERNS = Object.freeze([
    /\bBearer\s+\S+/i,
    /\b(?:sk|rk|pk|sess)-[A-Za-z0-9_-]{8,}/,
    /\bAIza[0-9A-Za-z_-]{20,}/,
    /\b(?:api[_ -]?key|authorization|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+/i,
  ]);

  class ExecutionContractError extends Error {
    constructor(code) { super(code); this.name = "ExecutionContractError"; this.code = code; }
  }

  function localRuntimeCapability(localOcrState = UNVERIFIED) {
    if (!CAPABILITY_STATES.includes(localOcrState)) throw new ExecutionContractError("runtime_capability_state_invalid");
    return Object.freeze({
      local_extraction: SUPPORTED,
      local_ocr: localOcrState,
      deterministic_structuring: SUPPORTED,
      semantic_understanding: UNSUPPORTED,
      candidate_model_structuring: UNSUPPORTED,
      job_model_structuring: UNSUPPORTED,
      model_merge: UNSUPPORTED,
      ai_conversation: UNSUPPORTED,
      vision: UNSUPPORTED,
    });
  }

  const LOCAL_RUNTIME_CAPABILITY = localRuntimeCapability();

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function plainObject(value, code) {
    if (!isPlainObject(value)) throw new ExecutionContractError(code);
    return value;
  }

  function optionalString(value, code, maximum = 128) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new ExecutionContractError(code);
    return value.trim();
  }

  function requiredString(value, code, maximum) {
    const normalized = optionalString(value, code, maximum);
    if (normalized === null) throw new ExecutionContractError(code);
    return normalized;
  }

  function assertNoSecretLike(value) {
    if (Array.isArray(value)) { value.forEach(assertNoSecretLike); return; }
    if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, nested]) => {
        if (SENSITIVE_KEY_PATTERN.test(key) && key !== "credential_ref") throw new ExecutionContractError("runtime_snapshot_secret_field_forbidden");
        assertNoSecretLike(nested);
      });
      return;
    }
    if (typeof value === "string" && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      throw new ExecutionContractError("runtime_snapshot_secret_value_forbidden");
    }
  }

  function normalizeCurrentRuntime(currentRuntime) {
    const runtime = plainObject(currentRuntime, "current_runtime_malformed");
    assertNoSecretLike(runtime);
    if (Object.hasOwn(runtime, "capabilities")) throw new ExecutionContractError("current_runtime_capability_claim_forbidden");
    const rawMode = String(runtime.mode || "").trim().toLowerCase();
    const mode = rawMode === "ai" ? "model" : rawMode;
    if (!new Set(["local", "model"]).has(mode)) throw new ExecutionContractError("current_runtime_mode_invalid");
    if (mode === "local") {
      if (![null, undefined, "", "local"].includes(runtime.provider) || ![null, undefined, ""].includes(runtime.model)) {
        throw new ExecutionContractError("local_runtime_identity_conflict");
      }
      return Object.freeze({ mode: "local", provider: null, model: null });
    }
    const provider = requiredString(runtime.provider, "model_runtime_provider_required", 64).toLowerCase();
    const model = requiredString(runtime.model, "model_runtime_model_required", 200);
    if (!PROVIDER_PATTERN.test(provider)) throw new ExecutionContractError("model_runtime_provider_invalid");
    if (!MODEL_PATTERN.test(model)) throw new ExecutionContractError("model_runtime_model_invalid");
    return Object.freeze({ mode: "model", provider, model });
  }

  function runtimeCapability(values) {
    const capability = plainObject(values, "runtime_capability_shape_invalid");
    const names = Object.keys(capability).sort();
    if (JSON.stringify(names) !== JSON.stringify([...CAPABILITY_NAMES].sort())) throw new ExecutionContractError("runtime_capability_shape_invalid");
    if (Object.values(capability).some((state) => !CAPABILITY_STATES.includes(state))) throw new ExecutionContractError("runtime_capability_state_invalid");
    return Object.freeze(Object.fromEntries(CAPABILITY_NAMES.map((name) => [name, capability[name]])));
  }

  function environmentLocalOcrState(environmentCapabilities) {
    if (environmentCapabilities === null || environmentCapabilities === undefined) return UNVERIFIED;
    const environment = plainObject(environmentCapabilities, "runtime_environment_capability_malformed");
    if (Object.keys(environment).some((name) => name !== "local_ocr")) {
      throw new ExecutionContractError("runtime_environment_capability_claim_unsupported");
    }
    if (!Object.hasOwn(environment, "local_ocr")) return UNVERIFIED;
    if (!CAPABILITY_STATES.includes(environment.local_ocr)) throw new ExecutionContractError("runtime_capability_state_invalid");
    return environment.local_ocr;
  }

  function validateLocalCapabilityConsistency(capability) {
    if (capability.local_extraction !== SUPPORTED || capability.deterministic_structuring !== SUPPORTED) {
      throw new ExecutionContractError("local_runtime_capability_invalid");
    }
    if (MODEL_CAPABILITY_NAMES.some((name) => capability[name] !== UNSUPPORTED)) {
      throw new ExecutionContractError("local_runtime_capability_invalid");
    }
  }

  function validateModelCapabilityConsistency(capability) {
    if (capability.local_extraction !== SUPPORTED || capability.deterministic_structuring !== SUPPORTED) {
      throw new ExecutionContractError("model_local_preprocessing_capability_invalid");
    }
    const dependent = ["candidate_model_structuring", "job_model_structuring", "model_merge", "ai_conversation"];
    if (dependent.some((name) => capability[name] === SUPPORTED) && capability.semantic_understanding !== SUPPORTED) {
      throw new ExecutionContractError("model_semantic_capability_inconsistent");
    }
  }

  function resolveRuntimeCapability(normalizedRuntime, modelDescriptor = null, environmentCapabilities = null) {
    const runtime = normalizeCurrentRuntime(normalizedRuntime);
    const localOcrState = environmentLocalOcrState(environmentCapabilities);
    if (runtime.mode === "local") {
      if (modelDescriptor !== null && modelDescriptor !== undefined) throw new ExecutionContractError("local_runtime_descriptor_forbidden");
      return localRuntimeCapability(localOcrState);
    }
    const descriptor = plainObject(modelDescriptor, "runtime_model_descriptor_required");
    assertNoSecretLike(descriptor);
    const descriptorProvider = requiredString(descriptor.provider_id ?? descriptor.provider, "runtime_model_descriptor_provider_required", 64);
    const descriptorModel = requiredString(descriptor.model_id ?? descriptor.model, "runtime_model_descriptor_model_required", 200);
    if (descriptorProvider.toLowerCase() !== runtime.provider || descriptorModel !== runtime.model) {
      throw new ExecutionContractError("runtime_model_descriptor_identity_mismatch");
    }
    const identityValidated = descriptor.connection_verified === true
      || (typeof descriptor.discovery_source === "string" && Boolean(descriptor.discovery_source.trim()))
      || descriptor.runtime_capability_basis === "adapter_verified";
    if (!identityValidated) throw new ExecutionContractError("runtime_model_descriptor_unverified");

    const values = Object.fromEntries(CAPABILITY_NAMES.map((name) => [name, UNVERIFIED]));
    values.local_extraction = SUPPORTED;
    values.local_ocr = localOcrState;
    values.deterministic_structuring = SUPPORTED;
    const claims = descriptor.runtime_capabilities;
    if (claims !== null && claims !== undefined) {
      plainObject(claims, "runtime_capability_claim_malformed");
      if (Object.keys(claims).some((name) => !MODEL_CAPABILITY_NAMES.includes(name))) {
        throw new ExecutionContractError("runtime_capability_claim_unsupported");
      }
      Object.entries(claims).forEach(([name, state]) => {
        if (!CAPABILITY_STATES.includes(state)) throw new ExecutionContractError("runtime_capability_state_invalid");
        values[name] = state;
      });
      const productCapabilities = ["semantic_understanding", "candidate_model_structuring", "job_model_structuring", "model_merge", "ai_conversation"];
      if (productCapabilities.some((name) => claims[name] === SUPPORTED) && descriptor.runtime_capability_basis !== "adapter_verified") {
        throw new ExecutionContractError("runtime_capability_claim_unverified");
      }
    }

    const providerCapabilities = descriptor.capabilities;
    const readiness = String(descriptor.multimodal_readiness || "").toUpperCase();
    if (!claims || !Object.hasOwn(claims, "vision")) {
      if (readiness === "VERIFIED") values.vision = SUPPORTED;
      else if (Array.isArray(providerCapabilities) && providerCapabilities.includes("VISION")) values.vision = UNVERIFIED;
      else if (Array.isArray(providerCapabilities) || readiness === "NOT_MULTIMODAL") values.vision = UNSUPPORTED;
    }
    const capability = runtimeCapability(values);
    validateModelCapabilityConsistency(capability);
    return capability;
  }

  function credentialReference(value) {
    const credentialRef = optionalString(value, "runtime_credential_ref_invalid", 512);
    if (credentialRef !== null && CONTROL_CHARACTER_PATTERN.test(credentialRef)) {
      throw new ExecutionContractError("runtime_credential_ref_invalid");
    }
    if (credentialRef !== null && UNSTRUCTURED_TOKEN_PATTERN.test(credentialRef) && !UUID_REFERENCE_PATTERN.test(credentialRef)) {
      throw new ExecutionContractError("runtime_snapshot_secret_value_forbidden");
    }
    return credentialRef;
  }

  function descriptorOptional(descriptor, ...names) {
    if (!descriptor) return null;
    const name = names.find((candidate) => descriptor[candidate] !== null && descriptor[candidate] !== undefined);
    return name ? descriptor[name] : null;
  }

  function defaultSnapshotId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return `runtime-snapshot-${globalThis.crypto.randomUUID()}`;
    return `runtime-snapshot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function createRuntimeSnapshot(currentRuntime, options = {}) {
    const runtime = normalizeCurrentRuntime(currentRuntime);
    const descriptor = options.modelDescriptor ?? null;
    const capability = resolveRuntimeCapability(runtime, descriptor, options.environmentCapabilities ?? null);
    if (runtime.mode === "local" && options.credentialRef !== null && options.credentialRef !== undefined) {
      throw new ExecutionContractError("local_runtime_credential_ref_forbidden");
    }
    return validateRuntimeSnapshot({
      snapshot_id: options.snapshotId || defaultSnapshotId(),
      captured_at: options.capturedAt || new Date().toISOString(),
      mode: runtime.mode,
      provider: runtime.provider,
      model: runtime.model,
      protocol: descriptorOptional(descriptor, "protocol"),
      capabilities: capability,
      adapter_version: options.adapterVersion ?? descriptorOptional(descriptor, "adapter_version"),
      prompt_version: options.promptVersion ?? null,
      schema_version: options.schemaVersion ?? null,
      operation: options.operation ?? null,
      capability_basis: options.capabilityBasis ?? descriptorOptional(descriptor, "runtime_capability_basis"),
      action_schema_version: options.actionSchemaVersion ?? null,
      request_config_version: options.requestConfigVersion ?? null,
      delivery_method: options.deliveryMethod ?? descriptorOptional(descriptor, "delivery_method", "document_delivery"),
      credential_ref: options.credentialRef ?? null,
    });
  }

  function validateCapturedAt(value) {
    if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
      throw new ExecutionContractError("runtime_snapshot_captured_at_invalid");
    }
    return value;
  }

  function validateRuntimeSnapshot(snapshot) {
    const payload = plainObject(snapshot, "runtime_snapshot_malformed");
    assertNoSecretLike(payload);
    const fields = Object.keys(payload);
    if (SNAPSHOT_FIELDS.some((field) => !Object.hasOwn(payload, field))
      || fields.some((field) => !SNAPSHOT_FIELDS.includes(field) && !SNAPSHOT_OPTIONAL_FIELDS.includes(field))) throw new ExecutionContractError("runtime_snapshot_shape_invalid");
    const snapshotId = optionalString(payload.snapshot_id, "runtime_snapshot_id_invalid", 128);
    if (!snapshotId || !SNAPSHOT_ID_PATTERN.test(snapshotId)) throw new ExecutionContractError("runtime_snapshot_id_invalid");
    const capturedAt = validateCapturedAt(payload.captured_at);
    if (!["local", "model"].includes(payload.mode)) throw new ExecutionContractError("runtime_snapshot_mode_invalid");
    const capability = runtimeCapability(payload.capabilities);
    const credentialRef = credentialReference(payload.credential_ref);
    let provider = payload.provider;
    let model = payload.model;
    if (payload.mode === "local") {
      if (provider !== null || model !== null) throw new ExecutionContractError("local_runtime_identity_conflict");
      validateLocalCapabilityConsistency(capability);
      if (credentialRef !== null) throw new ExecutionContractError("local_runtime_credential_ref_forbidden");
    } else {
      provider = requiredString(provider, "model_runtime_provider_required", 64);
      model = requiredString(model, "model_runtime_model_required", 200);
      if (provider !== provider.toLowerCase() || !PROVIDER_PATTERN.test(provider)) throw new ExecutionContractError("model_runtime_provider_invalid");
      if (!MODEL_PATTERN.test(model)) throw new ExecutionContractError("model_runtime_model_invalid");
      validateModelCapabilityConsistency(capability);
    }
    const validated = {
      snapshot_id: snapshotId,
      captured_at: capturedAt,
      mode: payload.mode,
      provider,
      model,
      protocol: optionalString(payload.protocol, "runtime_snapshot_protocol_invalid"),
      capabilities: capability,
      adapter_version: optionalString(payload.adapter_version, "runtime_snapshot_adapter_version_invalid"),
      prompt_version: optionalString(payload.prompt_version, "runtime_snapshot_prompt_version_invalid"),
      schema_version: optionalString(payload.schema_version, "runtime_snapshot_schema_version_invalid"),
      operation: optionalString(payload.operation, "runtime_snapshot_operation_invalid"),
      capability_basis: optionalString(payload.capability_basis, "runtime_snapshot_capability_basis_invalid"),
      action_schema_version: optionalString(payload.action_schema_version, "runtime_snapshot_action_schema_version_invalid"),
      request_config_version: optionalString(payload.request_config_version, "runtime_snapshot_request_config_version_invalid"),
      delivery_method: optionalString(payload.delivery_method, "runtime_snapshot_delivery_method_invalid"),
      credential_ref: credentialRef,
    };
    assertNoSecretLike(validated);
    return Object.freeze(validated);
  }

  function serializeRuntimeSnapshot(snapshot) {
    return JSON.stringify(validateRuntimeSnapshot(snapshot));
  }

  function deserializeRuntimeSnapshot(serialized) {
    if (typeof serialized !== "string") throw new ExecutionContractError("runtime_snapshot_serialized_invalid");
    try { return validateRuntimeSnapshot(JSON.parse(serialized)); }
    catch (error) {
      if (error instanceof ExecutionContractError) throw error;
      throw new ExecutionContractError("runtime_snapshot_serialized_invalid");
    }
  }

  return Object.freeze({
    CAPABILITY_NAMES,
    CAPABILITY_STATES,
    SNAPSHOT_FIELDS,
    SNAPSHOT_OPTIONAL_FIELDS,
    LOCAL_RUNTIME_CAPABILITY,
    ExecutionContractError,
    normalizeCurrentRuntime,
    resolveRuntimeCapability,
    createRuntimeSnapshot,
    validateRuntimeSnapshot,
    serializeRuntimeSnapshot,
    deserializeRuntimeSnapshot,
  });
}));
