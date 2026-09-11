"use strict";

if (window.location.hostname === "localhost") {
  const canonicalUrl = new URL(window.location.href);
  canonicalUrl.hostname = "127.0.0.1";
  window.location.replace(canonicalUrl.toString());
}

const ADDED_MODELS_STORAGE_KEY = "job-radar-added-runtime-models";
const SELECTED_RUNTIME_STORAGE_KEY = "job-radar-selected-runtime";
const state = { mode: null, provider: null, model: null, phase: "IDLE", models: [], addedModels: [], diagnostics: null };
const byId = (id) => document.getElementById(id);

function navigateWithPageTransition(destination, source) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.location.assign(destination);
    return;
  }
  document.body.classList.add("runtime-page-leaving");
  window.dispatchEvent(new Event("job-radar-runtime-leave"));
  source.disabled = true;
  window.setTimeout(() => window.location.assign(destination), 320);
}

function readLocalJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (_error) { return fallback; }
}

function writeLocalJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (_error) { /* The current page remains usable if storage is unavailable. */ }
}

function persistSelectedRuntime() {
  if (!state.mode) return;
  const selected = { mode: state.mode, provider: state.provider, model: state.model };
  writeLocalJson(SELECTED_RUNTIME_STORAGE_KEY, selected);
  if (state.mode === "ai") window.JobRadarRuntimeGate?.recordOperationRuntimeSelection(selected);
}

function selectableModels() {
  const addedIds = new Set(state.addedModels.map((model) => `${model.provider_id}:${model.model_id}`));
  return [...state.addedModels, ...state.models.filter((model) => !addedIds.has(`${model.provider_id}:${model.model_id}`))]
    .filter((model) => window.JobRadarRuntimeGate?.isModelRuntimeEligible({ mode: "model", provider: model.provider_id, model: model.model_id }));
}

function setMessage(message = "", failed = false) {
  const element = byId("runtime-message");
  element.textContent = message;
  element.classList.toggle("failed", failed);
}

function labelFor(model) {
  const known = typeof model === "string" ? window.AriadneModelSettings?.descriptor(state.provider, model) : window.AriadneModelSettings?.descriptor(model.provider_id, model.model_id);
  if (known) return known.short_label;
  if (typeof model === "string") return `${({ deepseek: "DeepSeek", gemini: "Gemini", qwen: "Qwen" }[state.provider] || "模型")} · ${model}`;
  return model.display_name;
}

function render() {
  const action = byId("runtime-action");
  const symbol = byId("runtime-action-symbol");
  const selected = byId("runtime-selected");
  const checking = state.phase === "CHECKING";
  const ready = state.phase === "READY" || state.phase === "OFFICIAL_READY" || state.phase === "LOCAL_READY";
  const hasModels = selectableModels().length > 0;
  selected.textContent = state.mode === "local" ? "本地运行" : state.model ? labelFor(selectableModels().find((item) => item.model_id === state.model && item.provider_id === state.provider) || state.model) : hasModels ? "选择模型" : "选择运行方式";
  action.disabled = !ready;
  action.classList.toggle("checking", checking);
  action.classList.toggle("ready", ready);
  symbol.classList.toggle("runtime-spinner", checking);
  document.querySelectorAll(".runtime-existing-model").forEach((button) => {
    button.setAttribute("aria-selected", String(state.mode === "ai" && button.dataset.model === state.model && button.dataset.provider === state.provider));
  });
  byId("runtime-local").setAttribute("aria-selected", String(state.mode === "local"));
}

function closeMenu() {
  const menu = byId("runtime-menu");
  menu.classList.remove("is-open");
  menu.setAttribute("aria-hidden", "true");
  byId("runtime-selector").setAttribute("aria-expanded", "false");
}

function openMenu() {
  const menu = byId("runtime-menu");
  menu.classList.add("is-open");
  menu.setAttribute("aria-hidden", "false");
  byId("runtime-selector").setAttribute("aria-expanded", "true");
}

