import { resolveVICSS } from "./helpers/vi-css.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Truth = require("../public/truth-persistence-domain.js");
const Review = require("../public/local-candidate-review-domain.js");

const sourceId = "source-candidate-review";
const item = { item_id: "work-1", item_type: "WORK_EXPERIENCE", title: "Designer", subtitle: "Studio", time: "2024", summary: null, facts: [], grounding_refs: [{ source_document_id: sourceId, location: "p. 1", excerpt_or_reference: "Studio | Designer | 2024" }], confidence: "medium", warnings: [], uncertainties: [], review_status: "NEEDS_REVIEW" };
const proposal = Truth.validateProposal({ contract_id: "ariadne-context-proposal-v1", proposal_id: "proposal-review-1", proposal_type: "CANDIDATE_CONTEXT", source_document_ids: [sourceId], processing_run_id: "run-structure-1", runtime_snapshot_id: "runtime-snapshot-local", status: "AWAITING_REVIEW", created_at: "2026-09-02T12:00:00Z", payload: { contract_id: "ariadne-local-candidate-proposal-payload-v1", extraction_artifact_id: "artifact-1", candidate_material_type: "resume", candidate_material_type_source: "USER_SELECTED", rule_profile: "career-entity-deterministic-v2", items: [item], manual_review_required: false, unstructured_evidence_reason: null }, grounding_refs: item.grounding_refs, warnings: [], uncertainties: [], authority: Truth.AUTHORITY.proposal });

const original = structuredClone(proposal);
const confirmed = Review.outcomeFor({ proposal, decision: "CONFIRM", acceptedPayload: proposal.payload, currentRevision: null });
assert.deepEqual(confirmed.review_decision.accepted_payload, proposal.payload);
assert.deepEqual(confirmed.revision.payload, proposal.payload);
assert.equal(confirmed.revision.confirmed_from_proposal_id, proposal.proposal_id);
assert.equal(confirmed.revision.provenance.runtime_snapshot_id, proposal.runtime_snapshot_id);

const thirteenItems = Array.from({ length: 13 }, (_, index) => ({ ...structuredClone(item), item_id: `queue-item-${index + 1}`, title: `Queue item ${index + 1}` }));
const groupedQueueProposal = Truth.validateProposal({ ...structuredClone(proposal), proposal_id: "proposal-review-queue-13", payload: { ...structuredClone(proposal.payload), items: thirteenItems } });
const queueItems = Review.splitPendingProposal(groupedQueueProposal);
assert.equal(queueItems.length, 13);
assert.equal(new Set(queueItems.map((entry) => entry.proposal_id)).size, 13);
assert.equal(new Set(queueItems.map((entry) => Review.contextIdFor(entry))).size, 13);
assert.ok(queueItems.every((entry) => entry.payload.items.length === 1 && entry.status === "AWAITING_REVIEW"));
const otherSourceProposal = Truth.validateProposal({
  ...structuredClone(proposal),
  proposal_id: "proposal-other-source",
  source_document_ids: ["source-candidate-review-other"],
  grounding_refs: [{ source_document_id: "source-candidate-review-other", location: "p. 1", excerpt_or_reference: "Other source" }],
  payload: {
    ...structuredClone(proposal.payload),
    items: [{ ...structuredClone(item), item_id: "other-source-item", grounding_refs: [{ source_document_id: "source-candidate-review-other", location: "p. 1", excerpt_or_reference: "Other source" }] }],
  },
});
function proposalQueueDatabase(expectedWrites) {
  const stored = new Map();
  return {
    stored,
    transaction(storeName) {
      assert.equal(storeName, "context_proposals");
      let writes = 0;
      const transaction = {
        objectStore() {
          return {
            put(value) {
              stored.set(value.proposal_id, structuredClone(value));
              writes += 1;
              if (writes === expectedWrites) queueMicrotask(() => transaction.oncomplete?.());
            },
          };
        },
      };
      return transaction;
    },
  };
}
const queueDatabase = proposalQueueDatabase(14);
const migratedQueue = await Review.ensureItemProposalQueue(queueDatabase, [groupedQueueProposal, otherSourceProposal]);
assert.equal(migratedQueue.filter((entry) => entry.status === "AWAITING_REVIEW").length, 14);
assert.equal(queueDatabase.stored.get(groupedQueueProposal.proposal_id).status, "SUPERSEDED");
assert.equal(queueDatabase.stored.get(otherSourceProposal.proposal_id), undefined);
assert.equal(migratedQueue.filter((entry) => entry.source_document_ids[0] === sourceId).length, 13);
assert.equal(migratedQueue.filter((entry) => entry.source_document_ids[0] === "source-candidate-review-other").length, 1);
const resolvedIds = new Set(queueItems.slice(0, 5).map((entry) => entry.proposal_id));
const afterFiveResolved = migratedQueue.filter((entry) => entry.status === "AWAITING_REVIEW" && !resolvedIds.has(entry.proposal_id));
assert.equal(afterFiveResolved.filter((entry) => entry.source_document_ids[0] === sourceId).length, 8);
assert.equal(afterFiveResolved.length, 9); // 8 restored from the first source plus one from the second source.
assert.equal((await Review.ensureItemProposalQueue(queueDatabase, migratedQueue)).length, 14);
assert.equal(Review.splitPendingProposal(queueItems[0]).length, 1); // Reopening never duplicates an already item-scoped proposal.

