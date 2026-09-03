import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Runtime = require("../public/runtime-capabilities.js");
const Gate = require("../public/runtime-capability-gate.js");
const Truth = require("../public/truth-persistence-domain.js");
const CandidateModel = require("../public/candidate-model-runtime-domain.js");
const Review = require("../public/local-candidate-review-domain.js");

const exactAuthority = Gate.authorityFrom({ mode: "model", provider: "deepseek", model: CandidateModel.MODEL_ID });
const exactGate = Gate.operationGate("candidate_import", exactAuthority);
assert.equal(exactGate.allowed, true);
assert.equal(exactGate.capability, "candidate_model_structuring");
assert.equal(exactAuthority.capabilities.vision, "supported");
for (const operation of ["job_import", "ai_conversation", "model_merge"]) assert.equal(Gate.operationGate(operation, exactAuthority).allowed, false);
const unknownGate = Gate.operationGate("candidate_import", Gate.authorityFrom({ mode: "model", provider: "deepseek", model: "unverified-model" }));
assert.equal(unknownGate.allowed, false);
assert.equal(unknownGate.state, "unverified");

const descriptor = Gate.modelDescriptorForRuntime(exactAuthority.runtime);
const snapshot = Runtime.createRuntimeSnapshot(exactAuthority.runtime, {
  modelDescriptor: descriptor,
  snapshotId: "runtime-snapshot-candidate-model-js-test",
  capturedAt: "2026-09-03T09:00:00Z",
  credentialRef: CandidateModel.CREDENTIAL_REF,
  adapterVersion: CandidateModel.ADAPTER_VERSION,
  promptVersion: CandidateModel.PROMPT_VERSION,
  schemaVersion: CandidateModel.SCHEMA_VERSION,
  deliveryMethod: CandidateModel.DELIVERY_METHOD,
});
assert.equal(snapshot.model, CandidateModel.MODEL_ID);
assert.equal(snapshot.delivery_method, "rendered_pdf_pages");
assert.equal(snapshot.credential_ref, CandidateModel.CREDENTIAL_REF);
assert(Object.isFrozen(snapshot));
assert.throws(() => { snapshot.model = "other"; }, TypeError);

const sourceId = "source-candidate-" + "a".repeat(64);
const source = {
  file: { name: "synthetic-candidate.pdf", type: "application/pdf", size: 1024 },
  source_document_id: sourceId,
  source_type: "PDF",
  mime_type: "application/pdf",
  content_hash: "sha256:" + "a".repeat(64),
  batch_id: "batch-candidate-model-js-test",
};
const sourceDocument = Truth.validateSourceDocument({
  contract_id: "ariadne-source-document-v1", source_document_id: sourceId, source_type: "PDF", filename: source.file.name,
  label: null, mime_type: "application/pdf", content_hash: source.content_hash, created_at: "2026-09-03T09:00:00Z",
  material_type: "CANDIDATE", local_reference: `indexeddb://job-radar-local-first-v1/source_documents/raw-source-payload-v1%3A%3A${sourceId}`,
  batch_id: source.batch_id, provenance: { supplied_by: "USER", raw_source_recoverability: "DURABLE_BROWSER_LOCAL" }, authority: Truth.AUTHORITY.source,
});
const pending = CandidateModel.processingRunFor(source, snapshot.snapshot_id, "PENDING", "2026-09-03T09:01:00Z", { run_id: "run-candidate-model-js-test" });
const running = CandidateModel.processingRunFor(source, snapshot.snapshot_id, "RUNNING", "2026-09-03T09:01:00Z", { run_id: pending.run_id, started_at: "2026-09-03T09:01:00Z" });
const consent = CandidateModel.consentFor(source, snapshot, "2026-09-03T09:00:30Z");
const request = CandidateModel.requestFor({ source, sourceDocument, documentDataUrl: "data:application/pdf;base64,JVBERi0=", snapshot, run: running, consent, candidateMaterialType: "Resume" });
assert.equal(request.consent.explicitly_confirmed, true);
assert.equal(request.source_document.local_reference, sourceDocument.local_reference);
assert(!JSON.stringify(snapshot).includes("Bearer"));

