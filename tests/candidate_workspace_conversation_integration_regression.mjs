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
const CandidateModel = require("../public/candidate-model-runtime-domain.js");
const Review = require("../public/local-candidate-review-domain.js");
const JobCandidateContext = require("../public/job-candidate-context-domain.js");

function memoryDatabase() {
  const specs = new Map(Truth.STORE_SPECS.map((spec) => [spec.name, spec]));
  const records = new Map([...specs].map(([name]) => [name, new Map()]));
  return {
    records,
    objectStoreNames: { contains: (name) => records.has(name) },
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
      uncertainties: [], review_status: "ACCEPTED", item_version: 1, content_origin: "USER_SELECTED",
    },
    {
      item_id: "synthetic-education-exchange", item_type: "EDUCATION", item_subtype: "education",
      title: "Service Design Exchange — RCA", subtitle: "Synthetic Programme B", time: "2025",
      summary: "Synthetic education B.", ownership: null,
      facts: [{ fact_id: "synthetic-fact-b", label: "Course", value: "Synthetic Course B" }],
      grounding_refs: [{ grounding_ref_id: "synthetic-ground-b", source_document_id: "source-synthetic-workspace-conversation", location: "synthetic:2", excerpt_or_reference: "Synthetic evidence B." }],
      uncertainties: [], review_status: "ACCEPTED", item_version: 1, content_origin: "USER_SELECTED",
    },
  ],
};

const initialWorking = Truth.validateCandidateWorkingModel({
  contract_id: "ariadne-candidate-working-model-v1",
  working_model_id: "synthetic-workspace-working-v1",
  source_document_id: "source-synthetic-workspace-conversation",
  processing_run_id: "run-local-synthetic-workspace-conversation",
  runtime_snapshot_id: "runtime-snapshot-local-synthetic-source",
  proposal_ids: ["proposal-local-synthetic-workspace-conversation"],
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

function receiptFor(request, patch, operation) {
  const item = request.working_model.payload.items.find((candidate) => candidate.item_id === patch.target_item_id);
  const descriptor = Conversation.fieldDescriptorForOperation(item, operation);
  assert(descriptor, "synthetic operation must resolve to a field descriptor");
  return {
    active_item_identity: patch.target_item_id,
    resolved_field_identity: descriptor.canonical_target_identity,
    semantic_key: descriptor.semantic_key,
    canonical_display_label: descriptor.canonical_display_label,
    expected_before_value: descriptor.current_value,
    desired_after_value: operation.operation === "CLEAR_ITEM_FIELD" ? null : operation.operation === "SET_UNCERTAINTY_STATUS" ? operation.status : operation.value,
    canonical_operation: structuredClone(operation),
    storage_target: structuredClone(descriptor.storage_target),
  };
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

// A — Local-origin material already in Working becomes Model context without
// source re-analysis; the root turn creates only a non-authoritative Working head.
let modelConversationCalls = 0;
const patchOne = await Integration.executeListTurn({
  database, session, human_message: "RCA 不要重复。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    modelConversationCalls += 1;
    assert.equal(request.working_model.runtime_snapshot_id, "runtime-snapshot-local-synthetic-source");
    assert.equal(request.compiled_context.candidate.candidate_items[0].title, "Royal College of Art RCA");
    assert.equal(database.records.get("candidate_context_revisions").size, 0);
    return runtimeResult(request, {
      contract_id: Conversation.ACTION_CONTRACT_ID,
      action: "PATCH_ITEM",
      message: "已更新这条 Candidate Working 信息。",
      observed_working_model: Conversation.observedWorkingModel(request.observation),
      patches: [{ target_item_id: "synthetic-education-rca", operations: [{ operation: "SET_ITEM_FIELD", field: "title", value: "Royal College of Art" }], reason: "Remove a synthetic duplicate abbreviation.", origin: "MODEL_PROPOSAL", evidence_refs: [] }],
      clarification: null,
    });
  },
});
assert.equal(patchOne.status, "SUCCEEDED");
assert.equal(patchOne.turn.state, "APPLIED");
assert.equal(patchOne.working_model.version, 2);
assert.equal(patchOne.working_model.payload.items[0].title, "Royal College of Art");
assert.equal(patchOne.working_model.authority, Truth.AUTHORITY.working);
assert.equal(modelConversationCalls, 1);
assert.equal(database.records.get("candidate_context_revisions").size, 0);

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

// ITEM focus reuses the Candidate-scoped session and applies only to the active stable item id.
let capturedItemFocus = null;
const itemPatch = await Integration.executeListTurn({
  database, session, focus: { type: "ITEM", item_id: "synthetic-education-rca" }, human_message: "这里的时间改成 2026 年 4 月。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    capturedItemFocus = request.observation.focus;
    assert.equal(request.conversation.conversation_id, session.conversation_id);
    return runtimeResult(request, {
      contract_id: Conversation.ACTION_CONTRACT_ID,
      action: "PATCH_ITEM",
      message: "已更新当前 Candidate Working Card 的时间。",
      observed_working_model: Conversation.observedWorkingModel(request.observation),
      patches: [{ target_item_id: "synthetic-education-rca", operations: [{ operation: "SET_ITEM_FIELD", field: "time", value: "2026 年 4 月" }], reason: "Synthetic item-focus time update.", origin: "MODEL_PROPOSAL", evidence_refs: [] }],
      clarification: null,
    });
  },
});
assert.deepEqual(capturedItemFocus, { type: "ITEM", item_id: "synthetic-education-rca" });
assert.equal(itemPatch.working_model.version, 4);
assert.equal(itemPatch.working_model.payload.items[0].time, "2026 年 4 月");

// An ITEM-focused response cannot escape to another card; USER and failed turn remain, with zero mutation/action/Assistant.
const beforeFocusEscape = await Integration.latestWorkingModel(database, initialWorking.source_document_id);
const beforeFocusEscapeConversation = await Persistence.restoreConversation(database, session.conversation_id);
await assert.rejects(Integration.executeListTurn({
  database, session, focus: { type: "ITEM", item_id: "synthetic-education-rca" }, human_message: "只修改当前卡片。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => runtimeResult(request, {
    contract_id: Conversation.ACTION_CONTRACT_ID,
    action: "PATCH_ITEM",
    message: "This escaped patch must not persist.",
    observed_working_model: Conversation.observedWorkingModel(request.observation),
    patches: [{ target_item_id: "synthetic-education-exchange", operations: [{ operation: "SET_ITEM_FIELD", field: "time", value: "Never" }], reason: "Synthetic focus escape.", origin: "MODEL_PROPOSAL", evidence_refs: [] }],
    clarification: null,
  }),
}), (error) => error.code === "FOCUS_VIOLATION");
const afterFocusEscape = await Integration.latestWorkingModel(database, initialWorking.source_document_id);
const afterFocusEscapeConversation = await Persistence.restoreConversation(database, session.conversation_id);
assert.equal(afterFocusEscape.working_model_id, beforeFocusEscape.working_model_id);
assert.equal(afterFocusEscapeConversation.messages.length, beforeFocusEscapeConversation.messages.length + 1);
assert.equal(afterFocusEscapeConversation.messages.at(-1).role, "USER");
assert.equal(afterFocusEscapeConversation.turns.at(-1).state, "FAILED");
assert.equal(afterFocusEscapeConversation.turns.at(-1).failure_code, "FOCUS_VIOLATION");
assert(!afterFocusEscapeConversation.actions.some((action) => action.normalized_action.message === "This escaped patch must not persist."));

