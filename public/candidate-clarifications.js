"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneCandidateClarifications = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const fail = (code) => { throw Object.assign(new Error(code), { code }); };
  const keyFor = (source, item, question) => JSON.stringify([source, item.item_id, question.uncertainty_id, question.question]);

  function entriesFor(working, sources = []) {
    if (!working) return [];
    return (working.payload.items || []).flatMap((item) => (item.uncertainties || [])
      .filter((question) => question.status === "OPEN")
      .map((question) => ({
        key: keyFor(working.source_document_id, item, question),
        source_document_id: working.source_document_id,
        working_model_id: working.working_model_id, version: working.version, fingerprint: working.fingerprint,
        item_id: item.item_id, title: item.title, question: question.question, uncertainty_id: question.uncertainty_id,
        sources: [...new Set((item.grounding_refs || []).map((ref) => {
          const source = sources.find((entry) => entry.source_document_id === ref.source_document_id);
          return [source?.filename || "来源文件暂不可用", ref.location].filter(Boolean).join(" · ");
        }))],
      })));
  }

  function answerMessage(entry, answer) {
    const text = String(answer || "").trim();
    if (!text) fail("CLARIFICATION_ANSWER_REQUIRED");
    // This is also the human-visible conversation record; keep control-plane IDs and status enums out of the copy.
    return `回答卡片「${entry.title}」的待确认问题：\n${entry.question}\n\n我的回答：${text}\n\n请据此更新这张卡片的相关草稿；只有信息足够时才解决这一个问题，其他卡片和问题保持原样。补充内容不是外部事实核验，核对后再由我保存。`;
  }

  async function runBoundAnswer(entry, request, send) {
    const working = request.working_model;
    if (!working || working.source_document_id !== entry.source_document_id
      || working.working_model_id !== entry.working_model_id || working.version !== entry.version || working.fingerprint !== entry.fingerprint) fail("STALE_WORKING_OBSERVATION");
    const items = working.payload.items.filter((item) => item.item_id === entry.item_id);
    const questions = items[0]?.uncertainties?.filter((question) => question.uncertainty_id === entry.uncertainty_id) || [];
    if (items.length !== 1 || questions.length !== 1 || questions[0].status !== "OPEN" || questions[0].question !== entry.question) fail("STALE_WORKING_OBSERVATION");
    if (request.observation.focus.type !== "ITEM" || request.observation.focus.item_id !== entry.item_id) fail("FOCUS_VIOLATION");
    const result = await send(request);
    // The normal runtime still validates schema, provenance, fresh versions and Human Save. This entry point narrows its scope further.
    for (const patch of result?.action?.patches || []) {
      if (patch.target_item_id !== entry.item_id) fail("FOCUS_VIOLATION");
      for (const operation of patch.operations || []) {
        if (operation.operation === "SET_UNCERTAINTY_STATUS" && operation.uncertainty_id !== entry.uncertainty_id) fail("FOCUS_VIOLATION");
      }
    }
    return result;
  }

  function mount(container, { onAnswer }) {
    const drafts = new Map();
    let entries = [], busy = false;
    const el = (tag, text, className) => {
      const node = container.ownerDocument.createElement(tag);
      if (text) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    function render() {
      container.replaceChildren();
      if (!entries.length) {
        const empty = el("p", "当前没有需要补充的问题。"); empty.dataset.entryType = "CLARIFYING_QUESTION_EMPTY";
        container.append(empty); return;
      }
      container.append(el("h3", "有几处信息可以稍后确认"));
      for (const entry of entries) {
        const draft = drafts.get(entry.key) || { text: "", open: false, status: "" };
        drafts.set(entry.key, draft);
        const details = el("details", "", "v1-clarification");
        details.open = draft.open;
        details.dataset.entryType = "CLARIFYING_QUESTION";
        const summary = el("summary");
        summary.append(el("span", entry.question, "v1-clarification-question"), el("span", `所属卡片：${entry.title}`, "v1-clarification-context"),
          el("span", `卡片来源：${entry.sources.join("；") || "暂无可定位的材料来源"}`, "v1-clarification-context"),
          el("span", "点击回答", "v1-clarification-hint"));
        details.append(summary);
        const form = el("form", "", "v1-edit-form");
        const label = el("label", "你的回答");
        const input = el("textarea");
        input.value = draft.text; input.required = true; input.maxLength = 4000;
        input.disabled = busy; input.rows = 3;
        input.addEventListener("input", () => { draft.text = input.value; draft.status = ""; status.textContent = ""; submit.disabled = busy || !input.value.trim(); });
        label.append(input);
        const note = el("small", "回答将用于更新这张卡片的草稿，核对后由你保存。", "v1-clarification-context");
        const submit = el("button", busy ? "正在处理…" : "回答", "v1-primary-button");
        submit.type = "submit"; submit.disabled = busy || !draft.text.trim();
        const status = el("div", draft.status, "v1-clarification-context"); status.setAttribute("role", "status");
        form.append(label, note, submit, status); details.append(form); container.append(details);
        details.addEventListener("toggle", () => { draft.open = details.open; });
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          if (busy || !draft.text.trim()) return;
          busy = true; draft.open = true; draft.status = "正在处理这条回答…"; render();
          try {
            const outcome = await onAnswer(entry, draft.text);
            if (outcome?.status === "SUCCEEDED") {
              draft.text = "";
              draft.status = "回答已提交；如果仍需补充，请查看下方对话。";
            } else {
              draft.status = outcome?.message || (outcome?.status === "STALE" ? "资料已变化，回答尚未应用。请核对最新问题后重试。" : "这次未完成，回答已保留，请重试。");
            }
          } catch (_) { draft.status = "这次未完成，回答已保留，请重试。"; }
          finally {
            busy = false; render();
            // Keep keyboard users at this question (or the next one if it was resolved), without scrolling away from their place.
            const index = entries.findIndex((candidate) => candidate.key === entry.key);
            const summaries = container.querySelectorAll("summary");
            (summaries[index < 0 ? 0 : index])?.focus({ preventScroll: true });
          }
        });
      }
    }
    return { update(working, sources) { entries = entriesFor(working, sources); render(); } };
  }
  return { entriesFor, answerMessage, runBoundAnswer, mount };
});
