"use strict";

const DB_NAME = "job-radar-local-first-v1";
const DB_VERSION = 10;
const AI_CAREER_PROFILES = "ai_career_profiles";
let selectedProfile = null;

function byId(id) { return document.getElementById(id); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const stores = [["jobs", "job_id"], ["candidates", "candidate_id"], ["source_documents", "source_document_id"], ["extraction_runs", "extraction_run_id"], ["career_entities", "entity_id"], ["entity_review_decisions", "decision_id"], ["career_evidence", "evidence_id"], ["review_decisions", "decision_id"], ["career_profiles", "profile_id"], ["correction_memory", "correction_id"], ["ai_career_contexts", "artifact_id"], ["career_intelligence", "record_id"], [AI_CAREER_PROFILES, "profile_id"], ["candidate_contexts", "context_id"], ["candidate_proposals", "candidate_proposal_id"], ["candidate_context_patches", "patch_id"], ["processing_runs", "run_id"], ["processing_consents", "consent_id"], ["conversation_sessions", "conversation_id"], ["conversation_messages", "message_id"], ["demo_candidate_items", "item_id"], ["demo_job_contexts", "job_context_id"], ["demo_conversations", "conversation_id"], ["demo_ui_state", "state_id"]];
      stores.forEach(([name, keyPath]) => { if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath }); });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function profiles() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(AI_CAREER_PROFILES, "readonly").objectStore(AI_CAREER_PROFILES).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result.sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

function inlineMarkdown(value) {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function evidenceLines(content) {
  return String(content || "").split("\n").filter((line) => /\[(原文明确支持|AI 解释|原文未明确 \/ 未知)\]|来源：p\./.test(line));
}

function readableLine(line) {
  return line.replace(/^\s*-\s*\[(原文明确支持|AI 解释|原文未明确 \/ 未知)\]\s*/, "")
    .replace(/（来源：p\.\s*[^）]+）/g, "").trim();
}

function readableMarkdown(content) {
  const lines = String(content || "").split("\n").map((line) => readableLine(line)).filter(Boolean);
  const output = [];
  let list = [];
  const flushList = () => { if (list.length) { output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`); list = []; } };
  lines.forEach((line) => {
    if (/^###\s+/.test(line)) { flushList(); output.push(`<h3>${inlineMarkdown(line.replace(/^###\s+/, ""))}</h3>`); return; }
    if (/^-\s+/.test(line)) { list.push(line.replace(/^-\s+/, "")); return; }
    flushList();
    const field = line.match(/^\*\*(.+?)\*\*:\s*(.+)$/);
    output.push(field ? `<p class="profile-field"><strong>${inlineMarkdown(field[1])}</strong><span>${inlineMarkdown(field[2])}</span></p>` : `<p>${inlineMarkdown(line)}</p>`);
  });
  flushList();
  return output.join("");
}

function profileBlockMarkup(block) {
  const evidence = evidenceLines(block.content);
  return `<article class="profile-block"><h2>${escapeHtml(block.title)}</h2><div class="profile-readable">${readableMarkdown(block.content)}</div>${evidence.length ? `<details class="profile-evidence"><summary>查看依据与不确定项（${evidence.length}）</summary><ul>${evidence.map((line) => `<li>${inlineMarkdown(line)}</li>`).join("")}</ul></details>` : ""}</article>`;
}

async function render() {
  const records = await profiles();
  selectedProfile = records[0] || null;
  if (!selectedProfile) {
    byId("profile-meta").textContent = "还没有个人档案。请先在职业资料页确认一份 AI 返回。";
    byId("profile-blocks").innerHTML = "";
    return;
  }
  byId("profile-meta").textContent = `生成于 ${selectedProfile.generated_at} · ${selectedProfile.provider}/${selectedProfile.model} · 来源 ${selectedProfile.original_filename}`;
  byId("profile-blocks").innerHTML = (selectedProfile.blocks || []).map(profileBlockMarkup).join("") || `<p class="muted">这份个人档案没有可展示的内容区块。</p>`;
  byId("download-profile").disabled = false;
}

byId("download-profile").addEventListener("click", () => {
  if (!selectedProfile) return;
  download("MY_CAREER_PROFILE.md", selectedProfile.profile_markdown);
  byId("profile-message").textContent = "已下载个人档案文件。";
});

render().catch((error) => { byId("profile-message").textContent = `无法读取个人档案：${error.message}`; byId("profile-message").classList.add("error"); });
