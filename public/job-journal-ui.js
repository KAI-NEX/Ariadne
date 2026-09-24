"use strict";
globalThis.AriadneJobJournalUI = { mount(jobId) {
  const form = document.getElementById("job-journal-form");
  if (!form || form.dataset.mounted) return;
  form.dataset.mounted = "true";
  const D = globalThis.AriadneJobJournal, byId = id => document.getElementById(id);
  const message = byId("job-journal-message"), timeline = byId("job-journal-timeline");
  const feedback = byId("job-journal-feedback"), text = byId("job-journal-text"), date = byId("job-journal-date"), input = byId("job-journal-images");
  let images = [], busy = false, preparing = false, generation = 0, imageGeneration = 0, channel;
  let pendingId = crypto.randomUUID();
  const urls = new Map();
  function clearURLs(key) { (urls.get(key) || []).forEach(URL.revokeObjectURL); urls.set(key, []); }
  function imageURL(file, key) { const url = URL.createObjectURL(file); urls.get(key).push(url); return url; }
  function element(tag, value, className) { const node = document.createElement(tag); if (value) node.textContent = value; if (className) node.className = className; return node; }
  const say = (value, error = false) => { message.textContent = value; message.classList.toggle("error", error); };
  const controls = () => form.querySelectorAll("input, textarea, select, button").forEach(node => { node.disabled = busy || preparing; });
  function reset() {
    images = []; text.value = ""; input.value = ""; feedback.value = "UPDATE"; pendingId = crypto.randomUUID();
    const now = new Date(); date.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    preview();
  }
  function preview() {
    clearURLs("preview"); const target = byId("job-journal-preview"); target.replaceChildren();
    images.forEach((image, index) => {
      const figure = element("figure"), img = element("img"); img.src = imageURL(image.file, "preview"); img.alt = image.name;
      const remove = element("button", `移除 ${image.name}`, "v1-edit-text-action"); remove.type = "button";
      remove.onclick = () => { images.splice(index, 1); preview(); };
      figure.append(img, remove); target.append(figure);
    });
  }
  async function load() {
    const reading = ++generation;
    try {
      const entries = await D.list(jobId); if (reading !== generation) return;
      clearURLs("history"); timeline.replaceChildren();
      if (!entries.length) timeline.append(element("p", "还没有求职记录。记录沟通过程、公司反馈或等待情况。", "v1-source-note"));
      entries.forEach(entry => {
        const article = element("article", "", "v1-journal-entry");
        article.append(element("p", `${entry.observed_on} · ${D.FEEDBACK[entry.feedback]}`, "v1-section-label"));
        const prose = element("p", entry.text, "v1-journal-text"); prose.dataset.i18n = "off"; article.append(prose);
        const gallery = element("div", "", "v1-journal-images");
        entry.images.forEach(image => {
          const link = element("a"), img = element("img"); link.href = imageURL(image.file, "history"); link.target = "_blank"; link.rel = "noopener";
          img.src = link.href; img.alt = image.name; img.loading = "lazy"; link.setAttribute("aria-label", `查看图片 ${image.name}`); link.append(img); gallery.append(link);
        });
        article.append(gallery); timeline.append(article);
      });
    } catch (error) { say(error.message, true); }
  }
  for (const [value, label] of Object.entries(D.FEEDBACK)) { const option = element("option", label); option.value = value; feedback.append(option); }
  input.addEventListener("change", async () => {
    const attempt = ++imageGeneration; preparing = true; controls();
    try {
      const next = await D.prepareImages([...images.map(image => new File([image.file], image.name, { type: image.file.type })), ...input.files]);
      for (const image of next) {
        let bitmap;
        try { bitmap = await createImageBitmap(image.file); } catch (_) { throw Error("图片无法解码，请换一张完整的 PNG、JPEG 或 WebP 图片。"); }
        const tooLarge = bitmap.width * bitmap.height > 30000000; bitmap.close();
        if (tooLarge) throw Error("图片分辨率过大，请使用截图或较小的图片。");
      }
      if (attempt !== imageGeneration) return;
      images = next; preview(); say("");
    } catch (error) { say(error.message || "图片无法读取。", true); }
    finally { input.value = ""; preparing = false; controls(); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || preparing) return;
    busy = true; controls();
    try {
      await D.save({ entry_id: pendingId, job_context_id: jobId, observed_on: date.value, feedback: feedback.value, text: text.value.trim(), images, created_at: new Date().toISOString(), provenance: "USER_RECORDED" });
      reset(); say("求职记录已保存；职位要求和个人资料没有变化。"); channel?.postMessage({ jobId }); await load();
    } catch (error) { say(error.message, true); }
    finally { busy = false; controls(); }
  });
  byId("job-journal-cancel").onclick = () => { reset(); say(""); };
  const connect = () => { if (!channel && typeof BroadcastChannel === "function") { channel = new BroadcastChannel("ariadne-job-journal"); channel.onmessage = event => { if (event.data.jobId === jobId) load(); }; } };
  window.addEventListener("focus", load);
  window.addEventListener("pagehide", () => { clearURLs("preview"); clearURLs("history"); channel?.close(); channel = null; generation++; });
  window.addEventListener("pageshow", event => { if (event.persisted) { connect(); preview(); load(); } });
  connect(); reset(); load();
} };
