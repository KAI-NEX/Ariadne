import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Gate = require("../public/runtime-capability-gate.js");
const Contract = require("../public/runtime-capabilities.js");
const vision = { mode: "model", provider: "deepseek", model: "deepseek-flash" };
const pro = { mode: "ai", provider: "deepseek", model: "deepseek-v4-pro" };
const descriptor = Gate.CANDIDATE_CONVERSATION_MODEL_ADAPTER;

// The same minimum input rule applies to every future Provider, regardless of name.
for (const provider of ["deepseek", "gemini", "qwen", "future-provider"]) {
  const qualified = { ...descriptor, provider_id: provider };
  assert.equal(Contract.isEligibleModelDescriptor(qualified), true);
  for (const override of [
    { capabilities: ["TEXT"] }, { multimodal_readiness: "UNVERIFIED" },
    { supports_complete_document_review: false }, { document_delivery: "text_extraction" },
    { document_delivery: null }, { runtime_capability_basis: "account_discovered" },
    { runtime_capabilities: { ...descriptor.runtime_capabilities, vision: "unsupported" } },
  ]) assert.equal(Contract.isEligibleModelDescriptor({ ...qualified, ...override }), false);
}
assert.equal(Contract.isEligibleModelDescriptor({ ...descriptor, document_delivery: "original_pdf" }), true);

const values = new Map();
const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
storage.setItem(Gate.CURRENT_RUNTIME_STORAGE_KEY, JSON.stringify(pro));
const oldAssignments = JSON.stringify({ candidate_conversation: pro, job_conversation: pro, candidate_image_import: vision });
storage.setItem(Gate.OPERATION_RUNTIME_STORAGE_KEY, oldAssignments);
for (const operation of ["candidate_image_import", "job_image_import", "candidate_conversation", "job_conversation"]) {
  const gate = Gate.operationGate(operation, Gate.operationAuthority(operation, storage));
  assert.equal(gate.allowed, false);
  assert.equal(gate.authority.runtime.model, pro.model);
  assert.equal(gate.authority.runtime.mode, "model");
}
assert.equal(storage.getItem(Gate.OPERATION_RUNTIME_STORAGE_KEY), oldAssignments);
storage.setItem(Gate.CURRENT_RUNTIME_STORAGE_KEY, JSON.stringify(vision));
for (const operation of ["candidate_image_import", "job_image_import", "candidate_conversation", "job_conversation"]) {
  const gate = Gate.operationGate(operation, Gate.operationAuthority(operation, storage));
  assert.equal(gate.allowed, true);
  assert.equal(gate.authority.runtime.model, vision.model);
}
assert.equal(storage.getItem(Gate.OPERATION_RUNTIME_STORAGE_KEY), oldAssignments);

// Exercise actual selector functions with legacy/forged saved records, not source regexes.
const source = fs.readFileSync(new URL("../public/runtime-selection.js", import.meta.url), "utf8");
const elements = new Map();
const document = { getElementById(id) {
  if (!elements.has(id)) elements.set(id, { textContent: "", classList: { toggle() {} } });
  return elements.get(id);
} };
const window = { location: { hostname: "127.0.0.1" }, JobRadarRuntimeGate: Gate, AriadneRuntimeExecution: Contract };
const selector = new Function("window", "localStorage", "sessionStorage", "document",
  source.slice(0, source.indexOf('byId("runtime-selector").addEventListener'))
  + "\nreturn { state, selectableModels, restoreAddedModels, restoreSelectedRuntime, applyReadyModel };")
  (window, storage, storage, document);
const saved = JSON.stringify([
  { ...descriptor, model_id: pro.model, connection_verified: true },
  { ...descriptor, provider_id: "gemini", model_id: "invented-vision", connection_verified: true },
  { ...descriptor, connection_verified: true },
]);
storage.setItem("job-radar-added-runtime-models", saved);
storage.setItem(Gate.CURRENT_RUNTIME_STORAGE_KEY, JSON.stringify(pro));
selector.restoreAddedModels();
selector.restoreSelectedRuntime();
assert.equal(selector.state.phase, "FAILED");
assert.match(elements.get("runtime-message").textContent, /图片和 PDF/);
assert.equal(storage.getItem("job-radar-added-runtime-models"), saved);
assert.deepEqual(selector.selectableModels().map((model) => model.model_id), [vision.model]);
assert.equal(selector.applyReadyModel(descriptor), true);
assert.equal(selector.state.model, vision.model);

console.log("multimodal_runtime_policy=pass; legacy_storage_preserved; no_text_or_unknown_bypass");
