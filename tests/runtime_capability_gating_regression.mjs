import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const require = createRequire(import.meta.url);
const Gate = require("../public/runtime-capability-gate.js");
const Demo = require("../public/v1-demo-domain.js");

function storageWith(value) {
  return { getItem: (key) => key === Gate.CURRENT_RUNTIME_STORAGE_KEY ? value : null };
}

function memoryStorage(runtime) {
  const values = new Map([[Gate.CURRENT_RUNTIME_STORAGE_KEY, JSON.stringify(runtime)]]);
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

const localAuthority = Gate.currentAuthority(storageWith(JSON.stringify({ mode: "local", provider: "local", model: null })));
assert.deepEqual(localAuthority.runtime, { mode: "local", provider: null, model: null });
assert.equal(Gate.operationGate("candidate_import", localAuthority).capability, "deterministic_structuring");
assert.equal(Gate.operationGate("candidate_import", localAuthority).allowed, true);
assert.equal(Gate.operationGate("job_import", localAuthority).allowed, true);
for (const operation of ["ai_conversation", "model_merge", "legacy_candidate_semantic", "legacy_job_semantic"]) {
  assert.equal(Gate.operationGate(operation, localAuthority).allowed, false);
}

const visionRuntime = { mode: "ai", provider: "DeepSeek", model: "deepseek-v4-flash-vision-exp" };
const modelAuthority = Gate.authorityFrom(visionRuntime, "candidate_image_import");
assert.deepEqual(modelAuthority.runtime, { mode: "model", provider: "deepseek", model: "deepseek-v4-flash-vision-exp" });
assert.equal(Gate.operationGate("candidate_image_import", modelAuthority).allowed, true);
for (const operation of ["job_import", "ai_conversation", "model_merge"]) assert.equal(Gate.operationGate(operation, modelAuthority).allowed, false);
assert.equal(Gate.requireOperation("candidate_image_import", modelAuthority).capability, "candidate_model_structuring");

const conversationAuthority = Gate.authorityFrom({ mode: "model", provider: "deepseek", model: "deepseek-v4-pro" });
assert.equal(Gate.operationGate("ai_conversation", conversationAuthority).allowed, true);
assert.equal(Gate.operationGate("candidate_import", conversationAuthority).allowed, false);
assert.equal(conversationAuthority.capabilities.vision, "unsupported");
assert.equal(Gate.modelDescriptorForRuntime(conversationAuthority.runtime), Gate.CANDIDATE_CONVERSATION_MODEL_ADAPTER);
assert.equal(Gate.modelDescriptorForRuntime(conversationAuthority.runtime, "candidate_conversation"), Gate.CANDIDATE_CONVERSATION_MODEL_ADAPTER);
assert.equal(Gate.modelDescriptorForRuntime(conversationAuthority.runtime, "job_conversation"), Gate.JOB_CONVERSATION_MODEL_ADAPTER);
assert.equal(Gate.modelDescriptorForRuntime(conversationAuthority.runtime, "job_model_import"), Gate.DEEPSEEK_PRO_MODEL_DESCRIPTOR);
const jobModelImportAuthority = Gate.authorityFrom(conversationAuthority.runtime, "job_model_import");
assert.equal(Gate.operationGate("job_model_import", jobModelImportAuthority).allowed, false);
assert.equal(jobModelImportAuthority.capabilities.job_model_structuring, "unsupported");
assert.equal(conversationAuthority.capabilities.job_model_structuring, "unsupported");
const jobImageAuthority = Gate.authorityFrom(visionRuntime, "job_image_import");
assert.equal(Gate.operationGate("job_image_import", jobImageAuthority).allowed, true);
assert.equal(jobImageAuthority.capabilities.vision, "supported");
assert.equal(Gate.modelDescriptorForRuntime(jobImageAuthority.runtime, "job_image_import"), Gate.JOB_MULTIMODAL_IMPORT_ADAPTER);
assert.equal(Gate.authorityFrom(conversationAuthority.runtime, "candidate_conversation").capabilities.ai_conversation, "supported");
assert.equal(Gate.authorityFrom(conversationAuthority.runtime, "job_conversation").capabilities.ai_conversation, "supported");
assert.equal(Gate.operationGate("candidate_conversation").operation, "candidate_conversation");

const routedStorage = memoryStorage({ mode: "ai", provider: "deepseek", model: "deepseek-v4-pro" });
Gate.recordOperationRuntimeSelection({ mode: "model", provider: "deepseek", model: "deepseek-v4-pro" }, routedStorage);
Gate.recordOperationRuntimeSelection({ mode: "model", provider: "deepseek", model: "deepseek-v4-flash-vision-exp" }, routedStorage);
assert.equal(Gate.runtimeForOperation("job_conversation", routedStorage).model, "deepseek-v4-pro");
assert.equal(Gate.runtimeForOperation("candidate_image_import", routedStorage).model, "deepseek-v4-flash-vision-exp");
assert.equal(Gate.runtimeForOperation("job_image_import", routedStorage).model, "deepseek-v4-flash-vision-exp");
const incompatibleStorage = memoryStorage({ mode: "ai", provider: "deepseek", model: "deepseek-v4-pro" });
assert.equal(Gate.operationGate("job_image_import", Gate.operationAuthority("job_image_import", incompatibleStorage)).allowed, false);

assert.equal(Gate.currentAuthority(storageWith(null)).runtime.mode, "local");
assert.throws(() => Gate.currentAuthority(storageWith("{not-json")), (error) => error.code === "current_runtime_storage_malformed");
assert.throws(() => Gate.authorityFrom({ mode: "hybrid" }), (error) => error.code === "current_runtime_invalid");

const exactLegacy = Gate.legacyProviderAction({
  provider: "deepseek", model: "deepseek-v4-flash-vision-exp", capability: "candidate_model_structuring",
}, modelAuthority);
assert.equal(exactLegacy.identity_matches, true);
assert.equal(exactLegacy.allowed, true);
assert.equal(exactLegacy.state, "supported");
assert.equal(Gate.legacyProviderAction({ provider: "gemini", capability: "candidate_model_structuring" }, modelAuthority).identity_matches, false);
assert.equal(Gate.legacyProviderAction({ provider: "deepseek", capability: "job_model_structuring" }, localAuthority).allowed, false);

let providerCallsBeforeConsent = 0;
if (Gate.operationGate("candidate_image_import", modelAuthority).allowed && false /* explicit consent absent */) providerCallsBeforeConsent += 1;
assert.equal(providerCallsBeforeConsent, 0);

const historicalRecord = Demo.clone({
  item_id: "historical-model-record",
  imported_from: { network_sent: true, provider_id: "gemini", model_id: "gemini-3.7-flash" },
  runtime_snapshot_id: "runtime-snapshot-historical",
});
const historicalBefore = Demo.clone(historicalRecord);
Gate.operationGate("candidate_import", localAuthority);
Gate.operationGate("candidate_import", modelAuthority);
assert.deepEqual(historicalRecord, historicalBefore);

const pages = read("public/v1-pages.js");
const candidateDetail = read("public/candidate-detail.html");
const jobDetail = read("public/job-detail.html");
const personalImport = read("public/personal-import.html");
const jobImport = read("public/jd-import.html");
const careerHtml = read("public/career-evidence.html");
const careerJs = read("public/career-evidence.js");
const localHtml = read("public/local-first.html");
const localJs = read("public/local-first.js");
const productShell = read("public/product-shell-domain.js");

for (const html of [candidateDetail, jobDetail, personalImport, jobImport]) {
  assert.ok(html.indexOf("runtime-capabilities.js") < html.indexOf("runtime-capability-gate.js"));
  assert.ok(html.indexOf("runtime-capability-gate.js") < html.indexOf("v1-pages.js"));
}
assert.match(candidateDetail, /id="candidate-ai-pane" class="v1-conversation-pane hidden"/);
assert.match(jobDetail, /id="job-ai-pane" class="v1-conversation-pane hidden"/);
assert.match(pages, /仅本地读取、提取与确定规则；不调用模型服务商/);
assert.match(pages, /本地读取真实内容 · 原始来源持久保留 · 无模型调用/);
assert.match(personalImport, /开始本地提取/);
assert.match(jobImport, /开始本地整理/);
assert.doesNotMatch(jobImport, /data-job-processing-mode|id="job-processing-modes"/);
assert.match(personalImport, /local-candidate-extraction-domain\.js/);
assert.match(personalImport, /candidate-model-runtime-domain\.js/);
assert.match(jobImport, /local-job-extraction-domain\.js/);
assert.match(jobImport, /job-context-domain\.js/);

assert.doesNotMatch(pages, /localStorage|preview-source|appendDemoMessage|createConversation|candidatePatchFor|jobPatchFor/);
assert.match(pages, /candidateImportOperation\(\)/);
assert.match(pages, /jobImportOperation\(\)/);
assert.match(pages, /currentOperationGate\(operation\)/);
assert.match(pages, /"candidate_conversation"/);
assert.match(pages, /"job_conversation"/);
assert.match(pages, /runtime\.mode === "model" && gate\.allowed/);
assert.match(pages, /ProductShell\.applyDetailRuntime\(shell,/);
assert.match(productShell, /shell\.conversationPane\.querySelectorAll\("input, textarea, button"\)[\s\S]*control\.disabled = !conversationAllowed/);
assert.match(pages, /fetch\("\/api\/local-ocr-capability"/);
assert.match(pages, /fetch\(image \? "\/api\/local-candidate-image-ocr" : "\/api\/local-candidate-extract"/);
assert.match(pages, /fetch\("\/api\/candidate-model-structure"/);
assert.doesNotMatch(pages, /fetch\("\/api\/local-ocr"/);

const candidateProcess = pages.slice(pages.indexOf("async function processCandidateSource"), pages.indexOf("async function runCandidateProcessing"));
assert.match(candidateProcess, /persistCanonicalSource/);
assert.match(candidateProcess, /extraction_artifacts/);
assert.doesNotMatch(candidateProcess, /createLocalCandidateFixtures|persistCandidateImport|findCandidateDuplicates/);
const candidateRun = pages.slice(pages.indexOf("async function runCandidateProcessing"), pages.indexOf("function initPersonal"));
const candidateCancel = candidateRun.match(/if \(result\.cancelled\) \{([\s\S]*?)\n        \}/)?.[1] || "";
assert.match(candidateCancel, /return;/);
assert.doesNotMatch(candidateCancel, /continue|completeEmbeddedImport|returnToCardLibrary/);
assert.match(candidateRun, /createRuntimeSnapshot/);
assert.match(candidateProcess, /snapshot\.snapshot_id/);

const jobProcess = pages.slice(pages.indexOf("async function processJobSource"), pages.indexOf("async function runJobProcessing"));
assert.ok(jobProcess.indexOf('snapshot.mode !== "local"') < jobProcess.indexOf("LocalJob.persistCanonicalSource"));
assert.ok(jobProcess.indexOf("LocalJob.persistCanonicalSource") < jobProcess.indexOf("signal.aborted"));
assert.match(jobProcess, /extraction_artifacts/);
assert.match(jobProcess, /JobContext\.proposalFor/);
assert.doesNotMatch(jobProcess, /Demo\.createLocalJobFixture|LocalJobLifecycle\.persistPendingImport/);
const jobRun = pages.slice(pages.indexOf("async function runJobProcessing"), pages.indexOf("function jobReviewMarkup"));
assert.match(jobRun, /const gate = refreshJobImportGate\(\)/);
assert.doesNotMatch(jobRun, /currentOperationGate|modelDescriptorForRuntime|job_model_structuring/);
const jobCancel = jobRun.match(/if \(result\.cancelled\) \{([\s\S]*?)\n          \}/)?.[1] || "";
assert.match(jobCancel, /return;/);
assert.doesNotMatch(jobCancel, /continue|completeEmbeddedImport|returnToCardLibrary/);
assert.match(jobCancel, /当前来源未形成成功结果/);
assert.match(jobRun, /剩余文件没有处理/);
const jobGate = pages.slice(pages.indexOf("function refreshJobImportGate"), pages.indexOf("function formatBytes"));
assert.match(jobGate, /RuntimeGate\.readStoredRuntime\(\)/);
assert.match(jobGate, /currentOperationGate\(modelMode \? jobImportOperation\(\) : "job_import"\)/);
assert.match(jobGate, /byId\("job-file-input"\)\.disabled = jobProcessingInProgress \|\| !gate\.allowed/);
assert.match(jobGate, /byId\("job-dropzone"\)\.disabled = jobProcessingInProgress \|\| !gate\.allowed/);
assert.doesNotMatch(jobGate, /authorityFrom\(\{ mode: "(?:local|model)"/);

for (const labels of [Demo.CANDIDATE_PROCESSING_STATES, Demo.JOB_PROCESSING_STATES]) {
  for (const [, label] of labels) assert.doesNotMatch(label, /AI|模型|理解|识别/);
}

assert.ok(careerHtml.indexOf("runtime-capability-gate.js") < careerHtml.indexOf("career-evidence.js"));
assert.match(careerHtml, /id="deepseek-document-preflight"[^>]*disabled/);
assert.match(careerHtml, /id="gemini-document-preflight"[^>]*disabled/);
assert.match(careerJs, /RuntimeGate\.legacyProviderAction/);
assert.ok(careerJs.indexOf("if (!providerGate.allowed)") < careerJs.indexOf('fetch("/api/ai-career-ingest"'));
assert.ok(localHtml.indexOf("runtime-capability-gate.js") < localHtml.indexOf("local-first.js"));
assert.match(localHtml, /id="vision-button"[^>]*disabled/);
assert.match(localJs, /RuntimeGate\.legacyProviderAction/);
assert.ok(localJs.indexOf("if (!jobProviderGate().allowed)") < localJs.indexOf('fetch("/api/vision-extract"'));

console.log("runtime_capability_gating_browser=pass");
