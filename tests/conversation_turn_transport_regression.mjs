import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Transport = require("../public/conversation-turn-transport.js");
const originalAttachments = globalThis.AriadneConversationAttachments;
const originalTransport = globalThis.AriadneTransport;

try {
  const events = [];
  globalThis.AriadneConversationAttachments = {
    async prepare(request, domain) { events.push(["prepare", request.request_id, domain]); return { ...request, attachments: { files: [1] } }; },
    stage(request, stage) { events.push(["stage", request.request_id, stage]); },
    dispatch(request) { events.push(["dispatch", request.request_id]); },
    finish(request, ok, error, result) { events.push(["finish", request.request_id, ok, error?.message || null, result?.answer || null]); },
  };
  globalThis.AriadneTransport = {
    async fetch(endpoint, options) {
      events.push(["fetch", endpoint, JSON.parse(options.body).attachments.files.length]);
      return { ok: true, async json() { return { answer: "ready" }; } };
    },
  };
  const request = { request_id: "turn-1", runtime_snapshot: { provider: "codex", model: "sol" } };
  assert.deepEqual(await Transport.execute({ request, domain: "JOB", endpoint: "/api/job-conversation-turn" }), { answer: "ready" });
  assert.deepEqual(events, [
    ["prepare", "turn-1", "JOB"],
    ["stage", "turn-1", "MODEL_REQUEST"],
    ["fetch", "/api/job-conversation-turn", 1],
    ["dispatch", "turn-1"],
    ["finish", "turn-1", true, null, "ready"],
  ]);

  events.length = 0;
  globalThis.AriadneTransport.fetch = async () => ({ ok: false, async json() { return { error: "provider_failed", failure_layer: "transport" }; } });
  await assert.rejects(
    Transport.execute({ request, domain: "JOB", endpoint: "/api/job-conversation-turn", fallback_error: "JOB_FAILED" }),
    (error) => error.code === "provider_failed" && error.failure_layer === "transport",
  );
  assert.deepEqual(events.slice(0, 3), [["prepare", "turn-1", "JOB"], ["stage", "turn-1", "MODEL_REQUEST"], ["dispatch", "turn-1"]]);
  assert.deepEqual(events.at(-1), ["finish", "turn-1", false, "provider_failed", null]);

  events.length = 0;
  globalThis.AriadneTransport.fetch = () => { throw new Error("fetch_not_created"); };
  await assert.rejects(
    Transport.execute({ request, domain: "JOB", endpoint: "/api/job-conversation-turn" }),
    /fetch_not_created/,
  );
  assert.equal(events.some(([event]) => event === "dispatch"), false, "composer dispatch requires a created request");
  assert.deepEqual(events.at(-1), ["finish", "turn-1", false, "fetch_not_created", null]);

  events.length = 0;
  globalThis.AriadneTransport.fetch = async (_endpoint, options) => {
    assert.equal("attachments" in JSON.parse(options.body), false);
    return { ok: true, async json() { return { answer: "no attachment" }; } };
  };
  await Transport.execute({ request, domain: "CANDIDATE", endpoint: "/api/candidate-conversation-turn", include_attachments: false });
  assert.equal(events.length, 0, "attachment lifecycle is bypassed only when explicitly requested");
} finally {
  if (originalAttachments === undefined) delete globalThis.AriadneConversationAttachments;
  else globalThis.AriadneConversationAttachments = originalAttachments;
  if (originalTransport === undefined) delete globalThis.AriadneTransport;
  else globalThis.AriadneTransport = originalTransport;
}

console.log("conversation_turn_transport_shared_lifecycle=PASS");
