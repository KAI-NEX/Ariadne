import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "public", "runtime-capabilities.js"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(root, "data", "runtime_snapshot_v1.schema.json"), "utf8"));
const module = { exports: {} };
new Function("module", "exports", source)(module, module.exports);
const Runtime = module.exports;

assert.deepEqual(Runtime.SNAPSHOT_FIELDS, schema.required);
assert.deepEqual(Runtime.CAPABILITY_NAMES, schema.properties.capabilities.required);
assert.deepEqual(Runtime.CAPABILITY_STATES, schema.$defs.capabilityState.enum);

const local = Runtime.createRuntimeSnapshot(
  { mode: "local", provider: "local", model: null },
  { snapshotId: "runtime-snapshot-local-test", capturedAt: "2026-09-01T12:00:00Z" },
);
assert.equal(local.mode, "local");
assert.equal(local.provider, null);
assert.equal(local.model, null);
assert.equal(local.capabilities.local_extraction, "supported");
assert.equal(local.capabilities.local_ocr, "unverified"); // Local mode alone is not OCR evidence.
assert.equal(local.capabilities.deterministic_structuring, "supported");
assert.equal(local.capabilities.semantic_understanding, "unsupported");
assert.equal(local.capabilities.ai_conversation, "unsupported");
assert.equal(local.capabilities.model_merge, "unsupported");
assert.equal(local.capabilities.vision, "unsupported");
assert.equal(local.credential_ref, null);
assert(Object.isFrozen(local));
assert(Object.isFrozen(local.capabilities));
assert.throws(() => { local.mode = "model"; }, TypeError);
assert.throws(() => { local.capabilities.semantic_understanding = "supported"; }, TypeError);

const localOcrSupported = Runtime.createRuntimeSnapshot(
  { mode: "local" },
  {
    environmentCapabilities: { local_ocr: "supported" },
    snapshotId: "runtime-snapshot-local-ocr-supported",
    capturedAt: "2026-09-01T12:00:01Z",
  },
);
const localOcrUnsupported = Runtime.createRuntimeSnapshot(
  { mode: "local" },
  {
    environmentCapabilities: { local_ocr: "unsupported" },
    snapshotId: "runtime-snapshot-local-ocr-unsupported",
    capturedAt: "2026-09-01T12:00:02Z",
  },
);
assert.equal(localOcrSupported.capabilities.local_ocr, "supported");
assert.equal(localOcrUnsupported.capabilities.local_ocr, "unsupported");
assert.equal(localOcrSupported.capabilities.local_extraction, "supported");
assert.equal(localOcrUnsupported.capabilities.deterministic_structuring, "supported");
assert.equal(localOcrSupported.capabilities.vision, "unsupported");

const descriptor = {
  provider_id: "deepseek",
  model_id: "deepseek-v4-flash-vision-exp",
  protocol: "OPENAI_CHAT_COMPLETIONS",
  capabilities: ["TEXT", "VISION"],
  multimodal_readiness: "VERIFIED",
  adapter_version: "provider-runtime-v1",
  delivery_method: "rendered_pdf_pages",
  runtime_capability_basis: "adapter_verified",
  runtime_capabilities: {
    semantic_understanding: "supported",
    candidate_model_structuring: "supported",
    job_model_structuring: "supported",
    model_merge: "supported",
    ai_conversation: "supported",
    vision: "supported",
  },
};
const model = Runtime.createRuntimeSnapshot(
  { mode: "ai", provider: "DeepSeek", model: "deepseek-v4-flash-vision-exp" },
  {
    modelDescriptor: descriptor,
    snapshotId: "runtime-snapshot-model-test",
    capturedAt: "2026-09-01T12:01:00+00:00",
    credentialRef: "provider:deepseek:default",
    environmentCapabilities: { local_ocr: "supported" },
    promptVersion: "candidate-proposal-v1",
    schemaVersion: "candidate-proposal-v1",
  },
);
assert.equal(model.mode, "model");
assert.equal(model.provider, "deepseek");
assert.equal(model.protocol, "OPENAI_CHAT_COMPLETIONS");
assert.equal(model.capabilities.semantic_understanding, "supported");
assert.equal(model.capabilities.local_ocr, "supported");
assert.equal(model.capabilities.vision, "supported");
assert.equal(model.credential_ref, "provider:deepseek:default");