function failureCopy(layer) {
  return { AUTH: "连接失败：请检查 Gemini API Key。", CORS: "连接失败：浏览器无法直接访问 Gemini。", PROVIDER: "连接失败：Gemini 暂时不可用。", MODEL: "连接失败：当前账号没有可用的图文模型。", REQUEST: "连接失败：Gemini 未接受图文验证请求。", RESPONSE_EXTRACTION: "连接失败：无法读取 Gemini 返回内容。", EMPTY_RESPONSE: "连接失败：Gemini 返回了空内容。", SMOKE_MISMATCH: "连接失败：模型未正确读取测试图片。", credential: "连接失败：请检查 DeepSeek 凭据。", transport: "连接失败：无法访问 DeepSeek。", provider: "连接失败：DeepSeek 暂时不可用。", model: "连接失败：该模型当前不可用。", capability: "该模型不符合图片和 PDF 接入要求。", protocol: "该模型的连接协议尚未确认。", unexpected_response: "连接失败：服务返回异常。" }[layer] || "连接失败：请重试。";
}

function isVerifiedRuntimeModel(model) {
  return ["deepseek", "codex"].includes(model?.provider_id) && model.runtime_capability_basis === "adapter_verified"
    && window.AriadneRuntimeExecution.isEligibleModelDescriptor(model);
}

function selectVerifiedRuntimeModel(model, provider = "deepseek") {
  const descriptor = selectableModels().find((item) => item.provider_id === provider && item.model_id === model);
  applyReadyModel(descriptor);
  closeMenu(); render();
}

function applyReadyModel(model, shouldPersist = true) {
  if (!model || !window.JobRadarRuntimeGate?.isModelRuntimeEligible({ mode: "model", provider: model.provider_id, model: model.model_id })) {
    state.phase = "FAILED";
    setMessage("当前模型不符合图片和 PDF 接入要求，或尚未完成 Ariadne 适配验证。请重新选择模型。", true);
    return false;
  }
  state.mode = "ai";
  state.provider = model.provider_id;
  state.model = model.model_id;
  if (model.connection_verified) {
    state.phase = "READY";
    state.diagnostics = { purpose: "MULTIMODAL_CONNECTION_TEST", provider: model.provider_id, model: model.model_id, provider_name: model.provider_name, multimodal_connection_ready: true, structured_output_verified: false, career_data_sent: false };
  } else if (isVerifiedRuntimeModel(model)) {
    state.phase = "OFFICIAL_READY";
    state.diagnostics = { purpose: "OFFICIAL_MODEL_CAPABILITY", capability_basis: "official_contract", multimodal_connection_ready: false, structured_output_verified: false, career_data_sent: false, network_call_made: false };
  } else {
    state.phase = "IDLE";
    state.diagnostics = null;
    return false;
  }
  setMessage("");
  if (shouldPersist) persistSelectedRuntime();
  return true;
}

