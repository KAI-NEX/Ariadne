# Job Radar Documentation Map

## 当前阅读入口

先读 [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)、[AGENTS.md](../AGENTS.md) 和 [PROJECT_STATUS.md](../PROJECT_STATUS.md) 最新条目。架构文件用于追溯稳定约束与设计取舍；带日期的实现状态、阶段计划、模型推荐和一次性授权按当时范围理解。后续修订须有明确决策依据，不能仅凭代码或测试结果覆盖契约。

日常入口还包括 [README.md](../README.md)、[中文 README](../README.zh-CN.md)、[项目经历](../PROJECT_HISTORY.md)、[TECHNICAL_EVIDENCE.md](../TECHNICAL_EVIDENCE.md) 与 [NEXT_PHASE_HANDOFF.md](../NEXT_PHASE_HANDOFF.md)。历史清单提及的根目录 `文件说明.md` 不在当前仓库；本页和 PROJECT_CONTEXT 承担现行导航职责。

## 当前视觉体系

[Ariadne VI 系统](current/ARIADNE_VI_SYSTEM.md) · [可浏览总览](../public/vi-system.html) · [基础定义](../public/vi/manifest.json)。界面、图标、中英文字体、网格与简历对齐、色彩、组件、动效及维护检查从这里开始。

## 2026-08-25 文档清单快照（历史）

下文 `Implementation = NOT STARTED`、唯一 Step 1 等描述是原始时点记录，不代表当前产品状态；原文保留供追溯。

当前最高 authority：`architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。状态为 `PRODUCT ARCHITECTURE V2 = FROZEN / CONFIRMED`、`Architecture Gate = COMPLETE`、`Implementation = NOT STARTED`；唯一 next milestone 是 `STEP 1 — ONE REAL RESUME / CANDIDATE IMPORT + HUMAN CALIBRATION`。旧文档只保留为历史决策或既有实现证据。

日常入口仍在项目根目录：`README.md`、`PROJECT_STATUS.md`、`NEXT_PHASE_HANDOFF.md`、`TECHNICAL_EVIDENCE.md` 与 `文件说明.md`。

## Current

- `current/REPOSITORY_STRUCTURE_AUDIT.md` — root-level responsibility classification, dependency map and post-cleanup tree.

## Architecture

- `architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md` — 当前唯一 V2 产品架构 authority 与 Step 1 scope。
- `architecture/PRODUCT_ARCHITECTURE_V2_GATE.md` — 已被 Final Consolidation 覆盖的历史 Gate；不是 current implementation authority。
- `architecture/DOCUMENT_UNDERSTANDING_FINAL_ARCHITECTURE_REVIEW.md` — 冻结 no-model 架构、独立盲审和 P4.1 mapping closeout。
- `architecture/DOCUMENT_UNDERSTANDING_ARCHITECTURE_BENCHMARK.md` — 架构比较、消融、挑战者测量与最终 winner。
- `architecture/PHASE_4_ARCHITECTURE_REFERENCE_REVIEW.md` — 已确认的 Phase 4 domain/ownership authority。

## History

- `history/P4_1_CAREER_EVIDENCE_CHECKPOINT.md` — P4.1 Entity-first implementation checkpoint。
- `history/PHASE_3_FINAL_SYNTHESIS.md` — Phase 3 historical implementation and learning closeout。

Benchmark artifacts stay under `../document_benchmark/`; see its `README.md` and `CLEANUP_MANIFEST.md`. V2 production implementation、P4.2/full matching 与 ApplicationDossier 均未实现。
