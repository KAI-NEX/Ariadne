const DB_NAME = "job-radar-local-first-v1";
const DB_VERSION = 12;
const JOBS = "jobs";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(JOBS)) db.createObjectStore(JOBS, { keyPath: "job_id" });
      if (!db.objectStoreNames.contains("candidates")) db.createObjectStore("candidates", { keyPath: "candidate_id" });
      if (!db.objectStoreNames.contains("source_documents")) db.createObjectStore("source_documents", { keyPath: "source_document_id" });
      if (!db.objectStoreNames.contains("runtime_snapshots")) db.createObjectStore("runtime_snapshots", { keyPath: "snapshot_id" });
      if (!db.objectStoreNames.contains("extraction_artifacts")) db.createObjectStore("extraction_artifacts", { keyPath: "artifact_id" });
      if (!db.objectStoreNames.contains("career_evidence")) db.createObjectStore("career_evidence", { keyPath: "evidence_id" });
      if (!db.objectStoreNames.contains("review_decisions")) db.createObjectStore("review_decisions", { keyPath: "decision_id" });
      if (!db.objectStoreNames.contains("career_profiles")) db.createObjectStore("career_profiles", { keyPath: "profile_id" });
      if (!db.objectStoreNames.contains("extraction_runs")) db.createObjectStore("extraction_runs", { keyPath: "extraction_run_id" });
      if (!db.objectStoreNames.contains("career_entities")) db.createObjectStore("career_entities", { keyPath: "entity_id" });
      if (!db.objectStoreNames.contains("entity_review_decisions")) db.createObjectStore("entity_review_decisions", { keyPath: "decision_id" });
      if (!db.objectStoreNames.contains("correction_memory")) db.createObjectStore("correction_memory", { keyPath: "correction_id" });
      if (!db.objectStoreNames.contains("ai_career_contexts")) db.createObjectStore("ai_career_contexts", { keyPath: "artifact_id" });
      if (!db.objectStoreNames.contains("ai_career_profiles")) db.createObjectStore("ai_career_profiles", { keyPath: "profile_id" });
      if (!db.objectStoreNames.contains("career_intelligence")) db.createObjectStore("career_intelligence", { keyPath: "record_id" });
      if (!db.objectStoreNames.contains("candidate_contexts")) db.createObjectStore("candidate_contexts", { keyPath: "context_id" });
      if (!db.objectStoreNames.contains("candidate_proposals")) db.createObjectStore("candidate_proposals", { keyPath: "candidate_proposal_id" });
      if (!db.objectStoreNames.contains("candidate_context_patches")) db.createObjectStore("candidate_context_patches", { keyPath: "patch_id" });
      if (!db.objectStoreNames.contains("processing_runs")) db.createObjectStore("processing_runs", { keyPath: "run_id" });
      if (!db.objectStoreNames.contains("processing_batches")) db.createObjectStore("processing_batches", { keyPath: "batch_id" });
      if (!db.objectStoreNames.contains("context_proposals")) db.createObjectStore("context_proposals", { keyPath: "proposal_id" });
      if (!db.objectStoreNames.contains("context_review_decisions")) db.createObjectStore("context_review_decisions", { keyPath: "review_id" });
      if (!db.objectStoreNames.contains("candidate_context_revisions")) db.createObjectStore("candidate_context_revisions", { keyPath: "revision_id" });
      if (!db.objectStoreNames.contains("candidate_context_lifecycle")) db.createObjectStore("candidate_context_lifecycle", { keyPath: "lifecycle_id" });
      if (!db.objectStoreNames.contains("job_context_revisions")) db.createObjectStore("job_context_revisions", { keyPath: "revision_id" });
      if (!db.objectStoreNames.contains("processing_consents")) db.createObjectStore("processing_consents", { keyPath: "consent_id" });
      if (!db.objectStoreNames.contains("conversation_sessions")) db.createObjectStore("conversation_sessions", { keyPath: "conversation_id" });
      if (!db.objectStoreNames.contains("conversation_messages")) db.createObjectStore("conversation_messages", { keyPath: "message_id" });
      if (!db.objectStoreNames.contains("demo_candidate_items")) db.createObjectStore("demo_candidate_items", { keyPath: "item_id" });
      if (!db.objectStoreNames.contains("demo_job_contexts")) db.createObjectStore("demo_job_contexts", { keyPath: "job_context_id" });
      if (!db.objectStoreNames.contains("demo_conversations")) db.createObjectStore("demo_conversations", { keyPath: "conversation_id" });
      if (!db.objectStoreNames.contains("demo_ui_state")) db.createObjectStore("demo_ui_state", { keyPath: "state_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function getJobs() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOBS, "readonly");
    const request = transaction.objectStore(JOBS).getAll();
    transaction.oncomplete = () => { db.close(); resolve(request.result || []); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
async function putJob(job) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(JOBS, "readwrite");
    transaction.objectStore(JOBS).put(job);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
function escapeHtml(value) {
  return String(value ?? "unknown").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}
function imageUrl(job) {
  const path = (job.evidence_paths || [])[0];
  return path ? `/api/local-ocr-evidence/${encodeURIComponent(path.split("/").pop())}` : null;
}
function evidenceImages(job) {
  return (job.evidence_paths || []).map((path, index) => ({
    index,
    url: `/api/local-ocr-evidence/${encodeURIComponent(path.split("/").pop())}`,
  }));
}
function compactFacts(job) { return [job.location, job.seniority, job.salary].filter((value) => value && value !== "unknown").join(" · ") || "信息待补充"; }
function itemsFromText(value) { return value.split("\n").map((item) => item.trim()).filter(Boolean); }
function renderDetail(job) {
  const dialog = document.getElementById("job-detail-dialog");
  const images = evidenceImages(job);
  const imageGallery = images.length ? `<div class="detail-image-gallery"><img id="detail-active-image" src="${images[0].url}" alt="${escapeHtml(job.title)} 的原始截图 1"><div class="detail-thumbnails">${images.map((image) => `<button type="button" class="detail-thumbnail${image.index === 0 ? " active" : ""}" data-image-index="${image.index}" aria-label="查看截图 ${image.index + 1}"><img src="${image.url}" alt="截图 ${image.index + 1}"></button>`).join("")}</div></div>` : "";
  const list = (items) => items?.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p class=\"muted\">unknown</p>";
  const source = job.source_url ? `<p><a href="${escapeHtml(job.source_url)}" target="_blank" rel="noreferrer">打开来源链接</a></p>` : "";
  dialog.innerHTML = `<div class="local-job-detail-body"><button class="detail-close" type="button">关闭</button><button class="detail-edit" type="button">编辑此职位</button>${imageGallery}<p class="job-badge">已审核并保存</p><h2>${escapeHtml(job.title)}</h2><p class="company">${escapeHtml(job.company)}</p><p class="job-facts">${escapeHtml(compactFacts(job))}</p>${source}<h3>岗位职责</h3>${list(job.responsibilities)}<h3>任职要求</h3>${list(job.requirements)}</div>`;
  dialog.querySelector(".detail-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".detail-edit").addEventListener("click", () => { dialog.close(); renderEdit(job); });
  dialog.querySelectorAll("[data-image-index]").forEach((button) => button.addEventListener("click", () => {
    const image = images[Number(button.dataset.imageIndex)];
    dialog.querySelector("#detail-active-image").src = image.url;
    dialog.querySelector("#detail-active-image").alt = `${job.title} 的原始截图 ${image.index + 1}`;
    dialog.querySelectorAll("[data-image-index]").forEach((thumbnail) => thumbnail.classList.toggle("active", thumbnail === button));
  }));
  dialog.showModal();
}
function renderEdit(job) {
  const dialog = document.getElementById("job-detail-dialog");
  const value = (name) => escapeHtml(job[name] || "unknown");
  dialog.innerHTML = `<div class="local-job-detail-body"><button class="detail-close" type="button">关闭</button><h2>编辑职位</h2><form class="edit-job-form"><label>公司<input name="company" value="${value("company")}"></label><label>职位标题<input name="title" value="${value("title")}"></label><label>地点<input name="location" value="${value("location")}"></label><label>经验/级别<input name="seniority" value="${value("seniority")}"></label><label>薪资<input name="salary" value="${value("salary")}"></label><label>来源链接<input name="source_url" type="url" value="${escapeHtml(job.source_url || "")}"></label><label>岗位职责（每行一条）<textarea name="responsibilities" rows="6">${escapeHtml((job.responsibilities || []).join("\n"))}</textarea></label><label>任职要求（每行一条）<textarea name="requirements" rows="6">${escapeHtml((job.requirements || []).join("\n"))}</textarea></label><button type="submit">保存修改</button></form></div>`;
  dialog.querySelector(".detail-close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".edit-job-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = {
      ...job,
      company: String(form.get("company") || "unknown").trim() || "unknown",
      title: String(form.get("title") || "unknown").trim() || "unknown",
      location: String(form.get("location") || "unknown").trim() || "unknown",
      seniority: String(form.get("seniority") || "unknown").trim() || "unknown",
      salary: String(form.get("salary") || "unknown").trim() || "unknown",
      source_url: String(form.get("source_url") || "").trim() || null,
      responsibilities: itemsFromText(String(form.get("responsibilities") || "")),
      requirements: itemsFromText(String(form.get("requirements") || "")),
      updated_at: new Date().toISOString(),
    };
    await putJob(updated);
    dialog.close();
    renderJobs(await getJobs());
  });
  dialog.showModal();
}
function renderJobs(jobs) {
  const gallery = document.getElementById("jobs-gallery");
  const summary = document.getElementById("gallery-summary");
  const ordered = [...jobs].sort((a, b) => String(b.confirmed_at || b.created_at).localeCompare(String(a.confirmed_at || a.created_at)));
  summary.textContent = ordered.length ? `此浏览器已保存 ${ordered.length} 条职位；点击卡片查看完整内容和原图。` : "还没有保存的职位。先导入截图或粘贴 JD 原文并完成审核。";
  gallery.innerHTML = ordered.map((job) => {
    const image = imageUrl(job);
    const preview = job.responsibilities?.[0] || job.requirements?.[0] || "暂无职责或要求摘要";
    return `<article class="local-job-card"><button class="local-job-card-open" type="button" data-open-id="${escapeHtml(job.job_id)}">${image ? `<img src="${image}" alt="${escapeHtml(job.title)} 的原始截图">` : ""}<div class="local-job-card-body"><p class="job-badge">已审核</p><h2>${escapeHtml(job.title)}</h2><p class="company">${escapeHtml(job.company)}</p><p class="job-facts">${escapeHtml(compactFacts(job))}</p><p class="job-summary">${escapeHtml(preview)}</p></div></button><button class="edit-job" type="button" data-edit-id="${escapeHtml(job.job_id)}">编辑</button></article>`;
  }).join("");
  gallery.querySelectorAll("[data-open-id]").forEach((card) => card.addEventListener("click", () => renderDetail(ordered.find((job) => job.job_id === card.dataset.openId))));
  gallery.querySelectorAll("[data-edit-id]").forEach((button) => button.addEventListener("click", () => renderEdit(ordered.find((job) => job.job_id === button.dataset.editId))));
}
getJobs().then(renderJobs).catch(() => { document.getElementById("gallery-summary").textContent = "无法读取浏览器本地职位；请检查存储权限。"; });
