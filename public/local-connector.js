"use strict";

(function attach(root) {
  const BASE = "http://127.0.0.1:8765";
  const KEY = "ariadne-local-connector-session-v1";
  const nativeFetch = root.fetch.bind(root);
  const WEB_SESSION_KEY = "ariadne-web-api-session-v1";
  let webRuntimePromise;
  const localOrigin = () => ["localhost", "127.0.0.1", "[::1]"].includes(root.location.hostname);
  const apiProviders = ["deepseek", "gemini", "qwen"];
  function webSession() {
    let value = root.sessionStorage.getItem(WEB_SESSION_KEY);
    if (!/^[a-f0-9]{64}$/.test(value || "")) {
      value = (root.crypto.randomUUID() + root.crypto.randomUUID()).replaceAll("-", "");
      root.sessionStorage.setItem(WEB_SESSION_KEY, value);
    }
    return value;
  }
  async function webRuntime() {
    if (!webRuntimePromise) webRuntimePromise = nativeFetch("/api/web-runtime", { cache: "no-store", redirect: "error" })
      .then(async response => {
        const value = await response.json();
        if (!response.ok || value.mode !== "web" || !value.byok?.includes("deepseek")) throw new Error("WEB_API_RUNTIME_UNAVAILABLE");
        return value;
      }).catch(error => { webRuntimePromise = null; throw error; });
    return webRuntimePromise;
  }
  function session() {
    try { return JSON.parse(root.sessionStorage.getItem(KEY) || "null"); }
    catch (_) { throw new Error("CONNECTOR_SESSION_INVALID"); }
  }
  function clear() { root.sessionStorage.removeItem(KEY); }
  function errorCopy(error) {
    const code = String(error?.code || error?.message || error || "");
    return ({ WEB_API_RUNTIME_UNAVAILABLE: "网站的 API 服务暂不可用，请稍后重试或使用本地版。",
      WEB_PDF_SIZE_LIMIT: "网页预览版每份 PDF 最多 5 MB，更大的文件请使用本地版。",
      WEB_PDF_PAGE_LIMIT: "网页预览版每份 PDF 最多 16 页，更长的文件请使用本地版。",
      WEB_PDF_IMAGE_LIMIT: "这份 PDF 转图后超过网页预览容量，请使用本地版完整分析。",
      WEB_PDF_COUNT_LIMIT: "网页预览版一次最多处理 4 份 PDF，请减少本次附件。",
      WEB_PDF_PREPARATION_FAILED: "PDF 未能完整读取，请使用无密码且可正常打开的 PDF，或使用本地版。",
      WEB_PREVIEW_REQUEST_SIZE_LIMIT: "本次材料超过网页预览容量，请减少文件数量，或使用本地版。",
      WEB_OWN_API_KEY_REQUIRED: "请先在连接设置中填写并验证你自己的 API Key。",
      WEB_SERVICE_BUSY: "网站正在处理其他请求，请稍后手动重试。",
      WEB_SESSION_BUSY: "本页已有请求正在处理，请等待完成。",
      WEB_SESSION_OPERATION_LIMIT: "本次连接的处理次数已达上限，请稍后重新打开页面。",
      WEB_OPERATION_CONTENT_CONFLICT: "请求内容已变化，请重新确认材料后再分析。",
      WEB_RESULT_EXPIRED_REVIEW_BEFORE_RETRY: "这次分析已经执行，结果缓存已失效；请先核对已有结果，再决定是否重新付费分析。",
      WEB_SOURCE_PREPARATION_FAILED: "原件未能完整读取，请核对文件；复杂 Word 文档可导出为 PDF 后重试。",
      WEB_REQUEST_SIZE_INVALID: "网页版单次材料总量约限 30 MB，请减少本次文件数量后重试。",
      WEB_RUNTIME_NOT_ALLOWED: "网页版需要使用你自己验证过的 API 连接；Codex 请通过本机连接器使用。",
    })[code] || null;
  }
  async function apiFetch(input, options = {}) {
    const connection = session();
    const url = new URL(input, root.location.href);
    if (url.origin !== root.location.origin || !url.pathname.startsWith("/api/")) return nativeFetch(input, options);
    const operations = { "/api/candidate-conversation-turn": "candidate_conversation", "/api/job-conversation-turn": "job_conversation",
      "/api/personal-understanding-turn": "personal_understanding", "/api/job-overview-turn": "job_overview",
      "/api/candidate-model-structure": "candidate_import", "/api/job-model-structure": "job_model_import" };
    if (options.method === "POST" && operations[url.pathname] && root.AriadneRuntimeSelection) {
      const request = JSON.parse(options.body);
      if (request.runtime_snapshot?.mode === "model") {
        const declared = request.runtime_snapshot.operation?.toLowerCase();
        const operation = url.pathname.endsWith("model-structure") && root.JobRadarRuntimeGate?.OPERATION_CAPABILITIES[declared] ? declared : operations[url.pathname];
        await root.AriadneRuntimeSelection.beforeDispatch(request.runtime_snapshot, operation);
      }
    }
    let provider;
    try { provider = JSON.parse(options.body || "null")?.runtime_snapshot?.provider; }
    catch (_) { /* The domain endpoint owns malformed-request validation. */ }
    const checkProvider = /^\/api\/runtime-providers\/(deepseek|gemini|qwen)\/connection-check$/.exec(url.pathname)?.[1];
    const check = Boolean(checkProvider);
    if (check) provider = checkProvider;
    if (url.pathname === "/api/runtime-check") provider = "deepseek";
    if (!provider && ["/api/candidate-conversation-turn/cancel", "/api/candidate-model-operation-state/delete"].includes(url.pathname)) {
      try { provider = JSON.parse(root.localStorage.getItem("job-radar-selected-runtime") || "null")?.provider; }
      catch (_) { /* Keep the existing connector boundary when unavailable. */ }
    }
    if (!connection || apiProviders.includes(provider) || check) {
      // Closing a tab discards its pairing session but retains its selected
      // runtime. Never post a Codex request to a hosted server in that state.
      if (provider === "codex" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("CONNECTOR_PAIRING_REQUIRED");
      // Own keys go only to the selected same-origin execution service, never
      // to the local Codex connector or an unrelated URL.
      const ownKeyRoute = (apiProviders.includes(provider) && (operations[url.pathname] || url.pathname === "/api/local-source-read"))
        || ["/api/runtime-check", "/api/candidate-conversation-turn/cancel", "/api/candidate-model-operation-state/delete"].includes(url.pathname);
      if (ownKeyRoute || check) {
        const headers = new Headers(options.headers || {});
        if (!localOrigin()) {
          const service = await webRuntime();
          if (provider && !service.byok.includes(provider)) throw new Error("WEB_API_RUNTIME_UNAVAILABLE");
          if (service.pdf_preparation === "browser_pdfjs_complete_pages_v1" && options.method === "POST" && typeof options.body === "string") {
            const delivery = await import("/browser-pdf-delivery.js");
            options = await delivery.prepareRequest(url.pathname, options, service, nativeFetch);
          }
          if (typeof options.body === "string" && new Blob([options.body]).size > 41000000) throw new Error("WEB_REQUEST_SIZE_INVALID");
          headers.set("X-Ariadne-Web-Session", webSession());
        }
        let key;
        try { key = provider && root.localStorage.getItem(`job-radar-provider-api-key:${provider}`); }
        catch (_) { /* Existing local Keychain remains a supported credential source. */ }
        headers.delete("X-Ariadne-Provider-Key");
        if (provider) headers.set("X-Ariadne-Provider", provider);
        if (key && !check) headers.set("X-Ariadne-Provider-Key", key);
        options = { ...options, headers, redirect: "error" };
      }
      return nativeFetch(input, options);
    }
    // A saved but expired/offline connection must never send material to the
    // hosted backend as a fallback. Re-pair or explicitly disconnect instead.
    if (Date.now() >= connection.expires || typeof connection.token !== "string") throw new Error("CONNECTOR_PAIRING_REQUIRED");
    const headers = new Headers(options.headers || {});
    headers.set("X-Ariadne-Connector", connection.token);
    let response;
    try {
      response = await nativeFetch(BASE + url.pathname + url.search, { ...options, headers, mode: "cors", credentials: "omit", redirect: "error" });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error("CONNECTOR_UNREACHABLE");
    }
    if (response.status === 401) throw new Error("CONNECTOR_PAIRING_REQUIRED");
    return response;
  }
  async function pair(code) {
    const response = await nativeFetch(BASE + "/api/connector/pair", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", redirect: "error",
      body: JSON.stringify({ code }), signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok || typeof result.token !== "string" || result.expires_in !== 28800) throw new Error("CONNECTOR_PAIRING_FAILED");
    root.sessionStorage.setItem(KEY, JSON.stringify({ token: result.token, expires: Date.now() + result.expires_in * 1000 }));
  }
  async function disconnect() {
    const value = session();
    try {
      if (value) await nativeFetch(BASE + "/api/connector/revoke", {
        method: "POST", headers: { "X-Ariadne-Connector": value.token }, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(5000),
      });
    } finally { clear(); }
  }
  root.AriadneConnector = Object.freeze({ fetch: apiFetch, pair, disconnect, webRuntime, errorCopy, connected: () => Boolean(session()) });
}(globalThis));
