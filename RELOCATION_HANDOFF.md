# Ariadne Relocation Handoff

## 2026-09-08 — Human 正式切换与 Phase B

当前状态：**CUTOVER COMPLETE / PHASE B COMPLETE / ARIADNE ACTIVE**。用户已明确确认 `/Users/kai/Documents/GitKaiNex/Ariadne` 为正式开发目录，并授权按首次迁移快照 §15 清理旧实现。此前 READY FOR CUTOVER / Human confirmation pending 为前序历史状态。

本轮清理已完成：按 74 个显式路径组移除 1,044 files；旧根 124 个原文件保留（123 个逐字节不变，README 仅加归档提示并保留原正文），另新增 RELOCATION_POINTER.md。清理后从新根直接执行 app.py，PID 85159；39 Node + 20 Python = 59/59 regressions、70/70 HTTP（63 静态字节对照）再次通过。255 个现行实现/测试/数据文件及 57 个原始浏览器 Blob 哈希不变，SQLite 完整性正常；main 37 commits/HEAD 不变，暂存区为空。无真实 Provider 请求，本轮未重复浏览器 UI 验收。

删除前核对：旧 1,168 files 无漂移；93 个 data/ 非缓存文件一致；原 Git 历史/对象完整，新仓库 main HEAD 不变，现有未提交内容保留。执行记录和每文件清单见 [Phase B 执行记录](/Users/kai/Documents/Codex/AI-Learning-OS/06_reports/ARIADNE_CUTOVER_PHASE_B_2026-09-08.md)。

旧根保留学习/历史/私有档案，入口见 [归档入口](/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/RELOCATION_POINTER.md)。本次不自动 commit，不修改产品代码，不发送模型请求，不启动 J2。Phase B 后旧根直接运行/回退方式失效，恢复需从新仓库及已保全的最新数据进行。

## 2026-09-08 — 新目录接手续验：READY FOR CUTOVER

本节为当前状态，取代下方首次迁移快照中的 gate #16 BLOCKED / 尚未 READY 结论；首次复制、失败和验证记录保留。**Phase A 技术验收通过，READY FOR CUTOVER；未代替 Human 宣告正式切换，未执行 Phase B。**

