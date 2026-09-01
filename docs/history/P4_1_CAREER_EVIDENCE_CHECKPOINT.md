# P4.1 Career Material Entity-first — Final Checkpoint

**Date:** 2026-08-24  
**Status:** `COMPLETE / REAL RESUME + PORTFOLIO ACCEPTANCE VERIFIED`  
**Architecture:** Entity-first amendment to `../architecture/PHASE_4_ARCHITECTURE_REFERENCE_REVIEW.md`

## Product Progress

The Career Material Entity-first vertical slice now runs locally. The diagram below records the initial Resume path; the separate Portfolio path is documented in the final result section.

```text
Resume PDF / DOCX / MD / TXT
→ SourceDocument
→ local text extraction + ExtractionRun
→ typed Resume Career Entities
→ entity-level Human Review
→ Confirmed Career Model
→ selective Career Evidence derivation
→ IndexedDB persistence
→ refresh restore
```

Portfolio uses a separate visual extraction path: native PDF text first, then local PDF rendering + macOS Vision OCR when the PDF is image-only. It creates review-only Portfolio Projects; it does not call an external model.

## P4.1 Final Result — Portfolio + Shared Foundation

```text
Portfolio PDF
→ native text absent
→ local rendered-page OCR blocks (text + coordinate + confidence)
→ CASE-aware Project grouping
→ column-aware field mapping + quality gate
→ PortfolioProject CareerEntities
→ Entity Review
→ confirmed-only Career Evidence
```

- Real Portfolio result: Memoryblock Tea Product `[3]`, Material Card `[4,5]`, Material Resonance `[6]`, MUPAHKC `[7]`.
- Verified fields are populated only where source text supports them: Material Card problem/tools/outputs/boundary; Memoryblock role/process; MUPAHKC AI-assisted responsibility/boundary. Absent role, outcome, timeframe and ownership values remain empty.
- The layout/mapping rules are generic: no project title, document name or user-specific phrase is used as a parser condition. A synthetic multi-column regression proves decorative labels are not mapped as Problem.
- Source provenance retains source document ID, page, OCR line, normalized source region and original excerpt. `source_pages` and `source_assets` remain on Portfolio Project data.
- Shared browser acceptance: duplicate import creates zero new entities; confirmation is entity-level; four confirmed Portfolio entities yielded ten provenance-linked Evidence records; refresh restored the same state. Resume acceptance remains 13 entities with unchanged grouping.
- Failure learning: empty PDF text was Extraction and was fixed by local visual OCR; Case page spillover was Entity Grouping and was fixed by explicit CASE continuation; neighbouring-column field pollution was Entity Mapping and was fixed by coordinate-aware mapping. No Review/Persistence/Evidence-Derivation changes were needed.
- Model escalation: not justified. The local capability resolved the demonstrated document-understanding gap without sending personal career material to a provider.

## Before vs After Data Flow

Before:

```text
Resume header discarded
→ each bullet becomes Candidate Evidence
→ sentence-level review
→ fragmented CareerProfile
```

After:

```text
section + header + wrapped bullets
→ one complete Work / Education / Project / Skill entity
→ one entity-level review decision
→ confirmed entity retains chronology and provenance
→ job-relevant statements become derived Evidence
```

## New Domain Model

- `SourceDocument`: immutable source identity, blob, hash and extracted pages.
- `ExtractionRun`: parser/version/input hash/status/warnings/entity count.
- `CareerEntity`: typed Resume object with field-level source anchors and review state.
- `EntityReviewDecision`: approve, edit-and-approve, reject or reopen audit record.
- `CareerProfile`: JSON Resume-compatible projection from confirmed entities.
- `CareerEvidence`: selective derived claim linked to entity, field paths and source anchors.

The first Resume entity set covers Basics, WorkExperience, Education, Resume Project, SkillGroup and Language. Certification/Award/custom sections remain contract-level future types.

## Entity Review UX

- The page begins with counts by Profile, Work, Education, Project, Skill and Language.
- Work cards contain company, role, raw date, location, responsibilities, achievements, unclassified source highlights and explicit skills.
- Deterministic parsing leaves bullets under `unclassified_highlights` rather than guessing responsibility versus achievement.
- Users edit fields inside the entity, then confirm or reject the whole entity.
- Confirmed cards can be reopened. Reopening removes their Evidence from the active derivation until reconfirmed.
- Source locations and excerpts remain unchanged when the entity is edited.

## Career Entity vs Career Evidence

Career Entity preserves the Resume as structured career history. Career Evidence preserves only a job-relevant, supportable claim.

Current direct derivation includes meaningful Work responsibilities/achievements/highlights, Project responsibility/process/output/outcome/highlights, Education statements and self-reported Skill/Language statements. Basics/contact fields and dates by themselves do not become Evidence. Skill-derived Evidence retains a limitation that the skill is self-reported and not demonstrated independently by work evidence.

