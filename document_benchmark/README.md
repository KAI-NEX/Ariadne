# Document Understanding Benchmark Archive

## Why this exists

This benchmark established the local-first production architecture for Career Document Understanding. It compared native extraction, selective Apple Vision OCR, conditional Resume reading order and heavier challenger tools against a real Resume/Portfolio corpus.

## Final winner

```text
usable native document blocks first
→ Apple Vision V1 Auto only for unusable PDF pages
→ adaptive GapTree only for OCR multi-column Resume pages
→ DocumentBlock v1
→ separate Resume / Portfolio structure mapping
→ entity-level Human Review
→ confirmed-only CareerEvidence
```

The benchmark is closed. The production architecture is frozen unless repeated real-user architecture-level failures justify a future review. This folder is evidence, not an active dependency-development area.

## Read in this order

1. `../docs/architecture/DOCUMENT_UNDERSTANDING_FINAL_ARCHITECTURE_REVIEW.md` — final independent-review verdict and closeout.
2. `../docs/architecture/DOCUMENT_UNDERSTANDING_ARCHITECTURE_BENCHMARK.md` — comparison rationale and final measurements.
3. `full_corpus_acceptance.json` — final production corpus result.
4. `truth_set_v1.json` and `benchmark_sources.json` — frozen expected outcomes and source inventory.
5. `gpt_audit/blind/` and `gpt_audit/comparison/` — independent frozen review artifacts.

## Artifact map

- `benchmark_sources.json`, `truth_set_v1.json`, `reference_architecture_audit.json` — durable benchmark inputs and reference/license audit.
- `outputs/full_corpus_acceptance.json`, `outputs/architecture_comparison.json`, `outputs/vision_ablation.json`, `outputs/layout_ablation.json` — final and supporting measurements.
- `outputs/raw/`, `outputs/architecture/`, `outputs/layout/`, `outputs/challenger_results.json` — retained historical/challenger measurements. They explain rejected options; they are not production dependencies.
- `gpt_audit/` — frozen blind and second-pass comparison artifacts.
- `run_benchmark.py` — retained harness for read-only/reproducible benchmark execution.
- `CLEANUP_MANIFEST.md` — P4.1 cleanup classification and deletion record.

## Cleanup result

No benchmark-only executable repository, virtual environment, rendered-page directory, temporary challenger adapter output or challenger server log remained in the project. Recreated Python bytecode and Finder metadata were removed. The shared Hugging Face model cache is intentionally `REVIEW_REQUIRED`, because Job Radar cannot prove exclusive ownership; it was not deleted.

## Frozen regression

From the project root:

```bash
python3 tests/career_entity_regression.py
/Users/kai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tests/career_evidence_regression.mjs
python3 tests/analysis_review_regression.py
```

These cover the real English CV, Touchine Portfolio, Tencent Resume PDF/DOCX, Tencent Portfolio, 45-page comprehensive Portfolio, entity/evidence boundaries and Phase 3 review regression. Do not rerun challenger installation or alter the production architecture as part of ordinary maintenance.
