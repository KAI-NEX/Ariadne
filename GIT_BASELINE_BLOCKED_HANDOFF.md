# Ariadne — Git Baseline Blocked Handoff

## 1. Status

`BASELINE CHECKPOINT = BLOCKED`

No commit created.

Current Git state:

- branch: `main`
- commits: `0`
- remote: `none`
- staged files: `0`
- product code changed by this audit: `no`

The Git baseline was intentionally stopped at the dry-run safety gate. This was expected safety behavior, not an execution failure.

## 2. Why baseline was blocked

`git add --dry-run .` would add approximately 251 files. The candidate set included content that must not enter the first Git baseline without classification.

### Real JD / job data

- `data/jd-001.json`
- `data/batch06_candidates/jd-002.json` through `data/batch06_candidates/jd-014.json`

### Raw job-source data

- `data/raw/boss-*.json`
- `data/raw/tencent-careers-*`
- normalized and reconciliation job data

### Resume / Portfolio derived benchmark material

- `document_benchmark/gpt_audit/**`
- `document_benchmark/outputs/**`
- `document_benchmark/truth_set_v1.json`

### Potentially personal project documentation

Parts of the following may contain real career identity or project evidence:

- `TECHNICAL_EVIDENCE.md`
- `docs/architecture/`
- `docs/history/`

These Markdown files must not be excluded automatically as a group. A later audit must distinguish `PROJECT DOCUMENTATION` from `PRIVATE SOURCE MATERIAL`.

## 3. Current `.gitignore` coverage

The current ignore rules already protect:

- `.env*`
- common private-key formats
- `data/job_radar.db`
- `data/local_ocr_uploads/`
- `__pycache__/`
- `*.pyc`
- `.DS_Store`
- existing Resume / Portfolio / upload / export exclusions

## 4. Missing protection identified

The following ignore protection still requires review or addition:

- `credentials.json`
- `secrets.json`
- `.pytest_cache/`
- `node_modules/`
- `.npm/`
- `*.tmp`
- `*.swp`
- generic SQLite/runtime databases
- IndexedDB exports
- conversation exports
- Candidate Context exports
- `data/raw/`
- real JD corpus
- private benchmark-derived outputs
- real Resume / Portfolio derived material

This handoff does not modify `.gitignore`; it records the missing protection only.

## 5. Secret scan

The high-confidence secret-pattern scan found no API Key or private-key body.

That result does not make the baseline safe. Real career material and runtime/private data still appeared in the dry-run candidate list.

## 6. Why no commit was created

Safety rule:

If a dry-run includes any credential, real Resume, real Portfolio, real JD corpus, private career data, or private runtime data, stop before staging or committing.

Therefore:

- `git add` was not executed.
- `git commit` was not executed.

## 7. Required next action

The next thread's first task is `GIT BASELINE SAFETY UNBLOCK`:

`Inspect → Classify TRACK / IGNORE / REVIEW → minimally update .gitignore → git add --dry-run . → inspect candidate tracked files → secret-pattern check → run baseline regressions → only then create the first local commit`

## 8. Hard boundary for the next thread

Before the safe baseline exists, do not:

- start UI refinement
- make broad changes to `styles.css`
- modify `v1-pages.js`
- change Provider behavior
- change Candidate / Job schema
- change Figma
- execute a real career-data AI call

The first task must complete the Git source-control boundary.

## 9. Important principle

Git ignore does not delete local data.

Real JD, Resume, Portfolio, raw data, and runtime data can remain in the user's local project directory. The goal is only to prevent that material from entering the Git source-control baseline.

Do not add private files to the repository merely to obtain a clean `git status`.

## 10. Relationship to the existing handoff

This file supplements `NEXT_PHASE_HANDOFF.md`.

It records only why the first Git baseline has not been created and the safety steps the next thread must complete. It does not copy or replace the full product/UI handoff.
