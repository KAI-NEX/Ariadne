import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";


if (!globalThis.crypto) globalThis.crypto = webcrypto;
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Truth = require("../public/truth-persistence-domain.js");
const Conversation = require("../public/candidate-conversation-domain.js");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "data", "candidate_conversation_contract_v1.json"), "utf8"));
assert.deepEqual(Conversation.CONTRACT_MANIFEST, manifest);
assert.deepEqual(Conversation.ACTIONS, manifest.actions);
assert.deepEqual(Conversation.OPERATIONS, manifest.canonical_operations);
assert.equal(Conversation.LIMITS.clarification, manifest.limits.clarification);

const working = Truth.validateCandidateWorkingModel({
  contract_id: "ariadne-candidate-working-model-v1",
  working_model_id: "synthetic-working-v3",
  source_document_id: "source-candidate-synthetic",
  processing_run_id: "run-synthetic",
  runtime_snapshot_id: "runtime-snapshot-synthetic-source",
  proposal_ids: ["proposal-synthetic"],
  version: 3,
  previous_working_model_id: "synthetic-working-v2",
  fingerprint: `sha256:${"a".repeat(64)}`,
  created_at: "2026-09-03T07:00:00Z",
  payload: {
    contract_id: "ariadne-candidate-working-payload-v1",
    material_type: "resume",
    items: [
      {
        item_id: "item-edu-001", item_type: "EDUCATION", item_subtype: "education",
        title: "Royal College of Art RCA", subtitle: "Synthetic programme", time: "2024",
        summary: "Synthetic item.", facts: [{ fact_id: "fact-001", label: "Degree", value: "Synthetic degree" }], ownership: null,
        grounding_refs: [{ grounding_ref_id: "ground-001", source_document_id: "synthetic-source", location: "synthetic:1", excerpt_or_reference: "Synthetic only" }],
        uncertainties: [{ uncertainty_id: "uncertain-001", question: "Synthetic question", affects: "fact", status: "OPEN" }],
        review_status: "NEEDS_REVIEW", item_version: 1, content_origin: "MODEL_PROPOSAL",
      },
      {
        item_id: "item-edu-002", item_type: "EDUCATION", item_subtype: "education",
        title: "Service Design Exchange — RCA", subtitle: null, time: "2025", summary: "Second synthetic item.",
        facts: [{ fact_id: "fact-002", label: "Course", value: "Synthetic course" }], ownership: null,
        grounding_refs: [], uncertainties: [], review_status: "NEEDS_REVIEW", item_version: 1, content_origin: "MODEL_PROPOSAL",
      },
    ],
  },
  authority: Truth.AUTHORITY.working,
});
const session = Conversation.createSession("synthetic-candidate-context", "2026-09-03T07:01:00Z");
const candidateObservation = Conversation.createObservation({ candidate_context_id: session.subject_id, working_model: working, focus: { type: "CANDIDATE" } });
const itemObservation = Conversation.createObservation({ candidate_context_id: session.subject_id, working_model: working, focus: { type: "ITEM", item_id: "item-edu-001" } });
assert.equal(session.conversation_id, Conversation.conversationIdFor(session.subject_id));
assert.equal(session.conversation_id, Conversation.createSession(session.subject_id, "2026-09-03T07:02:00Z").conversation_id);
assert.notDeepEqual(candidateObservation.focus, itemObservation.focus); // Focus changes, conversation identity does not.

function observed(observation) { return Conversation.observedWorkingModel(observation); }
function patch(target, operation, evidenceRefs = []) {
  return { target_item_id: target, operations: [operation], reason: "Synthetic correction.", origin: "MODEL_PROPOSAL", evidence_refs: evidenceRefs };
}
function action(observation, name, patches = [], message = "Synthetic response.", clarification = null) {
  return { contract_id: Conversation.ACTION_CONTRACT_ID, action: name, message, observed_working_model: observed(observation), patches, clarification };
}
function expect(code, callback) {
  assert.throws(callback, (error) => error instanceof Conversation.CandidateConversationError && error.code === code);
}

