"use strict";
(function (root) {
  const Selection = root.AriadneRuntimeSelection, Settings = root.AriadneModelSettings;
  if (!Selection || !Settings) return;
  let busy = false, lastCheck = 0, pending = null;
  const region = document.createElement("div");
  region.className = "v1-model-update"; region.hidden = true; region.setAttribute("role", "status");
  const copy = document.createElement("span"), action = document.createElement("button"), later = document.createElement("button");
  action.type = later.type = "button"; action.textContent = "验证并切换"; later.textContent = "稍后";
  region.append(copy, action, later);
  const form = document.querySelector(".v1-conversation-form");
  const home = document.getElementById("runtime-message");
  if (form) form.before(region); else if (home) home.after(region); else return;
  const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/model-updates.css?v=1"; document.head.append(link);
  const operation = ({ "personal-conversation-form": "personal_understanding", "job-overview-form": "job_overview",
    "candidate-workspace-composer": "candidate_conversation", "candidate-conversation-form": "candidate_conversation",
    "job-workspace-composer": "job_conversation", "job-conversation-form": "job_conversation" })[form?.id];
  const fetchAPI = (...args) => (root.AriadneConnector || root).fetch(...args);
  const scope = () => Selection.bindings.get(form?.id)?.scope || Selection.scopeFor(operation);
  const active = () => document.querySelector('.v1-conversation-form[aria-busy="true"]');
  const deepseekSelected = () => { const runtime = Selection.homepage(); return runtime.mode === "model" && runtime.provider === "deepseek"; };
  const dismissed = item => sessionStorage.getItem(`ariadne-update-dismissed:${item.model}:${item.revision}`) === "1";
  const availableHere = item => Settings.catalog.models.some(record => record.provider === "deepseek" && record.model === item.model && record.descriptor_revision === item.revision)
    && (!form || (operation && root.JobRadarRuntimeGate?.operationGate(operation,
      root.JobRadarRuntimeGate.authorityFrom({ mode: "model", provider: "deepseek", model: item.model }, operation)).allowed));
  async function check(force = false) {
    if (!deepseekSelected()) { region.hidden = true; return; }
    if (busy || document.hidden || active() || (!force && Date.now() - lastCheck < 900000)) return;
    lastCheck = Date.now();
    try {
      const response = await fetchAPI("/api/model-updates", { cache: "no-store" }), result = await response.json();
      if (busy || !response.ok || !result.ok || !Array.isArray(result.models) || !deepseekSelected() || active()) return;
      const effective = form ? Selection.resolve(operation, scope()) : Selection.homepage();
      pending = result.models.find(item => !dismissed(item) && (item.model !== effective.model ||
        (item.revision && item.revision !== Settings.descriptor("deepseek", effective.model)?.descriptor_revision)));
      if (!pending) { region.hidden = true; return; }
      const ready = pending.can_verify && availableHere(pending);
      copy.textContent = ready ? `发现 ${pending.label}。仅发送测试图片/PDF，可能产生少量费用。`
        : `发现 ${pending.label}，等待适配验证。`;
      action.hidden = !ready; action.disabled = false; later.hidden = false; region.hidden = false;
    } catch (_) { /* Discovery failure never blocks ordinary conversation. */ }
  }
  later.onclick = () => {
    if (pending) sessionStorage.setItem(`ariadne-update-dismissed:${pending.model}:${pending.revision}`, "1");
    region.hidden = true;
  };
  action.onclick = async () => {
    if (busy || active() || !deepseekSelected() || !pending || !pending.can_verify || !availableHere(pending)) return;
    const selected = pending, captured = Selection.version(), capturedScope = scope();
    if (form && !capturedScope) { copy.textContent = "请先打开资料或职位，再验证切换。"; return; }
    busy = true; action.disabled = true; later.hidden = true; copy.textContent = "正在验证图片、PDF 与输出格式…";
    try {
      const response = await fetchAPI("/api/model-updates/verify", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "deepseek", model: selected.model, revision: selected.revision, confirmed: true }) });
      const result = await response.json();
      if (!response.ok || !result.ok || result.model !== selected.model || result.revision !== selected.revision) throw Error("验证未通过，当前模型未切换。");
      if (active() || Selection.version() !== captured || scope() !== capturedScope) throw Error("对话或模型选择已变化，请重新确认切换。");
      const runtime = { mode: "model", provider: "deepseek", model: result.model };
      runtime.execution_settings = Settings.envelope(runtime);
      await Selection.update({ scope: capturedScope, runtime, expectedRevision: captured, makeDefault: !form,
        isCurrent: () => !active() && scope() === capturedScope && deepseekSelected() });
      region.hidden = true;
      if (!form) root.location.reload();
    } catch (error) { copy.textContent = error.message || "验证未完成，当前模型未切换。"; }
    finally { busy = false; action.disabled = false; later.hidden = false; if (!deepseekSelected()) region.hidden = true; }
  };
  root.addEventListener("ariadne-runtime-selection", () => check(true));
  root.addEventListener("storage", () => check(true));
  document.addEventListener("visibilitychange", () => check());
  root.setInterval(check, 900000);
  check(true);
  root.AriadneModelUpdates = Object.freeze({ check });
}(globalThis));
