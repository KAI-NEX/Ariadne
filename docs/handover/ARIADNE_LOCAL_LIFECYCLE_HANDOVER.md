# Ariadne Local Lifecycle Handover

## 1. Phase Status

- Phase: Local Candidate / Job lifecycle stabilization.
- Status: Human Acceptance passed; frozen.
- Freeze commit: `7be2ae7 fix: stabilize local candidate and job lifecycle`.
- Freeze baseline: working tree was clean after the commit.
- This handover is a navigation document for the next implementation thread.
- It is not a canonical architecture authority and does not change any accepted contract.

## 2. Product Position

Ariadne is a local-first, AI-native, evidence-grounded Personal Career Intelligence Layer.

Its durable product asset is the user-confirmed Career Model, rather than a single
job board, provider, model, or generated answer.

The product preserves the distinctions below:

- Interest Signal is not Capability Evidence.
- Missing Evidence is not Missing Capability.
- AI-assisted Implementation is not independent engineering capability.
- Observed Behavior is not Confirmed Preference.
- Career Direction Hypothesis is not User Goal.
- LLM Proposal is not Stored Truth.

Confirmed user truth follows the contract:

`Evidence / Signal → Proposal → Explanation → User Review → Confirm / Reject / Edit → Persist`

## 3. Completed Local Capabilities

The frozen Local lifecycle provides truthful, offline/local-first workflows.

- Local Candidate material extraction and conservative deterministic structuring.
- Candidate Proposal generation from local evidence.
- Review, confirm, reject, and edit-and-confirm flows.
- Confirmed Candidate revisions and direct edit/versioning.
- Candidate library and detail views with immediate lifecycle updates.
- Job lifecycle parity where implemented, including detail and removal interactions.
- Local review queue behavior for multiple sources.
- Responsive Candidate and Job detail interactions.

Local is intentionally useful without pretending to be a model:

`Read + Extract + OCR + Deterministic Rules`

When deterministic rules cannot form a reliable field, the truthful outcome is
unknown plus reviewable extracted evidence, not invented semantic understanding.

## 4. Delete Semantics

Candidate removal is context-level and history-preserving.

### Remove Card

- Removes the active Candidate context/card from the active Personal library.
- Does not delete the SourceDocument.
- Does not delete ExtractionArtifact, ProcessingRun, Proposal, ReviewDecision, or
  historical Candidate revisions.
- Does not remove sibling cards derived from the same source.
- Removed context is excluded from default active Candidate Context compilation.

### Source-Scoped Hard Delete

- Uses the SourceDocument identity as the deletion boundary.
- Deletes that source and data derived from that source, according to the accepted
  lifecycle implementation.
- Does not use `batch_id` as a deletion boundary.
- Does not delete sibling sources from the same multi-file import batch.
- A hard-deleted source can be imported again as a clean new source.

No restore or undo feature was introduced in this phase.

## 5. Multi-file, Dedupe, and Review

Each imported file has an independent source identity.

- Exact same-source re-import does not create a duplicate proposal.
- An active exact source does not produce another active card.
- A pending exact source resumes its existing review path.
- `A + A + B` preserves one exact-source identity for `A` and an independent source
  identity for `B`.
- Resolving one source in a multi-source review queue does not close the overall
  import while other sources remain unresolved.
- Normal completion occurs only after the queue is resolved as required.

The accepted multi-file cancellation contract remains frozen:

- The current source does not become a successful result.
- The remaining queue stops immediately.
- Previously successful records remain.
- There is no rollback.
- The cancelled batch does not emit normal success completion.

## 6. Runtime and Authority Boundaries

The authoritative Runtime / Local / AI execution contract is:

[`docs/current/ARIADNE_RUNTIME_EXECUTION_CONTRACT.md`](../current/ARIADNE_RUNTIME_EXECUTION_CONTRACT.md)

That document remains the authority for this phase and all later Runtime work.

Key retained invariants:

- Current Runtime is current Capability Authority.
- Historical Provenance is independent and is not rewritten by Current Runtime.
- Local makes zero Provider calls.
- Local has no AI Conversation.
- Local extraction, OCR, and deterministic rules must not be presented as AI
  semantic understanding or model-generated results.
- Model Runtime may reuse safe local preprocessing.
- Semantic Model operations must call the selected real Provider/model.
- Model failure must fail closed; Model-to-Local silent fallback is forbidden.
- AI mutation remains Proposal → Before / After / Why → User Confirm → Persist.

The frozen Local lifecycle must not be reinterpreted as a hidden Model runtime.

## 7. Source Foundation: Current Reality and Gap

