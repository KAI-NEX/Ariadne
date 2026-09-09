import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Truth = require("../public/truth-persistence-domain.js");
const RawSource = require("../public/raw-source-storage-domain.js");
const Review = require("../public/local-candidate-review-domain.js");
const CandidateContext = require("../public/job-candidate-context-domain.js");

const sourceA = "source-removal-a";
const sourceB = "source-removal-b";
const sourceRef = (sourceId, label) => ({ source_document_id: sourceId, location: "p. 1", excerpt_or_reference: label });
const candidateItem = (suffix, sourceId) => ({ item_id: `candidate-${suffix}`, item_type: "PROJECT", title: `Candidate ${suffix}`, subtitle: null, time: null, summary: null, facts: [], grounding_refs: [sourceRef(sourceId, `Evidence ${suffix}`)], confidence: "medium", warnings: [], uncertainties: [], review_status: "NEEDS_REVIEW" });
function proposalFor(suffix, sourceId = sourceA) {
  const item = candidateItem(suffix, sourceId);
  return Truth.validateProposal({
    contract_id: "ariadne-context-proposal-v1", proposal_id: `proposal-${suffix}`, proposal_type: "CANDIDATE_CONTEXT",
    source_document_ids: [sourceId], processing_run_id: `run-${suffix}`, runtime_snapshot_id: "runtime-snapshot-local-removal",
    status: "AWAITING_REVIEW", created_at: `2026-09-02T14:00:0${suffix === "A" ? 1 : suffix === "B" ? 2 : 3}Z`,
    payload: { contract_id: "ariadne-local-candidate-proposal-payload-v1", extraction_artifact_id: `artifact-${suffix}`, candidate_material_type: "resume", candidate_material_type_source: "USER_SELECTED", rule_profile: "career-entity-deterministic-v2", items: [item], manual_review_required: false, unstructured_evidence_reason: null },
    grounding_refs: item.grounding_refs, warnings: [], uncertainties: [], authority: Truth.AUTHORITY.proposal,
  });
}

const proposalA = proposalFor("A");
const proposalB = proposalFor("B");
const proposalC = proposalFor("C");
const confirmedA = Review.outcomeFor({ proposal: proposalA, decision: "CONFIRM", acceptedPayload: proposalA.payload, currentRevision: null }).revision;
const confirmedBv1 = Review.outcomeFor({ proposal: proposalB, decision: "CONFIRM", acceptedPayload: proposalB.payload, currentRevision: null }).revision;
const confirmedBv2 = Review.userEditOutcome(confirmedBv1, "candidate-B", { ...confirmedBv1.payload.items[0], title: "Candidate B edited", content_origin: "USER_CONFIRMED", review_status: "CONFIRMED" }, "2026-09-02T14:01:00Z").revision;
const confirmedC = Review.outcomeFor({ proposal: proposalC, decision: "CONFIRM", acceptedPayload: proposalC.payload, currentRevision: null }).revision;

function removalDatabase(revisions, lifecycle = [], failWrite = false) {
  const records = { candidate_context_revisions: structuredClone(revisions), candidate_context_lifecycle: structuredClone(lifecycle) };
  return {
    records,
    transaction() {
      const transaction = {
        error: null,
        abort() { queueMicrotask(() => this.onabort?.()); },
        objectStore(name) {
          return {
            getAll() {
              const request = { result: structuredClone(records[name]) };
              queueMicrotask(() => request.onsuccess?.());
              return request;
            },
            add(value) {
              if (failWrite) {
                transaction.error = new Error("synthetic_lifecycle_write_failed");
                queueMicrotask(() => transaction.onerror?.());
                return;
              }
              records[name].push(structuredClone(value));
              queueMicrotask(() => transaction.oncomplete?.());
            },
          };
        },
      };
      return transaction;
    },
  };
}

