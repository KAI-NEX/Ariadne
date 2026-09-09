"use strict";

(function attach(root) {
  const BASE = "http://127.0.0.1:8765";
  const KEY = "ariadne-local-connector-session-v1";
  const nativeFetch = root.fetch.bind(root);
  function session() {
    try { return JSON.parse(root.sessionStorage.getItem(KEY) || "null"); }
    catch (_) { throw new Error("CONNECTOR_SESSION_INVALID"); }
  }
  function clear() { root.sessionStorage.removeItem(KEY); }
  async function apiFetch(input, options = {}) {
    const connection = session();
    const url = new URL(input, root.location.href);
    if (url.origin !== root.location.origin || !url.pathname.startsWith("/api/")) return nativeFetch(input, options);
    if (!connection) {
      // Closing a tab discards its pairing session but retains its selected
      // runtime. Never post a Codex request to a hosted server in that state.
      let provider;
      try { provider = JSON.parse(options.body || "null")?.runtime_snapshot?.provider; }
      catch (_) { /* The domain endpoint owns malformed-request validation. */ }
      if (provider === "codex" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("CONNECTOR_PAIRING_REQUIRED");
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
  root.AriadneConnector = Object.freeze({ fetch: apiFetch, pair, disconnect, connected: () => Boolean(session()) });
}(globalThis));