// ITEM clarification/explanation share the same durable history and make no Working mutation.
const itemClarify = await Integration.executeListTurn({
  database, session, focus: { type: "ITEM", item_id: "synthetic-education-rca" }, human_message: "把这里改一下。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "ASK_CLARIFICATION", "", "你希望修改当前卡片的哪一项？"),
});
assert.equal(itemClarify.turn.state, "NEEDS_CLARIFICATION");
assert.equal(itemClarify.working_model.working_model_id, itemPatch.working_model.working_model_id);
const itemExplain = await Integration.executeListTurn({
  database, session, focus: { type: "ITEM", item_id: "synthetic-education-rca" }, human_message: "解释这张卡片的当前时间。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "EXPLAIN", "当前卡片时间来自这轮 synthetic working update。"),
});
assert.equal(itemExplain.turn.state, "NO_CHANGE");
assert.equal(itemExplain.working_model.working_model_id, itemPatch.working_model.working_model_id);

// C/D — clarification and explanation add durable Assistant turns with zero mutation.
const clarify = await Integration.executeListTurn({
  database, session, human_message: "把这段时间改成 2026 年 4 月。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "ASK_CLARIFICATION", "", "你指的是哪一条 synthetic 教育经历？"),
});
assert.equal(clarify.turn.state, "NEEDS_CLARIFICATION");
assert.equal(clarify.working_model.working_model_id, itemPatch.working_model.working_model_id);

const explain = await Integration.executeListTurn({
  database, session, human_message: "为什么这两张卡片没有合并？", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "EXPLAIN", "它们是两条不同的 synthetic 教育经历，因此保持分开。"),
});
assert.equal(explain.turn.state, "NO_CHANGE");
assert.equal(explain.working_model.working_model_id, itemPatch.working_model.working_model_id);

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
  call_runtime: async () => {
    throw Object.assign(new Error("EMPTY_RESPONSE"), {
      code: "EMPTY_RESPONSE",
      diagnostics: {
        stage: "JSON_PARSE", provider_http_status: 200, exact_returned_model_match: true,
        content_type: "string", content_length: 0, completion_tokens: 0,
        reasoning_content_present: false, refusal_present: false, tool_calls_present: false,
        message_key_names: ["content", "role"], empty_response_classification: "EMPTY_RESPONSE_ZERO_COMPLETION",
        unsafe_raw_content: "synthetic provider text must never persist",
      },
    });
  },
}), (error) => error.code === "EMPTY_RESPONSE");
assert.equal(userPersistedBeforeFailure, true);
const afterFailureHead = await Integration.latestWorkingModel(database, initialWorking.source_document_id);
assert.equal(afterFailureHead.working_model_id, beforeFailureHead.working_model_id);
const afterFailureConversation = await Persistence.restoreConversation(database, session.conversation_id);
const persistedFailure = afterFailureConversation.turns.find((turn) => turn.failure_code === "EMPTY_RESPONSE");
assert.equal(persistedFailure.failure_diagnostics.provider_http_status, 200);
assert.equal(persistedFailure.failure_diagnostics.empty_response_classification, "EMPTY_RESPONSE_ZERO_COMPLETION");
assert.equal(JSON.stringify(persistedFailure.failure_diagnostics).includes("synthetic provider text"), false);

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

