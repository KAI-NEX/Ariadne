"use strict";
(function (root) {
  const Selection = root.AriadneRuntimeSelection, Settings = root.AriadneModelSettings, Gate = root.JobRadarRuntimeGate;
  const FORMS = { "candidate-workspace-composer": "candidate_conversation", "candidate-conversation-form": "candidate_conversation",
    "job-workspace-composer": "job_conversation", "job-conversation-form": "job_conversation",
    "personal-conversation-form": "personal_understanding", "job-overview-form": "job_overview" };
  let available = null;
  async function models(operation) {
    if (!available) {
      const response = await (root.AriadneConnector || root).fetch("/api/runtime-options", { cache: "no-store" });
      if (!response.ok) throw Error("无法读取可用模型，请检查本地服务或连接。");
      available = (await response.json()).models;
    }
    return available.filter(item => Settings.descriptor(item.provider_id, item.model_id)
      && Gate.operationGate(operation, Gate.authorityFrom({ mode: "model", provider: item.provider_id, model: item.model_id }, operation)).allowed);
  }
  function mount(form, operation) {
    const field = form.querySelector(".v1-composer-field");
    if (!field) return;
    field.classList.add("has-model-selector");
    const trigger = document.createElement("button");
    trigger.type = "button"; trigger.className = "v1-model-trigger";
    trigger.setAttribute("aria-label", "选择模型与推理强度"); trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "dialog");
    field.append(trigger);
    const panel = document.createElement("div");
    panel.className = "v1-model-panel"; panel.setAttribute("popover", "auto"); panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "模型设置");
    const prefix = form.id + "-model";
    panel.innerHTML = `<h3>模型设置</h3><p class="v1-model-scope"></p>
      <label for="${prefix}-choice">模型</label><select id="${prefix}-choice" data-model-choice></select>
      <div data-model-parameters></div><details><summary>连接与型号</summary><p data-model-detail></p></details>
      <p data-model-notice>只影响下一轮；资料仍需你确认保存。</p><p data-model-error role="status"></p>
      <div class="v1-model-actions"><button type="button" data-model-apply>应用到此对话</button><button type="button" data-model-default>设为默认</button>
      <button type="button" data-model-inherit>使用默认设置</button><button type="button" data-model-close>关闭</button></div>`;
    document.body.append(panel);
    const choice = panel.querySelector("[data-model-choice]"), parameters = panel.querySelector("[data-model-parameters]"), error = panel.querySelector("[data-model-error]");
    let openedRevision, openedScope, original, saving = false;
    const scope = () => Selection.bindings.get(form.id)?.scope || Selection.scopeFor(operation);
    const busy = () => form.getAttribute("aria-busy") === "true" || saving;
    const render = () => {
      const runtime = Selection.resolve(operation, scope());
      trigger.textContent = Settings.label(runtime, true);
      trigger.setAttribute("aria-label", `选择模型与推理强度：${Settings.label(runtime, true)}`);
      trigger.title = `${Settings.label(runtime)} · ${Selection.hasOverride(scope()) ? "此对话设置" : "继承默认设置"}`;
      trigger.disabled = busy();
      if (busy() && panel.matches(":popover-open")) panel.hidePopover();
    };
    const renderParameters = () => {
      const item = Settings.catalog.models.find(record => `${record.provider}/${record.model}` === choice.value);
      parameters.replaceChildren();
      if (!item) return;
      for (const [key, spec] of Object.entries(item.parameters)) {
        const label = document.createElement("label"), select = document.createElement("select");
        select.id = `${prefix}-${key}`; select.dataset.parameter = key;
        label.htmlFor = select.id; label.textContent = spec.label;
        for (const option of spec.options) select.add(new Option(option.label, option.value));
        select.value = original?.provider === item.provider && original?.model === item.model ? original.execution_settings.effective_settings[key] : spec.default;
        parameters.append(label, select);
      }
      panel.querySelector("[data-model-detail]").textContent = `${item.provider} / ${item.model} · ${item.protocol} · ${item.connection_id}`;
      panel.querySelector("[data-model-notice]").textContent = Object.keys(item.parameters).length
        ? "低强度通常响应更快；高强度会花更多时间推理。只影响下一轮，资料仍需你确认保存。"
        : "此模型的已验证接入使用固定参数，暂不提供推理强度调节。";
    };
    trigger.onclick = async () => {
      if (busy()) return;
      if (panel.matches(":popover-open")) { panel.hidePopover(); return; }
      openedRevision = Selection.version(); openedScope = scope(); original = Selection.resolve(operation, openedScope);
      error.textContent = ""; choice.replaceChildren(); parameters.replaceChildren();
      panel.querySelector(".v1-model-scope").textContent = Selection.hasOverride(openedScope) ? "当前对话使用独立设置" : "当前对话继承默认设置";
      panel.showPopover(); trigger.setAttribute("aria-expanded", "true");
      const rect = trigger.getBoundingClientRect();
      panel.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - panel.offsetWidth - 12))}px`;
      panel.style.top = `${Math.max(12, Math.min(rect.top - panel.offsetHeight - 8, innerHeight - panel.offsetHeight - 12))}px`;
      try {
        if (original.mode !== "model") throw Error("当前处于 Local 模式。请先在首页选择 Model 运行方式。");
        if (!openedScope) throw Error("请先打开一份资料或职位，模型设置将绑定到该对话。");
        const entries = await models(operation);
        for (const item of entries) choice.add(new Option(Settings.descriptor(item.provider_id, item.model_id).short_label, `${item.provider_id}/${item.model_id}`));
        choice.value = `${original.provider}/${original.model}`;
        if (!choice.value) throw Error("当前模型连接不可用，请检查连接或重新选择已验证模型。");
        renderParameters(); choice.focus();
        if (Selection.legacyDifference(operation)) error.textContent = "此入口保留了旧的独立模型偏好。应用到此对话可保留；设为默认会统一旧操作偏好，已有对话覆盖不变。";
      } catch (err) { error.textContent = err.message; }
      for (const button of panel.querySelectorAll("[data-model-apply], [data-model-default], [data-model-inherit]")) button.disabled = original.mode !== "model" || !openedScope || !choice.value;
      // Reposition after the model-specific parameter controls have their final height.
      panel.style.top = `${Math.max(12, rect.top - panel.offsetHeight - 8)}px`;
    };
    choice.onchange = () => {
      renderParameters(); error.textContent = "";
      for (const button of panel.querySelectorAll("[data-model-apply], [data-model-default], [data-model-inherit]")) button.disabled = original.mode !== "model" || !openedScope || !choice.value;
    };
    panel.querySelector("[data-model-close]").onclick = () => panel.hidePopover();
    panel.addEventListener("toggle", event => { trigger.setAttribute("aria-expanded", String(event.newState === "open")); if (event.newState === "closed") trigger.focus({ preventScroll: true }); });
    async function save(options) {
      try {
        if (busy() || scope() !== openedScope) throw Error("当前对话已变化，请重新打开模型菜单。");
        const item = Settings.catalog.models.find(record => `${record.provider}/${record.model}` === choice.value);
        if (!item) throw Error("请选择可用模型。");
        const runtime = { mode: "model", provider: item.provider, model: item.model };
        runtime.execution_settings = Settings.envelope(runtime, Object.fromEntries([...parameters.querySelectorAll("select")].map(select => [select.dataset.parameter, select.value])));
        saving = true;
        await Selection.update({ scope: openedScope, runtime, expectedRevision: openedRevision, ...options });
        panel.hidePopover();
      } catch (err) { error.textContent = err.message; }
      finally { saving = false; render(); }
    }
    panel.querySelector("[data-model-apply]").onclick = () => save({});
    panel.querySelector("[data-model-default]").onclick = () => save({ makeDefault: true });
    panel.querySelector("[data-model-inherit]").onclick = () => save({ clear: true });
    new MutationObserver(render).observe(form, { attributes: true, attributeFilter: ["aria-busy", "data-model-scope"] });
    Gate.subscribe(render); render();
  }
  document.addEventListener("DOMContentLoaded", () => {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/conversation-model-selector.css"; document.head.append(link);
    for (const [id, operation] of Object.entries(FORMS)) { const form = document.getElementById(id); if (form) mount(form, operation); }
  }, { once: true });
}(globalThis));
