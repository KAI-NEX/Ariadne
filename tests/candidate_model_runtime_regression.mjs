import { resolveVICSS } from "./helpers/vi-css.mjs";
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
const productShell = fs.readFileSync(path.join(root, "public/product-shell-domain.js"), "utf8");

const exactAuthority = Gate.authorityFrom({ mode: "model", provider: "deepseek", model: CandidateModel.MODEL_ID }, "candidate_image_import");
const exactGate = Gate.operationGate("candidate_image_import", exactAuthority);
assert.equal(exactGate.allowed, true);
assert.equal(exactGate.capability, "candidate_model_structuring");
assert.equal(exactAuthority.capabilities.vision, "supported");
for (const operation of ["job_import", "ai_conversation", "model_merge"]) assert.equal(Gate.operationGate(operation, exactAuthority).allowed, false);
const unknownGate = Gate.operationGate("candidate_import", Gate.authorityFrom({ mode: "model", provider: "deepseek", model: "unverified-model" }));
assert.equal(unknownGate.allowed, false);
assert.equal(unknownGate.state, "unverified");

const descriptor = Gate.modelDescriptorForRuntime(exactAuthority.runtime, "candidate_image_import");
const snapshot = Runtime.createRuntimeSnapshot(exactAuthority.runtime, {
  modelDescriptor: descriptor,
  snapshotId: "runtime-snapshot-candidate-model-js-test",
  capturedAt: "2026-09-03T09:00:00Z",
  credentialRef: CandidateModel.CREDENTIAL_REF,
  adapterVersion: CandidateModel.ADAPTER_VERSION,
  promptVersion: CandidateModel.PROMPT_VERSION,
  schemaVersion: CandidateModel.SCHEMA_VERSION,
  operation: "CANDIDATE_IMAGE_IMPORT",
  deliveryMethod: CandidateModel.DELIVERY_METHOD,
});
assert.equal(snapshot.model, CandidateModel.MODEL_ID);
assert.equal(snapshot.delivery_method, "source_or_rendered_images");
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
const consent = CandidateModel.consentFor(source, snapshot, "2026-09-03T09:00:30Z", "consent-candidate-model-js-test");
const operationIdentity = await CandidateModel.operationIdentityFor(source, snapshot, consent);
assert.deepEqual(await CandidateModel.operationIdentityFor(source, snapshot, consent), operationIdentity);
assert.notEqual((await CandidateModel.operationIdentityFor(source, snapshot, CandidateModel.consentFor(source, snapshot, "2026-09-03T09:00:30Z", "different-consent"))).operation_id, operationIdentity.operation_id);
const pending = CandidateModel.processingRunFor(source, snapshot.snapshot_id, "PENDING", "2026-09-03T09:01:00Z", { run_id: `run-${operationIdentity.operation_id}` });
const running = CandidateModel.processingRunFor(source, snapshot.snapshot_id, "RUNNING", "2026-09-03T09:01:00Z", { run_id: pending.run_id, started_at: "2026-09-03T09:01:00Z" });
const request = CandidateModel.requestFor({ source, sourceDocument, documentDataUrl: "data:application/pdf;base64,JVBERi0=", snapshot, run: running, consent, operationIdentity });
assert.equal(request.consent.explicitly_confirmed, true);
assert.equal(request.operation_identity.operation_id, operationIdentity.operation_id);
assert.equal(request.processing_run_id, `run-${operationIdentity.operation_id}`);
assert(!("candidate_material_type" in request));
assert.equal(request.source_document.local_reference, sourceDocument.local_reference);
assert(!JSON.stringify(snapshot).includes("Bearer"));

