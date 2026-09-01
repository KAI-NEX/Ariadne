"use strict";

const DUMMY_KEY = "job-radar-browser-byok-invalid";
const PROBES = [
  { provider: "DeepSeek", endpoint: "https://api.deepseek.com/models", headers: { Authorization: `Bearer ${DUMMY_KEY}` } },
  { provider: "Gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/models", headers: { "x-goog-api-key": DUMMY_KEY } },
  { provider: "OpenAI", endpoint: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${DUMMY_KEY}` } },
  { provider: "Anthropic", endpoint: "https://api.anthropic.com/v1/models?limit=1", headers: { "x-api-key": DUMMY_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } },
  { provider: "OpenRouter", endpoint: "https://openrouter.ai/api/v1/models", headers: { Authorization: `Bearer ${DUMMY_KEY}` } },
];

function redactedHeaders(headers) {
  return Object.keys(headers).sort();
}

async function probe({ provider, endpoint, headers }) {
  try {
    const response = await fetch(endpoint, { method: "GET", mode: "cors", cache: "no-store", headers });
    return {
      provider,
      endpoint,
      sent_header_names: redactedHeaders(headers),
      outcome: "PROVIDER_HTTP_RESPONSE",
      status: response.status,
      cors_allow_origin: response.headers.get("access-control-allow-origin") || "not_exposed",
    };
  } catch (error) {
    return {
      provider,
      endpoint,
      sent_header_names: redactedHeaders(headers),
      outcome: "CORS_OR_NETWORK_BLOCKED",
      error_name: error?.name || "Error",
      error_message: "browser fetch rejected before a readable provider response",
    };
  }
}

async function runProbes() {
  const button = document.getElementById("run-probes");
  const results = document.getElementById("results");
  button.disabled = true;
  results.textContent = "Running provider transport probes…";
  const output = await Promise.all(PROBES.map(probe));
  results.textContent = JSON.stringify({ browser_origin: window.location.origin, persistence: "none", inference: "none", results: output }, null, 2);
  button.disabled = false;
}

document.getElementById("run-probes").addEventListener("click", runProbes);