- 当前 root：`/Users/kai/Documents/GitKaiNex/Ariadne`；`main @ a2b351246a8f7b3ef8e1561140790f141ea5d29f`，无 remote/upstream、无新 commit、无 staged 修改。接手时的 README 修改、4 项 QA exclusions 和两份 untracked relocation docs 原样保留。
- gate #16 根因确认为 **stale regression assertion**：2026-09-05 hotfix 已让 Candidate Detail 向 `submitCandidateDetailConversation()` 传入当前 `canonicalRevision`，旧 global-convergence assertion 未随之更新；新位置修改前复现相同失败。
- 行为契约依据：`PROJECT_STATUS.md` 的 2026-09-05 hotfix、`TECHNICAL_EVIDENCE.md` 的首个故障边界、`candidateWorkingModelForDetail()` 与现有模型/集成回归。提交必须携带当前确认版本；缺失的 legacy item 以 append-only 方式补齐到同源 Working，保留 pending edits、重复打开幂等，确认数据仍只由 Human Save 更新。删除参数会撤回必要修复。
- 最小修复仅为 `tests/global_interaction_convergence_regression.mjs` 的一条精确断言和解释注释：明确要求传递 `canonicalRevision`。未放宽为任意参数匹配，未删除测试，未修改 app/public/src、Provider、prompts 或数据契约。
- 复验：**39/39 Node + 20/20 Python = 59/59 regression suites PASS**；84/84 JS syntax、50/50 Python compilation、`git diff --check` PASS。包括 Working bootstrap/merge/idempotence、Detail 实际 resolver、Human Save 原子性/冲突、Local/Model 隔离和 fail-closed 回归。stub server、私有 fixture 和可选 Apple Vision smoke 不计入 59 个 regression suites。
- 新位置服务：沿用已核实的 PID **77200**，cwd 和 audit entrypoint 均为新 root / `app.py`；70/70 HTTP checks PASS（63 个静态响应逐字节匹配新文件、6 API 200、1 expected 404）。既有 live audit 未发现旧 Learning OS 实现读取。
- 浏览器：在原 Codex In-app Browser profile 的同一 `http://127.0.0.1:8000` origin 打开本任务 tab，1280×720。运行入口、Workspace、Personal、Job、两个 embedded Detail、Candidate 来源恢复及 Working 页面均正常；36 Candidate / 17 Job cards 与首次验收数量一致。代表性两域 Detail 的 Edit 首字段聚焦、Cancel 内容逐字不变、刷新重开内容逐字不变。13/13 保存 PDF 通过现有 UI 恢复路径（其中执行原有 Blob hash 校验）；一个已有 Candidate Working 重开显示 9 张卡片。console error/warning 均为 0，工作区截图已显示、未写入 repo。
- 本轮没有提交真实 Candidate/Job Model 请求、没有 Human Save、没有新导入；不据此次运行 smoke 新增 Provider 输出质量或完整产品 E2E 通过声明。Local Provider=0 与 Model fail-closed 由本轮自动回归覆盖；本轮未另做 Local UI 切换。
- 完整性：旧目录 inventory 的 **1,168 files，SHA-256 + mode 0 drift**；57/57 原浏览器 Blob hashes 不变；SQLite read-only integrity_check=ok、14 jobs。本轮核验时复制集合的文本差异仅为原 README 和本次测试；随后另更新本 handoff、manifest、PROJECT_STATUS。`.git/index` 因新目录 stat refresh 改变文件哈希，但两边 `git ls-files --stage` 完全一致、staged diff 为空。`git fsck --full` exit 0，仍仅为原有 7 个 dangling blobs。
- 本轮回归、syntax、HTTP 和 integrity 原始记录：`/var/folders/cz/dy9ct7xj30l7y864b9xhtw500000gn/T/ariadne-acceptance-20260908-frknxwb1/`。临时日志与 pyc 均在 repo 外；首次迁移证据仍保留在原 `/tmp/ariadne-relocation-20260908/`。
- 下一步仅为 Human 确认新位置及开发切换。**用户本轮明确禁止自动提交、Phase B 清理及修改旧 Learning OS；本次未进行这些操作。** 下方 §14 第 1 步现已完成，§15 仍只是未来提案，不能自动执行。

## 1. Migration Status

以下 §1–§16 为首次迁移时点快照；当前结论以上方接手续验为准。

- Phase：**A — COPY / VERIFY / HANDOFF 已执行；验收 BLOCKED，尚未 READY FOR CUTOVER**。
- 日期：2026-09-08，Asia/Shanghai。
- 原仓库：`/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar`。
- 新仓库：`/Users/kai/Documents/GitKaiNex/Ariadne`，仍是候选位置；未宣告 active，未执行 Phase B。
- 分支 / HEAD：`main` / `a2b351246a8f7b3ef8e1561140790f141ea5d29f`，两边一致。
- Remote / upstream：源仓库均未配置；新仓库保持未配置，未创建远端。
- Source Git status：无 staged / tracked 修改；仅 `?? docs/current/qa/ariadne-candidate-conversation-waiting.png`。
- Destination Git status：`M README.md`；4 张既有 tracked QA 截图为 unstaged `D`；本文件与 `RELOCATION_MANIFEST.md` 为 `??`。无 staged 修改、无新增 commit。
- 阻塞：20 个 Phase A 条件中的 **#16 automated regressions pass 未满足**。39 个 Node suites 中 38 通过、1 个在源/新位置同样失败；20 个 Python suites 全通过。没有修改测试来消除原有失败。
- 授权原文：原任务 `01a06eb5-2f1c-7af2-8de6-b514516b2949` 最新 relocation request 的 0–34 节已完整读取。`read_thread` 最大单项为 20,000 字符且最新 turn 的 items 为空；分页后用同任务 2026-09-08 本地 rollout 中的完整 user message 补足，未采用历史 hotfix 授权。

## 2. Migration Objective

