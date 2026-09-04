import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
const require = createRequire(import.meta.url);
const Truth = require("../public/truth-persistence-domain.js");
const Proposal = require("../public/local-candidate-proposal-domain.js");

const source = { source_document_id: "source-candidate-proposal", batch_id: "batch-1" };
const artifact = { artifact_id: "artifact-1", source_refs: [{ source_document_id: source.source_document_id, location: "p. 1 · lines 3-4", excerpt_or_reference: "Studio | Product Designer | 2023 - 2024" }], warnings: [], payload: { candidate_material_type: "resume", candidate_material_type_source: "USER_SELECTED" } };
const run = Proposal.processingRunFor(source, "runtime-snapshot-local", "RUNNING", "2026-09-02T10:00:00Z");
const entity = { entity_id: "entity-work-1", entity_type: "work_experience", data: { name: "Studio", position: "Product Designer", rawDate: "2023 - 2024", achievements: "" }, extraction: { confidence: "medium", warnings: [] }, limitations: [], field_provenance: { "/position": [{ source_document_id: source.source_document_id, source_location: "p. 1 · lines 3-4", source_excerpt: "Studio | Product Designer | 2023 - 2024" }] } };
const proposal = Proposal.proposalFor({ source, artifact, structuringRun: run, result: { entities: [entity], warnings: [], status: "needs_review" } });
assert.equal(proposal.proposal_type, "CANDIDATE_CONTEXT");
assert.equal(proposal.status, "AWAITING_REVIEW");
assert.equal(proposal.authority, Truth.AUTHORITY.proposal);
assert.equal(proposal.payload.items[0].title, "Product Designer");
assert.equal(proposal.payload.candidate_material_type_source, "USER_SELECTED");
assert.equal(proposal.processing_run_id, run.run_id);
assert.equal(Proposal.itemFor({ entity_type: "basics", data: { name: "Weak first line" } }, artifact.source_refs), null);
const portfolioItem = Proposal.itemFor({ entity_id: "entity-project-1", entity_type: "project", data: { name: "Explicit CASE Project", rawDate: "" }, extraction: { confidence: "low", warnings: ["ocr_text_requires_entity_review"] }, limitations: [], field_provenance: { "/name": [{ source_document_id: source.source_document_id, source_location: "p. 2 · lines 1-2", source_excerpt: "CASE 01 Explicit CASE Project" }] } }, artifact.source_refs);
assert.equal(portfolioItem.item_type, "PROJECT");
assert.equal(portfolioItem.confidence, "low");
assert.ok(portfolioItem.warnings.includes("ocr_text_requires_entity_review"));
const educationItem = Proposal.itemFor({ entity_id: "entity-education-1", entity_type: "education", data: { institution: "School A", studyType: "Master", rawDate: "2020 - 2022" }, extraction: { confidence: "medium", warnings: [] }, limitations: [], field_provenance: { "/institution": [{ source_document_id: source.source_document_id, source_location: "p. 1 · lines 2-3", source_excerpt: "School A 2020 - 2022" }] } }, artifact.source_refs);
assert.equal(educationItem.title, "School A");
assert.equal(educationItem.subtitle, "Master");
const otherItem = Proposal.itemFor({ entity_id: "entity-other-1", entity_type: "custom_section", data: { name: "Organization A", title: "Project Support", section: "其他经历", rawDate: "2021" }, extraction: { confidence: "medium", warnings: [] }, limitations: [], field_provenance: { "/title": [{ source_document_id: source.source_document_id, source_location: "p. 2 · lines 1-2", source_excerpt: "Organization A Project Support" }] } }, artifact.source_refs);
assert.equal(otherItem.item_type, "OTHER");
assert.equal(otherItem.title, "Project Support");
assert.equal(otherItem.item_subtype, "custom_section");
assert.equal(otherItem.facts.find((fact) => fact.value === "其他经历")?.label, "分类");
for (const [entityType, data] of [
  ["skill_group", { name: "Product Systems", keywords: "AI systems" }],
  ["language", { language: "English", score: "Professional" }],
  ["award", { name: "Synthetic Award", result: "Finalist" }],
]) {
  const typedItem = Proposal.itemFor({ entity_id: `entity-${entityType}`, entity_type: entityType, data, extraction: { confidence: "medium", warnings: [] }, limitations: [], field_provenance: {} }, artifact.source_refs);
  assert.equal(typedItem.item_type, "OTHER");
  assert.equal(typedItem.item_subtype, entityType);
}
const itemScopedProposals = Proposal.proposalsFor({ source, artifact, structuringRun: run, result: { entities: [entity, { entity_id: "entity-project-2", entity_type: "project", data: { name: "Project Two", rawDate: "2025" }, extraction: { confidence: "medium", warnings: [] }, limitations: [], field_provenance: { "/name": [{ source_document_id: source.source_document_id, source_location: "p. 2", source_excerpt: "Project Two" }] } }], warnings: [], status: "needs_review" } });
assert.equal(itemScopedProposals.length, 2);
assert.ok(itemScopedProposals.every((entry) => entry.payload.items.length === 1));
assert.equal(new Set(itemScopedProposals.map((entry) => entry.proposal_id)).size, 2);
assert.deepEqual(itemScopedProposals.map((entry) => entry.payload.items[0].item_id), ["entity-work-1", "entity-project-2"]);
const manual = Proposal.proposalFor({ source, artifact, structuringRun: run, result: { entities: [], warnings: ["portfolio_projects_not_detected"], status: "needs_manual_selection" } });
assert.deepEqual(manual.payload.items, []);
assert.equal(manual.payload.manual_review_required, true);
assert.equal(manual.authority, "NON_AUTHORITATIVE_PROPOSAL");
console.log("local_candidate_proposal_contract=pass");