// A focused Card removed by a concurrent durable update makes the late response stale and retains the Candidate session.
const beforeRemovedCardConversation = await Persistence.restoreConversation(database, session.conversation_id);
const removedCardOutcome = await Integration.executeListTurn({
  database, session, focus: { type: "ITEM", item_id: "synthetic-education-exchange" }, human_message: "更新这张稍后会被移除的 synthetic 卡片。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    const removedPayload = structuredClone(request.working_model.payload);
    removedPayload.items = removedPayload.items.filter((item) => item.item_id !== "synthetic-education-exchange");
    const removedFingerprint = await fingerprint(removedPayload);
    const removedHead = Truth.validateCandidateWorkingModel({
      ...request.working_model,
      working_model_id: `${request.working_model.source_document_id}-working-v${request.working_model.version + 1}-synthetic-removed`,
      version: request.working_model.version + 1,
      previous_working_model_id: request.working_model.working_model_id,
      fingerprint: removedFingerprint,
      created_at: now().toISOString(),
      payload: removedPayload,
    });
    await Truth.persistCandidateWorkingModel(database, removedHead);
    return runtimeResult(request, {
      contract_id: Conversation.ACTION_CONTRACT_ID,
      action: "PATCH_ITEM",
      message: "This removed-card response must not persist.",
      observed_working_model: Conversation.observedWorkingModel(request.observation),
      patches: [{ target_item_id: "synthetic-education-exchange", operations: [{ operation: "SET_ITEM_FIELD", field: "time", value: "Never" }], reason: "Synthetic removed-card late result.", origin: "MODEL_PROPOSAL", evidence_refs: [] }],
      clarification: null,
    });
  },
});
assert.equal(removedCardOutcome.status, "STALE");
assert.equal(removedCardOutcome.session.conversation_id, session.conversation_id);
assert.equal(removedCardOutcome.working_model.payload.items.some((item) => item.item_id === "synthetic-education-exchange"), false);
const afterRemovedCardConversation = await Persistence.restoreConversation(database, session.conversation_id);
assert.equal(afterRemovedCardConversation.messages.length, beforeRemovedCardConversation.messages.length + 1);
assert.equal(afterRemovedCardConversation.messages.at(-1).role, "USER");
assert(!afterRemovedCardConversation.actions.some((action) => action.normalized_action.message === "This removed-card response must not persist."));

// F — reopen resolves the identical session and durable history in order.
const reopenedSession = await Integration.resolveSession(database, initialWorking.source_document_id, "2026-09-03T09:00:00Z");
assert.equal(reopenedSession.conversation_id, session.conversation_id);
const restored = await Persistence.restoreConversation(database, session.conversation_id);
assert.equal(restored.messages.filter((message) => message.role === "USER").length, 12);
assert.equal(restored.messages.filter((message) => message.role === "ASSISTANT").length, 8);
assert(restored.turns.some((turn) => turn.state === "FAILED" && turn.failure_code === "EMPTY_RESPONSE"));
assert(restored.turns.some((turn) => turn.state === "STALE"));
assert(!restored.actions.some((action) => action.normalized_action.message === "This stale result must not persist."));
assert.equal((await Integration.latestWorkingModel(database, initialWorking.source_document_id)).payload.items[0].title, "Concurrent Durable Title");

// Work Card field semantics: role, experience title, and work arrangement project to distinct durable destinations.
const workPayload = {
  contract_id: "ariadne-candidate-working-payload-v1", material_type: "resume",
  items: [{
    item_id: "synthetic-work-role-card", item_type: "WORK_EXPERIENCE", item_subtype: "work_experience",
    title: "Synthetic Experience Title", subtitle: "Synthetic Studio", time: "2025", summary: "Synthetic work card.", ownership: null,
    facts: [
      { fact_id: "synthetic-role-fact", label: "角色", value: "Synthetic Collaborator" },
      { fact_id: "synthetic-arrangement-fact", label: "工作性质", value: "Synthetic Part-time" },
    ],
    grounding_refs: [], uncertainties: [], review_status: "NEEDS_REVIEW", item_version: 1, content_origin: "MODEL_PROPOSAL",
  }],
};
const workInitial = Truth.validateCandidateWorkingModel({
  ...initialWorking,
  working_model_id: "synthetic-work-role-working-v1",
  source_document_id: "source-synthetic-work-role-card",
  version: 1,
  previous_working_model_id: null,
  fingerprint: await fingerprint(workPayload),
  payload: workPayload,
});
const workDatabase = memoryDatabase();
workDatabase.records.get("candidate_working_models").set(workInitial.working_model_id, structuredClone(workInitial));
workDatabase.records.get("source_documents").set(workInitial.source_document_id, { source_document_id: workInitial.source_document_id });
const workSession = await Integration.resolveSession(workDatabase, workInitial.source_document_id, "2026-09-03T08:00:00Z");
const workTurn = async (human_message, operation, providerMessage) => Integration.executeListTurn({
  database: workDatabase, session: workSession, focus: { type: "ITEM", item_id: "synthetic-work-role-card" }, human_message,
  runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => runtimeResult(request, {
    contract_id: Conversation.ACTION_CONTRACT_ID, action: "PATCH_ITEM", message: providerMessage,
    observed_working_model: Conversation.observedWorkingModel(request.observation),
    patches: [{ target_item_id: "synthetic-work-role-card", operations: [operation], reason: "Synthetic Work semantic field update.", origin: "MODEL_PROPOSAL", evidence_refs: [] }], clarification: null,
  }),
});

