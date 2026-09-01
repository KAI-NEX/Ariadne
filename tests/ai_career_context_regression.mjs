import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Domain = require("../public/ai-career-context-domain.js");

const source = {
  source_document_id: "source-1234567890",
  content_hash: "a".repeat(64),
  original_filename: "resume.pdf",
  document_type: "resume",
};
const result = {
  canonical_markdown: "# 职业材料 Canonical Context\n\n## 来源与页码\n- [原文明确支持] p. 1",
  provider: "gemini",
  model: "account-returned-model",
  prompt_version: Domain.PROMPT_VERSION,
  generated_at: "2026-08-24T10:00:00Z",
  processing_boundary: "user_triggered_original_pdf_to_gemini_direct_document",
};

const artifact = Domain.createArtifact(result, source, new Date("2026-08-24T10:00:00Z"));
assert.equal(artifact.review_status, "needs_review");
assert.equal(artifact.source_hash, source.content_hash);
assert.equal(artifact.original_source_preserved, true);
assert.equal(artifact.output_language, "zh-CN");
assert.equal(Domain.reusableArtifact([artifact], source.content_hash, "gemini", "account-returned-model"), null);

const accepted = Domain.acceptArtifact(artifact, new Date("2026-08-24T10:01:00Z"));
assert.equal(accepted.review_status, "accepted");
assert.equal(Domain.reusableArtifact([accepted], source.content_hash, "gemini", "account-returned-model"), accepted);
assert.equal(Domain.reusableArtifact([accepted], "b".repeat(64), "gemini", "account-returned-model"), null);
assert.equal(Domain.reusableArtifact([accepted], source.content_hash, "gemini", "different-model"), null);
assert.equal(Domain.reusableArtifact([accepted], source.content_hash, "gemini", "account-returned-model", "future-prompt"), null);
assert.throws(() => Domain.acceptArtifact(accepted), /canonical_artifact_not_reviewable/);

console.log(JSON.stringify({
  canonical_artifact_metadata: "pass",
  accepted_only_cache_reuse: "pass",
  changed_source_model_prompt_invalidates_cache: "pass",
  intentional_regeneration_not_blocked: "pass",
}, null, 2));
