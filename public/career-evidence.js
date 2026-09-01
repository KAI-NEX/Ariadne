"use strict";

const DB_NAME = "job-radar-local-first-v1";
const DB_VERSION = 10;
const SOURCE_DOCUMENTS = "source_documents";
const EXTRACTION_RUNS = "extraction_runs";
const CAREER_ENTITIES = "career_entities";
const ENTITY_REVIEW_DECISIONS = "entity_review_decisions";
const CAREER_EVIDENCE = "career_evidence";
const CAREER_PROFILES = "career_profiles";
const CORRECTION_MEMORY = "correction_memory";
const AI_CAREER_CONTEXTS = "ai_career_contexts";
const AI_CAREER_PROFILES = "ai_career_profiles";
const CAREER_INTELLIGENCE = "career_intelligence";
const CANDIDATE_CONTEXTS = "candidate_contexts";
const CANDIDATE_PROPOSALS = "candidate_proposals";
const CANDIDATE_CONTEXT_PATCHES = "candidate_context_patches";
const PROCESSING_RUNS = "processing_runs";
const PROCESSING_CONSENTS = "processing_consents";
const CONVERSATION_SESSIONS = "conversation_sessions";
const CONVERSATION_MESSAGES = "conversation_messages";
const DEMO_CANDIDATE_ITEMS = "demo_candidate_items";
const DEMO_JOB_CONTEXTS = "demo_job_contexts";
const DEMO_CONVERSATIONS = "demo_conversations";
const DEMO_UI_STATE = "demo_ui_state";
const Domain = window.CareerEvidenceDomain;
const AIDomain = window.AICareerContextDomain;
let selectedSourceId = null;
let selectedAIContextId = null;
let selectedAIFile = null;
let aiSendInProgress = false;

const ENTITY_LABELS = {
  basics: "基本资料",
  work_experience: "工作经历",
  project: "项目",
  education: "教育经历",
  skill_group: "技能组",
  language: "语言",
  volunteer: "志愿经历",
  certificate: "证书",
  award: "奖项",
  publication: "出版物",
  custom_section: "自定义内容",
};

const FIELD_SCHEMAS = {
  basics: [
    ["name", "姓名"], ["label", "职业标签"], ["summary", "简介", "textarea"],
    ["email", "邮箱（隐私字段）"], ["phone", "电话（隐私字段）"], ["location", "地点"],
  ],
  work_experience: [
    ["name", "公司 / 组织"], ["position", "职位"], ["rawDate", "原始日期"], ["location", "地点"],
    ["employmentType", "任职类型"], ["department", "部门"], ["summary", "经历摘要", "textarea"],
    ["responsibilities", "职责（每行一条）", "array"], ["achievements", "成果（每行一条）", "array"],
    ["unclassified_highlights", "待分类原文要点（每行一条）", "array"], ["skills", "明确出现的技能（每行一项）", "array"],
  ],
  project: [
    ["name", "项目名称"], ["category", "作品集章节类别"], ["section_label", "来源章节标题"], ["project_kind", "项目类型"], ["rawDate", "原始日期"], ["organization", "所属组织"],
    ["context", "项目背景", "textarea"], ["role", "个人角色"],
    ["ownership_scope", "个人负责范围", "textarea"], ["problem", "问题 / 背景", "textarea"], ["audience", "用户 / 受众"],
    ["responsibilities", "职责（每行一条）", "array"], ["process", "过程 / 方法（每行一条）", "array"],
    ["outputs", "交付物（每行一条）", "array"], ["outcomes", "结果 / 指标（每行一条）", "array"],
    ["unclassified_highlights", "待分类原文要点（每行一条）", "array"],
    ["skills", "技能（每行一项）", "array"], ["tools", "工具（每行一项）", "array"],
    ["artifacts", "作品 / Repo / URL（每行一项）", "array"], ["ai_assistance", "AI 协作方式", "textarea"],
    ["boundaries", "责任边界 / 未声称内容（每行一条）", "array"],
  ],
  education: [
    ["institution", "院校"], ["area", "专业"], ["studyType", "学位"], ["rawDate", "原始日期"],
    ["location", "地点"], ["score", "成绩"], ["courses", "课程（每行一项）", "array"],
    ["highlights", "补充信息（每行一条）", "array"],
  ],
  skill_group: [["name", "技能组"], ["level", "等级（仅保留明确自述）"], ["keywords", "技能（每行一项）", "array"]],
  language: [["language", "语言"], ["fluency", "熟练度（仅保留明确自述）"]],
  award: [["name", "奖项名称"], ["result", "获奖结果"], ["date", "日期"], ["awarder", "颁发方"], ["location", "地点"], ["summary", "补充说明", "textarea"]],
};

