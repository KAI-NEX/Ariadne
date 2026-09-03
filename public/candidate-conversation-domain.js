"use strict";

(function attachCandidateConversation(root, factory) {
  const truth = root.AriadneTruthPersistence
    || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const api = factory(truth);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneCandidateConversation = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createCandidateConversation(Truth) {
  if (!Truth) throw new Error("candidate_conversation_truth_dependency_required");

  const CONTRACT_ID = "ariadne-candidate-conversation-v1";
  const ACTION_CONTRACT_ID = "ariadne-candidate-conversation-action-v1";
  const OPERATION = "CANDIDATE_CONVERSATION_TURN";
  const SUBJECT_TYPE = "CANDIDATE";
  const ACTIONS = Object.freeze(["NO_CHANGE", "PATCH_ITEM", "PATCH_MULTIPLE_ITEMS", "ASK_CLARIFICATION", "EXPLAIN"]);
  const UNSUPPORTED_ACTIONS = Object.freeze(["CREATE_ITEM", "REMOVE_ITEM", "MERGE_ITEMS"]);
  const OPERATIONS = Object.freeze(["SET_ITEM_FIELD", "CLEAR_ITEM_FIELD", "SET_FACT_VALUE", "SET_UNCERTAINTY_STATUS"]);
  const ITEM_FIELDS = Object.freeze(["title", "subtitle", "time", "summary", "ownership"]);
  const CLEARABLE_ITEM_FIELDS = Object.freeze(["subtitle", "time", "ownership"]);
  const UNCERTAINTY_STATUSES = Object.freeze(["OPEN", "RESOLVED", "DISMISSED"]);
  const STATES = Object.freeze(["CREATED", "SENDING", "RECEIVED", "VALIDATING", "APPLIED", "NO_CHANGE", "NEEDS_CLARIFICATION", "FAILED", "CANCELLED", "STALE"]);
  const TERMINAL_STATES = Object.freeze(["APPLIED", "NO_CHANGE", "NEEDS_CLARIFICATION", "FAILED", "CANCELLED", "STALE"]);
  const FAILURES = Object.freeze([
    "EMPTY_RESPONSE", "MALFORMED_RESPONSE", "TRUNCATED_OUTPUT", "EXACT_SCHEMA_FAILURE",
    "UNSUPPORTED_ACTION", "INVALID_TARGET", "FOCUS_VIOLATION", "IMPLICIT_MULTI_VIOLATION",
    "WRONG_RETURNED_MODEL", "STALE_WORKING_OBSERVATION", "CANCELLED_TURN",
    "UNSUPPORTED_OPERATION", "INVALID_OPERATION_TARGET", "INVALID_EVIDENCE_REF",
  ]);
  const TOP_LEVEL_KEYS = Object.freeze(["contract_id", "action", "message", "observed_working_model", "patches", "clarification"]);
  const OBSERVED_KEYS = Object.freeze(["candidate_context_id", "working_model_id", "version", "fingerprint"]);
  const PATCH_KEYS = Object.freeze(["target_item_id", "operations", "reason", "origin", "evidence_refs"]);
  const MULTI_INTENT_PATTERNS = Object.freeze([
    /(?:所有|全部|每一个|每个|统一这些|这些都|两项|这两|多个|跨(?:卡片|项目))/,
    /\b(?:all|every|both|multiple|across\s+(?:items|cards))\b/i,
  ]);
  const FACT_ASSERTION_PATTERNS = Object.freeze([/(?:其实是|实际上是|就是|确实是|为全职|是全职)/, /\b(?:actually|in fact|is|was|were)\b/i]);
  const WORDING_DIRECTIVE_PATTERNS = Object.freeze([/(?:改成|修改|替换|改为|不(?:要|需要).*(?:标题|重复)|删掉|清空)/, /\b(?:rename|rewrite|change|replace|remove|clear|do not repeat)\b/i]);

  class CandidateConversationError extends Error {
    constructor(code) { super(code); this.name = "CandidateConversationError"; this.code = code; }
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_error) { throw new CandidateConversationError("EXACT_SCHEMA_FAILURE"); }
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function exactKeys(value, keys, code = "EXACT_SCHEMA_FAILURE") {
    if (!isPlainObject(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
      throw new CandidateConversationError(code);
    }
    return value;
  }

  function requiredString(value, code = "EXACT_SCHEMA_FAILURE", maximum = 4000) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) throw new CandidateConversationError(code);
    return value.trim();
  }

  function nullableString(value, code = "EXACT_SCHEMA_FAILURE", maximum = 4000) {
    if (value === null) return null;
    return requiredString(value, code, maximum);
  }

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    if (!globalThis.crypto?.subtle) throw new CandidateConversationError("CRYPTO_UNAVAILABLE");
    return [...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function draftFingerprintFor(item) {
    if (!isPlainObject(item)) throw new CandidateConversationError("FOCUS_INVALID");
    return `sha256:${await sha256(canonicalJson(item))}`;
  }

  async function assertDraftIntegrity(observation, draft) {
    if (observation.focus.type !== "ITEM_DRAFT") return;
    if (!isPlainObject(draft) || draft.draft_fingerprint !== await draftFingerprintFor(draft.item)) {
      throw new CandidateConversationError("STALE_WORKING_OBSERVATION");
    }
  }

  function nowIso(now = new Date()) {
    const value = now instanceof Date ? now.toISOString() : String(now);
    if (Number.isNaN(Date.parse(value))) throw new CandidateConversationError("TURN_TIMESTAMP_INVALID");
    return value;
  }

  function conversationIdFor(candidateContextId) {
    return `candidate-conversation:${encodeURIComponent(requiredString(candidateContextId, "SUBJECT_ID_INVALID", 256))}`;
  }

  function createSession(candidateContextId, createdAt = new Date()) {
    const subjectId = requiredString(candidateContextId, "SUBJECT_ID_INVALID", 256);
    return Object.freeze({
      contract_id: CONTRACT_ID,
      conversation_id: conversationIdFor(subjectId),
      subject_type: SUBJECT_TYPE,
      subject_id: subjectId,
      created_at: nowIso(createdAt),
    });
  }

  function validateSession(session) {
    exactKeys(session, ["contract_id", "conversation_id", "subject_type", "subject_id", "created_at"]);
    if (session.contract_id !== CONTRACT_ID || session.subject_type !== SUBJECT_TYPE
      || session.conversation_id !== conversationIdFor(session.subject_id) || Number.isNaN(Date.parse(session.created_at))) {
      throw new CandidateConversationError("CONVERSATION_IDENTITY_INVALID");
    }
    return Object.freeze(clone(session));
  }

  function validateFocus(focus, workingModel) {
    if (!isPlainObject(focus) || !["CANDIDATE", "ITEM", "ITEM_DRAFT"].includes(focus.type)) throw new CandidateConversationError("FOCUS_INVALID");
    const expectedKeys = focus.type === "CANDIDATE" ? ["type"] : focus.type === "ITEM" ? ["type", "item_id"] : ["type", "item_id", "draft_fingerprint"];
    exactKeys(focus, expectedKeys);
    if (focus.type !== "CANDIDATE") {
      requiredString(focus.item_id, "FOCUS_INVALID", 256);
      if (!(workingModel.payload.items || []).some((item) => item.item_id === focus.item_id)) throw new CandidateConversationError("INVALID_TARGET");
    }
    if (focus.type === "ITEM_DRAFT" && !/^sha256:[a-f0-9]{64}$/.test(String(focus.draft_fingerprint || ""))) {
      throw new CandidateConversationError("FOCUS_INVALID");
    }
    return Object.freeze(clone(focus));
  }

  function createObservation({ candidate_context_id: candidateContextId, working_model: workingModel, focus }) {
    const current = Truth.validateCandidateWorkingModel(workingModel);
    const contextId = requiredString(candidateContextId, "SUBJECT_ID_INVALID", 256);
    return Object.freeze({
      contract_id: `${CONTRACT_ID}-observation-v1`,
      candidate_context_id: contextId,
      working_model_id: current.working_model_id,
      version: current.version,
      fingerprint: current.fingerprint,
      focus: validateFocus(focus, current),
    });
  }

  function observedWorkingModel(observation) {
    return Object.freeze(Object.fromEntries(OBSERVED_KEYS.map((key) => [key, observation[key]])));
  }

  function assertCurrentObservation(observation, session, currentWorkingModel, draft = null) {
    const current = Truth.validateCandidateWorkingModel(currentWorkingModel);
    const validSession = validateSession(session);
    if (observation.candidate_context_id !== validSession.subject_id
      || observation.working_model_id !== current.working_model_id
      || observation.version !== current.version
      || observation.fingerprint !== current.fingerprint) {
      throw new CandidateConversationError("STALE_WORKING_OBSERVATION");
    }
    if (observation.focus.type === "ITEM_DRAFT") {
      if (!isPlainObject(draft) || draft.item_id !== observation.focus.item_id || draft.draft_fingerprint !== observation.focus.draft_fingerprint) {
        throw new CandidateConversationError("STALE_WORKING_OBSERVATION");
      }
    }
    return current;
  }

  function hasExplicitMultiIntent(message) {
    const text = requiredString(message, "HUMAN_MESSAGE_INVALID", 8000);
    return MULTI_INTENT_PATTERNS.some((pattern) => pattern.test(text));
  }

  function evidenceIdsFor(item) {
    return new Set((item.grounding_refs || []).flatMap((ref) => [ref.source_ref_id, ref.grounding_ref_id].filter(Boolean)));
  }

  function validateOperation(operation, item) {
    if (!isPlainObject(operation) || !OPERATIONS.includes(operation.operation)) throw new CandidateConversationError("UNSUPPORTED_OPERATION");
    if (operation.operation === "SET_ITEM_FIELD") {
      exactKeys(operation, ["operation", "field", "value"]);
      if (!ITEM_FIELDS.includes(operation.field)) throw new CandidateConversationError("INVALID_OPERATION_TARGET");
      requiredString(operation.value, "EXACT_SCHEMA_FAILURE");
    } else if (operation.operation === "CLEAR_ITEM_FIELD") {
      exactKeys(operation, ["operation", "field"]);
      if (!CLEARABLE_ITEM_FIELDS.includes(operation.field)) throw new CandidateConversationError("INVALID_OPERATION_TARGET");
    } else if (operation.operation === "SET_FACT_VALUE") {
      exactKeys(operation, ["operation", "fact_id", "value"]);
      requiredString(operation.fact_id, "INVALID_OPERATION_TARGET", 256);
      requiredString(operation.value, "EXACT_SCHEMA_FAILURE");
      if (!(item.facts || []).some((fact) => fact.fact_id === operation.fact_id)) throw new CandidateConversationError("INVALID_OPERATION_TARGET");
    } else {
      exactKeys(operation, ["operation", "uncertainty_id", "status"]);
      requiredString(operation.uncertainty_id, "INVALID_OPERATION_TARGET", 256);
      if (!UNCERTAINTY_STATUSES.includes(operation.status)) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
      if (!(item.uncertainties || []).some((entry) => entry.uncertainty_id === operation.uncertainty_id)) throw new CandidateConversationError("INVALID_OPERATION_TARGET");
    }
    return Object.freeze(clone(operation));
  }

  function validatePatch(patch, itemById) {
    exactKeys(patch, PATCH_KEYS);
    const targetItemId = requiredString(patch.target_item_id, "INVALID_TARGET", 256);
    const item = itemById.get(targetItemId);
    if (!item) throw new CandidateConversationError("INVALID_TARGET");
    if (!Array.isArray(patch.operations) || !patch.operations.length || patch.operations.length > 32) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    requiredString(patch.reason, "EXACT_SCHEMA_FAILURE", 2000);
    if (patch.origin !== "MODEL_PROPOSAL") throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (!Array.isArray(patch.evidence_refs) || patch.evidence_refs.some((ref) => typeof ref !== "string" || !ref.trim())) {
      throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    }
    const knownEvidence = evidenceIdsFor(item);
    if (patch.evidence_refs.some((ref) => !knownEvidence.has(ref))) throw new CandidateConversationError("INVALID_EVIDENCE_REF");
    return Object.freeze({
      target_item_id: targetItemId,
      operations: Object.freeze(patch.operations.map((operation) => validateOperation(operation, item))),
      reason: patch.reason.trim(),
      origin: patch.origin,
      evidence_refs: Object.freeze([...patch.evidence_refs]),
    });
  }

  function validateAction(rawAction, { observation, working_model: workingModel, human_message: humanMessage, draft = null }) {
    exactKeys(rawAction, TOP_LEVEL_KEYS);
    if (rawAction.contract_id !== ACTION_CONTRACT_ID) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (UNSUPPORTED_ACTIONS.includes(rawAction.action) || !ACTIONS.includes(rawAction.action)) throw new CandidateConversationError("UNSUPPORTED_ACTION");
    if (typeof rawAction.message !== "string") throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (!Array.isArray(rawAction.patches)) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    nullableString(rawAction.clarification, "EXACT_SCHEMA_FAILURE", 4000);
    exactKeys(rawAction.observed_working_model, OBSERVED_KEYS);
    if (canonicalJson(rawAction.observed_working_model) !== canonicalJson(observedWorkingModel(observation))) {
      throw new CandidateConversationError("STALE_WORKING_OBSERVATION");
    }

    const current = Truth.validateCandidateWorkingModel(workingModel);
    const itemById = new Map((current.payload.items || []).map((item) => [item.item_id, item]));
    if (observation.focus.type === "ITEM_DRAFT") {
      if (!isPlainObject(draft) || draft.item_id !== observation.focus.item_id || draft.draft_fingerprint !== observation.focus.draft_fingerprint
        || !isPlainObject(draft.item) || draft.item.item_id !== draft.item_id) throw new CandidateConversationError("STALE_WORKING_OBSERVATION");
      itemById.set(draft.item_id, draft.item);
    }
    const patches = rawAction.patches.map((patch) => validatePatch(patch, itemById));
    const targets = new Set(patches.map((patch) => patch.target_item_id));
    const noPatchAction = ["NO_CHANGE", "ASK_CLARIFICATION", "EXPLAIN"].includes(rawAction.action);
    if (noPatchAction && patches.length) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (rawAction.action === "PATCH_ITEM" && (targets.size !== 1 || !patches.length)) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (rawAction.action === "PATCH_MULTIPLE_ITEMS" && (targets.size < 2 || patches.length < 2)) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (rawAction.action === "PATCH_MULTIPLE_ITEMS" && !hasExplicitMultiIntent(humanMessage)) throw new CandidateConversationError("IMPLICIT_MULTI_VIOLATION");
    if (rawAction.action === "ASK_CLARIFICATION" && !rawAction.clarification) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (rawAction.action !== "ASK_CLARIFICATION" && rawAction.clarification !== null) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");
    if (rawAction.action !== "ASK_CLARIFICATION" && !rawAction.message.trim()) throw new CandidateConversationError("EXACT_SCHEMA_FAILURE");

    const focus = observation.focus;
    if (focus.type === "ITEM_DRAFT" && [...targets].some((target) => target !== focus.item_id)) throw new CandidateConversationError("FOCUS_VIOLATION");
    if (focus.type === "ITEM" && [...targets].some((target) => target !== focus.item_id)) {
      if (rawAction.action !== "PATCH_MULTIPLE_ITEMS" || !hasExplicitMultiIntent(humanMessage) || !targets.has(focus.item_id)) {
        throw new CandidateConversationError("FOCUS_VIOLATION");
      }
    }
    return Object.freeze({ ...clone(rawAction), patches: Object.freeze(patches) });
  }

  function provenanceFor(humanMessage, operations) {
    const text = requiredString(humanMessage, "HUMAN_MESSAGE_INVALID", 8000);
    const factOnly = operations.every((operation) => ["SET_FACT_VALUE", "SET_UNCERTAINTY_STATUS"].includes(operation.operation));
    if (factOnly && FACT_ASSERTION_PATTERNS.some((pattern) => pattern.test(text))) return "USER_CONFIRMED";
    if (WORDING_DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text))) return "USER_EDITED";
    return "MODEL_INFERRED";
  }

  function applyOperations(item, operations) {
    const next = clone(item);
    operations.forEach((operation) => {
      if (operation.operation === "SET_ITEM_FIELD") next[operation.field] = operation.value.trim();
      else if (operation.operation === "CLEAR_ITEM_FIELD") next[operation.field] = null;
      else if (operation.operation === "SET_FACT_VALUE") {
        const fact = next.facts.find((entry) => entry.fact_id === operation.fact_id);
        fact.value = operation.value.trim();
      } else {
        const uncertainty = next.uncertainties.find((entry) => entry.uncertainty_id === operation.uncertainty_id);
        uncertainty.status = operation.status;
      }
    });
    next.item_version = Number.isInteger(next.item_version) ? next.item_version + 1 : 1;
    return next;
  }

  async function applyAction({ action, observation, session, current_working_model: currentWorkingModel, human_message: humanMessage, draft = null, created_at: createdAt = new Date() }) {
    await assertDraftIntegrity(observation, draft);
    const current = assertCurrentObservation(observation, session, currentWorkingModel, draft);
    const validated = validateAction(action, { observation, working_model: current, human_message: humanMessage, draft });
    if (!["PATCH_ITEM", "PATCH_MULTIPLE_ITEMS"].includes(validated.action)) {
      return Object.freeze({ action: validated, working_model: current, draft, mutation: "NONE", authority: Truth.AUTHORITY.working });
    }
    const patchByItem = new Map();
    validated.patches.forEach((patch) => patchByItem.set(patch.target_item_id, [...(patchByItem.get(patch.target_item_id) || []), ...patch.operations]));
    const at = nowIso(createdAt);
    if (observation.focus.type === "ITEM_DRAFT") {
      const operations = patchByItem.get(draft.item_id) || [];
      const nextItem = applyOperations(draft.item, operations);
      const nextFingerprint = `sha256:${await sha256(canonicalJson(nextItem))}`;
      return Object.freeze({
        action: validated,
        working_model: current,
        draft: Object.freeze({ item_id: draft.item_id, item: nextItem, draft_fingerprint: nextFingerprint }),
        mutation: "ITEM_DRAFT_ONLY",
        authority: Truth.AUTHORITY.working,
      });
    }

    const items = clone(current.payload.items || []).map((item, index) => {
      const operations = patchByItem.get(item.item_id);
      if (!operations) return item;
      const next = applyOperations(item, operations);
      const supportRelation = provenanceFor(humanMessage, operations);
      next.content_origin = supportRelation;
      next.working_provenance = {
        support_relation: supportRelation,
        updated_at: at,
        paths: operations.map((operation) => operation.operation === "SET_FACT_VALUE" ? `/items/${index}/facts/${operation.fact_id}`
          : operation.operation === "SET_UNCERTAINTY_STATUS" ? `/items/${index}/uncertainties/${operation.uncertainty_id}`
            : `/items/${index}/${operation.field}`),
      };
      return next;
    });
    const payload = { ...clone(current.payload), items };
    const fingerprint = `sha256:${await sha256(canonicalJson(payload))}`;
    const nextVersion = current.version + 1;
    const workingModel = Truth.validateCandidateWorkingModel({
      ...current,
      working_model_id: `${current.source_document_id}-working-v${nextVersion}-${fingerprint.slice(7, 19)}`,
      version: nextVersion,
      previous_working_model_id: current.working_model_id,
      fingerprint,
      created_at: at,
      payload,
      authority: Truth.AUTHORITY.working,
    });
    return Object.freeze({ action: validated, working_model: workingModel, draft, mutation: "NEW_WORKING_STATE", authority: Truth.AUTHORITY.working });
  }

  function defaultGeneration() {
    return globalThis.crypto?.randomUUID?.() || `generation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function createTurnExecution({ execution_id: executionId, session, observation, runtime_snapshot_id: runtimeSnapshotId, generation = defaultGeneration(), created_at: createdAt = new Date() }) {
    const validSession = validateSession(session);
    const at = nowIso(createdAt);
    return Object.freeze({
      contract_id: `${CONTRACT_ID}-turn-execution-v1`,
      execution_id: requiredString(executionId, "TURN_EXECUTION_ID_INVALID", 256),
      conversation_id: validSession.conversation_id,
      operation: OPERATION,
      generation: requiredString(generation, "TURN_GENERATION_INVALID", 256),
      observation: clone(observation),
      runtime_snapshot_id: requiredString(runtimeSnapshotId, "RUNTIME_SNAPSHOT_INVALID", 256),
      state: "CREATED",
      state_history: Object.freeze([{ state: "CREATED", at }]),
      failure_code: null,
      result_action: null,
      created_at: at,
      updated_at: at,
      cancelled_at: null,
    });
  }

  function transitionExecution(execution, nextState, { at = new Date(), failure_code: failureCode = null, result_action: resultAction = null } = {}) {
    if (!STATES.includes(execution?.state) || TERMINAL_STATES.includes(execution.state)) throw new CandidateConversationError("TURN_STATE_INVALID");
    const transitions = { CREATED: ["SENDING", "CANCELLED", "FAILED"], SENDING: ["RECEIVED", "CANCELLED", "FAILED"], RECEIVED: ["VALIDATING", "CANCELLED", "FAILED"], VALIDATING: TERMINAL_STATES };
    if (!transitions[execution.state]?.includes(nextState)) throw new CandidateConversationError("TURN_TRANSITION_INVALID");
    if (nextState === "FAILED") requiredString(failureCode, "TURN_FAILURE_INVALID", 256);
    const timestamp = nowIso(at);
    return Object.freeze({
      ...clone(execution), state: nextState,
      state_history: Object.freeze([...(execution.state_history || []), { state: nextState, at: timestamp }]),
      failure_code: nextState === "FAILED" ? failureCode : null,
      result_action: resultAction,
      updated_at: timestamp,
      cancelled_at: nextState === "CANCELLED" ? timestamp : null,
    });
  }

  function cancelExecution(execution, at = new Date()) {
    if (execution.state === "CANCELLED") return execution;
    return transitionExecution(execution, "CANCELLED", { at });
  }

  async function applyExecutionResult({ execution, generation, action, session, current_working_model: currentWorkingModel, human_message: humanMessage, draft = null, at = new Date() }) {
    if (execution.state === "CANCELLED" || execution.generation !== generation) throw new CandidateConversationError("CANCELLED_TURN");
    if (execution.state !== "VALIDATING") throw new CandidateConversationError("TURN_STATE_INVALID");
    try { await assertDraftIntegrity(execution.observation, draft); assertCurrentObservation(execution.observation, session, currentWorkingModel, draft); }
    catch (error) {
      if (error.code !== "STALE_WORKING_OBSERVATION") throw error;
      return Object.freeze({ execution: transitionExecution(execution, "STALE", { at }), application: null });
    }
    const application = await applyAction({ action, observation: execution.observation, session, current_working_model: currentWorkingModel, human_message: humanMessage, draft, created_at: at });
    const terminal = action.action === "ASK_CLARIFICATION" ? "NEEDS_CLARIFICATION" : action.action === "NO_CHANGE" || action.action === "EXPLAIN" ? "NO_CHANGE" : "APPLIED";
    return Object.freeze({ execution: transitionExecution(execution, terminal, { at, result_action: action.action }), application });
  }

  return Object.freeze({
    CONTRACT_ID, ACTION_CONTRACT_ID, OPERATION, SUBJECT_TYPE, ACTIONS, UNSUPPORTED_ACTIONS, OPERATIONS,
    ITEM_FIELDS, CLEARABLE_ITEM_FIELDS, UNCERTAINTY_STATUSES, STATES, TERMINAL_STATES, FAILURES,
    CandidateConversationError, conversationIdFor, createSession, validateSession, validateFocus,
    createObservation, observedWorkingModel, assertCurrentObservation, draftFingerprintFor, hasExplicitMultiIntent,
    validateAction, provenanceFor, applyAction, createTurnExecution, transitionExecution,
    cancelExecution, applyExecutionResult,
  });
}));