async function checkModel(model) {
  state.mode = "ai"; state.provider = "deepseek"; state.model = model; state.phase = "CHECKING"; state.diagnostics = null;
  setMessage(""); render(); closeMenu();
  try {
    const response = await (globalThis.AriadneConnector || globalThis).fetch("/api/runtime-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model }) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || "runtime_check_failed"), { result });
    if (!result.diagnostics?.multimodal_connection_ready
      || !window.JobRadarRuntimeGate?.isModelRuntimeEligible({ mode: "model", provider: result.provider, model: result.model })) {
      throw Object.assign(new Error("runtime_requires_image_and_pdf"), { result: { failure_layer: "capability" } });
    }
    state.phase = "READY"; state.diagnostics = result.diagnostics || null;
    sessionStorage.setItem("job-radar-runtime-check", JSON.stringify({ ...state.diagnostics, provider: result.provider, model: result.model }));
    persistSelectedRuntime();
    setMessage("");
  } catch (error) {
    state.phase = "FAILED";
    setMessage(failureCopy(error.result?.failure_layer), true);
  }
  render();
}

function renderModels() {
  const container = byId("runtime-model-options");
  container.replaceChildren();
  selectableModels().forEach((model, index) => {
    const button = document.createElement("button");
    const title = document.createElement("span");
    const detail = document.createElement("small");
    button.className = "runtime-menu-item runtime-existing-model";
    button.type = "button"; button.setAttribute("role", "option"); button.setAttribute("aria-selected", "false"); button.dataset.model = model.model_id; button.dataset.provider = model.provider_id; button.style.setProperty("--runtime-menu-index", String(index));
    title.textContent = labelFor(model);
    detail.textContent = "图片 / PDF 导入 · 职位 / 候选人对话";
    button.append(title, detail); container.append(button);
  });
  document.querySelectorAll(".runtime-existing-model").forEach((button) => button.addEventListener("click", () => {
    const model = selectableModels().find((item) => item.model_id === button.dataset.model && item.provider_id === button.dataset.provider);
    if (isVerifiedRuntimeModel(model)) selectVerifiedRuntimeModel(button.dataset.model, button.dataset.provider);
    else if (model?.connection_verified) selectAddedMultimodalModel(model);
    else checkModel(button.dataset.model);
  }));
}

function applyLocalPreference(preference) {
  const descriptor = window.AriadneModelSettings?.descriptor(preference?.provider, preference?.model);
  if (!["127.0.0.1", "localhost"].includes(location.hostname) || !descriptor || preference?.id !== descriptor.connection_id) return;
  // An explicit in-app default takes precedence over a first-visit machine hint.
  if (readLocalJson("ariadne-model-selection-v2", null)) return;
  const key = "ariadne-applied-local-runtime-preference";
  if (readLocalJson(key, null) === preference.id) return;
  const model = selectableModels().find((item) => item.provider_id === preference.provider && item.model_id === preference.model);
  if (model && applyReadyModel(model)) writeLocalJson(key, preference.id);
}

async function loadModels() {
  try {
    const response = await (globalThis.AriadneConnector || globalThis).fetch("/api/runtime-options");
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || "runtime_options_failed"), { result });
    state.models = result.models || [];
    applyLocalPreference(result.local_preference);
    if (!(["READY", "OFFICIAL_READY", "LOCAL_READY"].includes(state.phase) && (state.model || state.mode === "local"))) {
      const restoredModel = selectableModels().find((model) => model.provider_id === state.provider && model.model_id === state.model);
      if (state.mode === "ai") applyReadyModel(restoredModel, false);
    }
    renderModels(); render();
  } catch (_error) {
    // DeepSeek discovery is optional to V1. Gemini remains usable even without a local keychain entry.
    state.models = []; renderModels();
    if (!state.model) byId("runtime-selected").textContent = "选择运行方式";
  }
}

function selectAddedMultimodalModel(model) {
  applyReadyModel(model); closeMenu(); render();
}

function restoreAddedModels() {
  let models = readLocalJson(ADDED_MODELS_STORAGE_KEY, []);
  if (!Array.isArray(models) || !models.length) {
    try { models = JSON.parse(sessionStorage.getItem(ADDED_MODELS_STORAGE_KEY) || "[]"); }
    catch (_error) { models = []; }
  }
  if (!Array.isArray(models)) models = [];
  state.addedModels = models.filter((model) => model && typeof model.provider_id === "string" && typeof model.model_id === "string" && model.connection_verified === true);
  // Keep original stored entries, including now-ineligible models, for history.
}

function restoreSelectedRuntime() {
  const saved = readLocalJson(SELECTED_RUNTIME_STORAGE_KEY, null);
  if (!saved || !["ai", "model", "local"].includes(saved.mode)) return;
  if (saved.mode === "local") {
    state.mode = "local"; state.provider = "local"; state.model = null; state.phase = "LOCAL_READY";
    state.diagnostics = { purpose: "LOCAL_RUNTIME", career_data_sent: false, network_call_made: false };
    return;
  }
  if (typeof saved.provider !== "string" || typeof saved.model !== "string") return;
  state.mode = "ai"; state.provider = saved.provider; state.model = window.AriadneModelSettings?.currentModel(saved.provider, saved.model) || saved.model;
  const added = state.addedModels.find((model) => model.provider_id === saved.provider && model.model_id === state.model);
  if (added) applyReadyModel(added, false);
}