const roleTurn = await workTurn("我的角色是 Synthetic Designer。", { operation: "SET_FACT_VALUE", fact_id: "synthetic-role-fact", value: "Synthetic Designer" }, "已更新经历标题。");
assert.equal(roleTurn.working_model.payload.items[0].title, "Synthetic Experience Title");
assert.equal(roleTurn.working_model.payload.items[0].facts.find((fact) => fact.fact_id === "synthetic-role-fact").value, "Synthetic Designer");
assert.equal(roleTurn.assistant_message.text, "已更新 1 张卡片的草稿，其他卡片保持不变。\n「Synthetic Experience Title」：「角色」从「Synthetic Collaborator」改为「Synthetic Designer」。\n尚未保存到个人资料，请核对后点击“保存到个人资料”。");
assert.equal(roleTurn.action.normalized_action.message, roleTurn.assistant_message.text);

const titleTurn = await workTurn("这段经历的标题改成 Synthetic Revised Experience。", { operation: "SET_ITEM_FIELD", field: "title", value: "Synthetic Revised Experience" }, "已更新角色。");
assert.equal(titleTurn.working_model.payload.items[0].title, "Synthetic Revised Experience");
assert.equal(titleTurn.working_model.payload.items[0].facts.find((fact) => fact.fact_id === "synthetic-role-fact").value, "Synthetic Designer");
assert.match(titleTurn.assistant_message.text, /「Synthetic Experience Title」：「标题」从「Synthetic Experience Title」改为「Synthetic Revised Experience」/u);
assert.match(titleTurn.assistant_message.text, /尚未保存到个人资料/u);

const arrangementTurn = await workTurn("这里的工作性质改成 Synthetic Internship。", { operation: "SET_FACT_VALUE", fact_id: "synthetic-arrangement-fact", value: "Synthetic Internship" }, "已更新角色。");
assert.equal(arrangementTurn.working_model.payload.items[0].title, "Synthetic Revised Experience");
assert.equal(arrangementTurn.working_model.payload.items[0].facts.find((fact) => fact.fact_id === "synthetic-role-fact").value, "Synthetic Designer");
assert.equal(arrangementTurn.working_model.payload.items[0].facts.find((fact) => fact.fact_id === "synthetic-arrangement-fact").value, "Synthetic Internship");
assert.match(arrangementTurn.assistant_message.text, /「Synthetic Revised Experience」：「工作性质」从「Synthetic Part-time」改为「Synthetic Internship」/u);
const restoredWorkConversation = await Persistence.restoreConversation(workDatabase, workSession.conversation_id);
assert.equal(restoredWorkConversation.messages.at(-1).text, arrangementTurn.assistant_message.text);
assert.equal(restoredWorkConversation.actions.at(-1).normalized_action.message, arrangementTurn.assistant_message.text);

