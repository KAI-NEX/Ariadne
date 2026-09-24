import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const T = require("../public/conversation-turn-transport.js");
const enc = new TextEncoder();
function response(events, close = true) {
  let controller;
  const stream = new ReadableStream({ start(c) { controller = c; } });
  for (const event of events) {
    const data = enc.encode(JSON.stringify(event) + "\n");
    // Deliberately split every multibyte Chinese character.
    for (const byte of data) controller.enqueue(new Uint8Array([byte]));
  }
  if (close) controller.close();
  return [new Response(stream, { headers: { "Content-Type": T.STREAM } }), controller];
}
const preview = { seq: 1, type: "preview", text: "初步公开结论；未核验。" };
const result = { seq: 2, type: "result", status: 200, result: { output: "complete" } };
const [r, controller] = response([preview], false);
const seen = [];
let settled = false;
const promise = T.readStream(r, event => seen.push(event)).then(value => { settled = true; return value; });
await new Promise(resolve => setTimeout(resolve, 20));
assert.deepEqual(seen, [preview]); assert.equal(settled, false);
controller.enqueue(enc.encode(JSON.stringify(result) + "\n")); controller.close();
assert.deepEqual(await promise, result);
for (const events of [[preview], [preview, { ...result, seq: 3 }], [result], [preview, result, result], [{ seq: 1, type: "reasoning", text: "secret" }]]) {
  await assert.rejects(T.readStream(response(events)[0], () => {}));
}
const finishes = [];
globalThis.AriadneConversationAttachments = { prepare: async request => request, dispatch() {}, stage() {}, finish(_request, ok) { finishes.push(ok); } };
globalThis.AriadneTransport = { fetch: async () => response([preview, { ...result, status: 422, result: { error: "VALIDATION_FAILED" } }])[0] };
await assert.rejects(T.execute({ request: { request_id: "synthetic" }, domain: "JOB", endpoint: "/api/job-conversation-turn" }), /VALIDATION_FAILED/);
assert.deepEqual(finishes, [false]);
console.log("conversation_stream_regression=PASS: early UTF-8 preview, strict terminal/sequence, no reasoning, failure lifecycle");
