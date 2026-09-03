"use strict";

(function attachCandidateWorkspaceConversationRuntime(root, factory) {
  const runtime = root.AriadneRuntimeExecution
    || (typeof module === "object" && module.exports ? require("./runtime-capabilities.js") : null);
  const gate = root.JobRadarRuntimeGate
    || (typeof module === "object" && module.exports ? require("./runtime-capability-gate.js") : null);
  const truth = root.AriadneTruthPersistence
    || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const conversation = root.AriadneCandidateConversation
    || (typeof module === "object" && module.exports ? require("./candidate-conversation-domain.js") : null);
  const persistence = root.AriadneCandidateConversationPersistence
    || (typeof module === "object" && module.exports ? require("./candidate-conversation-persistence-domain.js") : null);
  const compiler = root.AriadneCandidateConversationContextCompiler
    || (typeof module === "object" && module.exports ? require("./candidate-conversation-context-compiler.js") : null);
  const api = factory(runtime, gate, truth, conversation, persistence, compiler);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneCandidateWorkspaceConversationRuntime = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createCandidateWorkspaceConversationRuntime(Runtime, RuntimeGate, Truth, Conversation, Persistence, Compiler) {
  if (!Runtime || !RuntimeGate || !Truth || !Conversation || !Persistence || !Compiler) {
    throw new Error("candidate_workspace_conversation_dependencies_required");
  }

  const PROVIDER = "deepseek";
  const MODEL = "deepseek-v4-pro";
  const PROTOCOL = "OPENAI_CHAT_COMPLETIONS";
  const ADAPTER_VERSION = "deepseek-candidate-conversation-v1";
  const PROMPT_VERSION = "candidate-conversation-semantic-prompt-v1";
  const ACTION_SCHEMA_VERSION = Conversation.ACTION_CONTRACT_ID;
  const REQUEST_CONFIG_VERSION = "deepseek-candidate-conversation-request-v1";
  const CAPABILITY_BASIS = "adapter_verified";
  const CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision";
  const RESULT_CONTRACT = `${Conversation.CONTRACT_ID}-runtime-result-v1`;
  const RESULT_KEYS = Object.freeze([
    "contract_id", "execution_id", "generation", "conversation_id", "operation", "provider", "model", "protocol",
    "runtime_snapshot_id", "finish_reason", "usage", "action", "authority", "network_call_made", "persistence",
  ]);

  class CandidateWorkspaceConversationError extends Error {
    constructor(code, details = {}) {
      super(code);
      this.name = "CandidateWorkspaceConversationError";
      this.code = code;
      Object.assign(this, details);
    }
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactKeys(value, keys, code) {
    if (!isPlainObject(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
      throw new CandidateWorkspaceConversationError(code);
    }
    return value;
  }

  function requiredText(value, code, maximum = 8000) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new CandidateWorkspaceConversationError(code);
    return value.trim();
  }

  function nowIso(now) {
    const value = typeof now === "function" ? now() : new Date();
    const result = value instanceof Date ? value.toISOString() : String(value);
    if (Number.isNaN(Date.parse(result))) throw new CandidateWorkspaceConversationError("TURN_TIMESTAMP_INVALID");
    return result;
  }

  function defaultId(prefix) {
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${suffix}`;
  }

  function runtimeSession(session) {
    return Object.freeze(Object.fromEntries(
      ["contract_id", "conversation_id", "subject_type", "subject_id", "created_at"].map((key) => [key, session[key]]),
    ));
  }

  function candidateContextIdFor(sourceDocumentId) {
    return `candidate-workspace-context-${requiredText(sourceDocumentId, "SESSION_SOURCE_INVALID", 256)}`;
  }

  async function resolveSession(database, sourceDocumentId, createdAt = new Date()) {
    const candidate = Persistence.createSession({
      candidate_context_id: candidateContextIdFor(sourceDocumentId),
      source_document_id: sourceDocumentId,
      created_at: createdAt,
    });
    try {
      return (await Persistence.restoreConversation(database, candidate.conversation_id)).session;
    } catch (error) {
      if (String(error?.code || error?.message) !== "SESSION_NOT_PERSISTED") throw error;
    }
    return Persistence.ensureSession(database, candidate);
  }

  function createRuntimeSnapshot({ snapshot_id: snapshotId, captured_at: capturedAt = new Date() } = {}) {
    const currentRuntime = { mode: "model", provider: PROVIDER, model: MODEL };
    return Runtime.createRuntimeSnapshot(currentRuntime, {
      modelDescriptor: RuntimeGate.CANDIDATE_CONVERSATION_MODEL_ADAPTER,
      snapshotId,
      capturedAt: capturedAt instanceof Date ? capturedAt.toISOString() : String(capturedAt),
      credentialRef: CREDENTIAL_REF,
      adapterVersion: ADAPTER_VERSION,
      promptVersion: PROMPT_VERSION,
      schemaVersion: ACTION_SCHEMA_VERSION,
      operation: Conversation.OPERATION,
      capabilityBasis: CAPABILITY_BASIS,
      actionSchemaVersion: ACTION_SCHEMA_VERSION,
      requestConfigVersion: REQUEST_CONFIG_VERSION,
      deliveryMethod: null,
    });
  }

  function latestWorkingModel(database, sourceDocumentId) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("candidate_working_models", "readonly");
      const request = transaction.objectStore("candidate_working_models").getAll();
      request.onsuccess = () => {
        try {
          const head = (request.result || []).map(Truth.validateCandidateWorkingModel)
            .filter((model) => model.source_document_id === sourceDocumentId)
            .sort((left, right) => right.version - left.version)[0] || null;
          if (!head) throw new CandidateWorkspaceConversationError("WORKING_MODEL_MISSING");
          resolve(head);
        } catch (error) { reject(error); }
      };
      request.onerror = () => reject(request.error || new CandidateWorkspaceConversationError("WORKING_MODEL_READ_FAILED"));
    });
  }

  function validateRuntimeResult(value, execution, session, snapshot) {
    const result = exactKeys(value, RESULT_KEYS, "RUNTIME_RESULT_SHAPE_INVALID");
    if (result.contract_id !== RESULT_CONTRACT || result.execution_id !== execution.execution_id
      || result.generation !== execution.generation || result.conversation_id !== session.conversation_id
      || result.operation !== Conversation.OPERATION || result.provider !== PROVIDER || result.model !== MODEL
      || result.protocol !== PROTOCOL || result.runtime_snapshot_id !== snapshot.snapshot_id
      || result.finish_reason !== "stop" || result.authority !== "NON_AUTHORITATIVE_WORKING_ACTION"
      || result.network_call_made !== true || result.persistence !== "not_written" || !isPlainObject(result.usage)) {
      throw new CandidateWorkspaceConversationError("RUNTIME_RESULT_IDENTITY_INVALID");
    }
    return result;
  }

  function createRuntimeRequest({ session: rawSession, human_message: rawHumanMessage, observation, working_model: workingModel, compiled_context: compiledContext, runtime_snapshot: snapshot, execution }) {
    const session = Persistence.validateSession(rawSession);
    const humanMessage = requiredText(rawHumanMessage, "HUMAN_MESSAGE_INVALID", Conversation.LIMITS.human_message);
    if (!isPlainObject(observation) || !isPlainObject(workingModel) || !isPlainObject(compiledContext) || !isPlainObject(snapshot) || !isPlainObject(execution)) {
      throw new CandidateWorkspaceConversationError("RUNTIME_REQUEST_INPUT_INVALID");
    }
    return Object.freeze({
      contract_id: `${Conversation.CONTRACT_ID}-runtime-request-v1`,
      conversation: runtimeSession(session),
      human_message: humanMessage,
      observation,
      working_model: workingModel,
      compiled_context: compiledContext,
      runtime_snapshot: snapshot,
      draft: null,
      turn: { execution_id: requiredText(execution.execution_id, "TURN_EXECUTION_ID_INVALID", 256), generation: requiredText(execution.generation, "TURN_GENERATION_INVALID", 256) },
    });
  }

  function failureCode(error) {
    const code = String(error?.code || error?.message || "CANDIDATE_CONVERSATION_FAILED").trim();
    return code && code.length <= 256 ? code : "CANDIDATE_CONVERSATION_FAILED";
  }

  function assertWorkingAuthorityCopy(action) {
    const text = action.action === "ASK_CLARIFICATION" ? action.clarification : action.message;
    if (/(?:已保存到个人资料|已确认|已写入正式资料|confirmed\s+profile|saved\s+to\s+(?:the\s+)?profile)/iu.test(String(text || ""))) {
      throw new CandidateWorkspaceConversationError("AUTHORITY_COPY_INVALID");
    }
  }

  async function executeListTurn({
    database,
    session: rawSession,
    human_message: rawHumanMessage,
    runtime_snapshot: rawSnapshot = null,
    call_runtime: callRuntime,
    id_factory: idFactory = defaultId,
    now = () => new Date(),
    on_user_persisted: onUserPersisted = null,
  }) {
    if (!database || typeof callRuntime !== "function") throw new CandidateWorkspaceConversationError("CONVERSATION_EXECUTION_DEPENDENCY_MISSING");
    const humanMessage = requiredText(rawHumanMessage, "HUMAN_MESSAGE_INVALID", Conversation.LIMITS.human_message);
    const session = Persistence.validateSession(rawSession);
    const sourceDocumentId = session.source_document_id;
    const initialWorkingModel = await latestWorkingModel(database, sourceDocumentId);
    const observation = Conversation.createObservation({
      candidate_context_id: session.subject_id,
      working_model: initialWorkingModel,
      focus: { type: "CANDIDATE" },
    });
    const snapshot = rawSnapshot ? Runtime.validateRuntimeSnapshot(rawSnapshot) : createRuntimeSnapshot();
    const executionId = idFactory("candidate-conversation-turn");
    const generation = idFactory("candidate-conversation-generation");
    const userMessageId = idFactory("candidate-conversation-user");
    let execution = Conversation.createTurnExecution({
      execution_id: executionId,
      session: runtimeSession(session),
      observation,
      runtime_snapshot_id: snapshot.snapshot_id,
      generation,
      created_at: nowIso(now),
    });
    execution = Conversation.transitionExecution(execution, "SENDING", { at: nowIso(now) });
    const userMessage = Persistence.createUserMessage({
      message_id: userMessageId,
      conversation_id: session.conversation_id,
      turn_id: executionId,
      text: humanMessage,
      created_at: execution.created_at,
    });
    let userPersisted = false;
    let validatingExecution = null;

    try {
      await Truth.persistRecord(database, "runtime_snapshots", snapshot);
      await Persistence.persistUserTurn(database, {
        session,
        user_message: userMessage,
        turn: Persistence.turnRecord(execution, { user_message_id: userMessage.message_id }),
      });
      userPersisted = true;
      if (typeof onUserPersisted === "function") await onUserPersisted(Object.freeze({ session, user_message: userMessage, execution }));

      const restored = await Persistence.restoreConversation(database, session.conversation_id);
      const compiledContext = Compiler.compileContext({
        session,
        working_model: initialWorkingModel,
        observation,
        messages: restored.messages,
        actions: restored.actions,
        current_user_message: userMessage,
      });
      const request = createRuntimeRequest({
        session,
        human_message: humanMessage,
        observation,
        working_model: initialWorkingModel,
        compiled_context: compiledContext,
        runtime_snapshot: snapshot,
        execution,
      });
      const rawResult = await callRuntime(request);
      execution = Conversation.transitionExecution(execution, "RECEIVED", { at: nowIso(now) });
      execution = Conversation.transitionExecution(execution, "VALIDATING", { at: nowIso(now) });
      validatingExecution = execution;
      const result = validateRuntimeResult(rawResult, execution, session, snapshot);
      const currentWorkingModel = await latestWorkingModel(database, sourceDocumentId);
      const outcome = await Conversation.applyExecutionResult({
        execution,
        generation,
        action: result.action,
        session: runtimeSession(session),
        current_working_model: currentWorkingModel,
        human_message: humanMessage,
        at: nowIso(now),
      });
      if (outcome.execution.state === "STALE") {
        const staleTurn = Persistence.turnRecord(outcome.execution, { user_message_id: userMessage.message_id, usage: result.usage });
        await Persistence.persistFailedTurn(database, staleTurn);
        return Object.freeze({ status: "STALE", session, user_message: userMessage, turn: staleTurn, action: null, working_model: currentWorkingModel, runtime_result: result });
      }

      assertWorkingAuthorityCopy(outcome.application.action);
      const actionRecord = await Persistence.createActionRecord({
        action_id: idFactory("candidate-conversation-action"),
        conversation_id: session.conversation_id,
        turn_id: execution.execution_id,
        originating_user_message_id: userMessage.message_id,
        observation,
        normalized_action: outcome.application.action,
        application: outcome.application,
        working_model: currentWorkingModel,
        human_message: humanMessage,
        created_at: nowIso(now),
      });
      const terminalTurn = Persistence.turnRecord(outcome.execution, {
        user_message_id: userMessage.message_id,
        action_id: actionRecord.action_id,
        usage: result.usage,
      });
      const assistantMessage = Persistence.createAssistantMessage({
        message_id: idFactory("candidate-conversation-assistant"),
        conversation_id: session.conversation_id,
        turn_id: execution.execution_id,
        text: outcome.application.action.action === "ASK_CLARIFICATION" ? outcome.application.action.clarification : outcome.application.action.message,
        provider: PROVIDER,
        model: MODEL,
        runtime_snapshot_id: snapshot.snapshot_id,
        candidate_action_id: actionRecord.action_id,
        created_at: nowIso(now),
      });
      const resultingWorkingModel = outcome.application.mutation === "NEW_WORKING_STATE" ? outcome.application.working_model : null;
      try {
        await Persistence.persistSuccessfulTurn(database, {
          turn: terminalTurn,
          action: actionRecord,
          assistant_message: assistantMessage,
          current_working_model: currentWorkingModel,
          resulting_working_model: resultingWorkingModel,
        });
      } catch (error) {
        if (String(error?.code || error?.message) !== "STALE_WORKING_OBSERVATION") throw error;
        const staleExecution = Conversation.transitionExecution(validatingExecution, "STALE", { at: nowIso(now) });
        const staleTurn = Persistence.turnRecord(staleExecution, { user_message_id: userMessage.message_id, usage: result.usage });
        await Persistence.persistFailedTurn(database, staleTurn);
        return Object.freeze({ status: "STALE", session, user_message: userMessage, turn: staleTurn, action: null, working_model: await latestWorkingModel(database, sourceDocumentId), runtime_result: result });
      }
      return Object.freeze({
        status: "SUCCEEDED",
        session,
        user_message: userMessage,
        assistant_message: assistantMessage,
        turn: terminalTurn,
        action: actionRecord,
        working_model: resultingWorkingModel || currentWorkingModel,
        runtime_result: result,
      });
    } catch (error) {
      if (!userPersisted) throw error;
      const activeExecution = validatingExecution || execution;
      if (!Conversation.TERMINAL_STATES.includes(activeExecution.state)) {
        const failedExecution = Conversation.transitionExecution(activeExecution, "FAILED", { at: nowIso(now), failure_code: failureCode(error) });
        await Persistence.persistFailedTurn(database, Persistence.turnRecord(failedExecution, { user_message_id: userMessage.message_id }));
      }
      if (error instanceof CandidateWorkspaceConversationError) throw error;
      throw new CandidateWorkspaceConversationError(failureCode(error), { cause: error });
    }
  }

  return Object.freeze({
    PROVIDER, MODEL, PROTOCOL, ADAPTER_VERSION, PROMPT_VERSION, ACTION_SCHEMA_VERSION, REQUEST_CONFIG_VERSION,
    CAPABILITY_BASIS, CREDENTIAL_REF, RESULT_CONTRACT, RESULT_KEYS, CandidateWorkspaceConversationError,
    candidateContextIdFor, runtimeSession, resolveSession, createRuntimeSnapshot, latestWorkingModel,
    validateRuntimeResult, createRuntimeRequest, executeListTurn,
  });
}));