const sourceRef = { source_ref_id: "ref-1", source_document_id: sourceId, location: "p. 2", excerpt_or_reference: "Product Designer", support_relation: "EXPLICIT_SOURCE" };
const candidateProposal = {
  candidate_proposal_id: "provider-proposal-1", source_document_id: sourceId, processing_run_id: running.run_id,
  provider: "deepseek", model: CandidateModel.MODEL_ID, prompt_version: CandidateModel.PROMPT_VERSION, review_status: "NEEDS_REVIEW",
  material_type: "resume",
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
  operation_id: operationIdentity.operation_id, provider_response_id: "response-synthetic-1", candidate_proposal: candidateProposal, network_call_made: true,
};
const proposals = CandidateModel.proposalsFor({ source, run: running, result, operationIdentity });
assert.equal(proposals.length, 1);
assert.equal(proposals[0].status, "AWAITING_REVIEW");
assert.equal(proposals[0].authority, Truth.AUTHORITY.proposal);
assert.equal(proposals[0].payload.items[0].content_origin, "MODEL_PROPOSAL");
assert.equal(proposals[0].payload.items[0].review_status, "NEEDS_REVIEW");
assert.equal(proposals[0].payload.candidate_material_type, "resume");
assert.equal(proposals[0].payload.candidate_material_type_source, "MODEL_INFERRED");
assert.equal(proposals[0].payload.working_projection, true);
assert.deepEqual(proposals[0].payload.provenance_layers, ["SOURCE_EVIDENCE", "MODEL_INFERRED"]);
assert.equal(proposals[0].grounding_refs[0].source_document_id, sourceId);
assert.equal(CandidateModel.workingCardsFor(proposals)[0].authority, Truth.AUTHORITY.proposal);
const workingModel = await CandidateModel.candidateWorkingModelFor(proposals, null, "2026-09-03T09:04:00Z");
assert.equal(workingModel.authority, Truth.AUTHORITY.working);
assert.equal(workingModel.version, 1);
assert.deepEqual(workingModel.proposal_ids, proposals.map((proposal) => proposal.proposal_id));
const editedWorkingModel = await CandidateModel.editedCandidateWorkingModel(workingModel, "work-1", { title: "Senior Product Designer", subtitle: "Synthetic Studio", time: "2024", summary: "User clarified the role.", facts: ["Senior Product Designer"] }, "2026-09-03T09:05:00Z");
assert.equal(editedWorkingModel.version, 2);
assert.equal(editedWorkingModel.previous_working_model_id, workingModel.working_model_id);
assert.equal(editedWorkingModel.payload.items[0].content_origin, "USER_EDITED");
assert.equal(editedWorkingModel.payload.items[0].working_provenance.support_relation, "USER_EDITED");
const confirmedWorkingModel = await CandidateModel.editedCandidateWorkingModel(workingModel, "work-1", { title: "Senior Product Designer", subtitle: "Synthetic Studio", time: "2024", summary: "User confirmed the role.", facts: ["Senior Product Designer"] }, "2026-09-03T09:05:30Z", "USER_CONFIRMED");
assert.equal(confirmedWorkingModel.payload.items[0].content_origin, "USER_CONFIRMED");
assert.equal(confirmedWorkingModel.payload.items[0].working_provenance.support_relation, "USER_CONFIRMED");
const legacyConfirmedRevision = Truth.validateContextRevision({
  contract_id: "ariadne-context-revision-v1", context_type: "CANDIDATE", context_id: "candidate-context-synthetic-legacy",
  revision_id: "candidate-context-synthetic-legacy-v1", version: 1, previous_revision_id: null,
  confirmed_from_proposal_id: proposals[0].proposal_id, review_decision_id: "review-synthetic-legacy",
  created_at: "2026-09-03T09:05:45Z", provenance: { source_document_ids: [sourceId], processing_run_id: running.run_id, runtime_snapshot_id: snapshot.snapshot_id },
  payload: { ...structuredClone(workingModel.payload), items: [{ ...structuredClone(workingModel.payload.items[0]), item_id: "legacy-work-1", title: "Confirmed Legacy Role", review_status: "CONFIRMED", content_origin: "USER_CONFIRMED" }] },
  authority: Truth.AUTHORITY.revision,
});
const bootstrappedDetailWorking = await CandidateModel.synchronizedCandidateWorkingModel(null, legacyConfirmedRevision, "legacy-work-1", sourceId, "2026-09-03T09:05:50Z");
assert.equal(bootstrappedDetailWorking.version, 1);
assert.equal(bootstrappedDetailWorking.previous_working_model_id, null);
assert.equal(bootstrappedDetailWorking.payload.items[0].title, "Confirmed Legacy Role");
assert.equal(bootstrappedDetailWorking.payload.items[0].content_origin, "USER_CONFIRMED");
const mergedDetailWorking = await CandidateModel.synchronizedCandidateWorkingModel(editedWorkingModel, legacyConfirmedRevision, "legacy-work-1", sourceId, "2026-09-03T09:05:55Z");
assert.equal(mergedDetailWorking.version, editedWorkingModel.version + 1);
assert.equal(mergedDetailWorking.previous_working_model_id, editedWorkingModel.working_model_id);
assert.equal(mergedDetailWorking.payload.items.find((item) => item.item_id === "legacy-work-1").title, "Confirmed Legacy Role");
assert.equal(mergedDetailWorking.payload.items.find((item) => item.item_id === "work-1").title, "Senior Product Designer");
assert.deepEqual(await CandidateModel.synchronizedCandidateWorkingModel(mergedDetailWorking, legacyConfirmedRevision, "legacy-work-1", sourceId, "2026-09-03T09:06:00Z"), mergedDetailWorking);
const workspaceOutcome = Truth.applyWorkspaceAcceptance({ working_model: editedWorkingModel, proposals, current_revision: null, expected_revision_version: 0, context_id: "candidate-workspace-context-synthetic", acceptance_id: "candidate-workspace-acceptance-synthetic", revision_id: "candidate-workspace-revision-synthetic", accepted_at: "2026-09-03T09:06:00Z" });
assert.equal(workspaceOutcome.revision.workspace_acceptance_id, workspaceOutcome.workspace_acceptance.acceptance_id);
assert(!("review_decision_id" in workspaceOutcome.revision));

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
await assert.rejects(
  CandidateModel.persistSuccessfulResult(database, running, proposals, undefined, () => false),
  /candidate_model_processing_run_stale/,
);
assert.equal(stored.context_proposals.size, 0);
assert.equal(stored.processing_runs.get(running.run_id).status, "RUNNING");
const succeeded = await CandidateModel.persistSuccessfulResult(database, running, proposals);
assert.equal(succeeded.status, "SUCCEEDED");
assert.deepEqual(succeeded.proposal_ids, proposals.map((proposal) => proposal.proposal_id));
assert.equal(stored.context_proposals.size, 1);
assert.equal(stored.processing_runs.get(running.run_id).status, "SUCCEEDED");
const deletePlan = Review.sourceHardDeletePlan({
  source_documents: [sourceDocument], extraction_artifacts: [], processing_runs: [succeeded], context_proposals: proposals,
  context_review_decisions: [], candidate_working_models: [workingModel, editedWorkingModel], candidate_workspace_acceptances: [workspaceOutcome.workspace_acceptance], candidate_context_revisions: [workspaceOutcome.revision], candidate_context_lifecycle: [],
}, sourceId);
assert.deepEqual(deletePlan.processing_runs, [running.run_id]);
assert.deepEqual(deletePlan.context_proposals, proposals.map((proposal) => proposal.proposal_id));
assert.deepEqual(deletePlan.candidate_working_models, [workingModel.working_model_id, editedWorkingModel.working_model_id]);
assert.deepEqual(deletePlan.candidate_workspace_acceptances, [workspaceOutcome.workspace_acceptance.acceptance_id]);
assert.deepEqual(deletePlan.candidate_context_revisions, [workspaceOutcome.revision.revision_id]);

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

