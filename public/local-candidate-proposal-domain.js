"use strict";

(function attachLocalCandidateProposal(root, factory) {
  const truth = root.AriadneTruthPersistence || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const api = factory(truth);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneLocalCandidateProposal = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createLocalCandidateProposal(Truth) {
  if (!Truth) throw new Error("truth_persistence_required");
  const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const now = () => new Date().toISOString();
  const ITEM_TYPES = Object.freeze({ work_experience: "WORK_EXPERIENCE", project: "PROJECT", education: "EDUCATION", skill_group: "OTHER", language: "OTHER", award: "OTHER" });

  function refs(anchors, fallback) {
    const values = (Array.isArray(anchors) ? anchors : []).map((anchor) => ({
      source_document_id: anchor.source_document_id,
      location: anchor.source_location,
      excerpt_or_reference: anchor.source_excerpt,
    })).filter((ref) => ref.source_document_id && ref.location && ref.excerpt_or_reference);
    const unique = [...new Map([...values, ...(fallback || [])].map((ref) => [`${ref.source_document_id}|${ref.location}|${ref.excerpt_or_reference}`, ref])).values()];
    return unique;
  }

  function itemFor(entity, fallbackRefs) {
    const data = entity?.data || {};
    const itemType = ITEM_TYPES[entity?.entity_type];
    if (!itemType || entity?.entity_type === "basics") return null;
    const title = entity.entity_type === "work_experience" ? data.position : entity.entity_type === "education" ? (data.studyType || data.institution) : (data.name || data.language);
    if (!title) return null;
    const itemRefs = refs(Object.values(entity.field_provenance || {}).flat(), fallbackRefs);
    if (!itemRefs.length) return null;
    const warnings = [...(entity.extraction?.warnings || []), ...(entity.limitations || [])];
    return {
      item_id: entity.entity_id,
      item_type: itemType,
      title,
      subtitle: entity.entity_type === "work_experience" ? (data.name || null) : entity.entity_type === "education" ? (data.institution || null) : null,
      time: data.rawDate || data.timeframe || null,
      facts: Object.entries(data).filter(([, value]) => typeof value === "string" && value && ![title, data.name, data.position, data.institution, data.studyType].includes(value)).slice(0, 8).map(([label, value], index) => ({ fact_id: `${entity.entity_id}-fact-${index + 1}`, label, value })),
      grounding_refs: itemRefs,
      confidence: entity.extraction?.confidence || "low",
      warnings,
      uncertainties: warnings.length ? [{ code: "DETERMINISTIC_REVIEW_REQUIRED" }] : [],
      review_status: "NEEDS_REVIEW",
    };
  }

  function proposalFor({ source, artifact, structuringRun, result }) {
    const fallbackRefs = artifact.source_refs || [];
    const items = (result.entities || []).map((entity) => itemFor(entity, fallbackRefs)).filter(Boolean);
    const warnings = [...(artifact.warnings || []), ...(result.warnings || [])];
    const manual = !items.length || items.some((item) => item.confidence === "low" || item.warnings.length);
    const grounding = [...new Map(items.flatMap((item) => item.grounding_refs).concat(fallbackRefs).map((ref) => [`${ref.source_document_id}|${ref.location}|${ref.excerpt_or_reference}`, ref])).values()];
    return Truth.validateProposal({
      contract_id: "ariadne-context-proposal-v1", proposal_id: id("proposal-candidate-local"), proposal_type: "CANDIDATE_CONTEXT",
      source_document_ids: [source.source_document_id], processing_run_id: structuringRun.run_id, runtime_snapshot_id: structuringRun.runtime_snapshot_id,
      status: "AWAITING_REVIEW", created_at: now(),
      payload: { contract_id: "ariadne-local-candidate-proposal-payload-v1", extraction_artifact_id: artifact.artifact_id, candidate_material_type: artifact.payload.candidate_material_type, candidate_material_type_source: artifact.payload.candidate_material_type_source, rule_profile: "career-entity-deterministic-v2", items, manual_review_required: manual, unstructured_evidence_reason: items.length ? null : (result.status || "needs_manual_selection") },
      grounding_refs: grounding, warnings, uncertainties: manual ? [{ code: "MANUAL_REVIEW_REQUIRED" }] : [], authority: Truth.AUTHORITY.proposal,
    });
  }

  function processingRunFor(source, snapshotId, status = "PENDING", createdAt = now(), patch = {}) {
    const terminal = ["SUCCEEDED", "FAILED", "CANCELLED"].includes(status);
    return Truth.validateProcessingRun({ contract_id: "ariadne-processing-run-v1", run_id: patch.run_id || id("run-candidate-structuring"), operation_type: "CANDIDATE_LOCAL_DETERMINISTIC_STRUCTURING", source_document_id: source.source_document_id, batch_id: source.batch_id, runtime_snapshot_id: snapshotId, started_at: status === "PENDING" ? null : (patch.started_at || createdAt), finished_at: terminal ? (patch.finished_at || createdAt) : null, status, error_code: patch.error_code || null, output_artifact_ids: [], proposal_ids: patch.proposal_ids || [], authority: Truth.AUTHORITY.execution });
  }
  return Object.freeze({ itemFor, proposalFor, processingRunFor });
}));
