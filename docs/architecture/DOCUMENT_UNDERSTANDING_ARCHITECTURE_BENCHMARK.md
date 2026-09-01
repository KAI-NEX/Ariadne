# Job Radar — Document Understanding Architecture Benchmark & Freeze

Date: 2026-08-24  
Status: **CAREER DOCUMENT UNDERSTANDING FOUNDATION = COMPLETE / ARCHITECTURE BENCHMARKED AND FROZEN**

## Decision

The winning production architecture is:

```text
PDF / DOCX / MD / TXT
→ native document blocks when usable
→ Apple Vision V1 Auto only for PDF pages without a usable native text layer
→ GapTree-style column order only for OCR Resume pages
→ DocumentBlock v1
→ separate Resume / Portfolio structure logic
→ CareerEntity proposal
→ entity-level human review
→ confirmed-only CareerEvidence derivation
```

It wins because it is the only option that combines 6/6 truth-document acceptance, 20/20 corpus execution, page/block provenance, local-only processing, bounded runtime and low production complexity. Native and OCR content are selected per page rather than blindly appended, so there is no silent duplicate text. Missing fields remain empty/null.

The layer is frozen. Future engine work requires a repeated real-user failure that this architecture cannot handle.

## Corpus and truth

- 20 source documents, 305 pages, referenced in place; no source was copied, overwritten or uploaded.
- Formats present: PDF and DOCX. The production path and regressions also cover Markdown and TXT.
- Text modes: 8 native-text, 9 mixed, 3 image-only.
- Macro families prevent similar tailored Resume variants from dominating the result.
- Four non-Kai documents are benchmark-only and never enter Kai's Career Model.
- Six documents have selected truth: base Resume, Tencent Resume PDF, Tencent Resume DOCX, image-only English CV, Tencent Portfolio, and architecture Portfolio.
- Full rerun: 20/20 completed, 18 reviewable, 2 safely `needs_manual_selection`, 0 crashes, 6/6 truth passed.

Durable inputs and measurements live in `document_benchmark/benchmark_sources.json`, `document_benchmark/truth_set_v1.json`, `data/domain_contracts/document_block_v1.json`, and `document_benchmark/outputs/`.

## Controlled results

### Apple Vision ablation

All five configurations reached macro critical-term recall 0.9667. `VISION_V1_AUTO` had the same recall, the highest recorded mean confidence (0.8612), and the fastest mean time in the final run (1.233 seconds/page). It is selected because it removes a fixed Chinese/English language assumption without a measured regression. Project-specific custom words did not improve recall and were not adopted.

Tencent Portfolio with V1 Auto: 8/8 critical terms, four Project Entities, correct `[4, 5]` multi-page Material Card group, 0.532 seconds/page in the representative run.

### Layout ablation

| Layout | Macro order | Macro grouping | Decision |
|---|---:|---:|---|
| L0 current | 0.7933 | 0.8407 | Default for native documents and Portfolio |
| L1 GapTree-style | 0.8133 | 0.8429 | Conditional OCR-Resume use only |
| L2 hybrid | 0.7733 | 0.7044 | Rejected |

Global GapTree is unsafe: it repaired the image-only English CV and restored Tencent Resume language groups, but changed the reviewed base Resume from five work groups to seven. Production therefore uses source/type-conditional layout selection, not a global switch.

### Required comparison matrix

