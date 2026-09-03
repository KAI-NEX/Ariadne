import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Truth = require("../public/truth-persistence-domain.js");
const Conversation = require("../public/candidate-conversation-domain.js");
const Persistence = require("../public/candidate-conversation-persistence-domain.js");
const Integration = require("../public/candidate-workspace-conversation-runtime.js");

function memoryDatabase() {
  const specs = new Map(Truth.STORE_SPECS.map((spec) => [spec.name, spec]));
  const records = new Map([...specs].map(([name]) => [name, new Map()]));
  return {
    records,
    close() {},
    transaction(storeNames) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      const staged = new Map(names.map((name) => [name, new Map(records.get(name))]));
      let completionQueued = false;
      let aborted = false;
      const tx = {
        abort() {
          if (aborted) return;
          aborted = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore(name) {
          const spec = specs.get(name);
          assert(spec, `unknown synthetic memory store ${name}`);
          const values = staged.get(name);
          const scheduleComplete = () => {
            if (completionQueued) return;
            completionQueued = true;
            queueMicrotask(() => {
              if (aborted) return;
              names.forEach((storeName) => records.set(storeName, staged.get(storeName)));
              tx.oncomplete?.();
            });
          };
          return {
            add(value) {
              const key = value[spec.keyPath];
              if (values.has(key)) throw new Error("ConstraintError");
              values.set(key, structuredClone(value));
              scheduleComplete();
            },
            put(value) { values.set(value[spec.keyPath], structuredClone(value)); scheduleComplete(); },
            delete(key) { values.delete(key); scheduleComplete(); },
            get(key) {
              const request = {};
              queueMicrotask(() => {
                if (aborted) return;
                request.result = values.has(key) ? structuredClone(values.get(key)) : undefined;
                request.onsuccess?.();
              });
              return request;
            },
            getAll() {
              const request = {};
              queueMicrotask(() => {
                if (aborted) return;
                request.result = [...values.values()].map((value) => structuredClone(value));
                request.onsuccess?.();
              });
              return request;
            },
          };
        },
      };
      return tx;
    },
  };
}

let sequence = 0;
const idFactory = (prefix) => `${prefix}-synthetic-${++sequence}`;
const now = () => new Date(1788423000000 + (++sequence * 1000));

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function fingerprint(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

const initialPayload = {
  contract_id: "ariadne-candidate-working-payload-v1",
  material_type: "resume",
  items: [
    {
      item_id: "synthetic-education-rca", item_type: "EDUCATION", item_subtype: "education",
      title: "Royal College of Art RCA", subtitle: "Synthetic Programme A", time: "2024",
      summary: "Synthetic education A.", ownership: null,
      facts: [{ fact_id: "synthetic-fact-a", label: "Degree", value: "Synthetic Degree A" }],
      grounding_refs: [{ grounding_ref_id: "synthetic-ground-a", source_document_id: "source-synthetic-workspace-conversation", location: "synthetic:1", excerpt_or_reference: "Synthetic evidence A." }],
      uncertainties: [], review_status: "NEEDS_REVIEW", item_version: 1, content_origin: "MODEL_PROPOSAL",
    },
    {
      item_id: "synthetic-education-exchange", item_type: "EDUCATION", item_subtype: "education",
      title: "Service Design Exchange — RCA", subtitle: "Synthetic Programme B", time: "2025",
      summary: "Synthetic education B.", ownership: null,
      facts: [{ fact_id: "synthetic-fact-b", label: "Course", value: "Synthetic Course B" }],
      grounding_refs: [{ grounding_ref_id: "synthetic-ground-b", source_document_id: "source-synthetic-workspace-conversation", location: "synthetic:2", excerpt_or_reference: "Synthetic evidence B." }],
      uncertainties: [], review_status: "NEEDS_REVIEW", item_version: 1, content_origin: "MODEL_PROPOSAL",
    },
  ],
};

const initialWorking = Truth.validateCandidateWorkingModel({
  contract_id: "ariadne-candidate-working-model-v1",
  working_model_id: "synthetic-workspace-working-v1",
  source_document_id: "source-synthetic-workspace-conversation",
  processing_run_id: "run-synthetic-workspace-conversation",
  runtime_snapshot_id: "runtime-snapshot-synthetic-source",
  proposal_ids: ["proposal-synthetic-workspace-conversation"],
  version: 1,
  previous_working_model_id: null,
  fingerprint: await fingerprint(initialPayload),
  created_at: "2026-09-03T08:00:00Z",
  payload: initialPayload,
  authority: Truth.AUTHORITY.working,
});

function snapshot() {
  return Integration.createRuntimeSnapshot({ snapshot_id: idFactory("runtime-snapshot-conversation"), captured_at: now() });
}

function runtimeResult(request, action) {
  return {
    contract_id: Integration.RESULT_CONTRACT,
    execution_id: request.turn.execution_id,
    generation: request.turn.generation,
    conversation_id: request.conversation.conversation_id,
    operation: Conversation.OPERATION,
    provider: Integration.PROVIDER,
    model: Integration.MODEL,
    protocol: Integration.PROTOCOL,
    runtime_snapshot_id: request.runtime_snapshot.snapshot_id,
    finish_reason: "stop",
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    action,
    authority: "NON_AUTHORITATIVE_WORKING_ACTION",
    network_call_made: true,
    persistence: "not_written",
  };
}

const noPatches = (request, action, message, clarification = null) => runtimeResult(request, {
  contract_id: Conversation.ACTION_CONTRACT_ID,
  action,
  message,
  observed_working_model: Conversation.observedWorkingModel(request.observation),
  patches: [],
  clarification,
});

const database = memoryDatabase();
database.records.get("candidate_working_models").set(initialWorking.working_model_id, structuredClone(initialWorking));
database.records.get("source_documents").set(initialWorking.source_document_id, { source_document_id: initialWorking.source_document_id });
const session = await Integration.resolveSession(database, initialWorking.source_document_id, "2026-09-03T08:01:00Z");
assert.equal(session.subject_id, Integration.candidateContextIdFor(initialWorking.source_document_id));

// A — one list-root PATCH_ITEM produces a durable new Working head and Assistant.
const patchOne = await Integration.executeListTurn({
  database, session, human_message: "RCA 不要重复。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => runtimeResult(request, {
    contract_id: Conversation.ACTION_CONTRACT_ID,
    action: "PATCH_ITEM",
    message: "已更新这条 Candidate Working 信息。",
    observed_working_model: Conversation.observedWorkingModel(request.observation),
    patches: [{ target_item_id: "synthetic-education-rca", operations: [{ operation: "SET_ITEM_FIELD", field: "title", value: "Royal College of Art" }], reason: "Remove a synthetic duplicate abbreviation.", origin: "MODEL_PROPOSAL", evidence_refs: [] }],
    clarification: null,
  }),
});
assert.equal(patchOne.status, "SUCCEEDED");
assert.equal(patchOne.turn.state, "APPLIED");
assert.equal(patchOne.working_model.version, 2);
assert.equal(patchOne.working_model.payload.items[0].title, "Royal College of Art");
assert.equal(patchOne.working_model.authority, Truth.AUTHORITY.working);

