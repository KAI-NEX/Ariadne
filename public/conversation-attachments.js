"use strict";
(function (root) {
  const CONTRACT = "ariadne-conversation-attachments-v1", MAX_BYTES = 30000000;
  const TYPES = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain", md: "text/markdown", markdown: "text/markdown" };
  const FORMS = { "candidate-workspace-composer": "CANDIDATE", "candidate-conversation-form": "CANDIDATE", "job-workspace-composer": "JOB", "job-conversation-form": "JOB", "personal-conversation-form": "PERSONAL", "job-overview-form": "JOB_OVERVIEW" };
  const controllers = new Map(), pending = new Map();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const requestId = (r) => r.turn?.execution_id || r.request_id;
  function errorCopy(error) {
    const code = String(error?.code || error?.message || error);
    if (/docx_complex/.test(code)) return "这个 Word 文件含暂不能完整读取的图表或嵌入对象，请导出为 PDF 后重试。";
    if (/docx_/.test(code)) return "Word 文件无法完整读取，请确认是未加密的 DOCX，或导出为 PDF 后重试。";
    if (/attachment_content_limit/.test(code)) return "附件展开后内容过多（合计最多 48 张图片或 PDF 页、12 万字），请分批发送；没有截断发送。";
    if (/attachment_image_invalid_or_too_large/.test(code)) return "图片无法读取，或超过模型单张图片 20 MB 的传输限制，请压缩图片后重试。";
    if (/attachment_pdf/.test(code)) return "PDF 无法完整转为页面图片，请确认文件未加密且可以打开，再重试。";
    if (/attachment_/.test(code)) return "附件未发送成功，请检查格式、总大小与传输确认后重试；已选附件保留。";
    return null;
  }
  function validateFiles(files) {
    if (files.length > 4 || files.reduce((n, f) => n + f.size, 0) > MAX_BYTES) throw Error("每轮最多 4 个附件，单个及合计最大 30 MB。");
    for (const file of files) if (!file.size || !TYPES[file.name.split('.').pop().toLowerCase()] || file.name.length > 240) throw Error("支持 PDF、DOCX、PNG、JPG、TXT、Markdown；文件不能为空。");
    return files;
  }
  async function recordFor(file) {
    const raw = await file.arrayBuffer(), mime = TYPES[file.name.split('.').pop().toLowerCase()];
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map((x) => x.toString(16).padStart(2, "0")).join("");
    const blob = new Blob([raw], { type: mime });
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
    return { name: file.name, mime_type: mime, size: raw.byteLength, content_hash: `sha256:${digest}`, data_url: dataUrl };
  }
  async function persist(request, files, records, domain) {
    const db = await new Promise((resolve, reject) => { const open = indexedDB.open(CONTRACT, 1); open.onupgradeneeded = () => open.result.createObjectStore("turns", { keyPath: "request_id" }); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    try {
      await new Promise((resolve, reject) => { const tx = db.transaction("turns", "readwrite");
        tx.objectStore("turns").add({ request_id: requestId(request), domain, conversation_id: request.conversation?.conversation_id || domain,
          created_at: new Date().toISOString(), authority: "SOURCE_INPUT_ONLY", files: files.map((file, i) => ({ file, ...Object.fromEntries(Object.entries(records[i]).filter(([k]) => k !== "data_url")) })) });
        tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || Error("attachment_persistence_failed")); tx.onerror = () => reject(tx.error); });
    } finally { db.close(); }
  }
  function mount(form, domain) {
    const panel = document.createElement("details"); panel.className = "v1-conversation-attachments";
    panel.innerHTML = '<summary>附件 · 可粘贴图片</summary><button type="button" class="v1-tertiary-button" data-attachment-add>选择文件</button><input type="file" hidden multiple accept=".pdf,.docx,.png,.jpg,.jpeg,.txt,.md,.markdown"><ul data-attachment-list></ul><label class="v1-attachment-consent hidden"><input type="checkbox"><span></span></label><p class="v1-attachment-status" role="status"></p>';
    form.before(panel);
    const input = panel.querySelector('input[type="file"]'), consent = panel.querySelector('input[type="checkbox"]'), list = panel.querySelector("ul"), status = panel.querySelector('[role="status"]');
    const state = { form, domain, panel, files: [], consent, status, busy: false, urls: [], runtime: null };
    controllers.set(form.id, state);
    const runtime = () => root.JobRadarRuntimeGate?.authority?.()?.runtime || root.JobRadarRuntimeGate?.operationGate?.(domain === "PERSONAL" ? "personal_understanding" : domain === "JOB_OVERVIEW" ? "job_overview" : domain === "JOB" ? "job_conversation" : "candidate_conversation")?.authority?.runtime;
    const identity = () => { const r = runtime(); return `${r?.mode}/${r?.provider}/${r?.model}`; };
    const render = () => {
      state.urls.forEach(URL.revokeObjectURL); state.urls = [];
      const r = runtime();
      panel.querySelector("summary").textContent = state.files.length ? `附件（${state.files.length}）· 仅用于本轮` : "附件 · 可粘贴图片";
      list.innerHTML = state.files.map((file, i) => { let preview = ""; if (/\.(png|jpe?g)$/i.test(file.name)) { const url = URL.createObjectURL(file); state.urls.push(url); preview = `<img src="${url}" alt="所选图片预览">`; }
        return `<li>${preview}<span>${esc(file.name)} · ${(file.size / 1000000).toFixed(2)} MB</span><button type="button" class="v1-tertiary-button" data-attachment-remove="${i}" aria-label="移除 ${esc(file.name)}">移除</button></li>`; }).join("");
      consent.parentElement.classList.toggle("hidden", !state.files.length);
      consent.nextElementSibling.textContent = `同意将所选附件发送给 ${r?.provider === "codex" ? "Codex / OpenAI" : r?.provider || "当前模型"} / ${r?.model || "未选择"} 用于本轮对话，可能消耗额度。附件不会自动保存到个人资料或职位。`;
    };
    const add = (files) => {
      if (state.busy) return;
      try {
        const seen = new Set(state.files.map(f => `${f.name}:${f.size}:${f.lastModified}`));
        const merged = [...state.files]; for (const file of files) { const k = `${file.name}:${file.size}:${file.lastModified}`; if (!seen.has(k)) { seen.add(k); merged.push(file); } }
        state.files = validateFiles(merged); consent.checked = false; state.runtime = identity(); panel.open = true; status.textContent = "每轮最多 4 个，合计 30 MB。PDF 完整逐页读取；DOCX 读取文字和内嵌图片。后续追问需要查看原附件时，请再次添加。"; render();
      } catch (error) { panel.open = true; status.textContent = error.message; }
    };
    panel.querySelector('[data-attachment-add]').onclick = () => { if (!state.busy) { input.value = ""; input.click(); } };
    input.onchange = () => add(Array.from(input.files));
    list.onclick = (event) => { const b = event.target.closest('[data-attachment-remove]'); if (b && !state.busy) { state.files.splice(Number(b.dataset.attachmentRemove), 1); consent.checked = false; render(); } };
    form.addEventListener("paste", (event) => {
      const images = [...(event.clipboardData?.items || [])].filter(x => x.kind === "file" && ["image/png", "image/jpeg"].includes(x.type)).map(x => x.getAsFile()).filter(Boolean);
      if (images.length) { event.preventDefault(); add(images.map((blob, i) => new File([blob], `粘贴图片-${Date.now()}-${i + 1}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type }))); }
    });
    for (const target of [form, panel]) {
      target.addEventListener("dragover", event => { if (event.dataTransfer?.types.includes("Files")) event.preventDefault(); });
      target.addEventListener("drop", event => { if (event.dataTransfer?.files.length) { event.preventDefault(); add([...event.dataTransfer.files]); } });
    }
    form.addEventListener("submit", event => {
      if (!state.files.length) return;
      if (!consent.checked || state.runtime !== identity() || runtime()?.mode !== "model") { event.preventDefault(); event.stopImmediatePropagation(); panel.open = true; status.textContent = "请先选择模型，并勾选本轮附件的传输确认。"; return; }
      const text = form.querySelector("textarea"); if (!text.value.trim()) text.value = "请解读本轮附件。";
    }, true);
    root.JobRadarRuntimeGate?.subscribe?.(() => { consent.checked = false; state.runtime = identity(); render(); });
    state.render = render; render();
  }
  async function prepare(request, domain) {
    if (request.phase && request.phase !== "DISCUSS") return request;
    const state = [...controllers.values()].find(s => s.domain === domain && s.files.length);
    if (!state) return request;
    if (state.busy || !state.consent.checked) throw Error("attachment_consent_required");
    const runtime = request.runtime_snapshot;
    if (state.runtime !== `${runtime.mode}/${runtime.provider}/${runtime.model}`) throw Error("attachment_runtime_invalid");
    state.busy = true;
    try {
      const check = await (root.AriadneConnector || root).fetch("/api/conversation-attachment-capabilities", { cache: "no-store" });
      if (!check.ok || (await check.json()).contract_id !== CONTRACT) throw Error("attachment_contract_invalid");
      const files = [...state.files], records = await Promise.all(files.map(recordFor));
      if (new Set(records.map(r => r.content_hash)).size !== records.length) throw Error("attachment_duplicate_content");
      if (!state.consent.checked) throw Error("attachment_consent_required");
      await persist(request, files, records, domain);
      if (!state.consent.checked || state.runtime !== `${runtime.mode}/${runtime.provider}/${runtime.model}`) throw Error("attachment_consent_required");
      pending.set(requestId(request), { state, files });
      return { ...request, attachments: { contract_id: CONTRACT, request_id: requestId(request), files: records,
        consent: { confirmed: true, provider: runtime.provider, model: runtime.model, purpose: "CURRENT_CONVERSATION_TURN" } } };
    } catch (error) { state.busy = false; state.status.textContent = errorCopy(error) || error.message; throw error; }
  }
  function finish(request, ok, error = null) {
    const active = pending.get(requestId(request)); if (!active) return;
    pending.delete(requestId(request)); const { state, files } = active; state.busy = false;
    if (ok) { state.files = state.files.filter(f => !files.includes(f)); state.consent.checked = false; state.status.textContent = `本轮已发送：${files.map(f => f.name).join("、")}。原件已保存在此浏览器；再次查看请重新添加，不自动纳入确认资料。`; }
    else state.status.textContent = errorCopy(error) || "本轮未完成，附件保留，可以重试。";
    state.render();
  }
  root.AriadneConversationAttachments = { prepare, finish, errorCopy, validateFiles, recordFor, CONTRACT };
  if (typeof module === "object") module.exports = root.AriadneConversationAttachments;
  if (root.document) document.addEventListener("DOMContentLoaded", () => {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/conversation-attachments.css"; document.head.append(link);
    Object.entries(FORMS).forEach(([id, domain]) => { const form = document.getElementById(id); if (form) mount(form, domain); });
  }, { once: true });
}(typeof globalThis === "undefined" ? this : globalThis));
