"use strict";

(function attachCandidateModelRuntime(root, factory) {
  const truth = root.AriadneTruthPersistence || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const candidate = root.CandidateContextDomain || (typeof module === "object" && module.exports ? require("./candidate-context-domain.js") : null);
  const api = factory(truth, candidate);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneCandidateModelRuntime = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createCandidateModelRuntime(Truth, Candidate) {
  if (!Truth || !Candidate) throw new Error("candidate_model_runtime_dependencies_required");

  const PROVIDER_ID = "deepseek";
  const MODEL_ID = "deepseek-v4-flash-vision-exp";
  const PROTOCOL = "OPENAI_CHAT_COMPLETIONS";
  const ADAPTER_VERSION = "deepseek-candidate-pdf-v1";
  const PROMPT_VERSION = "candidate_item_proposal_v3_compact_no_thinking";
  const SCHEMA_VERSION = "job-radar-candidate-context-v2-step1";
  const DELIVERY_METHOD = "rendered_pdf_pages";
  const CREDENTIAL_REF = "keychain://AI-Learning-OS.JobRadar.DeepSeek/local-vision";
  const PAYLOAD_CONTRACT_ID = "ariadne-model-candidate-proposal-payload-v1";
  const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const now = () => new Date().toISOString();

  function abortError() {
    if (typeof DOMException === "function") return new DOMException("candidate_model_cancelled", "AbortError");
    return Object.assign(new Error("candidate_model_cancelled"), { name: "AbortError" });
  }

  function assertEligibleGate(gate) {
    const runtime = gate?.authority?.runtime;
    const capability = gate?.authority?.capabilities;
    if (!gate?.allowed || gate.capability !== "candidate_model_structuring"
      || runtime?.mode !== "model" || runtime.provider !== PROVIDER_ID || runtime.model !== MODEL_ID
      || capability?.semantic_understanding !== "supported"
      || capability?.candidate_model_structuring !== "supported"
      || capability?.vision !== "supported") {
      throw new Error("candidate_model_runtime_not_eligible");
    }
    return gate;
  }

  function assertPdfSource(source) {
    if (!source || source.source_type !== "PDF" || source.mime_type !== "application/pdf" || !String(source.file?.name || source.filename || "").toLowerCase().endsWith(".pdf")) {
      throw new Error("candidate_model_pdf_required");
    }
    return source;
  }

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

  function truthRef(ref) {
    return {
      source_document_id: ref.source_document_id,
      location: ref.location,
      excerpt_or_reference: ref.excerpt_or_reference,
    };
  }

  function itemFor(item) {
    const subtype = { WORK_EXPERIENCE: "work_experience", PROJECT: "project", EDUCATION: "education", OTHER: "custom_section" }[item.item_type] || "custom_section";
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
      warnings: ["model_generated_needs_review"],
      uncertainties: structuredClone(item.uncertainties || []),
      review_status: "NEEDS_REVIEW",
      content_origin: "MODEL_PROPOSAL",
    };
  }

  function proposalsFor({ source, run, result, candidateMaterialType }) {
    assertPdfSource(source);
    if (result?.provider !== PROVIDER_ID || result?.model !== MODEL_ID || result?.protocol !== PROTOCOL
      || result?.adapter_version !== ADAPTER_VERSION || result?.delivery_method !== DELIVERY_METHOD
      || result?.runtime_snapshot_id !== run.runtime_snapshot_id || result?.processing_run_id !== run.run_id
      || result?.source_document_id !== source.source_document_id || result?.content_hash !== source.content_hash
      || result?.network_call_made !== true || !Number.isInteger(result?.rendered_page_count) || result.rendered_page_count < 1
      || result.outbound_image_count !== result.rendered_page_count) {
      throw new Error("candidate_model_response_contract_failed");
    }
    const modelProposal = result.candidate_proposal;
    const errors = Candidate.validateCandidateProposal(modelProposal);
    if (errors.length || modelProposal.source_document_id !== source.source_document_id
      || modelProposal.processing_run_id !== run.run_id || modelProposal.provider !== PROVIDER_ID
      || modelProposal.model !== MODEL_ID || modelProposal.prompt_version !== PROMPT_VERSION
      || modelProposal.review_status !== "NEEDS_REVIEW") {
      throw new Error("candidate_model_proposal_contract_failed");
    }
    return modelProposal.items.map((modelItem) => {
      const item = itemFor(modelItem);
      const grounding = item.grounding_refs;
      if (!grounding.length || grounding.some((ref) => ref.source_document_id !== source.source_document_id)) {
        throw new Error("candidate_model_grounding_validation_failed");
      }
      return Truth.validateProposal({
        contract_id: "ariadne-context-proposal-v1",
        proposal_id: id("proposal-candidate-model-item"),
        proposal_type: "CANDIDATE_CONTEXT",
        source_document_ids: [source.source_document_id],
        processing_run_id: run.run_id,
        runtime_snapshot_id: run.runtime_snapshot_id,
        status: "AWAITING_REVIEW",
        created_at: now(),
        payload: {
          contract_id: PAYLOAD_CONTRACT_ID,
          provider: PROVIDER_ID,
          model: MODEL_ID,
          adapter_version: ADAPTER_VERSION,
          prompt_version: PROMPT_VERSION,
          schema_version: SCHEMA_VERSION,
          delivery_method: DELIVERY_METHOD,
          provider_response_id: result.provider_response_id || null,
          rendered_page_count: result.rendered_page_count,
          candidate_material_type: String(candidateMaterialType || "Resume").toLowerCase(),
          candidate_material_type_source: "USER_SELECTED",
          items: [item],
          manual_review_required: true,
          unstructured_evidence_reason: null,
        },
        grounding_refs: grounding,
        warnings: ["MODEL_OUTPUT_REQUIRES_HUMAN_REVIEW"],
        uncertainties: structuredClone(item.uncertainties),
        authority: Truth.AUTHORITY.proposal,
      });
    });
  }

  function consentFor(source, snapshot, confirmedAt = now()) {
    assertPdfSource(source);
    return Object.freeze({
      explicitly_confirmed: true,
      source_document_id: source.source_document_id,
      provider: snapshot.provider,
      model: snapshot.model,
      delivery_method: snapshot.delivery_method,
      confirmed_at: confirmedAt,
    });
  }

  function requestFor({ source, sourceDocument, documentDataUrl, snapshot, run, consent, candidateMaterialType }) {
    assertPdfSource(source);
    if (!sourceDocument?.local_reference || !documentDataUrl?.startsWith("data:application/pdf;base64,")) throw new Error("candidate_model_source_not_resolved");
    return Object.freeze({
      source_document: structuredClone(sourceDocument),
      document_data_url: documentDataUrl,
      candidate_material_type: candidateMaterialType,
      runtime_snapshot: structuredClone(snapshot),
      processing_run_id: run.run_id,
      consent: structuredClone(consent),
    });
  }

  function persistSuccessfulResult(database, runningRun, proposals, signal) {
    if (signal?.aborted) return Promise.reject(abortError());
    const succeeded = processingRunFor({ source_document_id: runningRun.source_document_id, batch_id: runningRun.batch_id }, runningRun.runtime_snapshot_id, "SUCCEEDED", runningRun.started_at, {
      run_id: runningRun.run_id,
      started_at: runningRun.started_at,
      finished_at: now(),
      proposal_ids: proposals.map((proposal) => proposal.proposal_id),
    });
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["processing_runs", "context_proposals"], "readwrite");
      let contractError = null;
      const onAbort = () => transaction.abort();
      signal?.addEventListener?.("abort", onAbort, { once: true });
      const request = transaction.objectStore("processing_runs").get(runningRun.run_id);
      request.onsuccess = () => {
        try {
          const current = Truth.validateProcessingRun(request.result);
          if (current.status !== "RUNNING" || current.runtime_snapshot_id !== runningRun.runtime_snapshot_id || current.source_document_id !== runningRun.source_document_id) {
            throw new Error("candidate_model_processing_run_stale");
          }
          if (signal?.aborted) throw abortError();
          proposals.forEach((proposal) => transaction.objectStore("context_proposals").add(structuredClone(proposal)));
          transaction.objectStore("processing_runs").put(structuredClone(succeeded));
        } catch (error) { contractError = error; transaction.abort(); }
      };
      request.onerror = () => { contractError = request.error || new Error("candidate_model_processing_run_read_failed"); transaction.abort(); };
      transaction.oncomplete = () => { signal?.removeEventListener?.("abort", onAbort); resolve(succeeded); };
      transaction.onerror = () => { signal?.removeEventListener?.("abort", onAbort); reject(contractError || transaction.error || new Error("candidate_model_result_persistence_failed")); };
      transaction.onabort = () => { signal?.removeEventListener?.("abort", onAbort); reject(contractError || (signal?.aborted ? abortError() : transaction.error || new Error("candidate_model_result_persistence_aborted"))); };
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
    assertPdfSource,
    processingRunFor,
    proposalsFor,
    consentFor,
    requestFor,
    persistSuccessfulResult,
  });
}));
