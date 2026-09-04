"use strict";

(function attachSourceInput(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneSourceInput = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createSourceInput() {
  const IMAGE_TYPES = Object.freeze(["image/png", "image/jpeg"]);

  function isEditableTarget(target) {
    if (!target?.closest) return false;
    return Boolean(target.closest("textarea, input, [contenteditable='true'], [contenteditable=''], [contenteditable]:not([contenteditable='false'])"));
  }

  function sourceKey(source) {
    return source?.source_document_id || source?.content_hash || `${source?.name || source?.file?.name || "source"}:${source?.size || source?.file?.size || 0}`;
  }

  function mergeSources(current, incoming, { replace = false } = {}) {
    const ordered = replace ? [] : [...(current || [])];
    const known = new Set(ordered.map(sourceKey));
    for (const source of incoming || []) {
      const key = sourceKey(source);
      if (!key || known.has(key)) continue;
      known.add(key);
      ordered.push(source);
    }
    return ordered;
  }

  async function persistDurableBundle({ database, sources, sourceDocumentFor, persistDurableSource }) {
    if (!database || !Array.isArray(sources) || !sources.length || typeof sourceDocumentFor !== "function" || typeof persistDurableSource !== "function") {
      throw new Error("source_bundle_persistence_invalid");
    }
    const documents = [];
    for (const source of sources) {
      const resolved = await persistDurableSource(database, sourceDocumentFor(source), source.file);
      const document = resolved?.source_document;
      if (!document || document.source_document_id !== source.source_document_id || resolved.metadata?.content_hash !== source.content_hash) {
        throw new Error("source_bundle_persistence_invalid");
      }
      documents.push(document);
    }
    return Object.freeze(documents);
  }

  function clipboardImageFiles(event, timestamp = Date.now()) {
    const items = [...(event?.clipboardData?.items || [])];
    return items.filter((item) => item.kind === "file" && IMAGE_TYPES.includes(item.type)).map((item, index) => {
      const blob = item.getAsFile();
      if (!blob) return null;
      const extension = blob.type === "image/png" ? "png" : "jpg";
      const name = blob.name && blob.name !== "image.png" ? blob.name : `clipboard-image-${timestamp}-${index + 1}.${extension}`;
      return typeof File === "function" ? new File([blob], name, { type: blob.type, lastModified: timestamp }) : blob;
    }).filter(Boolean);
  }

  function bind({ dropzone, input, onFiles, onAccepted = null }) {
    if (!dropzone || !input || typeof onFiles !== "function") throw new Error("source_input_binding_invalid");
    let pointerInside = false;
    let nextSelectionReplaces = false;
    let feedbackTimer = null;

    const accept = (files, options = {}) => {
      const selected = Array.from(files || []);
      if (!selected.length || input.disabled) return;
      onFiles(selected, options);
    };
    const flashAccepted = (count) => {
      dropzone.classList.add("is-accepted");
      dropzone.dataset.clipboardAccepted = String(count);
      onAccepted?.(count);
      clearTimeout(feedbackTimer);
      feedbackTimer = setTimeout(() => {
        dropzone.classList.remove("is-accepted");
        delete dropzone.dataset.clipboardAccepted;
      }, 1400);
    };
    const openChooser = ({ replace = false } = {}) => {
      if (input.disabled) return;
      nextSelectionReplaces = replace;
      input.value = "";
      input.click();
    };
    dropzone.addEventListener("click", () => openChooser({ replace: false }));
    input.addEventListener("change", (event) => {
      accept(event.target.files, { replace: nextSelectionReplaces, captured_via: "FILE_PICKER" });
      nextSelectionReplaces = false;
    });
    const prevent = (event) => { event.preventDefault(); event.stopPropagation(); };
    dropzone.addEventListener("pointerenter", () => { pointerInside = true; });
    dropzone.addEventListener("pointerleave", () => { pointerInside = false; });
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => {
      prevent(event);
      if (!input.disabled) dropzone.classList.add("is-dragover");
    }));
    dropzone.addEventListener("dragleave", (event) => {
      prevent(event);
      if (!event.relatedTarget || !dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", (event) => {
      prevent(event);
      dropzone.classList.remove("is-dragover");
      accept(event.dataTransfer?.files, { replace: false, captured_via: "DRAG_DROP" });
    });
    const paste = (event) => {
      if (input.disabled || isEditableTarget(event.target)) return;
      const keyboardFocused = document.activeElement === dropzone || dropzone.contains(document.activeElement);
      if (!pointerInside && !keyboardFocused) return;
      const images = clipboardImageFiles(event);
      if (!images.length) return;
      event.preventDefault();
      event.stopPropagation();
      accept(images, { replace: false, captured_via: "CLIPBOARD_IMAGE" });
      flashAccepted(images.length);
    };
    document.addEventListener("paste", paste);
    return Object.freeze({
      openChooser,
      replace: () => openChooser({ replace: true }),
      destroy: () => { document.removeEventListener("paste", paste); clearTimeout(feedbackTimer); },
    });
  }

  function renderBundlePreview({ container, list }, sources, { remove_label: removeLabel = "移除" } = {}) {
    const ordered = [...(sources || [])];
    container?.classList.toggle("hidden", !ordered.length);
    if (!ordered.length) {
      if (list) list.innerHTML = "";
      return;
    }
    const filenames = ordered.map((source) => source.file?.name || source.name || source.filename || "未命名来源");
    if (list) list.innerHTML = ordered.map((source, index) => {
      const filename = filenames[index].replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
      return `<li><span><b>${index + 1}</b>${filename}</span><button type="button" data-source-remove="${index}" aria-label="${removeLabel} ${filename}">${removeLabel}</button></li>`;
    }).join("");
    container?.classList.add("is-entering");
    const scheduleFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    scheduleFrame(() => container?.classList.remove("is-entering"));
  }

  return Object.freeze({ IMAGE_TYPES, isEditableTarget, sourceKey, mergeSources, persistDurableBundle, clipboardImageFiles, bind, renderBundlePreview });
}));