let claimPresent = false;
const claimDatabase = {
  transaction(storeNames) {
    assert.deepEqual(storeNames, ["processing_runs"]);
    const transaction = { objectStore() { return { add() {
      const request = {};
      queueMicrotask(() => {
        if (claimPresent) {
          request.error = { name: "ConstraintError" };
          request.onerror?.({ preventDefault() {}, stopPropagation() {} });
        } else claimPresent = true;
        transaction.oncomplete?.();
      });
      return request;
    } }; } };
    return transaction;
  },
};
assert.equal(await CandidateModel.claimProcessingRun(claimDatabase, pending), true);
assert.equal(await CandidateModel.claimProcessingRun(claimDatabase, pending), false);

const duplicateItem = { ...candidateProposal.items[0], item_id: "provider-random-duplicate" };
const deduped = CandidateModel.proposalsFor({ source, run: running, operationIdentity, result: { ...result, candidate_proposal: { ...candidateProposal, items: [candidateProposal.items[0], duplicateItem] } } });
assert.equal(deduped.length, 1);
const distinctRole = { ...candidateProposal.items[0], item_id: "work-2", title: "Design Lead", time: "2025", facts: [{ fact_id: "fact-2", label: "Role", value: "Design Lead" }] };
const distinct = CandidateModel.proposalsFor({ source, run: running, operationIdentity, result: { ...result, candidate_proposal: { ...candidateProposal, items: [candidateProposal.items[0], distinctRole] } } });
assert.equal(distinct.length, 2);
assert.notEqual(distinct[0].proposal_id, distinct[1].proposal_id);

