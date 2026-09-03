import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const require = createRequire(import.meta.url);
const Truth = require("../public/truth-persistence-domain.js");
const Conversation = require("../public/candidate-conversation-domain.js");
const Persistence = require("../public/candidate-conversation-persistence-domain.js");
const Compiler = require("../public/candidate-conversation-context-compiler.js");
const Integration = require("../public/candidate-workspace-conversation-runtime.js");

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function fingerprint(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function createSyntheticWorkspaceRequest() {
  const payload = {
    contract_id: "ariadne-candidate-working-payload-v1",
    material_type: "resume",
    items: [{
      item_id: "item-edu-001", item_type: "EDUCATION", item_subtype: "education",
      title: "Royal College of Art RCA", subtitle: "Synthetic Route Programme", time: "2026",
      summary: "Synthetic route-only candidate item.", ownership: null,
      facts: [], grounding_refs: [], uncertainties: [], review_status: "NEEDS_REVIEW", item_version: 1, content_origin: "MODEL_PROPOSAL",
    }],
  };
  const workingModel = Truth.validateCandidateWorkingModel({
    contract_id: "ariadne-candidate-working-model-v1",
    working_model_id: "synthetic-route-working-v1",
    source_document_id: "source-synthetic-route-contract",
    processing_run_id: "run-synthetic-route-contract",
    runtime_snapshot_id: "runtime-snapshot-synthetic-route-source",
    proposal_ids: ["proposal-synthetic-route-contract"],
    version: 1,
    previous_working_model_id: null,
    fingerprint: await fingerprint(payload),
    created_at: "2026-09-03T08:00:00Z",
    payload,
    authority: Truth.AUTHORITY.working,
  });
  const session = Persistence.createSession({
    candidate_context_id: Integration.candidateContextIdFor(workingModel.source_document_id),
    source_document_id: workingModel.source_document_id,
    created_at: "2026-09-03T08:01:00Z",
  });
  const observation = Conversation.createObservation({
    candidate_context_id: session.subject_id,
    working_model: workingModel,
    focus: { type: "CANDIDATE" },
  });
  const execution = Conversation.createTurnExecution({
    execution_id: "candidate-conversation-turn-synthetic-route",
    session: Integration.runtimeSession(session),
    observation,
    runtime_snapshot_id: "runtime-snapshot-synthetic-route-turn",
    generation: "candidate-conversation-generation-synthetic-route",
    created_at: "2026-09-03T08:02:00Z",
  });
  const userMessage = Persistence.createUserMessage({
    message_id: "candidate-conversation-user-synthetic-route",
    conversation_id: session.conversation_id,
    turn_id: execution.execution_id,
    text: "Royal College of Art RCA → Royal College of Art",
    created_at: execution.created_at,
  });
  const runtimeSnapshot = Integration.createRuntimeSnapshot({
    snapshot_id: execution.runtime_snapshot_id,
    captured_at: execution.created_at,
  });
  const compiledContext = Compiler.compileContext({
    session,
    working_model: workingModel,
    observation,
    messages: [userMessage],
    actions: [],
    current_user_message: userMessage,
  });
  return Integration.createRuntimeRequest({
    session,
    human_message: userMessage.text,
    observation,
    working_model: workingModel,
    compiled_context: compiledContext,
    runtime_snapshot: runtimeSnapshot,
    execution,
  });
}

if (process.argv[1] && process.argv[1].endsWith("candidate_workspace_conversation_request_fixture.mjs")) {
  process.stdout.write(`${JSON.stringify(await createSyntheticWorkspaceRequest())}\n`);
}
