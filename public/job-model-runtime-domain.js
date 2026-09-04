"use strict";

(function attachJobModelRuntime(root, factory) {
  const runtime = root.AriadneRuntimeExecution || (typeof module === "object" && module.exports ? require("./runtime-capabilities.js") : null);
  const gate = root.JobRadarRuntimeGate || (typeof module === "object" && module.exports ? require("./runtime-capability-gate.js") : null);
  const truth = root.AriadneTruthPersistence || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const jobContext = root.AriadneJobContext || (typeof module === "object" && module.exports ? require("./job-context-domain.js") : null);
  const lifecycle = root.AriadneModelImportLifecycle || (typeof module === "object" && module.exports ? require("./model-import-lifecycle-domain.js") : null);
  const manifest = root.AriadneJobIntelligenceContract || (typeof module === "object" && module.exports ? require("../data/job_intelligence_contract_v1.json") : null);
  const api = factory(runtime, gate, truth, jobContext, lifecycle, manifest);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneJobModelRuntime = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createJobModelRuntime(Runtime, RuntimeGate, Truth, JobContext, ModelImportLifecycle, Manifest) {
  if (!Runtime || !RuntimeGate || !Truth || !JobContext || !ModelImportLifecycle || !Manifest) throw new Error("job_model_runtime_dependencies_required");

  const PROVIDER_ID = "deepseek";
  const MODEL_ID = "deepseek-v4-pro";
  const PROTOCOL = "OPENAI_CHAT_COMPLETIONS";
  const OPERATION = "JOB_MODEL_IMPORT";
  const CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision";
  const CONTRACTS = Manifest.job_model_import_runtime_contracts;
  const PREPARATION_CONTRACT = Manifest.job_model_import_source_preparation_version;
  const PROPOSAL_CONTRACT = Manifest.job_model_import_proposal_version;
  const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const nowIso = () => new Date().toISOString();

  function abortError() {
    if (typeof DOMException === "function") return new DOMException("job_model_import_cancelled", "AbortError");
    return Object.assign(new Error("job_model_import_cancelled"), { name: "AbortError" });
  }

  function assertEligibleGate(value) {
    const runtime = value?.authority?.runtime;
    const capability = value?.authority?.capabilities;
    if (!value?.allowed || value.capability !== "job_model_structuring" || runtime?.mode !== "model"
      || runtime.provider !== PROVIDER_ID || runtime.model !== MODEL_ID
      || capability?.semantic_understanding !== "supported" || capability?.job_model_structuring !== "supported") {
      throw new Error("job_model_runtime_not_eligible");
    }
    return value;
  }

  function createRuntimeSnapshot(options = {}) {
    return Runtime.createRuntimeSnapshot({ mode: "model", provider: PROVIDER_ID, model: MODEL_ID }, {
      modelDescriptor: RuntimeGate.JOB_MODEL_IMPORT_ADAPTER,
      snapshotId: options.snapshot_id,
      capturedAt: options.captured_at || nowIso(),
      credentialRef: CREDENTIAL_REF,
      adapterVersion: CONTRACTS.adapter_version,
      promptVersion: CONTRACTS.prompt_version,
      schemaVersion: PROPOSAL_CONTRACT,
      operation: OPERATION,
      capabilityBasis: "adapter_verified",
      actionSchemaVersion: PROPOSAL_CONTRACT,
      requestConfigVersion: CONTRACTS.request_config_version,
      deliveryMethod: CONTRACTS.delivery_method,
    });
  }

  function runtimeSignature() {
    return Object.freeze({
      manifest_version: Manifest.manifest_version,
      runtime_request_contract_version: CONTRACTS.request_contract_version,
      runtime_result_contract_version: CONTRACTS.result_contract_version,
      adapter_version: CONTRACTS.adapter_version,
      prompt_version: CONTRACTS.prompt_version,
      request_config_version: CONTRACTS.request_config_version,
      proposal_version: PROPOSAL_CONTRACT,
      source_preparation_version: PREPARATION_CONTRACT,
    });
  }

  function runtimeSignaturesMatch(frontend, backend) {
    const expected = runtimeSignature();
    return frontend && backend && Object.keys(expected).every((key) => frontend[key] === expected[key] && backend[key] === expected[key]);
  }

  function sourcePreparationFor(sourceDocument, sourceReadResult) {
    const source = Truth.validateSourceDocument(sourceDocument);
    if (source.material_type !== "JOB" || sourceReadResult?.read_only !== true || sourceReadResult?.writeback !== false
      || sourceReadResult?.model_call_made !== false || sourceReadResult?.content_hash !== source.content_hash) throw new Error("job_model_source_preparation_invalid");
    const lines = String(sourceReadResult.extracted_text || "").normalize("NFKC").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!lines.length) throw new Error("job_model_source_text_required");
    const blocks = [];
    let current = [];
    let startLine = 1;
    let totalCharacters = 0;
    const flush = (endLine) => {
      const text = current.join("\n").slice(0, 1200);
      if (text && blocks.length < 48 && totalCharacters < 48000) {
        blocks.push({ source_ref: `job-source-block-${blocks.length + 1}`, location: `lines ${startLine}-${endLine}`, text });
        totalCharacters += text.length;
      }
      current = [];
    };
    lines.forEach((line, index) => {
      if (current.length && current.join("\n").length + line.length + 1 > 1100) { flush(index); startLine = index + 1; }
      current.push(line);
    });
    flush(lines.length);
    if (!blocks.length) throw new Error("job_model_source_text_required");
    return Object.freeze({
      contract_id: PREPARATION_CONTRACT,
      source_document_id: source.source_document_id,
      content_hash: source.content_hash,
      source_type: source.source_type,
      mime_type: source.mime_type,
      extraction_method: String(sourceReadResult.extraction_method || "ephemeral_source_read"),
      read_only: true,
      writeback: false,
      semantic_structuring: false,
      blocks,
      character_count: blocks.reduce((total, block) => total + block.text.length, 0),
    });
  }

  function processingRunFor(source, snapshotId, status = "PENDING", patch = {}) {
    const timestamp = patch.timestamp || nowIso();
    const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
    return Truth.validateProcessingRun({
      contract_id: "ariadne-processing-run-v1",
      run_id: patch.run_id || id("run-job-model-import"),
      operation_type: "JOB_MODEL_SEMANTIC_STRUCTURING",
      source_document_id: source.source_document_id,
      batch_id: source.batch_id,
      runtime_snapshot_id: snapshotId,
      started_at: status === "PENDING" ? null : (patch.started_at || timestamp),
      finished_at: terminal ? (patch.finished_at || timestamp) : null,
      status,
      error_code: patch.error_code || null,
      output_artifact_ids: [],
      proposal_ids: patch.proposal_ids || [],
      authority: Truth.AUTHORITY.execution,
    });
  }

  function consentFor(source, snapshot, confirmedAt = nowIso(), consentId = id("consent-job-model-import")) {
    return ModelImportLifecycle.consentFor({ source_document_id: source.source_document_id, snapshot, confirmed_at: confirmedAt, consent_id: consentId });
  }

  function operationIdentityFor(source, snapshot, consent) {
    return ModelImportLifecycle.operationIdentityFor({
      source_document_id: source.source_document_id,
      operation_type: "JOB_MODEL_SEMANTIC_STRUCTURING",
      operation_prefix: "job-model-import-op",
      snapshot,
      consent_id: consent.consent_id,
    });
  }

  function requestFor({ source_document: sourceDocument, source_preparation: sourcePreparation, snapshot, run, consent, operation_identity: operationIdentity }) {
    return Object.freeze({
      contract_id: CONTRACTS.request_contract_version,
      source_document: structuredClone(sourceDocument),
      source_preparation: structuredClone(sourcePreparation),
      runtime_snapshot: structuredClone(snapshot),
      processing_run_id: run.run_id,
      consent: structuredClone(consent),
      operation_identity: structuredClone(operationIdentity),
    });
  }

  function boundRef(preparation, sourceDocumentId, ref) {
    const block = preparation.blocks.find((entry) => entry.source_ref === ref);
    if (!block) throw new Error("job_model_grounding_ref_invalid");
    return { source_document_id: sourceDocumentId, location: block.location, excerpt_or_reference: block.text };
  }

  function proposalFor({ source, source_document: sourceDocument, source_preparation: preparation, run, result }) {
    if (result?.contract_id !== CONTRACTS.result_contract_version || result.provider !== PROVIDER_ID || result.model !== MODEL_ID
      || result.adapter_version !== CONTRACTS.adapter_version || result.runtime_snapshot_id !== run.runtime_snapshot_id
      || result.source_document_id !== source.source_document_id || result.processing_run_id !== run.run_id
      || result.network_call_made !== true || result.persistence !== "browser_working_job_save_required") throw new Error("job_model_result_contract_invalid");
    const model = result.job_proposal;
    if (!model || model.contract_id !== PROPOSAL_CONTRACT || !model.title?.value) throw new Error("job_model_proposal_contract_invalid");
    const refsFor = (field) => (field?.source_refs || []).map((ref) => boundRef(preparation, source.source_document_id, ref));
    const valueFor = (field) => field?.value === null || field?.value === undefined || String(field.value).trim() === "" ? null : String(field.value).trim();
    const requirements = (model.requirements || []).map((entry, index) => JobContext.validateRequirement({
      requirement_id: `job-requirement-${source.content_hash.slice(7, 23)}-model-${index + 1}`,
      label: String(entry.label || entry.detail || "要求").trim().slice(0, 240),
      detail: String(entry.detail || "").trim(),
      grounding_refs: refsFor(entry),
      content_origin: "MODEL_PROPOSED",
    }));
    const fieldRefs = [model.title, model.company, model.location, model.summary].flatMap(refsFor);
    const allRefs = [...fieldRefs, ...requirements.flatMap((entry) => entry.grounding_refs)];
    const uniqueRefs = [...new Map(allRefs.map((ref) => [`${ref.location}|${ref.excerpt_or_reference}`, ref])).values()];
    const payload = JobContext.validateJobPayload({
      contract_id: JobContext.PAYLOAD_CONTRACT,
      title: valueFor(model.title),
      company: valueFor(model.company),
      location: valueFor(model.location),
      summary: valueFor(model.summary),
      requirements,
      source_document_ids: [source.source_document_id],
      source_url: source.source_url || null,
      source_availability: sourceDocument.local_reference ? "ORIGINAL_AVAILABLE" : "RAW_TEXT_AVAILABLE",
      field_provenance: { title: "MODEL_PROPOSED", company: "MODEL_PROPOSED", location: "MODEL_PROPOSED", summary: "MODEL_PROPOSED" },
      uncertainties: Array.isArray(model.uncertainties) ? structuredClone(model.uncertainties) : [],
    });
    return Truth.validateProposal({
      contract_id: "ariadne-context-proposal-v1",
      proposal_id: id("proposal-job-model"),
      proposal_type: "JOB_CONTEXT",
      source_document_ids: [source.source_document_id],
      processing_run_id: run.run_id,
      runtime_snapshot_id: run.runtime_snapshot_id,
      status: "AWAITING_REVIEW",
      created_at: nowIso(),
      payload,
      grounding_refs: uniqueRefs.length ? uniqueRefs : [{ source_document_id: source.source_document_id, location: "document", excerpt_or_reference: "Original source retained; model grounding requires Human review." }],
      warnings: ["model_generated_non_authoritative"],
      uncertainties: structuredClone(payload.uncertainties),
      authority: Truth.AUTHORITY.proposal,
    });
  }

  function persistSuccessfulResult(database, runningRun, proposal, signal, isActive = () => true) {
    const succeeded = processingRunFor({ source_document_id: runningRun.source_document_id, batch_id: runningRun.batch_id }, runningRun.runtime_snapshot_id, "SUCCEEDED", {
      run_id: runningRun.run_id,
      started_at: runningRun.started_at,
      finished_at: nowIso(),
      proposal_ids: [proposal.proposal_id],
    });
    return ModelImportLifecycle.persistClaimedProposals(database, {
      running_run: runningRun,
      succeeded_run: succeeded,
      proposals: [proposal],
      signal,
      is_active: isActive,
      validate_run: Truth.validateProcessingRun,
      stale_code: "job_model_processing_run_stale",
      read_code: "job_model_processing_run_read_failed",
      persistence_code: "job_model_result_persistence_failed",
      abort_error: abortError,
    });
  }

  return Object.freeze({
    PROVIDER_ID, MODEL_ID, PROTOCOL, OPERATION, CREDENTIAL_REF, CONTRACTS, PREPARATION_CONTRACT, PROPOSAL_CONTRACT,
    assertEligibleGate, createRuntimeSnapshot, runtimeSignature, runtimeSignaturesMatch, sourcePreparationFor,
    processingRunFor, consentFor, operationIdentityFor, requestFor, proposalFor,
    claimProcessingRun: (database, run) => ModelImportLifecycle.claimProcessingRun(database, run, "job_model_processing_run_claim_failed"),
    persistSuccessfulResult,
  });
}));
