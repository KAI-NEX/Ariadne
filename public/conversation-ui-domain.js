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
  const awaitingReplies = new WeakSet();
  const renderedKeys = new WeakMap();
  const reveals = new WeakMap();
  let outputModule;
  function withOutput(callback) {
    if (!globalThis.document?.createElement) return;
    if (!outputModule) outputModule = new Promise(resolve => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/conversation-output.css?v=1"; document.head.append(css);
      const script = document.createElement("script"); script.src = "/conversation-output.js?v=1";
      script.onload = () => resolve(globalThis.AriadneConversationOutput);
      script.onerror = () => resolve(null);
      document.head.append(script);
    });
    outputModule.then(api => { if (api) callback(api); });
  }

  function takeDraft(input) {
    const text = input.value;
    let edited = false, finished = false;
    const onInput = () => { edited = true; };
    input.value = "";
    input.addEventListener("input", onInput);
    return { text, finish(restore = false) {
      if (finished) return;
      finished = true;
      input.removeEventListener("input", onInput);
      if (restore && !edited && input.value === "") input.value = text;
    } };
  }

  function revealReply(target, bubble, key, previous = null) {
    const view = target.ownerDocument?.defaultView;
    if (!view?.queueMicrotask || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const state = { key, view, timer: null, started: previous?.started ?? view.performance.now(), shown: previous?.shown || 0 };
    reveals.set(target, state);
    bubble.style.visibility = "hidden";
    target.setAttribute("aria-busy", "true");
    // Callers may append source links or findings synchronously after rendering.
    // Reveal their text too, preserving the actual DOM and the stored reply.
    view.queueMicrotask(() => {
      if (reveals.get(target) !== state || !bubble.isConnected) return;
      const walker = target.ownerDocument.createTreeWalker(bubble, 4);
      const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh", { granularity: "grapheme" }) : null;
      const records = [];
      let node, length = 0;
      while ((node = walker.nextNode())) {
        const text = node.data, chars = segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : Array.from(text);
        records.push({ node, text, chars, start: length });
        length += chars.length;
      }
      const duration = Math.min(1800, Math.max(120, length * 6));
      const paint = (now) => {
        if (reveals.get(target) !== state || !bubble.isConnected) return;
        const scroll = target.closest(".v1-conversation-scroll, .v1-workspace-history");
        const follow = scroll && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 32;
        state.shown = Math.min(length, Math.max(state.shown, 1, Math.floor(length * (now - state.started) / duration)));
        records.forEach((record) => {
          const count = Math.max(0, state.shown - record.start);
          record.node.data = count >= record.chars.length ? record.text : record.chars.slice(0, count).join("");
        });
        bubble.style.visibility = "";
        if (follow) scroll.scrollTop = scroll.scrollHeight;
        if (state.shown < length) state.timer = view.setTimeout(() => paint(view.performance.now()), 16);
        else { reveals.delete(target); target.setAttribute("aria-busy", "false"); }
      };
      paint(view.performance.now());
    });
  }

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
    const keys = messages.map((message) => message.message_id || message.id || `${message.role}:${textFor(message)}`);
    const oldKeys = renderedKeys.get(target) || [];
    const previousReveal = reveals.get(target);
    if (previousReveal) {
      previousReveal.view.clearTimeout(previousReveal.timer);
      reveals.delete(target);
      target.setAttribute("aria-busy", "false");
    }
    target.innerHTML = messages.length
      ? messages.map((message, index) => `<p class="v1-conversation-message ${message.role === "USER" ? "user" : "assistant"}${previousCount > 0 && index >= previousCount ? " is-entering" : ""}">${escapeHtml(textFor(message))}</p>`).join("")
      : `<p class="v1-conversation-empty">${escapeHtml(emptyText || "")}</p>`;
    renderedCounts.set(target, messages.length);
    renderedEnds.set(target, { first, last });
    renderedKeys.set(target, keys);
    const scheduleFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    scheduleFrame(() => target.querySelectorAll(".v1-conversation-message.is-entering").forEach((message) => message.classList.remove("is-entering")));
    if (readingHistory) {
      const prepended = messages.length > previousCount && previousEnds?.last === last && previousEnds?.first !== first;
      scroll.scrollTop = previousTop + (prepended ? scroll.scrollHeight - previousHeight : 0);
    } else if (scroll) scroll.scrollTop = scroll.scrollHeight;
    else target.lastElementChild?.scrollIntoView?.({ block: "nearest" });
    const lastKey = keys.at(-1);
    const continuing = previousReveal && previousReveal.key === lastKey;
    const newReply = awaitingReplies.has(target) && messages.at(-1)?.role === "ASSISTANT" && !oldKeys.includes(lastKey);
    if (continuing || newReply) {
      awaitingReplies.delete(target);
      revealReply(target, target.lastElementChild, lastKey, continuing ? previousReveal : null);
    }
    withOutput(api => {
      if (renderedKeys.get(target) === keys) api.decorate(target, messages, textFor);
    });
  }

  function setExecutionState({ form, status = null, active, copy = "" }) {
    withOutput(api => api.execution({ form, active }));
    const submit = form?.querySelector?.('button[type="submit"]');
    const textarea = form?.querySelector?.("textarea");
    const target = form?.closest?.(".v1-conversation-pane, .v1-ariadne-pane")?.querySelector(".v1-conversation-messages");
    if (target) { if (active) awaitingReplies.add(target); else awaitingReplies.delete(target); }
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

  function waitForIndicatorPaint(milliseconds = 0) {
    const scheduleFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
    return new Promise((resolve) => scheduleFrame(() => scheduleFrame(() => globalThis.setTimeout(resolve, milliseconds))));
  }

  if (globalThis.document) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhanceComposers(), { once: true });
    else enhanceComposers();
  }
  return Object.freeze({ renderMessages, humanSafeText, setExecutionState, settle, waitForIndicatorPaint, enhanceComposers, takeDraft, ProcessingIndicator });
}));
