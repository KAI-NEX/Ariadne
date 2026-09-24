"use strict";

(function attach(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneConversationTurnTransport = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function create(root) {
  const STREAM = "application/x-ariadne-turn+ndjson";
  const FORM_IDS = { CANDIDATE: ["candidate-workspace-composer", "candidate-conversation-form"], JOB: ["job-workspace-composer", "job-conversation-form"], PERSONAL: ["personal-conversation-form"], JOB_OVERVIEW: ["job-overview-form"] };
  const tr = (zh, en) => root.document?.documentElement.lang?.startsWith("en") ? en : zh;

  function feedback(domain) {
    const doc = root.document;
    const form = FORM_IDS[domain]?.map(id => doc?.getElementById(id)).find(Boolean);
    const pane = form?.closest(".v1-conversation-pane, .v1-ariadne-pane") || form?.parentElement;
    const messages = pane?.querySelector(".v1-conversation-messages") || pane?.querySelector(".v1-workspace-history");
    if (!messages) return { event() {}, finish() {} };
    if (!doc.querySelector('link[data-turn-feedback]')) {
      const css = doc.createElement("link"); css.rel = "stylesheet"; css.href = "/conversation-feedback.css?v=1"; css.dataset.turnFeedback = ""; doc.head.append(css);
    }
    pane.querySelectorAll(".v1-turn-feedback").forEach(node => node.remove());
    const panel = doc.createElement("section"); panel.className = "v1-turn-feedback is-active";
    panel.setAttribute("aria-label", tr("本轮过程反馈", "This turn’s progress"));
    const details = doc.createElement("details"); details.open = true;
    const summary = doc.createElement("summary"); summary.textContent = tr("正在准备本轮对话", "Preparing this turn");
    summary.setAttribute("role", "status");
    const log = doc.createElement("ol");
    const preview = doc.createElement("p"); preview.className = "v1-turn-preview"; preview.hidden = true;
    const note = doc.createElement("p"); note.className = "v1-turn-boundary";
    note.textContent = tr("实时预览 · 尚未完成校验，不会自动修改资料。", "Live preview · Not yet validated. No automatic changes to your records.");
    details.append(summary, log, preview, note); panel.append(details); messages.after(panel);
    const add = text => { const item = doc.createElement("li"); item.textContent = text; log.append(item); };
    let ended = false;
    return {
      event(event) {
        if (ended || !panel.isConnected) return;
        const scroll = panel.closest(".v1-conversation-scroll, .v1-workspace-history");
        const follow = scroll && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 80;
        if (event.type === "received") add(tr("服务端已收到本轮请求", "Server received this turn"));
        if (event.type === "scope") add(event.text);
        if (event.type === "input_ready") add(tr(`模型输入已准备：${event.images} 张图片 / PDF 页面`, `Model input prepared: ${event.images} images / PDF pages`));
        if (event.type === "model_started") {
          summary.textContent = tr("等待模型的公开反馈", "Waiting for public model feedback");
          add(tr("已进入模型调用；尚未收到内容时会保持等待", "Model call started; waiting until content is available"));
        }
        if (event.type === "update") {
          summary.textContent = tr("AI 正在反馈", "AI is reporting progress");
          add(tr("AI 阶段反馈（未核验）：", "AI progress (unverified): ") + event.text);
        }
        if (event.type === "preview") {
          summary.textContent = tr("回复正在生成", "Reply in progress");
          preview.hidden = false; preview.textContent = event.text;
        }
        if (event.type === "checking") {
          summary.textContent = tr("回复已收到，正在校验", "Reply received; validating");
          add(tr("正在检查回复结构与领域约束；不等于事实核验", "Checking response structure and domain constraints, not factual truth"));
        }
        if (follow) scroll.scrollTop = scroll.scrollHeight;
      },
      finish(ok, streamed = true, result = null) {
        if (ended) return; ended = true;
        panel.classList.remove("is-active");
        preview.textContent = ""; preview.hidden = true;
        if (!streamed && ok) {
          summary.textContent = tr("本轮使用完整回复模式", "This turn used a complete response");
          add(tr("服务端未提供实时事件；没有模拟生成过程。", "Server did not provide live events; no simulated progress."));
        } else {
          summary.textContent = ok ? tr("本轮过程记录", "This turn’s activity") : tr("本轮未完成", "This turn did not complete");
          add(ok ? tr("服务端校验已通过；最终结果以对话记录为准。", "Server validation passed; see the final conversation result.")
            : tr("实时预览已撤回；未作为最终回复保存。请查看错误提示后重试。", "Preview withdrawn, not saved as a final reply. Review the error before retrying."));
        }
        note.textContent = tr("结构检查不证明内容真实；资料修改仍需你确认保存。", "Structural checks do not prove factual truth. Record changes still require your confirmation.");
        if (ok && Number.isInteger(result?.usage?.total_tokens) && result.usage.total_tokens >= 0) add(tr(`模型报告本轮用量：${result.usage.total_tokens} tokens`, `Model-reported usage: ${result.usage.total_tokens} tokens`));
        details.open = !ok;
      },
    };
  }

  async function readStream(response, onEvent) {
    const reader = response.body?.getReader();
    if (!reader) throw fallbackError({ error: "CONVERSATION_STREAM_UNAVAILABLE" });
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let buffer = "", size = 0, sequence = 0, terminal = null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { buffer += decoder.decode(); break; }
        size += value.byteLength;
        if (size > 16000000) throw Error("CONVERSATION_STREAM_LIMIT");
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (terminal || event.seq !== ++sequence) throw Error("CONVERSATION_STREAM_SEQUENCE_INVALID");
          if (event.type === "result") {
            if (!Number.isInteger(event.status) || !event.result || typeof event.result !== "object") throw Error("CONVERSATION_STREAM_RESULT_INVALID");
            terminal = event;
          } else if (["received", "input_ready", "model_started", "checking"].includes(event.type)) {
            if (event.type === "input_ready" && (!Number.isInteger(event.images) || event.images < 0 || event.images > 80)) throw Error("CONVERSATION_STREAM_EVENT_INVALID");
            onEvent(event);
          } else if (["update", "preview"].includes(event.type) && typeof event.text === "string" && event.text.length <= 12000) {
            onEvent(event);
          } else throw Error("CONVERSATION_STREAM_EVENT_INVALID");
        }
      }
      if (buffer.trim() || !terminal) throw Error("CONVERSATION_STREAM_INCOMPLETE");
      return terminal;
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  function fallbackError(result, fallback) {
    const code = result?.error || fallback;
    const error = new Error(code);
    error.code = code;
    error.failure_layer = result?.failure_layer || "runtime";
    error.network_call_made = result?.network_call_made === true;
    error.diagnostics = result?.diagnostics;
    return error;
  }

  async function execute({
    request,
    domain,
    endpoint,
    fallback_error: fallback = "CONVERSATION_TURN_FAILED",
    malformed_error: malformed = "MALFORMED_RESPONSE",
    include_attachments: includeAttachments = true,
    create_error: createError = null,
    on_event: onEvent = null,
  }) {
    if (!request || typeof domain !== "string" || !domain || typeof endpoint !== "string" || !endpoint.startsWith("/api/")) {
      throw new Error("CONVERSATION_TURN_TRANSPORT_INPUT_INVALID");
    }
    const attachments = includeAttachments ? root.AriadneConversationAttachments : null;
    const live = request.phase && request.phase !== "DISCUSS" ? { event() {}, finish() {} } : feedback(domain);
    let finished = false;
    try {
      const outbound = attachments ? await attachments.prepare(request, domain) : request;
      const coverage = request.context?.coverage || request.compiled_context?.candidate_context_coverage;
      if (Number.isInteger(coverage?.included_records) && Number.isInteger(coverage?.total_records)) {
        live.event({ type: "scope", text: tr(`本轮选取 ${coverage.included_records}/${coverage.total_records} 条详细资料；${coverage.truncated_records || 0} 条为节选。`, `This turn includes ${coverage.included_records}/${coverage.total_records} detailed records; ${coverage.truncated_records || 0} are excerpts.`) });
      } else if (Number.isInteger(coverage?.included_jobs) && Number.isInteger(coverage?.total_jobs)) {
        live.event({ type: "scope", text: tr(`本轮选取 ${coverage.included_jobs}/${coverage.total_jobs} 份职位详情；${coverage.truncated_jobs || 0} 份为节选。`, `This turn includes ${coverage.included_jobs}/${coverage.total_jobs} detailed jobs; ${coverage.truncated_jobs || 0} are excerpts.`) });
      }
      attachments?.stage(request, "MODEL_REQUEST");
      const responsePromise = (root.AriadneTransport || root).fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: request.phase && request.phase !== "DISCUSS" ? "application/json" : STREAM },
        body: JSON.stringify(outbound),
      });
      attachments?.dispatch(request);
      let response = await responsePromise;
      const streamed = response.headers?.get("Content-Type")?.split(";")[0] === STREAM;
      let result;
      if (streamed) {
        const terminal = await readStream(response, event => { live.event(event); onEvent?.(event); });
        result = terminal.result;
        response = { ok: terminal.status >= 200 && terminal.status < 300, status: terminal.status };
      } else result = await response.json().catch(() => ({ error: malformed }));
      if (!response.ok || result?.error) {
        throw createError ? createError({ response, result }) : fallbackError(result, fallback);
      }
      finished = true;
      attachments?.finish(request, true, null, result);
      live.finish(true, streamed, result);
      return result;
    } catch (error) {
      if (!finished) attachments?.finish(request, false, error);
      live.finish(false);
      throw error;
    }
  }

  return Object.freeze({ execute, fallbackError, readStream, STREAM });
}));