// Removing B is item-scoped: A/C stay active and every B revision remains as history.
const revisions = [confirmedA, confirmedBv1, confirmedBv2, confirmedC];
const database = removalDatabase(revisions);
const removal = await Review.persistRemoval(database, confirmedBv2, "candidate-B");
assert.equal(removal.item_id, "candidate-B");
assert.equal(removal.context_id, confirmedBv2.context_id);
assert.deepEqual(database.records.candidate_context_revisions, revisions);
assert.deepEqual(Review.activeConfirmedRevisions(revisions, database.records.candidate_context_lifecycle).map((revision) => revision.payload.items[0].item_id).sort(), ["candidate-A", "candidate-C"]);
assert.deepEqual(Review.latestConfirmedRevisions(revisions).map((revision) => revision.payload.items[0].item_id).sort(), ["candidate-A", "candidate-B", "candidate-C"]);
await assert.rejects(Review.persistRemoval(database, confirmedBv2, "candidate-B"), /candidate_item_already_removed/);

// A removed card must not return to JD through an unaccepted source Working head.
// The same item ID in another source is a different identity and must survive.
const workingFor = (sourceId, items) => ({
  working_model_id: `working-${sourceId}`, source_document_id: sourceId,
  version: 1, previous_working_model_id: null, fingerprint: `sha256:${"a".repeat(64)}`,
  payload: { items: structuredClone(items) },
});
const removedInput = {
  ...database.records,
  candidate_working_models: [
    workingFor(sourceA, [candidateItem("A", sourceA), candidateItem("B", sourceA)]),
    workingFor(sourceB, [candidateItem("B", sourceB)]),
  ],
};
const preservedInput = structuredClone(removedInput);
const removedSnapshot = await CandidateContext.buildSnapshot(removedInput);
assert(!removedSnapshot.working_manifest.some((entry) => entry.identity === `working:${sourceA}:candidate-B`), "removed Candidate leaked to JD as Working");
assert(removedSnapshot.working_manifest.some((entry) => entry.identity === `working:${sourceA}:candidate-A`));
assert(removedSnapshot.working_manifest.some((entry) => entry.identity === `working:${sourceB}:candidate-B`));
assert.deepEqual(removedInput, preservedInput, "compiling context must not rewrite historical records");

// A non-authoritative tombstone cannot hide human-confirmed data.
const unauthorized = { candidate_context_revisions: [confirmedBv2], candidate_context_lifecycle: [{ ...removal, authority: "NON_AUTHORITATIVE_PROPOSAL" }] };
assert.equal((await CandidateContext.buildSnapshot(unauthorized)).provider_view.confirmed.length, 1);

// Removing the last card is a valid empty profile, while malformed active data
// must still fail closed rather than masquerade as a successfully wired profile.
const allRemoved = {
  candidate_context_revisions: [confirmedBv1, confirmedBv2],
  candidate_context_lifecycle: [removal],
  candidate_working_models: [workingFor(sourceA, [candidateItem("B", sourceA)])],
};
const emptySnapshot = await CandidateContext.buildSnapshot(allRemoved);
assert.equal(emptySnapshot.structural_counts.confirmed_count, 0);
assert.equal(emptySnapshot.structural_counts.working_count, 0);
assert.equal(emptySnapshot.structural_counts.candidate_snapshot_present, true);
assert.equal((await CandidateContext.buildSnapshot({ career_entities: [{ entity_id: "unreviewed", review_status: "pending" }] })).provider_view.confirmed.length, 0);
await assert.rejects(CandidateContext.buildSnapshot({ candidate_context_revisions: [{ ...confirmedBv2, payload: { items: [{}] } }] }), /CANDIDATE_CONTEXT_WIRING_EMPTY/);

// A failed lifecycle write leaves the card active.
const failedDatabase = removalDatabase(revisions, [], true);
await assert.rejects(Review.persistRemoval(failedDatabase, confirmedBv2, "candidate-B"), /synthetic_lifecycle_write_failed/);
assert.deepEqual(Review.activeConfirmedRevisions(revisions, failedDatabase.records.candidate_context_lifecycle).map((revision) => revision.payload.items[0].item_id).sort(), ["candidate-A", "candidate-B", "candidate-C"]);

