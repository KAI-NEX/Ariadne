# Ariadne · 衡

> **A bounded AI runtime for career judgment.**
>
> Ariadne turns personal materials and job descriptions into reviewable, versioned, source-grounded decisions—without letting an AI silently rewrite who you are.

[中文说明](README.zh-CN.md) · [Project history](PROJECT_HISTORY.md) · [Runtime contract](docs/current/ARIADNE_RUNTIME_EXECUTION_CONTRACT.md) · [Codex connector](docs/current/CODEX_RUNTIME_CONNECTOR.md)

## Why Ariadne

Most AI career tools optimize text. Ariadne is built to protect judgment.

Personal experience is not ordinary input data: a fluent rewrite can be unsupported, a job requirement can be mistaken for a personal fact, and a plausible answer can hide what remains unknown. Ariadne therefore keeps five things distinct:

1. **Source material** — what the supplied document actually says.
2. **User-confirmed information** — what the person has explicitly accepted as their own.
3. **Model inference** — an interpretation or suggestion, never automatic truth.
4. **Working proposals** — reviewable changes that have not yet become confirmed data.
5. **Unknowns** — gaps that need clarification, not invented evidence.

Candidate material and job descriptions are separate domains with their own versions and permissions. Ariadne relates the current valid versions only when the user chooses a job to discuss. Its useful output is not a black-box match score: it explains what has support, what needs evidence, what needs clearer expression, and what cannot yet be concluded.

## Why not just use Codex?

Codex is excellent at general software work: it can inspect a workspace, use tools, edit files, and verify a result. Ariadne solves a different problem. It is a product-level boundary around sensitive career material.

| | Codex | Ariadne |
| --- | --- | --- |
| Primary context | Codebase, tools, and a task | Candidate sources, job sources, versions, and consent |
| Success condition | A software task is completed and checked | A career judgment is traceable and reviewable |
| Authority to change | Can edit project files within the requested task | Can only create a proposal; the person explicitly saves a confirmed version |
| Treatment of uncertainty | Resolve the task with available evidence | Preserve unknowns rather than turn them into claims |
| Scope | General-purpose agent runtime | Domain runtime for career judgment |

Codex can be an Ariadne model provider, but it is deliberately not given open workspace-agent authority over a person's career data. Ariadne limits each request by domain, operation, source, version, runtime capability, and save permission. A failed Model request fails visibly; it never pretends to have succeeded or silently becomes a Local result.

## What works today

- Import Candidate and Job materials from PDF, DOCX, images, text, and Markdown; retain the original source and restore it later.
- Use Local deterministic processing without provider calls, or a Model runtime that has passed Ariadne's image and visual-PDF capability gate.
- Review model output as Working content and explicitly save it as a new confirmed version.
- Discuss Candidate material, a specific Job, personal understanding, or an overview of all current jobs—each with its own context and write boundary.
- Make bounded natural-language edits to existing, same-source Candidate cards; Ariadne validates identity, versions, allowed fields, and actual execution before showing a receipt.
- Attach materials to a conversation turn with an explicit transmission confirmation. Attachments stay separate from confirmed Candidate and Job data.
- Use the verified local Codex runtime, or pair a web page to a local Codex connector without exposing Codex credentials to the page backend.

The verified Codex combination is `codex-cli 0.153.4` with `gpt-5.6-sol`. The connector runs on loopback, uses short-lived pairing, and only exposes Ariadne's listed domain routes. Details and limitations are in the [Codex connector guide](docs/current/CODEX_RUNTIME_CONNECTOR.md).

## What Ariadne deliberately does not do

- Does not auto-submit applications or operate a job board on the user's behalf.
- Does not treat a match score as a career verdict.
- Does not invent achievements, skills, preferences, or job requirements.
- Does not merge Candidate and Job facts into one mutable profile.
- Does not silently downgrade a Model request to Local processing.
- Does not include the maintainer's credentials, résumé, job data, database, or browser workspace in this repository.

## The idea in one flow

```text
original material
    → durable source + provenance
    → Local or qualified Model understanding
    → Working proposal / explanation / clarification
    → human review
    → explicit save
    → versioned confirmed context
    → selected Job relationship analysis
```

The model is allowed to interpret. The person remains the authority on what becomes their story.

## From Job Radar to Ariadne

The project began as **Job Radar**, a small local-first job-record and document-understanding experiment. It became Ariadne when the problem was reframed: not “how can an agent automate job search?” but “how can AI help a person make sound, evidence-aware career judgments?”

From 2026-08-24 through 2026-09-10, the repository records **83 dated milestones, fixes, and decisions**. The current Git history contains **79 traceable commits**. These are not 83 feature releases; they cover architecture, document understanding, privacy boundaries, runtime safety, model integration, UI work, and verification.

Key transitions:

1. Local Job Radar records and review flows.
2. Native PDF reading plus Apple PDFKit/Vision OCR, source locations, and evidence boundaries.
3. Research into open-source job-search, résumé, browser-execution, and portable-profile patterns—adopting ideas, not third-party code.
4. A source-first architecture: Candidate and Job domains, Working versus confirmed data, explicit consent, and fail-closed model contracts.
5. Multimodal model workflows with qualified visual-PDF handling instead of text-only claims.
6. A bounded Codex runtime and loopback web-pairing connector.
7. Product hardening: natural-language editing receipts, personal understanding, job overview, a visual system, DOCX support, multimodal conversation attachments, and interaction/accessibility refinement.

Read the [full project history](PROJECT_HISTORY.md) for the evidence, milestones, and deliberate non-goals.

## Run locally

Requirements:

- Python 3.11+
- Node.js 20+ for the regression suite
- macOS for the currently verified complete document path; some local PDF/OCR processing uses Swift, PDFKit, and Vision
- Poppler's `pdftoppm` for complete PDF-to-image rendering

```sh
git clone https://github.com/KAI-NEX/Ariadne.git
cd Ariadne
python3 app.py
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/). A clean clone starts with an empty local workspace and does not require the maintainer's private seed data.

To enable the local Codex runtime, first install and log in to Codex CLI, confirm `codex login status`, then run:

```sh
ARIADNE_CODEX_ENABLED=1 python3 app.py
```

The service is intentionally loopback-only. Do not expose it or the connector through a public tunnel, reverse proxy, or router mapping.

## Verification

```sh
python3 scripts/run_regressions.py
python3 scripts/check_vi.py
python3 scripts/check_public_release.py
```

| Directory | Purpose |
| --- | --- |
| `public/` | Native HTML, CSS, JavaScript, and visual assets |
| `src/` | Domain contracts, document handling, and provider adapters |
| `data/` | Public schemas, contracts, and synthetic examples |
| `tests/` | Synthetic regression coverage; private real-material fixtures are not published |
| `docs/` | Current contracts and retained design evidence |

## Project status and contribution

This is an early open-source preview, not a hosted public web application. Model output must be reviewed; passing tests does not guarantee correct interpretation of every real document. Full document-path verification currently focuses on macOS.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [CHANGELOG.md](CHANGELOG.md), and the [MIT License](LICENSE). For current implementation status, read [PROJECT_STATUS.md](PROJECT_STATUS.md); for stable product constraints, read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).
