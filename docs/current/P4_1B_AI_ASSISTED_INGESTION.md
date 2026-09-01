# P4.1B — AI-Assisted Career Material Ingestion

> Historical implementation reference only（2026-08-25 closeout）：本文件不是 current milestone 或 next-action authority。当前状态为 `PRODUCT ARCHITECTURE V2 = FROZEN / CONFIRMED`、`ARCHITECTURE GATE = COMPLETE`、`IMPLEMENTATION = NOT STARTED`；唯一 next milestone 见 `../architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md` 的 Step 1 ONE REAL RESUME。不要从本文件恢复 Career Intelligence V0、CareerEntity AI main flow、旧 Provider milestone 或 architecture research。

## Status

```text
P4.1A Local Mode = COMPLETE / PRODUCTION-USABLE BASELINE
P4.1B AI Mode = CAPABILITY-AWARE PROVIDER SLICE IMPLEMENTED / GEMINI DOCUMENT CALL BLOCKED BY CREDENTIAL
Career Intelligence V0 = NOT STARTED
P4.2 = NOT STARTED
```

## Product boundary

Local Mode and AI Mode are alternative user choices. Job Radar does not automatically run both, vote, fuse, form consensus, or select a winner. Intentional dual execution is an optional evaluation workflow whose authority is the original source plus user judgment.

Local Mode remains:

```text
Original
→ native blocks where usable
→ selective Apple Vision fallback
→ conditional GapTree for OCR multi-column Resume
→ DocumentBlock v1
→ separate Resume / Portfolio structure logic
→ CareerEntity
→ Human Review
→ confirmed-only CareerEvidence
```

AI Mode is independent:

```text
Original PDF
→ explicit provider/model selection and private-data consent
→ direct multimodal file input
→ Canonical Career Context Markdown v1 validation
→ browser-local needs_review artifact
→ user acceptance
→ accepted-only cache reuse
```

No local OCR, deterministic parser or DocumentBlock is placed before the AI call.

## First provider slice

The first direct-original-file adapter is Gemini direct document input. Gemini's [official document understanding guide](https://ai.google.dev/gemini-api/docs/document-processing?hl=en) documents native PDF understanding; direct original PDF is selected only after the account's model listing returns a usable model. The configured DeepSeek credential is used only for an independent text preflight: DeepSeek's [official Anthropic compatibility table](https://api-docs.deepseek.com/guides/anthropic_api/) marks image and document message content unsupported.

This is a provider capability boundary, not a provider benchmark. The existing DeepSeek screenshot/JD path remains unchanged and separate.

## Canonical Markdown contract

Contract: `data/domain_contracts/canonical_career_context_v1.json`.

Every artifact stores:

- source hash and SourceDocument ID;
- original filename and document type;
- provider and model;
- prompt version;
- generated time and review status;
- Markdown and provider usage metadata;
- the invariant that the original source remains preserved.

Every model output must start with `# 职业材料 Canonical Context`, include Chinese-first source map and ambiguities/unknowns, use source-type-specific sections, and distinguish:

- `[原文明确支持]`;
- `[AI 解释]`;
- `[原文未明确 / 未知]`.

Outputs that are too short, omit required sections or epistemic markers, or arrive inside a code fence fail closed and are not persisted as a Canonical artifact.

Implementation note: runtime prompt/validator and UI already use the Chinese markers above, while `data/domain_contracts/canonical_career_context_v1.json` still records the legacy English marker list. This contract-sync item remains open and is one reason P4.1B is not marked complete.

## Persistence and cache

IndexedDB version 5 adds only `ai_career_contexts`; existing stores and records are preserved. The original file Blob remains in `source_documents`. The localhost server does not persist the document, response or credential and does not write SQLite.

An artifact is reusable without a paid call only when all are unchanged:

- accepted review status;
- source hash;
- provider;
- model;
- prompt version.

The user can explicitly regenerate; that bypasses cache by design and displays the paid-call warning.

## Current external boundary

DeepSeek's existing Keychain credential passed a small real Chinese text preflight with account-returned `deepseek-v4-flash` and response `预检成功`; it sent no career material and still cannot receive direct PDF. Gemini credential is currently absent, so no original career material or Gemini provider call has occurred.

To cross the boundary, the user must configure a Gemini API key either through the page's Keychain form or `GEMINI_API_KEY`, run the account model-list/PDF capability preflight, understand the provider/tier privacy notice, explicitly consent to transmit the chosen private career PDF, and trigger the call. No key belongs in this repository.

## Optional comparison log

`data/evaluation/local_ai_comparison_log_v1.json` defines the empty, local comparison log. Add a record only after both modes have meaningful results and the original source has been adjudicated. Do not assume either result is correct before source review.