// Duplicate-looking legacy fields remain distinct by descriptor identity and exact before value.
const duplicatePayload = {
  contract_id: "ariadne-candidate-working-payload-v1", material_type: "project",
  items: [{
    item_id: "synthetic-project-card", item_type: "PROJECT", item_subtype: "project",
    title: "Synthetic Project", subtitle: "Design Research", time: "2025", summary: "Synthetic project.", ownership: null,
    facts: [
      { fact_id: "synthetic-a", label: "unknown-a", value: "2025" },
      { fact_id: "synthetic-b", label: "unknown-b", value: "HTML + JavaScript" },
      { fact_id: "synthetic-real-supplemental", label: "Supplemental Information", value: "Synthetic note" },
    ],
    grounding_refs: [], uncertainties: [], review_status: "NEEDS_REVIEW", item_version: 1, content_origin: "MODEL_PROPOSAL",
  }],
};
const duplicateInitial = Truth.validateCandidateWorkingModel({
  ...initialWorking, working_model_id: "synthetic-duplicate-working-v1", source_document_id: "source-synthetic-duplicate-fields",
  version: 1, previous_working_model_id: null, fingerprint: await fingerprint(duplicatePayload), payload: duplicatePayload,
});
const duplicateDatabase = memoryDatabase();
duplicateDatabase.records.get("candidate_working_models").set(duplicateInitial.working_model_id, structuredClone(duplicateInitial));
duplicateDatabase.records.get("source_documents").set(duplicateInitial.source_document_id, { source_document_id: duplicateInitial.source_document_id });
const duplicateSession = await Integration.resolveSession(duplicateDatabase, duplicateInitial.source_document_id, "2026-09-03T08:00:00Z");
const duplicateTurn = await Integration.executeListTurn({
  database: duplicateDatabase, session: duplicateSession, focus: { type: "ITEM", item_id: "synthetic-project-card" },
  human_message: "把补充信息里现在是2025的那项改成RCA硕士作业。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    const operation = { operation: "SET_FACT_VALUE", fact_id: "synthetic-a", value: "RCA硕士作业" };
    const action = {
      contract_id: Conversation.ACTION_CONTRACT_ID, action: "PATCH_ITEM", message: "Untrusted generic success.",
      observed_working_model: Conversation.observedWorkingModel(request.observation),
      patches: [{ target_item_id: "synthetic-project-card", operations: [operation], reason: "Exact synthetic value resolution.", origin: "MODEL_PROPOSAL", evidence_refs: [] }], clarification: null,
    };
    return runtimeResult(request, action);
  },
});
const duplicateFacts = duplicateTurn.working_model.payload.items[0].facts;
assert.equal(duplicateFacts.find((fact) => fact.fact_id === "synthetic-a").value, "RCA硕士作业");
assert.equal(duplicateFacts.find((fact) => fact.fact_id === "synthetic-b").value, "HTML + JavaScript");
assert.match(duplicateTurn.assistant_message.text, /「未分类信息」从「2025」改为「RCA硕士作业」/u);
assert.match(duplicateTurn.assistant_message.text, /尚未保存到个人资料/u);
assert(!/synthetic-(?:project-card|a|b|duplicate-working)/u.test(duplicateTurn.assistant_message.text));
assert.equal((await Integration.resolveSession(duplicateDatabase, duplicateInitial.source_document_id)).conversation_id, duplicateSession.conversation_id);

// Version skew is rejected before a Model turn can be sent; the current signature is exact.
const currentSignature = Integration.runtimeSignature();
assert.equal(Integration.runtimeSignaturesMatch(currentSignature, structuredClone(currentSignature)), true);
assert.equal(Integration.runtimeSignaturesMatch(currentSignature, { ...currentSignature, runtime_result_contract_version: "ariadne-candidate-conversation-runtime-result-v1" }), false);
const skewedRuntimeResult = runtimeResult({ turn: { execution_id: "turn", generation: "generation" }, conversation: session, runtime_snapshot: { snapshot_id: "snapshot" } }, {
  contract_id: Conversation.ACTION_CONTRACT_ID, action: "EXPLAIN", message: "Synthetic.", observed_working_model: {}, patches: [], clarification: null,
});
skewedRuntimeResult.contract_id = "ariadne-candidate-conversation-runtime-result-v1";
assert.throws(() => Integration.validateRuntimeResult(skewedRuntimeResult, { execution_id: "turn", generation: "generation" }, session, { snapshot_id: "snapshot" }),
  (error) => error.code === "RUNTIME_RESULT_IDENTITY_INVALID");

// Human Copy Boundary replaces provider copy containing internal identities before persistence/display.
const leakyExplain = await Integration.executeListTurn({
  database: duplicateDatabase, session: duplicateSession, focus: { type: "ITEM", item_id: "synthetic-project-card" },
  human_message: "解释当前字段。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "EXPLAIN", `item synthetic-project-card fact synthetic-b working ${request.working_model.working_model_id}`),
});
assert.equal(leakyExplain.assistant_message.text, "我无法安全显示这段说明，请换一种问法。");
assert(!leakyExplain.assistant_message.text.includes("synthetic-project-card"));
const currentCardClarification = await Integration.executeListTurn({
  database: duplicateDatabase, session: duplicateSession, focus: { type: "ITEM", item_id: "synthetic-project-card" },
  human_message: "这个卡片里补充一条背景信息。", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "ASK_CLARIFICATION", "", "请选择 synthetic-project-card / synthetic-a。"),
});
assert.equal(currentCardClarification.turn.state, "NEEDS_CLARIFICATION");
assert.equal(currentCardClarification.assistant_message.text, "请使用卡片标题或字段名称说明要修改的内容。");
assert.equal(currentCardClarification.session.conversation_id, duplicateSession.conversation_id);

// Applied Verification V2 rejects a result where another descriptor changed, even though some operation succeeded.
const correctOperation = { operation: "SET_FACT_VALUE", fact_id: "synthetic-a", value: "Expected" };
const correctPatch = { target_item_id: "synthetic-project-card", operations: [correctOperation] };
const correctReceipt = receiptFor({ working_model: duplicateInitial }, correctPatch, correctOperation);
const wrongTargetResult = structuredClone(duplicateInitial);
wrongTargetResult.payload.items[0].facts.find((fact) => fact.fact_id === "synthetic-b").value = "Expected";
assert.throws(() => Integration.verifiedAppliedAction({ action: "PATCH_ITEM", patches: [correctPatch] }, [correctReceipt], duplicateInitial, wrongTargetResult),
  (error) => error.code === "APPLICATION_RESULT_MISMATCH");

