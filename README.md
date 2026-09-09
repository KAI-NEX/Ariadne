# Ariadne · 衡

**v0.1.0 · MIT 开源预览版**

先理解你的个人资料，再理解目标职位。Ariadne 保留原始来源，帮助解释经历与岗位的关系；模型结果先形成可审阅内容，由你决定是否保存。

- **个人资料与职位**：图片/PDF/文本导入、来源恢复、Working 审阅、确认版本及范围明确的对话。
- **两个运行模式**：Local 使用确定性本地处理；Model 使用通过图片和视觉 PDF 验证的模型。失败不会静默切换。
- **本机 Codex**：支持本机 Ariadne 直连，以及 Web 网页通过配对连接器使用本机 Codex。模型推理仍在 OpenAI，使用你自己的账号额度。
- **数据与凭据**：每位用户自行配置。仓库不包含维护者的 API Key、Codex 登录、简历、数据库或浏览器工作区。

## 本机启动

需要 Python 3.11+；运行回归还需 Node.js 20+。目前完整文件处理在 macOS 验证，部分本地 PDF/OCR 路径依赖 Swift、PDFKit 和 Vision；PDF 逐页转图需 Poppler 的 `pdftoppm`。其他平台尚未完成完整材料路径验收。

```sh
git clone https://github.com/KAI-NEX/Ariadne.git
cd Ariadne
python3 app.py
```