const sourceRef = { source_ref_id: "ref-1", source_document_id: sourceId, location: "p. 2", excerpt_or_reference: "Product Designer", support_relation: "EXPLICIT_SOURCE" };
const candidateProposal = {
  candidate_proposal_id: "provider-proposal-1", source_document_id: sourceId, processing_run_id: running.run_id,
  provider: "deepseek", model: CandidateModel.MODEL_ID, prompt_version: CandidateModel.PROMPT_VERSION, review_status: "NEEDS_REVIEW",
  items: [{
    item_id: "work-1", item_type: "WORK_EXPERIENCE", title: "Product Designer", subtitle: "Synthetic Studio", time: "2024",
    summary: "Designed a documented product flow.", facts: [{ fact_id: "fact-1", label: "Role", value: "Product Designer" }], ownership: null,
    source_refs: [sourceRef], uncertainties: [], review_status: "NEEDS_REVIEW", item_version: 1,
  }],
};
const result = {
  provider: "deepseek", model: CandidateModel.MODEL_ID, protocol: CandidateModel.PROTOCOL,
  adapter_version: CandidateModel.ADAPTER_VERSION, delivery_method: CandidateModel.DELIVERY_METHOD,
  runtime_snapshot_id: snapshot.snapshot_id, source_document_id: sourceId, content_hash: source.content_hash,
  processing_run_id: running.run_id, rendered_page_count: 3, outbound_image_count: 3,
  provider_response_id: "response-synthetic-1", candidate_proposal: candidateProposal, network_call_made: true,
};
const proposals = CandidateModel.proposalsFor({ source, run: running, result, candidateMaterialType: "Resume" });
assert.equal(proposals.length, 1);
assert.equal(proposals[0].status, "AWAITING_REVIEW");
assert.equal(proposals[0].authority, Truth.AUTHORITY.proposal);
assert.equal(proposals[0].payload.items[0].content_origin, "MODEL_PROPOSAL");
assert.equal(proposals[0].payload.items[0].review_status, "NEEDS_REVIEW");
assert.equal(proposals[0].grounding_refs[0].source_document_id, sourceId);

const originalProposal = structuredClone(proposals[0]);
assert.equal(originalProposal.status, "AWAITING_REVIEW");
assert.equal(originalProposal.payload.items[0].review_status, "NEEDS_REVIEW");
const humanConfirmed = Review.outcomeFor({ proposal: proposals[0], decision: "CONFIRM", acceptedPayload: proposals[0].payload, currentRevision: null });
assert.equal(humanConfirmed.revision.payload.items[0].content_origin, "MODEL_PROPOSAL");
assert.equal(humanConfirmed.revision.confirmed_from_proposal_id, proposals[0].proposal_id);
assert.equal(originalProposal.status, "AWAITING_REVIEW");

const stored = { processing_runs: new Map([[running.run_id, running]]), context_proposals: new Map() };
const database = {
  transaction(storeNames) {
    assert.deepEqual(storeNames, ["processing_runs", "context_proposals"]);
    const transaction = {
      objectStore(storeName) {
        return {
          get(key) {
            const request = {};
            queueMicrotask(() => { request.result = stored[storeName].get(key); request.onsuccess?.(); });
            return request;
          },
          add(value) { stored[storeName].set(value.proposal_id, structuredClone(value)); },
          put(value) {
            stored[storeName].set(value.run_id, structuredClone(value));
            queueMicrotask(() => transaction.oncomplete?.());
          },
        };
      },
      abort() { queueMicrotask(() => transaction.onabort?.()); },
    };
    return transaction;
  },
};
const succeeded = await CandidateModel.persistSuccessfulResult(database, running, proposals);
assert.equal(succeeded.status, "SUCCEEDED");
assert.deepEqual(succeeded.proposal_ids, proposals.map((proposal) => proposal.proposal_id));
assert.equal(stored.context_proposals.size, 1);
assert.equal(stored.processing_runs.get(running.run_id).status, "SUCCEEDED");

