# Ariadne project history

This document is the readable history behind Ariadne's present product boundary. It summarizes evidence already retained in `PROJECT_STATUS.md`, `PROJECT_CONTEXT.md`, the architecture records, the Git history, and the release record. It does not replace the current contracts.

## Counts and how to read them

| Measure | Recorded value | Meaning |
| --- | ---: | --- |
| Dated status entries | 83 | Milestones, fixes, validation records, decisions, and historical checkpoints from 2026-08-24 to 2026-09-10 |
| Git commits | 80 | Traceable commits in the current repository history |
| First public release | `v0.1.0`, 2026-09-09 | MIT open-source preview, not a hosted public web product |

Neither count is a feature count. A small visual correction, an architecture gate, a privacy audit, and a document-understanding implementation are all different kinds of work. The figures are included to make the project legible, not to imply that every record is a user-visible release.

## 1. Job Radar: local records before agent automation

The project started as **AI Job Radar**. Its initial concern was intentionally modest: record jobs locally, preserve their source evidence, let a person review a structured candidate, and track their own application state without confusing that state with external job facts.

The earliest local-first direction already rejected several tempting shortcuts:

- A job board response was evidence, not the same thing as a user's application status.
- Imported material had to remain reviewable before it became a saved record.
- Local data and provider calls had to be distinguishable.
- The product would not begin with automatic job-board control, RAG, a general MCP platform, or blind submission.

## 2. Document understanding: source before summary

The next question was not “can a model summarize a résumé?” but “what does a reliable local document path need to preserve?” The project added native PDF reading, source documents, extraction runs, document blocks, source references, and human review.

For difficult PDF pages, the verified macOS path used PDFKit first and Apple Vision OCR as a selective fallback. It retained text, locations, confidence, and uncertainty instead of converting an OCR result into an unquestioned fact. Resume and portfolio material used different structural logic because their documents carry different kinds of evidence.

This phase established a durable distinction: technical extraction can prepare material; it does not itself prove semantic understanding.

## 3. Reference research: adopt patterns, not code

The architecture review examined projects and products including Simplify, Teal, Huntr, Careerflow, jobsearch-mcp, BrowserSkill, JSON Resume, and Reactive Resume. The resulting design decisions were specific:

| Useful pattern | Ariadne's decision |
| --- | --- |
| One profile reused across work | Derive reusable context only from reviewed evidence, with provenance |
| Job tracker as a workflow center | Keep user workflow state separate from source truth |
| Requirement-level match explanation | Explain support, weakness, missing evidence, and unknowns rather than treat a score as truth |
| Browser automation with human takeover | Keep external execution outside Ariadne's reasoning core |
| Portable résumé data | Support portability without confusing a résumé schema with an evidence/provenance schema |

The review explicitly did **not** clone, install, or reuse third-party project code. It did not use the research to justify automatic applications, stealth browsing, a large cloud SaaS stack, or an internal general-purpose agent platform. See the [reference pattern matrix](docs/architecture/PHASE_4_ARCHITECTURE_REFERENCE_REVIEW.md).

## 4. The architecture change: career judgment has two truth domains

The decisive change was to stop treating career data as a single editable AI profile.

Candidate material and Job material became separate domains. Each has its own source, semantic state, version, conversations, and modification authority. Relationship analysis uses the current valid context, but a Job conversation cannot silently change Candidate truth.

The persistence model also separated:

```text
SourceDocument → model/local output → Working or Proposal → human review → confirmed version
```

This is why Ariadne can say “there is not enough evidence” without treating the absence of evidence as absence of ability. It is also why an AI suggestion can be useful without becoming a claim about a person.

## 5. From local processing to qualified multimodal models

Model integration did not replace Local processing. The product retained Local's deterministic, zero-provider-call path and introduced a distinct Model path.

The architecture later raised the minimum bar for every Model operation: a model must have verified image input and visual-PDF handling, whether through native PDF input or complete page rendering. A model name, a visible model list, OCR-only preparation, or a successful text request is not capability evidence. Missing capability, missing source material, a changed hash, incomplete rendering, or an invalid model output closes the operation rather than producing a plausible substitute.

This boundary was tested with synthetic materials and documented separately from any claim about real personal materials.

## 6. Ariadne: a product boundary, not a chat wrapper

By this point, the product was renamed **Ariadne · 衡**. The name reflects guidance through complexity and the Chinese idea of weighing, judgment, and trade-off.

The product added Candidate and Job imports, Working review, confirmed versions, source recovery, scoped conversations, and natural-language editing. Natural language is interpreted by the model; code remains responsible for references, identity, field eligibility, version checks, actual execution, and persistence rights.

This was an intentional division of labor:

- AI interprets supplied material, connects sources, explains a relationship, and asks valuable clarifying questions.
- Code preserves source identity, validates contracts, controls context scope, enforces versions and permission boundaries, and persists only explicitly saved results.

## 7. Codex becomes a bounded runtime

On 2026-09-09, Ariadne added a verified Codex integration for the current local environment. It supports both a direct local route and a web-page-to-loopback pairing route.

This did not make Ariadne a Codex wrapper. The integration keeps the existing domain schema, provenance, Working/Proposal flow, human save boundary, and capability gate. The Codex process is invoked from an isolated temporary directory with an ephemeral session; broad shell, browser, plugin, app, image-generation, and multi-agent capabilities are disabled for this use. Pairing uses exact Origin/Host checks and short-lived, revocable authorization. It never copies a Codex login token into Ariadne.

The [Codex runtime guide](docs/current/CODEX_RUNTIME_CONNECTOR.md) records the supported routes, security model, verified combination, and remaining public-web limitations.

## 8. Product hardening and v0.1.0

The first MIT open-source preview, `v0.1.0`, was published on 2026-09-09 after a public-file and secret-history audit. It included a clean-clone path, CI, contribution/security guidance, source isolation, and the local Codex connector.

The surrounding iteration also added or refined:

- persistent personal understanding with user-reviewed memory;
- a separate all-JD overview that does not read Candidate material;
- a maintained visual system with typography, grid, interaction, and accessibility checks;
- natural-language edit proposals with references, receipts, and same-source boundaries;
- complete PDF-page handling for Model operations;
- DOCX source recovery and DOCX import;
- six multimodal conversation entry points with confirmed per-turn attachments;
- interaction and navigation refinements verified against actual pages.

The latest state and precise validation boundaries remain in [PROJECT_STATUS.md](PROJECT_STATUS.md). Historical records do not authorize unstarted capabilities.

## What the history means

Ariadne did not evolve by adding a more aggressive agent every week. It evolved by making increasingly explicit answers to these questions:

1. What did the source say?
2. What did the user actually confirm?
3. What did the model infer?
4. What is still unknown?
5. What is allowed to be saved?
6. What happens when the runtime cannot prove it can do the work?

That is the project's central claim: **career AI becomes more useful when its reasoning is bounded by provenance, versioning, consent, and human authority.**

## Further reading

- [Current product context](PROJECT_CONTEXT.md)
- [Current status and validation records](PROJECT_STATUS.md)
- [Runtime execution contract](docs/current/ARIADNE_RUNTIME_EXECUTION_CONTRACT.md)
- [Product architecture consolidation](docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md)
- [Reference pattern matrix](docs/architecture/PHASE_4_ARCHITECTURE_REFERENCE_REVIEW.md)
- [Public-release security audit](docs/current/PUBLIC_RELEASE_SECURITY_AUDIT.md)