byId("runtime-selector").addEventListener("click", () => {
  if (byId("runtime-menu").classList.contains("is-open")) closeMenu(); else openMenu();
});
byId("runtime-local").addEventListener("click", () => {
  state.mode = "local"; state.provider = "local"; state.model = null; state.phase = "LOCAL_READY"; state.diagnostics = { purpose: "LOCAL_RUNTIME", career_data_sent: false, network_call_made: false };
  persistSelectedRuntime(); setMessage(""); render(); closeMenu();
});
let codexLinkPending = false;
const addModelSheet = window.JobRadarAddModelSheet.mount({
  sheet: byId("add-model-sheet"), panel: byId("add-model-panel"), backdrop: byId("add-model-backdrop"), close: byId("add-model-close"),
  provider: byId("add-model-provider"), "provider-value": byId("add-model-provider-value"), "provider-menu": byId("add-model-provider-menu"),
  key: byId("add-model-key"), clear: byId("add-model-clear"), "key-link": byId("add-model-key-link"), connect: byId("add-model-connect"),
  status: byId("add-model-status"), "models-section": byId("add-model-models-section"), "model-list": byId("add-model-model-list"),
}, ({ providerId, providerName, model }) => {
  const connected = { provider_id: providerId, provider_name: providerName, model_id: model.id, display_name: `${providerName} · ${model.id}`, connection_verified: true, multimodal_readiness: "VERIFIED" };
  state.addedModels = [connected, ...state.addedModels.filter((item) => !(item.provider_id === providerId && item.model_id === model.id))];
  writeLocalJson(ADDED_MODELS_STORAGE_KEY, state.addedModels);
  renderModels(); selectAddedMultimodalModel(connected);
}, () => {
  if (codexLinkPending) { codexLinkPending = false; window.AriadneCodexConnect.open(byId("runtime-selector")); }
  else openMenu();
});
byId("runtime-connect-codex").addEventListener("click", (event) => {
  event.preventDefault();
  window.AriadneCodexConnect.open(byId("runtime-selector"));
  closeMenu();
});
byId("add-model-codex-link").addEventListener("click", (event) => {
  event.preventDefault(); codexLinkPending = true; byId("add-model-close").click();
});
window.addEventListener("ariadne-codex-connected", (event) => {
  state.models = event.detail.models;
  renderModels();
  const selected = event.detail.selected;
  if (selected) selectVerifiedRuntimeModel(selected.model, selected.provider);
});
byId("runtime-add-model").addEventListener("click", () => {
  const originRect = byId("runtime-add-model").getBoundingClientRect();
  const returnRect = byId("runtime-selector").getBoundingClientRect();
  closeMenu();
  addModelSheet.open(originRect, returnRect);
});
window.addEventListener("pageshow", (event) => {
  document.body.classList.remove("runtime-page-leaving");
  if (!event.persisted) return;
  document.body.style.animation = "none";
  void document.body.offsetWidth;
  document.body.style.animation = "";
  render();
});

byId("runtime-action").addEventListener("click", () => {
  if (state.phase === "READY" || state.phase === "OFFICIAL_READY" || state.phase === "LOCAL_READY") navigateWithPageTransition("/workspace.html", byId("runtime-action"));
});
document.addEventListener("click", (event) => { if (!event.target.closest(".runtime-control")) closeMenu(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

function restoreGeminiReadyState() {
  try {
    const diagnostics = JSON.parse(sessionStorage.getItem("job-radar-runtime-check") || "null");
    if (!state.model && diagnostics?.provider === "gemini" && diagnostics?.multimodal_connection_ready && diagnostics?.normalized_text
      && window.JobRadarRuntimeGate?.isModelRuntimeEligible({ mode: "model", provider: diagnostics.provider, model: diagnostics.model })) {
      state.mode = "ai"; state.provider = "gemini"; state.model = diagnostics.model; state.phase = "READY"; state.diagnostics = diagnostics;
      persistSelectedRuntime(); render();
    }
  } catch { sessionStorage.removeItem("job-radar-runtime-check"); }
}

restoreAddedModels();
restoreSelectedRuntime();
restoreGeminiReadyState();
render();
loadModels();