// The browser-facing contract reads the same manifest as the Python adapter.
// Every action's message semantics are explicit; only ASK permits omission/empty.
const semanticNoChangeBasis = { target_item_id: "item-edu-001", concept: "institution_name", value: "Royal College of Art RCA" };
const semanticFixtures = {
  PATCH_ITEM: { action: "PATCH_ITEM", message: "Updated synthetic title.", patches: [{ target_item_id: "item-edu-001", changes: [{ intent: "SET", concept: "school_name", value: "Royal College of Art" }] }] },
  PATCH_MULTIPLE_ITEMS: { action: "PATCH_MULTIPLE_ITEMS", message: "Updated synthetic titles.", patches: [
    { target_item_id: "item-edu-001", changes: [{ intent: "SET", concept: "school_name", value: "Royal College of Art" }] },
    { target_item_id: "item-edu-002", changes: [{ intent: "SET", concept: "school_name", value: "Service Design Exchange — Royal College of Art" }] },
  ] },
  ASK_CLARIFICATION: { action: "ASK_CLARIFICATION", message: "", clarification: "Which synthetic item do you mean?", patches: [] },
  EXPLAIN: { action: "EXPLAIN", message: "Synthetic explanation.", patches: [] },
  NO_CHANGE: { action: "NO_CHANGE", message: "Synthetic value already matches.", patches: [], no_change_basis: semanticNoChangeBasis },
};
for (const [actionType, fixture] of Object.entries(semanticFixtures)) {
  assert.equal(Conversation.validateSemanticAction(fixture).action, actionType);
  const missing = { ...fixture }; delete missing.message;
  if (actionType === "ASK_CLARIFICATION") assert.equal(Conversation.validateSemanticAction(missing).message, "");
  else expect("ACTION_MESSAGE_SHAPE_INVALID", () => Conversation.validateSemanticAction(missing));
  for (const malformed of [null, "", "   ", "x".repeat(manifest.limits.message + 1), 7]) {
    const candidate = { ...fixture, message: malformed };
    if (actionType === "ASK_CLARIFICATION" && ["", "   "].includes(malformed)) assert.equal(Conversation.validateSemanticAction(candidate).message, "");
    else expect("ACTION_MESSAGE_SHAPE_INVALID", () => Conversation.validateSemanticAction(candidate));
  }
}
expect("NO_CHANGE_BASIS_SHAPE_INVALID", () => Conversation.validateSemanticAction({ action: "NO_CHANGE", message: "Synthetic value already matches.", patches: [] }));

Conversation.validateAction(action(candidateObservation, "NO_CHANGE", [], "No change is needed."), { observation: candidateObservation, working_model: working, human_message: "保持不变" });
Conversation.validateAction(action(candidateObservation, "ASK_CLARIFICATION", [], "", "你指的是哪张卡片？"), { observation: candidateObservation, working_model: working, human_message: "改一下" });
Conversation.validateAction(action(candidateObservation, "EXPLAIN", [], "Synthetic explanation."), { observation: candidateObservation, working_model: working, human_message: "解释一下" });

const titlePatch = patch("item-edu-001", { operation: "SET_ITEM_FIELD", field: "title", value: "Royal College of Art" }, ["ground-001"]);
const applied = await Conversation.applyAction({
  action: action(itemObservation, "PATCH_ITEM", [titlePatch], "Updated title."), observation: itemObservation,
  session, current_working_model: working, human_message: "把标题改成 Royal College of Art。", created_at: "2026-09-03T07:03:00Z",
});
assert.equal(applied.mutation, "NEW_WORKING_STATE");
assert.equal(applied.working_model.authority, Truth.AUTHORITY.working);
assert.equal(applied.working_model.version, 4);
assert.equal(applied.working_model.previous_working_model_id, working.working_model_id);
assert.equal(applied.working_model.payload.items[0].title, "Royal College of Art");
assert.equal(applied.working_model.payload.items[0].content_origin, "USER_EDITED");
assert.equal(applied.working_model.payload.items[0].item_version, 2);
assert.equal(working.payload.items[0].title, "Royal College of Art RCA");

const factPatch = patch("item-edu-001", { operation: "SET_FACT_VALUE", fact_id: "fact-001", value: "Full-time synthetic degree" });
const confirmed = await Conversation.applyAction({
  action: action(itemObservation, "PATCH_ITEM", [factPatch]), observation: itemObservation,
  session, current_working_model: working, human_message: "这里其实是全职。", created_at: "2026-09-03T07:04:00Z",
});
assert.equal(confirmed.working_model.payload.items[0].content_origin, "USER_CONFIRMED");

const inferred = await Conversation.applyAction({
  action: action(itemObservation, "PATCH_ITEM", [titlePatch]), observation: itemObservation,
  session, current_working_model: working, human_message: "请根据现有内容建议更清楚的标题。", created_at: "2026-09-03T07:05:00Z",
});
assert.equal(inferred.working_model.payload.items[0].content_origin, "MODEL_INFERRED");

const patches = [
  titlePatch,
  patch("item-edu-002", { operation: "SET_ITEM_FIELD", field: "title", value: "Service Design Exchange — Royal College of Art" }),
];
const multiAction = action(candidateObservation, "PATCH_MULTIPLE_ITEMS", patches);
expect("IMPLICIT_MULTI_VIOLATION", () => Conversation.validateAction(multiAction, { observation: candidateObservation, working_model: working, human_message: "RCA 就是 Royal College of Art。" }));
const multiApplied = await Conversation.applyAction({
  action: multiAction, observation: candidateObservation, session, current_working_model: working,
  human_message: "把所有教育项目里的 RCA 都统一展开。", created_at: "2026-09-03T07:06:00Z",
});
assert.deepEqual(multiApplied.working_model.payload.items.map((item) => item.item_version), [2, 2]);

