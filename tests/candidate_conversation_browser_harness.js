"use strict";

(async function runSyntheticResponseResolutionHarness() {
  const Truth = globalThis.AriadneTruthPersistence;
  const Persistence = globalThis.AriadneCandidateConversationPersistence;
  const Integration = globalThis.AriadneCandidateWorkspaceConversationRuntime;
  const status = document.querySelector("#status");
  const title = document.querySelector("#card-title");
  const version = document.querySelector("#working-version");
  const conversation = document.querySelector("#conversation");
  const form = document.querySelector("#composer");
  const input = document.querySelector("#message");

  const waitForSeed = async () => {
    for (let index = 0; index < 100; index += 1) {
      if (document.body.dataset.syntheticSeed === "ready") return document.body.dataset.syntheticSourceId;
      if (document.body.dataset.syntheticSeed?.startsWith("failed:")) throw new Error(document.body.dataset.syntheticSeed);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("synthetic_seed_timeout");
  };
  const renderMessages = (messages) => {
    conversation.innerHTML = messages.map((message) => `<p data-role="${message.role}">${message.role}: ${message.text}</p>`).join("");
  };
  const callRuntime = async (request) => {
    const signatureResponse = await fetch("/api/candidate-conversation-runtime-signature", { cache: "no-store" });
    const signaturePayload = await signatureResponse.json();
    if (!signatureResponse.ok || !Integration.runtimeSignaturesMatch(Integration.runtimeSignature(), signaturePayload.runtime_signature)) {
      throw Object.assign(new Error("RUNTIME_CONTRACT_VERSION_MISMATCH"), { code: "RUNTIME_CONTRACT_VERSION_MISMATCH", network_call_made: false });
    }
    const response = await fetch("/api/candidate-conversation-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error || "CANDIDATE_CONVERSATION_FAILED"), result);
    return result;
  };

  const sourceId = await waitForSeed();
  let database = await Truth.openDatabase();
  let working = await Integration.latestWorkingModel(database, sourceId);
  const session = await Integration.resolveSession(database, sourceId);
  title.textContent = working.payload.items[0].title;
  version.textContent = String(working.version);
  renderMessages((await Persistence.restoreConversation(database, session.conversation_id)).messages);
  database.close();
  status.textContent = "Synthetic Candidate ready";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    form.querySelector("button").disabled = true;
    status.textContent = "Running production response resolution…";
    database = await Truth.openDatabase();
    try {
      const outcome = await Integration.executeListTurn({
        database,
        session,
        focus: { type: "ITEM", item_id: "item-work-001" },
        human_message: input.value,
        runtime_snapshot: Integration.createRuntimeSnapshot(),
        call_runtime: callRuntime,
      });
      working = await Integration.latestWorkingModel(database, sourceId);
      const restored = await Persistence.restoreConversation(database, session.conversation_id);
      title.textContent = working.payload.items[0].title;
      version.textContent = String(working.version);
      renderMessages(restored.messages);
      if (outcome.status !== "SUCCEEDED" || !["APPLIED", "NO_CHANGE"].includes(outcome.turn.state)) throw new Error("synthetic_resolution_not_completed");
      document.body.dataset.resolutionResult = "pass";
      document.body.dataset.turnState = outcome.turn.state;
      status.textContent = "LOCAL RESPONSE RESOLUTION PASS";
    } catch (error) {
      document.body.dataset.resolutionResult = `failed:${String(error?.code || error?.message || error).slice(0, 120)}`;
      status.textContent = "LOCAL RESPONSE RESOLUTION FAILED";
      throw error;
    } finally {
      database.close();
      form.querySelector("button").disabled = false;
    }
  });
}()).catch((error) => {
  document.body.dataset.resolutionResult = `failed:${String(error?.message || error).slice(0, 120)}`;
  document.querySelector("#status").textContent = "LOCAL RESPONSE RESOLUTION FAILED";
});