const editedPayload = Review.editedPayload(proposal, [{ ...item, title: "Senior Designer", summary: "User supplied summary", content_origin: "USER_CONFIRMED" }]);
const editedProposal = { ...proposal, proposal_id: "proposal-review-2", status: "AWAITING_REVIEW" };
const edited = Review.outcomeFor({ proposal: editedProposal, decision: "EDIT_AND_CONFIRM", acceptedPayload: editedPayload, currentRevision: confirmed.revision });
assert.deepEqual(proposal, original);
assert.equal(edited.review_decision.accepted_payload.items[0].title, "Senior Designer");
assert.equal(edited.revision.payload.items[0].content_origin, "USER_CONFIRMED");
assert.equal(edited.revision.version, 2);
assert.equal(edited.revision.previous_revision_id, confirmed.revision.revision_id);

const rejectedProposal = { ...proposal, proposal_id: "proposal-review-reject", status: "AWAITING_REVIEW" };
const rejected = Review.outcomeFor({ proposal: rejectedProposal, decision: "REJECT", acceptedPayload: null, currentRevision: edited.revision });
assert.equal(rejected.review_decision.decision, "REJECT");
assert.equal(rejected.revision, null);

const empty = { ...proposal, proposal_id: "proposal-review-empty", payload: { ...proposal.payload, items: [], manual_review_required: true } };
assert.throws(() => Review.outcomeFor({ proposal: empty, decision: "CONFIRM", acceptedPayload: empty.payload, currentRevision: null }), /empty_manual_proposal_confirm_forbidden/);
const userAdded = Review.editedPayload(empty, [{ ...item, item_id: "user-added-1", title: "User supplied project", content_origin: "USER_CONFIRMED" }]);
assert.equal(Review.outcomeFor({ proposal: empty, decision: "EDIT_AND_CONFIRM", acceptedPayload: userAdded, currentRevision: null }).revision.version, 1);
assert.equal(Review.outcomeFor({ proposal: empty, decision: "REJECT", acceptedPayload: null, currentRevision: null }).revision, null);

