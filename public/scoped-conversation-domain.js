(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ScopedConversationDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_ID = "job-radar-scoped-conversation-v1";
  const SCOPE_TYPES = ["CANDIDATE_ITEM", "JOB"];
  const MESSAGE_ROLES = ["USER", "ASSISTANT"];
  const ERROR_CODES = ["AUTH_ERROR", "MODEL_UNAVAILABLE", "RATE_LIMITED", "TIMEOUT", "EMPTY_RESPONSE", "INVALID_RESPONSE", "UNSUPPORTED_CAPABILITY"];
  const RECENT_TURN_LIMIT = 8;
  const DEFAULT_SYSTEM_RULES = [
    "You are discussing only the current Ariadne object.",
    "Do not treat conversation text as confirmed Candidate Context.",
    "If a correction should change a Candidate Item, propose a separate reviewable Context Patch; never overwrite confirmed data.",
  ];
  const JOB_SYSTEM_RULES = [
    "You are discussing only the current Job object.",
    "Do not infer candidate fit, match scores, application advice, or confirmed career facts.",
    "Keep the conversation scoped to the supplied job summary and requirements.",
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso(now) { return (now || new Date()).toISOString(); }
  function requiredString(value, code) { if (typeof value !== "string" || !value.trim()) throw new Error(code); }
  function validIso(value, code) { requiredString(value, code); if (Number.isNaN(Date.parse(value))) throw new Error(code); }

  function conversationIdFor(scopeType, scopeId) {
    if (!SCOPE_TYPES.includes(scopeType)) throw new Error("unsupported_conversation_scope");
    requiredString(scopeId, "invalid_conversation_scope_id");
    return `conv_${scopeType.toLowerCase()}_${encodeURIComponent(scopeId.trim())}`;
  }

  function createSession(input, now) {
    const scopeType = input?.scope_type;
    const scopeId = input?.scope_id;
    const createdAt = nowIso(now);
    return {
      contract_id: CONTRACT_ID,
      conversation_id: conversationIdFor(scopeType, scopeId),
      scope_type: scopeType,
      scope_id: scopeId.trim(),
      created_at: createdAt,
      updated_at: createdAt,
    };
  }

  function validateSession(session) {
    try {
      if (!session || typeof session !== "object" || Array.isArray(session)) throw new Error("invalid_conversation_session");
      if (session.contract_id !== CONTRACT_ID) throw new Error("invalid_conversation_contract");
      if (!SCOPE_TYPES.includes(session.scope_type)) throw new Error("invalid_conversation_scope_type");
      requiredString(session.scope_id, "invalid_conversation_scope_id");
      if (session.conversation_id !== conversationIdFor(session.scope_type, session.scope_id)) throw new Error("invalid_conversation_id");
      validIso(session.created_at, "invalid_conversation_created_at");
      validIso(session.updated_at, "invalid_conversation_updated_at");
      return [];
    } catch (error) { return [error.message]; }
  }

  function validateCanonicalModelResult(result) {
    try {
      if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("invalid_canonical_model_result");
      requiredString(result.text, "invalid_model_result_text");
      requiredString(result.provider, "invalid_model_result_provider");
      requiredString(result.model, "invalid_model_result_model");
      requiredString(result.protocol, "invalid_model_result_protocol");
      if (result.finish_reason != null && typeof result.finish_reason !== "string") throw new Error("invalid_model_result_finish_reason");
      if (result.usage != null && (typeof result.usage !== "object" || Array.isArray(result.usage))) throw new Error("invalid_model_result_usage");
      if (result.warnings != null && !Array.isArray(result.warnings)) throw new Error("invalid_model_result_warnings");
      return [];
    } catch (error) { return [error.message]; }
  }

  function createUserMessage(input, now) {
    requiredString(input?.message_id, "invalid_conversation_message_id");
    requiredString(input?.conversation_id, "invalid_conversation_message_conversation_id");
    requiredString(input?.content, "invalid_conversation_message_content");
    return {
      message_id: input.message_id,
      conversation_id: input.conversation_id,
      role: "USER",
      content: input.content.trim(),
      created_at: nowIso(now),
    };
  }

  function createAssistantMessage(input, now) {
    requiredString(input?.message_id, "invalid_conversation_message_id");
    requiredString(input?.conversation_id, "invalid_conversation_message_conversation_id");
    const errors = validateCanonicalModelResult(input?.result);
    if (errors.length) throw new Error(errors.join(","));
    const result = input.result;
    return {
      message_id: input.message_id,
      conversation_id: input.conversation_id,
      role: "ASSISTANT",
      content: result.text.trim(),
      created_at: nowIso(now),
      provider: result.provider,
      model: result.model,
      protocol: result.protocol,
      processing_run_id: input.processing_run_id || null,
      usage: clone(result.usage || {}),
      finish_reason: result.finish_reason || null,
      warnings: clone(result.warnings || []),
    };
  }

  function validateMessage(message) {
    try {
      if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("invalid_conversation_message");
      requiredString(message.message_id, "invalid_conversation_message_id");
      requiredString(message.conversation_id, "invalid_conversation_message_conversation_id");
      if (!MESSAGE_ROLES.includes(message.role)) throw new Error("invalid_conversation_message_role");
      requiredString(message.content, "invalid_conversation_message_content");
      validIso(message.created_at, "invalid_conversation_message_created_at");
      if (message.role === "ASSISTANT") {
        requiredString(message.provider, "invalid_assistant_provider");
        requiredString(message.model, "invalid_assistant_model");
        requiredString(message.protocol, "invalid_assistant_protocol");
      }
      return [];
    } catch (error) { return [error.message]; }
  }

  function createConversationError(code, details = {}) {
    if (!ERROR_CODES.includes(code)) throw new Error("invalid_conversation_error_code");
    return { code, retryable: Boolean(details.retryable), message: String(details.message || code) };
  }

  function compileContext(input) {
    const sessionErrors = validateSession(input?.session);
    if (sessionErrors.length) throw new Error(sessionErrors.join(","));
    const candidateItem = input?.candidate_item;
    if (!candidateItem || typeof candidateItem !== "object" || Array.isArray(candidateItem)) throw new Error("invalid_context_candidate_item");
    requiredString(candidateItem.item_id, "invalid_context_candidate_item_id");
    if (input.session.scope_type !== "CANDIDATE_ITEM" || input.session.scope_id !== candidateItem.item_id) throw new Error("conversation_scope_candidate_mismatch");
    const userMessage = input?.user_message;
    if (validateMessage(userMessage).length || userMessage.role !== "USER" || userMessage.conversation_id !== input.session.conversation_id) throw new Error("invalid_context_user_message");
    const history = (input?.messages || []).filter((message) => validateMessage(message).length === 0 && message.conversation_id === input.session.conversation_id && message.message_id !== userMessage.message_id)
      .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
      .slice(-RECENT_TURN_LIMIT).map(clone);
    const relevantSource = input?.relevant_source == null ? null : clone(input.relevant_source);
    const relevantSourceImage = input?.relevant_source_image == null ? null : clone(input.relevant_source_image);
    if (relevantSourceImage && !relevantSource) throw new Error("conversation_image_requires_relevant_source");
    return {
      contract_id: CONTRACT_ID,
      conversation_id: input.session.conversation_id,
      scope: { type: input.session.scope_type, id: input.session.scope_id },
      system_rules: clone(input.system_rules || DEFAULT_SYSTEM_RULES),
      current_candidate_item: clone(candidateItem),
      relevant_source: relevantSource,
      // Text discussion is the normal path.  A source image enters context only
      // when the caller explicitly marks one relevant to this exact question.
      relevant_source_image: relevantSourceImage,
      recent_messages: history,
      current_user_message: clone(userMessage),
    };
  }

  function compileJobContext(input) {
    const sessionErrors = validateSession(input?.session);
    if (sessionErrors.length) throw new Error(sessionErrors.join(","));
    const job = input?.job;
    if (!job || typeof job !== "object" || Array.isArray(job)) throw new Error("invalid_context_job");
    requiredString(job.job_context_id, "invalid_context_job_id");
    if (input.session.scope_type !== "JOB" || input.session.scope_id !== job.job_context_id) throw new Error("conversation_scope_job_mismatch");
    const userMessage = input?.user_message;
    if (validateMessage(userMessage).length || userMessage.role !== "USER" || userMessage.conversation_id !== input.session.conversation_id) throw new Error("invalid_context_user_message");
    const history = (input?.messages || []).filter((message) => validateMessage(message).length === 0 && message.conversation_id === input.session.conversation_id && message.message_id !== userMessage.message_id)
      .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
      .slice(-RECENT_TURN_LIMIT).map(clone);
    return {
      contract_id: CONTRACT_ID,
      conversation_id: input.session.conversation_id,
      scope: { type: "JOB", id: input.session.scope_id },
      system_rules: clone(input.system_rules || JOB_SYSTEM_RULES),
      current_job: clone(job),
      recent_messages: history,
      current_user_message: clone(userMessage),
    };
  }

  return { CONTRACT_ID, SCOPE_TYPES, MESSAGE_ROLES, ERROR_CODES, RECENT_TURN_LIMIT, DEFAULT_SYSTEM_RULES, JOB_SYSTEM_RULES, conversationIdFor, createSession, validateSession, validateCanonicalModelResult, createUserMessage, createAssistantMessage, validateMessage, createConversationError, compileContext, compileJobContext };
});
