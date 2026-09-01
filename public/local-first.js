/* Browser-only Ariadne storage: no app.py route and no network request. */
const DB_NAME = "job-radar-local-first-v1";
const DB_VERSION = 10;
const JOBS = "jobs";
const CANDIDATES = "candidates";
let activeCandidateId = null;
let pendingImages = [];
let deepseekConfigured = false;
const FULL_VISION_PROMPT = "vision_extract_v1_full";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(JOBS)) db.createObjectStore(JOBS, { keyPath: "job_id" });
      if (!db.objectStoreNames.contains(CANDIDATES)) db.createObjectStore(CANDIDATES, { keyPath: "candidate_id" });
      if (!db.objectStoreNames.contains("source_documents")) db.createObjectStore("source_documents", { keyPath: "source_document_id" });
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

async function withStore(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    transaction.oncomplete = () => { db.close(); resolve(request?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

const getAll = (store) => withStore(store, "readonly", (s) => s.getAll());
const put = (store, value) => withStore(store, "readwrite", (s) => s.put(value));
const remove = (store, key) => withStore(store, "readwrite", (s) => s.delete(key));
const clearStore = (store) => withStore(store, "readwrite", (s) => s.clear());

function byId(id) { return document.getElementById(id); }
function show(id, message, isError = false) {
  const element = byId(id);
  element.textContent = message;
  element.classList.toggle("error", isError);
}
function itemsFromText(value) {
  return value.split("\n").map((item) => item.trim()).filter((item) => item && item !== "unknown");
}
function textFromItems(items) { return items.length ? items.join("\n") : ""; }
function fieldCandidate(extraction, name) {
  return extraction?.fields?.[name] || { value: "unknown", status: "unknown", evidence: [], reason: "no_extraction" };
}
function evidenceText(evidence, evidenceKind = "ocr") {
  return (evidence || []).map((item) => {
    if (item.source) return item.source;
    if (evidenceKind === "text") return `原文第 ${item.line} 行`;
    return `截图 ${item.image_index} 第 ${item.line} 行`;
  }).join("；");
}
function usageText(usage) {
  if (!usage || typeof usage !== "object") return "模型未返回可用 token 明细。";
  const input = usage.prompt_tokens ?? usage.input_tokens;
  const output = usage.completion_tokens ?? usage.output_tokens;
  const total = usage.total_tokens;
  return `用量：输入 ${input ?? "unknown"} / 输出 ${output ?? "unknown"} / 合计 ${total ?? "unknown"} tokens`;
}

function sectionText(extraction, name) {
  return (extraction?.sections?.[name] || []).map((section) => section.text).join("\n");
}

function setReviewAvailability(available) {
  byId("review-fields").disabled = !available;
  byId("review-empty-message").classList.toggle("hidden", available);
  byId("review-evidence").classList.toggle("hidden", !available);
  if (!available) byId("model-assist-note").textContent = "模型辅助尚未调用；先用截图证据完成候选审核。";
}

function showModelAssistRecommendation(extraction) {
  const recommendation = extraction?.model_assist_recommendation;
  if (!recommendation?.recommended) {
    byId("model-assist-note").textContent = "当前规则候选足够进入人工审核；不会调用模型。";
    return;
  }
  byId("model-assist-note").textContent = "建议：OCR 已有较多文字但核心字段或章节仍未识别。可选择让视觉 AI 直接读取原图；当前不会自动发送或调用模型。";
}

function setReviewForm(candidate) {
  const extraction = candidate.extraction;
  byId("candidate-company").value = fieldCandidate(extraction, "company").value;
  byId("candidate-title").value = fieldCandidate(extraction, "title").value;
  byId("candidate-location").value = fieldCandidate(extraction, "location").value;
  byId("candidate-seniority").value = fieldCandidate(extraction, "seniority").value;
  byId("candidate-salary").value = fieldCandidate(extraction, "salary").value;
  byId("candidate-responsibilities").value = sectionText(extraction, "responsibilities");
  byId("candidate-requirements").value = sectionText(extraction, "requirements");
}

async function createReviewRecord({ rawText, sourceName, sourceUrl = null, evidencePaths, extraction, evidenceKind = "ocr", modelMetadata = null }) {
  const candidate = {
    candidate_id: crypto.randomUUID(), status: "needs_review", source_name: sourceName,
    source_url: sourceUrl, raw_text: rawText, evidence_paths: evidencePaths,
    extraction: extraction || { fields: {}, sections: {}, ocr_pages: [] }, evidence_kind: evidenceKind,
    model_metadata: modelMetadata,
    company: "unknown", title: "unknown", location: "unknown", seniority: "unknown", salary: "unknown",
    responsibilities: [], requirements: [], created_at: new Date().toISOString(),
  };
  await put(CANDIDATES, candidate);
  activeCandidateId = candidate.candidate_id;
  byId("review-form").reset();
  setReviewAvailability(true);
  setReviewForm(candidate);
  renderReviewEvidence(candidate);
  showModelAssistRecommendation(candidate.extraction);
  show("review-message", "候选已生成并保留来源证据；请核对后再保存。");
}

async function renderJobs() {
  // Persistence remains; the intake page intentionally does not render a job list.
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function renderReviewEvidence(candidate) {
  const evidencePaths = candidate.evidence_paths || (candidate.evidence_path ? [candidate.evidence_path] : []);
  const images = evidencePaths.map((path, index) => {
    const imageName = path.split("/").pop();
    return `<figure><img class="image-preview" src="/api/local-ocr-evidence/${encodeURIComponent(imageName)}" alt="本机 OCR 原始截图 ${index + 1}"><figcaption>截图 ${index + 1}</figcaption></figure>`;
  }).join("");
  const extraction = candidate.extraction || { fields: {}, sections: {}, ocr_pages: [] };
  const fieldLabels = { company: "公司", title: "职位标题", location: "地点", seniority: "经验/级别", salary: "薪资" };
  const fieldRows = Object.entries(fieldLabels).map(([name, label]) => {
    const field = fieldCandidate(extraction, name);
    if (field.status !== "proposed") return `<li>${label}：未提出候选</li>`;
    return `<li>${label}：<strong>${escapeHtml(field.value)}</strong>（${evidenceText(field.evidence, candidate.evidence_kind)}；${escapeHtml(field.reason)}）</li>`;
  }).join("");
  const sectionRows = ["responsibilities", "requirements"].flatMap((name) =>
    (extraction.sections?.[name] || []).map((section) => `<li>${name === "responsibilities" ? "职责" : "要求"}候选：${evidenceText([section.heading_evidence], candidate.evidence_kind)} 标题；内容 ${evidenceText(section.evidence, candidate.evidence_kind)}</li>`)
  ).join("") || "<li>未找到带明确章节标题的职责或要求候选</li>";
  const rawPages = candidate.evidence_kind === "vision"
    ? `<h3>模型原始结构化响应（仍需核对原图）</h3><pre>${escapeHtml(candidate.raw_text)}</pre>`
    : candidate.evidence_kind === "source"
      ? `<h3>来源 API 原始响应（仍需审核）</h3><pre>${escapeHtml(candidate.raw_text)}</pre>`
      : candidate.evidence_kind === "text"
        ? `<h3>粘贴的 JD 原文</h3><pre>${escapeHtml(candidate.raw_text)}</pre>`
    : (extraction.ocr_pages?.length ? extraction.ocr_pages : [{ image_index: 1, lines: candidate.raw_text.split("\n").map((text, index) => ({ line: index + 1, text })) }])
    .map((page) => `<h3>截图 ${page.image_index} 的 OCR 原文</h3><pre>${escapeHtml(page.lines.map((line) => `${line.line}: ${line.text}`).join("\n"))}</pre>`).join("");
  const modelUsage = candidate.model_metadata
    ? `<p class="muted">视觉模型：${escapeHtml(candidate.model_metadata.provider)} / ${escapeHtml(candidate.model_metadata.model)} / ${escapeHtml(candidate.model_metadata.prompt_version || "unknown")}；${escapeHtml(usageText(candidate.model_metadata.usage))}</p>`
    : "";
  const sourceUrl = candidate.source_url ? `<p class="muted">来源链接：<a href="${escapeHtml(candidate.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(candidate.source_url)}</a></p>` : "";
  byId("review-evidence").innerHTML = `<summary>查看候选与来源证据</summary><div class="evidence-images">${images}</div><div class="candidate-evidence">${sourceUrl}<h3>系统提出的候选（均需审核）</h3><ul>${fieldRows}${sectionRows}</ul>${modelUsage}</div>${rawPages}`;
}

function renderPendingImages() {
  byId("image-preview-list").innerHTML = pendingImages.map((image, index) => `<figure><img class="image-preview" src="${image.dataUrl}" alt="待识别 JD 截图 ${index + 1}"><figcaption>截图 ${index + 1}：${escapeHtml(image.name)}</figcaption></figure>`).join("");
  byId("ocr-button").disabled = pendingImages.length === 0;
  byId("vision-button").disabled = pendingImages.length === 0 || !deepseekConfigured;
}

async function refreshVisionConfiguration() {
  try {
    const response = await fetch("/api/local-vision-config");
    const result = await response.json();
    deepseekConfigured = Boolean(response.ok && result.key_configured);
    show("vision-config-message", deepseekConfigured
      ? `DeepSeek Key 已保存在本机 Keychain；视觉模型：${result.model}。`
      : "尚未保存 DeepSeek Key；AI 读取按钮会保持禁用。");
  } catch (error) {
    deepseekConfigured = false;
    show("vision-config-message", "无法连接本机服务；请用 http://127.0.0.1:8000 打开页面。", true);
  }
  renderPendingImages();
}
function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, name: file.name || "粘贴的截图" });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
async function acceptImages(files) {
  const incoming = [...files];
  if (!incoming.length) return;
  if (pendingImages.length + incoming.length > 4) { show("ocr-message", "一次最多 4 张同一职位的截图。", true); return; }
  if (incoming.some((file) => !["image/png", "image/jpeg"].includes(file.type) || file.size > 5_000_000)) {
    show("ocr-message", "每张图片必须是 5 MB 以内的 PNG 或 JPEG。", true); return;
  }
  pendingImages = pendingImages.concat(await Promise.all(incoming.map(readImage)));
  renderPendingImages();
  show("ocr-message", `已准备 ${pendingImages.length} 张截图，将作为同一份 JD 一起识别。`);
}

byId("image-file").addEventListener("change", async (event) => { await acceptImages(event.target.files); event.target.value = ""; });
byId("paste-zone").addEventListener("paste", (event) => {
  const file = [...event.clipboardData.items].find((item) => item.type.startsWith("image/"))?.getAsFile();
  if (!file) { show("ocr-message", "剪贴板中没有图片；请复制截图后再粘贴。", true); return; }
  acceptImages([file]);
});
byId("ocr-button").addEventListener("click", async () => {
  if (!pendingImages.length) return;
  const sourceUrl = canonicalizeSourceLink(byId("source-link").value);
  show("ocr-message", `正在由本机 Vision OCR 识别 ${pendingImages.length} 张图片…`);
  try {
    const response = await fetch("/api/local-ocr", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_data_urls: pendingImages.map((image) => image.dataUrl),
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.text.trim()) throw new Error(result.error || "empty_ocr_text");
    await createReviewRecord({ rawText: result.text, sourceName: `用户提供的 ${result.images.length} 张截图 · 本机 OCR`, sourceUrl, evidencePaths: result.images.map((image) => image.evidence_path), extraction: result.extraction });
    pendingImages = []; renderPendingImages();
    show("ocr-message", `已识别 ${result.images.length} 张截图、${result.line_count} 行，现已进入审核。请以原图为准。`);
  } catch (error) {
    show("ocr-message", "OCR 未得到可用文字：请检查图片清晰度、语言或本机 OCR 服务。", true);
  }
});

function canonicalizeSourceLink(value) {
  try {
    const parsed = new URL(value.trim());
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
    if (parsed.hostname === "careers.tencent.com" && parsed.pathname === "/jobdesc.html") {
      const postId = parsed.searchParams.get("postId");
      return postId && /^\d+$/.test(postId) ? `https://careers.tencent.com/jobdesc.html?postId=${postId}` : null;
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch (_) { return null; }
}

byId("text-candidate-button").addEventListener("click", async () => {
  const rawText = byId("jd-text").value.trim();
  if (!rawText) { show("text-candidate-message", "请先粘贴 JD 原文。", true); return; }
  const sourceUrl = canonicalizeSourceLink(byId("source-link").value);
  show("text-candidate-message", "正在在本机整理原文候选…");
  try {
    const response = await fetch("/api/text-candidate", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw_text: rawText, source_url: sourceUrl }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "text_candidate_failed");
    await createReviewRecord({ rawText: result.raw_text, sourceName: "用户粘贴的 JD 原文", sourceUrl: result.source_url, evidencePaths: [], extraction: result.extraction, evidenceKind: "text" });
    show("text-candidate-message", "原文候选已进入审核；没有上传到外网，也没有直接写入职位。");
  } catch (error) { show("text-candidate-message", "原文未能整理为候选；请保留原文并检查内容。", true); }
});

byId("save-deepseek-key").addEventListener("click", async () => {
  const apiKey = byId("deepseek-key").value.trim();
  if (!apiKey) { show("vision-config-message", "请先输入 DeepSeek API Key。", true); return; }
  show("vision-config-message", "正在保存到本机 Keychain；不会发送给 DeepSeek。\n");
  try {
    const response = await fetch("/api/local-vision-config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: apiKey }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "keychain_write_failed");
    byId("deepseek-key").value = "";
    await refreshVisionConfiguration();
  } catch (error) {
    show("vision-config-message", "未能写入本机 Keychain；Key 没有保存。", true);
  }
});

byId("vision-button").addEventListener("click", async () => {
  if (!pendingImages.length) return;
  const sourceUrl = canonicalizeSourceLink(byId("source-link").value);
  show("ocr-message", `将把 ${pendingImages.length} 张截图发送给 DeepSeek 视觉模型，正在读取…`);
  try {
    const response = await fetch("/api/vision-extract", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_data_urls: pendingImages.map((image) => image.dataUrl), prompt_version: FULL_VISION_PROMPT }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "vision_extract_failed");
    await createReviewRecord({
      rawText: result.raw_provider_response,
      sourceName: `用户主动发送的 ${result.images.length} 张截图 · DeepSeek Vision`,
      sourceUrl,
      evidencePaths: result.images.map((image) => image.evidence_path),
      extraction: result.extraction,
      evidenceKind: "vision",
      modelMetadata: { provider: result.provider, model: result.model, prompt_version: result.prompt_version, usage: result.usage },
    });
    pendingImages = []; renderPendingImages();
    show("ocr-message", `视觉 AI 已返回候选，现已进入审核。${usageText(result.usage)}`);
  } catch (error) {
    const messages = {
      deepseek_key_not_configured: "没有找到本机 Keychain 中的 DeepSeek Key。",
      deepseek_provider_http_error: "DeepSeek 拒绝了请求：请检查 Key、模型 ID 或该实验模型的图片接口。",
      deepseek_network_error: "无法连接 DeepSeek；没有写入职位。",
      model_output_not_expected_json: "模型返回的不是预期 JSON；没有写入职位。",
    };
    show("ocr-message", messages[error.message] || "视觉 AI 结果未通过校验；没有写入职位。", true);
  }
});

if (window.location.protocol === "file:") {
  const warning = byId("runtime-warning");
  warning.textContent = "当前以 file:// 打开，无法连接本机 OCR。请使用 http://127.0.0.1:8000/local-first.html。";
  warning.classList.remove("hidden");
  byId("ocr-button").disabled = true;
}

byId("review-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeCandidateId) return;
  const candidates = await getAll(CANDIDATES);
  const candidate = candidates.find((item) => item.candidate_id === activeCandidateId);
  if (!candidate) { show("review-message", "找不到待审核 candidate，请重新生成。", true); return; }
  const job = {
    ...candidate,
    job_id: `local-${crypto.randomUUID()}`,
    company: byId("candidate-company").value.trim() || "unknown",
    title: byId("candidate-title").value.trim() || "unknown",
    location: byId("candidate-location").value.trim() || "unknown",
    seniority: byId("candidate-seniority").value.trim() || "unknown",
    salary: byId("candidate-salary").value.trim() || "unknown",
    responsibilities: itemsFromText(byId("candidate-responsibilities").value),
    requirements: itemsFromText(byId("candidate-requirements").value),
    application_status: "unknown",
    candidate_status: "confirmed",
    confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  delete job.candidate_id;
  delete job.status;
  await put(JOBS, job);
  await remove(CANDIDATES, activeCandidateId);
  activeCandidateId = null;
  byId("review-form").reset();
  setReviewAvailability(false);
  show("review-message", "已保存到此浏览器的 IndexedDB。", false);
  await renderJobs();
});

byId("discard-candidate").addEventListener("click", async () => {
  if (activeCandidateId) await remove(CANDIDATES, activeCandidateId);
  activeCandidateId = null;
  byId("review-form").reset();
  setReviewAvailability(false);
  show("review-message", "待审核记录已放弃；没有写入职位。", false);
});

byId("export-button").addEventListener("click", async () => {
  const backup = { format: "job-radar-local-backup-v1", exported_at: new Date().toISOString(), jobs: await getAll(JOBS) };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "job-radar-local-backup.json"; link.click();
  URL.revokeObjectURL(url);
  show("backup-message", `已导出 ${backup.jobs.length} 条本地 jobs。`);
});

byId("import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (backup.format !== "job-radar-local-backup-v1" || !Array.isArray(backup.jobs)) throw new Error("unsupported_backup");
    for (const job of backup.jobs) {
      if (!job.job_id || !job.title) throw new Error("invalid_job_record");
      await put(JOBS, job);
    }
    await renderJobs();
    show("backup-message", `已导入 ${backup.jobs.length} 条；相同 job_id 会更新为备份版本。`);
  } catch (error) {
    show("backup-message", "导入失败：不是受支持的 Ariadne 备份，或其中缺少必要字段。", true);
  } finally { event.target.value = ""; }
});

byId("clear-button").addEventListener("click", async () => {
  if (!window.confirm("确定清空此浏览器中 Ariadne 的 jobs 和未审核 candidates 吗？请先导出备份。")) return;
  await clearStore(JOBS); await clearStore(CANDIDATES); activeCandidateId = null;
  byId("review-form").reset(); setReviewAvailability(false);
  await renderJobs(); show("backup-message", "已清空此浏览器的 Ariadne 数据。");
});

setReviewAvailability(false);
refreshVisionConfiguration();
renderJobs().catch(() => show("backup-message", "无法打开 IndexedDB；请检查浏览器隐私设置或存储权限。", true));