将 Ariadne 的实现、测试与开发入口复制到独立软件仓库，使 Learning AI OS 长期专注学习、能力、职业证据、Navigator 与项目引用。此次只迁移与验证位置；不开发功能、不开始 J2、不修改 Candidate / Job 智能语义。

## 3. Repository Boundary

- Learning OS 根目录是 `/Users/kai/Documents/Codex/AI-Learning-OS`，自身和 `03_projects/` 均不是 Git 仓库。
- Ariadne 的实际 Git 根是上述 `job-radar`，不是整个 Learning OS。仓库为独立 `.git/` 目录，无 alternates、worktree 链接、嵌套仓库或 symlink。
- `mac-setup/vertical-slice/.git`、`workspace-organizer/ai-work-transparency/.git` 是其他仓库；`personal-site/` 是兄弟项目，均未触碰。
- Ariadne：`.git`、`app.py`、`public/`、`src/`、`scripts/`、`tests/`、contracts / schemas、项目技术文档及本地运行数据。
- Learning OS：`00_inbox/`、`01_profile/`、`02_learning/`、`04_career/`、`05_system/`、`06_reports/`、`90_archive/`、Navigator、能力证据、项目索引、主控规范与其他项目。均留在原位置。
- 原仓库根部 status / evidence / handoff / README 与 `docs/` 兼具项目文档和学习证据价值：新仓库保留必需版本，旧版同时保留；不将整个 Learning OS 的证据目录复制进来。

## 4. Source Repository State

`main @ a2b351246a8f7b3ef8e1561140790f141ea5d29f`；全历史共 **37 commits**，唯一 branch ref 为 `refs/heads/main`，remote/upstream 无。staged / unstaged tracked diff 均为空；1 个 untracked QA 图片；另有 ignored 运行数据和私有归档，已逐项分类。

最近 15 个 commits：

```text
a2b351246a8f7b3ef8e1561140790f141ea5d29f fix: restore candidate material model conversation
13ff1fc764b7235ba624a82f3e9a6594d20ba6d3 feat: complete shared candidate and job intelligence foundation
b7cdb7321dff63133eecc302f8321986a21b6b34 feat: establish shared job intelligence foundation
6b554ec0bc91ada5a94f7ee29ce5a0f35bf73aba fix: stabilize candidate model conversation boundary
c3ad4b56eb293981fde63e104b869b3974a410fe feat: connect candidate workspace to real ai conversation
10aaba97982507fee5f05591de973f78ecbea757 feat: persist candidate ai conversations
4a7bfbd5bb2a9bc57275fb49301d40765f9c17c6 feat: add candidate ai conversation runtime
9dcca11b23f53f40f3b8dad5f62c84cfde56bd68 feat: add candidate ai workspace
2d35d899715cf497b0bdaea365fb6f417c429233 feat: add real candidate model runtime
c96c105d918f8b7d378e78768a3ea25486f0ae23 feat: add durable raw source persistence
92c9f3a72b2a54415004a586f6e719296b57e68d docs: add local lifecycle handover
7be2ae7038579831841fec949123308904bff4d0 fix: stabilize local candidate and job lifecycle
a7dd0aedba17ab7f9331fb7ef3552a3f668debb1 feat: add local candidate proposals
f02c379457d847dfa04305a825260b8889b206b3 fix: persist candidate material subtype
0b633231d4689c1ff239bce5a31f60a3b88383dd feat: add real local candidate extraction
```

源与目标的 refs、全部可达 commit IDs、Git config、staged diff 和 `git fsck --full` 输出一致。fsck 两边 exit 0；相同的 7 个 dangling blobs 已存在，非迁移产生的丢失对象，未做 prune 或历史清理。

## 5. Migrated Content

- 复制 **1,035 files**：751 个 Git metadata files；214 个保留的 tracked project files；70 个 ignored 本地数据文件。
- 218 个 tracked files 中，4 个 QA 图片按隐私分类排除，其余保留。
- source、frontend / CSS / assets、Python backend、Swift 本地抽取适配器、测试和 fixtures、schemas / contracts、scripts、项目文档均保持目录结构。
- `data/job_radar.db`、JD JSON、原始 OCR 图像、raw captures、已规范化数据、reconciliation plans 和历史导入报告保留。
- 复制后逐文件 SHA-256 与 mode 核对 **0 mismatch**；不是 `mv`，没有重建 Git 或丢弃源状态。
- 唯一 tracked 文本修改：`README.md` 当前运行命令中的 `cd` 改为新路径。未改动运行实现、测试、prompts 或数据正文。

