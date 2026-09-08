import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Gate = require("../public/runtime-capability-gate.js");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function storage(runtime) {
  const values = new Map([[Gate.CURRENT_RUNTIME_STORAGE_KEY, JSON.stringify(runtime)]]);
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

const pro = { mode: "model", provider: "deepseek", model: "deepseek-v4-pro" };
const vision = { mode: "model", provider: "deepseek", model: "deepseek-v4-flash-vision-exp" };
const incompatible = storage(pro);
for (const operation of ["candidate_image_import", "job_image_import"]) {
  const gate = Gate.operationGate(operation, Gate.operationAuthority(operation, incompatible));
  assert.equal(gate.allowed, false);
  assert.equal(gate.authority.runtime.mode, "model");
  assert.equal(gate.authority.runtime.model, "deepseek-v4-pro");
  assert.equal(gate.authority.capabilities.vision, "unsupported");
}

const routed = storage(vision);
Gate.recordOperationRuntimeSelection(pro, routed);
Gate.recordOperationRuntimeSelection(vision, routed);
for (const operation of ["candidate_image_import", "job_image_import"]) {
  const gate = Gate.operationGate(operation, Gate.operationAuthority(operation, routed));
  assert.equal(gate.allowed, true);
  assert.equal(gate.authority.runtime.model, "deepseek-v4-flash-vision-exp");
  assert.equal(gate.authority.capabilities.vision, "supported");
}
for (const operation of ["candidate_conversation", "job_conversation"]) {
  const gate = Gate.operationGate(operation, Gate.operationAuthority(operation, routed));
  assert.equal(gate.allowed, true);
  assert.equal(gate.authority.runtime.model, "deepseek-v4-flash-vision-exp");
}
const preserved = storage(vision);
Gate.recordOperationRuntimeSelection(vision, preserved);
Gate.recordOperationRuntimeSelection(pro, preserved, { only_unassigned: true });
assert.equal(Gate.runtimeForOperation("candidate_image_import", preserved).model, "deepseek-v4-flash-vision-exp");
assert.equal(Gate.runtimeForOperation("job_conversation", preserved).model, "deepseek-v4-flash-vision-exp");

const local = storage({ mode: "local", provider: null, model: null });
for (const operation of ["candidate_import", "job_import"]) {
  const gate = Gate.operationGate(operation, Gate.operationAuthority(operation, local));
  assert.equal(gate.allowed, true);
  assert.equal(gate.authority.runtime.mode, "local");
  assert.equal(gate.authority.capabilities.semantic_understanding, "unsupported");
}

const pages = read("public/v1-pages.js");
const candidateModelFlow = pages.slice(pages.indexOf("async function executeCandidateModelProcessing"), pages.indexOf("function initPersonalImport"));
const jobModelFlow = pages.slice(pages.indexOf("async function executeJobModelProcessing"), pages.indexOf("async function runJobProcessing"));
assert.match(pages, /candidateImportOperation/);
assert.match(pages, /if \(!source \|\| \["PDF", "IMAGE"\]\.includes\(source\.source_type\)\) return "candidate_image_import"/);
assert.match(pages, /function candidateSourceReadLabel/);
assert.match(pages, /source\?\.source_type === "IMAGE" \? "图片"/);
assert.match(pages, /if \(!selectedJobSources\.length\) return selectedJobImportType === "Paste" \? "job_text_import" : "job_image_import"/);
assert.match(pages, /activeJobSourceDocuments\.map\(\(entry\) => entry\.filename \|\| entry\.label\).*\.join\("、"\)/);
assert.match(pages, /jobImportOperation/);
assert.match(pages, /source_inputs: sourceInputs/);
assert.doesNotMatch(candidateModelFlow, /processCandidateSource|processCandidateProposal|local-candidate-structure/);
assert.doesNotMatch(jobModelFlow, /processJobSource|JobContext\.proposalFor|local-job-extract|local-job-image-ocr/);

const runtimeSelection = read("public/runtime-selection.js");
assert.match(runtimeSelection, /recordOperationRuntimeSelection\(selected\)/);
assert.match(runtimeSelection, /图片 \/ PDF 导入/);

const server = read("app.py");
assert.match(server, /snapshot\.capabilities\.candidate_model_structuring/);
assert.match(server, /snapshot\.capabilities\.job_model_structuring/);
assert.match(read("public/jd-import.html"), /按顺序排列的原始图片发送给 DeepSeek/);

const styles = read("public/styles.css");
const minibarRule = styles.match(/\.v1-mini-sidebar \{[^}]+\}/)?.[0] || "";
assert.match(minibarRule, /right: 18px/);
assert.match(minibarRule, /top: 50%/);
assert.match(minibarRule, /translateY\(-50%\)/);
assert.match(minibarRule, /z-index: 110/);
assert.doesNotMatch(minibarRule, /left: 50%|top: 0|translateX/);
assert.match(styles, /\.v1-workspace-open \.v1-page-shell \{ transform: none; \}/);
assert.match(styles, /\.v1-workspace-open \.v1-workspace-shell \{ width: min\(1280px, calc\(100vw - 174px\)\); \}/);

console.log(JSON.stringify({
  incompatible_image_model_fails_closed: "pass",
  image_import_uses_multimodal_runtime: "pass",
  conversation_uses_multimodal_runtime: "pass",
  local_authority_unchanged: "pass",
  model_flows_exclude_local_semantics: "pass",
  minibar_right_vertical_center: "pass",
}));
