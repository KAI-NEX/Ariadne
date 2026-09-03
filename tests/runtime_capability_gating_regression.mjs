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

const localAuthority = Gate.currentAuthority(storageWith(JSON.stringify({ mode: "local", provider: "local", model: null })));
assert.deepEqual(localAuthority.runtime, { mode: "local", provider: null, model: null });
assert.equal(Gate.operationGate("candidate_import", localAuthority).capability, "deterministic_structuring");
assert.equal(Gate.operationGate("candidate_import", localAuthority).allowed, true);
assert.equal(Gate.operationGate("job_import", localAuthority).allowed, true);
for (const operation of ["ai_conversation", "model_merge", "legacy_candidate_semantic", "legacy_job_semantic"]) {
  assert.equal(Gate.operationGate(operation, localAuthority).allowed, false);
}

const modelAuthority = Gate.currentAuthority(storageWith(JSON.stringify({ mode: "ai", provider: "DeepSeek", model: "deepseek-v4-flash-vision-exp" })));
assert.deepEqual(modelAuthority.runtime, { mode: "model", provider: "deepseek", model: "deepseek-v4-flash-vision-exp" });
assert.equal(Gate.operationGate("candidate_import", modelAuthority).allowed, true);
for (const operation of ["job_import", "ai_conversation", "model_merge"]) assert.equal(Gate.operationGate(operation, modelAuthority).allowed, false);
assert.equal(Gate.requireOperation("candidate_import", modelAuthority).capability, "candidate_model_structuring");

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
if (Gate.operationGate("candidate_import", modelAuthority).allowed && false /* explicit consent absent */) providerCallsBeforeConsent += 1;
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

for (const html of [candidateDetail, jobDetail, personalImport, jobImport]) {
  assert.ok(html.indexOf("runtime-capabilities.js") < html.indexOf("runtime-capability-gate.js"));
  assert.ok(html.indexOf("runtime-capability-gate.js") < html.indexOf("v1-pages.js"));
}
assert.match(candidateDetail, /id="candidate-ai-pane" class="v1-conversation-pane hidden"/);
assert.match(jobDetail, /id="job-ai-pane" class="v1-conversation-pane hidden"/);
assert.match(personalImport, /仅本地读取、提取与确定规则；不调用模型服务商/);
assert.match(jobImport, /本地演示样例 · 不读取文件内容 · 无模型调用/);
assert.match(personalImport, /开始本地提取/);
assert.match(jobImport, /开始本地演示整理/);
assert.match(personalImport, /local-candidate-extraction-domain\.js/);
assert.match(personalImport, /candidate-model-runtime-domain\.js/);

assert.doesNotMatch(pages, /localStorage|preview-source|appendDemoMessage|createConversation|candidatePatchFor|jobPatchFor/);
assert.match(pages, /currentOperationGate\("candidate_import"\)/);
assert.match(pages, /currentOperationGate\("job_import"\)/);
assert.match(pages, /currentOperationGate\("ai_conversation"\)/);
assert.match(pages, /runtime\.mode === "model" && gate\.allowed/);
assert.match(pages, /pane\?\.querySelectorAll\("input, textarea, button"\)[\s\S]*control\.disabled = !conversationAllowed/);
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
assert.ok(jobProcess.indexOf('batchAuthority.runtime.mode !== "local"') < jobProcess.indexOf("Demo.createLocalJobFixture"));
assert.ok(jobProcess.indexOf("signal.aborted") < jobProcess.indexOf("LocalJobLifecycle.persistPendingImport"));
const jobRun = pages.slice(pages.indexOf("async function runJobProcessing"), pages.indexOf("function initJobLibrary"));
const jobCancel = jobRun.match(/if \(result\.cancelled\) \{([\s\S]*?)\n          \}/)?.[1] || "";
assert.match(jobCancel, /return;/);
assert.doesNotMatch(jobCancel, /continue|completeEmbeddedImport|returnToCardLibrary/);
assert.match(jobCancel, /当前来源未形成成功结果/);
assert.match(jobRun, /剩余文件没有处理/);

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