## 6. Excluded/Recreatable Content

- **43 files**：`.DS_Store`、`__pycache__`、`*.pyc`。只从新副本排除，旧文件原样保留。
- 未发现 `node_modules`、venv、build output、嵌套源码副本、编辑器配置或项目环境/lockfile；未假定某个无清单依赖目录可以重建并删除它。
- 另有 90 个私有 QA / benchmark / fixture 文件按第 7 节处理，**不称为可随意再生的垃圾**。
- 测试编译输出写入 `/tmp/ariadne-relocation-20260908/pyc/`，运行服务禁写 Python bytecode，新 repo 未混入测试日志/截图/临时脚本。

## 7. Private Content Handling

- 5 张 `docs/current/qa/` 图片全部排除：4 张已在历史 Git 跟踪、1 张 untracked Candidate 截图。原始图片保留在旧仓库，标记 `PRIVATE_ARCHIVE_CANDIDATE`。
- `document_benchmark/benchmark_sources.json`、`truth_set_v1.json`、`gpt_audit/`（16 files）、`outputs/`（66 files）及 `tests/private_fixtures/career_entity_private_regression.py` 留在旧位置，不进入新工作树。它们是私有/学习归档，而非当前必要运行依赖。
- 本地 `data/` 仍由原 `.gitignore` 保护；没有把 ignored 数据加入 Git。没有复制 Keychain 内容、Cookie 或 credentials 到项目文件。
- 为保持历史，`.git` 原样复制；**历史对象中既有 QA 图片仍然存在**。本任务没有清洗历史，也不声称该副本已满足公开发布的隐私审查。
- 新建说明不含 Candidate 正文、Resume 内容、API Key 或 Provider 原始内容。浏览器截图只用于当次检查，不写入项目文档或测试。

## 8. Path Dependency Audit

| 分类 | 证据与处理 |
|---|---|
| RUNTIME_HARD_DEPENDENCY | 现行 app / imports / assets / contracts 未发现指向 Learning OS 的必需路径；实际进程 open audit 中 Learning OS 实现读取为 0。 |
| DOC_CURRENT | `README.md` 原启动 `cd` 指向旧 repo，已改为新 repo；新绝对路径仅用于人类启动说明。 |
| DOC_HISTORICAL | `TECHNICAL_EVIDENCE.md:142,263` 的旧参考视频/外部样本；`docs/history/P4_1_CAREER_EVIDENCE_CHECKPOINT.md:110` 的历史简历来源；`document_benchmark/CLEANUP_MANIFEST.md` 中旧缓存路径均保留。 |
| SAFE_REFERENCE | 10 处 `AI-Learning-OS.JobRadar.*` 字符串为 macOS Keychain service / credential_ref 标识，不是文件路径，必须保持以复用既有 credential。 |
| DATA_PATH | `scripts/import_batch06_evidence.py:28–29` 的 `PROJECT_ROOT.parent.parent / 00_inbox/...` 是历史 Batch 06 专用离线导入器；新路径下默认输入位置不成立。现行运行/必要回归不调用该脚本，既有 14 条 SQLite JD 已复制。未来如需重跑，应单独为显式外部 evidence root 设计入口；本任务未运行或改写此历史导入器。 |
| DATA_PATH / SAFE_REFERENCE | SQLite / JD JSON 中 `00_inbox/...` 和项目相对 raw-capture paths 是 provenance。app 不把 `source_path` 当作源代码/运行数据读取入口；Learning OS 原始资料永久保留。 |
| TEST_ONLY | 必要测试由 `__file__` 求 repo root；没有旧 repo 绝对依赖。私有回归仅在显式设置 `ARIADNE_PRIVATE_CAREER_REGRESSION_PATH` 时执行，此次未设置。benchmark 私有输入未迁移，历史 benchmark 不是默认验证任务。 |

