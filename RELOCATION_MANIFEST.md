# Ariadne Relocation Manifest

## 2026-09-08 — Human 正式切换与 Phase B

当前状态：**CUTOVER COMPLETE / PHASE B COMPLETE / ARIADNE ACTIVE**。用户已明确确认 `/Users/kai/Documents/GitKaiNex/Ariadne` 为正式开发目录，并授权按首次迁移快照 §15 清理旧实现。此前 READY FOR CUTOVER / Human confirmation pending 为前序历史状态。

本轮清理已完成：按 74 个显式路径组移除 1,044 files；旧根 124 个原文件保留（123 个逐字节不变，README 仅加归档提示并保留原正文），另新增 RELOCATION_POINTER.md。清理后从新根直接执行 app.py，PID 85159；39 Node + 20 Python = 59/59 regressions、70/70 HTTP（63 静态字节对照）再次通过。255 个现行实现/测试/数据文件及 57 个原始浏览器 Blob 哈希不变，SQLite 完整性正常；main 37 commits/HEAD 不变，暂存区为空。无真实 Provider 请求，本轮未重复浏览器 UI 验收。

删除前核对：旧 1,168 files 无漂移；93 个 data/ 非缓存文件一致；原 Git 历史/对象完整，新仓库 main HEAD 不变，现有未提交内容保留。执行记录和每文件清单见 [Phase B 执行记录](/Users/kai/Documents/Codex/AI-Learning-OS/06_reports/ARIADNE_CUTOVER_PHASE_B_2026-09-08.md)。

旧根保留学习/历史/私有档案，入口见 [归档入口](/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/RELOCATION_POINTER.md)。本次不自动 commit，不修改产品代码，不发送模型请求，不启动 J2。Phase B 后旧根直接运行/回退方式失效，恢复需从新仓库及已保全的最新数据进行。

## 2026-09-08 接手续验更新

当前 **gate #16 PASS，Phase A READY FOR CUTOVER**；正式 Human cutover 未代决，Phase B 未执行。首次清单正文继续保留为复制时点记录，以下 BLOCKED / 未修改测试描述由本更新取代。

- 按已确认的当前版本/Working 同步契约，仅修正 `tests/global_interaction_convergence_regression.mjs` 的过时参数断言；运行实现不变。39 Node + 20 Python regressions 全部通过，84 JS syntax、50 Python compilation、70 HTTP checks 通过。
- 接手续验还更新本文件、RELOCATION_HANDOFF.md 和 PROJECT_STATUS.md；原 README 路径修改与 4 项 QA exclusions 保留。无 staged 内容、无 commit；旧目录 1,168 个基线文件无 hash/mode 变化，57 原始浏览器 Blob 同哈希，13 保存 PDF 均由 UI 恢复。
- 复制集合中 `.git/index` 的字节差异仅对应新目录 stat refresh；两边索引 entries 完全一致，未改变 staged 内容。当前浏览器仍为原 Codex profile + `127.0.0.1:8000`；36 Candidate / 17 Job，代表性 Detail 和 Working 恢复通过。完整证据与验收边界见 Handoff 顶部接手续验节。
- 本次没有移动、重命名、删除原始文件，没有修改旧 Learning OS，也未执行下方任何 Phase B 提案。

## 首次迁移清单快照

日期：2026-09-08。Phase A candidate，**gate #16 BLOCKED**；未正式 cutover，Phase B 禁止自动执行。

Source：`/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar`

Destination：`/Users/kai/Documents/GitKaiNex/Ariadne`

Git：`main @ a2b351246a8f7b3ef8e1561140790f141ea5d29f`；37 commits；remote/upstream 均无。

## Ariadne Required

- `.git/`（751 files）、`.gitignore`、`app.py`。
- `public/`、`src/`（含 Swift extraction adapters）、`scripts/`。
- `tests/` 的 tracked scripts、`tests/fixtures/` synthetic JSON、`tests/web_provider/`。
- `data/schema.sql`、`data/*contract*.json`、`data/*schema.json`、`data/model_contracts/`、`data/domain_contracts/`、`data/evaluation/`。
- `README.md`、`PROJECT_STATUS.md`、`TECHNICAL_EVIDENCE.md`、`NEXT_PHASE_HANDOFF.md`、`GIT_BASELINE_BLOCKED_HANDOFF.md`；`docs/` 中项目文本；`document_benchmark/` 的 4 个 tracked 说明/审计/harness 文件。
- 218 tracked files 中保留 214；4 QA 图片 excluded。唯一 tracked 文本修订为 README 当前 `cd` 路径，运行代码/测试未修改。
- 必需 source/tests、Git metadata 和 ignored local data 合计复制 1,035 files；SHA-256 + mode 校验 0 mismatch。

## Ariadne Local Data

- 70 个 ignored files 原样复制：`data/job_radar.db`、`data/jd-001.json`、`data/batch06_candidates/`、`data/batch06_import_report.json`、`data/local_ocr_uploads/`、`data/raw/`、`data/normalized_candidates/`、`data/reconciliation_plans/`。
- SQLite：14 jobs / 1 analysis；45,056 bytes；完整性 ok，源/目标同哈希；仍 ignored，未 staged。
- Browser data **原地保留**，不是移进 Git：Codex 原 profile + `http://127.0.0.1:8000` 下的 IndexedDB `job-radar-local-first-v1` v15 与 Local/SessionStorage。
- Candidate revisions / Working / conversations、Job revisions / conversations、SourceDocuments 与 source bundles 的确切 stores 见 Handoff §9。57 原始 Blob files 同哈希；36 Candidate / 17 Job cards 与源逐项一致；13/13 保存 PDF 成功恢复。
- 原 Keychain 标识保留。没有复制 Cookie、密钥或 Provider raw dumps。一次授权 Job discussion 增加对话历史，没有 truth mutation。

