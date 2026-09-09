import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const ProductShell = require("../public/product-shell-domain.js");
const SourceInput = require("../public/source-input-domain.js");
const pages = read("public/v1-pages.js");
const candidateDetail = read("public/candidate-detail.html");
const jobDetail = read("public/job-detail.html");
const candidateImport = read("public/personal-import.html");
const jobImport = read("public/jd-import.html");

const detailTurn = pages.match(/async function submitCandidateDetailConversation\([\s\S]*?\n  \}\n\n  function returnToCandidateCardList/)?.[0] || "";
assert.match(detailTurn, /focus: Object\.freeze\(\{ type: "ITEM", item_id: itemId \}\)/);
assert.match(detailTurn, /CandidateWorkspaceConversationRuntime\.executeListTurn/);
assert.match(detailTurn, /const resultType = outcome\.action\?\.normalized_action\?\.action/);
assert.match(detailTurn, /const proposalCreated = resultType === "PATCH_ITEM"/);
assert.match(detailTurn, /showCandidateDetailWorkingProposal\(activeCandidate, workingItem/);
assert.doesNotMatch(detailTurn, /JobConversation|JobContext|job-patch/);

assert.match(pages, /function candidateDetailChangeProjection\(confirmedItem, workingItem\)/);
assert.match(pages, /这是非权威 Working 修改；确认保存前/);
assert.match(pages, /persistCandidateWorkspaceAcceptance\(database, activeCandidateWorkingModel\)/);
assert.match(pages, /Working 修改已由你确认并保存/);
assert.match(pages, /已暂不保存这版 Working 修改；个人资料中的已确认版本没有变化/);
assert.doesNotMatch(candidateDetail, /只讨论当前材料/);
assert.match(candidateDetail, /当前卡片智能协作/);

const editSymbols = ["shell", "field", "actions", "cancel", "preview", "destructive", "preview_panel", "preview_actions", "apply", "back"];
for (const symbol of editSymbols) assert.equal(typeof ProductShell.CONTRACT.edit[symbol], "string");
assert.equal(typeof ProductShell.bindDetailEditShell, "function");
for (const html of [candidateDetail, jobDetail]) {
  assert.match(html, /data-ariadne-edit-shell="detail"/);
  assert.equal((html.match(/data-ariadne-edit-field/g) || []).length, html === candidateDetail ? 6 : 5);
  for (const marker of ["data-ariadne-edit-actions", "data-edit-cancel", "data-edit-preview", "data-edit-destructive", "data-edit-preview-actions", "data-edit-apply", "data-edit-back"]) {
    assert.match(html, new RegExp(marker));
  }
}

for (const html of [candidateImport, jobImport]) {
  assert.equal((html.match(/class="v1-source-preview-list"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="(?:personal|job)-file-(?:name|meta|icon)"/);
}
const container = { classList: { toggle() {}, add() {}, remove() {} } };
const list = { innerHTML: "" };
SourceInput.renderBundlePreview({ container, list }, [{ name: "first.png" }, { name: "second.png" }]);
assert.equal((list.innerHTML.match(/<li>/g) || []).length, 2);
assert.match(list.innerHTML, /<b>1<\/b>first\.png/);
assert.match(list.innerHTML, /<b>2<\/b>second\.png/);
assert.doesNotMatch(list.innerHTML, /个来源|原始来源保存在本机|Provider/);

console.log(JSON.stringify({
  candidate_detail_item_focus_edit: "pass",
  candidate_working_confirmed_boundary: "pass",
  candidate_job_edit_shell_identity: "pass",
  ordered_source_preview_only: "pass",
}));