// The runtime blocks an unverifiable application before it can persist an Assistant success message.
assert.throws(() => Integration.verifiedAppliedAction({
  action: "PATCH_ITEM", patches: [{ target_item_id: "synthetic-work-role-card", operations: [{ operation: "SET_ITEM_FIELD", field: "title", value: "Never Applied" }] }],
}, [receiptFor({ working_model: workInitial }, { target_item_id: "synthetic-work-role-card" }, { operation: "SET_ITEM_FIELD", field: "title", value: "Never Applied" })], workInitial, workInitial), (error) => error.code === "APPLICATION_RESULT_MISMATCH");

// UI wiring evidence: List and Detail use one integration function and select focus at submit time.
const pages = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
// Reproduce the actual Detail owner: a confirmed legacy item absent from an existing same-source Working head.
const detailOwner = pages.match(/  async function candidateWorkingModelForDetail\([\s\S]*?\n  \}/)?.[0];
assert(detailOwner);
const resolveDetailWorking = new Function("LocalCandidateReview", "Truth", "CandidateModel", `${detailOwner}; return candidateWorkingModelForDetail;`)(Review, Truth, CandidateModel);
const legacyItem = { ...structuredClone(initialPayload.items[0]), item_id: "synthetic-legacy-material", title: "Confirmed synthetic material", review_status: "CONFIRMED", content_origin: "USER_CONFIRMED" };
delete legacyItem.item_subtype;
const legacyRevision = Truth.validateContextRevision({
  contract_id: "ariadne-context-revision-v1", context_type: "CANDIDATE", context_id: "candidate-context-synthetic-legacy",
  revision_id: "synthetic-legacy-v1", version: 1, previous_revision_id: null, confirmed_from_proposal_id: initialWorking.proposal_ids[0],
  review_decision_id: "synthetic-legacy-review", created_at: "2026-09-03T08:00:00Z",
  provenance: { source_document_ids: [initialWorking.source_document_id], processing_run_id: initialWorking.processing_run_id, runtime_snapshot_id: initialWorking.runtime_snapshot_id },
  payload: { items: [legacyItem] }, authority: Truth.AUTHORITY.revision,
});
const detailDb = memoryDatabase();
detailDb.records.get("candidate_working_models").set(initialWorking.working_model_id, structuredClone(initialWorking));
detailDb.records.get("candidate_context_revisions").set(legacyRevision.revision_id, structuredClone(legacyRevision));
const materialWorking = await resolveDetailWorking(detailDb, initialWorking.source_document_id, legacyItem.item_id, legacyRevision);
assert.equal(materialWorking.version, 2);
assert.deepEqual(materialWorking.payload.items.slice(0, 2), initialWorking.payload.items);
assert.equal(materialWorking.payload.items.at(-1).confidence, "unknown");
assert.equal((await resolveDetailWorking(detailDb, initialWorking.source_document_id, legacyItem.item_id, legacyRevision)).working_model_id, materialWorking.working_model_id);
assert.equal(detailDb.records.get("candidate_working_models").size, 2, "reopen must not persist a duplicate version");
const detailSession = await Integration.resolveSession(detailDb, initialWorking.source_document_id, "2026-09-03T08:01:00Z");
const detailDiscussion = await Integration.executeListTurn({
  database: detailDb, session: detailSession, focus: { type: "ITEM", item_id: legacyItem.item_id }, human_message: "Explain this synthetic material.", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    assert.equal(request.compiled_context.candidate.current_item.title, legacyItem.title);
    return noPatches(request, "EXPLAIN", "Synthetic discussion only.");
  },
});
assert.equal(detailDiscussion.status, "SUCCEEDED");
assert.equal(detailDb.records.get("candidate_working_models").size, 2);
assert.equal(detailDb.records.get("candidate_context_revisions").size, 1);
const recoveryOwner = pages.match(/  async function restoreCandidateDetailConversation\([\s\S]*?\n  \}/)?.[0];
assert(recoveryOwner);
const restoreDetail = new Function("CandidateConversationPersistence", `${recoveryOwner}; return restoreCandidateDetailConversation;`)(Persistence);
const interruptedDb = memoryDatabase();
const interruptedTurn = { ...structuredClone(detailDiscussion.turn), state: "SENDING", action_id: null, result_action: null, state_history: detailDiscussion.turn.state_history.slice(0, 2) };
interruptedTurn.updated_at = interruptedTurn.state_history.at(-1).at;
interruptedDb.records.get("conversation_sessions").set(detailSession.conversation_id, detailSession);
interruptedDb.records.get("conversation_messages").set(detailDiscussion.user_message.message_id, detailDiscussion.user_message);
interruptedDb.records.get("conversation_turn_executions").set(interruptedTurn.execution_id, interruptedTurn);
assert.equal((await restoreDetail(interruptedDb, detailSession.conversation_id, interruptedTurn.updated_at)).turns[0].state, "SENDING", "a fresh turn in another view must remain active");
const expiredAt = new Date(Date.parse(interruptedTurn.updated_at) + 300001).toISOString();
const recoveredDetail = await restoreDetail(interruptedDb, detailSession.conversation_id, expiredAt);
assert.equal(recoveredDetail.turns[0].state, "FAILED");
assert.equal(recoveredDetail.turns[0].failure_code, "INTERRUPTED_TURN_EXPIRED");
assert.equal(recoveredDetail.messages.length, 1, "recovery must not fabricate Assistant output");
assert.equal(recoveredDetail.actions.length, 0);
assert.deepEqual(await restoreDetail(interruptedDb, detailSession.conversation_id, expiredAt), recoveredDetail);
const legacyPatch = { title: "Saved synthetic material", subtitle: legacyItem.subtitle, time: legacyItem.time, summary: legacyItem.summary, ownership: "User-confirmed boundary", facts: legacyItem.facts.map((fact) => fact.value) };
const acceptedWorking = await CandidateModel.editedCandidateWorkingModel(materialWorking, legacyItem.item_id, legacyPatch, "2026-09-03T10:00:00Z", "USER_CONFIRMED");
const acceptedItem = { ...legacyItem, ...legacyPatch, facts: acceptedWorking.payload.items.at(-1).facts };
const legacySaved = await Review.persistUserEdit(detailDb, legacyRevision, legacyItem.item_id, acceptedItem, { working_model: acceptedWorking });
assert.equal(legacySaved.revision.version, 2);
assert.equal((await resolveDetailWorking(detailDb, initialWorking.source_document_id, legacyItem.item_id, legacySaved.revision)).payload.items.at(-1).title, legacyPatch.title);
assert.equal(detailDb.records.get("candidate_working_models").size, 3);
const nextJobCandidateSnapshot = await JobCandidateContext.buildSnapshotFromDatabase(detailDb);
assert(JSON.stringify(nextJobCandidateSnapshot.provider_view.confirmed).includes(legacyPatch.title));
assert(JSON.stringify(nextJobCandidateSnapshot.provider_view.working).includes(legacyPatch.title));
assert(!JSON.stringify(nextJobCandidateSnapshot.provider_view).includes(legacyItem.title), "new Job context must not see a stale legacy title");
const savedCounts = [...detailDb.records].map(([name, rows]) => [name, rows.size]);
await assert.rejects(Review.persistUserEdit(detailDb, legacyRevision, legacyItem.item_id, acceptedItem, { working_model: acceptedWorking }), /context_version_conflict|candidate_working_model_stale/);
assert.deepEqual([...detailDb.records].map(([name, rows]) => [name, rows.size]), savedCounts, "conflicting Save must atomically preserve both Working and confirmed stores");
await assert.rejects(Review.persistUserEdit(detailDb, legacySaved.revision, legacyItem.item_id, acceptedItem, { working_model: acceptedWorking }), /candidate_working_model_stale/);
assert.deepEqual([...detailDb.records].map(([name, rows]) => [name, rows.size]), savedCounts);
await Integration.executeListTurn({
  database: detailDb, session: detailSession, focus: { type: "ITEM", item_id: legacyItem.item_id }, human_message: "What is the current synthetic title?", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    assert.equal(request.compiled_context.candidate.current_item.title, legacyPatch.title);
    return noPatches(request, "EXPLAIN", legacyPatch.title);
  },
});
const detailRendererBody = pages.match(/function renderCandidateWorkspaceCardDetail\(itemId\) \{([\s\S]*?)\n  \}\n\n  async function openCandidateWorkspaceCardDetail/)?.[1] || "";
assert.match(detailRendererBody, /candidate-card-detail-title[\s\S]*item\.title/);
assert.match(detailRendererBody, /candidate-card-detail-facts[\s\S]*visibleFacts\.map\(\(fact\)[\s\S]*canonical_display_label[\s\S]*fact\.value/);
const rootSubmitBody = pages.match(/async function submitCandidateWorkspaceConversation\(content\) \{([\s\S]*?)\n  \}\n\n  function returnToCandidateCardList/)?.[1] || "";
assert(rootSubmitBody.includes("CandidateWorkspaceConversationRuntime.executeListTurn"));
assert(!rootSubmitBody.includes("applyCandidateWorkspaceCorrection"));
assert.doesNotMatch(pages, /applyCandidateWorkspaceCorrection|workspaceItemPatch/);
assert.match(rootSubmitBody, /type: "CANDIDATE"/);
assert.match(rootSubmitBody, /type: "ITEM", item_id: activeCandidateWorkspaceItemId/);
assert.match(rootSubmitBody, /focus,/);
assert.match(rootSubmitBody, /workspaceViewIsCurrent\(viewGeneration\)/);
assert.match(rootSubmitBody, /renderLatestCandidateWorkspaceSurface\(sourceId, durableHead, viewGeneration\)/);
assert.match(pages, /openCandidateWorkspaceCardDetail\(card\.dataset\.workingItem\)/);
assert.match(pages, /CandidateWorkspaceConversationRuntime\.latestWorkingModel\(database, sourceId\)/);
assert.match(pages, /candidateConversationTurnActive/);
assert.match(pages, /candidate-conversation-runtime-signature/);
assert.match(pages, /RUNTIME_CONTRACT_VERSION_MISMATCH/);
assert.match(pages, /模型这次没有返回可用内容，请重试。/);

const html = fs.readFileSync(path.join(root, "public", "personal-import.html"), "utf8");
assert.match(html, /candidate-conversation-contract-manifest\.js/);
assert.match(html, /candidate-conversation-domain\.js/);
assert(html.indexOf("candidate-conversation-contract-manifest.js") < html.indexOf("candidate-conversation-domain.js"));
assert.match(html, /candidate-conversation-persistence-domain\.js/);
assert.match(html, /candidate-conversation-context-compiler\.js/);
assert.match(html, /candidate-workspace-conversation-runtime\.js/);

// Continuation citations survive every validation/application/persistence layer.
const semanticDb = memoryDatabase();
semanticDb.records.get("candidate_working_models").set(initialWorking.working_model_id, structuredClone(initialWorking));
semanticDb.records.get("source_documents").set(initialWorking.source_document_id, { source_document_id: initialWorking.source_document_id });
const semanticSession = await Integration.resolveSession(semanticDb, initialWorking.source_document_id, "2026-09-03T08:01:00Z");
const earlierIntent = "这两段教育经历可以标成学习经历吗？";
await Integration.executeListTurn({ database: semanticDb, session: semanticSession, human_message: earlierIntent, runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => noPatches(request, "EXPLAIN", "可以设置分类标签，目前尚未修改。") });
const continuedCategory = await Integration.executeListTurn({ database: semanticDb, session: semanticSession, human_message: "就这样改", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => runtimeResult(request, {
    contract_id: Conversation.ACTION_CONTRACT_ID, action: "PATCH_MULTIPLE_ITEMS", message: "Not a trusted success receipt",
    observed_working_model: Conversation.observedWorkingModel(request.observation), clarification: null,
    intent_evidence: { current_quote: "就这样改", history_ref: "history-1", history_quote: earlierIntent },
    patches: request.working_model.payload.items.map((item) => ({ target_item_id: item.item_id, operations: [{ operation: "SET_ITEM_FIELD", field: "category", value: "学习经历" }], reason: "Synthetic continuation", origin: "MODEL_PROPOSAL", evidence_refs: [] })),
  }) });
assert.equal(continuedCategory.turn.state, "APPLIED");
assert(continuedCategory.working_model.payload.items.every((item) => item.category === "学习经历" && item.item_type === "EDUCATION"));
assert.equal(semanticDb.records.get("candidate_context_revisions").size, 0);
assert.equal((await Integration.latestWorkingModel(semanticDb, initialWorking.source_document_id)).version, initialWorking.version + 1);
assert.match(continuedCategory.assistant_message.text, /已更新 2 张卡片的草稿/u);
await Integration.executeListTurn({ database: semanticDb, session: semanticSession, human_message: "改好了吗？", runtime_snapshot: snapshot(), id_factory: idFactory, now,
  call_runtime: async (request) => {
    assert.equal(request.compiled_context.bounded_history.at(-1).action_result.status, "APPLIED");
    assert.equal(request.compiled_context.candidate.candidate_items[0].category, "学习经历");
    return noPatches(request, "EXPLAIN", "草稿已更新，尚未保存到个人资料。");
  } });
const categoryObservation = Conversation.createObservation({ candidate_context_id: semanticSession.subject_id, working_model: continuedCategory.working_model, focus: { type: "CANDIDATE" } });
assert.throws(() => Conversation.validateAction({ ...continuedCategory.action.normalized_action, observed_working_model: Conversation.observedWorkingModel(categoryObservation) }, {
  observation: categoryObservation, working_model: continuedCategory.working_model, human_message: "就这样改", compiled_context: { bounded_history: [] },
}), /IMPLICIT_MULTI_VIOLATION/);
// Missing optional legacy stores must not hide confirmed Candidate revisions.
const libraryOwner = pages.match(/  async function renderPersonalLibrary\([\s\S]*?\n  \}/)?.[0];
assert(libraryOwner);
for (const hasLegacy of [false, true]) {
  const grid = { innerHTML: "" };
  const optionalDb = { objectStoreNames: { contains: () => hasLegacy }, close() {} };
  const readLibrary = new Function("Demo", "localizedCandidateRecords", "Truth", "LocalCandidateReview", "byId", "personalGuideCardMarkup", "candidateCardMarkup", "window", "playPendingCardReturn", `${libraryOwner}; return renderPersonalLibrary;`)(
    { openDatabase: async () => optionalDb, DEMO_STORES: { candidates: "optional_legacy" } }, async x => x,
    { openDatabase: async () => optionalDb }, {
      getAll: async (_db, store) => {
        if (store === "optional_legacy") { assert(hasLegacy); return [{ title: "legacy retained" }]; }
        return store === "candidate_context_revisions" ? [{context_id:"synthetic",revision_id:"synthetic-v1",payload:{items:[{title:"confirmed retained"}]}}] : [];
      }, activeConfirmedRevisions: x => x,
    }, () => grid, () => "guide", item => item.title, { requestAnimationFrame() {} }, () => {});
  await readLibrary();
  assert.match(grid.innerHTML, /confirmed retained/);
  assert.equal(grid.innerHTML.includes("legacy retained"), hasLegacy);
}
assert.match(fs.readFileSync(path.join(root,"public/personal-information.html"),"utf8"),/product-shell-domain.js/);
console.log("candidate_workspace_conversation_integration=pass");
