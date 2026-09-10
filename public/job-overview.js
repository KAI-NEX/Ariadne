"use strict";
(async function jobOverviewPage() {
  const Domain = window.AriadneJobOverview, Truth = window.AriadneTruthPersistence, Gate = window.JobRadarRuntimeGate, UI = window.AriadneConversationUI;
  const el = (id) => document.getElementById(id), esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let busy = false, state, visible = 15, pendingMessage = null;
  const status = (copy, error = false) => { el("job-overview-status").textContent = copy; el("job-overview-status").classList.toggle("error", error); };
  function runtime() {
    const gate = Gate.operationGate("job_overview"), current = gate.authority.runtime;
    el("job-overview-runtime").textContent = current.mode === "local" ? "Local · 查看已保存概况" : `${current.provider} · ${current.model}`;
    el("job-overview-consent-copy").textContent = current.mode === "local" ? "当前为 Local。选择可用模型后，可以汇总与讨论职位。" : `允许将问题及当前职位描述内容发送至 ${current.provider} · ${current.model}；更新概况可能分批调用并产生 API 费用。不发送个人资料。`;
    el("job-overview-consent").disabled = busy || !gate.allowed;
    const disabled = busy || !gate.allowed || !el("job-overview-consent").checked;
    el("refresh-job-overview").disabled = disabled; el("job-overview-form").querySelector('button[type="submit"]').disabled = disabled; return gate;
  }
  function links(identities) {
    return [...new Set(identities || [])].map((identity) => {
      const record = state.snapshot.records.find((entry) => entry.identity === identity);
      if (!record) return '<span>历史职位已不在当前范围</span>';
      const href = record.context_id ? `/job-detail.html?job=${encodeURIComponent(record.context_id)}` : "/jd-import.html";
      return `<a href="${href}">${esc(record.semantic.title)}${record.semantic.company ? ` · ${esc(record.semantic.company)}` : ""}${record.version ? "" : " · 未确认草稿"}</a>`;
    }).join("");
  }
  function insightsMarkup(insights) { return (insights || []).map((entry) => `<div class="job-overview-finding"><div>${esc(entry.text)}</div><div class="personal-evidence">${links(entry.identities)}</div></div>`).join(""); }
  function unknownMarkup(values) { return values?.length ? `<ul class="job-overview-unknown">${values.map((entry) => `<li>${esc(entry)}</li>`).join("")}</ul>` : ""; }
  function render() {
    const { snapshot, turns } = state, overview = snapshot.overview;
    el("job-overview-state").textContent = `当前 ${snapshot.records.length} 份职位描述：${snapshot.confirmed_count} 份已保存，${snapshot.working_count} 份未确认草稿。${overview ? "概况已更新；结论为模型理解。" : "概况待更新；发送问题时也会更新。"}`;
    el("job-overview-summary").textContent = overview?.summary || (snapshot.records.length ? "先了解这些职位各自在做什么，再比较共同要求与差异。" : "还没有可汇总的职位描述。添加真实职位描述后，可以在这里一起讨论。演示卡片不纳入概况。");
    el("job-overview-insights").innerHTML = insightsMarkup(overview?.insights);
    el("job-overview-unknowns").innerHTML = overview?.uncertainties?.length ? `<div class="personal-unknowns"><h3>还需要确认</h3>${unknownMarkup(overview.uncertainties)}</div>` : "";
    el("job-overview-directory").innerHTML = snapshot.records.map((record) => `<div class="job-overview-directory-item">${links([record.identity])}<div>${esc(record.semantic.location || "地点未明确")} · ${record.version ? `当前版本 ${record.version}` : "尚未保存为正式职位"}</div></div>`).join("") || "暂无职位描述。";
    const messages = turns.slice(-visible).flatMap((turn) => [{ id: `${turn.turn_id}:user`, role: "USER", text: turn.human_message }, ...(turn.status === "SUCCEEDED" ? [{ id: `${turn.turn_id}:assistant`, role: "ASSISTANT", text: `${turn.fingerprint !== snapshot.fingerprint ? "（基于当时职位版本的历史回答）\n" : ""}${turn.output.message}`, result: turn.output }] : [])]);
    if (pendingMessage) messages.push({ role: "USER", text: pendingMessage });
    const target = el("job-overview-messages");
    UI.renderMessages(target, messages, { empty_text: "从整体概况、岗位共性或某几份职位描述的差异开始。这里不读取个人资料。" });
    const bubbles = target.querySelectorAll(".v1-conversation-message");
    messages.forEach((message, index) => { if (message.result) { const details = document.createElement("span"); details.innerHTML = `${insightsMarkup(message.result.insights)}${unknownMarkup(message.result.uncertainties)}`; bubbles[index].append(details); } });
    el("job-overview-older").classList.toggle("hidden", turns.length <= visible);
    const last = turns.filter((turn) => turn.status === "SUCCEEDED").at(-1);
    el("job-overview-usage").textContent = last ? `最近一轮详细证据 ${last.context_coverage.included_jobs}/${last.context_coverage.total_jobs} 份，${last.context_coverage.truncated_jobs} 份节选；另参考当轮全量概况。上下文 ${Math.round(last.context_bytes / 1024)} KB，${last.calls} 次模型调用。` : "概况分批汇总全部当前职位描述；对话按预算选取详细证据，保留原文和历史。";
    runtime();
  }
  async function load() { const db = await Truth.openDatabase(); try { state = { snapshot: await Domain.snapshotFromDatabase(db), turns: (await Domain.getAll(db, "job_overview_turns")).sort((a, b) => a.created_at.localeCompare(b.created_at)) }; render(); } finally { db.close(); } }
  async function run(task, input = null) {
    if (busy || !runtime().allowed || !el("job-overview-consent").checked) return;
    const draft = input ? UI.takeDraft(input) : null;
    pendingMessage = draft?.text.trim() || null;
    busy = true; if (state) render(); runtime(); status(""); UI.setExecutionState({ form: el("job-overview-form"), status: el("job-overview-processing"), active: true, copy: "正在读取当前职位…" }); let db;
    try {
      db = await Truth.openDatabase(); const captured = Domain.runtimeSnapshot();
      const call = async (request) => { const current = Gate.operationGate("job_overview"); if (!current.allowed || current.authority.runtime.provider !== captured.provider || current.authority.runtime.model !== captured.model || !el("job-overview-consent").checked) throw new Error("JOB_OVERVIEW_RUNTIME_CHANGED"); return Domain.callRuntime(request); };
      await task(db, { runtime_snapshot: captured, consent: true, call, onProgress: (copy) => UI.setExecutionState({ form: el("job-overview-form"), status: el("job-overview-processing"), active: true, copy }) });
    } catch (error) {
      draft?.finish(true);
      status(/CONTEXT_CHANGED/.test(error.message) ? "职位已经变化，本次结果未保存。请基于最新职位描述重试。" : /RUNTIME|CONSENT|capability/.test(error.message) ? "运行方式或资料传输确认已变化，请核对后重试。" : "本次处理未完成，没有生成替代回答或修改任何职位描述。原始资料与历史保留，可以重试。", true);
    } finally {
      db?.close(); draft?.finish(); pendingMessage = null;
      try { await load(); }
      finally { busy = false; UI.setExecutionState({ form: el("job-overview-form"), status: el("job-overview-processing"), active: false }); runtime(); }
    }
  }
  el("job-overview-form").addEventListener("submit", (event) => { event.preventDefault(); const message = el("job-overview-message").value.trim(); if (message) run(async (db, options) => { await Domain.discuss(db, { ...options, human_message: message }); }, el("job-overview-message")); });
  el("refresh-job-overview").addEventListener("click", () => run(async (db, options) => { const result = await Domain.refresh(db, options); status(!result.snapshot.records.length ? "请先添加真实职位描述。" : result.cached ? "当前职位没有变化，无需重复调用模型。" : `概况已更新：复用 ${result.snapshot.overview.reused_fragments} 段摘要，新理解 ${result.snapshot.overview.refreshed_fragments} 段。`); }));
  el("job-overview-consent").addEventListener("change", runtime);
  el("job-overview-older").addEventListener("click", () => { visible += 20; render(); });
  document.querySelectorAll("[data-job-overview-prompt]").forEach((button) => button.addEventListener("click", () => { el("job-overview-message").value = button.dataset.jobOverviewPrompt; el("job-overview-message").focus(); }));
  Gate.subscribe(() => { el("job-overview-consent").checked = false; runtime(); });
  window.addEventListener("focus", () => { if (!busy) load().catch(() => status("暂时无法读取职位，请重试。", true)); });
  try { await load(); } catch (_error) { status("暂时无法读取职位，请重试。", true); }
}());