| Pipeline | Recognition | Layout / structure | CareerEntity result | Provenance | Runtime / cost | Decision |
|---|---|---|---|---|---|---|
| CURRENT | macro terms 0.9667 | order 0.7933; grouping 0.8714 | Strong on native Resume; old image-only Resume path incomplete | PDF page/text; native bbox added now | Native is fastest | Baseline retained inside winner |
| TUNED_VISION | macro terms 0.9667; confidence 0.8612 | L0 grouping 0.8407 | Tencent Portfolio 4/4 | page+bbox+confidence | 1.233 s/page macro | Selected OCR config |
| VISION_GAPTREE | same OCR blocks | order 0.8133; grouping 0.8429 | Fixes OCR multi-column CV; regresses native base Resume if global | preserved | light deterministic step | Conditional Resume-only adoption |
| BEST_VISION_LAYOUT | V1 Auto | L0 default + conditional GapTree | Full truth 6/6 after conditional gate | DocumentBlock v1 | full corpus 46.4 s | Part of winner |
| HYBRID_VISION | macro terms 0.9667 | grouping 0.8407 in overlap prototype | Native/OCR overlap duplicated or regrouped Resume content | methods traceable | extra OCR/dedup logic | Blind fusion rejected; page replacement adopted |
| PADDLE_STRUCTURE | targeted page 5/6; `CASE 01`→`CASEO1` | 18 typed blocks, bbox/order | No Entity gain | strong | 725.6 s/page; ~4GB RSS; 1.1GB env + 1.7GB models | Rejected as default |
| SURYA | no output | no output | unavailable | not evaluated | failed in 1.773 s: missing mandatory llama-server | Rejected; runtime/license boundary |
| DOCLING | targeted page 6/6 | 18 typed blocks; header/layout retained | No Entity gain over Apple | strong typed provenance | 35.6 s/page; 1.3GB env + 164MB layout model | Reference only |

Challenger metrics are targeted single-page tests, not full-corpus scores. They test whether dependency weight solves a repeated failure; none did.

## Why alternatives lost

1. **Global GapTree:** repaired OCR columns but caused false Work grouping on reliable native text. Failure layer: Layout Reconstruction.
2. **Blind native/OCR fusion:** duplicate/overlap handling changed Resume grouping without increasing term recall. Failure layer: Block Fusion.
3. **Paddle PP-StructureV3:** useful typed layout, but orders of magnitude slower, heavier, and less correct on the CASE number in the tested page.
4. **Surya:** current release requires llama.cpp/vLLM. Its model license adds a material product boundary. No result justified escalation.
5. **Docling:** excellent reference IR/provenance, but around 65× slower than Apple on the tested Portfolio family and no CareerEntity gain.

## Production changes

- `src/extraction/extract_pdf_text.swift` emits native PDF blocks with coordinates.
- `src/career_evidence.py` chooses native or Apple Vision per page, emits DocumentBlock v1, applies conditional OCR-Resume ordering, and preserves source method.
- English section aliases, bounded heading typo tolerance, split date/role/company Resume layouts, and missing-date English Education are supported without user-file rules.
- Portfolio grouping supports CASE boundaries, conventional `01 + DISPLAY TITLE` multi-page sections, and one-entity `project_description` documents. Resume and Portfolio logic remain separate.
- The browser stores `document_blocks` with each SourceDocument. Existing cards are clickable/filterable and support re-recognition; chooser, drag/drop and clipboard paste share one import path.
- No IndexedDB store was deleted, no source Blob replaced, no legacy Evidence converted, and only confirmed entities derive CareerEvidence.

## Failure attribution and fixes

| Symptom | Layer | Root cause | Fix / decision | Regression evidence |
|---|---|---|---|---|
| CASE 01 initially absent | Benchmark selection | Sample skipped real page 3 | Corrected truth/sample | Tencent Portfolio 8/8 and 4/4 |
| Architecture terms scored 0 | Benchmark selection | Truth terms are on page 9, sample used page 10 | Sample includes page 9 | term truth rerun |
| Image-only English CV produced Basics only | Layout + Document Structure | Raster order mixed columns; English layouts unsupported | conditional GapTree, English/fuzzy headings, split-line mapping | 1 Basics, 3 Work, 2 Education, 1 Skills |
| Global GapTree produced 7 instead of 5 Work groups | Layout Reconstruction | Whitespace split applied to reliable native layout | Gate by OCR Resume source method | base Resume stays 5 Work / 2 Education |
| Architecture Portfolio projects not detected | Entity Grouping | Parser only recognized CASE headings | conservative numbered continuation | four projects; role/outcomes empty |
| Two external Portfolios have no reliable boundary | Document Structure | No validated CASE/numbered contract | fail closed as `needs_manual_selection` | 0 invented projects; extraction completes |