assert.deepEqual(Review.latestConfirmedRevisions([confirmed.revision, edited.revision]), [edited.revision]);
const userEditedItem = { ...confirmed.revision.payload.items[0], title: "Principal Designer", content_origin: "USER_CONFIRMED", review_status: "CONFIRMED" };
const userEdit = Review.userEditOutcome(confirmed.revision, item.item_id, userEditedItem, "2026-09-02T13:00:00Z");
assert.equal(userEdit.review_decision.decision, "EDIT_AND_CONFIRM");
assert.equal(userEdit.revision.version, confirmed.revision.version + 1);
assert.equal(userEdit.revision.previous_revision_id, confirmed.revision.revision_id);
assert.equal(userEdit.revision.payload.items[0].title, "Principal Designer");
assert.equal(userEdit.revision.payload.user_edits.at(-1).support_relation, "USER_CONFIRMED");
assert.equal(confirmed.revision.payload.items[0].title, "Designer");

const workspaceRevision = Truth.validateContextRevision({
  contract_id: "ariadne-context-revision-v2",
  context_type: "CANDIDATE",
  context_id: confirmed.revision.context_id,
  revision_id: `${confirmed.revision.context_id}-workspace-v1`,
  version: 1,
  previous_revision_id: null,
  workspace_acceptance_id: "candidate-workspace-acceptance-direct-edit",
  created_at: "2026-09-02T13:01:00Z",
  provenance: confirmed.revision.provenance,
  payload: confirmed.revision.payload,
  authority: Truth.AUTHORITY.revision,
});
assert.throws(
  () => Review.userEditOutcome(workspaceRevision, item.item_id, userEditedItem, "2026-09-02T13:02:00Z"),
  /candidate_workspace_user_edit_requires_working_acceptance/,
);

