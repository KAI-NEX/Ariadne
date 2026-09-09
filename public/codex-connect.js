"use strict";

(function attachCodexConnect(root) {
  const byId = (id) => document.getElementById(id);
  const sheet = byId("codex-connect-sheet");
  const panel = byId("codex-connect-panel");
  const more = byId("codex-more-dialog");
  const input = byId("codex-pairing-code");
  const button = byId("codex-connect");
  const message = byId("codex-connect-message");
  const disconnect = byId("codex-disconnect");
  const background = sheet ? document.querySelector("main") : null;
  const controls = panel && root.JobRadarFloatingWindow?.mount(panel, {
    dragHandle: panel.querySelector(".add-model-header"), minWidth: 420, minHeight: 430, margin: 10,
  });
  let opened = !sheet;
  let busy = false;
  let generation = 0;
  let origin = null;
  let animation = null;

  function render() {
    button.disabled = busy || !input.value.trim();
    button.textContent = busy ? "正在连接本机…" : "同意连接本地 Codex";
    button.setAttribute("aria-busy", String(busy));
    input.disabled = busy;
    disconnect.classList.toggle("hidden", busy || !root.AriadneConnector.connected());
  }
  function open(trigger) {
    if (!sheet) return;
    animation?.cancel(); animation = null;
    controls?.reset(); origin = trigger; opened = true;
    sheet.classList.remove("hidden", "is-closing");
    sheet.setAttribute("aria-hidden", "false");
    panel.classList.remove("is-close-ready");
    const rect = trigger.getBoundingClientRect();
    panel.style.setProperty("--add-model-origin-x", `${rect.left + rect.width / 2 - innerWidth / 2}px`);
    panel.style.setProperty("--add-model-origin-y", `${rect.top + rect.height / 2 - innerHeight / 2}px`);
    background.inert = true;
    message.textContent = root.AriadneConnector.connected() ? "本标签页已保存配对信息；连接器需要保持运行。" : "";
    render(); input.focus();
    requestAnimationFrame(() => {
      if (!opened) return;
      const height = panel.querySelector(".add-model-header").offsetHeight + byId("codex-connect-form").scrollHeight + panel.querySelector(".add-model-footer").offsetHeight + 2;
      panel.style.setProperty("--add-model-sheet-height", `${height}px`);
    });
  }
  function close() {
    if (!sheet || !opened) return;
    more?.close();
    opened = false; generation += 1; input.value = "";
    const current = panel.getBoundingClientRect();
    const destination = origin.getBoundingClientRect();
    panel.classList.add("is-close-ready");
    sheet.classList.add("is-closing");
    background.inert = false; origin.focus({ preventScroll: true });
    sheet.setAttribute("aria-hidden", "true");
    const finish = () => {
      if (opened) return;
      sheet.classList.add("hidden"); sheet.classList.remove("is-closing");
      animation?.cancel(); animation = null; controls?.reset();
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    const dx = destination.left + destination.width / 2 - current.left - current.width / 2;
    const dy = destination.top + destination.height / 2 - current.top - current.height / 2;
    Object.assign(panel.style, { left: `${current.left}px`, top: `${current.top}px`, width: `${current.width}px`, height: `${current.height}px`, transform: "none" });
    animation = panel.animate([{ transform: "none", opacity: 1 }, {
      transform: `translate(${dx}px, ${dy}px) scale(${destination.width / current.width}, ${destination.height / current.height})`, opacity: 0,
    }], { duration: 400, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
    animation.finished.then(finish).catch(() => {});
  }
  byId("codex-connect-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (busy || !opened || !code) return;
    const attempt = ++generation;
    input.value = ""; busy = true; message.textContent = "正在连接本机…"; render();
    try {
      await root.AriadneConnector.pair(code);
      if (attempt !== generation) { await root.AriadneConnector.disconnect(); return; }
      const response = await root.AriadneConnector.fetch("/api/runtime-options");
      const result = await response.json();
      if (attempt !== generation) { await root.AriadneConnector.disconnect(); return; }
      if (!response.ok || !result.models?.some((model) => model.provider_id === "codex" && model.model_id === "gpt-5.6-sol"
        && root.JobRadarRuntimeGate.isModelRuntimeEligible({ mode: "model", provider: model.provider_id, model: model.model_id }))) throw new Error("CODEX_UNAVAILABLE");
      const selected = { mode: "ai", provider: "codex", model: "gpt-5.6-sol" };
      localStorage.setItem("job-radar-selected-runtime", JSON.stringify(selected));
      root.JobRadarRuntimeGate.recordOperationRuntimeSelection(selected);
      if (sheet) { root.dispatchEvent(new CustomEvent("ariadne-codex-connected", { detail: result })); close(); }
      else location.assign("/");
    } catch (_) {
      if (attempt === generation) message.textContent = "连接未完成。请检查连接器、配对码及浏览器的本地网络访问权限。没有调用模型。";
    } finally { busy = false; render(); }
  });
  input.addEventListener("input", render);
  disconnect.addEventListener("click", async (event) => {
    event.preventDefault();
    if (busy) return;
    try { await root.AriadneConnector.disconnect(); }
    catch (_) { /* Stopped connectors have already revoked their sessions. */ }
    message.textContent = "已断开本页连接。要撤销所有页面的访问，请停止本机连接器。";
    render();
  });
  if (more) {
    byId("codex-more-link").addEventListener("click", (event) => { event.preventDefault(); more.showModal(); });
    byId("codex-more-close").addEventListener("click", () => more.close());
    more.addEventListener("click", (event) => {
      const rect = more.getBoundingClientRect();
      if (event.target === more && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) more.close();
    });
  }
  if (sheet) {
    byId("codex-connect-close").addEventListener("click", close);
    byId("codex-connect-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", (event) => {
      if (!opened || more?.open) return;
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const items = [...panel.querySelectorAll("button:not(:disabled), input:not(:disabled), a[href]")].filter((item) => item.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }
  root.AriadneCodexConnect = Object.freeze({ open });
  render();
}(globalThis));
