"use strict";

(function attachConversationUi(root, factory) {
  const processing = root.AriadneProcessingIndicator
    || (typeof module === "object" && module.exports ? require("./processing-indicator-domain.js") : null);
  const api = factory(processing);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneConversationUI = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createConversationUi(ProcessingIndicator) {
  const renderedCounts = new WeakMap();

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  const HUMAN_COPY_INTERNAL_REFERENCE = /(?:\s*[（(](?:(?:confirmed|working)-candidate|job-requirement|card)-[a-z0-9:_-]+[）)])|(?:(?:confirmed|working)-candidate|job-requirement|card)-[a-z0-9:_-]+|source-(?:candidate|job)-[a-f0-9]{16,}|sha256:[a-f0-9]{32,}|(?:revision|analysis|conversation|execution)[-_][a-z0-9:_-]{8,}/giu;

  function humanSafeText(value) {
    return String(value ?? "")
      .replace(HUMAN_COPY_INTERNAL_REFERENCE, "")
      .replace(/[ \t]{2,}/gu, " ")
      .replace(/\s+([，。；：！？,.!?:;])/gu, "$1")
      .trim();
  }

  function renderMessages(target, messages, { empty_text: emptyText, text_for: textFor = (message) => message.content ?? message.text } = {}) {
    if (!target) return;
    const previousCount = renderedCounts.get(target) || 0;
    target.innerHTML = messages.length
      ? messages.map((message, index) => `<p class="v1-conversation-message ${message.role === "USER" ? "user" : "assistant"}${previousCount > 0 && index >= previousCount ? " is-entering" : ""}">${escapeHtml(textFor(message))}</p>`).join("")
      : `<p class="v1-conversation-empty">${escapeHtml(emptyText || "")}</p>`;
    renderedCounts.set(target, messages.length);
    const scheduleFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    scheduleFrame(() => target.querySelectorAll(".v1-conversation-message.is-entering").forEach((message) => message.classList.remove("is-entering")));
    target.lastElementChild?.scrollIntoView?.({ block: "nearest" });
  }

  function setExecutionState({ form, status = null, active, copy = "" }) {
    const submit = form?.querySelector?.('button[type="submit"]');
    const textarea = form?.querySelector?.("textarea");
    if (status && ProcessingIndicator) ProcessingIndicator.set(status, { active: Boolean(active), copy, state: active ? "WAITING" : copy ? "TERMINAL" : "IDLE" });
    else if (status) status.textContent = copy;
    if (submit && ProcessingIndicator?.setButton) ProcessingIndicator.setButton(submit, { active: Boolean(active) });
    else if (submit) submit.classList.toggle("is-loading", Boolean(active));
    if (submit) submit.disabled = Boolean(active);
    if (textarea) textarea.setAttribute("aria-busy", String(Boolean(active)));
  }

  function settle({ form, messages, focus = true }) {
    messages?.lastElementChild?.scrollIntoView?.({ block: "nearest" });
    if (focus) form?.querySelector?.("textarea")?.focus?.();
  }

  function waitForIndicatorPaint(milliseconds = 800) {
    const scheduleFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    return new Promise((resolve) => scheduleFrame(() => scheduleFrame(() => globalThis.setTimeout(resolve, milliseconds))));
  }

  return Object.freeze({ renderMessages, humanSafeText, setExecutionState, settle, waitForIndicatorPaint, ProcessingIndicator });
}));
