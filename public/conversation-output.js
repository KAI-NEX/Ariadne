"use strict";

(function attach(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneConversationOutput = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function create(root) {
  const MAX_TEXT = 40000, MAX_PAGES = 32;
  const clocks = new WeakMap(), labels = new WeakMap(), exports = new WeakMap();
  const utf8 = text => new TextEncoder().encode(text);
  function concatenate(parts) {
    const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  // Image-only PDF: browser-rendered glyphs preserve Chinese and mixed fonts
  // offline without transmitting text or requiring a server font installation.
  function pdfFromJpegs(pages) {
    if (!pages.length || pages.length > MAX_PAGES) throw new Error("页数超出导出范围");
    const objects = [], offsets = [0], parts = [utf8("%PDF-1.4\n")];
    let size = parts[0].length;
    const add = (id, body) => { objects[id] = typeof body === "string" ? utf8(body) : body; };
    add(1, "<< /Type /Catalog /Pages 2 0 R >>");
    add(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`);
    pages.forEach((page, index) => {
      if (!(page.bytes instanceof Uint8Array) || page.bytes[0] !== 255 || page.bytes[1] !== 216
        || !Number.isInteger(page.width) || page.width < 1 || !Number.isInteger(page.height) || page.height < 1) throw new Error("图片数据无效");
      const id = 3 + index * 3, content = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n";
      add(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
      add(id + 1, concatenate([utf8(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`), page.bytes, utf8("\nendstream")]));
      add(id + 2, `<< /Length ${utf8(content).length} >>\nstream\n${content}endstream`);
    });
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = size;
      const bytes = concatenate([utf8(`${id} 0 obj\n`), objects[id], utf8("\nendobj\n")]);
      parts.push(bytes); size += bytes.length;
    }
    parts.push(utf8(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
    return concatenate(parts);
  }

  function wrapText(text, measure, width) {
    if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT) throw new Error("回复为空或超过 4 万字，请分段导出");
    const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh", { granularity: "grapheme" }) : null;
    const lines = [];
    for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
      let line = "";
      const chars = segmenter ? [...segmenter.segment(paragraph)].map(part => part.segment) : Array.from(paragraph);
      for (const char of chars) {
        if (line && measure(line + char) > width) { lines.push(line); line = ""; }
        line += char;
      }
      lines.push(line);
    }
    return lines;
  }

  async function renderPages(text, doc = root.document) {
    await doc.fonts?.ready;
    const style = doc.defaultView.getComputedStyle(doc.documentElement);
    const token = name => style.getPropertyValue(name).trim();
    const font = token("--vi-font-ui");
    if (!font || !token("--vi-ink") || !token("--vi-surface")) throw new Error("排版资源未加载，请刷新后重试");
    const canvas = doc.createElement("canvas"); canvas.width = 1240; canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持图片导出");
    ctx.font = `29px ${font}`;
    const lines = wrapText(text, value => ctx.measureText(value).width, 1052);
    const perPage = 32, count = Math.ceil(lines.length / perPage);
    if (count > MAX_PAGES) throw new Error("回复超过 32 页，请分段导出");
    const pages = [];
    for (let page = 0; page < count; page++) {
      ctx.fillStyle = token("--vi-surface"); ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = token("--vi-ink"); ctx.font = `550 38px ${font}`;
      ctx.fillText("Ariadne · 衡", 94, 115);
      ctx.fillStyle = token("--vi-text-secondary"); ctx.font = `23px ${font}`;
      ctx.fillText("对话回复 · 非确认资料 · 未经外部事实核验", 94, 162);
      ctx.fillStyle = token("--vi-ink"); ctx.font = `29px ${font}`;
      lines.slice(page * perPage, (page + 1) * perPage).forEach((line, index) => ctx.fillText(line, 94, 244 + index * 44));
      ctx.fillStyle = token("--vi-text-secondary"); ctx.font = `23px ${font}`;
      ctx.fillText(`第 ${page + 1} / ${count} 页`, 94, 1655);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const jpeg = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .94));
      if (!blob || !jpeg) throw new Error("图片生成失败，请重试");
      pages.push({ png: blob, bytes: new Uint8Array(await jpeg.arrayBuffer()), width: canvas.width, height: canvas.height });
    }
    return pages;
  }

  function release(state) { state.urls.forEach(url => root.URL.revokeObjectURL(url)); state.urls.length = 0; }
  function decorate(target, messages, textFor) {
    if (!target?.isConnected) return;
    const doc = target.ownerDocument;
    const bubbles = [...target.querySelectorAll(".v1-conversation-message")];
    const old = exports.get(target);
    if (old && old.bubbles.length === bubbles.length && bubbles.every((node, i) => old.bubbles[i] === node)) return;
    if (old) { release(old); old.observer?.disconnect(); }
    const state = { urls: [], bubbles, observer: null }; exports.set(target, state);
    state.observer = new doc.defaultView.MutationObserver(() => {
      if (!target.isConnected) { release(state); state.observer.disconnect(); exports.delete(target); }
    });
    state.observer.observe(doc.body, { childList: true, subtree: true });
    messages.forEach((message, index) => {
      if (message.role !== "ASSISTANT" || !String(textFor(message) || "").trim()) return;
      const bubble = bubbles[index]; if (!bubble || bubble.querySelector(".v1-reply-exports")) return;
      const area = doc.createElement("span"); area.className = "v1-reply-exports";
      const actions = doc.createElement("span"); actions.className = "v1-reply-export-actions";
      const status = doc.createElement("span"); status.className = "v1-reply-export-status"; status.setAttribute("role", "status");
      const files = doc.createElement("span"); files.className = "v1-reply-export-files";
      area.append(actions, status, files); bubble.append(area);
      for (const format of ["PDF", "图片"]) {
        const button = doc.createElement("button"); button.type = "button"; button.textContent = `导出${format}`;
        button.title = format === "PDF" ? "本地生成排版 PDF（文字不可选取）" : "本地生成回复排版图片，不是 AI 创作图片";
        actions.append(button);
        button.addEventListener("click", async () => {
          [...actions.children].forEach(node => { node.disabled = true; }); status.textContent = "正在本地排版…";
          try {
            const pages = await renderPages(String(textFor(message)), doc);
            if (!bubble.isConnected || exports.get(target) !== state) return;
            files.querySelectorAll(`[data-format="${format}"]`).forEach(node => { const url = node.querySelector("a").href; root.URL.revokeObjectURL(url); state.urls = state.urls.filter(item => item !== url); node.remove(); });
            const entries = format === "PDF" ? [{ blob: new Blob([pdfFromJpegs(pages)], { type: "application/pdf" }), name: "Ariadne-回复.pdf" }]
              : pages.map((page, i) => ({ blob: page.png, name: `Ariadne-回复-${i + 1}.png` }));
            entries.forEach(entry => {
              const item = doc.createElement("span"); item.dataset.format = format;
              const url = root.URL.createObjectURL(entry.blob); state.urls.push(url);
              if (format === "图片") { const image = doc.createElement("img"); image.src = url; image.alt = entry.name; item.append(image); }
              const link = doc.createElement("a"); link.href = url; link.download = entry.name; link.textContent = `下载 ${entry.name}`; item.append(link); files.append(item);
            });
            status.textContent = format === "PDF" ? `已生成 ${pages.length} 页 PDF · 文字不可选取` : `已生成 ${pages.length} 张排版图片`;
          } catch (error) { status.textContent = error.message || "生成失败，请重试"; }
          finally { [...actions.children].forEach(node => { node.disabled = false; }); }
        });
      }
    });
  }

  function execution({ form, active }) {
    if (!form?.ownerDocument || !form.isConnected) return;
    let state = clocks.get(form);
    if (active && !state) {
      labels.get(form)?.remove();
      const label = form.ownerDocument.createElement("small"); label.className = "v1-conversation-elapsed";
      form.after(label); labels.set(form, label);
      state = { start: root.performance.now(), label, timer: null }; clocks.set(form, state);
      const paint = () => {
        if (!form.isConnected) { root.clearInterval(state.timer); clocks.delete(form); return; }
        label.textContent = `已等待 ${Math.floor((root.performance.now() - state.start) / 1000)} 秒 · 完整回复校验后显示`;
      };
      paint(); state.timer = root.setInterval(paint, 1000);
    } else if (!active && state) {
      root.clearInterval(state.timer); clocks.delete(form);
      state.label.textContent = `本轮处理耗时 ${Math.max(.1, (root.performance.now() - state.start) / 1000).toFixed(1)} 秒`;
    }
  }
  return Object.freeze({ pdfFromJpegs, wrapText, renderPages, decorate, execution });
}));