const cancelledController = new AbortController();
cancelledController.abort();
await assert.rejects(
  CandidateModel.persistSuccessfulResult(database, running, proposals, cancelledController.signal),
  (error) => error.name === "AbortError",
);
assert.equal(stored.context_proposals.size, 1); // Cancellation added no later proposal.
const failed = CandidateModel.processingRunFor(source, snapshot.snapshot_id, "FAILED", "2026-09-03T09:02:00Z", {
  run_id: "run-candidate-model-failed", started_at: "2026-09-03T09:02:00Z", finished_at: "2026-09-03T09:03:00Z", error_code: "model_output_truncated",
});
assert.equal(failed.status, "FAILED");
assert.deepEqual(failed.proposal_ids, []);
assert.equal(failed.error_code, "model_output_truncated");

for (const invalidResult of [
  { ...result, model: "wrong-model" },
  { ...result, rendered_page_count: 3, outbound_image_count: 1 },
  { ...result, candidate_proposal: { ...candidateProposal, items: [{ ...candidateProposal.items[0], source_refs: [] }] } },
]) assert.throws(() => CandidateModel.proposalsFor({ source, run: running, result: invalidResult, candidateMaterialType: "Resume" }));

const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "personal-import.html"), "utf8");
const modelRun = pages.slice(pages.indexOf("async function runCandidateModelProcessing"), pages.indexOf("function initPersonal"));
const consentFlow = pages.slice(pages.indexOf("async function openCandidateModelConsent"), pages.indexOf("async function runCandidateModelProcessing"));
assert.match(html, /id="candidate-model-consent-dialog"/);
assert.match(html, /id="candidate-model-failure-dialog"/);
assert.match(html, /id="confirm-candidate-model-failure" class="v1-dialog-dismiss" type="button">知道了</);
assert.match(html, /deepseek-v4-flash-vision-exp/);
assert.match(html, /这次操作会把当前文件内容发送到模型服务商进行候选人材料理解。/);
assert.doesNotMatch(html, /candidate-model-consent-source|candidate-model-consent-outbound|v1-model-consent-note/);
assert.ok(pages.indexOf("function openCandidateModelConsent") < pages.indexOf("async function runCandidateModelProcessing"));
assert.ok(consentFlow.indexOf("RawSource.resolveRawSource") < consentFlow.indexOf("dialog.showModal()"));
assert.doesNotMatch(consentFlow, /fetch\(|candidate-model-structure/);
assert.ok(modelRun.indexOf("RawSource.resolveRawSource") < modelRun.indexOf('fetch("/api/candidate-model-structure"'));
assert.ok(modelRun.indexOf('"PENDING"') < modelRun.indexOf("RawSource.sourceDocumentForId"));
assert.ok(modelRun.indexOf('status: "RUNNING"') < 0 || modelRun.indexOf('"RUNNING"') < modelRun.indexOf('fetch("/api/candidate-model-structure"'));
assert.match(modelRun, /CandidateModel\.persistSuccessfulResult/);
assert.match(modelRun, /Truth\.cancelProcessingRun/);
assert.match(modelRun, /candidateModelAttemptGeneration/);
assert.match(modelRun, /error\.candidateModelExecution = true/);
assert.match(pages, /confirm-candidate-model-failure"\)\.addEventListener\("click"[\s\S]*candidateExecutionState = "READY"/);
assert.match(pages, /saved-candidate-source-selector/);
assert.match(pages, /function setSavedCandidateSourceMenu\(open\)/);
assert.match(pages, /list\.inert = !open/);
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
assert.match(styles, /\.v1-dialog-dismiss \{[\s\S]*background: transparent;[\s\S]*border: 0;/);
assert.match(styles, /\.v1-dialog-dismiss:hover \{[\s\S]*rgba\(82,111,218,\.08\)/);
assert.match(styles, /\.v1-dialog-dismiss:focus-visible \{[\s\S]*outline: 2px solid #526fda/);
assert.match(styles, /\.v1-saved-source-menu \{[\s\S]*position: absolute;[\s\S]*transition: opacity 200ms ease/);
assert.match(styles, /#candidate-model-failure-dialog p \{ text-align: left; \}/);
assert.match(styles, /\.v1-model-consent-dialog \.v1-button-row \{ justify-content: flex-start; \}/);
assert.doesNotMatch(modelRun, /processCandidateSource|processCandidateProposal|local-candidate-structure|career_evidence|Demo\./);
assert.equal((modelRun.match(/fetch\("\/api\/candidate-model-structure"/g) || []).length, 1);

console.log("candidate_model_runtime_browser_contract=pass");
