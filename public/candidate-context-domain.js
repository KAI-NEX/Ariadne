(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CandidateContextDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_ID = "job-radar-candidate-context-v2-step1";
  const ITEM_TYPES = ["PROFILE", "WORK_EXPERIENCE", "PROJECT", "EDUCATION", "OTHER"];
  const REVIEW_STATUSES = ["NEEDS_REVIEW", "CONFIRMED", "REJECTED", "SUPERSEDED"];
  const PATCH_STATUSES = ["PROPOSED", "CONFIRMED", "REJECTED", "SUPERSEDED"];
  const CHANGE_SOURCES = ["DIRECT_EDIT", "AI_ASSISTED_CORRECTION", "QUESTION_ANSWER", "USER_ADDITION"];
  const PROCESSING_STATES = ["CREATED", "PREPARING", "AWAITING_CONSENT", "SENDING", "WAITING_FOR_MODEL", "RECEIVED", "VALIDATING", "BUILDING_PROPOSAL", "READY_FOR_REVIEW", "FAILED"];
  const FAILURE_LAYERS = ["Source", "Transport", "Provider", "Model", "Parsing", "Contract Validation", "Grounding", "Review", "Persistence", "UI"];
  const SUPPORT_RELATIONS = ["EXPLICIT_SOURCE", "AI_DERIVED", "USER_ADDED", "USER_CONFIRMED"];
  const PATCH_PATHS = ["/title", "/subtitle", "/time", "/summary", "/facts", "/ownership", "/source_refs", "/uncertainties"];
  const TRANSITIONS = {
    CREATED: ["PREPARING", "FAILED"], PREPARING: ["AWAITING_CONSENT", "FAILED"],
    AWAITING_CONSENT: ["SENDING", "FAILED"], SENDING: ["WAITING_FOR_MODEL", "FAILED"],
    WAITING_FOR_MODEL: ["RECEIVED", "FAILED"], RECEIVED: ["VALIDATING", "FAILED"],
    VALIDATING: ["BUILDING_PROPOSAL", "FAILED"], BUILDING_PROPOSAL: ["READY_FOR_REVIEW", "FAILED"],
    READY_FOR_REVIEW: [], FAILED: [],
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nowIso(now) { return (now || new Date()).toISOString(); }
  function errorsFor(value, validator) { const errors = []; validator(value, errors); return errors; }
  function requiredString(value, field, errors) { if (typeof value !== "string" || !value.trim()) errors.push(`invalid_${field}`); }
  function optionalString(value, field, errors) { if (value != null && typeof value !== "string") errors.push(`invalid_${field}`); }
  function requiredArray(value, field, errors) { if (!Array.isArray(value)) errors.push(`invalid_${field}`); }
  function validEnum(value, values, field, errors) { if (!values.includes(value)) errors.push(`invalid_${field}`); }

  function validateSourceRef(ref, errors, prefix = "source_ref") {
    if (!ref || typeof ref !== "object" || Array.isArray(ref)) { errors.push(`invalid_${prefix}`); return; }
    requiredString(ref.source_ref_id, `${prefix}_id`, errors);
    requiredString(ref.source_document_id, `${prefix}_document_id`, errors);
    requiredString(ref.location, `${prefix}_location`, errors);
    requiredString(ref.excerpt_or_reference, `${prefix}_excerpt_or_reference`, errors);
    validEnum(ref.support_relation, SUPPORT_RELATIONS, `${prefix}_support_relation`, errors);
  }

  function validateFact(fact, errors) {
    if (!fact || typeof fact !== "object" || Array.isArray(fact)) { errors.push("invalid_fact"); return; }
    requiredString(fact.fact_id, "fact_id", errors);
    requiredString(fact.label, "fact_label", errors);
    requiredString(fact.value, "fact_value", errors);
  }

  function validateUncertainty(uncertainty, errors) {
    if (!uncertainty || typeof uncertainty !== "object" || Array.isArray(uncertainty)) { errors.push("invalid_uncertainty"); return; }
    requiredString(uncertainty.uncertainty_id, "uncertainty_id", errors);
    requiredString(uncertainty.question, "uncertainty_question", errors);
    validEnum(uncertainty.affects, ["fact", "ownership", "outcome", "matching use"], "uncertainty_affects", errors);
    validEnum(uncertainty.status, ["OPEN", "RESOLVED", "DISMISSED"], "uncertainty_status", errors);
  }

  function validateCandidateItem(item, errors) {
    if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push("invalid_candidate_item"); return; }
    requiredString(item.item_id, "item_id", errors);
    validEnum(item.item_type, ITEM_TYPES, "item_type", errors);
    if (Object.hasOwn(item, "item_subtype")) {
      const subtypes = { WORK_EXPERIENCE: ["work_experience"], PROJECT: ["project"], EDUCATION: ["education"], OTHER: ["award", "skill_group", "language", "custom_section"] };
      validEnum(item.item_subtype, subtypes[item.item_type] || [], "item_subtype", errors);
    }
    requiredString(item.title, "item_title", errors);
    optionalString(item.subtitle, "item_subtitle", errors);
    optionalString(item.time, "item_time", errors);
    requiredString(item.summary, "item_summary", errors);
    requiredArray(item.facts, "item_facts", errors);
    (item.facts || []).forEach((fact) => validateFact(fact, errors));
    optionalString(item.ownership, "item_ownership", errors);
    requiredArray(item.source_refs, "item_source_refs", errors);
    if (Array.isArray(item.source_refs) && !item.source_refs.length) errors.push("item_source_refs_required");
    (item.source_refs || []).forEach((ref) => validateSourceRef(ref, errors));
    requiredArray(item.uncertainties, "item_uncertainties", errors);
    (item.uncertainties || []).forEach((uncertainty) => validateUncertainty(uncertainty, errors));
    validEnum(item.review_status, REVIEW_STATUSES, "item_review_status", errors);
    if (!Number.isInteger(item.item_version) || item.item_version < 1) errors.push("invalid_item_version");
  }

  function validateCandidateProposal(proposal) {
    return errorsFor(proposal, (value, errors) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push("invalid_candidate_proposal"); return; }
      requiredString(value.candidate_proposal_id, "candidate_proposal_id", errors);
      requiredString(value.source_document_id, "proposal_source_document_id", errors);
      requiredString(value.processing_run_id, "proposal_processing_run_id", errors);
      requiredString(value.provider, "proposal_provider", errors);
      requiredString(value.model, "proposal_model", errors);
      requiredString(value.prompt_version, "proposal_prompt_version", errors);
      requiredArray(value.items, "proposal_items", errors);
      (value.items || []).forEach((item) => {
        validateCandidateItem(item, errors);
        if (item?.review_status !== "NEEDS_REVIEW") errors.push("proposal_item_must_need_review");
      });
    });
  }

  function validateCandidateContext(context) {
    return errorsFor(context, (value, errors) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push("invalid_candidate_context"); return; }
      requiredString(value.context_id, "context_id", errors);
      if (!Number.isInteger(value.current_version) || value.current_version < 0) errors.push("invalid_context_version");
      requiredArray(value.source_document_ids, "context_source_document_ids", errors);
      requiredArray(value.items, "context_items", errors);
      (value.items || []).forEach((item) => {
        validateCandidateItem(item, errors);
        if (item?.review_status !== "CONFIRMED") errors.push("context_item_must_be_confirmed");
      });
    });
  }

  function validateContextPatch(patch) {
    return errorsFor(patch, (value, errors) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) { errors.push("invalid_context_patch"); return; }
      requiredString(value.patch_id, "patch_id", errors);
      if (value.target_item_id != null) requiredString(value.target_item_id, "patch_target_item_id", errors);
      if (!Number.isInteger(value.base_context_version) || value.base_context_version < 0) errors.push("invalid_base_context_version");
      if (value.base_item_version != null && (!Number.isInteger(value.base_item_version) || value.base_item_version < 1)) errors.push("invalid_base_item_version");
      validEnum(value.change_source, CHANGE_SOURCES, "patch_change_source", errors);
      requiredArray(value.operations, "patch_operations", errors);
      if (Array.isArray(value.operations) && (!value.operations.length || value.operations.length > 32)) errors.push("invalid_patch_operation_count");
      (value.operations || []).forEach((operation) => {
        if (!operation || typeof operation !== "object" || Array.isArray(operation)) { errors.push("invalid_patch_operation"); return; }
        validEnum(operation.op, ["add", "replace", "remove"], "patch_operation", errors);
        validEnum(operation.path, PATCH_PATHS, "patch_operation_path", errors);
      });
      if (!value.before_snapshot || typeof value.before_snapshot !== "object") errors.push("invalid_before_snapshot");
      if (!value.after_preview || typeof value.after_preview !== "object") errors.push("invalid_after_preview");
      requiredString(value.reason, "patch_reason", errors);
      requiredArray(value.source_refs, "patch_source_refs", errors);
      (value.source_refs || []).forEach((ref) => validateSourceRef(ref, errors));
      validEnum(value.status, PATCH_STATUSES, "patch_status", errors);
    });
  }

  function createProcessingRun(input, now) {
    const createdAt = nowIso(now);
    const run = {
      contract_id: CONTRACT_ID, run_id: input?.run_id, purpose: input?.purpose,
      source_ids: clone(input?.source_ids || []), provider: input?.provider || null, model: input?.model || null,
      prompt_version: input?.prompt_version || null, delivery_method: input?.delivery_method || null,
      state: "CREATED", state_history: [{ state: "CREATED", at: createdAt }],
      timestamps: { created_at: createdAt, updated_at: createdAt }, usage: {}, consent_id: null,
      proposal_id: null, failure_layer: null, failure_code: null, retryable: null,
    };
    const errors = errorsFor(run, (value, errs) => { requiredString(value.run_id, "run_id", errs); requiredString(value.purpose, "run_purpose", errs); requiredArray(value.source_ids, "run_source_ids", errs); });
    if (errors.length) throw new Error(errors.join(","));
    return run;
  }

  function transitionProcessingRun(run, nextState, details = {}, now) {
    if (!run || !PROCESSING_STATES.includes(run.state)) throw new Error("invalid_processing_run");
    if (!TRANSITIONS[run.state].includes(nextState)) throw new Error("invalid_processing_run_transition");
    const at = nowIso(now);
    if (nextState === "FAILED" && (!FAILURE_LAYERS.includes(details.failure_layer) || !String(details.failure_code || "").trim())) throw new Error("failed_run_requires_failure_layer_and_code");
    return {
      ...clone(run), ...details, state: nextState,
      state_history: [...(run.state_history || []), { state: nextState, at }],
      timestamps: { ...(run.timestamps || {}), updated_at: at, [`${nextState.toLowerCase()}_at`]: at },
      failure_layer: nextState === "FAILED" ? details.failure_layer : null,
      failure_code: nextState === "FAILED" ? details.failure_code : null,
      retryable: nextState === "FAILED" ? Boolean(details.retryable) : null,
    };
  }

  function createProcessingConsent(input, now) {
    const createdAt = nowIso(now);
    if (!input?.consent_id || !input?.source_document_id || !input?.provider || !input?.purpose) throw new Error("invalid_processing_consent");
    return { contract_id: CONTRACT_ID, consent_id: input.consent_id, source_document_id: input.source_document_id, original_filename: input.original_filename || null, provider: input.provider, purpose: input.purpose, may_incur_cost: true, explicitly_confirmed: false, created_at: createdAt, confirmed_at: null };
  }

  function confirmProcessingConsent(consent, now) {
    if (!consent || consent.explicitly_confirmed) throw new Error("processing_consent_not_confirmable");
    const confirmedAt = nowIso(now);
    return { ...clone(consent), explicitly_confirmed: true, confirmed_at: confirmedAt };
  }

  return { CONTRACT_ID, ITEM_TYPES, REVIEW_STATUSES, PATCH_STATUSES, CHANGE_SOURCES, PROCESSING_STATES, FAILURE_LAYERS, SUPPORT_RELATIONS, validateCandidateProposal, validateCandidateContext, validateContextPatch, createProcessingRun, transitionProcessingRun, createProcessingConsent, confirmProcessingConsent };
});
