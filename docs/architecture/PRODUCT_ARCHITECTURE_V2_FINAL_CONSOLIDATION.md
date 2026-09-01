# Job Radar｜Product Architecture V2 — Final Consolidation

状态：`PRODUCT ARCHITECTURE V2 = FROZEN / CONFIRMED`  
Gate：`Architecture Gate = COMPLETE`  
Implementation：`Implementation = NOT STARTED`  
日期：2026-08-25  
范围：产品与 AI Systems 架构冻结；未执行生产代码、schema、数据迁移、Provider 调用、Figma 设计或 Git 初始化。

当前唯一 Next Milestone：`Current Next Milestone = STEP 1 — ONE REAL RESUME / CANDIDATE IMPORT + HUMAN CALIBRATION`。

```text
ONE REAL RESUME PDF
→ SourceDocument
→ DeepSeek consent
→ real ProcessingRun states
→ structured CandidateItem Proposal
→ Work / Project / Education Cards
→ Human Review
→ Direct Edit
→ card-scoped AI Correction
→ Context Patch
→ Before / After / Why
→ User Confirm
→ CandidateContext persisted
→ close / reopen
→ confirmed Cards remain
```

Closeout boundary：不做 Portfolio、Job Import、Match、Resume generation、Capability Card、Career Mentor；不重新设计 Architecture，不迁移旧 CareerEntity，不做 OCR benchmark、MCP、RAG、Agent、Skill 或 CLI。当前只关闭 Gate，不开始 Step 1。

## A. EXECUTIVE DECISION

一句话定义：**Job Radar V2 是一个 local-first、BYOK、evidence-grounded 的求职申请工作台：把多来源职业资料与用户选择的目标职位转成可追溯、可校准的上下文，在 requirement level 解释相关性与差异，并只建议最少且必要的材料调整。**

决策：Final Consolidation 的 `ADOPT WITH CHANGES` 结果现已由用户确认为 `FROZEN / CONFIRMED`。

相对前一版，本次正式冻结：

- Candidate 主资产从 `AI Markdown / CareerEntity / Career Profile` 收敛为版本化 `CandidateContext → CandidateItem[]`。
- `About Me + Experience Pack` 是主要人类视图；Card 是 Human Calibration Surface，不是数据库 schema。
- AI 导入必须返回结构化 Proposal；Markdown 只做 snapshot/export，不做 runtime truth。
- Direct Edit、AI Correction、Question Answer、User Addition 统一为可预览、可确认的 Context Patch。
- Candidate 与 Job 共享 processing/review grammar，但使用不同语义合同。
- 下游采用 Passit-like `JD → Requirement → Evidence Matrix → high-value clarification → grounded action`，并加入更细的 gap taxonomy。
- 产品优化原则为 `MINIMUM NECESSARY CHANGE`；`NO CHANGE` 是合法输出。
- 第一实现只做一个真实 Resume 的 Candidate Import + Calibration 完整闭环；完成后停止并验收，再做 Job Import。

## B. WHAT JOB RADAR IS NOT

当前明确不做：Career Mentor、Career Life Coach、心理型职业顾问、长期陪跑聊天机器人、职业方向自动决策、用户选择动机解释、巨型 Job Board、公司数据库、抓取平台、通用 Resume Builder、通用 ATS 分数工具、批量自动投递、通用 Career Chat、Capability Card、Career Direction Card、Interest Card、RAG、MCP 产品功能、Agent、Skill、CLI、浏览器扩展、模板引擎、Resume/Portfolio 生成器、Provider 大全。

用户选择 JD；系统只回答：现有资料中什么相关、哪里缺少支持、哪里表达不足、需要调整什么。

## C. PRODUCT DIFFERENTIATION — OBJECTIVE

不是创新的部分：Candidate Profile、Experience Vault、JD Match、Human Review、Cards、多 JD、tailored resume、Evidence Matching、BYOK、before/after review 都已有成熟产品或开源实现。

当前 differentiation hypothesis：

```text
Multi-source Candidate Understanding
+ Card-first Human Calibration
+ Persistent Corrected Candidate Context
+ Requirement-level Evidence Matching
+ Fine-grained Difference Diagnosis
+ Minimum Necessary Change
+ Local-first / BYOK / Explicit AI Processing
```

真正值得自己设计的是：**把 AI 对某个人的理解拆成异构但可统一审核的 Card，并让每次纠错真实更新版本化 Candidate Context，之后在具体 JD 上区分 Capability / Evidence / Expression / Positioning / Ownership 等差异。**

该组合足以形成清晰产品 identity，但目前只是差异化假设；需由真实 Candidate Calibration 与一条真实 JD Match 验证，不能营销为市场唯一。

## D. REFERENCE ADOPTION MATRIX

