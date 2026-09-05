import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const detail = fs.readFileSync(path.join(root, "public", "candidate-detail.html"), "utf8");

const reviewSurface = pages.slice(pages.indexOf("function proposalItemEditor"), pages.indexOf("async function renderAwaitingCandidateReviews"));
const reviewMarkup = pages.slice(pages.indexOf("function proposalReviewMarkup"), pages.indexOf("async function renderAwaitingCandidateReviews"));
assert.match(reviewSurface, /原文/);
assert.match(reviewSurface, /提取结果/);
assert.match(reviewMarkup, /data-review-action="confirm"/);
assert.match(reviewMarkup, /data-review-action="reject"/);
assert.doesNotMatch(reviewMarkup, /data-review-action="edit-confirm"|warnings\.join/);
assert.match(pages, /function humanReviewNotices/);
assert.match(pages, /String\(code\)\.startsWith\("self_reported_"\).*该内容来自材料自述/);

assert.match(pages, /candidateExecutionState = "READY"/);
assert.match(pages, /candidateExecutionState = "PROCESSING"/);
assert.match(pages, /candidateExecutionState = "COMPLETE"/);
assert.match(pages, /模型导入尚不可用/);
assert.match(pages, /dataset\.candidateImportRuntime = local \? "local" : modelReady \? "model-ready" : "model-unavailable"/);

for (const field of ["candidate-edit-title", "candidate-edit-subtitle", "candidate-edit-time", "candidate-edit-summary", "candidate-edit-facts"]) assert.match(detail, new RegExp(`id="${field}"`));
assert.match(pages, /persistUserEdit\(database, canonicalRevision, itemId, editedItem, \{ working_model: editedWorkingModel \}\)/);
assert.match(pages, /上一版本仍保留/);
assert.match(pages, /未晋升为已确认候选信息/);

assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*?\.v1-object-count \{ bottom: 28px; top: auto; \}/);
assert.match(styles, /\.v1-object-copy \{ bottom: 70px; top: auto; \}/);
assert.match(styles, /\.v1-object-count \{ bottom: 30px; top: auto; \}/);
assert.doesNotMatch(pages.slice(pages.indexOf("async function reviewCandidateProposal"), pages.indexOf("function showCandidateSource")), /\/api\/(?:deepseek|qwen|gemini)|candidateDuplicateScore|mergeCandidateRecords/);

console.log("personal_local_pipeline_stabilization=pass");