for (const invalidResult of [
  { ...result, model: "wrong-model" },
  { ...result, rendered_page_count: 3, outbound_image_count: 1 },
  { ...result, candidate_proposal: { ...candidateProposal, items: [{ ...candidateProposal.items[0], source_refs: [] }] } },
]) assert.throws(() => CandidateModel.proposalsFor({ source, run: running, result: invalidResult, operationIdentity }));

const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "personal-import.html"), "utf8");
const modelWorkspaceUi = fs.readFileSync(path.join(root, "public", "model-workspace-ui-domain.js"), "utf8");
const server = fs.readFileSync(path.join(root, "app.py"), "utf8");
const modelRun = pages.slice(pages.indexOf("async function executeCandidateModelProcessing"), pages.indexOf("function initPersonal"));
const consentFlow = pages.slice(pages.indexOf("async function openCandidateModelConsent"), pages.indexOf("function runCandidateModelProcessing"));
assert.match(html, /id="candidate-model-consent-dialog"/);
assert.match(html, /id="candidate-model-failure-dialog"/);
assert.match(html, /id="confirm-candidate-model-failure" class="v1-dialog-dismiss" type="button">知道了</);
assert.match(html, /id="candidate-model-consent-model"/);
assert.match(pages, /candidate-model-consent-model"\)\.textContent = gate\.authority\.runtime\.model/);
assert.match(html, /这次操作会把当前文件内容发送到模型服务商进行候选人材料理解。/);
assert.doesNotMatch(html, /candidate-model-consent-source|candidate-model-consent-outbound|v1-model-consent-note/);
assert.ok(pages.indexOf("function openCandidateModelConsent") < pages.indexOf("function runCandidateModelProcessing"));
assert.ok(consentFlow.indexOf("SourceInput.persistDurableBundle") < consentFlow.indexOf("dialog.showModal()"));
assert.doesNotMatch(consentFlow, /fetch\(|candidate-model-structure/);
assert.ok(modelRun.indexOf("RawSource.resolveRawSource") < modelRun.indexOf('fetch("/api/candidate-model-structure"'));
assert.ok(modelRun.indexOf('"PENDING"') < modelRun.indexOf("RawSource.sourceDocumentForId"));
assert.ok(modelRun.indexOf('status: "RUNNING"') < 0 || modelRun.indexOf('"RUNNING"') < modelRun.indexOf('fetch("/api/candidate-model-structure"'));
assert.match(modelRun, /CandidateModel\.persistSuccessfulResult/);
assert.match(modelRun, /CandidateModel\.claimProcessingRun/);
assert.match(modelRun, /renderCandidateWorkingWorkspace/);
assert.match(modelRun, /isCurrentOperation/);
assert.doesNotMatch(modelRun, /persistDecision|candidate_context_revisions|context_review_decisions/);
assert.doesNotMatch(modelRun, /processCandidateSource|processCandidateProposal|local-candidate-structure/);
assert.match(modelRun, /Truth\.cancelProcessingRun/);
assert.match(modelRun, /candidateModelAttemptGeneration/);
assert.match(modelRun, /error\.candidateModelExecution = true/);
assert.match(pages, /confirm-candidate-model-failure"\)\.addEventListener\("click"[\s\S]*candidateExecutionState = "READY"/);
assert.match(pages, /saved-candidate-source-selector/);
assert.match(pages, /function setSavedCandidateSourceMenu\(open\)/);
assert.match(pages, /list\.inert = !open/);
const styles = resolveVICSS(fs.readFileSync(path.join(root, "public", "styles.css"), "utf8"));
assert.match(styles, /\.v1-dialog-dismiss \{[\s\S]*background: transparent;[\s\S]*border: 0;/);
assert.match(styles, /\.v1-dialog-dismiss:hover \{[\s\S]*rgba\(82,111,218,\.08\)/);
assert.match(styles, /\.v1-dialog-dismiss:focus-visible \{[\s\S]*outline: 2px solid #526fda/);
assert.match(html, /class="runtime-selector v1-saved-source-trigger"/);
assert.match(html, /class="runtime-menu v1-saved-source-list v1-saved-source-menu"/);
assert.match(html, /id="saved-candidate-sources"[\s\S]*id="personal-dropzone"/);
assert.doesNotMatch(html, /use-new-candidate-source|use-saved-candidate-source|上传新文件|选择已保存 PDF/);
assert.match(html, /已保存在本机的资料/);
assert.match(html, /选择已保存在本机的资料/);
assert.match(pages, /选择已保存在本机的资料/);
assert.doesNotMatch(pages, /candidateSourceMode|setCandidateSourceMode|use-new-candidate-source|use-saved-candidate-source/);
assert.doesNotMatch(styles, /candidate-source-mode|v1-source-mode-action/);
assert.match(styles, /\.v1-saved-source-menu \{ z-index: 30; \}/);
assert.match(styles, /data-candidate-import-runtime="model-ready"\][\s\S]*#personal-file-preview/);
const savedSourceSelection = pages.slice(pages.indexOf("async function selectSavedCandidatePdf"), pages.indexOf("function proposalItemEditor"));
const uploadedSourceSelection = pages.slice(pages.indexOf("const acceptCandidateFiles"), pages.indexOf("candidateSourceInputBinding = SourceInput.bind"));
assert.match(savedSourceSelection, /selectedCandidateSources = \[\{/);
assert.doesNotMatch(savedSourceSelection, /renderCandidateWorkingWorkspace/);
assert.match(uploadedSourceSelection, /selectedCandidateSources = SourceInput\.mergeSources/);
assert.doesNotMatch(uploadedSourceSelection, /renderCandidateWorkingWorkspace/);
assert.doesNotMatch(uploadedSourceSelection, /selectedFiles\.length !== 1/);
assert.match(html, /id="candidate-ai-workspace"/);
assert.doesNotMatch(html, /id="candidate-workspace-source-selector"/);
assert.doesNotMatch(html, /id="candidate-workspace-back"/);
assert.doesNotMatch(html, /id="candidate-workspace-close"/);
assert.match(html, /id="candidate-workspace-left-scroll"/);
assert.match(html, /id="candidate-workspace-history"/);
assert.match(html, /id="candidate-card-detail"/);
assert.match(html, /id="candidate-workspace-save"[^>]*>保存到个人资料</);
assert.match(html, /id="candidate-workspace-close-dialog"/);
assert.match(html, /id="candidate-card-unsaved-dialog"/);
assert.match(html, /当前的修改尚未保存，是否保存后返回？/);
assert.doesNotMatch(html, /保存已编辑内容？/);
assert.match(html, /id="candidate-card-unsaved-save"[^>]*>是</);
assert.match(html, /id="candidate-card-unsaved-discard"[^>]*>否</);
assert.match(html, /id="candidate-understanding-events"/);
assert.match(html, /id="candidate-clarification-list"/);
assert.match(html, /id="candidate-workspace-composer"/);
assert.match(html, /placeholder="告诉 Ariadne 哪里需要调整"/);
assert.doesNotMatch(html, /SYSTEM|grounding|source-scoped|非权威 Working Cards/);
assert.match(modelWorkspaceUi, /data-entry-type="EXECUTION_EVENT"/);
assert.match(pages, /ModelWorkspaceUI\.renderProgress\(byId\("candidate-understanding-events"\)/);
assert.match(pages, /ProductShell\.showWorkspace\(workspace, \{ source_name: sourceName \|\| "当前 PDF", processing, model_workspace_ui: ModelWorkspaceUI/);
assert.match(productShell, /modelWorkspaceUi\.setProcessingState\(\{ processing: workspace\.processing, content: workspace\.content, save: workspace\.save, active: processing \}\)/);
assert.match(pages, /data-entry-type="CLARIFYING_QUESTION"/);
assert.match(pages, /CandidateModel\.editedCandidateWorkingModel/);
assert.match(pages, /CandidateModel\.synchronizedCandidateWorkingModel/);
assert.match(pages, /canonicalRevision\.contract_id === "ariadne-context-revision-v2"/);
assert.match(pages, /LocalCandidateReview\.persistUserEdit\(database, canonicalRevision, itemId, confirmedItem, \{ working_model: confirmedWorkingModel \}\)/);
assert.match(pages, /Truth\.persistCandidateWorkingModel/);
assert.match(pages, /Truth\.applyWorkspaceAcceptance/);
assert.match(pages, /Truth\.persistWorkspaceAcceptance/);
assert.match(pages, /candidate_working_model_stale/);
assert.match(pages, /function requestCandidateWorkspaceExit\(destination\)[\s\S]*candidateWorkspaceEditDirty[\s\S]*dialog\.showModal\(\)/);
assert.match(pages, /job-radar-v1-import-view-state/);
assert.match(pages, /job-radar-v1-workspace-back/);
assert.match(pages, /job-radar-v1-workspace-close/);
assert.match(pages, /function beginCandidateWorkspaceView\(\)/);
assert.match(pages, /workspaceViewIsCurrent\(workspaceViewGeneration\)/);
assert.match(pages, /async function openCandidateWorkspaceCardDetail\(itemId\)/);
assert.doesNotMatch(pages, /function applyCandidateWorkspaceCorrection\(content\)/);
assert.match(pages, /restoredWorkingModel = latestCandidateWorkingModel\(records, sourceId\)/);
assert.match(pages, /candidateExecutionState = activeCandidateWorkingModel \? "COMPLETE" : "READY"/);
assert.match(pages, /function requestCandidateCardBack\(\)/);
assert.match(pages, /candidate-card-unsaved-dialog/);
assert.doesNotMatch(pages, /请先保存或取消当前卡片修改。/);
assert.match(pages, /function candidateWorkspaceFactLabel\(value\)[\s\S]*?candidateFactLabel\(value\)/);
assert.match(pages, /CandidateConversation\.candidateFieldDescriptors\(item\)[\s\S]*canonical_display_label/);
assert.match(pages, /未分类信息/);
assert.doesNotMatch(pages, /\? value : "补充信息"/);
assert.match(pages, /USER_CONFIRMED/);
assert.match(pages, /normalizedDisplayValue/);
assert.match(html, /id="candidate-card-back"[^>]*aria-label="返回全部卡片"/);
assert.doesNotMatch(html, /← 返回全部卡片/);
assert.doesNotMatch(html, /返回导入/);
assert.match(styles, /\.v1-workspace-content-pane\.is-detail \.v1-workspace-content-footer \{ display: none; \}/);
assert.match(styles, /\.v1-detail-overlay\.is-import-workspace \.v1-detail-overlay-close::before/);
assert.match(styles, /:is\(\.v1-embedded-detail\[data-v1-page="personal-import"\],\.v1-embedded-detail\[data-v1-page="job-import"\]\)\.v1-workspace-view \.v1-workspace-shell \{[^}]*background: transparent;[^}]*box-shadow: none;/);
assert.match(styles, /\.v1-workspace-pane-header \{ padding: 22px 24px 14px; \}/);
assert.doesNotMatch(styles, /\.v1-workspace-pane-header \{ border-bottom:/);
assert.match(styles, /\.v1-workspace-content-footer \{[^}]*padding: 12px 24px 18px;/);
assert.match(styles, /\.v1-workspace-content-footer \{[^}]*justify-content: flex-start;/);
assert.doesNotMatch(styles, /\.v1-workspace-content-footer \{[^}]*border-top:/);
assert.match(styles, /\.v1-composer-field:focus-within \{[^}]*border-color: #526fda;[^}]*box-shadow:/);
assert.match(styles, /\.v1-conversation-form textarea \{[^}]*background: transparent;[^}]*border: 0;[^}]*height: 44px;[^}]*outline: 0;/);
assert.match(styles, /\.v1-conversation-form button \{[^}]*align-self: center;/);
assert.match(styles, /\.v1-conversation-form textarea \{[^}]*line-height: 20px;[^}]*padding: 12px 13px;/);
assert.match(styles, /#candidate-card-detail \.v1-workspace-back-icon::before \{[^}]*display: block;[^}]*position: static;/);
assert.match(styles, /#candidate-card-detail-facts > div \{[^}]*grid-template-columns: 64px minmax\(0,1fr\);/);
assert.match(styles, /#candidate-card-detail-facts small \{ white-space: nowrap; \}/);
assert.doesNotMatch(pages.slice(pages.indexOf("async function saveCandidateWorkspaceToProfile"), pages.indexOf("function setSavedCandidateSourceMenu")), /applyReviewDecision|persistReviewOutcome|context_review_decisions/);
assert.doesNotMatch(html, /<small>本机来源<\/small>/);
assert.match(styles, /\.v1-saved-source-trigger\.runtime-selector, \.v1-saved-source-menu\.runtime-menu \{ width: 100%; \}/);
assert.match(styles, /#candidate-model-failure-dialog p \{ text-align: left; \}/);
assert.match(styles, /\.v1-model-consent-dialog \.v1-button-row \{ justify-content: space-between; \}/);
assert.match(styles, /\.v1-workspace-layer \{[^}]*position: fixed;[^}]*z-index: 90;/);
assert.match(styles, /\.v1-workspace-panels \{[^}]*gap: 12px;[^}]*grid-template-columns: minmax\(0,1\.4fr\) minmax\(340px,1fr\);/);
assert.match(styles, /\.v1-workspace-content-pane,\.v1-ariadne-pane \{[^}]*border-radius: 22px;[^}]*overflow: hidden;/);
assert.match(styles, /\.v1-workspace-scroll-region,\.v1-workspace-history \{[^}]*overflow-y: auto;/);
assert.doesNotMatch(modelRun, /processCandidateSource|processCandidateProposal|local-candidate-structure|career_evidence|Demo\./);
assert.equal((modelRun.match(/fetch\("\/api\/candidate-model-structure"/g) || []).length, 1);
assert.match(server, /CANDIDATE_MODEL_EXECUTIONS\.begin\(validated_request\.operation_id, validated_request\.source_document\["source_document_id"\]\)/);
assert.match(server, /candidate-model-operation-state\/delete/);
assert.match(pages, /fetch\("\/api\/candidate-model-operation-state\/delete"/);

console.log("candidate_model_runtime_browser_contract=pass");
