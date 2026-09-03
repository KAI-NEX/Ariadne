import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Domain = require("../public/candidate-context-domain.js");
const now = new Date("2026-08-25T12:00:00Z");
const sourceRef = { source_ref_id: "ref-1", source_document_id: "source-1", location: "p. 1", excerpt_or_reference: "Product Designer", support_relation: "EXPLICIT_SOURCE" };
const item = { item_id: "item-work-1", item_type: "WORK_EXPERIENCE", title: "Product Designer", subtitle: "Example Studio", time: "2024–2026", summary: "Designed the product experience.", facts: [{ fact_id: "fact-1", label: "Role", value: "Product Designer" }], ownership: "Owned interaction design.", source_refs: [sourceRef], uncertainties: [{ uncertainty_id: "uncertain-1", question: "Outcome is not stated.", affects: "outcome", status: "OPEN" }], review_status: "NEEDS_REVIEW", item_version: 1 };
const proposal = { candidate_proposal_id: "proposal-1", source_document_id: "source-1", processing_run_id: "run-1", provider: "deepseek", model: "deepseek-v4-flash-vision-exp", prompt_version: "candidate-proposal-v1", items: [item] };

assert.deepEqual(Domain.validateCandidateProposal(proposal), []);
assert.deepEqual(Domain.validateCandidateProposal({ ...proposal, items: [] }), []);
assert.ok(Domain.validateCandidateProposal({ ...proposal, items: [{ ...item, source_refs: [] }] }).includes("item_source_refs_required"));
assert.ok(Domain.validateCandidateProposal({ ...proposal, items: [{ ...item, review_status: "CONFIRMED" }] }).includes("proposal_item_must_need_review"));

const context = { context_id: "candidate-context-1", current_version: 1, source_document_ids: ["source-1"], items: [{ ...item, review_status: "CONFIRMED" }] };
assert.deepEqual(Domain.validateCandidateContext(context), []);
assert.ok(Domain.validateCandidateContext({ ...context, items: [item] }).includes("context_item_must_be_confirmed"));

const patch = { patch_id: "patch-1", target_item_id: "item-work-1", base_context_version: 1, base_item_version: 1, change_source: "DIRECT_EDIT", operations: [{ op: "replace", path: "/summary", value: "Updated summary." }], before_snapshot: { summary: item.summary }, after_preview: { summary: "Updated summary." }, reason: "User corrected wording.", source_refs: [{ ...sourceRef, support_relation: "USER_CONFIRMED" }], status: "PROPOSED" };
assert.deepEqual(Domain.validateContextPatch(patch), []);
assert.ok(Domain.validateContextPatch({ ...patch, operations: [{ op: "replace", path: "/arbitrary", value: "no" }] }).includes("invalid_patch_operation_path"));

let run = Domain.createProcessingRun({ run_id: "run-1", purpose: "CANDIDATE_IMPORT", source_ids: ["source-1"], provider: "deepseek", model: "deepseek-v4-flash-vision-exp", prompt_version: "candidate-proposal-v1", delivery_method: "rendered_pdf_pages" }, now);
for (const state of ["PREPARING", "AWAITING_CONSENT", "SENDING", "WAITING_FOR_MODEL", "RECEIVED", "VALIDATING", "BUILDING_PROPOSAL", "READY_FOR_REVIEW"]) run = Domain.transitionProcessingRun(run, state, {}, now);
assert.equal(run.state, "READY_FOR_REVIEW");
assert.equal(run.state_history.length, 9);
assert.throws(() => Domain.transitionProcessingRun(run, "SENDING", {}, now), /invalid_processing_run_transition/);
const failed = Domain.transitionProcessingRun(Domain.createProcessingRun({ run_id: "run-2", purpose: "CANDIDATE_IMPORT", source_ids: ["source-1"] }, now), "FAILED", { failure_layer: "Provider", failure_code: "http_401", retryable: false }, now);
assert.equal(failed.failure_layer, "Provider");

const consent = Domain.confirmProcessingConsent(Domain.createProcessingConsent({ consent_id: "consent-1", source_document_id: "source-1", original_filename: "resume.pdf", provider: "deepseek", purpose: "Understand candidate material" }, now), now);
assert.equal(consent.explicitly_confirmed, true);
console.log(JSON.stringify({ candidate_proposal_validation: "pass", confirmed_context_boundary: "pass", patch_preview_boundary: "pass", real_processing_states: "pass", action_scoped_consent: "pass" }, null, 2));
