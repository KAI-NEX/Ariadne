# Ariadne open-source launch plan

This is the non-visual launch checklist for Ariadne's early open-source preview. It is intentionally not a promise of a hosted service, automatic applications, or broader model support.

## 1. Repository metadata

Set these values in the GitHub repository's About section.

**Description**

```text
A bounded AI runtime for career judgment: source-grounded Candidate and Job analysis, human-reviewed versions, and optional local Codex.
```

**Homepage**

```text
https://ariadne.kai-nex.com
```

Use this only once the domain serves a truthful product/landing page. Until then, leave Homepage unset rather than link to a placeholder.

**Topics**

```text
ai, llm, career-development, job-search, local-first, privacy,
multimodal-ai, document-ai, codex, openai, resume, self-hosted
```

Use only topics that remain accurate. Remove `self-hosted` if Ariadne becomes a hosted-only product; do not add `agent` or `mcp` while those are not product capabilities.

## 2. GitHub configuration

- Keep `README.md` as the English first-read page and link `README.zh-CN.md` prominently.
- Keep [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), the MIT license, CI, and the changelog visible.
- Enable GitHub Discussions before inviting broad feature requests. Suggested categories: `Ideas`, `Show and tell`, `Q&A`, and `Career-data safety`.
- Create an issue template for reproducible bugs. Require platform, Ariadne version/commit, Local versus Model mode, document type, expected behavior, actual behavior, and whether the reporter can provide a synthetic reproduction. Explicitly forbid personal material, credentials, pairing codes, and raw provider responses.
- Label the first contribution opportunities only after scoping them: `good first issue`, `documentation`, `tests`, `macOS`, `privacy`, and `design`. Do not use `good first issue` as a substitute for a maintainable task.
- Do not add a Sponsor button until there is a real funding destination and a clear maintenance commitment.

GitHub Topics and the social preview are discovery surfaces; GitHub's own repository guidance calls out README, license, topics, and a social preview as ways to explain and identify a repository. See [GitHub's customization guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository).

## 3. Visual assets still needed

These are deliberately listed but not generated in this documentation change.

1. **Repository social preview** — 1280 × 640 PNG. Copy: `A bounded AI runtime for career judgment` and a compact Source → Proposal → Human Save flow. Do not use real career materials.
2. **45–90 second product demo** — synthetic Candidate and Job material; show import, source-aware proposal, review, explicit save, and version recovery.
3. **Three stills for a launch post** — a source/provenance view, a Working/Proposal review, and the Candidate ↔ Job explanation. Redact or synthesize every personal detail.

GitHub recommends a social preview image of at least 640 × 320 pixels and notes that 1280 × 640 provides the best display quality. [GitHub social preview guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)

## 4. Release plan

Do not create a new release merely because README copy changed. The next functional, verified milestone should become a pre-release or release with a clear version and a stable commit.

**Suggested release title**

```text
v0.2.0-alpha — Reviewable career judgment, not autonomous job search
```

**Suggested release notes**

```markdown
## What this release proves

Ariadne is a local-first, source-grounded workspace for understanding personal materials and job descriptions without silently turning model output into personal truth.

## Highlights

- Candidate and Job remain separate versioned domains.
- Model output is reviewed as Working content before explicit save.
- Local processing remains distinct from qualified Model execution.
- Optional local Codex runs through Ariadne's source, version, and permission boundaries.

## Boundaries

This is an early macOS-verified preview. It does not auto-apply to jobs, provide a hosted public web app, or guarantee interpretation quality for every real document. Do not put credentials or private materials in issues.

## Getting started

Read the README, run `python3 app.py`, and use synthetic material first.
```

