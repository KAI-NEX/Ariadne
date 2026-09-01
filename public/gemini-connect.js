"use strict";

const GeminiRuntime = window.JobRadarGeminiBrowserRuntime;
const byId = (id) => document.getElementById(id);
// The implementation is deliberately armed only after a fresh action-time approval.
// This prevents a key entry from silently becoming a billable inference request.
const MULTIMODAL_SMOKE_APPROVED = false;
class RuntimeProbeError extends Error { constructor(layer) { super(layer); this.layer = layer; } }
function setMessage(message = "", failed = false) { const element = byId("gemini-connect-message"); element.textContent = message; element.classList.toggle("failed", failed); }
function failureCopy(layer) { return { AUTH: "连接失败：请检查 Gemini API Key。", CORS: "连接失败：浏览器无法直接访问 Gemini。", PROVIDER: "连接失败：Gemini 暂时不可用。", MODEL: "连接失败：当前账号没有可用的图文模型。", REQUEST: "连接失败：Gemini 未接受图文验证请求。", RESPONSE_EXTRACTION: "连接失败：无法读取 Gemini 返回内容。", EMPTY_RESPONSE: "连接失败：Gemini 返回了空内容。", SMOKE_MISMATCH: "连接失败：Gemini 未正确读取测试图片。" }[layer] || "连接失败：请重试。"; }
async function jsonOrEmpty(response) { try { return await response.json(); } catch { return {}; } }
function createSyntheticSmokeImageDataUrl() {
  const canvas = document.createElement("canvas"); canvas.width = 360; canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new RuntimeProbeError("REQUEST");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000000"; context.font = "bold 32px sans-serif"; context.textBaseline = "middle";
  context.fillText("JOB RADAR TEST", 20, 48);
  return canvas.toDataURL("image/png");
}
async function runGeminiBrowserSmoke(apiKey) {
  const discovery = await fetch(GeminiRuntime.MODELS_ENDPOINT, { method: "GET", mode: "cors", cache: "no-store", headers: { "x-goog-api-key": apiKey } });
  const listing = await jsonOrEmpty(discovery);
  if (!discovery.ok) throw new RuntimeProbeError(GeminiRuntime.failureLayer(discovery.status, listing, "model_discovery"));
  const model = GeminiRuntime.selectConnectionModel(listing);
  if (!model) throw new RuntimeProbeError("MODEL");
  const request = GeminiRuntime.buildConnectionRequest(model, createSyntheticSmokeImageDataUrl());
  const response = await fetch(request.endpoint, { method: "POST", mode: "cors", cache: "no-store", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(request.body) });
  const payload = await jsonOrEmpty(response);
  if (!response.ok) throw new RuntimeProbeError(GeminiRuntime.failureLayer(response.status, payload, "inference"));
  const normalized = GeminiRuntime.normalizeConnectionResponse(payload);
  if (!normalized.ok) throw new RuntimeProbeError(normalized.failure_layer);
  return { ...request, normalized };
}
async function connectGemini(event) {
  event.preventDefault(); const input = byId("gemini-api-key"); const apiKey = input.value.trim();
  if (!MULTIMODAL_SMOKE_APPROVED) { input.value = ""; setMessage("图文验证已准备完成，等待本次测试批准。", false); return; }
  if (!apiKey) { setMessage("请输入 Gemini API Key。", true); return; }
  const button = byId("gemini-connect"); button.disabled = true; button.classList.add("checking"); button.textContent = ""; input.value = ""; setMessage("");
  try {
    const result = await runGeminiBrowserSmoke(apiKey);
    sessionStorage.setItem("job-radar-runtime-check", JSON.stringify({ purpose: "MULTIMODAL_CONNECTION_TEST", provider: result.provider, model: result.model, protocol: result.protocol, endpoint: result.endpoint, normalized_text: result.normalized.text, multimodal_connection_ready: true, structured_output_verified: false, career_data_sent: false, key_storage: "memory_only", proxy_used: false }));
    window.location.assign("/");
  } catch (error) {
    button.disabled = false; button.classList.remove("checking"); button.textContent = "连接 Gemini"; setMessage(failureCopy(error instanceof RuntimeProbeError ? error.layer : "CORS"), true);
  }
}
byId("gemini-connect-form").addEventListener("submit", connectGemini);
