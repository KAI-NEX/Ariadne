"use strict";

(function attachConversationUi(root, factory) {
  const processing = root.AriadneProcessingIndicator
    || (typeof module === "object" && module.exports ? require("./processing-indicator-domain.js") : null);
  const api = factory(processing);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneConversationUI = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createConversationUi(ProcessingIndicator) {
  const renderedCounts = new WeakMap();
  const renderedEnds = new WeakMap();
  const enhancedForms = new WeakSet();

  function enhanceComposers(documentObject = globalThis.document) {
    if (!documentObject?.querySelectorAll) return;
    documentObject.querySelectorAll(".v1-conversation-form").forEach((form) => {
      if (enhancedForms.has(form)) return;
      const input = form.querySelector("textarea"), field = form.querySelector(".v1-composer-field");
      if (!input || !field) return;
      enhancedForms.add(form);
      const doc = form.ownerDocument, view = doc.defaultView;
      const pane = form.parentElement;
      if (pane.matches(".v1-conversation-pane, .v1-ariadne-pane")) {
        const messages = pane.querySelector(".v1-conversation-messages");
        if (messages?.parentElement === pane) {
          const scroll = doc.createElement("div");
          scroll.className = "v1-conversation-scroll";
          scroll.tabIndex = 0;
          scroll.setAttribute("role", "region");
          scroll.setAttribute("aria-label", "对话记录");
          pane.insertBefore(scroll, messages);
          while (scroll.nextElementSibling && scroll.nextElementSibling !== form) scroll.append(scroll.nextElementSibling);
          pane.classList.add("v1-chat-viewport");
        }
        const dock = doc.createElement("div");
        dock.className = "v1-composer-dock";
        pane.insertBefore(dock, form);
        while (dock.nextElementSibling) dock.append(dock.nextElementSibling);
      }

      const handle = doc.createElement("div");
      handle.className = "v1-composer-resize";
      handle.tabIndex = 0;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-orientation", "horizontal");
      handle.setAttribute("aria-label", "调整输入框高度");
      handle.title = "上下拖动调整高度；方向键微调，Home 恢复";
      if (input.id) handle.setAttribute("aria-controls", input.id);
      field.append(handle);
      const minimum = parseFloat(view.getComputedStyle(input).minHeight) || 44;
      let chosenHeight = minimum, drag = null;
      function setHeight(value) {
        const viewportHeight = view.visualViewport?.height || view.innerHeight;
        const history = pane.querySelector(".v1-conversation-scroll, .v1-workspace-history");
        const available = history?.clientHeight > 0 ? history.clientHeight + input.getBoundingClientRect().height - 80 : Infinity;
        const maximum = Math.max(minimum, Math.min(320, viewportHeight * .4, available));
        chosenHeight = Math.round(Math.max(minimum, Math.min(maximum, value)));
        input.style.height = `${chosenHeight}px`;
        handle.setAttribute("aria-valuemin", String(minimum));
        handle.setAttribute("aria-valuemax", String(Math.floor(maximum)));
        handle.setAttribute("aria-valuenow", String(chosenHeight));
      }
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        handle.focus({ preventScroll: true });
        drag = { pointer: event.pointerId, y: event.clientY, height: input.getBoundingClientRect().height };
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener("pointermove", (event) => {
        if (drag?.pointer === event.pointerId) setHeight(drag.height + drag.y - event.clientY);
      });
      const stopDrag = () => { drag = null; };
      handle.addEventListener("pointerup", stopDrag);
      handle.addEventListener("pointercancel", stopDrag);
      handle.addEventListener("lostpointercapture", stopDrag);
      handle.addEventListener("keydown", (event) => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        setHeight(event.key === "Home" ? minimum : event.key === "End" ? Infinity : chosenHeight + (event.key === "ArrowUp" ? 20 : -20));
      });
      view.addEventListener("resize", () => setHeight(chosenHeight));
      view.visualViewport?.addEventListener("resize", () => setHeight(chosenHeight));
      setHeight(minimum);
    });
  }

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
    const scroll = target.closest?.(".v1-conversation-scroll, .v1-workspace-history");
    const previousTop = scroll?.scrollTop || 0, previousHeight = scroll?.scrollHeight || 0;
    const readingHistory = scroll && previousCount > 0 && previousTop + scroll.clientHeight < previousHeight - 32;
    const previousEnds = renderedEnds.get(target);
    const first = messages.length ? textFor(messages[0]) : "", last = messages.length ? textFor(messages.at(-1)) : "";
    target.innerHTML = messages.length
      ? messages.map((message, index) => `<p class="v1-conversation-message ${message.role === "USER" ? "user" : "assistant"}${previousCount > 0 && index >= previousCount ? " is-entering" : ""}">${escapeHtml(textFor(message))}</p>`).join("")
      : `<p class="v1-conversation-empty">${escapeHtml(emptyText || "")}</p>`;
    renderedCounts.set(target, messages.length);
    renderedEnds.set(target, { first, last });
    const scheduleFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    scheduleFrame(() => target.querySelectorAll(".v1-conversation-message.is-entering").forEach((message) => message.classList.remove("is-entering")));
    if (readingHistory) {
      const prepended = messages.length > previousCount && previousEnds?.last === last && previousEnds?.first !== first;
      scroll.scrollTop = previousTop + (prepended ? scroll.scrollHeight - previousHeight : 0);
    } else if (scroll) scroll.scrollTop = scroll.scrollHeight;
    else target.lastElementChild?.scrollIntoView?.({ block: "nearest" });
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
    const scroll = messages?.closest?.(".v1-conversation-scroll, .v1-workspace-history");
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    else messages?.lastElementChild?.scrollIntoView?.({ block: "nearest" });
    if (focus) form?.querySelector?.("textarea")?.focus?.({ preventScroll: true });
  }

  function waitForIndicatorPaint(milliseconds = 800) {
    const scheduleFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    return new Promise((resolve) => scheduleFrame(() => scheduleFrame(() => globalThis.setTimeout(resolve, milliseconds))));
  }

  if (globalThis.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhanceComposers(), { once: true });
    else enhanceComposers();
  }
  return Object.freeze({ renderMessages, humanSafeText, setExecutionState, settle, waitForIndicatorPaint, enhanceComposers, ProcessingIndicator });
}));
