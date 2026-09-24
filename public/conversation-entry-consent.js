"use strict";
// Presentation over the existing recipient/settings/scope consent authority.
(function (root) {
  const doc = root.document, selection = root.AriadneRuntimeSelection;
  if (!doc || !selection || root.AriadneConversationEntry) return;
  const forms = {
    "personal-conversation-form": "personal_understanding", "job-overview-form": "job_overview",
    "candidate-workspace-composer": "candidate_conversation", "candidate-conversation-form": "candidate_conversation",
    "job-workspace-composer": "job_conversation", "job-conversation-form": "job_conversation",
  };
  const tr = (zh, en) => doc.documentElement.lang.startsWith("en") ? en : zh;
  const css = doc.createElement("link"); css.rel = "stylesheet"; css.href = "/conversation-entry-consent.css?v=1"; doc.head.append(css);
  const entries = new Map();
  function mount(form, operation) {
    const pane = form.closest(".v1-conversation-pane, .v1-ariadne-pane");
    if (!pane) return null;
    const gate = doc.createElement("section"); gate.className = "v1-conversation-entry"; gate.hidden = true;
    gate.setAttribute("role", "region"); gate.setAttribute("aria-labelledby", `${form.id}-entry-heading`);
    const title = doc.createElement("h2"); title.id = `${form.id}-entry-heading`;
    const copy = doc.createElement("p"), boundary = doc.createElement("p"), button = doc.createElement("button");
    boundary.className = "v1-entry-boundary";
    button.type = "button"; button.className = "v1-primary-button";
    gate.append(title, copy, boundary, button); pane.prepend(gate);
    const entry = { form, pane, gate, title, copy, boundary, button, operation, enteredToken: null, locked: false, states: new Map() };
    button.addEventListener("click", () => {
      try { selection.acceptEntryConsent(operation, entry.token); entry.enteredToken = entry.token; refresh(); form.querySelector("textarea")?.focus({ preventScroll: true }); }
      catch (_) { refresh(); boundary.textContent = tr("模型设置已变化，请核对后重新确认。", "Model settings changed. Review them before accepting."); }
    });
    entries.set(form.id, entry); return entry;
  }
  function lock(entry, locked) {
    const changed = entry.locked !== locked;
    entry.locked = locked;
    if (entry.gate.hidden === locked) entry.gate.hidden = !locked;
    for (const child of entry.pane.children) {
      if (child === entry.gate) continue;
      if (locked) {
        if (!entry.states.has(child)) entry.states.set(child, child.inert);
        if (!child.inert) child.inert = true;
        if (!child.classList.contains("v1-entry-obscured")) child.classList.add("v1-entry-obscured");
      } else if (entry.states.has(child)) {
        child.inert = entry.states.get(child); entry.states.delete(child); child.classList.remove("v1-entry-obscured");
      }
    }
    if (changed && !locked && !root.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      entry.form.animate?.([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: "cubic-bezier(.22,.78,.24,1)" });
    }
  }
  function refresh() {
    for (const [id, operation] of Object.entries(forms)) {
      const form = doc.getElementById(id); if (!form) continue;
      const entry = entries.get(id) || mount(form, operation); if (!entry) continue;
      const state = selection.entryConsent(operation);
      // Existing checkbox stays as the domain guard, not a second visible consent.
      entry.pane.querySelectorAll(".personal-consent, .job-overview-consent").forEach(label => { if (!label.hidden) label.hidden = true; });
      // Library-wide conversations start with a fresh entry screen on every visit,
      // even when the exact recipient/settings disclosure was accepted before.
      const visitEntry = entry.pane.dataset.entryConfirmation === "visit";
      const locked = Boolean(state.scope && state.fingerprint && (!state.accepted || (visitEntry && entry.enteredToken !== state.token)));
      entry.token = state.token;
      const recipient = state.runtime.provider === "codex" ? "Codex / OpenAI" : state.runtime.provider;
      const scope = operation === "personal_understanding" || operation === "candidate_conversation"
        ? tr("后续问题、相关个人资料、已保存补充和对话历史", "Your subsequent questions, relevant personal records, saved notes and conversation history")
        : tr("后续问题、当前职位、相关个人资料、已保存补充和对话历史", "Your subsequent questions, current jobs, relevant personal records, saved notes and conversation history");
      const copy = tr(`${scope}将发送至 ${recipient} · ${state.runtime.model}，可能消耗模型额度或产生 API 费用。更新理解可能分批调用。`, `${scope} will be sent to ${recipient} · ${state.runtime.model}, using model credits or incurring API charges. Updating understanding may require multiple calls.`);
      if (entry.copy.textContent !== copy) entry.copy.textContent = copy;
      const title = tr("开始对话前", "Before starting a conversation"); if (entry.title.textContent !== title) entry.title.textContent = title;
      const search = state.runtime.provider === "codex"
        ? tr("提交后，本机 Codex 可按需查询公开网页；网上信息不属于你的个人经历。", "After submission, local Codex may search public websites when needed; online information is not your personal experience. ") : "";
      const boundary = tr("确认只是进入对话，不会立即发送资料。", "Accepting only opens the conversation; nothing is sent yet. ") + search
        + tr("资料修改仍需另行确认保存，附件仍按本轮单独确认。", "Record changes require separate confirmation, as do attachments for each turn.");
      if (entry.boundary.textContent !== boundary) entry.boundary.textContent = boundary;
      const button = tr("同意并进入对话", "Accept and enter conversation"); if (entry.button.textContent !== button) entry.button.textContent = button;
      lock(entry, locked);
      entry.pane.dataset.entryReady = "true";
    }
  }
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; root.requestAnimationFrame(() => { queued = false; refresh(); }); };
  root.AriadneConversationEntry = Object.freeze({ refresh, requiresConfirmation: operation => [...entries.values()].some(entry => entry.operation === operation && entry.locked) });
  root.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    for (const entry of entries.values()) if (entry.pane.dataset.entryConfirmation === "visit") entry.enteredToken = null;
    refresh();
  });
  root.addEventListener("ariadne-runtime-selection", schedule);
  root.addEventListener("storage", schedule);
  root.JobRadarRuntimeGate?.subscribe(schedule);
  new MutationObserver(schedule).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden", "data-model-scope", "lang"] });
  refresh();
}(globalThis));