运行文件里的 `__file__` / `parents[1]`、`scripts/_runtime.py` sys.path 都指向新项目自身。没有 symlink 借用旧实现。未发现 `.vscode`、`.idea` 或带旧 cwd 的启动配置。新增迁移说明之前的扫描有 22 个相关文本位置；逐项位置记录在临时 `path-audit.json`。保留历史引用及合法共享工具路径，不作全局替换。

依赖：当前 backend 使用 Python 标准库；本机验证使用 **Python 3.12.14、Node 24.19.0、Apple Swift 6.3.3 / macOS PDFKit / Vision**。repo 无 package/requirements/lock manifest；Node suites 直接执行，不需要 npm install。Codex 共享 Python/Node runtime 在用户 home 下，非 Learning OS 实现依赖；benchmark 中的可选第三方研究依赖未重装。环境 credential 与既有 Keychain item 原地使用，仅报告是否可用。

## 9. Persistence/Data

| 数据 | 存储分类与确切位置 / 合同 |
|---|---|
| SQLite legacy JD / analyses | REPO_RELATIVE：`data/job_radar.db`。源与新副本 SHA-256 `a37da5f3b89bc5c712c60cf37182a7bfd4a854af2cbb76121bd64d6f94db2eaa`，45,056 bytes；14 jobs、1 job_analysis；`PRAGMA integrity_check=ok`。 |
| 原始 OCR / JD / captures | REPO_RELATIVE：`data/local_ocr_uploads/`、`data/raw/`、`data/jd-001.json`、`data/batch06_candidates/`、`data/normalized_candidates/`、`data/reconciliation_plans/`、`data/batch06_import_report.json`；70 个 ignored data files 全部复制且哈希一致。 |
| 当前 Candidate 与 revisions | BROWSER_STORAGE：`job-radar-local-first-v1`，IndexedDB v15；`candidate_context_revisions`、`candidate_context_lifecycle`，以及 legacy `candidate_contexts` / `career_entities` / `demo_candidate_items`。 |
| Candidate Working / acceptance | 同一 DB：`candidate_working_models`、`candidate_workspace_acceptances`；proposals / review decisions 分别在 `context_proposals` / `context_review_decisions`。 |
| Candidate conversations | `conversation_sessions`、`conversation_messages`、`conversation_turn_executions`、`candidate_actions`；legacy demo conversation store 保留。 |
| 当前 Job / revisions / Working | `job_context_revisions`；未确认 Working Job 在 `context_proposals` 的 JOB_CONTEXT payload；legacy `jobs` / `demo_job_contexts` 原样保留。 |
| Job conversations / decisions | `job_conversation_sessions`、`job_conversation_messages`、`job_turn_executions`、`job_analyses`、`job_change_proposals`、`job_change_decisions`。 |
| SourceDocuments / original bytes | `source_documents` 同时保留 metadata 与 `raw-source-payload-v1::` Blob envelope；`indexeddb://...` 引用，与代码目录无关。 |
| Source Bundles | 来源按序分别保存为 durable SourceDocument；bundle 的有序 `source_document_ids` 保存在 proposal payload / provenance / confirmed revision。没有独立 filesystem bundle database；请求的 bundle object 不等于另一个持久 store。 |
| 执行与 UI / runtime | `runtime_snapshots`、`processing_runs`、`processing_batches` 等 IndexedDB stores；LocalStorage `job-radar-selected-runtime`、`job-radar-added-runtime-models`、`ariadne-operation-runtimes-v1`；临时诊断可在 SessionStorage。 |
| Provider credential | USER_HOME / OTHER：原 macOS Keychain `AI-Learning-OS.JobRadar.DeepSeek` 等；允许的 env vars 在运行环境中，不存 repo。Provider 是 EXTERNAL 服务，未把远端数据当成本地存储。 |

**浏览器 origin / profile 是本次关键边界。** 主验收使用 Codex In-app Browser 原有 profile，origin 始终为 `http://127.0.0.1:8000`；只停止本任务启动的源服务，再把新服务绑定到同一地址，没有清空或导入 browser storage。

实际物理位置：