// Atomic fail: one invalid target means no returned Working state and the input remains untouched.
const invalidMulti = action(candidateObservation, "PATCH_MULTIPLE_ITEMS", [patches[0], patch("missing-item", { operation: "SET_ITEM_FIELD", field: "title", value: "No" })]);
expect("INVALID_TARGET", () => Conversation.validateAction(invalidMulti, { observation: candidateObservation, working_model: working, human_message: "把所有项目都改掉。" }));
assert.equal(working.version, 3);
expect("FOCUS_VIOLATION", () => Conversation.validateAction(action(itemObservation, "PATCH_ITEM", [patches[1]]), { observation: itemObservation, working_model: working, human_message: "改标题" }));
expect("UNSUPPORTED_ACTION", () => Conversation.validateAction(action(candidateObservation, "MERGE_ITEMS"), { observation: candidateObservation, working_model: working, human_message: "merge" }));
expect("UNSUPPORTED_OPERATION", () => Conversation.validateAction(action(candidateObservation, "PATCH_ITEM", [patch("item-edu-001", { operation: "REMOVE_ITEM" })]), { observation: candidateObservation, working_model: working, human_message: "remove" }));
const bypass = action(candidateObservation, "NO_CHANGE", [], "No change is needed."); bypass.bypass = true;
expect("ACTION_TOP_LEVEL_SHAPE_INVALID", () => Conversation.validateAction(bypass, { observation: candidateObservation, working_model: working, human_message: "no change" }));
expect("ACTION_CLARIFICATION_SHAPE_INVALID", () => Conversation.validateAction(
  action(candidateObservation, "ASK_CLARIFICATION", [], "", "x".repeat(manifest.limits.clarification + 1)),
  { observation: candidateObservation, working_model: working, human_message: "clarify" },
));

// Stale and cancel are terminal, zero-mutation outcomes.
let execution = Conversation.createTurnExecution({ execution_id: "turn-001", session, observation: candidateObservation, runtime_snapshot_id: "runtime-snapshot-conversation", generation: "generation-001", created_at: "2026-09-03T07:07:00Z" });
execution = Conversation.transitionExecution(execution, "SENDING", { at: "2026-09-03T07:07:01Z" });
execution = Conversation.transitionExecution(execution, "RECEIVED", { at: "2026-09-03T07:07:02Z" });
execution = Conversation.transitionExecution(execution, "VALIDATING", { at: "2026-09-03T07:07:03Z" });
const stale = await Conversation.applyExecutionResult({ execution, generation: "generation-001", action: action(candidateObservation, "NO_CHANGE", [], "No change is needed."), session, current_working_model: applied.working_model, human_message: "保持不变", at: "2026-09-03T07:07:04Z" });
assert.equal(stale.execution.state, "STALE");
assert.equal(stale.application, null);

let cancelled = Conversation.createTurnExecution({ execution_id: "turn-002", session, observation: candidateObservation, runtime_snapshot_id: "runtime-snapshot-conversation", generation: "generation-002", created_at: "2026-09-03T07:08:00Z" });
cancelled = Conversation.transitionExecution(cancelled, "SENDING", { at: "2026-09-03T07:08:01Z" });
cancelled = Conversation.cancelExecution(cancelled, "2026-09-03T07:08:02Z");
await assert.rejects(
  Conversation.applyExecutionResult({ execution: cancelled, generation: "generation-002", action: action(candidateObservation, "NO_CHANGE", [], "No change is needed."), session, current_working_model: working, human_message: "保持不变" }),
  (error) => error.code === "CANCELLED_TURN",
);

// ITEM_DRAFT changes only its draft and never advances persisted Working head.
const originalDraftItem = structuredClone(working.payload.items[0]);
const draft = { item_id: "item-edu-001", item: originalDraftItem, draft_fingerprint: await Conversation.draftFingerprintFor(originalDraftItem) };
const draftObservation = Conversation.createObservation({ candidate_context_id: session.subject_id, working_model: working, focus: { type: "ITEM_DRAFT", item_id: draft.item_id, draft_fingerprint: draft.draft_fingerprint } });
const draftApplication = await Conversation.applyAction({ action: action(draftObservation, "PATCH_ITEM", [patch(draft.item_id, { operation: "CLEAR_ITEM_FIELD", field: "subtitle" })]), observation: draftObservation, session, current_working_model: working, human_message: "清空副标题。", draft });
assert.equal(draftApplication.mutation, "ITEM_DRAFT_ONLY");
assert.equal(draftApplication.working_model.working_model_id, working.working_model_id);
assert.equal(draftApplication.draft.item.subtitle, null);

const source = fs.readFileSync(path.join(root, "public", "v1-pages.js"), "utf8");
assert.match(source, /fetch\("\/api\/candidate-conversation-turn"/); // Slice A wires only the Workspace list root.
assert.match(source, /applyCandidateWorkspaceCorrection/); // Frozen Detail behavior remains for Slice B.
console.log("candidate_conversation_domain=pass");
