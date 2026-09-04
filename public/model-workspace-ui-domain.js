"use strict";

(function attachModelWorkspaceUi(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneModelWorkspaceUI = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createModelWorkspaceUi() {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function renderProgress(target, steps, currentIndex = steps.length - 1) {
    if (!target || !Array.isArray(steps) || !steps.length) throw new Error("model_workspace_progress_invalid");
    target.innerHTML = steps.map((step, index) => `<li data-entry-type="EXECUTION_EVENT" class="${index < currentIndex ? "is-complete" : index === currentIndex ? "is-current" : "is-upcoming"}"><span aria-hidden="true"></span>${escapeHtml(step)}</li>`).join("");
  }

  function setProcessingState({ processing, content, save, active }) {
    processing?.classList.toggle("hidden", !active);
    content?.classList.toggle("hidden", Boolean(active));
    if (save) save.disabled = true;
  }

  return Object.freeze({ renderProgress, setProcessingState });
}));