```text
/Users/kai/Library/Application Support/Codex/Default/Partitions/codex-browser-app/IndexedDB/http_127.0.0.1_8000.indexeddb.leveldb/
/Users/kai/Library/Application Support/Codex/Default/Partitions/codex-browser-app/IndexedDB/http_127.0.0.1_8000.indexeddb.blob/
```

在该位置共记录 65 files / 21,112,811 bytes 的读取基线，并在 `/tmp/ariadne-relocation-20260908/browser-origin-backup/` 留下私有附加副本。这是 live read-only 文件复制，不冒充一致性/原子数据库导出，不含 Cookie/Keychain。迁移前后 **57 个 Blob files 全部同哈希**；62/65 files 同哈希，3 个 LevelDB log files 随浏览器使用变化，未丢文件。原浏览器存储始终原地保留。

主会话对照：36 张 Candidate 卡片与 17 张 Job 卡片的 href/完整文本逐项相同；代表性 Candidate 详情（含既有对话）5,043 字符逐字相同、Job 详情 842 字符相同；13 份已保存 Candidate PDF 清单逐项相同，13/13 从 UI 成功恢复，恢复路径会执行原有 Blob SHA-256 校验。未把新会话的空数据当作迁移丢失。

ego-browser 另有旧演示 profile：3 demo Candidate、0 Job；其 42 stores 的 count/hash 仅是补充证据，不代表用户主会话。所有 gate 结论以 Codex 主会话对照为准。未对主 profile 做完整逻辑 store export；不声称已核对每个 store 的每条记录。一次授权 Job smoke 增加了正常对话历史；无 Candidate / Job truth 保存。

## 10. Runtime Verification

- 实际 entrypoint：`/Users/kai/Documents/GitKaiNex/Ariadne/app.py`；PID **77200**，cwd 经 `lsof -a -p 77200 -d cwd` 证实为新 root。
- 本次用同一 `app.py` 的 `runpy.run_path(..., run_name="__main__")` 加只读 Python audit hook，记录打开的文件路径；不替换应用处理逻辑、不修改源码。audit 中读取新 `src/`、schemas、database、`public/`，旧 Learning OS 实现读取 **0**。
- HTTP：63 个静态 routes（含 `/`）全部 200 且响应内容与新目录文件逐字节一致；6 个 API routes 200；`/api/jobs/JD-999` 正确 404。合计 70 checks。
- Landing / workspace / Personal Information / Candidate 卡片与详情 / Job workspace 与详情均真实浏览器可用，没有空白页或错误 overlay。
- Candidate：卡片内容一致，详情/历史对话一致，Model composer 可见；直接 Edit 打开，Cancel 不保存，刷新重开内容一致。**未发送 Candidate Model 对话，也未修复疑似产品问题**。
- Job：17 张现有卡片与源一致；代表性详情一致。单次正常讨论 POST `/api/job-conversation-turn` 为 200，调用 DeepSeek `deepseek-v4-pro` **1 次**；页面显示一段概括回答，重开仍存在。服务 result enum 为 `ASK_CLARIFICATION`，不将枚举等同于内容质量通过；未重试或调 prompt。
- Job smoke：`working_proposal_created=no`、`confirmed_mutation_before_save=no`，Provider reply 正常显示，无静默 Local fallback。
- Local：真实 UI 选择 Local，Candidate 和 Job 的 runtime label 均为“本地运行”；此模式下浏览器 Provider calls **Candidate=0 / Job=0**。自动 suites 另外验证 Local/Model 边界及 Model error fail closed；未通过在用户资料上强制制造付费失败来验证。
- 验证后恢复原 `DeepSeek · deepseek-v4-flash-vision-exp` 选择；operation-specific conversation 使用既有 `deepseek-v4-pro`。
- Codex Browser console：**0 error / 0 warning**；提供了源 Edit 与新 workspace 的真实 screenshot 观察，未保存私人截图进 repo。主要 viewport 随 app 面板约 1280×720 / 811×869；没有开展独立移动端设计审查。
- ego-browser screenshot 的 `Page.captureScreenshot` 超时，随后任务空间不可用，最终 spaces=[]；主验收通过可用的 CUA In-app Browser 完成，不把 ego 工具限制归为产品缺陷。