GitHub Releases package a tagged point in history with notes and optional downloadable assets; use them for a meaningful installable or functional milestone, not for every documentation change. [GitHub Releases documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

## 5. Launch copy

### English: GitHub / X / LinkedIn post

```text
I open-sourced Ariadne (衡): a bounded AI runtime for career judgment.

Most career AI tools optimize text. Ariadne keeps source material, user-confirmed facts, model inference, Working proposals, and unknowns separate.

It treats Candidate and Job as different versioned domains, so a job requirement cannot silently become a claim about a person. Codex can be used as a model runtime, but it is bounded by source, version, consent, and explicit human save.

It is local-first, macOS-verified, and deliberately does not auto-apply to jobs.

Repository: https://github.com/KAI-NEX/Ariadne
```

### Chinese: 即刻 / 少数派 / V2EX / 掘金 post

```text
我开源了 Ariadne（衡）。它不是“让 AI 帮你自动投简历”的 Agent，而是一个用于职业判断的受限 AI 运行时。

它会严格区分：原始资料、用户确认的信息、模型推断、尚未保存的提案，以及仍未知的部分。个人资料和职位描述也分别维护，职位要求不会悄悄变成“你已经具备的能力”。

Codex 可以作为模型入口，但不能绕过来源、版本、传输确认和人工保存边界。

目前是本地优先、以 macOS 完整文档路径验收为主的早期开源预览版；明确不做自动投递。

GitHub：https://github.com/KAI-NEX/Ariadne
```

### Hacker News: Show HN title and body

```text
Show HN: Ariadne – A bounded AI runtime for source-grounded career judgment
```

```text
I built Ariadne because a generic AI can make a résumé sound better without being entitled to decide what is true about a person.

The project treats source material, user-confirmed facts, model inference, Working proposals, and unknowns as separate states. Candidate and Job are separate versioned domains, and model changes only become confirmed after explicit human save.

It has a local deterministic mode and an optional local Codex runtime. The Codex route is intentionally constrained to Ariadne's domain requests and cannot act as a general workspace agent over career data.

This is an early macOS-verified open-source preview. I would especially value criticism of the provenance/versioning model, the Model-vs-Local boundary, and the idea that career AI should preserve uncertainty rather than optimize a single match score.

https://github.com/KAI-NEX/Ariadne
```

## 6. Launch sequence

1. Verify the README and all release-facing links on GitHub.
2. Add repository description, topics, and the truthful social preview.
3. Publish the short synthetic-data demo.
4. Publish one architecture article: **“Why career AI needs a truth boundary.”** Link to the project history rather than retelling every commit in the post.
5. Launch the same day on GitHub, X/LinkedIn, and one Chinese technical community. Use the community's norms; do not cross-post identical promotional comments into unrelated threads.
6. Post the technically candid Show HN only after the demo and first-run instructions are ready.
7. Invite 10–20 AI-native early users to try a complete synthetic or consented real workflow. Collect failures by category: source handling, model reasoning, permission boundary, setup, and UX.
8. Publish one follow-up after real feedback changes the product. A transparent changelog is stronger than repeated feature announcements.

## 7. What to measure

Stars are a discovery signal, not product validation. Track:

| Metric | Why it matters |
| --- | --- |
| Repository-to-first-run completion rate | Reveals installation friction |
| First source → Working → explicit save completion rate | Tests the core product loop |
| Time to first understandable result | Tests the README and onboarding |
| Number of feedback reports with a synthetic reproduction | Measures contributor health without collecting private data |
| User-reported correction rate | Shows whether the product helps users calibrate model understanding |
| Return use for a second Job | More meaningful than a one-time demo |

Do not optimize for automatic application count. That would reward a behavior Ariadne intentionally does not promise.

## 8. Competitive positioning

| Project type | What it optimizes | Ariadne's distinct position |
| --- | --- | --- |
| Resume builder (e.g. Reactive Resume, OpenResume) | Producing, formatting, and exporting a résumé | The epistemic lifecycle before a résumé: source, inference, review, version, and job-specific explanation |
| Agent job-search framework | Search, tailoring, application artifacts, and sometimes submission | A bounded reasoning workspace that keeps personal truth separate from a target job and keeps execution outside the core |
| Job-search MCP server | Multi-source retrieval, semantic score, tracking, and alerts | Source-grounded Candidate/Job context, explicit human save, and no score-as-truth design |

Do not claim Ariadne is better than these projects overall. It solves a narrower, earlier, and more trust-sensitive problem.
