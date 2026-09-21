"use strict";

(function attach(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneConversationTurnTransport = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function create(root) {
  function fallbackError(result, fallback) {
    const code = result?.error || fallback;
    const error = new Error(code);
    error.code = code;
    error.failure_layer = result?.failure_layer || "runtime";
    error.network_call_made = result?.network_call_made === true;
    error.diagnostics = result?.diagnostics;
    return error;
  }

  async function execute({
    request,
    domain,
    endpoint,
    fallback_error: fallback = "CONVERSATION_TURN_FAILED",
    malformed_error: malformed = "MALFORMED_RESPONSE",
    include_attachments: includeAttachments = true,
    create_error: createError = null,
  }) {
    if (!request || typeof domain !== "string" || !domain || typeof endpoint !== "string" || !endpoint.startsWith("/api/")) {
      throw new Error("CONVERSATION_TURN_TRANSPORT_INPUT_INVALID");
    }
    const attachments = includeAttachments ? root.AriadneConversationAttachments : null;
    let finished = false;
    try {
      const outbound = attachments ? await attachments.prepare(request, domain) : request;
      attachments?.stage(request, "MODEL_REQUEST");
      const response = await (root.AriadneTransport || root).fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outbound),
      });
      const result = await response.json().catch(() => ({ error: malformed }));
      if (!response.ok || result?.error) {
        throw createError ? createError({ response, result }) : fallbackError(result, fallback);
      }
      finished = true;
      attachments?.finish(request, true, null, result);
      return result;
    } catch (error) {
      if (!finished) attachments?.finish(request, false, error);
      throw error;
    }
  }

  return Object.freeze({ execute, fallbackError });
}));
