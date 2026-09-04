import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, "public", file), "utf8");
const workspaceHtml = read("workspace.html");
const demoDomain = read("v1-demo-domain.js");
const localFirst = read("local-first.js");
const localJobs = read("local-jobs.js");
const careerEvidence = read("career-evidence.js");
const careerProfile = read("career-profile.js");

assert.match(workspaceHtml, /个人资料/);
assert.match(workspaceHtml, /职位描述/);
assert.doesNotMatch(workspaceHtml, /STEP\s*0[123]|v1-object-index/i);
assert.doesNotMatch(workspaceHtml, /匹配与申请|职业申请工作台/);
for (const script of [demoDomain, localFirst, localJobs, careerEvidence, careerProfile]) assert.match(script, /DB_VERSION = 15/);
for (const store of ["runtime_snapshots", "extraction_artifacts", "processing_batches", "context_proposals", "context_review_decisions", "candidate_working_models", "candidate_workspace_acceptances", "candidate_context_revisions", "candidate_context_lifecycle", "job_context_revisions", "candidate_contexts", "candidate_proposals", "candidate_context_patches", "processing_runs", "processing_consents", "conversation_sessions", "conversation_messages", "job_analyses", "job_conversation_sessions", "job_conversation_messages", "job_turn_executions", "job_change_proposals", "job_change_decisions", "demo_candidate_items", "demo_job_contexts", "demo_conversations", "demo_ui_state"]) {
  assert.match(demoDomain, new RegExp(store));
  assert.match(localFirst, new RegExp(store));
  assert.match(localJobs, new RegExp(store));
  assert.match(careerEvidence, new RegExp(store));
  assert.match(careerProfile, new RegExp(store));
}

console.log(JSON.stringify({
  workspace_surfaces: "two_object_folders_pass",
  demo_truth_boundary: "dedicated_demo_stores_pass",
  indexeddb_version_path: "unified_v15_additive_job_intelligence_stores_pass",
}, null, 2));
