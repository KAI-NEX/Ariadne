import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Domain = require("../public/career-evidence-domain.js");

const anchor = {
  anchor_id: "anchor-1",
  source_document_id: "source-fixture",
  page: 1,
  start_line: 2,
  end_line: 3,
  source_location: "page 1, lines 2-3",
  source_excerpt: "ABC Company | Product Designer 2023.06–2025.03 | London Led five interviews.",
  precision: "approximate_text_location",
};
const source = { source_document_id: "source-fixture", original_filename: "resume.txt", content_hash: "fixture-hash" };
const run = { extraction_run_id: "run-fixture" };
const proposals = [
  {
    entity_id: "entity-basics",
    entity_type: "basics",
    order: 0,
    data: { name: "Kai", label: "Product Designer", email: "private@example.com", summary: "Designer" },
    source_document_ids: ["source-fixture"],
    field_provenance: { "/name": [anchor] },
    extraction: { confidence: "medium", method: "fixture", warnings: [] },
    limitations: ["private_contact_fields_not_career_evidence"],
  },
  {
    entity_id: "entity-work",
    entity_type: "work_experience",
    order: 1,
    data: {
      name: "ABC Company", position: "Product Designer", rawDate: "2023.06–2025.03", startDate: "2023-06", endDate: "2025-03",
      location: "London", responsibilities: [], achievements: [], unclassified_highlights: ["Led five interviews."], skills: [], summary: "",
    },
    source_document_ids: ["source-fixture"],
    field_provenance: { "/name": [anchor], "/position": [anchor], "/unclassified_highlights/0": [anchor] },
    extraction: { confidence: "medium", method: "fixture", warnings: [] },
    limitations: ["self_reported_resume_claim_not_independently_verified"],
  },
  {
    entity_id: "entity-project",
    entity_type: "project",
    order: 2,
    data: { name: "Material Card", context: "Material information service", responsibilities: [], process: [], outputs: [], outcomes: [], unclassified_highlights: ["Built a CSV import prototype."], skills: [], tools: [] },
    source_document_ids: ["source-fixture"],
    field_provenance: { "/name": [anchor], "/unclassified_highlights/0": [anchor] },
    extraction: { confidence: "medium", method: "fixture", warnings: [] },
    limitations: [],
  },
  {
    entity_id: "entity-skill",
    entity_type: "skill_group",
    order: 3,
    data: { name: "Research", level: "", keywords: ["Interview", "Synthesis"] },
    source_document_ids: ["source-fixture"],
    field_provenance: { "/name": [anchor], "/keywords": [anchor] },
    extraction: { confidence: "medium", method: "fixture", warnings: [] },
    limitations: [],
  },
  {
    entity_id: "entity-award",
    entity_type: "award",
    order: 4,
    data: { name: "Example Award", title: "Example Award", result: "Finalist", date: null, awarder: "", location: "", summary: "" },
    source_document_ids: ["source-fixture"],
    field_provenance: { "/name": [anchor], "/result": [anchor] },
    extraction: { confidence: "low", method: "fixture", warnings: ["missing_date"] },
    limitations: ["self_reported_award_not_independently_verified"],
  },
];

const created = Domain.createCareerEntities(source, run, proposals, new Date("2026-08-24T00:01:00Z"));
assert.equal(created.length, 5);
assert.ok(created.every((entity) => entity.review_status === "needs_review"));
assert.equal(created[1].extraction.run_id, "run-fixture");

const approvedBasics = Domain.reviewEntity(created[0], "approve", created[0].data, "source checked", new Date("2026-08-24T00:02:00Z"));
const editedWorkData = { ...created[1].data, responsibilities: ["Led five interviews."], unclassified_highlights: [] };
const approvedWork = Domain.reviewEntity(created[1], "approve", editedWorkData, "classified responsibility", new Date("2026-08-24T00:03:00Z"));
const approvedProject = Domain.reviewEntity(created[2], "approve", created[2].data, "project checked", new Date("2026-08-24T00:04:00Z"));
const approvedSkill = Domain.reviewEntity(created[3], "approve", created[3].data, "skill checked", new Date("2026-08-24T00:05:00Z"));
const approvedAward = Domain.reviewEntity(created[4], "approve", created[4].data, "award checked", new Date("2026-08-24T00:05:30Z"));
assert.equal(approvedWork.decision.action, "edit_and_approve");

const reviewed = [approvedBasics.entity, approvedWork.entity, approvedProject.entity, approvedSkill.entity, approvedAward.entity];
const evidence = Domain.deriveCareerEvidence(reviewed, new Date("2026-08-24T00:06:00Z"));
assert.equal(evidence.length, 3);
assert.ok(!evidence.some((item) => item.claim.includes("private@example.com")));
assert.ok(evidence.some((item) => item.claim.includes("ABC Company")));
assert.ok(evidence.every((item) => item.source_entity_id));

const profile = Domain.buildCareerProfile(reviewed, [source], new Date("2026-08-24T00:07:00Z"));
assert.equal(profile.work.length, 1);
assert.equal(profile.work[0].name, "ABC Company");
assert.deepEqual(profile.work[0].highlights, ["Led five interviews."]);
assert.equal(profile.projects[0].name, "Material Card");
assert.equal(profile.awards.length, 1);
assert.equal(profile.awards[0].name, "Example Award");
assert.equal(profile.x_job_radar.derived_evidence_ids.length, 3);
assert.ok(Domain.buildCareerProfileMarkdown(profile).includes("ABC Company"));

const reopened = Domain.reopenEntity(approvedWork.entity, "fix role", new Date("2026-08-24T00:08:00Z"));
assert.equal(reopened.entity.review_status, "needs_review");
assert.equal(reopened.decision.action, "reopen");
assert.ok(!Domain.deriveCareerEvidence([reopened.entity]).length);

const rejected = Domain.reviewEntity(created[2], "reject", created[2].data, "not supported", new Date("2026-08-24T00:09:00Z"));
assert.equal(rejected.entity.review_status, "rejected");
assert.ok(!Domain.deriveCareerEvidence([rejected.entity]).length);
assert.deepEqual(Domain.createCareerEntities(source, run, [], new Date()), []);
assert.throws(() => Domain.reviewEntity(approvedWork.entity, "approve", approvedWork.entity.data, "", new Date()), /entity_not_reviewable/);

console.log(JSON.stringify({
  contract_id: Domain.ENTITY_CONTRACT_ID,
  entity_review: "pass",
  selective_evidence_derivation: "pass",
  private_basics_not_evidence: "pass",
  reopen_invalidates_derivation: "pass",
  jsonresume_projection: "pass",
}, null, 2));
