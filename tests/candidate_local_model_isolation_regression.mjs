import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";

if (!globalThis.crypto) globalThis.crypto = crypto.webcrypto;
const require = createRequire(import.meta.url);
const Local = require("../public/local-candidate-extraction-domain.js");
const Integration = require("../public/candidate-workspace-conversation-runtime.js");

// One synthetic source may be shared, but its Local lifecycle never gains a Model call.
let providerCalls = 0;
const source = await Local.prepareSource(
  new File([new TextEncoder().encode("synthetic shared source")], "shared.txt", { type: "text/plain" }),
  "synthetic-cross-mode-batch", "Resume",
);
const localRun = Local.processingRunFor(source, "runtime-snapshot-local-isolation", "PENDING", "2026-09-04T00:00:00Z");
assert.equal(providerCalls, 0);
assert.equal(localRun.source_document_id, source.source_document_id);
assert.equal(localRun.status, "PENDING");

// The same source can identify a separate Model conversation boundary without changing Local records.
const modelSnapshot = Integration.createRuntimeSnapshot({ snapshot_id: "runtime-snapshot-model-isolation", captured_at: "2026-09-04T00:00:01Z" });
assert.equal(modelSnapshot.capabilities.ai_conversation, "supported");
assert.equal(Integration.candidateContextIdFor(source.source_document_id), `candidate-workspace-context-${source.source_document_id}`);
assert.equal(providerCalls, 0);
assert.notEqual(modelSnapshot.snapshot_id, localRun.runtime_snapshot_id);

console.log("candidate_local_model_isolation=pass");