// Hard delete is exact-source, not batch-root: all source A data is selected, source B in the same batch is untouched.
const sourceDocuments = [
  { source_document_id: sourceA, batch_id: "batch-shared" },
  { source_document_id: sourceB, batch_id: "batch-shared" },
  { source_document_id: RawSource.payloadRecordIdFor(sourceA), record_type: RawSource.RECORD_TYPE, canonical_source_document_id: sourceA },
  { source_document_id: RawSource.payloadRecordIdFor(sourceB), record_type: RawSource.RECORD_TYPE, canonical_source_document_id: sourceB },
];
const otherProposal = proposalFor("D", sourceB);
const otherRevision = Review.outcomeFor({ proposal: otherProposal, decision: "CONFIRM", acceptedPayload: otherProposal.payload, currentRevision: null }).revision;
const hardDeleteRecords = {
  source_documents: sourceDocuments,
  extraction_artifacts: [{ artifact_id: "artifact-A", source_document_id: sourceA }, { artifact_id: "artifact-D", source_document_id: sourceB }],
  processing_runs: [{ run_id: "run-A", source_document_id: sourceA }, { run_id: "run-D", source_document_id: sourceB }],
  context_proposals: [{ ...proposalA, status: "ACCEPTED" }, { ...proposalB, status: "ACCEPTED" }, { ...proposalC, status: "ACCEPTED" }, { ...otherProposal, status: "ACCEPTED" }],
  context_review_decisions: [{ review_id: "review-A", proposal_id: proposalA.proposal_id }, { review_id: "review-D", proposal_id: otherProposal.proposal_id }],
  candidate_context_revisions: [...revisions, otherRevision],
  candidate_context_lifecycle: [removal],
};
const plan = Review.sourceHardDeletePlan(hardDeleteRecords, sourceA);
assert.deepEqual(plan.source_documents, [sourceA, RawSource.payloadRecordIdFor(sourceA)]);
assert.deepEqual(plan.extraction_artifacts, ["artifact-A"]);
assert.deepEqual(plan.processing_runs, ["run-A"]);
assert.deepEqual(plan.context_proposals.sort(), [proposalA.proposal_id, proposalB.proposal_id, proposalC.proposal_id].sort());
assert.ok(plan.candidate_context_revisions.includes(confirmedBv1.revision_id));
assert.ok(plan.candidate_context_revisions.includes(confirmedBv2.revision_id));
assert.ok(!plan.candidate_context_revisions.includes(otherRevision.revision_id));
assert.ok(!Object.hasOwn(plan, "processing_batches"));
function sourceDatabase(records) {
  const keyFields = { source_documents: "source_document_id", extraction_artifacts: "artifact_id", processing_runs: "run_id", context_proposals: "proposal_id", context_review_decisions: "review_id", candidate_context_revisions: "revision_id", candidate_context_lifecycle: "lifecycle_id" };
  const stored = structuredClone(records);
  const expectedDeletes = Object.values(plan).reduce((total, keys) => total + keys.length, 0);
  return {
    stored,
    transaction(storeNames) {
      assert.ok(!storeNames.includes("processing_batches"));
      let deleted = 0;
      const transaction = {
        error: null,
        abort() { queueMicrotask(() => this.onabort?.()); },
        objectStore(name) {
          return {
            getAll() {
              const request = { result: structuredClone(stored[name] || []) };
              queueMicrotask(() => request.onsuccess?.());
              return request;
            },
            delete(key) {
              const keyField = keyFields[name];
              stored[name] = stored[name].filter((record) => record[keyField] !== key);
              deleted += 1;
              if (deleted === expectedDeletes) queueMicrotask(() => transaction.oncomplete?.());
            },
          };
        },
      };
      return transaction;
    },
  };
}
const hardDeleteDatabase = sourceDatabase(hardDeleteRecords);
const persistedPlan = await Review.persistSourceHardDelete(hardDeleteDatabase, sourceA);
assert.deepEqual(persistedPlan, plan);
assert.deepEqual(hardDeleteDatabase.stored.source_documents.map((record) => record.source_document_id), [sourceB, RawSource.payloadRecordIdFor(sourceB)]);
assert.deepEqual(hardDeleteDatabase.stored.extraction_artifacts.map((record) => record.source_document_id), [sourceB]);
assert.deepEqual(hardDeleteDatabase.stored.context_proposals.map((record) => record.source_document_ids[0]), [sourceB]);
assert.deepEqual(hardDeleteDatabase.stored.candidate_context_revisions.map((record) => record.provenance.source_document_ids[0]), [sourceB]);

