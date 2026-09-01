import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Domain = require("../public/career-evidence-domain.js");
const evidence = [{ contract_id: Domain.EVIDENCE_CONTRACT_ID, evidence_id: "evidence-research", verification_status: "confirmed", claim: "Material Card：Led user interviews and design synthesis.", source_document_ids: ["source-1"], source_location: "page 2" }];
const jobs = [
  { job_id: "JD-004", title: "生产力AI产品经理", captured_date: "2026-08-18", source_path: "fixture/jd-004" },
  { job_id: "JD-002", title: "AI Agent 工程师", captured_date: "2026-08-18", source_path: "fixture/jd-002", requirements: ["Agent workflow"] },
];
const proposal = Domain.proposeCareerIntelligence(evidence, jobs, new Date("2026-08-24T00:00:00Z"));
assert.equal(proposal.contract_id, Domain.CAREER_INTELLIGENCE_CONTRACT_ID);
assert.ok(proposal.capabilities.some((item) => item.capability === "用户研究与洞察整理" && item.state === "PROVEN"));
assert.ok(proposal.capabilities.some((item) => item.capability === "独立软件工程实现" && item.state === "UNVERIFIED"));
assert.equal(proposal.interests.length, 2);
assert.ok(proposal.interests.every((item) => item.interpretation.includes("不是已确认偏好")));
assert.ok(proposal.directions.length >= 2 && proposal.directions.length <= 4);
assert.ok(proposal.directions.every((item) => item.status === "PENDING_USER_CONFIRMATION" && item.review_status === "needs_review"));
assert.ok(proposal.questions.every((item) => item.changes_model));
assert.ok(!proposal.capabilities.some((item) => item.capability.includes("Agent") && item.state === "PROVEN"));
console.log(JSON.stringify({ contract: "pass", evidence_boundary: "pass", interest_not_preference: "pass", direction_review_gate: "pass", open_questions: "pass" }, null, 2));