The next phase must first audit raw-source persistence before designing Model
understanding.

Current repository reality is intentionally mixed:

- Canonical SourceDocument-oriented persistence stores source metadata and derived
  records, with validation that rejects embedded raw bytes in canonical truth forms.
- The Local Candidate path persists canonical source metadata and extraction
  artifacts.
- Legacy browser IndexedDB paths still use `SourceDocument.file_blob` for local raw
  file retention and can re-extract from it.
- Export-oriented source metadata removes `file_blob` and extracted-page payloads.

This means the next thread must establish, from code and accepted contracts, which
raw source is durably available after reload/reopen and which path is canonical.

Do not assume that a local extraction result proves durable original-file storage.

## 8. Technical Debt Observed, Not a Current Blocker

- `public/v1-pages.js` remains a large orchestration surface spanning import,
  review, and detail behavior.
- Candidate and Job persistence/lifecycle helpers remain separate where their
  domain models differ.
- Several browser modules retain IndexedDB opener/version/store knowledge,
  including `career-evidence.js`, `local-first.js`, `local-jobs.js`, and
  `career-profile.js`.
- Canonical non-embedded SourceDocument persistence and legacy `file_blob`
  persistence need a deliberate reconciliation before real Model source reuse.

These are audit inputs for the next phase, not authorization to refactor the
frozen lifecycle phase.

## 9. Do Not Reopen

Without a new explicit product decision, do not reopen:

- Local Candidate parser accuracy or semantic claims.
- OCR/extraction behavior.
- Candidate or Job lifecycle semantics.
- Review queue, multi-file behavior, or exact-source dedupe.
- Source-scoped hard-delete boundaries.
- Candidate/Job detail interactions, delete popover behavior, responsive behavior,
  or accepted Chinese UI copy.
- Runtime/Provider/Model/AI Conversation implementation as part of lifecycle work.
- The frozen cancellation contract.

## 10. Next Phase: Source Foundation + Real Model Runtime

The intended next phase is:

`SOURCE FOUNDATION + REAL MODEL RUNTIME`

Begin with a repository-grounded audit in this order:

1. Is an uploaded PDF, DOCX, or image durably stored locally after import?
2. After reload/reopen, which source can a Model operation actually obtain again?
3. What is the current canonical SourceDocument reality, and how does it relate to
   legacy `file_blob` storage?
4. Can existing raw persistence be truthfully reused for the Model path?
5. What is the smallest Source Foundation gap that must be closed first?
6. What is the real Provider execution boundary today?
7. Which real eligible Provider/model supports the first vertical slice?

Only after that audit should the work proceed to Real Model Candidate
Understanding, then an equivalent Job path where the contract permits it.

The Model path must preserve:

`Source → local extraction/OCR where appropriate → selected real Provider/model → semantic understanding → structured Proposal → validation → user review → confirmation → authoritative persistence`

## 11. Recommended First Audit Files

Read the canonical contract first, then inspect these repository files.

### Contract and Persistence

- `docs/current/ARIADNE_RUNTIME_EXECUTION_CONTRACT.md`
- `data/truth_persistence_v1.schema.json`
- `public/truth-persistence-domain.js`
- `src/truth_persistence.py`
- `data/domain_contracts/canonical_career_context_v1.json`

### Local Source and Lifecycle Paths

- `public/local-candidate-extraction-domain.js`
- `public/local-candidate-review-domain.js`
- `public/local-context-lifecycle-domain.js`
- `public/local-job-lifecycle-domain.js`
- `public/v1-pages.js`
- `public/career-evidence.js`
- `public/career-evidence-domain.js`

### Runtime and Provider Boundaries

- `public/runtime-capabilities.js`
- `public/runtime-capability-gate.js`
- `public/runtime-selection.js`
- `src/execution_contract.py`
- `src/provider_runtime.py`
- `src/provider_registry.py`
- `src/ai_provider_capabilities.py`
- `app.py`

### Regression Baseline

At the freeze commit, the complete regression baseline was:

- Node: `25/25 PASS`.
- Python: `14/14 PASS` with `PYTHONPATH="$PWD"`.
- `git diff --check`: `PASS`.

For subsequent work, inventory the actual current `tests/*_regression.mjs` and
`tests/*_regression.py` files rather than assuming these counts remain fixed.

## Handover Rule

Treat this document as a concise phase handoff only.

When a decision concerns Runtime authority, capability truthfulness, Local versus
Model behavior, provenance, fallback, proposal confirmation, or cancellation,
defer to the canonical Runtime Execution Contract and any later explicitly
accepted product decision.