function byId(id) { return document.getElementById(id); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
function show(id, message, error = false) { const element = byId(id); element.textContent = message; element.classList.toggle("error", error); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function reviewStatusLabel(value) {
  return ({ needs_review: "待审核", confirmed: "已确认", accepted: "已接受", rejected: "已拒绝", stale: "已失效" })[value] || value || "未知";
}
function intelligenceKindLabel(value) {
  return ({ capability_boundary: "能力边界", interest_signal: "兴趣信号", career_direction_hypothesis: "职业方向假设", open_question: "开放问题" })[value] || value;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("jobs")) db.createObjectStore("jobs", { keyPath: "job_id" });
      if (!db.objectStoreNames.contains("candidates")) db.createObjectStore("candidates", { keyPath: "candidate_id" });
      if (!db.objectStoreNames.contains(SOURCE_DOCUMENTS)) db.createObjectStore(SOURCE_DOCUMENTS, { keyPath: "source_document_id" });
      if (!db.objectStoreNames.contains(EXTRACTION_RUNS)) db.createObjectStore(EXTRACTION_RUNS, { keyPath: "extraction_run_id" });
      if (!db.objectStoreNames.contains(CAREER_ENTITIES)) db.createObjectStore(CAREER_ENTITIES, { keyPath: "entity_id" });
      if (!db.objectStoreNames.contains(ENTITY_REVIEW_DECISIONS)) db.createObjectStore(ENTITY_REVIEW_DECISIONS, { keyPath: "decision_id" });
      if (!db.objectStoreNames.contains(CAREER_EVIDENCE)) db.createObjectStore(CAREER_EVIDENCE, { keyPath: "evidence_id" });
      if (!db.objectStoreNames.contains("review_decisions")) db.createObjectStore("review_decisions", { keyPath: "decision_id" });
      if (!db.objectStoreNames.contains(CAREER_PROFILES)) db.createObjectStore(CAREER_PROFILES, { keyPath: "profile_id" });
      if (!db.objectStoreNames.contains(CORRECTION_MEMORY)) db.createObjectStore(CORRECTION_MEMORY, { keyPath: "correction_id" });
      if (!db.objectStoreNames.contains(AI_CAREER_CONTEXTS)) db.createObjectStore(AI_CAREER_CONTEXTS, { keyPath: "artifact_id" });
      if (!db.objectStoreNames.contains(AI_CAREER_PROFILES)) db.createObjectStore(AI_CAREER_PROFILES, { keyPath: "profile_id" });
      if (!db.objectStoreNames.contains(CAREER_INTELLIGENCE)) db.createObjectStore(CAREER_INTELLIGENCE, { keyPath: "record_id" });
      if (!db.objectStoreNames.contains(CANDIDATE_CONTEXTS)) db.createObjectStore(CANDIDATE_CONTEXTS, { keyPath: "context_id" });
      if (!db.objectStoreNames.contains(CANDIDATE_PROPOSALS)) db.createObjectStore(CANDIDATE_PROPOSALS, { keyPath: "candidate_proposal_id" });
      if (!db.objectStoreNames.contains(CANDIDATE_CONTEXT_PATCHES)) db.createObjectStore(CANDIDATE_CONTEXT_PATCHES, { keyPath: "patch_id" });
      if (!db.objectStoreNames.contains(PROCESSING_RUNS)) db.createObjectStore(PROCESSING_RUNS, { keyPath: "run_id" });
      if (!db.objectStoreNames.contains(PROCESSING_CONSENTS)) db.createObjectStore(PROCESSING_CONSENTS, { keyPath: "consent_id" });
      if (!db.objectStoreNames.contains(CONVERSATION_SESSIONS)) db.createObjectStore(CONVERSATION_SESSIONS, { keyPath: "conversation_id" });
      if (!db.objectStoreNames.contains(CONVERSATION_MESSAGES)) db.createObjectStore(CONVERSATION_MESSAGES, { keyPath: "message_id" });
      if (!db.objectStoreNames.contains(DEMO_CANDIDATE_ITEMS)) db.createObjectStore(DEMO_CANDIDATE_ITEMS, { keyPath: "item_id" });
      if (!db.objectStoreNames.contains(DEMO_JOB_CONTEXTS)) db.createObjectStore(DEMO_JOB_CONTEXTS, { keyPath: "job_context_id" });
      if (!db.objectStoreNames.contains(DEMO_CONVERSATIONS)) db.createObjectStore(DEMO_CONVERSATIONS, { keyPath: "conversation_id" });
      if (!db.objectStoreNames.contains(DEMO_UI_STATE)) db.createObjectStore(DEMO_UI_STATE, { keyPath: "state_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function operation(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = callback(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

function getAll(storeName) { return operation(storeName, "readonly", (store) => store.getAll()); }
function get(storeName, key) { return operation(storeName, "readonly", (store) => store.get(key)); }
function put(storeName, value) { return operation(storeName, "readwrite", (store) => store.put(value)); }

function correctionId(kind, sourceText, targetValue) {
  return `local-correction-${kind}-${encodeURIComponent(sourceText)}-${encodeURIComponent(targetValue)}`;
}

async function saveCorrection(kind, sourceText, targetValue, documentType = "") {
  const source = String(sourceText || "").trim();
  const target = String(targetValue || "").trim();
  if (!source || !target || source.length > 240 || target.length > 240) throw new Error("invalid_local_correction");
  const now = new Date().toISOString();
  const correctionIdValue = correctionId(kind, source, target);
  const previous = await get(CORRECTION_MEMORY, correctionIdValue);
  await put(CORRECTION_MEMORY, {
    correction_id: correctionIdValue, kind, source_text: source, target_value: target, document_type: documentType,
    created_at: previous?.created_at || now, updated_at: now, use_count: previous?.use_count || 0, scope: "local_browser_only",
  });
}

async function correctionMemoryForImport(documentType = byId("document-type").value) {
  const corrections = await getAll(CORRECTION_MEMORY);
  const applicable = corrections.filter((item) => !item.document_type || item.document_type === documentType);
  const now = new Date().toISOString();
  await Promise.all(applicable.map((item) => put(CORRECTION_MEMORY, { ...item, use_count: (item.use_count || 0) + 1, updated_at: now })));
  return applicable.map(({ kind, source_text, target_value, document_type }) => ({ kind, source_text, target_value, document_type }));
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function sha256File(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function aiSourceDocument(file, documentType, sourceHash) {
  const sourceId = `source-${sourceHash.slice(0, 20)}`;
  const previous = await get(SOURCE_DOCUMENTS, sourceId);
  const now = new Date().toISOString();
  const modes = new Set(previous?.ingestion_modes || []);
  modes.add("ai");
  return {
    ...(previous || {}),
    source_document_id: sourceId,
    original_filename: file.name,
    media_type: mediaTypeFor(file),
    content_hash: sourceHash,
    byte_size: file.size,
    document_type: documentType,
    imported_at: previous?.imported_at || now,
    updated_at: now,
    extraction_status: previous?.extraction_status || "source_preserved_for_ai",
    extraction_method: previous?.extraction_method || "none_ai_direct",
    processing_boundary: previous?.processing_boundary || "browser_source_preserved_before_explicit_ai_call",
    ingestion_modes: [...modes],
    file_blob: file,
  };
}

function aiBlocksFromMarkdown(markdown) {
  const parts = String(markdown || "").split(/(?=^##\s+)/m).map((item) => item.trim()).filter(Boolean);
  return parts.filter((part) => /^##\s+/.test(part)).map((part, index) => {
    const lines = part.split("\n");
    const title = lines.shift().replace(/^##\s+/, "").trim();
    return { block_id: `ai-block-${index + 1}`, title, content: lines.join("\n").trim() };
  }).filter((block) => !["认识论标记", "来源与页码"].includes(block.title));
}

function aiBlockMarkup(block) {
  return `<article class="ai-understanding-card" data-ai-block-id="${escapeHtml(block.block_id)}"><label><strong>${escapeHtml(block.title)}</strong><textarea data-ai-block-content rows="5">${escapeHtml(block.content)}</textarea></label></article>`;
}

function editedAIBlocks() {
  return [...byId("ai-understanding").querySelectorAll("[data-ai-block-id]")].map((card) => ({
    block_id: card.dataset.aiBlockId,
    title: card.querySelector("strong").textContent,
    content: card.querySelector("[data-ai-block-content]").value.trim(),
  })).filter((block) => block.content);
}

function aiProfileMarkdown(profile) {
  return [`# 个人档案`, "", `- 生成时间：${profile.generated_at}`, `- 来源：${profile.provider}/${profile.model} · ${profile.original_filename}`, "", ...profile.blocks.flatMap((block) => [`## ${block.title}`, block.content, ""])].join("\n");
}

function setAIProgress(state, message) {
  const labels = { idle: "等待选择 PDF", ready: "可以开始解析", sending: "已发送，正在等待 AI 返回", returned: "AI 已返回，等待你确认", failed: "本次解析没有生成结果" };
  byId("ai-progress").dataset.state = state;
  byId("ai-progress-title").textContent = labels[state] || "AI 解析状态";
  show("ai-import-message", message, state === "failed");
}

function updateAIStartButton(preserveProgress = false) {
  const ready = Boolean(selectedAIFile && byId("ai-upload-consent").checked && byId("ai-cost-consent").checked && byId("ai-model").value.trim() && !aiSendInProgress);
  byId("run-ai-career-ingestion").disabled = !ready;
  if (selectedAIFile && !aiSendInProgress && !preserveProgress) setAIProgress(ready ? "ready" : "idle", ready ? "两项确认已完成。点击“开始解析”后会发送一次完整资料。" : "请完成两项确认，并先检查所选模型；尚未发送。");
}

async function renderAIContexts() {
  const contexts = (await getAll(AI_CAREER_CONTEXTS)).filter((item) => item.contract_id === AIDomain.CONTRACT_ID)
    .sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)));
  if (selectedAIContextId && !contexts.some((item) => item.artifact_id === selectedAIContextId)) selectedAIContextId = null;
  if (!selectedAIContextId && contexts.length) selectedAIContextId = contexts[0].artifact_id;
  byId("ai-context-list").innerHTML = contexts.length ? contexts.map((item) => `<article class="ai-context-record"><button type="button" data-ai-context-id="${escapeHtml(item.artifact_id)}"><strong>AI 已返回：${escapeHtml(item.original_filename)}</strong><p>${escapeHtml(item.provider)} / ${escapeHtml(item.model)} · ${escapeHtml(reviewStatusLabel(item.review_status))}</p><p class="muted">返回时间：${escapeHtml(item.generated_at)} · 提示词版本：${escapeHtml(item.prompt_version)}</p></button></article>`).join("") : `<p class="muted">尚无 AI 返回结果。选择文件、确认资料传输与费用后才会调用模型服务商。</p>`;
  byId("ai-context-list").querySelectorAll("[data-ai-context-id]").forEach((button) => button.addEventListener("click", async () => {
    selectedAIContextId = button.dataset.aiContextId;
    await renderAIContexts();
  }));
  const selected = contexts.find((item) => item.artifact_id === selectedAIContextId);
  byId("ai-context-viewer").classList.toggle("hidden", !selected);
  if (!selected) return;
  const usage = Object.keys(selected.usage || {}).length ? ` · 用量：${JSON.stringify(selected.usage)}` : "";
  byId("ai-context-meta").textContent = `已收到 AI 返回 · ${reviewStatusLabel(selected.review_status)} · ${selected.provider}/${selected.model} · ${selected.generated_at}${usage}`;
  byId("ai-context-markdown").textContent = selected.canonical_markdown;
  const blocks = selected.review_blocks?.length ? selected.review_blocks : aiBlocksFromMarkdown(selected.canonical_markdown);
  byId("ai-understanding").innerHTML = blocks.length ? blocks.map(aiBlockMarkup).join("") : `<p class="muted">AI 没有返回可展示的职业信息区块。请查看高级选项中的原始返回。</p>`;
  byId("accept-ai-context").disabled = selected.review_status !== "needs_review";
}

async function ingestWithAI(file, forceRegenerate = false, documentType = byId("ai-document-type").value) {
  if (mediaTypeFor(file) !== "application/pdf") throw new Error("AI 模式当前只接受原始 PDF");
  if (file.size > 50_000_000) throw new Error("原始 PDF 超过当前模型服务商 50 MB 直传上限；原文件不会被改写或压缩后偷偷上传");
  const sourceHash = await sha256File(file);
  const source = await aiSourceDocument(file, documentType, sourceHash);
  await put(SOURCE_DOCUMENTS, source);
  selectedSourceId = source.source_document_id;
  const provider = byId("ai-provider").value;
  const model = byId("ai-model").value.trim();
  if (!model) throw new Error("请先检查所选 AI 模型是否可用于完整资料验证");
  const contexts = await getAll(AI_CAREER_CONTEXTS);
  const cached = AIDomain.reusableArtifact(contexts, sourceHash, provider, model);
  if (cached && !forceRegenerate) {
    selectedAIContextId = cached.artifact_id;
    show("ai-import-message", "已复用同一来源摘要、模型服务商、模型与提示词版本的已接受职业上下文；没有发生付费 API 调用。");
    await renderAll();
    return cached;
  }
  if (!byId("ai-upload-consent").checked || !byId("ai-cost-consent").checked) throw new Error("请先完成资料传输与可能费用两项确认");
  setAIProgress("sending", `已发送至 ${provider}/${model}，正在等待 AI 返回…`);
  const response = await fetch("/api/ai-career-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      media_type: mediaTypeFor(file),
      document_type: documentType,
      document_data_url: await readAsDataURL(file),
      source_hash: sourceHash,
      provider,
      model,
      prompt_version: AIDomain.PROMPT_VERSION,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    const details = (result.validation_errors || []).join("；");
    throw new Error(`${result.error || "ai_career_ingestion_failed"}${details ? `：${details}` : ""}`);
  }
  if (result.source_hash !== sourceHash || result.source_document_id !== source.source_document_id) throw new Error("AI 返回结果与来源文档不一致");
  const artifact = AIDomain.createArtifact(result, source);
  await put(AI_CAREER_CONTEXTS, artifact);
  selectedAIContextId = artifact.artifact_id;
  setAIProgress("returned", `AI 已返回：${provider}/${model}。请在下方直接检查和修改“AI 读取到什么”，再确认生成个人档案。`);
  await renderAll();
  return artifact;
}

async function loadAIConfig() {
  try {
    const response = await fetch("/api/ai-career-ingestion-config");
    const config = await response.json();
    if (!response.ok) throw new Error(config.error || "ai_config_failed");
    const providers = config.providers || [];
    const enabled = providers.filter((item) => item.supports_complete_document_review).map((item) => `${item.provider_id}：${item.credential_status}`).join(" · ");
    byId("ai-config-status").textContent = `${enabled || "暂无启用模型"} · ${config.prompt_version}`;
  } catch (error) {
    byId("ai-config-status").textContent = `模型服务商配置读取失败：${error.message}`;
  }
}

function mediaTypeFor(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "txt") return "text/plain";
  return file.type;
}

function warningText(warning) {
  const labels = {
    portfolio_has_no_extractable_text: "作品集没有可读取文本",
    needs_visual_extraction: "需要视觉解析后才能识别项目",
    ocr_text_requires_entity_review: "已使用本地 OCR；逐页文字与字段映射需要人工确认",
    portfolio_projects_not_detected: "未识别到完整项目实体",
    unsupported_entity_document_type: "该资料类型尚无自动实体解析器",
  };
  return labels[warning] || warning;
}

function limitationText(limitations) {
  const labels = {
    self_reported_resume_claim_not_independently_verified: "资料自述，尚未独立验证",
    ai_assisted_work_not_independent_coding_evidence: "AI 辅助工作，不构成独立编码能力证据",
    private_contact_fields_not_career_evidence: "联系方式是隐私资料，不派生职业证据",
    self_reported_skill_not_demonstrated_by_work_evidence: "简历自述技能，尚未由工作成果独立证明",
    self_reported_language_not_independently_verified: "语言能力为简历自述，尚未独立验证",
    portfolio_text_ocr_requires_human_review: "作品集文字来自本地 OCR，需结合原页确认",
    self_reported_portfolio_claim_not_independently_verified: "作品集自述，尚未独立验证",
  };
  return (limitations || []).map((item) => labels[item] || item).join("；") || "无额外限制";
}

async function importDocument(file, documentType = byId("document-type").value) {
  show("import-message", "正在本机提取来源区块，并生成待审核职业实体…");
  const mediaType = mediaTypeFor(file);
  const response = await fetch("/api/career-document-extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      media_type: mediaType,
      document_type: documentType,
      document_data_url: await readAsDataURL(file),
      local_corrections: await correctionMemoryForImport(documentType),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "career_document_extraction_failed");

  const importedAt = new Date().toISOString();
  const sourceDocument = {
    ...result.source_document,
    imported_at: importedAt,
    updated_at: importedAt,
    processing_boundary: result.processing_boundary,
    model_call_made: result.model_call_made,
    extracted_pages: result.pages,
    document_blocks: result.document_blocks || [],
    file_blob: file,
  };
  const extractionRun = { ...result.extraction_run, created_at: importedAt, completed_at: importedAt };
  await put(SOURCE_DOCUMENTS, sourceDocument);
  await put(EXTRACTION_RUNS, extractionRun);
  const entities = Domain.createCareerEntities(sourceDocument, extractionRun, result.candidate_entities || []);
  let created = 0;
  for (const entity of entities) {
    if (!(await get(CAREER_ENTITIES, entity.entity_id))) {
      await put(CAREER_ENTITIES, entity);
      created += 1;
    }
  }
  selectedSourceId = sourceDocument.source_document_id;
  if (extractionRun.status === "needs_visual_extraction") {
    show("import-message", "来源文档已保存；该作品集仅含图像，已安全标记为需要视觉解析，未生成虚假项目或证据。", true);
  } else {
    const ocrNote = sourceDocument.extraction_method.includes("apple_vision") || sourceDocument.extraction_method.includes("vision_ocr") ? "已对无可用原生文本的页面使用本地 OCR；" : "";
    show("import-message", `${ocrNote}已保存来源文档和提取记录，并生成 ${created} 个新的待审核实体；未调用外部模型。`);
  }
  await renderAll();
}

async function importFiles(files) {
  const accepted = [...files].filter(Boolean);
  if (!accepted.length) return;
  for (const file of accepted) await importDocument(file);
}

function pastedTextFile(text) {
  return new File([text], `pasted-career-material-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`, { type: "text/plain" });
}

function fieldMarkup(entity, [field, label, kind]) {
  const value = entity.data?.[field];
  const display = Array.isArray(value) ? value.join("\n") : value ?? "";
  if (kind === "textarea" || kind === "array") {
    return `<label>${escapeHtml(label)}<textarea data-field="${escapeHtml(field)}" data-kind="${kind || "string"}" rows="${kind === "array" ? 4 : 3}">${escapeHtml(display)}</textarea></label>`;
  }
  return `<label>${escapeHtml(label)}<input data-field="${escapeHtml(field)}" data-kind="string" value="${escapeHtml(display)}"></label>`;
}

function provenanceMarkup(entity) {
  const anchors = [];
  const seen = new Set();
  Object.values(entity.field_provenance || {}).flat().forEach((anchor) => {
    if (!seen.has(anchor.anchor_id)) { seen.add(anchor.anchor_id); anchors.push(anchor); }
  });
  if (!anchors.length) return `<p class="muted">没有来源锚点；确认前需要人工补充。</p>`;
  return `<details class="entity-provenance"><summary>查看来源位置（${anchors.length}）</summary>${anchors.slice(0, 6).map((anchor) => `<blockquote><strong>${escapeHtml(anchor.source_location)}</strong><br>${escapeHtml(anchor.source_excerpt)}</blockquote>`).join("")}${anchors.length > 6 ? `<p class="muted">另有 ${anchors.length - 6} 个来源锚点。</p>` : ""}</details>`;
}

function entityCard(entity) {
  const schema = FIELD_SCHEMAS[entity.entity_type] || Object.keys(entity.data || {}).map((field) => [field, field, Array.isArray(entity.data[field]) ? "array" : "string"]);
  const typeControl = ["work_experience", "education", "project"].includes(entity.entity_type)
    ? `<label class="muted">类型 <select class="entity-type-select">${[["work_experience", "工作经历"], ["education", "教育经历"], ["project", "项目"]].map(([value, label]) => `<option value="${value}" ${value === entity.entity_type ? "selected" : ""}>${label}</option>`).join("")}</select></label>`
    : `<span class="muted">${escapeHtml(ENTITY_LABELS[entity.entity_type] || entity.entity_type)}</span>`;
  return `<article class="entity-review-card" data-entity-id="${escapeHtml(entity.entity_id)}">
    <div class="entity-card-heading"><p class="job-badge">本地备用候选 · ${escapeHtml(ENTITY_LABELS[entity.entity_type] || entity.entity_type)}</p>${typeControl}<span class="muted">#${entity.order + 1}</span></div>
    <p class="muted">来源：本地规则解析，未调用 AI；留空或“待分类原文要点”表示解析器无法可靠映射，不是 AI 结论。</p>
    <div class="entity-fields">${schema.map((field) => fieldMarkup(entity, field)).join("")}</div>
    ${provenanceMarkup(entity)}
    <p class="muted"><strong>限制：</strong>${escapeHtml(limitationText(entity.limitations))}</p>
    <label>审核备注（可选）<input class="review-note" placeholder="为什么确认、编辑或拒绝"></label>
    <div class="button-row"><button type="button" data-action="approve">确认整个实体</button><button type="button" class="secondary" data-action="reject">拒绝实体</button></div>
  </article>`;
}

async function rememberReviewCorrections(entity, afterData, afterType) {
  for (const [field, afterValue] of Object.entries(afterData || {})) {
    const beforeValue = entity.data?.[field];
    if (typeof beforeValue === "string" && typeof afterValue === "string" && beforeValue.trim() && afterValue.trim() && beforeValue.trim() !== afterValue.trim()) {
      await saveCorrection("ocr_replacement", beforeValue, afterValue, "");
    }
  }
  if (afterType !== entity.entity_type) {
    const sourceText = entity.data?.name || entity.data?.institution;
    if (sourceText) await saveCorrection("classification_correction", sourceText, afterType, "");
  }
}

function readEntityData(card, entity) {
  const data = clone(entity.data || {});
  card.querySelectorAll("[data-field]").forEach((input) => {
    const value = input.value.trim();
    data[input.dataset.field] = input.dataset.kind === "array" ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : value;
  });
  return data;
}

// A type correction changes the semantic shape as well as the label. Keep the
// values that have an equivalent meaning, and leave all unproven fields empty.
// This mirrors the server-side classification-correction rule and prevents a
// "company" field from silently becoming a malformed education record.
function dataForEntityType(data, fromType, toType) {
  if (fromType === toType) return data;
  const highlights = Array.isArray(data.highlights) ? data.highlights : (Array.isArray(data.responsibilities) ? data.responsibilities : []);
  if (toType === "education") {
    return {
      institution: data.institution || data.name || "",
      area: data.area || "",
      studyType: data.studyType || "",
      location: data.location || "",
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      rawDate: data.rawDate || "",
      score: data.score || "",
      courses: Array.isArray(data.courses) ? data.courses : [],
      summary: data.summary || "",
      highlights,
    };
  }
  if (toType === "work_experience") {
    return {
      name: data.name || data.institution || "",
      position: data.position || data.role || "",
      location: data.location || "",
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      rawDate: data.rawDate || "",
      summary: data.summary || "",
      highlights,
      unclassified_highlights: Array.isArray(data.unclassified_highlights) ? data.unclassified_highlights : [],
    };
  }
  if (toType === "project") {
    return {
      name: data.name || data.institution || "",
      description: data.description || data.summary || "",
      roles: Array.isArray(data.roles) ? data.roles : (data.position ? [data.position] : []),
      highlights,
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      startDate: data.startDate || null,
      endDate: data.endDate || null,
    };
  }
  return data;
}

function groupedPendingMarkup(entities) {
  const groups = new Map();
  entities.sort((a, b) => a.order - b.order).forEach((entity) => {
    if (!groups.has(entity.entity_type)) groups.set(entity.entity_type, []);
    groups.get(entity.entity_type).push(entity);
  });
  return [...groups.entries()].map(([type, records]) => `<section class="entity-section"><h3>${escapeHtml(ENTITY_LABELS[type] || type)} <span class="muted">${records.length}</span></h3>${records.map(entityCard).join("")}</section>`).join("");
}

async function renderCandidates(records, sourceId = null) {
  const candidates = records.filter((record) => record.contract_id === Domain.ENTITY_CONTRACT_ID && record.review_status === "needs_review" && (!sourceId || record.source_document_ids?.includes(sourceId)));
  byId("review-count").textContent = `${candidates.length} 个待审核实体`;
  byId("candidate-list").innerHTML = candidates.length ? groupedPendingMarkup(candidates) : `<p class="muted">当前没有待审核职业实体。导入资料或重新打开已确认实体后会更新。</p>`;
  byId("candidate-list").querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
    const card = button.closest("[data-entity-id]");
    const entity = await get(CAREER_ENTITIES, card.dataset.entityId);
    try {
      const selectedType = card.querySelector(".entity-type-select")?.value || entity.entity_type;
      const editedData = dataForEntityType(readEntityData(card, entity), entity.entity_type, selectedType);
      const reviewed = Domain.reviewEntity(entity, button.dataset.action, editedData, card.querySelector(".review-note").value);
      if (reviewed.entity.review_status === "confirmed" && selectedType !== entity.entity_type) {
        reviewed.entity.entity_type = selectedType;
        reviewed.decision.after_data = clone(editedData);
      }
      if (reviewed.entity.review_status === "confirmed") await rememberReviewCorrections(entity, reviewed.entity.data, selectedType);
      await put(CAREER_ENTITIES, reviewed.entity);
      await put(ENTITY_REVIEW_DECISIONS, reviewed.decision);
      show("review-message", reviewed.entity.review_status === "confirmed" ? "实体已确认；职业证据已从确认后的字段派生，原始来源锚点保持不变。" : "实体已拒绝，不会进入职业档案或派生证据。");
      await renderAll();
    } catch (error) {
      show("review-message", `审核失败：${error.message}`, true);
    }
  }));
}

function entityTitle(entity) {
  const data = entity.data || {};
  return data.name || data.institution || data.language || data.label || entity.entity_type;
}

function confirmedCard(entity) {
  const data = entity.data || {};
  const detail = entity.entity_type === "work_experience" ? `${data.position || ""} · ${data.rawDate || ""}` : entity.entity_type === "project" ? data.context : entity.entity_type === "education" ? `${data.area || ""} ${data.studyType || ""}` : entity.entity_type === "skill_group" ? (data.keywords || []).join("、") : "";
  return `<article class="confirmed-entity-card" data-confirmed-entity-id="${escapeHtml(entity.entity_id)}"><p class="job-badge">已确认 · ${escapeHtml(ENTITY_LABELS[entity.entity_type] || entity.entity_type)}</p><h3>${escapeHtml(entityTitle(entity))}</h3><p>${escapeHtml(detail || "")}</p><p class="muted">${escapeHtml(entity.entity_id)}</p><button type="button" class="secondary reopen-entity">重新编辑</button></article>`;
}

async function syncDerivedEvidence(entities) {
  const desired = Domain.deriveCareerEvidence(entities);
  const existing = (await getAll(CAREER_EVIDENCE)).filter((record) => record.contract_id === Domain.EVIDENCE_CONTRACT_ID);
  const desiredIds = new Set(desired.map((record) => record.evidence_id));
  for (const record of desired) {
    const previous = existing.find((item) => item.evidence_id === record.evidence_id);
    if (!previous || previous.source_entity_updated_at !== record.source_entity_updated_at || previous.verification_status !== "confirmed") {
      await put(CAREER_EVIDENCE, { ...record, created_at: previous?.created_at || record.created_at });
    }
  }
  for (const record of existing) {
    if (!desiredIds.has(record.evidence_id) && record.verification_status !== "stale") {
      await put(CAREER_EVIDENCE, { ...record, verification_status: "stale", stale_reason: "source_entity_not_confirmed", updated_at: new Date().toISOString() });
    }
  }
  return desired;
}

async function loadJobsForCareerIntelligence() {
  const response = await fetch("/api/jobs");
  if (!response.ok) throw new Error("无法读取现有职位记录");
  const payload = await response.json();
  return Array.isArray(payload) ? payload : (payload.jobs || []);
}

function intelligenceRecordMarkup(record) {
  const state = record.kind === "capability_boundary" ? `<label>状态<select class="intelligence-state">${Domain.CAPABILITY_STATES.map((value) => `<option${value === record.state ? " selected" : ""}>${value}</option>`).join("")}</select></label>` : "";
  const title = record.kind === "capability_boundary" ? record.capability : record.kind === "interest_signal" ? record.source_title : record.kind === "career_direction_hypothesis" ? record.hypothesis : record.question;
  const body = record.kind === "capability_boundary" ? `${record.reasoning} 限制：${(record.limitations || []).join("；")}` : record.kind === "interest_signal" ? `${record.signal} ${record.interpretation}` : record.kind === "career_direction_hypothesis" ? `${record.rationale} 不确定性：${record.uncertainty}` : record.changes_model;
  return `<article class="confirmed-entity-card intelligence-card" data-intelligence-id="${escapeHtml(record.record_id)}"><p class="job-badge">${escapeHtml(intelligenceKindLabel(record.kind))} · ${escapeHtml(reviewStatusLabel(record.review_status))}</p><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p>${state}<label>审核备注 / 编辑说明<textarea class="intelligence-note">${escapeHtml(record.review_note || "")}</textarea></label><div class="button-row"><button type="button" data-intelligence-action="confirm">确认</button><button type="button" data-intelligence-action="reject" class="secondary">拒绝</button></div></article>`;
}

async function renderCareerIntelligence() {
  const records = (await getAll(CAREER_INTELLIGENCE)).filter((record) => record.contract_id === Domain.CAREER_INTELLIGENCE_CONTRACT_ID);
  const groups = [["capability_boundary", "能力边界"], ["interest_signal", "观察到的兴趣"], ["career_direction_hypothesis", "方向假设"], ["open_question", "开放问题"]];
  byId("career-intelligence-list").innerHTML = records.length ? groups.map(([kind, label]) => {
    const items = records.filter((record) => record.kind === kind);
    return `<section class="entity-section"><h3>${label} <span class="muted">${items.length}</span></h3>${items.length ? items.map(intelligenceRecordMarkup).join("") : `<p class="muted">尚无 ${label}。</p>`}</section>`;
  }).join("") : `<p class="muted">尚未生成职业智能提案。它只会读取已确认职业证据与已有职位记录；不会重跑资料导入或调用模型。</p>`;
  byId("career-intelligence-list").querySelectorAll("[data-intelligence-action]").forEach((button) => button.addEventListener("click", async () => {
    const card = button.closest("[data-intelligence-id]");
    const record = await get(CAREER_INTELLIGENCE, card.dataset.intelligenceId);
    const now = new Date().toISOString();
    const confirmed = button.dataset.intelligenceAction === "confirm";
    const next = { ...record, review_status: confirmed ? "confirmed" : "rejected", review_note: card.querySelector(".intelligence-note").value.trim() || null, reviewed_at: now, updated_at: now };
    if (next.kind === "capability_boundary") next.state = card.querySelector(".intelligence-state").value;
    if (next.kind === "career_direction_hypothesis") next.status = confirmed ? "CONFIRMED" : "REJECTED";
    await put(CAREER_INTELLIGENCE, next);
    show("career-intelligence-message", confirmed ? "已确认并保存到当前浏览器；它不会改写原始证据。" : "已拒绝并保存；原始证据、职位描述与历史提案均未删除。");
    await renderCareerIntelligence();
  }));
}

async function generateCareerIntelligence() {
  const [entities, jobs] = await Promise.all([getAll(CAREER_ENTITIES), loadJobsForCareerIntelligence()]);
  const evidence = await syncDerivedEvidence(entities);
  const proposal = Domain.proposeCareerIntelligence(evidence, jobs);
  const existing = await getAll(CAREER_INTELLIGENCE);
  for (const record of [...proposal.capabilities, ...proposal.interests, ...proposal.directions, ...proposal.questions]) {
    const previous = existing.find((item) => item.record_id === record.record_id);
    await put(CAREER_INTELLIGENCE, { ...record, contract_id: Domain.CAREER_INTELLIGENCE_CONTRACT_ID, created_at: previous?.created_at || record.generated_at, updated_at: record.generated_at, review_status: previous?.review_status || record.review_status, review_note: previous?.review_note || null, reviewed_at: previous?.reviewed_at || null, ...(previous?.review_status ? { state: previous.state || record.state, status: previous.status || record.status } : {}) });
  }
  show("career-intelligence-message", `已生成 ${proposal.capabilities.length} 个能力边界、${proposal.interests.length} 个兴趣信号、${proposal.directions.length} 个方向假设和 ${proposal.questions.length} 个开放问题。全部仍需人工审核。`);
  await renderCareerIntelligence();
}

async function renderAll() {
  const [sources, entities, runs, allEvidence, corrections] = await Promise.all([getAll(SOURCE_DOCUMENTS), getAll(CAREER_ENTITIES), getAll(EXTRACTION_RUNS), getAll(CAREER_EVIDENCE), getAll(CORRECTION_MEMORY)]);
  if (selectedSourceId && !sources.some((source) => source.source_document_id === selectedSourceId)) selectedSourceId = null;
  const runBySource = new Map(runs.map((run) => [run.source_document_id, run]));
  byId("source-summary").innerHTML = sources.length ? sources.map((source) => {
    const run = runBySource.get(source.source_document_id);
    const warnings = (run?.warnings || []).map(warningText);
    const localAction = run ? `<button type="button" class="secondary source-reextract" data-reextract-source-id="${escapeHtml(source.source_document_id)}">重新识别此资料</button>` : `<p class="muted">仅 AI 来源：尚未运行本地解析器。</p>`;
    return `<article class="source-record ${source.source_document_id === selectedSourceId ? "selected" : ""}"><button type="button" class="source-select" data-source-id="${escapeHtml(source.source_document_id)}"><strong>${escapeHtml(source.original_filename)}</strong><p>${escapeHtml(source.document_type)} · ${escapeHtml(source.extraction_status)} · ${source.byte_size} 字节</p><p class="muted">${escapeHtml(source.source_document_id)} · ${escapeHtml(source.content_hash)}</p>${warnings.length ? `<p class="source-warning">${escapeHtml(warnings.join("；"))}</p>` : ""}</button>${localAction}</article>`;
  }).join("") : `<p class="muted">尚未导入来源文档。</p>`;
  byId("source-summary").querySelectorAll("[data-source-id]").forEach((button) => button.addEventListener("click", async () => {
    selectedSourceId = button.dataset.sourceId === selectedSourceId ? null : button.dataset.sourceId;
    if (selectedSourceId) {
      const sourceEntities = entities.filter((entity) => entity.contract_id === Domain.ENTITY_CONTRACT_ID && entity.source_document_ids?.includes(selectedSourceId));
      const pendingCount = sourceEntities.filter((entity) => entity.review_status === "needs_review").length;
      const confirmedCount = sourceEntities.filter((entity) => entity.review_status === "confirmed").length;
      const sourceEvidenceCount = allEvidence.filter((item) => item.contract_id === Domain.EVIDENCE_CONTRACT_ID && item.verification_status === "confirmed" && item.source_document_ids?.includes(selectedSourceId)).length;
      show("import-message", `已选中资料：${pendingCount} 个待审核、${confirmedCount} 个已确认、${sourceEvidenceCount} 条派生证据；下方已同步筛选。再次点击可取消。`);
    } else show("import-message", "已取消资料筛选，显示全部职业实体。");
    await renderAll();
    byId("review-heading").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  byId("source-summary").querySelectorAll("[data-reextract-source-id]").forEach((button) => button.addEventListener("click", async () => {
    const source = sources.find((item) => item.source_document_id === button.dataset.reextractSourceId);
    if (!source?.file_blob) { show("import-message", "该历史资料没有可用本地文件内容；请重新选择原文件。", true); return; }
    try {
      show("import-message", "正在使用当前本地解析器重新识别该资料…");
      await importDocument(source.file_blob, source.document_type);
    } catch (error) { show("import-message", `重新识别失败：${error.message}。原资料与既有数据未删除。`, true); }
  }));
  byId("memory-count").textContent = `${corrections.length} 条本地记忆`;
  byId("correction-summary").innerHTML = corrections.length ? corrections.slice(-8).reverse().map((item) => `<div class="correction-memory-item"><strong>${escapeHtml(item.kind)}</strong> · ${escapeHtml(item.source_text)} → ${escapeHtml(item.target_value)}</div>`).join("") : `<p class="muted">尚无本地解析记忆。审核时的文字修改会自动记录；也可在上方手动添加。</p>`;
  const activeEntities = entities.filter((entity) => entity.contract_id === Domain.ENTITY_CONTRACT_ID && entity.review_status !== "rejected");
  const legacyEvidenceCount = allEvidence.filter((record) => record.contract_id !== Domain.EVIDENCE_CONTRACT_ID).length;
  const overviewTypes = ["basics", "work_experience", "education", "project", "skill_group", "language", "award"];
  const overviewCards = overviewTypes.map((type) => {
    const count = activeEntities.filter((entity) => entity.entity_type === type).length;
    return `<div class="entity-overview-item"><span>${escapeHtml(ENTITY_LABELS[type])}</span><strong>${count}</strong></div>`;
  });
  if (legacyEvidenceCount) overviewCards.push(`<div class="entity-overview-item legacy"><span>历史 V0 证据（保留）</span><strong>${legacyEvidenceCount}</strong></div>`);
  byId("entity-overview").innerHTML = activeEntities.length || legacyEvidenceCount ? overviewCards.join("") : "";
  await renderCandidates(entities, selectedSourceId);
  const confirmed = Domain.confirmedEntities(entities).filter((entity) => !selectedSourceId || entity.source_document_ids?.includes(selectedSourceId));
  const evidence = await syncDerivedEvidence(entities);
  const visibleEvidence = selectedSourceId ? evidence.filter((item) => item.source_document_ids?.includes(selectedSourceId)) : evidence;
  byId("confirmed-count").textContent = `${confirmed.length} 个实体 · ${visibleEvidence.length} 条派生证据`;
  byId("confirmed-list").innerHTML = confirmed.length ? confirmed.sort((a, b) => a.order - b.order).map(confirmedCard).join("") : `<p class="muted">尚无已确认实体；系统不会自动确认，也不会派生职业证据。</p>`;
  byId("confirmed-list").querySelectorAll(".reopen-entity").forEach((button) => button.addEventListener("click", async () => {
    const card = button.closest("[data-confirmed-entity-id]");
    const entity = await get(CAREER_ENTITIES, card.dataset.confirmedEntityId);
    const reopened = Domain.reopenEntity(entity, "user_requested_edit");
    await put(CAREER_ENTITIES, reopened.entity);
    await put(ENTITY_REVIEW_DECISIONS, reopened.decision);
    show("review-message", "实体已重新进入待审核状态；原派生证据已标记为失效。请修改后再次确认。");
    await renderAll();
  }));
  await put(CAREER_PROFILES, Domain.buildCareerProfile(entities, sources));
  await renderAIContexts();
  await renderCareerIntelligence();
}

function download(name, type, content) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportArtifacts(kind) {
  const [sources, entities, runs] = await Promise.all([getAll(SOURCE_DOCUMENTS), getAll(CAREER_ENTITIES), getAll(EXTRACTION_RUNS)]);
  if (kind === "entities") {
    download("CAREER_ENTITIES.json", "application/json", JSON.stringify(Domain.buildEntityExport(entities, sources, runs), null, 2));
    show("export-message", `已导出 ${entities.length} 个职业实体，包含待审核/已拒绝状态与来源记录，不含原始文件内容。`);
    return;
  }
  const confirmed = Domain.confirmedEntities(entities);
  if (!confirmed.length) {
    show("export-message", "没有已确认实体，暂不生成证据或个人档案。", true);
    return;
  }
  if (kind === "evidence") {
    const artifact = Domain.buildEvidenceExport(entities, sources);
    download("EVIDENCE.json", "application/json", JSON.stringify(artifact, null, 2));
    show("export-message", `已从 ${confirmed.length} 个已确认实体派生并导出 ${artifact.evidence.length} 条证据。`);
  } else {
    const profile = Domain.buildCareerProfile(entities, sources);
    download("CAREER_PROFILE.md", "text/markdown;charset=utf-8", Domain.buildCareerProfileMarkdown(profile));
    show("export-message", `已导出兼容 JSON Resume 的职业档案快照，来源为 ${confirmed.length} 个已确认实体。`);
  }
}

byId("career-document").addEventListener("change", async (event) => {
  const files = event.target.files;
  if (!files?.length) return;
  try { await importFiles(files); }
  catch (error) { show("import-message", `导入失败：${error.message}。没有写入职业实体。`, true); }
  finally { event.target.value = ""; }
});
byId("generate-career-intelligence").addEventListener("click", () => generateCareerIntelligence().catch((error) => show("career-intelligence-message", `生成失败：${error.message}`, true)));
byId("ai-career-document").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  selectedAIFile = file;
  byId("ai-upload-consent").checked = false;
  byId("ai-cost-consent").checked = false;
  setAIProgress("idle", `已选择 ${file.name}（${Math.ceil(file.size / 1024)} KB）。请完成下方两项确认；尚未发送。`);
  updateAIStartButton();
  event.target.value = "";
});
byId("run-ai-career-ingestion").addEventListener("click", async () => {
  if (!selectedAIFile) { show("ai-import-message", "请先选择一份原始 PDF。", true); return; }
  if (aiSendInProgress) return;
  aiSendInProgress = true;
  byId("run-ai-career-ingestion").disabled = true;
  try { await ingestWithAI(selectedAIFile); }
  catch (error) { setAIProgress("failed", `AI 导入未生成结果：${error.message}。${error.message.includes("network") || error.message.includes("provider") ? "模型服务商请求已尝试，请先不要重复发送；检查账号或网络后再决定是否重试。" : "没有创建伪造 AI 结果。"}`); }
  finally {
    aiSendInProgress = false;
    updateAIStartButton(true);
  }
});
byId("save-ai-api-key").addEventListener("click", async () => {
  const apiKey = byId("ai-api-key").value.trim();
  try {
    const response = await fetch("/api/ai-career-ingestion-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider_id: "gemini", api_key: apiKey }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "credential_save_failed");
    byId("ai-api-key").value = "";
    show("ai-import-message", "Gemini Key 已保存到 macOS Keychain；尚未发送任何职业资料或调用模型。");
    await loadAIConfig();
  } catch (error) { show("ai-import-message", `Key 保存失败：${error.message}`, true); }
});
byId("deepseek-document-preflight").addEventListener("click", async () => {
  try {
    show("ai-import-message", "正在检查 DeepSeek 账号可用的完整资料模型；不会发送任何职业资料…");
    const response = await fetch("/api/ai-providers/deepseek/document-preflight", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "deepseek_preflight_failed");
    byId("ai-provider").value = "deepseek";
    byId("ai-model").value = result.model;
    byId("ai-upload-consent").checked = false;
    byId("ai-cost-consent").checked = false;
    setAIProgress("idle", `DeepSeek 已就绪：${result.model}。选择 PDF 后完成两项确认即可开始解析。`);
    updateAIStartButton();
    await loadAIConfig();
  } catch (error) { show("ai-import-message", `DeepSeek 模型检查失败：${error.message}`, true); }
});
byId("gemini-document-preflight").addEventListener("click", async () => {
  try {
    show("ai-import-message", "正在检查 Gemini 当前账号可用的完整资料模型；不会发送任何职业资料…");
    const response = await fetch("/api/ai-providers/gemini/document-preflight", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "gemini_preflight_failed");
    byId("ai-provider").value = "gemini";
    byId("ai-model").value = result.model;
    byId("ai-upload-consent").checked = false;
    byId("ai-cost-consent").checked = false;
    setAIProgress("idle", `Gemini 已就绪：${result.model}。选择 PDF 后完成两项确认即可开始解析。`);
    updateAIStartButton();
    await loadAIConfig();
  } catch (error) { show("ai-import-message", `Gemini 预检未完成：${error.message}`, true); }
});
byId("ai-provider").addEventListener("change", () => {
  byId("ai-upload-consent").checked = false;
  byId("ai-cost-consent").checked = false;
  if (selectedAIFile) setAIProgress("idle", "模型服务商已切换。请重新检查模型，并再次完成两项确认；尚未发送。");
  updateAIStartButton();
});
byId("ai-upload-consent").addEventListener("change", updateAIStartButton);
byId("ai-cost-consent").addEventListener("change", updateAIStartButton);
byId("accept-ai-context").addEventListener("click", async () => {
  try {
    const artifact = await get(AI_CAREER_CONTEXTS, selectedAIContextId);
    if (!artifact) throw new Error("请先选择一份 AI 返回结果");
    const accepted = { ...AIDomain.acceptArtifact(artifact), review_blocks: editedAIBlocks() };
    const profile = {
      profile_id: `ai-profile-${accepted.artifact_id}`,
      source_artifact_id: accepted.artifact_id,
      original_filename: accepted.original_filename,
      provider: accepted.provider,
      model: accepted.model,
      generated_at: new Date().toISOString(),
      blocks: accepted.review_blocks,
      profile_markdown: "",
    };
    profile.profile_markdown = aiProfileMarkdown(profile);
    await put(AI_CAREER_CONTEXTS, accepted);
    await put(AI_CAREER_PROFILES, profile);
    download("MY_CAREER_PROFILE.md", "text/markdown;charset=utf-8", profile.profile_markdown);
    window.location.assign("/career-profile.html");
  } catch (error) { show("ai-import-message", `接受失败：${error.message}`, true); }
});
const dropZone = byId("career-drop-zone");
["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add("drag-active"); }));
["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove("drag-active"); }));
dropZone.addEventListener("drop", async (event) => {
  try { await importFiles(event.dataTransfer?.files || []); }
  catch (error) { show("import-message", `导入失败：${error.message}。没有写入职业实体。`, true); }
});
dropZone.addEventListener("paste", async (event) => {
  const files = event.clipboardData?.files;
  const text = event.clipboardData?.getData("text/plain")?.trim();
  if (!files?.length && !text) return;
  event.preventDefault();
  try { await importFiles(files?.length ? files : [pastedTextFile(text)]); }
  catch (error) { show("import-message", `粘贴导入失败：${error.message}。没有写入职业实体。`, true); }
});
dropZone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); byId("career-document").click(); } });
byId("correction-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const kind = byId("correction-kind").value;
  const sourceText = byId("correction-source").value;
  const targetValue = kind === "ocr_replacement" ? byId("correction-target-text").value : byId("correction-target-type").value;
  try {
    await saveCorrection(kind, sourceText, targetValue, kind === "section_alias" ? "resume" : "");
    byId("correction-source").value = "";
    byId("correction-target-text").value = "";
    show("correction-message", "已保存到此浏览器的本地解析记忆；下次导入会应用并仍要求实体审核。");
    await renderAll();
  } catch (error) { show("correction-message", `保存失败：${error.message}`, true); }
});
byId("export-entities").addEventListener("click", () => exportArtifacts("entities"));
byId("export-evidence").addEventListener("click", () => exportArtifacts("evidence"));
byId("export-profile").addEventListener("click", () => exportArtifacts("profile"));
Promise.all([renderAll(), loadAIConfig()]).catch((error) => show("import-message", `无法打开本地职业资料库：${error.message}`, true));