## 11. Automated Verification

全部下列项目从新 root 执行；失败 suite 另在源 root 独立复现。

| 检查 | 结果 |
|---|---|
| `node tests/*regression.mjs`，逐文件 | **38/39 PASS；1 FAIL（源同样 FAIL）** |
| `PYTHONPATH=. python tests/*regression.py`，逐文件 | **20/20 PASS** |
| 合计 regression files | **58/59 PASS**，不能写成全绿 |
| Node `--check`：public JS + tests MJS | **84/84 PASS** |
| Python `py_compile`：全部保留的项目 Python 文件 | **50/50 PASS**，产物在 repo 外 |
| optional Apple Vision synthetic smoke | **1 PASS**，1 line detected，Provider call false |
| HTTP 静态 / API / expected failure | **70/70**；69×200 + 1 expected 404 |
| `git diff --check` | PASS |
| Git refs / complete commit list / config / fsck / staged diff comparison | 全部一致 |
| 复制 SHA-256 + mode | 1,035 files，0 mismatch |
| 验证后保留 source/data hash | 除有意 README path fix 外，0 drift；源 files 0 drift |

执行环境：

```bash
cd /Users/kai/Documents/GitKaiNex/Ariadne
# Node：/Users/kai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
# Python：/Users/kai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3
# 回归逐文件使用 PYTHONPATH=.、PYTHONDONTWRITEBYTECODE=1
# route-contract suite 使用 ARIADNE_NODE_BINARY 指向上述已有 Node
# Apple Vision：ARIADNE_RUN_APPLE_VISION_SMOKE=1 .../python3 tests/local_candidate_apple_vision_smoke.py
```

精确 suite 列表、exit code 与输出留在 `/tmp/ariadne-relocation-20260908/regressions.json`；syntax、HTTP、Git、copy、path audit 和非正文证据在同目录。这些是临时辅助材料，不是新的产品依赖。

Phase A 20 条 gate：

| # | 条件 | 状态 |
|---|---|---|
| 1 | 指定新位置存在 | PASS |
| 2 | Git history intact | PASS |
| 3 | branch / HEAD intact | PASS |
| 4 | remote intact（源无配置） | PASS |
| 5 | required source present | PASS |
| 6 | required tests present | PASS |
| 7 | required runtime/project data preserved | PASS（上述 filesystem + 同 profile 对照证据范围） |
| 8 | disposable content safely excluded | PASS |
| 9 | private QA not accidentally committed | PASS（没有新增提交；既有历史仍含 tracked QA） |
| 10 | app starts FROM new path | PASS |
| 11 | no required Learning OS implementation dependency | PASS（历史 Batch 06 importer 的外部 evidence 边界另列） |
| 12 | Candidate Material same functional level | PASS（加载、现有内容、composer、Edit、重开） |
| 13 | Job same functional level | PASS（现有内容对照 + 一次 discussion） |
| 14 | Local Provider isolation | PASS |
| 15 | persistence path usable | PASS |
| 16 | automated regressions pass | **BLOCKED — 58/59；源既有失败** |
| 17 | no relocation-induced console errors | PASS |
| 18 | path audit complete | PASS |
| 19 | RELOCATION_HANDOFF.md | PASS |
| 20 | RELOCATION_MANIFEST.md | PASS |

## 12. Known Product Defects

**PRE_EXISTING_PRODUCT_DEFECT — regression contract drift**：`tests/global_interaction_convergence_regression.mjs:91` 仍要求 `submitCandidateDetailConversation` 不带 `canonicalRevision`；当前 `public/v1-pages.js:2476` 在上一 hotfix 后已带该参数。源与新 repo 同一 Node/同一 HEAD、同一 assertion、同样 exit 1。未改测试或实现；此项阻塞严格的 gate #16，应由独立 hotfix / 明确验收决定处理。

**Candidate Material Detail Model conversation**：用户指出可能存在的历史问题保留为待产品验证；本次没有发送 Candidate Model 请求，因此不宣称它已修好，也不据历史怀疑断言当前必然故障。加载、composer、Edit、已存对话/内容、重开已做源/新对照。

