"use strict";

(function attachCandidateModelRuntime(root, factory) {
  const truth = root.AriadneTruthPersistence || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const candidate = root.CandidateContextDomain || (typeof module === "object" && module.exports ? require("./candidate-context-domain.js") : null);
  const lifecycle = root.AriadneModelImportLifecycle || (typeof module === "object" && module.exports ? require("./model-import-lifecycle-domain.js") : null);
  const api = factory(truth, candidate, lifecycle);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneCandidateModelRuntime = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createCandidateModelRuntime(Truth, Candidate, ModelImportLifecycle) {
  if (!Truth || !Candidate || !ModelImportLifecycle) throw new Error("candidate_model_runtime_dependencies_required");

  const PROVIDER_ID = "deepseek";
  const MODEL_ID = "deepseek-v4-flash-vision-exp";
  const PROTOCOL = "OPENAI_CHAT_COMPLETIONS";
  const ADAPTER_VERSION = "deepseek-candidate-multimodal-v2";
  const PROMPT_VERSION = "candidate_workspace_v2_item_types";
  const SCHEMA_VERSION = "job-radar-candidate-context-v2-step1";
  const DELIVERY_METHOD = "source_or_rendered_images";
  const CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision";
  const PAYLOAD_CONTRACT_ID = "ariadne-model-candidate-proposal-payload-v1";
  const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const now = () => new Date().toISOString();

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function sha256(value) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function runtimeFingerprint(snapshot) {
    return ModelImportLifecycle.runtimeFingerprint(snapshot);
  }

  async function operationIdentityFor(source, snapshot, consent) {
    return ModelImportLifecycle.operationIdentityFor({
      source_document_id: source.source_document_id,
      operation_type: "CANDIDATE_MODEL_STRUCTURING",
      operation_prefix: "candidate-model-op",
      snapshot,
      consent_id: consent.consent_id,
    });
  }

  function abortError() {
    if (typeof DOMException === "function") return new DOMException("candidate_model_cancelled", "AbortError");
    return Object.assign(new Error("candidate_model_cancelled"), { name: "AbortError" });
  }

  function assertEligibleGate(gate) {
    const runtime = gate?.authority?.runtime;
    const capability = gate?.authority?.capabilities;
    if (!gate?.allowed || gate.capability !== "candidate_model_structuring"
      || runtime?.mode !== "model" || !globalThis.JobRadarRuntimeGate?.isModelRuntimeEligible(runtime)
      || capability?.semantic_understanding !== "supported"
      || capability?.candidate_model_structuring !== "supported"
      || capability?.vision !== "supported") {
      throw new Error("candidate_model_runtime_not_eligible");
    }
    return gate;
  }

  function assertMultimodalSource(source) {
    const name = String(source?.file?.name || source?.filename || "").toLowerCase();
    const pdf = source?.source_type === "PDF" && source?.mime_type === "application/pdf" && name.endsWith(".pdf");
    const image = source?.source_type === "IMAGE" && ["image/png", "image/jpeg"].includes(source?.mime_type) && /\.(?:png|jpe?g)$/.test(name);
    const docx = source?.source_type === "DOCX" && source?.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && name.endsWith(".docx");
    if (!pdf && !image && !docx) throw new Error("candidate_model_multimodal_source_required");
    return source;
  }

  const assertPdfSource = assertMultimodalSource;

  function processingRunFor(source, snapshotId, status = "PENDING", createdAt = now(), patch = {}) {
    const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
    return Truth.validateProcessingRun({
      contract_id: "ariadne-processing-run-v1",
      run_id: patch.run_id || id("run-candidate-model"),
      operation_type: "CANDIDATE_MODEL_STRUCTURING",
      source_document_id: source.source_document_id,
      batch_id: source.batch_id,
      runtime_snapshot_id: snapshotId,
      started_at: status === "PENDING" ? null : (patch.started_at || createdAt),
      finished_at: terminal ? (patch.finished_at || createdAt) : null,
      status,
      error_code: patch.error_code || null,
      output_artifact_ids: [],
      proposal_ids: patch.proposal_ids || [],
      authority: Truth.AUTHORITY.execution,
    });
  }

  function claimProcessingRun(database, pendingRun) {
    return ModelImportLifecycle.claimProcessingRun(database, pendingRun, "candidate_model_processing_run_claim_failed");
  }

  function truthRef(ref) {
    return {
      source_document_id: ref.source_document_id,
      location: ref.location,
      excerpt_or_reference: ref.excerpt_or_reference,
    };
  }

  function itemFor(item) {
    const otherLabels = (item.facts || []).map((fact) => `${fact.label} ${fact.value}`.toLowerCase()).join(" ");
    const subtype = item.item_type === "OTHER" && /award|honou?r|奖|荣誉/.test(otherLabels) ? "award"
      : item.item_type === "OTHER" && /skill|能力|技能|工具/.test(otherLabels) ? "skill_group"
        : { WORK_EXPERIENCE: "work_experience", PROJECT: "project", EDUCATION: "education", OTHER: "custom_section" }[item.item_type] || "custom_section";
    return {
      item_id: item.item_id,
      item_type: item.item_type,
      item_subtype: subtype,
      title: item.title,
      subtitle: item.subtitle || null,
      time: item.time || null,
      summary: item.summary,
      facts: structuredClone(item.facts || []),
      ownership: item.ownership || null,
      grounding_refs: (item.source_refs || []).map(truthRef),
      confidence: "low",
      warnings: ["model_inferred_non_authoritative"],
      uncertainties: structuredClone(item.uncertainties || []),
      review_status: "NEEDS_REVIEW",
      content_origin: "MODEL_PROPOSAL",
    };
  }

  const normalizedText = (value) => String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  function factValue(item, labels) {
    const match = (item.facts || []).find((fact) => labels.some((label) => normalizedText(fact.label).includes(label)));
    return normalizedText(match?.value);
  }
  function exactContentIdentity(item) {
    return canonicalJson({ item_type: item.item_type, item_subtype: item.item_subtype, title: normalizedText(item.title), subtitle: normalizedText(item.subtitle), time: normalizedText(item.time), summary: normalizedText(item.summary), facts: (item.facts || []).map((fact) => [normalizedText(fact.label), normalizedText(fact.value)]).sort(), grounding: (item.grounding_refs || []).map((ref) => [normalizedText(ref.location), normalizedText(ref.excerpt_or_reference)]).sort() });
  }
  function semanticIdentity(item) {
    const common = { type: item.item_type, subtype: item.item_subtype, title: normalizedText(item.title), time: normalizedText(item.time) };
    if (item.item_type === "WORK_EXPERIENCE") return canonicalJson({ ...common, organization: normalizedText(item.subtitle) || factValue(item, ["organization", "company", "组织", "公司"]), role: factValue(item, ["role", "title", "职位", "角色"]) || normalizedText(item.title) });
    if (item.item_type === "PROJECT") return canonicalJson({ ...common, ownership: normalizedText(item.ownership), organization: normalizedText(item.subtitle) });
    if (item.item_type === "EDUCATION") return canonicalJson({ ...common, institution: normalizedText(item.subtitle) });
    if (item.item_subtype === "award") return canonicalJson({ ...common, issuer: normalizedText(item.subtitle) || factValue(item, ["issuer", "awarder", "颁发", "机构"]) });
    if (item.item_subtype === "skill_group") return canonicalJson({ ...common, capability: factValue(item, ["skill", "capability", "能力", "技能"]), evidence: normalizedText(item.summary) });
    return canonicalJson(common);
  }
  function ambiguityIdentity(item) {
    return `${item.item_type}|${normalizedText(item.title)}|${normalizedText(item.subtitle)}`;
  }
  function dedupeItems(items) {
    const accepted = [];
    const exact = new Map();
    const semantic = new Map();
    for (const original of items) {
      const item = structuredClone(original);
      const exactKey = exactContentIdentity(item);
      const semanticKey = semanticIdentity(item);
      const duplicate = exact.get(exactKey) || semantic.get(semanticKey);
      if (duplicate) {
        duplicate.grounding_refs = [...duplicate.grounding_refs, ...(item.grounding_refs || [])].filter((ref, index, refs) => refs.findIndex((candidate) => canonicalJson(candidate) === canonicalJson(ref)) === index);
        duplicate.uncertainties = [...duplicate.uncertainties, ...(item.uncertainties || [])].filter((uncertainty, index, values) => values.findIndex((candidate) => candidate.question === uncertainty.question) === index);
        duplicate.dedupe_state = "deduplicated";
        continue;
      }
      item.dedupe_state = "unique";
      const ambiguous = accepted.find((candidate) => ambiguityIdentity(candidate) === ambiguityIdentity(item)
        && semanticIdentity(candidate) !== semanticKey
        && (!normalizedText(candidate.time) || !normalizedText(item.time) || !normalizedText(candidate.subtitle) || !normalizedText(item.subtitle)));
      if (ambiguous) {
        ambiguous.dedupe_state = "needs_resolution";
        item.dedupe_state = "needs_resolution";
      }
      accepted.push(item);
      exact.set(exactKey, item);
      semantic.set(semanticKey, item);
    }
    return accepted;
  }

  function proposalsFor({ source, run, result, operationIdentity, snapshot = { provider: PROVIDER_ID, model: MODEL_ID, protocol: PROTOCOL, adapter_version: ADAPTER_VERSION } }) {
    assertMultimodalSource(source);
    if (result?.provider !== snapshot.provider || result?.model !== snapshot.model || result?.protocol !== snapshot.protocol
      || result?.adapter_version !== snapshot.adapter_version || result?.delivery_method !== DELIVERY_METHOD
      || result?.runtime_snapshot_id !== run.runtime_snapshot_id || result?.processing_run_id !== run.run_id
      || result?.operation_id !== operationIdentity?.operation_id
      || result?.source_document_id !== source.source_document_id || result?.content_hash !== source.content_hash
      || result?.network_call_made !== true || !Number.isInteger(result?.rendered_page_count)
      || (source.source_type === "DOCX"
        ? result.source_delivery !== "docx_text_and_embedded_images_v1" || result.rendered_page_count !== 0 || !Number.isInteger(result.outbound_image_count) || result.outbound_image_count < 0 || result.outbound_image_count > 48
        : result.rendered_page_count < 1 || result.outbound_image_count !== result.rendered_page_count)) {
      throw new Error("candidate_model_response_contract_failed");
    }
    const modelProposal = result.candidate_proposal;
    const errors = Candidate.validateCandidateProposal(modelProposal);
    if (errors.length || modelProposal.source_document_id !== source.source_document_id
      || modelProposal.processing_run_id !== run.run_id || modelProposal.provider !== snapshot.provider
      || modelProposal.model !== snapshot.model || modelProposal.prompt_version !== PROMPT_VERSION
      || modelProposal.review_status !== "NEEDS_REVIEW") {
      throw new Error("candidate_model_proposal_contract_failed");
    }
    if (!["resume", "portfolio", "project", "other"].includes(modelProposal.material_type)) throw new Error("candidate_model_material_type_invalid");
    const groundedItems = modelProposal.items.map(itemFor);
    groundedItems.forEach((item) => {
      if (!item.grounding_refs.length || item.grounding_refs.some((ref) => ref.source_document_id !== source.source_document_id)) {
        throw new Error("candidate_model_grounding_validation_failed");
      }
    });
    const dedupedItems = dedupeItems(groundedItems);
    return dedupedItems.map((item, index) => {
      const grounding = item.grounding_refs;
      if (!grounding.length || grounding.some((ref) => ref.source_document_id !== source.source_document_id)) {
        throw new Error("candidate_model_grounding_validation_failed");
      }
      return Truth.validateProposal({
        contract_id: "ariadne-context-proposal-v1",
        proposal_id: `${operationIdentity.operation_id}-proposal-${index + 1}`,
        proposal_type: "CANDIDATE_CONTEXT",
        source_document_ids: [source.source_document_id],
        processing_run_id: run.run_id,
        runtime_snapshot_id: run.runtime_snapshot_id,
        status: "AWAITING_REVIEW",
        created_at: now(),
        payload: {
          contract_id: PAYLOAD_CONTRACT_ID,
          provider: snapshot.provider,
          model: snapshot.model,
          adapter_version: snapshot.adapter_version,
          prompt_version: PROMPT_VERSION,
          schema_version: SCHEMA_VERSION,
          delivery_method: DELIVERY_METHOD,
          provider_response_id: result.provider_response_id || null,
          rendered_page_count: result.rendered_page_count,
          operation_id: operationIdentity.operation_id,
          candidate_material_type: modelProposal.material_type,
          candidate_material_type_source: "MODEL_INFERRED",
          items: [item],
          manual_review_required: false,
          working_projection: true,
          provenance_layers: ["SOURCE_EVIDENCE", "MODEL_INFERRED"],
          unstructured_evidence_reason: null,
        },
        grounding_refs: grounding,
        warnings: ["MODEL_OUTPUT_NON_AUTHORITATIVE"],
        uncertainties: structuredClone(item.uncertainties),
        authority: Truth.AUTHORITY.proposal,
      });
    });
  }

  function workingCardsFor(proposals) {
    const modelProposals = (proposals || []).filter((proposal) => proposal?.payload?.contract_id === PAYLOAD_CONTRACT_ID && proposal.authority === Truth.AUTHORITY.proposal);
    const sourceIds = new Set(modelProposals.flatMap((proposal) => proposal.source_document_ids || []));
    if (sourceIds.size > 1) throw new Error("candidate_working_projection_source_scope_required");
    return dedupeItems(modelProposals.flatMap((proposal) => proposal.payload.items || [])).map((item) => Object.freeze({
      ...item,
      authority: Truth.AUTHORITY.proposal,
      workspace_state: "WORKING_PROPOSAL",
      source_document_id: [...sourceIds][0] || null,
    }));
  }

  async function candidateWorkingModelFor(proposals, previousModel = null, createdAt = now()) {
    const modelProposals = (proposals || []).map(Truth.validateProposal).filter((proposal) => proposal.payload?.contract_id === PAYLOAD_CONTRACT_ID);
    if (!modelProposals.length) throw new Error("candidate_working_model_proposals_required");
    const cards = workingCardsFor(modelProposals).map((card) => {
      const item = structuredClone(card);
      delete item.authority;
      delete item.workspace_state;
      delete item.source_document_id;
      return item;
    });
    const sourceIds = new Set(modelProposals.flatMap((proposal) => proposal.source_document_ids));
    const runIds = new Set(modelProposals.map((proposal) => proposal.processing_run_id));
    const snapshotIds = new Set(modelProposals.map((proposal) => proposal.runtime_snapshot_id));
    if (sourceIds.size !== 1 || runIds.size !== 1 || snapshotIds.size !== 1) throw new Error("candidate_working_model_lineage_invalid");
    const previous = previousModel ? Truth.validateCandidateWorkingModel(previousModel) : null;
    const sourceDocumentId = [...sourceIds][0];
    if (previous && previous.source_document_id !== sourceDocumentId) throw new Error("candidate_working_model_source_mismatch");
    const payload = {
      contract_id: "ariadne-candidate-working-payload-v1",
      material_type: modelProposals[0].payload.candidate_material_type,
      items: cards,
    };
    const fingerprint = `sha256:${await sha256(canonicalJson(payload))}`;
    const version = (previous?.version || 0) + 1;
    return Truth.validateCandidateWorkingModel({
      contract_id: "ariadne-candidate-working-model-v1",
      working_model_id: `${sourceDocumentId}-working-v${version}-${fingerprint.slice(7, 19)}`,
      source_document_id: sourceDocumentId,
      processing_run_id: [...runIds][0],
      runtime_snapshot_id: [...snapshotIds][0],
      proposal_ids: modelProposals.map((proposal) => proposal.proposal_id),
      version,
      previous_working_model_id: previous?.working_model_id || null,
      fingerprint,
      created_at: createdAt,
      payload,
      authority: Truth.AUTHORITY.working,
    });
  }

  async function editedCandidateWorkingModel(currentModel, itemId, patch, createdAt = now(), supportRelation = "USER_EDITED") {
    const current = Truth.validateCandidateWorkingModel(currentModel);
    if (!["USER_EDITED", "USER_CONFIRMED"].includes(supportRelation)) throw new Error("candidate_working_edit_support_relation_invalid");
    const items = structuredClone(current.payload.items || []);
    const index = items.findIndex((item) => item.item_id === itemId);
    if (index < 0) throw new Error("candidate_working_item_not_found");
    const title = String(patch?.title || "").trim();
    if (!title) throw new Error("candidate_working_edit_title_required");
    const original = items[index];
    items[index] = {
      ...original,
      title,
      category: patch.category === undefined ? original.category || null : String(patch.category || "").trim() || null,
      subtitle: String(patch.subtitle || "").trim() || null,
      time: String(patch.time || "").trim() || null,
      summary: String(patch.summary || "").trim() || null,
      ownership: patch.ownership === undefined ? original.ownership || null : String(patch.ownership || "").trim() || null,
      facts: (patch.facts || []).map((value, factIndex) => ({ fact_id: original.facts?.[factIndex]?.fact_id || `working-fact-${factIndex + 1}`, label: original.facts?.[factIndex]?.label || "用户补充", value: String(value).trim() })).filter((fact) => fact.value),
      content_origin: supportRelation,
      working_provenance: { support_relation: supportRelation, updated_at: createdAt, paths: [`/items/${index}`] },
    };
    const payload = { ...structuredClone(current.payload), items };
    const fingerprint = `sha256:${await sha256(canonicalJson(payload))}`;
    return Truth.validateCandidateWorkingModel({
      ...current,
      working_model_id: `${current.source_document_id}-working-v${current.version + 1}-${fingerprint.slice(7, 19)}`,
      version: current.version + 1,
      previous_working_model_id: current.working_model_id,
      fingerprint,
      created_at: createdAt,
      payload,
    });
  }

  function confirmedItemState(item) {
    return {
      item_id: item?.item_id,
      item_type: item?.item_type,
      item_subtype: item?.item_subtype,
      category: item?.category || null,
      title: item?.title,
      subtitle: item?.subtitle || null,
      time: item?.time || null,
      summary: item?.summary || null,
      facts: structuredClone(item?.facts || []),
      ownership: item?.ownership || null,
      grounding_refs: structuredClone(item?.grounding_refs || item?.source_refs || []),
    };
  }

  function workingItemFromConfirmed(item, createdAt) {
    const state = confirmedItemState(item);
    const subtype = state.item_subtype || {
      WORK_EXPERIENCE: "work_experience", PROJECT: "project", EDUCATION: "education", OTHER: "custom_section",
    }[state.item_type] || "custom_section";
    return {
      ...structuredClone(item),
      ...state,
      item_subtype: subtype,
      confidence: item.confidence || "unknown",
      warnings: structuredClone(item.warnings || []),
      uncertainties: structuredClone(item.uncertainties || []),
      review_status: "CONFIRMED",
      content_origin: "USER_CONFIRMED",
      dedupe_state: item.dedupe_state || "unique",
      working_provenance: { support_relation: "USER_CONFIRMED", updated_at: createdAt, paths: ["/items"] },
    };
  }

  async function synchronizedCandidateWorkingModel(currentModel, confirmedRevision, itemId, sourceDocumentId, createdAt = now()) {
    const revision = Truth.validateContextRevision(confirmedRevision);
    const sourceId = String(sourceDocumentId || "").trim();
    if (revision.context_type !== "CANDIDATE" || !sourceId || !revision.provenance.source_document_ids.includes(sourceId)) {
      throw new Error("candidate_confirmed_working_source_mismatch");
    }
    const confirmedItem = (revision.payload.items || []).find((item) => item.item_id === itemId);
    if (!confirmedItem) throw new Error("candidate_confirmed_working_item_missing");
    const current = currentModel ? Truth.validateCandidateWorkingModel(currentModel) : null;
    if (current && current.source_document_id !== sourceId) throw new Error("candidate_working_model_source_mismatch");
    const items = structuredClone(current?.payload?.items || []);
    const index = items.findIndex((item) => item.item_id === itemId);
    if (index >= 0) return current;
    const synchronizedItem = workingItemFromConfirmed(confirmedItem, createdAt);
    items.push(synchronizedItem);
    const payload = {
      ...(current ? structuredClone(current.payload) : {}),
      contract_id: "ariadne-candidate-working-payload-v1",
      material_type: current?.payload?.material_type || revision.payload.candidate_material_type || revision.payload.material_type || "other",
      items,
    };
    const fingerprint = `sha256:${await sha256(canonicalJson(payload))}`;
    const version = (current?.version || 0) + 1;
    const proposalIds = current?.proposal_ids || (revision.contract_id === "ariadne-context-revision-v1" ? [revision.confirmed_from_proposal_id] : null);
    if (!proposalIds?.length) throw new Error("candidate_confirmed_working_lineage_missing");
    return Truth.validateCandidateWorkingModel({
      contract_id: "ariadne-candidate-working-model-v1",
      working_model_id: `${sourceId}-working-v${version}-${fingerprint.slice(7, 19)}`,
      source_document_id: sourceId,
      processing_run_id: current?.processing_run_id || revision.provenance.processing_run_id,
      runtime_snapshot_id: current?.runtime_snapshot_id || revision.provenance.runtime_snapshot_id,
      proposal_ids: proposalIds,
      version,
      previous_working_model_id: current?.working_model_id || null,
      fingerprint,
      created_at: createdAt,
      payload,
      authority: Truth.AUTHORITY.working,
    });
  }

  function consentFor(source, snapshot, confirmedAt = now(), consentId = id("consent-candidate-model")) {
    assertMultimodalSource(source);
    return ModelImportLifecycle.consentFor({ source_document_id: source.source_document_id, snapshot, confirmed_at: confirmedAt, consent_id: consentId });
  }

  function requestFor({ source, sourceDocument, documentDataUrl, snapshot, run, consent, operationIdentity }) {
    assertMultimodalSource(source);
    const expectedPrefix = source.source_type === "PDF" ? "data:application/pdf;base64," : `data:${source.mime_type};base64,`;
    if (!sourceDocument?.local_reference || !documentDataUrl?.startsWith(expectedPrefix)) throw new Error("candidate_model_source_not_resolved");
    return Object.freeze({
      source_document: structuredClone(sourceDocument),
      document_data_url: documentDataUrl,
      runtime_snapshot: structuredClone(snapshot),
      processing_run_id: run.run_id,
      consent: structuredClone(consent),
      operation_identity: structuredClone(operationIdentity),
    });
  }

  function persistSuccessfulResult(database, runningRun, proposals, signal, isActive = () => true) {
    const succeeded = processingRunFor({ source_document_id: runningRun.source_document_id, batch_id: runningRun.batch_id }, runningRun.runtime_snapshot_id, "SUCCEEDED", runningRun.started_at, {
      run_id: runningRun.run_id,
      started_at: runningRun.started_at,
      finished_at: now(),
      proposal_ids: proposals.map((proposal) => proposal.proposal_id),
    });
    return ModelImportLifecycle.persistClaimedProposals(database, {
      running_run: runningRun,
      succeeded_run: succeeded,
      proposals,
      signal,
      is_active: isActive,
      validate_run: Truth.validateProcessingRun,
      stale_code: "candidate_model_processing_run_stale",
      read_code: "candidate_model_processing_run_read_failed",
      persistence_code: "candidate_model_result_persistence_failed",
      abort_error: abortError,
    });
  }

  return Object.freeze({
    PROVIDER_ID,
    MODEL_ID,
    PROTOCOL,
    ADAPTER_VERSION,
    PROMPT_VERSION,
    SCHEMA_VERSION,
    DELIVERY_METHOD,
    CREDENTIAL_REF,
    PAYLOAD_CONTRACT_ID,
    assertEligibleGate,
    assertMultimodalSource,
    assertPdfSource,
    runtimeFingerprint,
    operationIdentityFor,
    processingRunFor,
    claimProcessingRun,
    proposalsFor,
    workingCardsFor,
    candidateWorkingModelFor,
    editedCandidateWorkingModel, synchronizedCandidateWorkingModel,
    consentFor,
    requestFor,
    persistSuccessfulResult,
  });
}));
