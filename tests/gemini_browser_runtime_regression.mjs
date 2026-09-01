import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "public", "gemini-browser-runtime.js"), "utf8");
const module = { exports: {} };
new Function("module", "exports", source)(module, module.exports);
const Runtime = module.exports;

const listing = { models: [
  { name: "models/gemini-3.7-flash", supportedGenerationMethods: ["generateContent"] },
  { name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] },
  { name: "models/gemini-3.7-flash-preview", supportedGenerationMethods: ["generateContent"] },
] };
assert.equal(Runtime.selectConnectionModel(listing), "gemini-3.1-flash-lite");
assert.equal(Runtime.selectConnectionModel({ models: [] }), null);
assert.equal(Runtime.knownMultimodalCandidates({ models: [{ name: "models/unknown-model", supportedGenerationMethods: ["generateContent"] }] }).length, 0);
const request = Runtime.buildConnectionRequest("gemini-3.1-flash-lite", "data:image/png;base64,ZmFrZQ==");
assert.equal(request.provider, "gemini");
assert.equal(request.protocol, "GEMINI_REST_GENERATE_CONTENT");
assert.match(request.endpoint, /models\/gemini-3\.1-flash-lite:generateContent$/);
assert.deepEqual(request.body, { contents: [{ role: "user", parts: [{ text: "Read the text in this image. Reply only with the text you see." }, { inlineData: { mimeType: "image/png", data: "ZmFrZQ==" } }] }], generationConfig: { maxOutputTokens: 32 } });
assert.deepEqual(Runtime.normalizeConnectionResponse({ candidates: [{ content: { parts: [{ text: "JOB RADAR TEST" }] } }] }), { ok: true, text: "JOB RADAR TEST" });
assert.deepEqual(Runtime.normalizeConnectionResponse({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }), { ok: false, failure_layer: "SMOKE_MISMATCH", text: "OK" });
assert.deepEqual(Runtime.normalizeConnectionResponse({ candidates: [] }), { ok: false, failure_layer: "EMPTY_RESPONSE", text: "" });
assert.equal(Runtime.failureLayer(403, {}, "inference"), "AUTH");
assert.equal(Runtime.failureLayer(404, {}, "inference"), "MODEL");
assert.equal(Runtime.failureLayer(400, {}, "inference"), "REQUEST");
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|console\.|\?key=/);
console.log("gemini_browser_runtime_contract=pass");