打开 [本机 Ariadne](http://127.0.0.1:8000/)。干净克隆会初始化空数据库，无需维护者的私有种子文件。在运行方式页选择 Local 或配置自己的合格模型。

使用本机 Codex 前，安装并登录 Codex CLI，确保 `codex login status` 成功，再启动：

```sh
ARIADNE_CODEX_ENABLED=1 python3 app.py
```

当前验证的 Codex 组合为 `codex-cli 0.153.4` / `gpt-5.6-sol`。详细设置、Web 配对和断开方式见 [Codex 运行指南](docs/current/CODEX_RUNTIME_CONNECTOR.md)。本机服务只监听 loopback；不要通过隧道或反向代理把自己的凭据服务公开。

## 开发与检查

```sh
python3 scripts/run_regressions.py
python3 scripts/check_vi.py
python3 scripts/check_public_release.py
```

| 目录 | 内容 |
| --- | --- |
| `public/` | 原生 HTML/CSS/JavaScript UI 与视觉资源 |
| `src/` | 领域契约、资料处理及 Provider adapters |
| `data/` | 公开 schema/契约和合成范例；运行数据库与原件被忽略 |
| `tests/` | 合成回归；真实私有 fixture 不发布 |
| `scripts/` | 验证、运行和开发工具 |
| `docs/` | 当前规范与保留的设计记录 |

[贡献指南](CONTRIBUTING.md) · [安全边界](SECURITY.md) · [发布记录](CHANGELOG.md) · [MIT License](LICENSE)

这是早期预览版。模型回答需要审阅，测试不保证所有真实材料都能正确理解。公开 GitHub 项目不等于公网 Web 应用已经部署；网站可以直接链接到此仓库，公开 HTTPS 的本机网络授权路径仍需部署后验收。历史开发记录按维护者决定保留，其中旧本机路径是历史定位信息，不是启动依赖或凭据。

<details>
<summary>历史开发说明（原记录保留，当前入口以上文为准）</summary>

# AI Job Radar

## Ariadne 项目入口

Ariadne 先理解用户提供的个人资料，再理解用户选择的职位描述；通过有来源的关联分析、澄清与建议，帮助用户一步步接近自己想要的职位。

开始任务先读 [项目上下文](PROJECT_CONTEXT.md)、[工作规范](AGENTS.md) 和 [当前状态](PROJECT_STATUS.md) 的最新条目。产品方向、已实现能力和历史阶段分别记录；下文旧阶段的 next milestone、模型信息及一次性执行指令不构成当前任务授权。

## 2026-09-08 — 正式开发位置

本仓库 `/Users/kai/Documents/GitKaiNex/Ariadne` 已由用户确认为 Ariadne 的正式开发、测试、运行与 Git 位置。当前切换记录见 [RELOCATION_HANDOFF.md](/Users/kai/Documents/GitKaiNex/Ariadne/RELOCATION_HANDOFF.md)，产品当前状态见 [PROJECT_STATUS.md](/Users/kai/Documents/GitKaiNex/Ariadne/PROJECT_STATUS.md)。旧 Learning OS 目录仅保留学习/历史/私有记录，见 [归档入口](/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/RELOCATION_POINTER.md)。

本次为迁移收口，未开启 J2 或新功能。下方较早日期的功能说明保留为历史实现信息；当前阶段以 PROJECT_STATUS 最新条目为准。

## 2026-08-25 — 架构冻结与实现准备快照（历史）

以下内容保留当时的状态与范围，不能覆盖顶部项目入口或最新 PROJECT_STATUS。

> 2026-08-25：`PRODUCT ARCHITECTURE V2 = FROZEN / CONFIRMED`；`Architecture Gate = COMPLETE`；`Step 1 = IN PROGRESS / Phase A–B contract preparation complete`。当前最高 authority：`docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。

当前唯一 next milestone：`STEP 1 — ONE REAL RESUME / CANDIDATE IMPORT + HUMAN CALIBRATION`。本文件后续 P4.1、Career Intelligence V0、CareerEntity、旧 Provider 与 UI 内容是 existing implementation inventory，不是当前主线或 next action；不要继续 Architecture Research，也不要开始 Portfolio、Job、Match、generation、Capability Card、Career Mentor、旧 CareerEntity migration、OCR benchmark、MCP/RAG/Agent/Skill/CLI。

已完成的安全准备：本地 Git/privacy baseline、DeepSeek account model listing、V2 CandidateContext/Proposal/Patch/ProcessingRun/Consent contracts、IndexedDB v8 additive stores，以及 DeepSeek JSON proposal fail-closed tests。尚未发送真实 Resume、未产生 CandidateContext truth、未开始 Card UI 或 real-user acceptance。下一步是 Figma Candidate Human Calibration Kit，然后由用户选择一份真实 Resume PDF 并在页面中确认具体文件会发给 DeepSeek、用途与可能费用。详情见 `PROJECT_STATUS.md` 与 `TECHNICAL_EVIDENCE.md` §65。

当前产品目标：理解候选人、理解真实职位、用可追溯 Evidence 显示差异，并帮助用户为具体职位更准确地准备投递。既有 V0/P4.1 实现仍作为可复用基础与历史证据保留。

## Two alternative career-material ingestion modes

Normal users choose one mode; Job Radar does not require dual execution or merge the two outputs automatically.

- **Local / No-AI Mode (P4.1A, complete):** original document → local Document Understanding → CareerEntity → Human Review → confirmed-only CareerEvidence.
- **AI-Assisted Mode (P4.1B, in progress):** original document → multimodal AI directly → high-fidelity Canonical Career Context Markdown → local persistence and reuse.
- Running both is an optional evaluation workflow. Source evidence plus user judgment decides disagreements; neither AI nor Local is presumed correct.

## AI-first 职业资料入口

默认在 <http://127.0.0.1:8000/career-evidence.html> 的“添加职业资料”使用完整资料 AI 验证：DeepSeek 将完整 PDF 临时渲染为全部页面图像后发送；Gemini 使用原始 PDF 发送。二者都必须先经过账号模型预检及用户逐次资料传输确认，输出永远是待审核的 Canonical Context，不是 Career Model truth。

本地解析仍在“高级选项”中，作为无外部模型的离线 fallback；它没有被删除，也不会自动与 AI 输出融合。

## Historical implementation inventory：Career Intelligence V0

在 <http://127.0.0.1:8000/career-evidence.html> 的 **Career Model Control Center**，用户可主动从浏览器内 confirmed CareerEvidence 与已有 SQLite JD records 生成 CapabilityBoundary、InterestSignal、CareerDirectionHypothesis 和 OpenQuestion。所有项目先为 `needs_review`，可 Confirm / Reject；CapabilityBoundary 还可编辑其语义状态。

- 提案是可复现的规则化归纳：不重跑导入/OCR/AI Mode，不调用模型，也不写 SQLite。
- IndexedDB v6 仅新增 `career_intelligence` store；刷新保留审核结果，不改写原始 Evidence、JD 或 SourceDocument。
- `Interest Signal ≠ Capability Evidence`；`UNVERIFIED ≠ 缺乏能力`；AI-assisted implementation 不会被提升为独立工程能力。
- 此功能尚未经过真实用户审核，因而 Career Intelligence V0 尚不是 usable baseline；不要进入 P4.2。

## Frozen Local Career Document Understanding

```text
Career Document
→ SourceDocument
→ usable native document blocks first
→ selective Apple Vision fallback for unusable PDF pages
→ conditional GapTree for OCR multi-column Resume pages
→ DocumentBlock v1
→ separate Resume / Portfolio structure logic
→ CareerEntity
→ Human Review
→ Confirmed Career Model
→ confirmed-only selective CareerEvidence
```

### 当前系统可以做什么

- 导入支持的 Resume / Portfolio；优先使用原生文档文本，对 image-only PDF 页本机 OCR。
- 在受限条件下重建 multi-column Resume 阅读顺序，分别将 Resume/Portfolio 分组为可审核 CareerEntities，并保留 provenance。
- 支持浏览器本地 correction memory、entity-level 确认/编辑确认/拒绝/reopen，以及仅从 confirmed entities 派生 Evidence。
- 本地持久化并在刷新后恢复；项目边界无法可靠确定时 fail closed 为 `needs_manual_selection`。

### 当前有意不做什么

- P4.1B 只实现多模态 AI semantic ingestion 与 Canonical Career Context；不做自动 Local/AI fusion、证据驱动职位匹配、投递推荐、RAG、MCP、内部 Agent 或自动投递。
- `P4.2 — Evidence-grounded Matching & Application Intelligence` 尚未开始。

## P4.1 Career Material Entity-first（已完成）

打开 <http://127.0.0.1:8000/career-evidence.html> 可导入 Resume 或 Portfolio。两者分别提取、共同进入 Entity-level review；只有 confirmed entities 才派生 Career Evidence。

- Resume：Basics、WorkExperience、Education、Resume Project、SkillGroup、Language、Award。
- Portfolio：原生 PDF 文字为空时，本机 PDF 渲染 + macOS Vision OCR 保留文字、坐标、置信度，并按支持的 CASE/独立项目边界生成 Portfolio Projects；项目 title 与 category metadata 分离。
- 边界：仅本机处理；不写入 SQLite；不调用外部模型；低置信、缺失或无法支持的字段保留为空并要求审核。

## P4.1B AI-Assisted Career Material Ingestion（纵向切片已实现）

仍打开 <http://127.0.0.1:8000/career-evidence.html>，在页面顶部使用 **AI Mode**：

1. 先验证 DeepSeek 文字通路；原始 PDF 直读选择 Gemini；
2. 如需 Gemini 真实调用，将 Gemini API Key 保存到 macOS Keychain（或启动服务前设置 `GEMINI_API_KEY`）；
3. 选择原始 PDF，并勾选私人资料传输/费用确认；
4. 系统直接把原始 PDF 交给 Gemini direct document input，不先运行本地 OCR/DocumentBlock/parser；
5. 合同有效的 Canonical Career Context Markdown 以 `needs_review` 保存在浏览器 IndexedDB；
6. 用户查看并接受后，相同 `source_hash + provider + model + prompt_version` 会直接复用；“明确重新生成”才绕过缓存再次调用。

Gemini credential 尚未配置，因此尚未发送真实职业资料。DeepSeek 已完成独立中文文字预检，但不支持 direct PDF；它不会被本地 OCR 结果模拟为“原始文档直读”。完整边界与合同见 `docs/current/P4_1B_AI_ASSISTED_INGESTION.md`。

## 当前范围

- 输入：`JD-001` 的 seed，以及用户已提供的 Batch 06 本地证据（`JD-002`…`JD-014`）。
- 数据：固定 schema；未知事实不猜测。
- 来源：保留本地 `source_path`；一条已允许的 Tencent Careers URL 已完成手动读取、raw capture、候选规范化、去重与来源证据同步。
- 持久化：本地 SQLite。
- 查询：按公司、职位或地点搜索职位记录。
- 写入：更新用户自己的投递状态，并在刷新后从 SQLite 恢复。
- 输出：浏览器中的职位卡、按需读取的职位详情、证据追溯路径与详情层的外部同步证据。
- 不包含：自动找工作、RAG、MCP、Agent、Vector DB、登录、自动轮询或云部署。包含一个本地 Mock 文本分析链路，以及一个由用户主动触发、通过 macOS Keychain 读取 credential 的真实 DeepSeek 多模态截图提取链路。二者必须分开判断。

## 运行

```bash
cd /Users/kai/Documents/GitKaiNex/Ariadne
python3 app.py
```

## 已完成：单来源外部 HTTP ingestion

在另一个终端手动运行：

```bash
python3 scripts/fetch_tencent_jd.py
```

读取脚本只对明确 allowlist 的腾讯资源发起手动 HTTPS `GET`，不登录、不自动轮询；成功或失败均在 `data/raw/` 留下 evidence record。已完成的一次来源链路从 API JSON 生成 candidate、匹配 JD-001，并按用户确定的 merge policy 安全写入来源证据字段。

当已保存 API JSON 已通过来源读取检查时，可只生成待审查的候选 record（仍不写 SQLite）：

```bash
python3 scripts/normalize_tencent_jd.py <raw_api.json> <fetch_metadata.json>
```

候选文件在 `data/normalized_candidates/`。它把来源最后更新时间与 `published_date` 分开，并不映射用户自己的 `application_status`。

要在写入前检查 candidate 是否已存在于 SQLite，可运行：

```bash
python3 scripts/reconcile_tencent_candidate.py <normalized_candidate.json>
```

它以 Tencent `postId` 比对既有 `source_url`，输出 reconciliation plan；不会写入 jobs 表，也不会改动 `application_status`。

在 candidate 已匹配且用户确认字段策略后，可同步外部来源证据：

```bash
python3 scripts/sync_tencent_candidate.py <normalized_candidate.json> <reconciliation_plan.json>
```

该同步保留现有公司、标题、地点、经验和 `application_status`；仅写入外部来源 ID、原始来源字段、raw evidence 与本地成功读取时间。

然后打开 <http://127.0.0.1:8000>。

首次启动会读取 `data/jd-001.json`，创建 `data/job_radar.db` 并保存 `JD-001`。数据库文件是本地运行产物，不纳入版本控制。

## 批量导入既有 JD 证据

用户已提供的 Batch 06 截图、`normalized.md` 与 `extracted.md` 可在**不重新访问招聘网站**的前提下导入：

```bash
python3 scripts/import_batch06_evidence.py --dry-run  # 先只生成候选与报告
python3 scripts/import_batch06_evidence.py            # 写入 SQLite
```

它将 `JD-002`…`JD-014` 写入 `jobs`，保留 `unknown`/`needs_review`，不猜测缺失事实。候选 JSON 在 `data/batch06_candidates/`；导入报告在 `data/batch06_import_report.json`。为避免把可能含访问参数的 BOSS 链接公开，导入记录只保留本地 `source_path`，不保存这些 `source_url`。重复运行只报告既有记录，不产生重复行，也不改动 `application_status`。

## 浏览器 local-first 导入原型

打开 <http://127.0.0.1:8000/local-first.html>。链接只作来源记录；内容有两条待审核路径：

- 粘贴职位链接：作为来源记录，与随后截图或原文候选一起保留；页面不会主动测试、读取、登录或探测该链接。
- 粘贴 JD 原文：只在本机按规则整理候选；链接若存在会去掉 query/fragment 中可能的访问参数后再保留。
- 选择或粘贴 1–4 张同一 JD 截图：可先走本机 macOS Vision OCR，或在自己点击后走 DeepSeek 视觉提取。若上方填有链接，候选会同时保留净化后的来源链接与本机原图，方便回溯。

两条内容路径都只生成浏览器 IndexedDB 中的 `needs_review` candidate，用户审核后才写入 job。OCR 图片只发到本机 `127.0.0.1`。视觉路径固定使用完整 extraction 规则，把本次选中的原图发送给 DeepSeek，且只在用户先将 API Key 存入 macOS Keychain、再点击“开启 AI 读取截图”后发生。Key 不进入 IndexedDB、JSON 备份或项目文件。视觉模型的返回仍要过本地 JSON/evidence 校验；失败不写入职位。确认保存后可打开 <http://127.0.0.1:8000/local-jobs.html>，以图片优先的卡片流查看该浏览器中的全部已保存职位并展开详情。

## P4.1 Resume Entity-first 工作台

打开 <http://127.0.0.1:8000/career-evidence.html>。当前支持 PDF、DOCX、Markdown 与 UTF-8 TXT：

- 原文件 Blob、`SourceDocument`、`ExtractionRun`、`CareerEntity`、`EntityReviewDecision`、派生 `CareerEvidence` 与 `CareerProfile` 保存在当前浏览器的 IndexedDB。
- 文档文本只经本机 `127.0.0.1` 临时抽取；PDF 使用 macOS PDFKit，不调用外部模型，也不写入 SQLite。
- Resume 按 Basics、Work、Education、Project、SkillGroup 和 Language 形成完整 `needs_review` entities；Work 的 company、role、dates、location 与 bullets 保持在同一审核卡片。
- 用户确认或编辑后确认的 entity 才进入 Career Model；只有具有职业 claim 价值的字段派生 `CareerEvidence`。联系方式和日期本身不生成 Evidence。
- IndexedDB 使用 additive version 4；既有 stores、SourceDocument 与 v0 Evidence 均保留，legacy fragments 不自动进入 v1 profile。
- 可导出 `CAREER_ENTITIES.json`、`EVIDENCE.json` 与 `CAREER_PROFILE.md`；raw Blob 暂不包含在 export 中。

真实回归已覆盖 Tencent Resume PDF/DOCX、Tencent Portfolio、English CV、Touchine Portfolio 与 45-page comprehensive Portfolio。English CV 保留 3 Work、2 Education、3 SkillGroups、2 Languages、3 Awards；Touchine 保留 `MemoryBlock / MUPAHKC / Material Card / Mac Setup / Material Resonance` 五项目，unknown outcomes 保持为空。详见 `docs/history/P4_1_CAREER_EVIDENCE_CHECKPOINT.md` 与 `docs/architecture/DOCUMENT_UNDERSTANDING_FINAL_ARCHITECTURE_REVIEW.md`。

## 观察数据流

```text
data/jd-001.json
  → data/schema.sql（结构规则）
  → data/job_radar.db（SQLite 持久化）
  → GET /api/jobs?q=深圳（SQL 查询）
  → public/app.js（HTTP 请求）
  → public/index.html（职位卡）
```

## 可观察的正常与失败案例

- 正常：页面显示 Shenzhen 的 JD-001。
- 空结果：输入 `上海`，页面显示“没有找到匹配职位”。
- 不存在详情：访问 <http://127.0.0.1:8000/api/jobs/JD-999>，API 返回 HTTP 404 JSON。
- 状态保存：选择一个“我的投递”状态并保存，刷新后该状态保留；它是用户数据，不是 JD 声称的外部事实。

## 证据边界

`JD-001` 的职位发布日期、当前开放状态、投递状态均没有本项目内可用的实时证据，因此分别保存为 `NULL`、`unknown`、`unknown`。原始证据仍在 `00_inbox/batch-06-jd-company-roles/JD-001-tencent-ai-design-engineer/`。

## 阶段状态（2026-08-24）

- 已完成：单条真实 JD 的结构化保存、SQLite/SQL、列表与详情 HTTP API、浏览器列表/详情、用户投递状态持久化，以及正常与失败回归。
- 外部 ingestion 已完成：单来源 HTTP read、raw evidence、candidate、duplicate key、safe SQLite sync、detail API/UI、正常与失败行为。
- 已完成：Batch 06 的 13 条用户提供 JD evidence 已导入；SQLite/API/UI 共显示 14 条记录（含 JD-001）。
- Phase 3 已关闭：link / raw evidence → OCR 或用户主动开启的真实 DeepSeek vision → structured candidate → validation / review → IndexedDB → editable gallery。
- Phase 4 架构已确认：`CareerEvidenceStore` 核心、IndexedDB/SQLite alternative stores、P4.1→P4.4 顺序，以及 Job Radar Brain/Memory 与 External Agent Hands 的边界。
- P4.1 Career Material Entity-first 与 final no-model mapping closeout 已完成；系统不会自动确认 Career facts，实际 CareerProfile 仍只由用户确认的实体生成。
- Phase 3 完整证据见 `docs/history/PHASE_3_FINAL_SYNTHESIS.md`；当前架构与 P4.1 closeout 见 `docs/architecture/PHASE_4_ARCHITECTURE_REFERENCE_REVIEW.md`、`docs/architecture/DOCUMENT_UNDERSTANDING_FINAL_ARCHITECTURE_REVIEW.md`。

## Text analysis system foundation（Mock Provider；真实文本 analysis 未验证）

`data/model_contracts/jd_analysis_v0.json` 定义模型分析可接收的 provenanced JD 输入、可返回的结构化输出、validation 与 failure/human-review 边界。`model_instruction_v0.json` 是独立控制指令；它不成为 JD 事实。`src/model_analysis_pipeline.py` 定义 provider adapter；当前唯一实现是本地、确定性的 Mock Provider，未使用凭据或网络。

`scripts/run_model_analysis.py --provider mock --scenario compliant` 完成一条本地 vertical slice：JD-001 facts/provenance → instruction + input request → Mock Provider response → syntax/schema/boundary validation → 独立 `job_analyses(needs_review)`。相同 input 再运行会复用 stable analysis ID，而非重复写入。用户决定每个 capability 都必须有 `evidence_fields`；`--scenario missing_capability_evidence` 会因缺 capability evidence 而拒绝且不持久化。`--scenario invalid` 是另一受控 failure：收到 provider response 但因 user-owned field、自动批准和无 evidence claim 被拒绝。

`data/model_contracts/analysis_persistence_contract_v0.json` 定义已通过 contract 的分析作为独立 `job_analysis` record 保存为 `needs_review`；人工可批准或拒绝，但 analysis 不覆盖原始 `jobs` 事实或用户投递状态。`data/schema.sql` 已创建最小 `job_analyses` table；`tests/analysis_review_regression.py` 在回滚事务中验证“创建待审 → 模拟拒绝”，不留下测试分析记录。

## Provider registry（文本 analysis adapter 尚无真实成功证据）

`src/provider_registry.py` 把同一 provider-independent request 转为 OpenAI 或 DeepSeek 的 request payload，且只报告 credential 是否存在，不打印 key。OpenAI 预留 Responses `json_schema` strict output；DeepSeek 预留 JSON Output，仍依赖本地 schema/boundary validation。`scripts/provider_preflight.py` 不发送网络请求：

```bash
python3 scripts/provider_preflight.py --provider openai --model YOUR_MODEL_ID
python3 scripts/provider_preflight.py --provider deepseek --model YOUR_MODEL_ID
```

用户已选择 DeepSeek 作为第一 Provider。`scripts/call_model_api.py` 已准备好文本 JD analysis 请求，但当前 SQLite 只有 Mock analysis，没有可回放的真实文本 analysis 成功记录。真实成功的是 `app.py` 的截图视觉提取路径：用户在页面把 Key 保存到 macOS Keychain，主动发送本次截图，得到 JSON/evidence candidate 后进入浏览器审核。视觉成功不能替代文本 analysis 的独立验证。

可用本地 validator 验证模拟输出：

```bash
python3 src/validate_model_output.py <contract.json> <model_output.json>
```

例如 `invalid_model_output.json` 故意包含 user-owned `application_status`、擅自 `approved` 和无证据 claim，validator 会拒绝并返回 `do_not_persist`。`compliant_model_output.json` 的 `contract_valid: true` 仅表示结构/边界检查通过，仍只返回 `await_human_review`，不会自动写入。`misleading_but_valid_model_output.json` 也能通过 contract 检查，却误把“一年以上工作经验”总结为“三年经验”，用于说明 human review 仍不可省略。

</details>