| Reference | What We Adopt | What We Do Not Adopt | Code / Docs to Inspect | Reuse / Adapt / Pattern Only | Reason |
|---|---|---|---|---|---|
| [Passit](https://passit.kr/) | JD decomposition、JD–Evidence Matrix、只问缺失高价值信息、grounded output、application memory | 不复制 UI、韩语产品范围或其评分标签 | 产品页的 Experience、JD Evidence Requirement、Evidence Matrix、Gap Interview、Grounded Output | Pattern Only | 是未来 Candidate→JD 下游最贴近的责任模型 |
| [CareerStack](https://www.careerstack.tech/) | Resume/Portfolio/LinkedIn 等作为 Candidate Sources；durable candidate representation | 不采用 Career Digital Twin 营销与完整产品范围 | 产品页的 import sources、living profile、career identity | Pattern Only | 证明多来源资料应沉淀为 Candidate，而非一份最终简历 |
| [KarriereVault](https://www.karriere-vault.com/) | 一次建立多来源 Career Profile，重复用于岗位分析 | 不采用偏好、写作风格等全部模块；不假设任意 URL 都可读 | Career Profile / Built from sources / role comparison 页面 | Pattern Only | 支持 source-once、reuse-many 的产品结构 |
| [simaqian/resume-tailor](https://github.com/simaqian/resume-tailor) | local-first、BYOK、Provider adapter、AI suggestion review、token cost意识 | 不迁移 Tauri/Rust；不核心化百分比分数、ATS、STAR、Ollama | `README.md`、`src-tauri/src/llm/`、`src/` suggestion UI、`LICENSE`（MIT） | Adapt Pattern；实现前定向读 adapter/UI | 当前 localhost + Python 可借接口责任，不借 stack |
| [TadMSTR/jobsearch-mcp](https://github.com/TadMSTR/jobsearch-mcp) | `build_profile → review → save_profile`；tailor 只返回 changed content；task-scoped context；缓存/usage意识 | 不引入 MCP、Postgres、Qdrant、Valkey、Docker、Ollama、抓取和 watcher | `README.md` Resume Profile tools；实现前定向看 profile/tailor tool contracts、`LICENSE` | Adapt Contract | “返回供审核但不自动保存”和“只返回变化”直接适配 Proposal/Patch |
| [Pluto-Mo/personal-career-os](https://github.com/Pluto-Mo/personal-career-os) | 经历一次沉淀、多投递复用；基础事实与 job output 分开；只问事实；不编造 | 不采用 Agent Skill、文件型 Career OS、整套投递材料与一页渲染 | `README.md`、`profile/experiences/_TEMPLATE.md`、`workflows/intake`、`workflows/apply`、`LICENSE` | Pattern Only | 强化 Experience Pack 与 source-once/reuse-many |
| [ramyanai/CareerOS](https://github.com/ramyanai/CareerOS) | original/new/reason change log、no fabrication、gap remains gap、输出前验证 | 不采用 Claude Code 命令系统、批处理与完整申请包 | `README.md`、`.claude/commands/apply.md`、change log 约定、`LICENSE`（MIT） | Adapt Pattern | 为 Before/After/Why 和 gap honesty 提供成熟先例 |
| [Huntr](https://help.huntr.co/en/collections/10297126-resume-builder) | Base vs Tailored、Requirement/Qualification covered/not-covered、why matched | 不以 keyword percentage / ATS score 为核心，不复制 Resume Builder | Resume Builder、Responsibility & Qualifications Matching、Job Match 帮助文档 | Pattern Only | 证明 requirement-level reasoning 比单一 score 更可操作 |
| [Teal](https://help.tealhq.com/en/articles/9923251-using-job-matching-resume-curation) | 用户先选 Job；master content 复用；按相关性启用/停用内容 | 不复制 Job Tracker、付费产品或关键词导向 | Job Matcher Auto-Select、comprehensive resume / tailored view 文档 | Pattern Only | 与 Minimum Necessary Change 高度一致 |
| [Careerflow](https://help.careerflow.ai/en/articles/11691410-getting-started-ai-resume-builder) | Accept/Reject/Edit/Compare；before-after；版本恢复 | 不采用 one-click optimizer、分数驱动与通用 Resume Builder | AI Resume Builder、AI Assistant、One-click Optimizer、History 帮助文档 | Pattern Only | 可直接转化为 Card Patch review grammar |
| [Open Career Format](https://opencareerformat.org/spec/implementer-quick-reference.html) | stable IDs、sourceArtifacts vs provenance、reviewStatus、openQuestions、parentVersion/lineage、self-asserted truth boundary | 不完整兼容 OCF、不复制巨大 schema、不把 OCF 文件作为 runtime truth | Implementer Quick Reference、Design Guide、Schema Field Guide、Minimal Useful OCF | Adapt Minimal Subset | 避免重新发明 provenance/review/version 基本语义 |

采用原则：先借责任和合同；只有实现时确需复制具体 MIT 代码，才逐文件核对当前 license/attribution。商业产品只借公开交互模式，不复制实现或视觉资产。

## E. CURRENT REPOSITORY AUDIT

当前真实系统：

- Backend：单体 `app.py`，dependency-light localhost HTTP 服务；SQLite 保存 14 条正式 Job 与 1 条 mock analysis。
- Browser persistence：同一 IndexedDB `job-radar-local-first-v1`，版本 7，包含 jobs、SourceDocument、ExtractionRun、CareerEntity、CareerEvidence、AI Context、AI Profile、Career Intelligence 等 store。
- Candidate Local path：`SourceDocument → ExtractionRun → DocumentBlock → CareerEntity(needs_review) → confirm → CareerEvidence`。native extraction、Apple Vision、OCR、resume/portfolio parser 已有真实回归。
- Candidate AI path：原始 PDF Blob 先保存在浏览器；后端临时读取，DeepSeek 通过渲染全部页面图像处理；结果仍是 Canonical Markdown artifact，浏览器保存 `ai_career_contexts`，人工确认后生成 `ai_career_profiles` Markdown snapshot。
- AI 主路径缺口：没有结构化 CandidateItem Proposal、CandidateContext、ContextPatch、Diff、ProcessingRun 持久合同；AI Profile 尚未成为 confirmed CareerEvidence 的正式输入。
- Processing UI：有 idle/ready/sending/returned/failed，但不是持久化、分层、可恢复的真实状态机。
- Credential：DeepSeek/Gemini Key 使用 macOS Keychain；不会进入浏览器导出或 SQLite。该边界可保留。
- Job：SQLite 正式 JD 与浏览器本地 jobs 是两个 truth domain；尚无统一 JobContext/Requirement 合同。
- UI：已有 workspace 聚合页和多个独立 HTML 页面；不是单一 App Shell。用户以 `file://` 打开时，根路径链接与 API/IndexedDB origin 行为不可用；产品应由 localhost runtime 打开。
- Git：`job-radar` 及 Workspace 根目录都不是 Git worktree；无法创建“pre-v2 tag”。当前 `.gitignore` 只有 Python cache 规则，尚不足以安全同步真实职业资料与私密运行数据。
- Figma：当前 Codex 中 Figma plugin 状态为 `not_installed`；本 Gate 不安装、不授权。

## F. KEEP / SIMPLIFY / DEPRECATE MAP

| Current Module | Decision | V2 Responsibility |
|---|---|---|
| SourceDocument | KEEP AS CORE | 原始材料/原始 JD 的 source of record、hash、type、local blob、visibility |
| DocumentBlock | KEEP AS INFRASTRUCTURE | offline/native extraction 的可追溯 block；不决定 Candidate semantics |
| native extraction | KEEP AS INFRASTRUCTURE | 本地文字读取与 fallback |
| Apple Vision / OCR | KEEP AS INFRASTRUCTURE | 仅在本地 extraction 需要时使用；不重开选型 |
| Resume parser / Portfolio parser | LEGACY / OFFLINE ONLY | 生成 Reviewed Local Source，不定义 AI Candidate Context |
| CareerEntity | DEPRECATE FROM AI MAIN FLOW；LEGACY / OFFLINE INTERMEDIATE；REPLACE LATER | 保留历史 records/tests；不删除、不迁移；新 AI flow 不写入 |
| CareerEvidence | KEEP + SIMPLIFY | requirement-level claim support/trace；由 confirmed CandidateItem facts 按需投影，不做第二套 Candidate truth |
| CapabilityBoundary | DEPRECATE FROM CANDIDATE MAIN FLOW | Match 时按 requirement 派生 ownership/capability judgment；不建 Capability Card |
| InterestSignal | KEEP AS BACKGROUND METADATA | 用户收藏/关注/投递等显式状态；不是能力或目标 |
| CareerDirectionHypothesis | DEFER | 不进入主 UI、提问或 token loop |
| OpenQuestion | SIMPLIFY | 绑定 CandidateItem 或 JobRequirement 的 high-information clarification |
| AI Career Context Markdown | REPLACE LATER | 保留历史 artifact；未来由 structured proposal + generated snapshot 取代主 runtime 角色 |
| Provider layer | KEEP + SIMPLIFY | DeepSeek-first；保留 provider/model/prompt_version 接口，不扩多 Provider |
| DeepSeek integration | KEEP AS INFRASTRUCTURE + TARGETED UPDATE | 实现前按当前官方 docs/account model preflight；改为 structured proposal |
| IndexedDB stores | KEEP AS CURRENT PERSISTENCE + ADDITIVE MIGRATION LATER | Step 1 继续 browser-local；新 store 只能 additive，旧 records 保留 |
| Career Model Control Center | DEPRECATE FROM MAIN UI | 不再展示 Interest/Direction/Capability 主线；历史 store 保留 |
| Review UI | REPLACE | 由 heterogeneous Cards + shared review grammar 替换 giant Markdown/schema form |
| Jobs / JD records | KEEP | 14 条 SQLite evidence 保留；新真实 Job import 进入明确 JobContext truth domain |
| Offline UI | SIMPLIFY / SEPARATE | 小页面或 import 内 secondary path；负责 source/content review |
| current navigation/workspace | REPLACE LATER | 以 frozen sidebar 的单一 App Shell 取代跨 HTML 聚合链接 |

## G. V2 CORE DATA FLOW

Candidate：

```text
Original Candidate Source
→ SourceDocument(local preserved)
→ explicit ProcessingConsent
→ ProcessingRun(DeepSeek)
→ structured CandidateProposal
→ local validation
→ heterogeneous Human Cards
→ edit / clarify / AI correction
→ CandidateContextPatch + Diff
→ user confirm
→ CandidateContext vN+1
→ reopen as About Me + Experience Pack
```

Job：

```text
JD text / screenshot / PDF / supported URL
→ Original Job Source
→ explicit ProcessingConsent
→ ProcessingRun
→ structured JobProposal
→ Job Card + Requirements
→ edit / clarify / confirm
→ JobContext vN
→ View Jobs
```

Future Match：

```text
User-selected JobContext
→ JobRequirements
× relevant confirmed CandidateItems / CareerEvidence
→ RequirementJudgment[]
→ high-value clarification only when outcome may change
→ Difference Diagnosis
→ Minimum Necessary Change actions
```

Offline：

```text
SourceDocument
→ native extraction / OCR
→ ContentBlock / DocumentSection
→ manual source-text review
→ Reviewed Local Source / export
(optional later consent)
→ AI Candidate Understanding
```

## H. CANDIDATE CONTEXT CONTRACT

最小稳定合同不是完整 Resume schema；它只保证 durable identity、review、trace、revision 和未来 match。

```text
CandidateContext
- context_id
- current_version
- item_ids[]
- source_document_ids[]
- created_at / updated_at

CandidateItem
- item_id                         stable
- item_type                       PROFILE | WORK_EXPERIENCE | PROJECT | EDUCATION | OTHER
- title
- subtitle?                       organization / program / context
- time?                           raw + normalized only when supported
- summary
- facts[]                         small typed facts, each with stable fact_id
- ownership?                     user role/scope/boundary when relevant
- source_refs[]
- uncertainties[]
- review_status                   NEEDS_REVIEW | CONFIRMED | REJECTED | SUPERSEDED
- item_version
- created_at / updated_at

SourceRef
- source_ref_id
- source_document_id
- location                        page / line / block / user statement
- excerpt_or_reference
- support_relation                EXPLICIT_SOURCE | AI_DERIVED | USER_ADDED | USER_CONFIRMED

Uncertainty
- uncertainty_id
- question
- affects                         fact / ownership / outcome / matching use
- status                          OPEN | RESOLVED | DISMISSED
```

关系：SourceDocument 描述“输入是什么”；SourceRef/Provenance 描述“这一项怎样从输入而来”；review_status 描述“用户是否允许作为 durable context 使用”。三者不可合并。AI Proposal 位于 confirmed context 之外；Human Card 是 CandidateItem/Proposal 的 renderer；Markdown 是从 current context 生成的 snapshot。

为什么足够：Work/Project/Education 可以各自扩展 type-specific content，但 shared core 已支持稳定引用、逐项审核、Patch、source trace、未来 requirement-level matching。第一版不建立 500 行 schema；真实卡片失败再添加字段。

## I. EXPERIENCE PACK

主要人类模型：

```text
Candidate
├── About Me (composite summary; not truth)
└── Experience Pack
    ├── Work Experience Item
    ├── Project Item
    ├── Education Item
    └── Other / User-added Item
```

`About Me` 只从 confirmed CandidateItems 计算当前定位、经历概览与近期重点；用户可编辑其表达，但不能覆盖底层 facts。Experience Pack 承担 durable、可追溯、可逐项校准的信息。

## J. CARD TYPES

- Work Experience Card：Company/Organization、Role、Period、3–5 条 contribution/responsibility、known outcome、relevant uncertainty。
- Project Card：Project、Context、Role、Key Contributions、important decisions、Outcome/Status、AI/collaborator ownership boundary。
- Education Card：School、Program、Period、仅在任务相关时显示 relevant context。
- Other/User-added Card：flexible title、summary、facts、source/user provenance。

不同 Card 使用不同视觉信息优先级，但共享 Review/Edit/AI Correct/Question/Trace/Revision/Confirm。**不做 Capability Card。** Capability 是 `CandidateItem × JobRequirement` 的 derived judgment。

## K. CARD HUMAN CALIBRATION

```text
AI Understanding
→ CandidateItem Proposal
→ Card
→ Human correction/addition/clarification
→ Context Patch
→ Diff
→ User Confirm
→ CandidateContext new version
→ Card rerender
```

Card 是 AI internal understanding 与用户自我确认之间的 alignment interface。AI 可提出、归纳、询问与 patch；用户修改事实后，AI 必须准确表达，不得争论用户“真正是什么职业”。

## L. PROGRESSIVE HUMAN REVIEW

Level 1 Scan：title、type、短理解、3–5 facts、必要 ownership、uncertainty count、review state。

Level 2 Review：AI 当前理解、facts、ownership、outcome、uncertainties、具体问题；Actions = 正确、修改、补充、和 AI 修正、查看依据。

Level 3 Trace：source page/location、source explicitly stated、AI derived、user added、user confirmed、revision history。默认使用人类状态词，不显示无产品价值的小数 confidence。

成功标准是用户能快速回答：AI 认为我做了什么、为什么、哪里来自 source、哪里是 AI 归纳、哪里不确定、如何纠正、确认后变了什么；不是一次“确认全部”。

## M. CONTEXT PATCH / REVISION MODEL

Direct Edit、AI-assisted Correction、Question Answer、User Addition 统一为：

```text
CandidateContextPatch
- patch_id
- target_item_id?                 null only for USER_ADDITION
- base_context_version
- base_item_version?
- change_source                   DIRECT_EDIT | AI_ASSISTED_CORRECTION | QUESTION_ANSWER | USER_ADDITION
- operations[]                    bounded add / replace / remove
- before_snapshot
- after_preview
- reason
- source_refs[]
- user_message?
- processing_run_id?              only for AI-assisted
- status                          PROPOSED | CONFIRMED | REJECTED | SUPERSEDED
- created_at / confirmed_at?
```

Direct Edit 不调用 LLM。AI Correction 只发送 Current Card + target CandidateItem + relevant Source + user correction；模型只返回 structured patch proposal。UI 必须展示 Before/After/Why；只有 Confirm 才以 compare-and-apply 检查 `base_context_version/base_item_version` 并生成 vN+1。版本冲突则要求重新预览，禁止 silent overwrite。第一版保留 current context + revision history，不做完整 Event Sourcing。

## N. USER AUTHORITY / TRUTH BOUNDARY

- Original Source = source of record，不等于自动真相。
- Candidate-provided / user-confirmed information = 产品可复用的 self-asserted truth。
- AI inference = proposal，不得自动成为 confirmed claim。
- Job Radar 不调查用户是否撒谎或数字是否真实；它保证 AI 不自行编造，并保留来源/确认轨迹。
- `Missing Evidence ≠ Missing Capability`。
- `AI-assisted Implementation ≠ Independent Engineering Capability`。
- `LLM Proposal ≠ Stored Truth`。

## O. DEEPSEEK / PROVIDER BOUNDARY

第一版只正式支持 DeepSeek。保留 `{provider, model, prompt_version, delivery_method}`，但不实现多 Provider UI/adapter 扩展。

实现前必须重新读取 [DeepSeek 官方 API 文档](https://api-docs.deepseek.com/) 并用账号 model listing/preflight 选择真实可用 model；现有实验 vision model 名不能作为长期常量。DeepSeek 官方 JSON Output 目前是 OpenAI-compatible `chat/completions + response_format=json_object`，但官方明确提示可能返回空 content，因此必须本地 schema validation、empty/malformed handling、fail closed，不能把“JSON mode”当成 schema guarantee。

Provider adapter 只负责：credential lookup、request build、network call、provider response normalize、usage extraction。它不确认 Candidate facts、不写 confirmed context。

## P. CONSENT / PRIVACY / API COST

配置 Key 不等于同意发送材料。每次外部处理必须创建 action-scoped consent，显示：具体文件、页数/大小、Provider、Purpose、可能费用；用户明确确认后才发送。

```text
Portfolio.pdf · 38 pages
Provider: DeepSeek
Purpose: Understand candidate material
May incur API usage
[ ] 我理解所选资料将发送至 DeepSeek，并可能产生费用
```

Key 继续使用 macOS Keychain，不进入 source code、Git、public frontend state、IndexedDB export 或日志。Source Blob/Candidate Context 默认 browser-local/private。发送失败、验证失败或持久化失败都不得改变 Confirmed Candidate Context。

## Q. AI PROCESSING STATE MACHINE

统一 ProcessingRun 只做 observability/control：

```text
CREATED
→ PREPARING
→ AWAITING_CONSENT
→ SENDING
→ WAITING_FOR_MODEL
→ RECEIVED
→ VALIDATING
→ BUILDING_PROPOSAL
→ READY_FOR_REVIEW

any processing state → FAILED(layer, code, retryable)
```

UI 显示真实步骤，不显示伪造百分比。失败层：Source、Transport、Provider、Model、Parsing、Contract Validation、Grounding、Review、Persistence、UI。ProcessingRun 最小记录 run_id、purpose、source_ids、provider/model/prompt、state、timestamps、usage、consent_id、failure_layer/code、proposal_id；不成为复杂业务模块。

## R. AI WORKSPACE

AI 工作区是 AI service / processing control surface，不是 General Chat，也不是一次性 Key 设置页。

- 未连接：DeepSeek 未连接 + 连接入口 + 本地导入 secondary link。
- 已连接：Provider status、当前 model、active/recent/failed ProcessingRuns、可用的 basic token usage。
- 具体资料/JD 的上传与 initial review 仍在 Import 页面。
- Settings 负责 credential、advanced provider configuration、privacy/preferences。

## S. SIDEBAR / INFORMATION ARCHITECTURE

冻结一级 IA：

```text
AI 工作区
导入资料
查看资料
导入职位
查看职位
设置
```

桌面端可折叠 Sidebar，左上角 icon 调用；移动端为 drawer。第一打开默认 AI 工作区：未连接时显示 DeepSeek connection；已连接时显示 processing control。不要再增加 Dashboard/Overview/Applications 等一级页面。实现时使用 localhost 单一 App Shell 和内部 view routing，不能依赖 `file://` + 多个绝对 HTML 链接。

## T. IMPORT MATERIAL / VIEW MATERIAL RESPONSIBILITY

导入资料：Choose Material → type → source preserved → consent → real processing state → structured proposal → initial Card review → confirm → success link to View Materials。

查看资料：长期 `About Me + Experience Pack`；open/review/edit/add/AI correct/trace/revision。不得长期保留巨大 upload form。

## U. JOB IMPORT / VIEW JOB RESPONSIBILITY

导入职位：JD text/screenshot/PDF/supported URL → source → consent → processing → Job Proposal → Job Card/Requirements → edit/clarify/confirm。URL 读取失败时只保留 provenance，并要求 text/screenshot/file，不假装成功。

查看职位：多个 confirmed Job Card、open/review/edit、later Match entry。CandidateContext 不按 JD 复制。

## V. OFFLINE V2

Offline 是 privacy fallback、小页面或 import 内 secondary path，不是主 intelligence path。它负责 native extraction/OCR、page/source、content blocks、manual text correction、Reviewed Local Source、export；不负责 capability/career direction/skill/JD match 等可靠语义推断。

Offline V2 目标合同为 `SourceDocument → ContentBlock/DocumentSection → Reviewed Local Source`。现有 CareerEntity 只为 historical compatibility；不继续加 parser rules 修复 semantic rigidity。

## W. CAREERENTITY FINAL DECISION

最终：`DEPRECATE FROM AI MAIN FLOW / LEGACY-OFFLINE INTERMEDIATE / REPLACE LATER`。

理由：>70% 纠错同时包含 OCR 与 rigid schema failure；旧 enum 过早要求 basics/work/education/skills/projects 分类，无法支持 heterogeneous Candidate understanding；保留它可避免破坏历史和 Offline regression，但它不能成为 V2 downstream Match 的主合同。第一步不删除、不批量迁移；只让新 AI flow 写 CandidateItem。

## X. CAREEREVIDENCE FINAL DECISION

最终：`KEEP + SIMPLIFY AS TRACEABLE SUPPORT PROJECTION`。

CareerEvidence 不是独立现实验证，也不是 Candidate parallel fact store。它将 confirmed CandidateItem 的具体 fact/ownership/source_refs 投影为未来 requirement judgment 可引用的 claim support：

```text
JobRequirement → MatchJudgment → CandidateItem/Fact → SourceDocument or User-confirmed statement
```

需要时生成/缓存，可失效重算；CandidateItem 保持 truth authority。

## Y. CAPABILITY / INTEREST / CAREER DIRECTION DECISIONS

- CapabilityBoundary：从 Candidate 主线移除；Match 时按 requirement 派生，不持久化 Capability Card。
- InterestSignal：仅保留用户明确收藏/关注/投递的 background metadata；不推断能力或长期目标。
- CareerDirectionHypothesis：defer；不进入 Sidebar、提问或主 token loop。
- OpenQuestion：只绑定 CandidateItem 或 JobRequirement，且答案可能改变 ownership/evidence/match/application action。

## Z. PASSIT-LIKE FUTURE JD MATCH ARCHITECTURE

```text
Target JobContext
→ Requirement[]
→ select relevant confirmed CandidateItems/Facts
→ RequirementJudgment[]
→ Evidence Matrix
→ only high-information clarification
→ grounded action
```

`RequirementJudgment` 必须支持：SUPPORTED、PARTIAL、CAPABILITY_GAP、EVIDENCE_GAP、EXPRESSION_GAP、POSITIONING_GAP、OWNERSHIP_LIMITATION、UNKNOWN，并引用 evidence/source 与 limitations。单一 percentage 只能是可选 overview，不是 truth 或主要交互。

## AA. MINIMUM NECESSARY CHANGE CONTRACT

未来每条建议至少包含：target material/item、current state、proposed change、why relevant、supporting requirement、supporting CandidateItem/fact、change magnitude、unchanged scope、uncertainty、review status。

系统必须允许：`NO_CHANGE`、只上移一个项目、强化一条已有事实、隐藏一个不相关项目。禁止为展示 AI 价值而全量 rewrite；修改数量不机械等于 match score。

## AB. TOKEN / COST STRATEGY

- One-time/cache：Source hash + provider + model + prompt/delivery version 对应 Candidate/Job Proposal。
- Persist/reuse：用户确认后的 CandidateContext/JobContext；关闭重开不重跑模型。
- Direct Edit：0 AI calls。
- AI Correction：Current Card + target item + relevant source excerpts + user correction；不传全部 Resume/Portfolio/JD/history。
- Question Answer：直接能映射的答案生成 deterministic patch；只有需结构化归纳时才用 scoped AI call。
- Job Import：只传 selected Job Source。
- Future Match：只传 target requirements + relevant confirmed Candidate subset。
- 日志：run-level input/output token、provider/model、purpose、cache hit、estimated/returned cost when available；不建 enterprise observability。

## AC. GIT / GITHUB STRATEGY

当前事实：Job Radar 不是 Git worktree，所以不能打 `pre-product-architecture-v2` tag，也没有可安全追溯的旧 commit。

Gate 后的安全建议（需用户确认再执行）：

1. 先扩充 `.gitignore`，覆盖 Key/env、真实 Resume/Portfolio、private Candidate/Job/Application export、runtime DB、OCR/private uploads、logs/cache；仅保留 sanitized fixtures/fake demo data。
2. 在 `job-radar` 目录初始化独立 Git repository，创建当前 architecture baseline commit；命名可为 `product-architecture-v2-baseline`，不要伪造 pre-v2 history。
3. 使用 `product-architecture-v2` implementation branch；通过 Step 1 acceptance 后再 merge/tag。
4. GitHub 默认 private；公开前做 secret scan、history scan、fixture/privacy audit 与 license/attribution check。
5. Git 保存 code/schema/prompt/tests/docs；Candidate data version 由 app persistence 维护。

当前 `.gitignore` 仅忽略 Python cache，属于 release blocker，但本 Gate 不修改。

## AD. CANDIDATE DATA VERSIONING STRATEGY

Git 不管理 CandidateContext。应用维护：current context + monotonic context_version + per-item version + confirmed patches/revision history。Patch 使用 base version 做并发检查；confirm 后原版本不可原地覆盖，current pointer 前进。普通用户默认只看 current Card，需要时查看 revision/change history。SourceDocument 永不被 AI output 覆盖。

## AE. FIGMA + CODEX WORKFLOW

当前 Figma plugin 未安装。Architecture Gate 不要求现在授权；Candidate UI implementation 前连接。

官方推荐流程：Codex Plugins 中安装/连接 Figma remote MCP（功能最广）；特定组织/桌面需求才用 desktop MCP。官方说明见 [Codex + Figma setup](https://help.figma.com/hc/en-us/articles/39888629089175-Codex-and-Figma-Set-up-the-MCP-server) 与 [Figma MCP developer docs](https://developers.figma.com/docs/figma-mcp-server/)。

Authority：Figma = Human Review Surface / visual interaction authority；Candidate Context contract = semantic/data authority；repository = implementation authority。

工作循环：

1. 用户在 Figma 画指定 Candidate Calibration frames/components/states。
2. 用户给出 exact Figma file/frame link 和要实现的 state。
3. Codex 通过 Figma MCP 读取 frame、components、auto layout、variables/tokens；记录 design reference/version。
4. Codex 先映射到既有 semantic contract，不从 Figma layer/field 发明 schema。
5. 实现指定 slice，做 viewport/state/screenshot comparison 与交互验收。
6. 设计变更必须更新 Figma frame/version；实现提交记录对应 design reference，避免长期 drift。

## AF. FIRST FIGMA “CANDIDATE HUMAN CALIBRATION KIT”

只画：Experience Pack page、Work Experience Card、Project Card、Education/Simple Card、Expanded Review、Needs Clarification、Direct Edit、Contextual AI Correction Drawer、Before/After Patch Review、Source Trace Drawer、Confirmed/Pending/Updated states。Sidebar 只画最低限度 shell，不设计整个产品。

## AG. MIGRATION PLAN

### STEP 1 — Candidate Import + Calibration

- 保留旧 stores/records/UI 可读。
- Additive 引入 CandidateContext、CandidateItem、CandidateProposal、CandidatePatch、ProcessingRun/Consent 最小合同。
- DeepSeek-first：一个真实 Resume，source→consent→states→proposal→cards→question/edit/AI patch→diff→confirm→persist→reopen。
- 旧 AI Markdown artifact 只作为 historical input/trace；不直接 parse-back 成 confirmed context，除非通过新 proposal/review。

### STEP 2 — Job Import + Review

- 复用 ProcessingRun/Consent/review grammar。
- 新增 JobSource、JobProposal、JobContext、Requirement；一个真实 JD 跑通 import→review→persist→reopen。
- 不做 match、score 或 material generation。

### LATER — Matching

- CandidateContext × selected JobContext → requirement judgments/evidence matrix。
- 真实 gap clarification 后输出 Minimum Necessary Change。
- Tailored Resume/Portfolio/Application generation 再单独 Gate。

## AH. ONE FIRST IMPLEMENTATION VERTICAL SLICE

唯一 first slice：

```text
ONE REAL RESUME PDF
→ local SourceDocument saved
→ user sees exact DeepSeek send/cost consent
→ persisted real ProcessingRun states
→ DeepSeek structured CandidateItem Proposal
→ local schema validation
→ Work + Project + Education Cards
→ one high-information question if needed
→ one Direct Edit (0 token)
→ one card-scoped AI Correction
→ Before / After / Why
→ user Confirm
→ CandidateContext v1 persisted
→ close / reopen
→ same confirmed Cards and provenance remain
```

不同时做 Portfolio，不迁移旧 CareerEntity，不做 Job，不做 Match。实现模型预期 `Terra Medium`。

## AI. ACCEPTANCE CRITERIA

1. 用户可配置/检查 DeepSeek，Key 不进入业务数据。  
2. 用户明确知道具体资料、Provider、目的和费用风险。  
3. UI 显示真实 processing states，无 fake percentage。  
4. AI 返回结构化 CandidateItem proposals。  
5. invalid/empty/malformed output fail closed。  
6. UI 渲染异构 Work/Project/Education Cards。  
7. 用户可快速判断“这是不是我”。  
8. 用户可查看 source/page/location。  
9. 用户可 Direct Edit，且无 AI call。  
10. 用户可用自然语言纠正选中 Card。  
11. AI Correction 只收到 task-scoped context。  
12. AI 返回 Patch，不静默覆盖。  
13. UI 展示 Before/After/Why。  
14. Accept/Edit/Reject 都可用。  
15. Confirm 后才进入 reviewed CandidateContext。  
16. Question answer 真正生成 Patch 并更新 context。  
17. AI inference 不自动变成事实。  
18. User Addition 有清晰 provenance。  
19. 关闭再打开，confirmed context/versions/source trace 仍存在。  
20. 用户不需要读 JSON 或填写 giant schema form。  
21. 默认 Card 简洁，Level 2/3 review 可展开。  
22. 任一 failure 明确 layer，并声明 confirmed context 未改变。  
23. 旧 CareerEntity/CareerEvidence/SourceDocument records 未丢失。  
24. token usage/cache status 可检查。

## AJ. RISKS / OPEN QUESTIONS

无阻塞架构问题。实现期只保留三项真实风险：

- DeepSeek account 当前是否仍返回可处理完整 Resume 的模型/交付方式；必须 preflight，失败则停在 Provider boundary，不静默换 Provider。
- 一个真实 Resume 是否足以暴露 Work/Project/Education Card 的最小字段；不足时只追加被真实失败证明的字段。
- IndexedDB 的 atomic patch/version transaction 与跨页面 App Shell 迁移需要 targeted regression；第一步不引入 backend DB 同步。

Figma 尚未连接是 implementation workflow 前置项，不改变语义架构；Git 尚未初始化是 release/governance 前置项，不改变 runtime contract。

## AK. NEW TRANSFERABLE KNOWLEDGE

- Card 可以是异构的人类校准界面，同时由最小 shared semantic core 支撑。
- source artifact、provenance、review status、confidence/uncertainty 是不同维度，不能合并成“可信度”。
- Patch-first correction 能同时保护用户 authority、减少 token、支持 diff 与版本冲突检查。
- Import workflow 与 durable library 是不同信息责任，适合分开导航但共享底层生命周期。
- Processing state 必须对应真实系统事件；可观察性不等于 fake percentage。
- Product code version 与 private user-data revision 必须由不同系统管理。

## AL. USER-OWNED EVIDENCE

本 Gate 记录为用户本人提出/确认的 Product、Architecture、AI Systems Judgment：

1. Local OCR + semantic mapping 实际人工修改超过约 70%，应重判责任而非继续加 parser rule。  
2. AI semantic understanding 不应被旧 Resume schema 限制。  
3. AI 识别后第一体验应是可读小 Card，不是 giant document/schema form。  
4. Card 是 Human Review/Human Calibration Surface。  
5. Work/Project/Education 允许不同 Card。  
6. progressive disclosure 同时支持快速扫描与完整 trace。  
7. 用户应能发现 AI misconception。  
8. 支持 Direct Edit 与自然语言纠正。  
9. 修改 Card 必须真实更新 Candidate Context。  
10. Direct Edit 不浪费 LLM token。  
11. AI Correction 返回 Patch + Diff，不重写全部 context。  
12. 用户是 Candidate Context 最终 authority。  
13. 产品不调查用户真实性，只约束 AI 不编造。  
14. Candidate 来自 Resume/Portfolio/Project/User Addition 等多 source。  
15. About Me 是 composite view，不是唯一 truth。  
16. 当前不需要 Capability Card。  
17. 用户自己选择 Target JD，产品不解释其动机。  
18. 主线是 Candidate Understanding→Calibration→JD Evidence Match→Minimum Necessary Change。  
19. 越匹配通常越少不必要修改，但修改数不等于 score。  
20. 不做 Career Mentor/职业心理。  
21. 多 JD 是基础能力，不是 differentiation。  
22. Reference-first 优先于为原创重复造轮子。  
23. Passit 是 downstream baseline。  
24. CareerStack/KarriereVault 用于减少 Candidate representation 重复设计。  
25. Figma 是 Card/Human Calibration UX 的正式设计 authority。  
26. Git 管代码；Candidate revision 管用户数据。  
27. GitHub 可同步代码，但不默认提交真实职业资料、Key、Candidate Context。  
28. 当前 sidebar 六项、Import/View 分离、AI 工作区作为 processing control surface。  
29. Candidate 与 Job 使用同一导入→AI理解→人工完善→Card persistence 逻辑。  
30. DeepSeek first，先把功能闭环做完整。

这些可作为用户 `L3 Design` 候选的产品/架构判断证据；是否升级仍需后续 explain-back、真实验收与取舍复现。

## AM. TOOL-ASSISTED WORK

本轮由 Codex 完成：仓库/数据/代码审计、reference 定向检索与比较、DeepSeek/Figma 官方能力核对、Candidate/Patch/Processing/IA/Git/Figma 合同整理、文档写入与一致性检查。没有生产实现。Python/JavaScript/schema/frontend/backend 能力不因此升级为用户独立能力。

## AN. RECOMMENDED NEXT MODEL

Architecture 经用户确认后：`Terra Medium` 用于 Step 1 Candidate Import + Calibration 的实现、真实 API integration、debug、tests 与 real-user acceptance。机械 docs sync 可用 Luna。若真实实现暴露会改变 Candidate truth/Provider/privacy 的新架构分岔，再回到 Sol。

---

Gate 完成边界：`PRODUCT ARCHITECTURE V2 FINAL CONSOLIDATION = COMPLETE / IMPLEMENTATION NOT STARTED`。
