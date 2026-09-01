import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const probeDir = path.join(root, "tests", "web_provider");
const html = fs.readFileSync(path.join(probeDir, "browser-byok-probe.html"), "utf8");
const js = fs.readFileSync(path.join(probeDir, "browser-byok-probe.js"), "utf8");

assert.match(html, /Content-Security-Policy/);
assert.match(html, /script-src 'self'/);
assert.match(html, /connect-src https:\/\/api\.deepseek\.com https:\/\/generativelanguage\.googleapis\.com https:\/\/api\.openai\.com https:\/\/api\.anthropic\.com https:\/\/openrouter\.ai/);
assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|console\./);
assert.doesNotMatch(js, /\?key=|api[_-]?key=/i);
for (const provider of ["DeepSeek", "Gemini", "OpenAI", "Anthropic", "OpenRouter"]) assert.match(js, new RegExp(`provider: "${provider}"`));
assert.match(js, /method: "GET"/);
assert.match(js, /PROVIDER_HTTP_RESPONSE/);
assert.match(js, /CORS_OR_NETWORK_BLOCKED/);
assert.match(js, /inference: "none"/);

console.log("web_byok_harness_contract=pass");