Only the evidenced layer changed. CareerEntity semantics, review rules, persistence ownership and Evidence derivation were not weakened to hide extraction failures.

## Acceptance and residual limitations

- Resume: base 5 Work/2 Education; Tencent PDF and DOCX both 13 entities; image-only CV 3 Work/2 Education/Skills; unknown dates remain null; stable duplicate IDs pass.
- Portfolio: Tencent four projects and cross-page grouping pass; architecture Portfolio four numbered projects passes; seven project reports yield one first-class Project each; unsupported roles/outcomes remain empty.
- Provenance: SourceDocument → DocumentBlock/Entity → page/bbox/excerpt/source method is retained. DOCX/MD/TXT have line provenance; physical pagination/bbox is unavailable and explicitly zero-area in DocumentBlock.
- Review/Evidence: entity-level approve/edit/reject/reopen and confirmed-only selective Evidence regression pass. No real claim was auto-confirmed.
- Persistence: additive IndexedDB v4 stores and source Blobs are preserved. Duplicate identity/reload were browser-accepted earlier; current HTTP smoke confirms extractor v2 is live.
- Remaining limitation: Portfolios without explicit reliable boundaries remain manual rather than hallucinated. Image semantics and visual responsibility inference are intentionally not attempted. These do not justify Gemini/DeepSeek today.

## Reference architecture audit

Actual source/schema files were inspected, not README alone. Commits and decisions are in `document_benchmark/reference_architecture_audit.json`.

- SmartResume: separate extraction types, prompts/schemas, blank missing values and source line ranges — adopted as separation/provenance patterns.
- RAGFlow: native cells plus selective OCR/layout — adopted at page-selection level; overlap fusion rejected by regression.
- GapTree: bbox whitespace ordering — adopted conditionally.
- PaddleOCR: typed regions — benchmarked, too costly for default.
- Surya: current VLM backend/model-license boundary — rejected.
- Docling: unified typed document/provenance model — adopted as IR reference, not dependency.

Official repositories: [SmartResume](https://github.com/alibaba/SmartResume), [RAGFlow resume parser](https://github.com/infiniflow/ragflow/blob/main/rag/app/resume.py), [GapTree](https://github.com/hiroi-sora/GapTree_Sort_Algorithm), [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR), [Surya](https://github.com/datalab-to/surya), [Docling](https://github.com/docling-project/docling).

## Learning / ownership closeout

### Product progress

The application now has a benchmarked, production-integrated, local-first document foundation rather than a single-file OCR fix.

### New transferable knowledge

- OCR recognition, reading order, document structure, entity grouping and mapping are separate failure layers.
- A canonical intermediate representation compares engines without rewriting CareerEntity.
- Native/OCR fusion is safest when absence is explicit; more text is not automatically better.
- Conditional architecture can beat a global “best” algorithm when layout families differ.
- Evaluation must balance families and test empty fields, provenance and engineering cost.

### User-owned evidence

The user supplied the Entity-first boundary, local privacy boundary, metric priorities, failure hypotheses, real corpus, acceptance criteria, simplicity policy and requirement to test general capability rather than overfit one file. These are user-owned product/architecture decisions.

### Tool-assisted implementation

Python/Swift/JavaScript changes, adapters, harnesses, dependency installation, regression and diagnosis were Codex-assisted. Working code does not establish independent user coding ability.

## Milestone boundary

The document-understanding architecture gate is complete and frozen. P4.2 is not started. Human confirmation of real Career Entities remains a product review action and is not auto-performed by this closeout.
