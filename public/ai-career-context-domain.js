(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AICareerContextDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_ID = "job-radar-canonical-career-context-v1";
  const PROMPT_VERSION = "canonical_career_context_v2_flexible";

  function artifactId(sourceHash, provider, model, promptVersion = PROMPT_VERSION) {
    return `canonical-context-${sourceHash}-${provider}-${model}-${promptVersion}`;
  }

  function createArtifact(result, source, now = new Date()) {
    if (!result?.canonical_markdown || !source?.content_hash) throw new Error("invalid_canonical_artifact");
    const generatedAt = result.generated_at || now.toISOString();
    return {
      contract_id: CONTRACT_ID,
      artifact_id: artifactId(source.content_hash, result.provider, result.model, result.prompt_version),
      source_hash: source.content_hash,
      source_document_id: source.source_document_id,
      original_filename: source.original_filename,
      document_type: source.document_type,
      provider: result.provider,
      model: result.model,
      prompt_version: result.prompt_version,
      output_language: "zh-CN",
      generated_at: generatedAt,
      updated_at: generatedAt,
      review_status: "needs_review",
      accepted_at: null,
      canonical_markdown: result.canonical_markdown,
      usage: result.usage || {},
      provider_response_id: result.provider_response_id || null,
      processing_boundary: result.processing_boundary,
      original_source_preserved: true,
    };
  }

  function acceptArtifact(artifact, now = new Date()) {
    if (!artifact || artifact.review_status !== "needs_review") throw new Error("canonical_artifact_not_reviewable");
    return { ...artifact, review_status: "accepted", accepted_at: now.toISOString(), updated_at: now.toISOString() };
  }

  function reusableArtifact(records, sourceHash, provider, model, promptVersion = PROMPT_VERSION) {
    return (records || []).find((record) => record.contract_id === CONTRACT_ID
      && record.review_status === "accepted"
      && record.source_hash === sourceHash
      && record.provider === provider
      && record.model === model
      && record.prompt_version === promptVersion) || null;
  }

  return { CONTRACT_ID, PROMPT_VERSION, artifactId, createArtifact, acceptArtifact, reusableArtifact };
});