**RELOCATION_DEFECT**：未观察到现行运行或数据的迁移缺陷。历史 Batch 06 importer 的默认上级证据路径在新 repo 下不成立，这是已知的非当前运行工具限制，不能照旧直接重跑；见第 8 节。README 当前启动路径已修正。

源 `favicon.ico` 返回 404 是既有未提供 favicon；63 个静态响应无丢失。没有补做 favicon 或 UI 产品修复。

## 13. New Working Directory

候选工作目录：

```text
/Users/kai/Documents/GitKaiNex/Ariadne
```

未来 Ariadne task 应从该 repository root 启动，并读取本 handoff、manifest 与项目现有状态文档；不要把 Learning OS 当成 runtime cwd。当前 gate 未全过，尚未宣告正式开发位置切换。

## 14. Human Cutover Procedure

1. 先处理/明确裁决第 12 节的既有 regression mismatch；本任务无权为全绿而修改测试。重新验证 gate #16 后，才能使用 READY FOR CUTOVER 声明。
2. 在 Codex 中将新目录作为独立 project 打开；先核对 `git rev-parse --show-toplevel`、`git rev-parse HEAD`、`git status --short`，审查 README、两份 relocation docs 和 4 项 QA exclusion。不要自动 commit。
3. 用现有 Python 环境从新目录执行 `app.py`。本次验证服务若仍占用 `:8000`，先核对 PID/cwd，再停止它；不要停止其他来源不明进程。
4. 在**原 Codex 浏览器 profile**打开 `http://127.0.0.1:8000/`，检查自己的 Candidate、Job、来源、Working 和对话；`localhost`、其他端口或新的浏览器 profile 会是不同 storage origin/context。
5. Human 明确确认“新位置正常、已切换开发位置、允许 Phase B 清理”三点后，后续独立执行 Phase B。此次停止于交接，没有默认为批准。

正常启动示例（本机已验证的现有环境）：

```bash
cd /Users/kai/Documents/GitKaiNex/Ariadne
PYTHONDONTWRITEBYTECODE=1 /Users/kai/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 app.py
```

## 15. Phase B Cleanup Plan

**仅为未来提案；未删除任何旧文件。** 执行前重新审计源/目标新增改动、Git state、全部数据与新服务；若 old copy 有新改动必须先保全/合并，不能依据本快照直接删除。

审计后的 old implementation removal path groups：

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

`data/` 只有在新副本数据再次逐文件/SQLite 核验、Human cutover 明确批准后才可处理。`tests/*.py` / `*.mjs` 只指顶层，**不得扩成整个 `tests/` 删除**；`tests/private_fixtures/` 仍留档。

必须保留：原 root `README.md`、`PROJECT_STATUS.md`、`TECHNICAL_EVIDENCE.md`、`NEXT_PHASE_HANDOFF.md`、`GIT_BASELINE_BLOCKED_HANDOFF.md`，整个旧 `docs/`、`document_benchmark/` 与 `tests/private_fixtures/` 作为学习/历史/私有档案；先由未来任务更新项目引用并明确 archive 状态。共享 home caches、Browser storage、Keychain、所有其他 Learning OS/项目目录及 UNKNOWN 均不在 removal list。

不允许直接删除 `/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/` 根目录。Phase B 也不得重新解释本列表为递归全清理。

## 16. Rollback

旧 repo 与原数据完整保留；所有源文件哈希与迁移前一致，HEAD/status 未改变。若新位置有问题，停止经过 PID/cwd 核实的新服务，再从旧 root 用相同 Python 启动 `app.py`，仍使用原 browser profile 与 `http://127.0.0.1:8000`。

浏览器存储本来就在 repo 外，两边同 origin 会看到同一份状态；此次单次 Job discussion 正常保存在其中。不要为回退清空 IndexedDB，也不要用 live 文件备份覆盖正在运行的 profile。若以后在新位置产生新 SQLite/文件数据，回退前先保全差异；不能假设旧文件自动同步。复制不需要 Git reset、stash、amend、rebase 或 commit。