## Persistence Migration

IndexedDB moved additively from version 2 to 4:

```text
+ extraction_runs
+ career_entities
+ entity_review_decisions
+ correction_memory (v4, browser-local parsing memory)
```

No store is deleted or cleared. Existing `jobs`, `candidates`, `source_documents`, `career_evidence`, `review_decisions` and `career_profiles` remain. Seven v0 Career Evidence records are preserved as legacy records and excluded from the v1 CareerProfile. They are not auto-converted because v0 discarded entity grouping context.

## Real Resume Acceptance

Source:

`/Users/kai/Documents/Codex/AI-Learning-OS/04_career/applications/APP-001_Tencent_AI_Design_Engineer/final/郭开泷_腾讯AI设计工程师_针对性简历.pdf`

Result:

| Entity type | Count |
| --- | ---: |
| Basics | 1 |
| WorkExperience | 3 |
| Education | 2 |
| Project | 3 |
| SkillGroup | 2 |
| Language | 2 |
| Total | 13 |

The three Work entities retain all company, role, date and location fields, with 2/1/1 complete highlights. The Good Art wrapped bullet is one item. The two same-line Education records split correctly. Skills do not enter Work/Education. The three Resume projects retain distinct identities.

Browser golden path verified duplicate import → 0 new entities; edit and confirm one Work entity → 2 derived Evidence; reopen → 0 active derived Evidence for that entity; reconfirm → 2; reload → same 12 pending / 1 confirmed / 2 derived state. Old SourceDocuments and seven v0 Evidence records remain visible after the upgrade.

## Failure Tests

- Missing date stays null and receives `missing_date`/low confidence.
- Ambiguous company/title does not invent a split and receives `ambiguous_company_or_title`/low confidence.
- Partial header-only extraction remains `needs_review` with `no_highlights_detected`.
- Duplicate input has stable IDs and does not create duplicate entities.
- Reopened entities stop contributing active Evidence.
- Empty/no-CASE Portfolio text produces 0 entities and `needs_manual_selection`; image-only PDFs now first receive local visual OCR.
- Existing Phase 3 analysis regression still passes without job/application-state changes.

## Reliability Extension: Local Correction Memory and Re-recognition

- A single intake zone now accepts file selection, drag/drop and clipboard file or plain-text paste.
- `ocr_replacement`, `section_alias` and `classification_correction` are saved only in the user's browser IndexedDB. They are bounded, versioned and sent only with the next local extraction request; the service validates them but does not store them, and neither SQLite nor any provider receives them.
- `Al Product → AI Product` and `PROFESSIONAL EXPERIENCE → WorkExperience` were applied successfully to a pasted Resume acceptance sample and survived refresh. Confirmed entity edits can add the same bounded local memory automatically.
- Source records are now selectable: selecting one synchronizes pending entities, confirmed entities and active Evidence below it. Re-recognition runs the current local parser against the retained source Blob and does not delete the original source or its prior records.
- The real uploaded DOCX was re-recognized and produced 13 pending Resume entities, matching the real PDF grouping. The previous `needs_manual_selection` was a historical extraction result, not a claim that the current DOCX parser cannot extract the file.
- A user type correction also reshapes the editable data safely: changing a Work record to Education maps only semantically equivalent fields (for example company/name → institution, dates/location/highlights) and leaves unsupported Education fields unknown rather than retaining a malformed work shape.

## Files Changed

- `src/career_evidence.py`, `app.py`
- `public/career-evidence-domain.js`, `public/career-evidence.js`, `public/career-evidence.html`, `public/styles.css`
- `data/domain_contracts/career_entity_v1.json`
- `data/domain_contracts/extraction_run_v1.json`
- `data/domain_contracts/portfolio_project_v1.json`
- `data/domain_contracts/local_correction_memory_v1.json`
- `tests/career_entity_regression.py`, `tests/career_evidence_regression.mjs`
- Project status, technical evidence, architecture amendment, README and task file guide.

## Remaining Problems

- PDFKit supplies page and extracted-line provenance, not bounding boxes or true layout geometry; anchors are marked approximate.
- Header rules are deterministic and bounded, not a universal multilingual resume parser.
- DOCX/MD/TXT have inline golden-path coverage but not the same real-user browser acceptance as the PDF.
- Existing v0 fragments remain legacy rather than automatically recoverable entities.
- Confirming a Skill proves only that the Resume states it, not that completed work independently demonstrates it.
- A real success-rate plateau cannot yet be measured from one Resume and one Portfolio. The local correction loop is in place; a reviewed, varied local truth set is required before claiming that deterministic/OCR improvement has stopped.

## Next Step

P4.1 is closed. Do not automatically enter P4.2 or a provider comparison. Any future deepening must begin with a new user-approved milestone and a concrete unresolved product failure.