## Excluded Reproducible Content

43 files：`.DS_Store`、`__pycache__/`、`*.pyc`。源文件仍在原位置。

没有 node_modules、venv 或 build output 可供排除。新测试日志/编译输出与 audit metadata 位于 `/tmp/ariadne-relocation-20260908/`，不在 repo。

## Private QA Excluded

90 files 留在旧位置，标记 **PRIVATE_ARCHIVE_CANDIDATE**：

- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/docs/current/qa/`：5 张图片；其中 4 tracked，新的工作树显示 unstaged deletion，另 1 张原本 untracked。
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/document_benchmark/benchmark_sources.json`。
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/document_benchmark/truth_set_v1.json`。
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/document_benchmark/gpt_audit/`：16 files，不含另计缓存。
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/document_benchmark/outputs/`：66 files。
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/tests/private_fixtures/career_entity_private_regression.py`。

四张 tracked exclusions：`ariadne-job-conversation-waiting.png`、`ariadne-job-three-source-bundle.png`、`ariadne-model-import-processing.png`、`ariadne-working-job-grounded.png`。源 untracked：`ariadne-candidate-conversation-waiting.png`。

这些并非全都可再生。原始学习/private evidence 未删除；`.git` 历史仍含原先已跟踪的 QA 图像，未做历史改写。没有新 commit，也没有声称历史已脱敏。

## Learning AI OS — Retained There

- 根主控规范 / AGENTS / 文件索引；`00_inbox` 原始资料、`01_profile`、`02_learning`、`04_career`、`05_system`、`06_reports`、`90_archive`。
- Navigator、Master Synthesis、career / JD / capability / learning records、项目索引与学习 roadmap。
- 其他项目：`03_projects/mac-setup`、`workspace-organizer`、`personal-site`。
- 旧 Ariadne 根 README / status / technical evidence / handoff、`docs/` 和 benchmark/私有夹具保留历史副本。没有执行引用改写或 Phase B 清理。

## Unknown / Human Review

- 本次 source inventory 无未归属的 loose file；untracked QA 与 ignored data 均已明确分类，不使用“untracked=垃圾”。
- 共享 `/Users/kai/.cache/huggingface/hub` 等缓存归属仍 UNKNOWN / shared，不删除、不迁移、不纳入未来 removal list。
- 私有 QA / benchmark 的长期保留位置需 Human 决定；当前原地留档，不能自动升级为可删除项。
- 原有 regression mismatch 阻塞全绿：`tests/global_interaction_convergence_regression.mjs:91` 与 `public/v1-pages.js:2476` 的 `canonicalRevision` 参数不一致，两边复现，未改测试。
- 私有 benchmark 和可选 real-career fixture 没有在新 repo 重跑；当前 public/synthetic regression 覆盖已执行。主 browser 未做完整逻辑 store export；持久化证据范围见 Handoff §9。

## Remaining Old-Path References

- `AI-Learning-OS.JobRadar.*`：Keychain service / credential_ref 标识，SAFE_REFERENCE，刻意保留。
- `TECHNICAL_EVIDENCE.md` / `docs/history/...` 中旧视频、样本、简历 provenance：DOC_HISTORICAL，刻意保留。
- `document_benchmark/CLEANUP_MANIFEST.md` 的共享缓存历史路径：DOC_HISTORICAL / shared UNKNOWN，刻意保留。
- `document_benchmark/README.md` 的 Node home runtime 路径：共享工具位置，非 Learning OS 实现依赖。
- `scripts/import_batch06_evidence.py:28–29` 仍是历史批次对外部 Learning OS evidence root 的结构假定；新位置不能直接重跑默认 importer。现行 app/必要测试不依赖它，既有数据已迁移。
- JD records 的 `00_inbox/...` 是资料出处，不是 runtime source imports；原资料仍在 Learning OS。
- README 当前启动路径已修正。迁移 docs 为说明 rollback / future removal 而出现旧路径，均属有意引用。

## Proposed Phase B Removal List

**仅在 Human 明确确认新位置正常、开发已切换且允许 Phase B 后，重新审计再执行。没有任何本节删除已发生。**

- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/.git/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/.gitignore`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/app.py`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/public/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/src/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/scripts/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/data/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/tests/*.py`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/tests/*.mjs`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/tests/fixtures/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/tests/web_provider/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/tests/__pycache__/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/__pycache__/`
- `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/.DS_Store`

`tests/*.py` / `*.mjs` 是顶层文件组，不包含 `tests/private_fixtures/`。`data/` 必须重新核验新副本，保全任何后续改动后才可处理。移除 `.git/` 前重新验证全部历史/HEAD，保留新/旧未提交状态。

**禁止整根删除 `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/`。** 留下 root 文档、`docs/`、`document_benchmark/`、`tests/private_fixtures/` 的学习/历史/私有记录；未来 Phase B 单独更新引用。其他 Learning OS 目录、其他仓库、Browser storage、Keychain、共享工具和 UNKNOWN 全部排除在 removal list 外。