// B — explicit multi intent permits one atomic two-item Working update.
const patchMulti = await Integration.executeListTurn({
  database, session, human_message: "把所有教育经历里的 Synthetic 统一为 Example。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => runtimeResult(request, {
    contract_id: Conversation.ACTION_CONTRACT_ID,
    action: "PATCH_MULTIPLE_ITEMS",
    message: "已统一更新两条 Candidate Working 信息。",
    observed_working_model: Conversation.observedWorkingModel(request.observation),
    patches: request.working_model.payload.items.map((item) => ({ target_item_id: item.item_id, operations: [{ operation: "SET_ITEM_FIELD", field: "subtitle", value: item.item_id.endsWith("rca") ? "Example Programme A" : "Example Programme B" }], reason: "Explicit synthetic multi edit.", origin: "MODEL_PROPOSAL", evidence_refs: [] })),
    clarification: null,
  }),
});
assert.equal(patchMulti.turn.state, "APPLIED");
assert.equal(patchMulti.working_model.version, 3);
assert.deepEqual(patchMulti.working_model.payload.items.map((item) => item.subtitle), ["Example Programme A", "Example Programme B"]);

// C/D — clarification and explanation add durable Assistant turns with zero mutation.
const clarify = await Integration.executeListTurn({
  database, session, human_message: "把这段时间改成 2026 年 4 月。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "ASK_CLARIFICATION", "", "你指的是哪一条 synthetic 教育经历？"),
});
assert.equal(clarify.turn.state, "NEEDS_CLARIFICATION");
assert.equal(clarify.working_model.working_model_id, patchMulti.working_model.working_model_id);

const explain = await Integration.executeListTurn({
  database, session, human_message: "为什么这两张卡片没有合并？", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "EXPLAIN", "它们是两条不同的 synthetic 教育经历，因此保持分开。"),
});
assert.equal(explain.turn.state, "NO_CHANGE");
assert.equal(explain.working_model.working_model_id, patchMulti.working_model.working_model_id);

const noChange = await Integration.executeListTurn({
  database, session, human_message: "保持现在的内容。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "NO_CHANGE", "Candidate Working 信息未发生变化。"),
});
assert.equal(noChange.turn.state, "NO_CHANGE");