// Exact SHA-derived source identity drives pending/active/retry/reimport behavior.
assert.equal(Review.sourceImportState(sourceA, { ...hardDeleteRecords, context_proposals: [{ ...proposalA, status: "AWAITING_REVIEW" }] }), "PENDING_REVIEW");
assert.equal(Review.sourceImportState(sourceA, hardDeleteRecords), "ACTIVE");
assert.equal(Review.sourceImportState(sourceA, { ...hardDeleteRecords, candidate_context_lifecycle: [Review.removalRecord(confirmedA, "candidate-A"), Review.removalRecord(confirmedBv2, "candidate-B"), Review.removalRecord(confirmedC, "candidate-C")] }), "ACTIVE");
assert.equal(Review.sourceImportState(sourceA, { source_documents: [], context_proposals: [], processing_runs: [], candidate_context_revisions: [], candidate_context_lifecycle: [] }), "NEW");
assert.equal(Review.sourceImportState(sourceA, { source_documents: [{ source_document_id: sourceA }], context_proposals: [], processing_runs: [{ source_document_id: sourceA, status: "FAILED", finished_at: "2026-09-02T15:00:00Z" }], candidate_context_revisions: [], candidate_context_lifecycle: [] }), "RETRY");
assert.equal(Review.sourceImportState(sourceA, { source_documents: [{ source_document_id: sourceA }], context_proposals: [], processing_runs: [{ source_document_id: sourceA, status: "CANCELLED", finished_at: "2026-09-02T15:00:00Z" }], candidate_context_revisions: [], candidate_context_lifecycle: [] }), "RETRY");

const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
const productShell = fs.readFileSync(path.join(root, "public", "product-shell-domain.js"), "utf8");
const detailHtml = fs.readFileSync(path.join(root, "public", "candidate-detail.html"), "utf8");
assert.match(detailHtml, /id="open-candidate-delete"[\s\S]*>删除</);
assert.match(detailHtml, /id="candidate-delete-popover"[\s\S]*仅删除这张卡片[\s\S]*移除此文件导入的所有内容[\s\S]*取消/);
assert.doesNotMatch(detailHtml, /id="candidate-delete-first"|id="candidate-delete-scope"|要从个人资料中移除内容吗？/);
assert.doesNotMatch(detailHtml.slice(0, detailHtml.indexOf("candidate-edit-form")), /删除|移除/);
assert.match(productShell, /firstVisibleEditableControl\(panel, windowObject\)\?\.focus/);
assert.doesNotMatch(pages, /candidate-edit-summary"\)\.focus/);
assert.match(pages, /persistRemoval\(database, canonicalRevision, itemId\)/);
assert.match(pages, /persistSourceHardDelete\(database, sourceId\)/);
assert.match(pages, /LocalCandidateReview\.removeLegacyContext\(Demo, Demo\.DEMO_STORES\.candidates, itemId\)/);
assert.match(pages, /LocalCandidateReview\.hardDeleteLegacySource\(Demo, Demo\.DEMO_STORES\.candidates, sourceId\)/);
assert.match(pages, /completeEmbeddedImport\("personal", `candidate:\$\{itemId\}`\)/);
assert.match(pages, /无法删除：\$\{personalErrorCopy\(error\)\}/);
assert.doesNotMatch(pages, /window\.confirm\(/);
assert.doesNotMatch(fs.readFileSync(path.join(root, "public", "local-candidate-review-domain.js"), "utf8"), /\bfetch\s*\(|XMLHttpRequest|DeepSeek|Qwen|Gemini/);
console.log("candidate_context_removal_contract=pass");
