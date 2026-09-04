"use strict";

(function attachSourceRetrieval(root, factory) {
  const manifest = root.AriadneJobIntelligenceContract
    || (typeof module === "object" && module.exports ? require("../data/job_intelligence_contract_v1.json") : null);
  const api = factory(manifest);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneSourceRetrieval = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createSourceRetrieval(Manifest) {
  if (!Manifest) throw new Error("source_retrieval_manifest_required");

  const POLICY = Object.freeze(Manifest.source_retrieval);
  const CONTRACT_ID = Manifest.source_excerpt_manifest_version;

  class SourceRetrievalError extends Error {
    constructor(code) { super(code); this.name = "SourceRetrievalError"; this.code = code; }
  }

  function normalizeTerms(values) {
    return [...new Set((values || []).flatMap((value) => String(value || "").normalize("NFKC").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((value) => value.length >= 2))].slice(0, 24);
  }

  function scoreText(text, terms) {
    const normalized = String(text || "").normalize("NFKC").toLocaleLowerCase();
    return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
  }

  async function sha256Text(text) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return `sha256:${[...new Uint8Array(digest)].map((entry) => entry.toString(16).padStart(2, "0")).join("")}`;
  }

  function artifactBlocks(artifact) {
    const blocks = artifact?.payload?.document_blocks;
    if (Array.isArray(blocks) && blocks.length) return blocks.map((block) => ({
      location: Number.isInteger(block.page) ? `p. ${block.page}` : "document",
      text: String(block.text || "").trim(),
    })).filter((entry) => entry.text);
    return (artifact?.source_refs || []).map((ref) => ({ location: ref.location, text: String(ref.excerpt_or_reference || "").trim() })).filter((entry) => entry.text && entry.text !== "No extractable text");
  }

  function boundedSelections(candidates, terms) {
    const ranked = candidates.map((entry, index) => ({ ...entry, score: scoreText(entry.text, terms), order: index }))
      .sort((left, right) => right.score - left.score || left.order - right.order);
    const selected = [];
    let total = 0;
    for (const entry of ranked) {
      if (selected.length >= POLICY.max_excerpts || total >= POLICY.max_total_characters) break;
      const remaining = POLICY.max_total_characters - total;
      const text = entry.text.slice(0, Math.min(POLICY.max_excerpt_characters, remaining)).trim();
      if (!text) continue;
      selected.push({ ...entry, text });
      total += text.length;
    }
    return selected;
  }

  function rawTextBlocks(text) {
    return String(text || "").split(/\n{2,}|(?<=[。！？.!?])\s+/u).map((value, index) => ({ location: `ephemeral segment ${index + 1}`, text: value.trim() })).filter((entry) => entry.text);
  }

  async function manifestResult({ purpose, status, method, selected, missingSourceIds, readOnly = true }) {
    const excerpts = await Promise.all(selected.map(async (entry, index) => ({
      excerpt_id: `source-excerpt-${index + 1}`,
      source_document_id: entry.source_document_id,
      location: entry.location,
      content_hash: await sha256Text(entry.text),
      character_count: entry.text.length,
      retrieval_method: entry.retrieval_method,
    })));
    return Object.freeze({
      contract_id: CONTRACT_ID,
      policy_version: POLICY.policy_version,
      purpose,
      status,
      method,
      read_only: readOnly,
      excerpts,
      missing_source_document_ids: [...missingSourceIds],
      created_at: new Date().toISOString(),
      provider_view: selected.map((entry, index) => ({
        excerpt_ref: `source-excerpt-${index + 1}`,
        material_owner: entry.material_owner,
        location: entry.location,
        text: entry.text,
      })),
    });
  }

  async function retrieve(input) {
    if (input?.mode !== "model") throw new SourceRetrievalError("SOURCE_RETRIEVAL_MODEL_MODE_REQUIRED");
    if (!POLICY.allowed_purposes.includes(input.purpose)) throw new SourceRetrievalError("SOURCE_RETRIEVAL_PURPOSE_INVALID");
    if (input.structured_sufficient === true) {
      return manifestResult({ purpose: input.purpose, status: "NOT_NEEDED", method: "STRUCTURED_CONTEXT", selected: [], missingSourceIds: [] });
    }
    const sourceIds = [...new Set((input.requested_source_document_ids || []).map(String).filter(Boolean))];
    if (!sourceIds.length) {
      return manifestResult({ purpose: input.purpose, status: "SOURCE_UNAVAILABLE", method: "NONE", selected: [], missingSourceIds: [] });
    }
    const allowedSources = new Map((input.source_documents || []).filter((source) => sourceIds.includes(source?.source_document_id)).map((source) => [source.source_document_id, source]));
    const terms = normalizeTerms(input.query_terms);
    const artifactCandidates = [];
    for (const artifact of input.extraction_artifacts || []) {
      if (!allowedSources.has(artifact?.source_document_id)) continue;
      const source = allowedSources.get(artifact.source_document_id);
      artifactBlocks(artifact).forEach((block) => artifactCandidates.push({
        source_document_id: artifact.source_document_id,
        material_owner: source.material_type,
        location: block.location,
        text: block.text,
        retrieval_method: "EXTRACTION_ARTIFACT",
      }));
    }
    const selectedArtifacts = boundedSelections(artifactCandidates, terms);
    if (selectedArtifacts.length) {
      return manifestResult({ purpose: input.purpose, status: "AVAILABLE", method: "EXTRACTION_ARTIFACT", selected: selectedArtifacts, missingSourceIds: [] });
    }

    const selectedRaw = [];
    const missing = [];
    for (const sourceId of sourceIds) {
      const source = allowedSources.get(sourceId);
      if (!source?.local_reference || typeof input.raw_text_reader !== "function") { missing.push(sourceId); continue; }
      let result;
      try { result = await input.raw_text_reader(source); }
      catch (_error) { missing.push(sourceId); continue; }
      if (!result || result.content_hash !== source.content_hash || typeof result.extracted_text !== "string") {
        throw new SourceRetrievalError("SOURCE_PROVENANCE_FAILURE");
      }
      const candidates = rawTextBlocks(result.extracted_text).map((block) => ({
        source_document_id: sourceId,
        material_owner: source.material_type,
        location: block.location,
        text: block.text,
        retrieval_method: "EPHEMERAL_LOCAL_SOURCE_READ",
      }));
      selectedRaw.push(...boundedSelections(candidates, terms));
    }
    const boundedRaw = boundedSelections(selectedRaw, terms);
    if (boundedRaw.length) {
      return manifestResult({ purpose: input.purpose, status: "AVAILABLE", method: "EPHEMERAL_LOCAL_SOURCE_READ", selected: boundedRaw, missingSourceIds: missing });
    }
    return manifestResult({ purpose: input.purpose, status: "SOURCE_UNAVAILABLE", method: "NONE", selected: [], missingSourceIds: sourceIds });
  }

  return Object.freeze({
    CONTRACT_ID, POLICY, SourceRetrievalError, normalizeTerms, scoreText, artifactBlocks,
    boundedSelections, rawTextBlocks, retrieve,
  });
}));