// E — Provider failure retains USER, writes FAILED Turn, and creates no Assistant/action/mutation.
const beforeFailureHead = await Integration.latestWorkingModel(database, initialWorking.source_document_id);
let userPersistedBeforeFailure = false;
await assert.rejects(Integration.executeListTurn({
  database, session, human_message: "Synthetic provider failure request.", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  on_user_persisted: () => { userPersistedBeforeFailure = true; },
  call_runtime: async () => { throw Object.assign(new Error("PROVIDER_TRANSPORT_ERROR"), { code: "PROVIDER_TRANSPORT_ERROR" }); },
}), (error) => error.code === "PROVIDER_TRANSPORT_ERROR");
assert.equal(userPersistedBeforeFailure, true);
const afterFailureHead = await Integration.latestWorkingModel(database, initialWorking.source_document_id);
assert.equal(afterFailureHead.working_model_id, beforeFailureHead.working_model_id);

// Stale — a concurrent durable head wins; the old response produces no Assistant/action.
const staleOutcome = await Integration.executeListTurn({
  database, session, human_message: "把第一条标题改成过时结果。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    const concurrentAction = {
      contract_id: Conversation.ACTION_CONTRACT_ID,
      action: "PATCH_ITEM",
      message: "Synthetic concurrent update.",
      observed_working_model: Conversation.observedWorkingModel(request.observation),
      patches: [{ target_item_id: "synthetic-education-rca", operations: [{ operation: "SET_ITEM_FIELD", field: "title", value: "Concurrent Durable Title" }], reason: "Synthetic concurrent edit.", origin: "MODEL_PROPOSAL", evidence_refs: [] }],
      clarification: null,
    };
    const concurrent = await Conversation.applyAction({ action: concurrentAction, observation: request.observation, session: request.conversation, current_working_model: request.working_model, human_message: "把第一条标题改成 Concurrent Durable Title。", created_at: now() });
    await Truth.persistCandidateWorkingModel(database, concurrent.working_model);
    return runtimeResult(request, {
      ...concurrentAction,
      message: "This stale result must not persist.",
      patches: [{ ...concurrentAction.patches[0], operations: [{ operation: "SET_ITEM_FIELD", field: "title", value: "Stale Title" }] }],
    });
  },
});
assert.equal(staleOutcome.status, "STALE");
assert.equal(staleOutcome.turn.state, "STALE");
assert.equal(staleOutcome.working_model.payload.items[0].title, "Concurrent Durable Title");

// F — reopen resolves the identical session and durable history in order.
const reopenedSession = await Integration.resolveSession(database, initialWorking.source_document_id, "2026-09-03T09:00:00Z");
assert.equal(reopenedSession.conversation_id, session.conversation_id);
const restored = await Persistence.restoreConversation(database, session.conversation_id);
assert.equal(restored.messages.filter((message) => message.role === "USER").length, 7);
assert.equal(restored.messages.filter((message) => message.role === "ASSISTANT").length, 5);
assert.equal(restored.turns.find((turn) => turn.state === "FAILED")?.failure_code, "PROVIDER_TRANSPORT_ERROR");
assert(restored.turns.some((turn) => turn.state === "STALE"));
assert(!restored.actions.some((action) => action.normalized_action.message === "This stale result must not persist."));
assert.equal((await Integration.latestWorkingModel(database, initialWorking.source_document_id)).payload.items[0].title, "Concurrent Durable Title");

// UI wiring evidence: list root uses the integration function; deterministic helper remains Detail-only.
const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
const rootSubmitBody = pages.match(/async function submitCandidateWorkspaceConversation\(content\) \{([\s\S]*?)\n  \}\n\n  function returnToCandidateCardList/)?.[1] || "";
assert(rootSubmitBody.includes("CandidateWorkspaceConversationRuntime.executeListTurn"));
assert(!rootSubmitBody.includes("applyCandidateWorkspaceCorrection"));
assert.match(pages, /if \(activeCandidateWorkspaceItemId\) applyCandidateWorkspaceCorrection\(content\)[\s\S]*else submitCandidateWorkspaceConversation\(content\)/);
assert.match(rootSubmitBody, /workspaceViewIsCurrent\(viewGeneration\)/);
assert.match(rootSubmitBody, /candidateWorkingGroupsMarkup\(durableHead\.payload\.items/);
assert.match(pages, /candidateConversationTurnActive/);

const html = fs.readFileSync(path.join(root, "public", "personal-import.html"), "utf8");
assert.match(html, /candidate-conversation-contract-manifest\.js/);
assert.match(html, /candidate-conversation-domain\.js/);
assert(html.indexOf("candidate-conversation-contract-manifest.js") < html.indexOf("candidate-conversation-domain.js"));
assert.match(html, /candidate-conversation-persistence-domain\.js/);
assert.match(html, /candidate-conversation-context-compiler\.js/);
assert.match(html, /candidate-workspace-conversation-runtime\.js/);

console.log("candidate_workspace_conversation_integration=pass");
