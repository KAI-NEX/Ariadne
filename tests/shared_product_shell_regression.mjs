import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const ProductShell = require("../public/product-shell-domain.js");
const pages = read("public/v1-pages.js");
const styles = read("public/styles.css");
const candidateImport = read("public/personal-import.html");
const jobImport = read("public/jd-import.html");
const candidateDetail = read("public/candidate-detail.html");
const jobDetail = read("public/job-detail.html");

assert.equal(ProductShell.CONTRACT.import.root, "v1-import-shell");
assert.equal(ProductShell.CONTRACT.workspace.layer, "v1-workspace-layer");
assert.equal(ProductShell.CONTRACT.workspace.content_pane, "v1-workspace-content-pane");
assert.equal(ProductShell.CONTRACT.detail.root, "v1-detail-shell");
assert.equal(ProductShell.CONTRACT.conversation.thread, "v1-conversation-thread");
assert.equal(ProductShell.CONTRACT.conversation.human_bubble, "v1-conversation-message user");
assert.equal(ProductShell.CONTRACT.conversation.assistant_bubble, "v1-conversation-message assistant");
for (const symbol of ["bindImportShell", "bindWorkspaceShell", "bindDetailShell", "bindConversation", "showWorkspace", "hideWorkspace", "applyDetailRuntime", "createDetailPanelController"]) {
  assert.equal(typeof ProductShell[symbol], "function", `${symbol} must be one shared implementation`);
}

for (const html of [candidateImport, jobImport, candidateDetail, jobDetail]) {
  assert.match(html, /product-shell-domain\.js\?v=shared-product-shell-v1/);
}
for (const html of [candidateImport, jobImport]) {
  assert.match(html, /class="v1-page-shell v1-import-shell"/);
  assert.match(html, /class="v1-workspace-layer hidden"/);
  assert.match(html, /class="v1-workspace-backdrop"/);
  assert.match(html, /class="v1-workspace-shell"/);
  assert.match(html, /class="v1-workspace-panels"/);
  assert.match(html, /class="v1-workspace-content-pane"/);
  assert.match(html, /class="v1-workspace-scroll-region"/);
  assert.match(html, /class="v1-workspace-content-footer"/);
  assert.match(html, /class="v1-ariadne-pane"/);
  assert.match(html, /class="v1-workspace-history"/);
  assert.match(html, /class="v1-workspace-conversation v1-conversation-messages v1-conversation-thread"/);
}
for (const html of [candidateDetail, jobDetail]) {
  assert.match(html, /class="v1-page-shell v1-detail-shell" data-ariadne-shell="detail"/);
  assert.match(html, /class="v1-split-view"/);
  assert.match(html, /class="v1-structured-pane/);
  assert.match(html, /class="v1-conversation-pane hidden"/);
  assert.match(html, /class="v1-conversation-messages v1-conversation-thread"/);
  assert.match(html, /class="v1-conversation-form"/);
  assert.doesNotMatch(html, /class="v1-conversation-form v1-workspace-composer"/);
  assert.doesNotMatch(html, /v1-workspace-composer-field/);
  assert.match(html, /<button type="submit" aria-label="发送"><\/button>/);
}

assert.equal((pages.match(/ProductShell\.bindWorkspaceShell\(document,/g) || []).length, 2);
assert.equal((pages.match(/ProductShell\.bindImportShell\(document\)/g) || []).length, 2);
assert.equal((pages.match(/ProductShell\.createDetailPanelController/g) || []).length, 2);
assert.match(pages, /ProductShell\.bindDetailShell\(document,/);
assert.match(pages, /ProductShell\.applyDetailRuntime\(shell,/);
assert.match(pages, /ConversationUI\.renderMessages\(target, candidateWorkspaceConversation,/);
assert.match(pages, /ConversationUI\.renderMessages\(target, visible,/);
assert.match(pages, /ConversationUI\.renderMessages\(byId\("candidate-conversation-messages"\), \[\],/);
assert.match(pages, /ProductShell\.showWorkspace\(workspace,/);
assert.match(pages, /ProductShell\.showWorkspace\(jobSharedWorkspace\(\),/);
assert.doesNotMatch(pages, /function createDetailPanelController/);
assert.doesNotMatch(`${candidateImport}\n${jobImport}\n${styles}`, /v1-candidate-workspace-(?:layer|backdrop|shell|panels)|v1-candidate-pane(?:-footer)?/);

const modelJob = pages.slice(pages.indexOf("async function executeJobModelProcessing"), pages.indexOf("async function runJobProcessing"));
assert.match(modelJob, /showJobWorkingWorkspace/);
assert.doesNotMatch(modelJob, /renderAwaitingJobReviews|processJobSource|local-job-extract|local-job-image-ocr/);
const localJob = pages.slice(pages.indexOf("async function runJobProcessing"), pages.indexOf("function initJobLibrary"));
assert.match(localJob, /renderAwaitingJobReviews/);
assert.match(jobImport, /id="job-review-surface" class="v1-review-surface hidden"/);

console.log(JSON.stringify({
  shared_product_shell: "pass",
  candidate_and_job_workspace: "same_actual_bind_show_symbols",
  candidate_and_job_detail: "same_actual_bind_runtime_edit_symbols",
  conversation: "same_renderer_bubbles_composer_input_send_scroll_contract",
  model_job: "working_workspace_without_local_review",
  local_job: "proposal_review_save_preserved",
}));
