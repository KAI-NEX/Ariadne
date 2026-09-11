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
  const MODEL_ID = "deepseek-flash";
  const PROTOCOL = "OPENAI_CHAT_COMPLETIONS";
  const OPERATION = "JOB_MODEL_IMPORT";
  const CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision";
  const CONTRACTS = Manifest.job_model_import_runtime_contracts;
  const PREPARATION_CONTRACT = Manifest.job_model_import_source_preparation_version;
  const PROPOSAL_CONTRACT = Manifest.job_model_import_proposal_version;
  const SOURCE_BUNDLE_CONTRACT = "ariadne-source-bundle-v1";
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
      || !RuntimeGate.isModelRuntimeEligible(runtime)
      || capability?.semantic_understanding !== "supported" || capability?.job_model_structuring !== "supported"
      || capability?.vision !== "supported") {
      throw new Error("job_model_runtime_not_eligible");
    }
    return value;
  }

  function createRuntimeSnapshot(options = {}) {
    const currentRuntime = RuntimeGate.runtimeForSnapshot("job_text_import", options.runtime);
    const descriptor = RuntimeGate.modelDescriptorForRuntime(currentRuntime, "job_text_import");
    return Runtime.createRuntimeSnapshot(currentRuntime, {
      modelDescriptor: descriptor,
      snapshotId: options.snapshot_id,
      capturedAt: options.captured_at || nowIso(),
      credentialRef: RuntimeGate.credentialFor(currentRuntime),
      adapterVersion: descriptor?.adapter_version,
      promptVersion: CONTRACTS.prompt_version,
      schemaVersion: PROPOSAL_CONTRACT,
      operation: String(options.operation || "job_text_import").toUpperCase(),
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

  async function sourceBundleFor(sources, sourceDocuments) {
    const orderedSources = [...(sources || [])];
    const orderedDocuments = (sourceDocuments || []).map(Truth.validateSourceDocument);
    if (!orderedSources.length || orderedSources.length !== orderedDocuments.length) throw new Error("job_model_source_bundle_invalid");
    if (orderedDocuments.some((document, index) => document.material_type !== "JOB" || document.source_document_id !== orderedSources[index].source_document_id)) throw new Error("job_model_source_bundle_invalid");
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(orderedDocuments.map((document) => document.content_hash).join("|")));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return Object.freeze({
      contract_id: SOURCE_BUNDLE_CONTRACT,
      source_bundle_id: `job-source-bundle-${hash}`,
      source_document_ids: orderedDocuments.map((document) => document.source_document_id),
      source_count: orderedDocuments.length,
      ordering: "USER_SUPPLIED",
    });
  }

  function sourcePreparationFor(sourceDocument, sourceReadResult, options = {}) {
    const source = Truth.validateSourceDocument(sourceDocument);
    if (source.material_type !== "JOB" || sourceReadResult?.read_only !== true || sourceReadResult?.writeback !== false
      || sourceReadResult?.model_call_made !== false || sourceReadResult?.content_hash !== source.content_hash) throw new Error("job_model_source_preparation_invalid");
    if (source.source_type === "PDF") {
      const count = sourceReadResult.visual_page_count;
      if (!Number.isInteger(count) || count < 1 || count > Math.min(48, options.max_blocks || 48)) throw new Error("job_pdf_complete_page_limit");
      const prefix = Number.isInteger(options.source_index) ? `job-source-${options.source_index}-block` : "job-source-block";
      const blocks = Array.from({ length: count }, (_, index) => ({ source_ref: `${prefix}-${index + 1}`, location: `p. ${index + 1}`, text: `Original PDF visual page ${index + 1}` }));
      return Object.freeze({ contract_id: PREPARATION_CONTRACT, source_document_id: source.source_document_id,
        content_hash: source.content_hash, source_type: source.source_type, mime_type: source.mime_type,
        extraction_method: "complete_pdf_page_manifest_v1", read_only: true, writeback: false, semantic_structuring: false,
        blocks, character_count: blocks.reduce((total, block) => total + block.text.length, 0) });
    }
    const lines = String(sourceReadResult.extracted_text || "").normalize("NFKC").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!lines.length) throw new Error("job_model_source_text_required");
    const blocks = [];
    const sourceIndex = Number.isInteger(options.source_index) ? options.source_index : null;
    const maxBlocks = Math.max(1, Math.min(48, Number(options.max_blocks) || 48));
    const maxCharacters = Math.max(1, Math.min(48000, Number(options.max_characters) || 48000));
    let current = [];
    let startLine = 1;
    let totalCharacters = 0;
    const flush = (endLine) => {
      const text = current.join("\n").slice(0, Math.min(1200, maxCharacters - totalCharacters));
      if (text && blocks.length < maxBlocks && totalCharacters < maxCharacters) {
        const prefix = sourceIndex === null ? "job-source-block" : `job-source-${sourceIndex}-block`;
        blocks.push({ source_ref: `${prefix}-${blocks.length + 1}`, location: `lines ${startLine}-${endLine}`, text });
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

  function boundedBundlePreparations(sourceDocuments, sourceReadResults) {
    const documents = (sourceDocuments || []).map(Truth.validateSourceDocument);
    if (!documents.length || documents.length !== sourceReadResults?.length) throw new Error("job_model_source_bundle_invalid");
    let remainingBlocks = 48;
    let remainingCharacters = 48000;
    const preparations = [];
    documents.forEach((document, index) => {
      if (remainingBlocks <= 0 || remainingCharacters < 1) return;
      const preparation = sourcePreparationFor(document, sourceReadResults[index], {
        source_index: index + 1,
        max_blocks: remainingBlocks,
        max_characters: remainingCharacters,
      });
      preparations.push(preparation);
      remainingBlocks -= preparation.blocks.length;
      remainingCharacters -= preparation.character_count;
    });
    if (preparations.length !== documents.length) throw new Error("job_model_source_bundle_too_large");
    return Object.freeze(preparations);
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

  function consentFor(sourceOrBundle, snapshot, confirmedAt = nowIso(), consentId = id("consent-job-model-import")) {
    const sourceId = sourceOrBundle.source_bundle_id || sourceOrBundle.source_document_id;
    return ModelImportLifecycle.consentFor({ source_document_id: sourceId, snapshot, confirmed_at: confirmedAt, consent_id: consentId });
  }

  function operationIdentityFor(sourceOrBundle, snapshot, consent) {
    const sourceId = sourceOrBundle.source_bundle_id || sourceOrBundle.source_document_id;
    return ModelImportLifecycle.operationIdentityFor({
      source_document_id: sourceId,
      operation_type: "JOB_MODEL_SEMANTIC_STRUCTURING",
      operation_prefix: "job-model-import-op",
      snapshot,
      consent_id: consent.consent_id,
    });
  }

  function requestFor({ source_document: sourceDocument, source_preparation: sourcePreparation, source_bundle: sourceBundle, source_documents: sourceDocuments, source_preparations: sourcePreparations, source_inputs: sourceInputs = [], snapshot, run, consent, operation_identity: operationIdentity }) {
    const shared = {
      contract_id: CONTRACTS.request_contract_version,
      runtime_snapshot: structuredClone(snapshot),
      processing_run_id: run.run_id,
      consent: structuredClone(consent),
      operation_identity: structuredClone(operationIdentity),
    };
    if (sourceBundle) return Object.freeze({
      ...shared,
      source_bundle: structuredClone(sourceBundle),
      source_documents: structuredClone(sourceDocuments),
      source_preparations: structuredClone(sourcePreparations),
      source_inputs: structuredClone(sourceInputs),
    });
    return Object.freeze({ ...shared, source_document: structuredClone(sourceDocument), source_preparation: structuredClone(sourcePreparation) });
  }

  function boundRef(preparations, ref) {
    const preparation = preparations.find((entry) => entry.blocks.some((block) => block.source_ref === ref));
    const block = preparation?.blocks.find((entry) => entry.source_ref === ref);
    if (!block) throw new Error("job_model_grounding_ref_invalid");
    return { source_document_id: preparation.source_document_id, location: block.location, excerpt_or_reference: block.text };
  }

  function proposalFor({ source, source_document: sourceDocument, source_preparation: preparation, sources, source_documents: sourceDocuments, source_preparations: sourcePreparations, source_bundle: sourceBundle, run, result, snapshot = { provider: PROVIDER_ID, model: MODEL_ID, adapter_version: CONTRACTS.adapter_version } }) {
    const orderedSources = sources || [source];
    const orderedDocuments = sourceDocuments || [sourceDocument];
    const preparations = sourcePreparations || [preparation];
    const sourceIds = orderedDocuments.map((document) => document.source_document_id);
    const primarySource = orderedSources[0];
    const primaryDocument = orderedDocuments[0];
    if (result?.contract_id !== CONTRACTS.result_contract_version || result.provider !== snapshot.provider || result.model !== snapshot.model
      || result.adapter_version !== snapshot.adapter_version || result.runtime_snapshot_id !== run.runtime_snapshot_id
      || result.source_document_id !== primarySource.source_document_id || result.processing_run_id !== run.run_id
      || result.network_call_made !== true || result.persistence !== "browser_working_job_save_required") throw new Error("job_model_result_contract_invalid");
    if (result.source_document_ids && JSON.stringify(result.source_document_ids) !== JSON.stringify(sourceIds)) throw new Error("job_model_result_contract_invalid");
    if (sourceBundle && result.source_bundle_id && result.source_bundle_id !== sourceBundle.source_bundle_id) throw new Error("job_model_result_contract_invalid");
    const model = result.job_proposal;
    if (!model || model.contract_id !== PROPOSAL_CONTRACT || !model.title?.value) throw new Error("job_model_proposal_contract_invalid");
    const refsFor = (field) => (field?.source_refs || []).map((ref) => boundRef(preparations, ref));
    const valueFor = (field) => field?.value === null || field?.value === undefined || String(field.value).trim() === "" ? null : String(field.value).trim();
    const requirements = (model.requirements || []).map((entry, index) => JobContext.validateRequirement({
      requirement_id: `job-requirement-${primarySource.content_hash.slice(7, 23)}-model-${index + 1}`,
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
      source_document_ids: sourceIds,
      source_url: orderedSources.find((entry) => entry.source_url)?.source_url || null,
      source_availability: orderedDocuments.every((document) => document.local_reference) ? "ORIGINAL_AVAILABLE" : "RAW_TEXT_AVAILABLE",
      field_provenance: { title: "MODEL_PROPOSED", company: "MODEL_PROPOSED", location: "MODEL_PROPOSED", summary: "MODEL_PROPOSED" },
      uncertainties: Array.isArray(model.uncertainties) ? structuredClone(model.uncertainties) : [],
    });
    return Truth.validateProposal({
      contract_id: "ariadne-context-proposal-v1",
      proposal_id: id("proposal-job-model"),
      proposal_type: "JOB_CONTEXT",
      source_document_ids: sourceIds,
      processing_run_id: run.run_id,
      runtime_snapshot_id: run.runtime_snapshot_id,
      status: "AWAITING_REVIEW",
      created_at: nowIso(),
      payload,
      grounding_refs: uniqueRefs.length ? uniqueRefs : [{ source_document_id: primaryDocument.source_document_id, location: "document", excerpt_or_reference: "Original source retained; model grounding requires Human review." }],
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
    PROVIDER_ID, MODEL_ID, PROTOCOL, OPERATION, CREDENTIAL_REF, CONTRACTS, PREPARATION_CONTRACT, PROPOSAL_CONTRACT, SOURCE_BUNDLE_CONTRACT,
    assertEligibleGate, createRuntimeSnapshot, runtimeSignature, runtimeSignaturesMatch, sourceBundleFor, sourcePreparationFor, boundedBundlePreparations,
    processingRunFor, consentFor, operationIdentityFor, requestFor, proposalFor,
    claimProcessingRun: (database, run) => ModelImportLifecycle.claimProcessingRun(database, run, "job_model_processing_run_claim_failed"),
    persistSuccessfulResult,
  });
}));