const unverified = Runtime.createRuntimeSnapshot(
  { mode: "model", provider: "fixture", model: "fixture-model" },
  {
    modelDescriptor: { provider_id: "fixture", model_id: "fixture-model", discovery_source: "account_discovered", capabilities: ["TEXT", "VISION"], multimodal_readiness: "UNVERIFIED" },
    snapshotId: "runtime-snapshot-unverified",
    capturedAt: "2026-09-01T12:02:00Z",
  },
);
assert.equal(unverified.capabilities.vision, "unverified");
assert.equal(unverified.capabilities.local_ocr, "unverified");
assert.equal(unverified.capabilities.semantic_understanding, "unverified");
assert.equal(unverified.capabilities.ai_conversation, "unverified");

for (const [provider, selectedModel] of [["qwen", "qwen3.8-max"], ["gemini", "gemini-3.7-flash"]]) {
  const connected = Runtime.createRuntimeSnapshot(
    { mode: "ai", provider, model: selectedModel },
    {
      modelDescriptor: {
        provider_id: provider,
        model_id: selectedModel,
        connection_verified: true,
        multimodal_readiness: "VERIFIED",
      },
      snapshotId: `runtime-snapshot-${provider}-connected`,
      capturedAt: "2026-09-01T12:03:00Z",
    },
  );
  assert.equal(connected.protocol, null); // Current Add Model descriptor does not invent one.
  assert.equal(connected.capabilities.vision, "supported");
  assert.equal(connected.capabilities.semantic_understanding, "unverified");
}

const serialized = Runtime.serializeRuntimeSnapshot(model);
const restored = Runtime.deserializeRuntimeSnapshot(serialized);
assert.deepEqual(restored, model);
assert.equal(restored.snapshot_id, model.snapshot_id);
assert(serialized.includes("provider:deepseek:default"));
assert(!serialized.includes("Authorization") && !serialized.includes("Bearer"));

for (const credentialRef of [
  "credential-handle",
  "keychain://com.ariadne/deepseek/default",
  "session-memory#credential-42",
  "550e8400-e29b-41d4-a716-446655440000",
]) {
  const validated = Runtime.validateRuntimeSnapshot({ ...model, credential_ref: credentialRef });
  assert.equal(validated.credential_ref, credentialRef);
}

function expectError(code, callback) {
  assert.throws(callback, (error) => error instanceof Runtime.ExecutionContractError && error.code === code);
}

