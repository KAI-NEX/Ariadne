"use strict";
(function (root) {
  const Selection = root.AriadneRuntimeSelection, Settings = root.AriadneModelSettings, Gate = root.JobRadarRuntimeGate;
  const FORMS = { "candidate-workspace-composer": "candidate_conversation", "candidate-conversation-form": "candidate_conversation",
    "job-workspace-composer": "job_conversation", "job-conversation-form": "job_conversation",
    "personal-conversation-form": "personal_understanding", "job-overview-form": "job_overview" };
  async function models(operation) {
    // Re-read on each open so newly qualified models (and removals) are reflected.
    const response = await (root.AriadneConnector || root).fetch("/api/runtime-options", { cache: "no-store" });
    if (!response.ok) throw Error("无法读取可用模型，请检查本地服务或连接。");
    return Selection.eligibleModels((await response.json()).models, operation);
  }
  function mount(form, operation) {
    const field = form.querySelector(".v1-composer-field");
    if (!field) return;
    field.classList.add("has-model-selector");
    const trigger = document.createElement("button");
    trigger.type = "button"; trigger.className = "v1-model-trigger";
    trigger.setAttribute("aria-label", "选择模型与推理强度"); trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "menu");
    field.insertBefore(trigger, field.querySelector('button[type="submit"]'));
    const panel = document.createElement("div");
    panel.className = "v1-model-panel"; panel.setAttribute("popover", "auto"); panel.setAttribute("role", "menu");
    panel.setAttribute("aria-label", "选择模型"); panel.tabIndex = -1;
    const prefix = form.id + "-model";
    panel.id = prefix;
    trigger.setAttribute("aria-controls", prefix);
    panel.innerHTML = `<h3>选择模型</h3><div data-model-options role="group"></div><p>切换模型服务请回到首页。</p><p data-model-error role="status"></p>`;
    document.body.append(panel);
    const choices = panel.querySelector("[data-model-options]"), error = panel.querySelector("[data-model-error]");
    let openedRevision, openedScope, original, saving = false, opening = 0;
    const scope = () => Selection.bindings.get(form.id)?.scope || Selection.scopeFor(operation);
    const busy = () => form.getAttribute("aria-busy") === "true" || saving;
    const render = () => {
      const runtime = Selection.resolve(operation, scope());
      trigger.textContent = Settings.label(runtime, true);
      trigger.setAttribute("aria-label", `选择模型与推理强度：${Settings.label(runtime, true)}`);
      trigger.title = `${Settings.label(runtime)} · ${Selection.hasOverride(scope()) ? "此对话设置" : "继承默认设置"}`;
      trigger.disabled = busy();
      if (panel.matches(":popover-open") && (busy() || openedRevision !== Selection.version() || openedScope !== scope())) panel.hidePopover();
    };
    const position = () => {
      if (!panel.matches(":popover-open")) return;
      const rect = trigger.getBoundingClientRect();
      panel.style.maxHeight = `${Math.max(44, rect.top - 20)}px`;
      panel.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - panel.offsetWidth - 12))}px`;
      panel.style.top = `${Math.max(12, rect.top - panel.offsetHeight - 8)}px`;
    };
    trigger.onclick = async () => {
      if (busy()) return;
      if (panel.matches(":popover-open")) { panel.hidePopover(); return; }
      const ticket = ++opening;
      openedRevision = Selection.version(); openedScope = scope(); original = Selection.resolve(operation, openedScope);
      error.textContent = ""; choices.replaceChildren();
      panel.showPopover(); trigger.setAttribute("aria-expanded", "true"); position();
      try {
        if (original.mode !== "model") throw Error("当前处于 Local 模式。请先在首页选择 Model。");
        if (!openedScope) throw Error("请先打开一份资料或职位。");
        const entries = await models(operation);
        if (ticket !== opening || !panel.matches(":popover-open") || busy()) return;
        for (const entry of entries) {
          const item = Settings.descriptor(entry.provider_id, entry.model_id);
          // Generate only catalog-authorized combinations; no inferred model capabilities.
          let variants = [{ settings: {}, labels: [] }];
          for (const [key, spec] of Object.entries(item.parameters)) {
            variants = variants.flatMap(variant => spec.options.map(option => ({
              settings: { ...variant.settings, [key]: option.value }, labels: [...variant.labels, option.label]
            })));
          }
          for (const variant of variants) {
            const runtime = { mode: "model", provider: item.provider, model: item.model };
            runtime.execution_settings = Settings.envelope(runtime, variant.settings);
            const button = document.createElement("button");
            button.type = "button"; button.setAttribute("role", "menuitemradio");
            button.dataset.modelChoice = `${item.provider}/${item.model}`;
            button.dataset.effort = variant.settings.reasoning_effort || "";
            button.textContent = [item.short_label, ...variant.labels].join(" · ");
            button.setAttribute("aria-checked", String(Settings.identity(runtime) === Settings.identity(original)));
            button.onclick = () => save(runtime);
            choices.append(button);
          }
        }
        if (!entries.length) throw Error("暂无可用模型，请检查连接。");
        position();
        (choices.querySelector('[aria-checked="true"]') || choices.querySelector("button")).focus();
      } catch (err) {
        if (ticket === opening && panel.matches(":popover-open")) { error.textContent = err.message; position(); panel.focus(); }
      }
    };
    panel.addEventListener("keydown", event => {
      const buttons = [...choices.querySelectorAll("button:not(:disabled)")];
      if (event.key === "Tab") { panel.hidePopover(); trigger.focus(); return; }
      if (!buttons.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    });
    panel.addEventListener("toggle", event => {
      trigger.setAttribute("aria-expanded", String(event.newState === "open"));
      if (event.newState === "closed") {
        opening++;
        if (!trigger.disabled && (panel.contains(document.activeElement) || document.activeElement === document.body)) trigger.focus({ preventScroll: true });
      }
    });
    root.addEventListener("resize", position);
    root.addEventListener("scroll", position, true);
    async function save(runtime) {
      try {
        if (busy() || scope() !== openedScope) throw Error("当前对话已变化，请重新打开模型菜单。");
        saving = true;
        for (const button of choices.querySelectorAll("button")) button.disabled = true;
        await Selection.update({ scope: openedScope, runtime, expectedRevision: openedRevision });
        panel.hidePopover();
      } catch (err) { error.textContent = err.message; position(); }
      finally {
        saving = false;
        for (const button of choices.querySelectorAll("button")) button.disabled = false;
        render();
      }
    }
    new MutationObserver(render).observe(form, { attributes: true, attributeFilter: ["aria-busy", "data-model-scope"] });
    Gate.subscribe(render); render();
  }
  document.addEventListener("DOMContentLoaded", () => {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/conversation-model-selector.css?v=compact-menu-1"; document.head.append(link);
    for (const [id, operation] of Object.entries(FORMS)) { const form = document.getElementById(id); if (form) mount(form, operation); }
  }, { once: true });
}(globalThis));