const durableSource = Truth.validateSourceDocument({
  contract_id: "ariadne-source-document-v1", source_document_id: sourceId, source_type: "PDF", filename: "completed.pdf", label: null,
  mime_type: "application/pdf", content_hash: "sha256:completed-source", created_at: "2026-09-02T12:00:00Z", material_type: "CANDIDATE",
  local_reference: "indexeddb://job-radar-local-first-v1/source_documents/raw-source-payload-v1%3A%3Asource-candidate-review", batch_id: "batch-completed",
  provenance: { supplied_by: "USER", raw_source_recoverability: "DURABLE_BROWSER_LOCAL" }, authority: Truth.AUTHORITY.source,
});
const completedRecords = {
  source_documents: [durableSource],
  context_proposals: [{ ...proposal, status: "ACCEPTED" }],
  processing_runs: [
    { source_document_id: sourceId, operation_type: "CANDIDATE_LOCAL_EXTRACTION", status: "SUCCEEDED" },
    { source_document_id: sourceId, operation_type: "CANDIDATE_LOCAL_DETERMINISTIC_STRUCTURING", status: "SUCCEEDED" },
  ],
  candidate_context_revisions: [confirmed.revision],
  candidate_context_lifecycle: [],
};
assert.equal(Review.isFullyCompletedSource(sourceId, completedRecords), true);
assert.equal(Review.sourceImportState(sourceId, completedRecords), "COMPLETED");
assert.equal(Review.sourceImportState(sourceId, { ...completedRecords, context_proposals: [{ ...proposal, status: "AWAITING_REVIEW" }] }), "PENDING_REVIEW");
assert.equal(Review.sourceImportState("missing-source", completedRecords), "NEW");
const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
const html = fs.readFileSync(path.join(root, "public", "personal-import.html"), "utf8");
const styles = resolveVICSS(fs.readFileSync(path.join(root, "public", "styles.css"), "utf8"));
assert.match(html, /candidate-review-surface/);
assert.match(pages, /persistDecision\(database, proposal, decision, acceptedPayload\)/);
assert.match(pages, /activeConfirmedRevisions/);
assert.match(pages, /JSON\.stringify\(editedItems\) === JSON\.stringify\(proposal\.payload\.items\) \? "CONFIRM" : "EDIT_AND_CONFIRM"/);
assert.match(pages, /completeEmbeddedImport\("personal", confirmedItemId \? `candidate:\$\{confirmedItemId\}` : "personal-guide"\)/);
assert.match(pages, /proposalReviewMarkup\(proposals\[0\]/);
assert.match(pages, /第 \$\{position\} \/ \$\{total\} 条/);
assert.match(pages, /ensureItemProposalQueue\(database, proposalRecords\)/);
assert.match(pages, /if \(!remaining\.length\) completeEmbeddedImport/);
assert.match(pages, /persistUserEdit\(database, canonicalRevision, itemId, editedItem, \{ working_model: editedWorkingModel \}\)/);
const reviewMarkup = pages.slice(pages.indexOf("function proposalReviewMarkup"), pages.indexOf("async function renderAwaitingCandidateReviews"));
assert.match(reviewMarkup, /data-review-action="confirm"/);
assert.match(reviewMarkup, /data-review-action="reject"/);
assert.doesNotMatch(reviewMarkup, /data-review-action="edit-confirm"/);
assert.match(pages, /candidateExecutionState === "COMPLETED_SOURCE"/);
assert.match(pages, /该 PDF 已被读取。点击确认返回个人资料。/);
assert.match(html, /id="completed-source-sheet"/);
assert.match(html, /id="confirm-completed-source"/);
assert.match(html, /id="document-size-limit-dialog"/);
assert.match(html, /id="confirm-document-size-limit"/);
assert.match(pages, /setCompletedSourceSheet\(candidateExecutionState === "COMPLETED_SOURCE"\)/);
assert.match(pages, /byId\("confirm-completed-source"\)\.addEventListener\("click"[\s\S]*completeEmbeddedImport\("personal", "personal-guide"\)/);
assert.match(pages, /candidateReviewSourceIds/);
assert.match(pages, /proposal\.source_document_ids\?\.some\(\(sourceId\) => candidateReviewSourceIds\.includes\(sourceId\)\)/);
const candidateRun = pages.slice(pages.indexOf("async function runCandidateProcessing"), pages.indexOf("function initPersonal"));
assert.ok(candidateRun.indexOf("const sources = selectedCandidateSources.filter") < candidateRun.indexOf('candidateExecutionState = "PROCESSING"'));
assert.ok(candidateRun.indexOf("if (!sources.length)") < candidateRun.indexOf('setCandidateExtractionState("PREPARING"'));
assert.match(candidateRun, /if \(candidateExecutionState === "PROCESSING"\) candidateExecutionState = "COMPLETE"/);
assert.match(pages, /document_size_limit_exceeded: "每个文件最大支持 30 MB；请压缩后重试。"/);
assert.match(pages, /function showPersonalError\(error, selectionVersion = candidateSelectionVersion\) \{[\s\S]*byId\("personal-processing"\)\?\.classList\.add\("hidden"\)/);
assert.match(pages, /document_size_limit_exceeded"\) \{[\s\S]*dialog\.showModal\(\)/);
assert.match(pages, /confirm-document-size-limit"\)\.addEventListener\("click"[\s\S]*resetInvalidCandidateSelection\(\)/);
assert.match(styles, /\.v1-embedded-detail\[data-v1-page="personal-import"\] #personal-page-message\.error \{ display: block;/);
assert.match(styles, /\.v1-error-dialog \{[\s\S]*max-width: min\(380px/);
const candidateAcceptStart = pages.indexOf("const acceptCandidateFiles");
const candidateAccept = pages.slice(candidateAcceptStart, pages.indexOf('installFileDropzone("personal-dropzone"', candidateAcceptStart));
assert.match(candidateAccept, /candidateExecutionState = "READY"/);
assert.match(pages, /button\.disabled = candidateProcessingInProgress \|\| \(!modelReady && candidateExecutionState === "COMPLETE"\)/);
assert.doesNotMatch(pages.slice(pages.indexOf("function proposalReviewMarkup"), pages.indexOf("function initPersonalImport")), /candidateDuplicateScore|mergeCandidateRecords|\/api\/(?:deepseek|qwen|gemini)/);
console.log("local_candidate_review_contract=pass");