expectError("local_runtime_identity_conflict", () => Runtime.normalizeCurrentRuntime({ mode: "local", provider: "deepseek", model: null }));
expectError("local_runtime_identity_conflict", () => Runtime.normalizeCurrentRuntime({ mode: "local", provider: "local", model: "fixture-model" }));
expectError("model_runtime_provider_required", () => Runtime.normalizeCurrentRuntime({ mode: "model", model: "fixture-model" }));
expectError("model_runtime_model_required", () => Runtime.normalizeCurrentRuntime({ mode: "model", provider: "fixture" }));
expectError("current_runtime_mode_invalid", () => Runtime.normalizeCurrentRuntime({ mode: "hybrid" }));
expectError("current_runtime_capability_claim_forbidden", () => Runtime.normalizeCurrentRuntime({ mode: "local", capabilities: {} }));
expectError("runtime_snapshot_secret_field_forbidden", () => Runtime.normalizeCurrentRuntime({ mode: "local", api_key: "example-placeholder" }));
expectError("runtime_model_descriptor_required", () => Runtime.createRuntimeSnapshot({ mode: "model", provider: "fixture", model: "fixture-model" }));
expectError("runtime_model_descriptor_identity_mismatch", () => Runtime.createRuntimeSnapshot(
  { mode: "model", provider: "fixture", model: "fixture-model" },
  { modelDescriptor: { provider_id: "other", model_id: "fixture-model" } },
));
expectError("runtime_model_descriptor_unverified", () => Runtime.createRuntimeSnapshot(
  { mode: "model", provider: "fixture", model: "fixture-model" },
  { modelDescriptor: { provider_id: "fixture", model_id: "fixture-model" } },
));
expectError("runtime_snapshot_secret_field_forbidden", () => Runtime.createRuntimeSnapshot(
  { mode: "model", provider: "fixture", model: "fixture-model" },
  { modelDescriptor: { provider_id: "fixture", model_id: "fixture-model", connection_verified: true, api_key: "example-placeholder" } },
));
expectError("runtime_capability_claim_unsupported", () => Runtime.createRuntimeSnapshot(
  { mode: "model", provider: "fixture", model: "fixture-model" },
  { modelDescriptor: { provider_id: "fixture", model_id: "fixture-model", connection_verified: true, runtime_capabilities: { telepathy: "supported" } } },
));
expectError("runtime_capability_claim_unverified", () => Runtime.createRuntimeSnapshot(
  { mode: "model", provider: "fixture", model: "fixture-model" },
  { modelDescriptor: { provider_id: "fixture", model_id: "fixture-model", connection_verified: true, runtime_capabilities: { semantic_understanding: "supported" } } },
));
expectError("model_semantic_capability_inconsistent", () => Runtime.createRuntimeSnapshot(
  { mode: "model", provider: "fixture", model: "fixture-model" },
  { modelDescriptor: { provider_id: "fixture", model_id: "fixture-model", runtime_capability_basis: "adapter_verified", runtime_capabilities: { ai_conversation: "supported" } } },
));
for (const secretLikeCredential of [
  "sk-proj-exampleplaceholder123456",
  "Bearer example-placeholder-token",
  "Authorization: example-placeholder",
  "access_token=example-placeholder",
  "AIza012345678901234567890123456789",
  "AbCdEfGhIjKlMnOpQrStUvWxYz012345",
]) {
  expectError("runtime_snapshot_secret_value_forbidden", () => Runtime.createRuntimeSnapshot(
    { mode: "model", provider: "fixture", model: "fixture-model" },
    { modelDescriptor: { provider_id: "fixture", model_id: "fixture-model", connection_verified: true }, credentialRef: secretLikeCredential },
  ));
}
expectError("runtime_credential_ref_invalid", () => Runtime.validateRuntimeSnapshot({ ...model, credential_ref: "unsafe\nreference" }));
expectError("runtime_capability_state_invalid", () => Runtime.createRuntimeSnapshot(
  { mode: "local" },
  { environmentCapabilities: { local_ocr: "assumed" } },
));
expectError("runtime_environment_capability_claim_unsupported", () => Runtime.createRuntimeSnapshot(
  { mode: "local" },
  { environmentCapabilities: { vision: "supported" } },
));
expectError("runtime_snapshot_secret_field_forbidden", () => Runtime.validateRuntimeSnapshot({ ...local, Authorization: "example-placeholder" }));
const malformed = { ...local }; delete malformed.captured_at;
expectError("runtime_snapshot_shape_invalid", () => Runtime.validateRuntimeSnapshot(malformed));
expectError("runtime_snapshot_serialized_invalid", () => Runtime.deserializeRuntimeSnapshot("not-json"));
expectError("local_runtime_credential_ref_forbidden", () => Runtime.createRuntimeSnapshot({ mode: "local" }, { credentialRef: "provider:local:default" }));

assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|Authorization/);
console.log("runtime_execution_browser_contract=pass");
