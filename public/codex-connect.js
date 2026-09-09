"use strict";

const codexMessage = document.getElementById("codex-connect-message");
if (AriadneConnector.connected()) codexMessage.textContent = "本标签页保存了配对信息；连接器需要保持运行。";
document.getElementById("codex-connect-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("codex-pairing-code");
  const button = document.getElementById("codex-connect");
  const code = input.value.trim(); input.value = "";
  if (!code) { codexMessage.textContent = "请输入本机终端显示的配对码。"; return; }
  button.disabled = true; codexMessage.textContent = "正在连接本机…";
  try {
    await AriadneConnector.pair(code);
    const response = await AriadneConnector.fetch("/api/runtime-options");
    const result = await response.json();
    if (!response.ok || !result.models?.some((model) => model.provider_id === "codex" && model.model_id === "gpt-5.6-sol")) throw new Error("CODEX_UNAVAILABLE");
    const selected = { mode: "ai", provider: "codex", model: "gpt-5.6-sol" };
    localStorage.setItem("job-radar-selected-runtime", JSON.stringify(selected));
    JobRadarRuntimeGate.recordOperationRuntimeSelection(selected);
    location.assign("/");
  } catch (_) {
    codexMessage.textContent = "连接未完成。请检查连接器是否运行、配对码是否有效，以及浏览器是否允许本地网络访问。没有调用模型。";
  } finally { button.disabled = false; }
});
document.getElementById("codex-disconnect").addEventListener("click", async () => {
  try { await AriadneConnector.disconnect(); }
  catch (_) { /* The local process may already be stopped. */ }
  codexMessage.textContent = "已断开本页连接。要撤销其他页面的访问，请停止本机连接器。";
});
