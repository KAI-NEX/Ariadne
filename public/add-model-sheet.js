"use strict";

(function attachAddModelSheet(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.JobRadarAddModelSheet = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createAddModelSheet() {
  const PROVIDERS = Object.freeze([
    { id: "deepseek", name: "DeepSeek", apiKeyUrl: "https://platform.deepseek.com/api_keys", models: [{ id: "deepseek-flash", name: "deepseek-flash" }] },
    { id: "gemini", name: "Gemini", apiKeyUrl: "https://aistudio.google.com/app/apikey", models: [{ id: "gemini-3.7-flash", name: "gemini-3.7-flash" }] },
    { id: "qwen", name: "千问 Qwen", apiKeyUrl: "https://bailian.console.aliyun.com/", models: [{ id: "qwen3.8-max", name: "qwen3.8-max" }] },
  ]);
  const API_KEY_STORAGE_PREFIX = "job-radar-provider-api-key:";
  const LAST_PROVIDER_STORAGE_KEY = "job-radar-add-model-provider";
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  function providerFor(providerId) { return PROVIDERS.find((provider) => provider.id === providerId) || null; }
  function compatibleModels(providerId, returnedModelIds) {
    const provider = providerFor(providerId);
    if (!provider || !Array.isArray(returnedModelIds)) return [];
    const available = new Set(returnedModelIds.map(String));
    return provider.models.filter((model) => available.has(model.id));
  }

  function mount(elements, onComplete, onReturn, onReturnStart) {
    const byId = (id) => elements[id];
    const modelList = byId("model-list");
    const status = byId("status");
    const connectLabel = byId("connect").querySelector(".add-model-connect-label");
    const safeStorage = {
      get(key) { try { return localStorage.getItem(key) || ""; } catch (_error) { return ""; } },
      set(key, value) { try { localStorage.setItem(key, value); } catch (_error) { /* The connection can still continue for this tab. */ } },
      remove(key) { try { localStorage.removeItem(key); } catch (_error) { /* Nothing else to clear. */ } },
    };
    const initialProviderId = "deepseek";
    const keyStorageKey = (providerId) => `${API_KEY_STORAGE_PREFIX}${providerId}`;
    const state = { providerId: initialProviderId, apiKey: safeStorage.get(keyStorageKey(initialProviderId)), phase: "IDLE", models: [], selectedModel: null, verified: false, error: "", providerMenuOpen: false };
    let completionTimer = null;
    let closingTimer = null;
    let closingAnimation = null;
    let returnStartTimer = null;
    let returnOriginRect = null;
    let attempt = 0;
    const panelControls = globalThis.JobRadarFloatingWindow?.mount(byId("panel"), {
      dragHandle: byId("panel").querySelector(".add-model-header"),
      minWidth: 420,
      minHeight: 430,
      margin: 10,
    });

    function provider() { return providerFor(state.providerId); }
    function loading() { return ["SENDING", "WAITING", "VERIFYING"].includes(state.phase); }
    function statusCopy() {
      return {
        IDLE: "未连接",
        SENDING: "正在准备连接验证…",
        WAITING: `正在等待 ${provider().name} 响应…`,
        VERIFYING: "正在验证图文输入能力…",
        DISCOVERED: `已找到 ${state.models.length} 个图文模型`,
        VERIFIED: "验证成功",
        FAILED: state.error || "验证失败，请重试。",
      }[state.phase] || "未连接";
    }
    function resetDiscovery() {
      state.models = [];
      state.selectedModel = null;
      state.verified = false;
      state.error = "";
      state.phase = "IDLE";
    }
    function persistCurrentKey() {
      if (state.apiKey) safeStorage.set(keyStorageKey(state.providerId), state.apiKey);
      else safeStorage.remove(keyStorageKey(state.providerId));
    }
    function render() {
      const selectedProvider = provider();
      const isLoading = loading();
      byId("sheet").classList.toggle("hidden", state.phase === "CLOSED");
      byId("sheet").setAttribute("aria-hidden", String(state.phase === "CLOSED"));
      byId("provider-value").textContent = selectedProvider?.name || "选择模型服务";
      byId("provider").setAttribute("aria-expanded", String(state.providerMenuOpen));
      byId("provider-menu").classList.toggle("is-open", state.providerMenuOpen);
      byId("provider-menu").setAttribute("aria-hidden", String(!state.providerMenuOpen));
      byId("provider-menu").querySelectorAll("[data-provider-id]").forEach((option) => option.setAttribute("aria-selected", String(option.dataset.providerId === state.providerId)));
      if (byId("key").value !== state.apiKey) byId("key").value = state.apiKey;
      byId("key-link").classList.toggle("hidden", !selectedProvider);
      byId("key-link").href = selectedProvider?.apiKeyUrl || "#";
      byId("key-link").textContent = selectedProvider ? `获取 ${selectedProvider.name} API Key` : "";
      if (byId("transfer-hint")) byId("transfer-hint").textContent = `API Key 保存在当前浏览器。你确认发起请求后，Key 与本次材料经 Ariadne 网站服务转发至 ${selectedProvider.name}。Key 不在服务端持久保存，上传材料仅作临时处理。请在自己的设备使用。`;
      if (byId("check-hint")) byId("check-hint").textContent = state.providerId === "deepseek"
        ? "点击连接将发送一张固定测试图片，可能产生少量 API 费用；不会发送你的个人材料。"
        : `点击连接将发送固定两页测试 PDF 的完整页面图片，验证读图与 JSON 返回，可能产生少量 API 费用；不会发送你的个人材料。${state.providerId === "qwen" ? "当前使用百炼北京地域的 API Key。" : "需使用 Gemini API Key，服务所在地须支持 Gemini API。"}`;
      for (const id of ["key", "provider", "clear"]) byId(id).disabled = isLoading;
      byId("connect").disabled = !(selectedProvider && state.apiKey) || isLoading || state.phase === "VERIFIED";
      byId("connect").classList.toggle("is-loading", isLoading);
      byId("connect").classList.toggle("is-success", state.phase === "VERIFIED");
      byId("connect").classList.toggle("is-failed", state.phase === "FAILED");
      connectLabel.textContent = state.phase === "FAILED" ? "重试连接" : "同意验证并连接";
      byId("connect").setAttribute("aria-label", statusCopy());
      byId("connect").title = state.phase === "FAILED" ? statusCopy() : "";
      status.textContent = statusCopy();
      status.dataset.phase = state.phase;
      modelList.replaceChildren();
      if (state.models.length) {
        byId("models-section").classList.remove("hidden");
        state.models.forEach((model) => {
          const button = document.createElement("button");
          button.type = "button"; button.className = "add-model-choice"; button.dataset.model = model.id;
          button.setAttribute("aria-pressed", String(state.selectedModel === model.id));
          button.textContent = model.name;
          button.addEventListener("click", () => { state.selectedModel = model.id; render(); });
          modelList.append(button);
        });
      } else {
        byId("models-section").classList.add("hidden");
      }
    }
    function viewportHeight() { return window.visualViewport?.height || window.innerHeight; }
    function clampPanelHeight(height) {
      const maximum = Math.max(320, viewportHeight() * 0.94);
      const minimum = Math.min(430, maximum);
      return Math.min(maximum, Math.max(minimum, height));
    }
    function setPanelHeight(height, animate = false) {
      byId("panel").classList.toggle("is-resizing", !animate);
      byId("panel").style.setProperty("--add-model-sheet-height", `${Math.round(clampPanelHeight(height))}px`);
      if (animate) window.setTimeout(() => byId("panel").classList.remove("is-resizing"), 260);
    }
    function fitPanelToContent() {
      window.requestAnimationFrame(() => {
        const headerHeight = byId("panel").querySelector(".add-model-header").offsetHeight;
        const bodyHeight = byId("panel").querySelector(".add-model-body").scrollHeight;
        const footerHeight = byId("panel").querySelector(".add-model-footer").offsetHeight;
        setPanelHeight(headerHeight + bodyHeight + footerHeight + 2, true);
      });
    }
    function setPanelOrigin(originRect) {
      const fallback = { left: window.innerWidth / 2, top: viewportHeight() / 2, width: 0, height: 0 };
      const rect = originRect && Number.isFinite(originRect.left) ? originRect : fallback;
      const originX = rect.left + rect.width / 2 - window.innerWidth / 2;
      const originY = rect.top + rect.height / 2 - viewportHeight() / 2;
      byId("panel").style.setProperty("--add-model-origin-x", `${Math.round(originX)}px`);
      byId("panel").style.setProperty("--add-model-origin-y", `${Math.round(originY)}px`);
      byId("panel").style.setProperty("--add-model-origin-scale", clamp(.68 + (rect.width / Math.max(680, window.innerWidth)) * .12, .68, .78).toFixed(3));
    }
    function close() {
      if (completionTimer) { window.clearTimeout(completionTimer); completionTimer = null; }
      if (state.phase === "CLOSED" || closingTimer) return;
      attempt += 1;
      persistCurrentKey();
      state.providerMenuOpen = false;
      setPanelOrigin(returnOriginRect);
      const panel = byId("panel");
      const current = panel.getBoundingClientRect();
      const fallback = { left: window.innerWidth / 2 - 1, top: viewportHeight() / 2 - 1, width: 2, height: 2 };
      const destination = returnOriginRect && Number.isFinite(returnOriginRect.left) ? returnOriginRect : fallback;
      byId("panel").classList.add("is-close-ready");
      void byId("panel").offsetWidth;
      byId("sheet").classList.add("is-closing");
      if (byId("panel").contains(document.activeElement)) document.activeElement.blur();
      byId("sheet").setAttribute("aria-hidden", "true");
      Object.assign(panel.style, { left: `${current.left}px`, top: `${current.top}px`, width: `${current.width}px`, height: `${current.height}px`, transform: "none" });
      closingAnimation?.cancel();
      closingAnimation = panel.animate([
        { left: `${current.left}px`, top: `${current.top}px`, width: `${current.width}px`, height: `${current.height}px`, borderRadius: "26px", opacity: 1, filter: "blur(0)" },
        { left: `${destination.left}px`, top: `${destination.top}px`, width: `${Math.max(2, destination.width)}px`, height: `${Math.max(2, destination.height)}px`, borderRadius: "34px", opacity: .06, filter: "blur(5px)" },
      ], { duration: 400, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
      const finalizeClose = () => {
        if (!closingTimer) return;
        window.clearTimeout(closingTimer);
        closingTimer = null;
        closingAnimation?.cancel();
        closingAnimation = null;
        state.phase = "CLOSED";
        render();
        byId("sheet").classList.remove("is-closing");
        byId("panel").classList.remove("is-close-ready");
        panelControls?.reset();
        if (typeof onReturn === "function") onReturn();
      };
      closingTimer = window.setTimeout(finalizeClose, 430);
      closingAnimation.finished.then(finalizeClose).catch(() => {});
      returnStartTimer = window.setTimeout(() => {
        returnStartTimer = null;
        if (closingTimer && typeof onReturnStart === "function") onReturnStart();
      }, 0);
    }
    function open(originRect, returnRect = originRect) {
      if (closingTimer) { window.clearTimeout(closingTimer); closingTimer = null; }
      if (returnStartTimer) { window.clearTimeout(returnStartTimer); returnStartTimer = null; }
      closingAnimation?.cancel();
      closingAnimation = null;
      panelControls?.reset();
      byId("sheet").classList.remove("is-closing");
      byId("panel").classList.remove("is-close-ready");
      returnOriginRect = returnRect;
      setPanelOrigin(originRect);
      state.apiKey = safeStorage.get(keyStorageKey(state.providerId));
      state.providerMenuOpen = false;
      resetDiscovery();
      render();
      fitPanelToContent();
      byId("key").focus();
    }
    function selectProvider(providerId) {
      if (!providerFor(providerId) || loading()) return;
      state.providerId = providerId;
      safeStorage.set(LAST_PROVIDER_STORAGE_KEY, providerId);
      state.apiKey = safeStorage.get(keyStorageKey(providerId));
      state.providerMenuOpen = false;
      resetDiscovery();
      render();
      fitPanelToContent();
    }
    async function requestConnection() {
      if (loading()) return;
      state.apiKey = state.apiKey.trim();
      persistCurrentKey();
      if (!state.apiKey || safeStorage.get(keyStorageKey(state.providerId)) !== state.apiKey) {
        state.phase = "FAILED"; state.error = "浏览器无法保存 API Key，请允许本站存储后重试。"; render(); return;
      }
      if (!providerFor(state.providerId)) return;
      const currentAttempt = ++attempt;
      state.models = []; state.selectedModel = null; state.verified = false; state.error = "";
      state.phase = "SENDING"; render();
      try {
        state.phase = "WAITING"; render();
        const response = await (globalThis.AriadneTransport || globalThis).fetch(`/api/runtime-providers/${state.providerId}/connection-check`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: state.apiKey, confirmed: true }),
          redirect: "error",
        });
        const result = await response.json();
        if (currentAttempt !== attempt) return;
        if (!response.ok) throw Object.assign(new Error(result.error || "provider_connection_failed"), { result });
        state.phase = "VERIFYING"; render();
        acceptDiscoveredModels(result.models, result.verified_model_id);
      } catch (error) {
        if (currentAttempt !== attempt) return;
        const code = error.result?.error || error.message;
        const platformMessage = globalThis.AriadneTransport?.errorCopy(error);
        state.phase = "FAILED";
        state.error = platformMessage || ({ PROVIDER_PDF_PREPARATION_FAILED: "测试 PDF 未能完整转图，请检查服务端 PDF 工具后重试。",
          PROVIDER_VISUAL_CHECK_FAILED: "模型未完整通过两页读图与 JSON 验证，请重试或检查模型权限。",
          WEB_API_RUNTIME_UNAVAILABLE: "当前网站尚未提供此模型服务，请更新网站部署后重试。" })[code]
          || (error.result?.provider_http_status === 429 ? "服务额度或请求频率受限，请检查余额、配额后重试。" : "验证失败，请检查 API Key、服务地区、模型权限或稍后重试。");
        render();
      }
    }
    function acceptDiscoveredModels(returnedModelIds, verifiedModelId) {
      state.models = compatibleModels(state.providerId, returnedModelIds).filter(model =>
        globalThis.JobRadarRuntimeGate?.isModelRuntimeEligible({ mode: "model", provider: state.providerId, model: model.id }));
      state.selectedModel = state.models.some((model) => model.id === verifiedModelId) ? verifiedModelId : null;
      state.verified = Boolean(state.selectedModel);
      state.phase = state.verified ? "VERIFIED" : "DISCOVERED";
      render();
      if (state.verified) {
        completionTimer = window.setTimeout(() => {
          completionTimer = null;
          if (state.phase === "VERIFIED" && state.selectedModel) completeSelectedModel();
        }, 360);
      }
    }
    function completeSelectedModel() {
      if (!state.verified || !state.selectedModel) return;
      const selected = provider().models.find((model) => model.id === state.selectedModel);
      if (!selected) return;
      onComplete({ providerId: state.providerId, providerName: provider().name, model: selected });
      close();
    }
    byId("close").addEventListener("click", close);
    byId("backdrop").addEventListener("click", close);
    byId("clear").addEventListener("click", () => {
      safeStorage.remove(keyStorageKey(state.providerId));
      state.apiKey = "";
      resetDiscovery();
      render();
      byId("key").focus();
    });
    byId("key").addEventListener("input", (event) => {
      state.apiKey = event.target.value;
      persistCurrentKey();
      resetDiscovery();
      render();
    });
    byId("key").addEventListener("change", persistCurrentKey);
    byId("key").addEventListener("blur", persistCurrentKey);
    byId("provider").addEventListener("click", () => { state.providerMenuOpen = !state.providerMenuOpen; render(); });
    byId("provider-menu").querySelectorAll("[data-provider-id]").forEach((option) => option.addEventListener("click", () => selectProvider(option.dataset.providerId)));
    byId("connect").addEventListener("click", requestConnection);
    window.addEventListener("resize", () => {
      if (state.phase !== "CLOSED") setPanelHeight(byId("panel").getBoundingClientRect().height, true);
    });
    document.addEventListener("click", (event) => {
      if (state.providerMenuOpen && !event.target.closest(".add-model-select-wrap")) { state.providerMenuOpen = false; render(); }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || state.phase === "CLOSED") return;
      if (state.providerMenuOpen) { state.providerMenuOpen = false; render(); return; }
      close();
    });
    state.phase = "CLOSED"; render();
    return Object.freeze({ open, acceptDiscoveredModels, state: () => ({ ...state, apiKey: "" }) });
  }
  return Object.freeze({ PROVIDERS, API_KEY_STORAGE_PREFIX, providerFor, compatibleModels, mount });
}));
