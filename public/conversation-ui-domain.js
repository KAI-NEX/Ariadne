"use strict";

(function attachConversationUi(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneConversationUI = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createConversationUi() {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function renderMessages(target, messages, { empty_text: emptyText, text_for: textFor = (message) => message.content ?? message.text } = {}) {
    if (!target) return;
    target.innerHTML = messages.length
      ? messages.map((message) => `<p class="v1-conversation-message ${message.role === "USER" ? "user" : "assistant"}">${escapeHtml(textFor(message))}</p>`).join("")
      : `<p class="v1-conversation-empty">${escapeHtml(emptyText || "")}</p>`;
    target.lastElementChild?.scrollIntoView?.({ block: "nearest" });
  }

  function setExecutionState({ form, status = null, active, copy = "" }) {
    const submit = form?.querySelector?.('button[type="submit"]');
    const textarea = form?.querySelector?.("textarea");
    if (status) status.textContent = copy;
    if (submit) submit.disabled = Boolean(active);
    if (textarea) textarea.setAttribute("aria-busy", String(Boolean(active)));
  }

  function settle({ form, messages, focus = true }) {
    messages?.lastElementChild?.scrollIntoView?.({ block: "nearest" });
    if (focus) form?.querySelector?.("textarea")?.focus?.();
  }

  return Object.freeze({ renderMessages, setExecutionState, settle });
}));
