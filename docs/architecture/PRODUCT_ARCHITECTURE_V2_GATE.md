# Job Radar｜Product Architecture V2 Gate

> 历史 Gate：已被 `PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md` 覆盖；保留用于追溯，不再作为 implementation authority。

- 日期：2026-08-25（Asia/Shanghai）
- Gate：`PRODUCT ARCHITECTURE V2`
- 模式：Major Product / AI Systems Architecture Review
- 最终决定：`ADOPT WITH CHANGES`
- 当前 Build：`PAUSED FOR V2 IMPLEMENTATION CONFIRMATION`
- 本轮边界：只做现状审计、产品/数据/责任架构与迁移决策；没有修改生产代码、schema、IndexedDB、SQLite、Provider、OCR 或前端。

## A. Job Radar V2 一句话定义

**Job Radar V2 是一个 local-first、evidence-grounded 的 Career Application Intelligence 工作空间：它把用户审核过的 Candidate Context 与真实 Job Requirements 进行可追溯比较，并帮助用户为具体职位更准确地准备投递材料。**

更短的产品心智模型：

```text
Understand Me
+ Understand the Job
+ Show the Difference
+ Help Me Apply Better
```

产品核心从 `Personal Career Intelligence / Career Mentor` 收缩为：

```text
Candidate Understanding
+ Job Understanding
+ Evidence-grounded Matching
+ Application Intelligence
```

## B. Product Scope：做什么 / 不做什么

### 做什么

1. 从 Resume、Portfolio、Project、Work History 等真实材料中理解 Candidate 的经历、角色、贡献、结果、ownership、限制与未知。
2. 把 AI proposal 呈现为可快速检查、纠正、补充和追溯来源的 Human Cards。
3. 将真实 JD 转为数量适中、可用于比较的 `JobRequirement[]`。
4. 对每条重要 Requirement 给出 Judgment、Candidate Evidence、Limitation、Difference Type 与 Application Action。
5. 为具体职位形成 `ApplicationDossier`，组织 Resume、Portfolio、Talking Points、Open Questions 与状态。
6. 未来基于 confirmed Evidence 选择、排序、压缩、展开和重新表达投递内容。

### 不做什么

- 不做长期陪跑型 Career Mentor、心理型职业导师或人生规划系统。
- 不推测用户为什么投某个职位，不把 observed behavior 当成 confirmed preference。
- 不做首页“问我任何职业问题”的 general chat。
- 不做 Job Board、大规模职位聚合器、generic match score 或自动申请工具。
- 不把 InterestSignal、CareerDirectionHypothesis 作为高频推理核心。
- 不重新打开 OCR/Provider benchmark，不启动 RAG、MCP、Skill、CLI、Agent 或 Vector DB。
- 不生成来源不存在的经历、指标、能力或 claim。

### 相比旧方向改变了什么

| 旧方向 | V2 决定 |
|---|---|
| Career Model / Career Direction 是主要终点 | Candidate Context 是可复用基础；具体 ApplicationDossier 是主要价值终点 |
| 从导入行为推导兴趣与方向 | 只保留轻量用户状态，不推测动机 |
| Local parser 的 typed CareerEntity 进入主理解链 | Local parser 降为 Document Extraction & Review；CareerEntity 退出 AI 主路径 |
| Card、schema、model output、database 接近同一表达 | Machine Context、reviewed truth、Human Cards 与 persistence contract 分离 |
| Career Model Control Center 汇总能力/兴趣/方向 | Job Detail 承担 Requirement → Match → Optimize；Applications 承担 Dossier |
| General career questions | 仅保留 object-bound contextual clarification |

## C. V2 Primary User Journey

### Flow A｜Build Candidate Context

```text
Add Resume / Portfolio / Project Material
→ choose Local extraction or explicit AI processing
→ AI Interpretation / Reviewed Local Source
→ human-readable Experience / Project Cards
→ correct / clarify / add user statement
→ Reviewed Candidate Context
→ confirmed CareerEvidence
```

### Flow B｜Understand a Target Job

```text
Existing JD record
→ one bounded understanding run
→ proposed JobRequirements
→ human review where material ambiguity matters
→ reviewed Job Requirement Context
```

### Flow C｜Compare

```text
Reviewed Candidate Context subset + confirmed CareerEvidence
↔ one reviewed JobRequirement set
→ MatchJudgment per requirement
→ strong / partial / evidence gap / expression gap / ownership limit / unknown
```

### Flow D｜Optimize

```text
Reviewed MatchJudgments
→ Resume actions
→ Portfolio actions
→ claim limits and open questions
```

### Flow E｜Prepare

```text
ApplicationDossier
+ confirmed Evidence
+ Target JD
+ supported Template contract
→ structured targeted content
→ human review
→ renderer / export
→ final human approval
```

## D. Current Architecture Problems

### D1. 实际仓库现状

当前不是一条统一 Career Intelligence 流，而是至少四条相邻但未闭合的责任链：

1. SQLite Job V0：`jobs / job_analyses → /api/jobs → index.html`。
2. Browser-local Job intake：`screenshot/text → candidate → review → IndexedDB jobs → local-jobs.html`。
3. Local Career ingestion：`SourceDocument → ExtractionRun → CareerEntity → review → CareerEvidence → CareerProfile`。
4. AI Career ingestion：`SourceDocument → AI Canonical Markdown → editable blocks → ai_career_profiles`。

Career Intelligence V0 只读取第 3 条的 confirmed CareerEvidence 与第 1 条的 SQLite Job list；它不读取第 4 条已接受的 AI Profile。因此“默认 AI-first Candidate Understanding”与“后续 Evidence/Intelligence”目前是两条断开的 truth chain。

### D2. 代码与数据证据

| 观察 | 实际证据 | 架构含义 |
|---|---|---|
| AI 与 Local 产物并行 | `public/career-evidence.js:12-14, 88-90` 分别保存 `ai_career_contexts`、`ai_career_profiles`、`career_intelligence`；Local 使用 `career_entities`、`career_evidence` | 缺少统一 Reviewed Candidate Context |
| AI Card 只是 Markdown section editor | `public/career-evidence.js:175-197, 213-230` | Card 还不是稳定 domain record，也没有 item-level correction provenance |
| AI 接受只生成 Profile | `public/career-evidence.js:780-805` | accepted AI understanding 不会生成 CareerEvidence，后续 matching 无稳定输入 |
| Local 固定字段很多 | `public/career-evidence.js:36-66` 与 `career_entity_v1.json` | 与用户报告的 >70% correction burden 一致，schema rigidity 是真实责任冲突 |
| Career Intelligence 仍围绕方向推理 | `public/career-evidence.js:564-603`、`career_intelligence_v0.json` | 与 V2 的具体申请价值优先级不一致 |
| 两套 Job persistence | SQLite `jobs` 当前 14 条；浏览器另有 `jobs` store 和独立 gallery | 正式 JD 与本地截图 Job 卡缺少明确主从/导入关系 |
| IndexedDB 版本分裂 | Career 页为 v7：`career-evidence.js:3-4`；职位导入/卡页为 v2：`local-first.js:2-3`、`local-jobs.js:1-2` | 访问 v7 后旧页面可能出现 `VersionError`；这是代码级风险，本 Gate 未做浏览器复现 |
| Processing state 不完整 | `career-evidence.js:200-210` 只有 idle/ready/sending/returned/failed | 没有持久化 ProcessingRun，也无法区分 Provider、Validation、Persistence failure |
| Consent 已有但信息不足 | `career-evidence.html:18-33` | 有两项显式确认，但确认文案没有把文件名、Provider、purpose、delivery representation 与 cost status 合并成一次可审核摘要 |
| Job analysis 基础不等于 JobRequirement | `job_analyses` 仅一条 mock 记录；当前合同是 role summary/capabilities | 尚无 reviewed `JobRequirement[]`、Match 或 ApplicationDossier |
| Applications 已有真实文件但产品无对象 | `04_career/applications/APP-001...`、`APP-002...` 存在；Job Radar 无 Application schema/UI | 真实用户价值已出现，产品模型尚未吸收 |

### D3. 真实 Pain / Failure 分析

- **>70% Local correction**：这是用户本轮提供的真实使用观察；应判断为 responsibility failure，不是继续加规则的理由。
- **Old schema rigidity**：固定 Resume fields 要求解析器先正确分类，再正确映射；任一层错误都会把可读原文变成错误 Career semantics。
- **AI UX**：当前已改善发送确认与返回可见性，但状态仍是页面内临时状态，失败只显示底层 error string。
- **Human Review**：Local 是逐字段重表单；AI 是 section textarea。前者负担过高，后者缺少 item identity、correction history 与 confirmed Evidence bridge。
- **Machine vs Human representation**：Canonical Markdown、review blocks 与 Profile 目前高度同构；Card 仍接近 Markdown 切片，而不是对 machine context 的独立可审阅 View。
- **Source of truth**：原文件、Local Entity、AI artifact、AI Profile、CareerProfile、CareerEvidence 都存在，但缺少一条明确的 reviewed truth contract。
- **Cost / retry**：accepted artifact cache 已存在，但失败 attempt 没有持久化 run identity；用户难以判断是否已经发生费用、是否安全重试。

## E. Candidate Understanding Architecture

### E1. Source-of-truth 决定

必须区分三个层次：

1. **Original Source = Source of Record**：原始 Resume / Portfolio / Project Material 永久保留，任何摘要不能替代它。
2. **Reviewed Candidate Context = Product Source of Truth**：经用户确认的 Candidate facts、roles、contributions、ownership、limitations、unknowns 与 user statements，是产品后续复用的正式候选人上下文。
3. **CareerEvidence = Reasoning Source**：从 reviewed context 中抽取、经确认且带 source refs 的 claim-level evidence，供 matching 和 generation 使用。

以下都不是单独的 source of truth：LLM output、CareerEntity proposal、Card UI、Profile Markdown、derived Capability label。

### E2. 最小责任模型

不采用八个都独立持久化的漂亮分层。V2 收敛为六类责任：

| 层 | 核心对象 | 责任 |
|---|---|---|
| Source | `SourceDocument`, `JobSource` | bytes/text/hash/location/provenance，不解释语义 |
| Run + Proposal | `ProcessingRun`, `AIInterpretationArtifact`, Local extraction output | provider/model/prompt/state/response/validation；只产生 proposal |
| Reviewed Candidate | `CandidateContextItem`, `CandidateReviewDecision`, `CareerEvidence` | 用户确认的 candidate meaning、ownership、unknown 与 claim evidence |
| Reviewed Job | `Job`, `JobRequirement`, `JobReviewDecision` | 真实 JD 与支持比较的要求语义 |
| Application Intelligence | `MatchJudgment`, `ApplicationAction`, `ApplicationDossier` | Requirement ↔ Evidence 比较和具体投递准备 |
| Views | typed cards、Job Detail、Dossier、contextual conversation | 展示与编辑，不拥有 truth |

### E3. `CandidateContextItem` 最小合同建议

```text
candidate_item_id
item_type: experience | project | education | capability_context | other
title
human_summary
facts[]
role / contribution / outcome / constraint / decision
ownership: user_owned | ai_assisted | shared | unknown
limitations[]
uncertainties[]
source_refs[]
source_type: source_derived | user_statement | mixed
review_status: needs_review | confirmed | rejected
version
created_from_artifact_id?
```

字段应 loss-minimized；没有来源的字段省略，不为了 schema 完整填空。它是 machine record，Human Card 只显示与当前 review 任务相关的子集。

## F. Human Card + Contextual Conversation

### F1. Card 是 View，也是 Review Surface

| Card | Source of truth | 主要内容 | 允许动作 |
|---|---|---|---|
| Material Card | SourceDocument / ProcessingRun | 文件、类型、来源、处理状态、是否外发 | 查看来源、重新处理、进入 Offline review |
| Experience / Project Card | CandidateContextItem | role、what you did、outcome、ownership、uncertainty | 修改、补充、对话、查看来源 |
| Evidence / Capability Card | CareerEvidence + derived boundary | claim、支持来源、ownership/limitation | 查看 Evidence、纠正 claim、标记缺证据 |
| Job Card | Job + requirement-analysis status | company、role、location、interest/application status | View |
| Match Card | MatchJudgment | Requirement、Judgment、Evidence、Limitation、Action | Why、纠正关联、补证据 |
| Application Card | ApplicationDossier | target job、ready items、open questions、material status | 继续准备、review、final approval |

禁止建立万能 Card schema。每类 Card 使用自己的 ViewModel，但都引用稳定 domain ID/version。

### F2. Contextual Conversation contract

Conversation 必须携带：

```text
context_object_type
context_object_id
context_version
user_intent: correct | add | clarify | explain | challenge
relevant_source_refs
```

AI 只能返回：解释、clarification question 或 proposed patch。任何 patch 都必须显示 before/after、来源类型和影响范围，经用户 Confirm / Reject / Edit 后才持久化。用户新增事实写为 `source_type = user_statement`，不能伪装成 source-derived evidence。

不提供 general Career Mentor chat，不自动带入全部 Career history、全部 JD 或全部 Applications。

## G. Question Policy

AI 可以问问题，只有当答案会显著改变以下任一项：

- claim 是否成立；
- ownership / AI-assisted boundary；
- outcome 或 source validity；
- Requirement match judgment；
- Resume / Portfolio 应突出什么；
- generated material 是否可能越过 claim boundary。

执行规则：

1. 每次最多提出 1–3 个最高价值问题。
2. 问题必须说明“回答会改变什么”。
3. 可选未知不阻塞主流程；保留 unknown。
4. 优先给 bounded choice，但允许 Other / 自由补充。
5. 已有 source 或 user-confirmed answer 不重复问。

AI 不应该问：职业人生动机、五年规划、为什么投了与既有方向不同的工作、泛偏好 onboarding，除非它直接改变当前 Application 的证据或表达。

## H. Canonical Candidate Context / CareerEvidence

### H1. 命名决定

- 对用户：`Candidate Context` / `我的经历与证据`。
- 对机器：可保留 `reviewed_candidate_context_v0` 作为合同名。
- `Canonical Career Context` 不再用于表达“已确认 truth”；现有 AI Markdown 应改称 `AI Interpretation Artifact`，避免 `canonical` 造成权威误解。
- 不为改名立即重构旧代码；先改变新对象责任与 UI 语言。

### H2. CareerEvidence 决定

`CareerEvidence = KEEP AS CORE`，但 V2 扩展来源：

```text
confirmed CandidateContextItem
→ one or more claim-level CareerEvidence
→ SourceDocument anchor and/or explicit user_statement provenance
```

每条 Evidence 至少保留：claim、evidence type、source refs、ownership、limitations、verification status、context item version。Evidence 不直接证明抽象 Capability；CapabilityBoundary 是基于多条 Evidence 的可解释派生。

## I. Offline V2

Offline 改名与定位为：**Local Document Extraction & Review**。

负责：

- 原文件保留、hash、native text、OCR、page/source anchors；
- `DocumentBlock / DocumentSection`；
- 简单阅读顺序、文本查看、人工纠错；
- reviewed local source text 与 export；
- 无 AI、无 API cost、never leaves device 的清晰边界。

不负责：

- 自动可靠判断 skill、career capability、project value、career direction；
- 自动 matching 或 application recommendation；
- 把 weak category mapping 写入正式 Candidate Context。

推荐流：

```text
Original Material
→ Local Extraction
→ ContentBlock / DocumentSection
→ Human Text Review
→ Reviewed Local Source
```

如果用户之后选择 AI：

```text
Original Source or Reviewed Local Source
→ new explicit consent
→ AI Processing
```

两者不默认串联；多模态材料优先发送 original source，Reviewed Local Source 可作为纠错补充，不应替代视觉信息。

## J. Job Understanding

当前 SQLite `jobs` 的 JD-001～014 继续作为正式 Job records，不重新寻找或录入。浏览器 `jobs` store 视为历史 local intake output，后续需通过显式 import/reconciliation 进入正式 Job repository，不能继续作为第二套同级 truth。

`JobRequirement` 应是 reviewed semantic object：

```text
requirement_id
job_id
requirement_type: responsibility | required | preferred | experience | domain | portfolio
statement
importance: material | supporting | unknown
source_refs[]
interpretation?
review_status
version
```

要求数量以支持比较为准，通常 6–12 条，而不是拆成几十条 atomic bullets。Role Purpose、Responsibilities、Required/Preferred、Experience、Domain、Portfolio Signals 可作为 view groups，不必全部成为 persistence layer。

## K. Evidence-grounded Matching

### K1. 核心 contract

```text
JobRequirement
→ MatchJudgment
→ CareerEvidence[]
→ Limitation
→ DifferenceType
→ ApplicationAction
```

建议 `MatchJudgment`：

```text
match_judgment_id
application_dossier_id
requirement_id
candidate_context_version
judgment: SUPPORTED | PARTIAL | MISSING_EVIDENCE | UNVERIFIED | SOURCE_AMBIGUITY
difference_type: CAPABILITY_GAP | EVIDENCE_GAP | EXPRESSION_GAP |
                 POSITIONING_GAP | OWNERSHIP_LIMITATION | UNKNOWN
evidence_ids[]
limitations[]
rationale
application_action?
review_status
```

### K2. Epistemic rules

- `MISSING_EVIDENCE ≠ MISSING_CAPABILITY`。
- `CAPABILITY_GAP` 只在存在用户确认的 limitation、明确反证或要求与现有能力边界直接冲突时使用；否则使用 Evidence Gap 或 Unknown。
- `AI-assisted Implementation ≠ Independent Engineering Capability`。
- `Interest ≠ Capability`。
- 不输出单一百分比作为主要判断；如果未来展示 score，它只能是次要导航，且必须可展开到逐 Requirement 证据。

## L. Application Optimization

所有建议必须沿一条可追溯链：

```text
JobRequirement
→ MatchJudgment
→ CareerEvidence
→ Material Action
```

Resume actions：`KEEP / MOVE_UP / MOVE_DOWN / SHORTEN / EXPAND / REWRITE / REMOVE / ADD_EVIDENCE`。

Portfolio actions：`SHOW / HIDE / REORDER / EXPAND / ADD_CONTEXT / ADD_OUTCOME / CLARIFY_OWNERSHIP`。

建议必须包含 target section、理由、引用 requirement/evidence、claim limitation。没有 Evidence 时可以建议“补充证据或解释未知”，不能直接生成事实。

## M. Personalized Resume / Portfolio Generation Decision

决定：**值得进入 roadmap，但在 Matching + ApplicationDossier 通过真实验收后再实现。**

### 模板策略

不直接修改用户原文件。采用 `D + C` 的顺序：

1. 先生成 grounded structured content；
2. 先提供 canonical neutral、ATS-readable Resume renderer；
3. 再为明确支持的用户 Template 建 adapter；
4. Portfolio 先生成 structured outline/content，交给用户模板或 external renderer；不承诺自动保留复杂版式。

| 方案 | 决定 | 原因 |
|---|---|---|
| A 直接修改原 Resume/Portfolio | 不采用默认 | 难回滚、格式和来源边界混乱、复杂 layout 风险高 |
| B 用户 Template | 后续支持 | 用户控制强，但必须先定义可解析模板合同 |
| C Job Radar neutral template | Resume 首选 renderer | ATS 可读、实现与验收范围可控；不适合作为 Portfolio 唯一方案 |
| D structured content → renderer | 核心架构 | 最易 grounding、diff、review、版本化与多 renderer |

任何 generated claim 都必须满足：

```text
GeneratedClaim → CareerEvidence → SourceRef
```

## N. Information Architecture V2

目标一级导航：

```text
CAREER
JOBS
APPLICATIONS
OFFLINE
SETTINGS
```

决策：

- 不设一级 `Overview`；当前没有需要聚合的跨区任务，避免空 Dashboard。
- `Career Model` 改为用户可理解的 `Career / 我的资料与证据`。
- Evidence 不设一级页面，作为 Career 内的可筛选视图与 Match 的证据入口。
- Applications 是 V2 一级产品区，但在第一个 `ApplicationDossier` 可用前不创建空导航项。
- Match 首先存在于 Job Detail；建立 Dossier 后同步出现在 Applications。

页面层级：

```text
Career
  ├─ Materials
  ├─ Candidate Context
  └─ Evidence

Jobs
  └─ Job Detail
       ├─ Overview
       ├─ Requirements
       ├─ Match
       ├─ Optimize
       └─ Create / Open Application

Applications
  └─ Application Dossier
       ├─ Match Summary
       ├─ Resume
       ├─ Portfolio
       ├─ Talking Points / Answers
       ├─ Open Questions
       └─ Status / Final Approval

Offline
  └─ Local Document Extraction & Review

Settings
  ├─ Providers / Credentials
  ├─ Privacy / Cost
  └─ Export / Backup
```

## O. Data / Responsibility Flow

### O1. Career Material AI Flow

```text
Original SourceDocument
→ AWAITING_CONSENT
→ ProcessingRun(provider/model/prompt/delivery)
→ AIInterpretationArtifact(needs_review)
→ typed Human Cards
→ correction / clarification / user statement proposal
→ CandidateReviewDecision
→ Reviewed CandidateContextItem
→ confirmed CareerEvidence
```

### O2. Offline Flow

```text
Original SourceDocument
→ Local ExtractionRun
→ DocumentBlock / DocumentSection
→ text/page review
→ Reviewed Local Source
→ export

optional later:
Reviewed Local Source + Original Source
→ new AI consent
→ AI Flow
```

### O3. JD Flow

```text
Existing Job + source JD
→ Job ProcessingRun
→ JobRequirement proposals
→ validation / targeted review
→ reviewed JobRequirement[]
```

### O4. Match Flow

```text
Reviewed JobRequirement[]
+ relevant CandidateContextItem[]
+ confirmed CareerEvidence[]
→ MatchRun
→ MatchJudgment[]
→ review / challenge / correction
→ Application Actions
```

### O5. Targeted Material Generation Flow

```text
ApplicationDossier
+ selected confirmed CareerEvidence
+ reviewed JobRequirements
+ reviewed MatchJudgments
+ Template contract
→ grounded structured content
→ GeneratedClaim validation
→ human review
→ renderer / export
→ final human approval
```

### O6. AI / Deterministic / Human responsibility

| Owner | 责任 |
|---|---|
| LLM | semantic understanding、requirement interpretation、match reasoning、gap classification、contextual questions、targeted rewriting |
| Deterministic system | IDs、hash、files、provenance、consent、provider config、states、validation、versions、cache、confirmed/rejected、grounding checks |
| Human | fact correction、ownership、claim approval、material selection、重要 Application 决策、final submit |

## P. Token / API Cost Strategy

### 只理解一次并缓存

- Resume/Portfolio：`source_hash + provider + model + prompt_version + delivery_version`。
- Reviewed Candidate Context：用户 correction 产生新 version，不自动重跑 source understanding。
- JD Understanding：`job_source_hash + provider + model + requirement_prompt_version`。
- Matching：`candidate_context_version + job_requirement_version + match_contract_version`。
- Optimization：`match_version + selected_evidence_ids + target_material + template_version`。

### 只发送 relevant subset

| Action | 发送上下文 |
|---|---|
| Card correction | selected card + source anchors + directly related items |
| Clarification question | one uncertainty + affected claim/match |
| Match one JD | relevant Candidate Context/Evidence subset + one JobRequirement set |
| Resume optimization | selected evidence + reviewed match + Resume structure/template |
| Portfolio optimization | selected projects/evidence + reviewed match + Portfolio structure |

禁止每次发送全部 Resume、Portfolio、全部 JD、全部 Career history。

### Cost / consent

每次外发前显示同一份可审核摘要：`WHAT file/representation → TO WHICH provider/model → WHY → COST known/unknown → cache/retry effect`。设置 API Key 不构成文件发送同意。

## Q. CareerEntity Decision

决定：**`DEPRECATE FROM AI MAIN FLOW / LEGACY-OFFLINE INTERMEDIATE / REPLACE LATER`。**

- 不删除现有代码、records 或 tests。
- Local fallback 可继续用 CareerEntity 作为 legacy projection/export。
- Offline V2 的正式输出优先是 `DocumentBlock / DocumentSection / Reviewed Local Source`，不要求 typed CareerEntity。
- AI main path 直接进入 `AIInterpretationArtifact → CandidateContextItem → CareerEvidence`。
- 新 Matching/Generation 不直接依赖 CareerEntity；只依赖 reviewed Candidate Context 与 CareerEvidence。

## R. Capability / Interest / Direction Objects Decision

| 对象 | V2 决定 | 新责任 |
|---|---|---|
| `CapabilityBoundary` | `KEEP + SIMPLIFY` | 作为 claim/ownership limitation 与 match guardrail；不是独立 mentor 页面 |
| `InterestSignal` | `SIMPLIFY / LIGHTWEIGHT METADATA` | 只记录 user-owned saved/interested/application state；不从导入行为推断长期偏好 |
| `CareerDirectionHypothesis` | `DEFER / REMOVE FROM MAIN FLOW` | 历史记录保留；不运行高 token direction loop，不作为主导航 |
| `OpenQuestion` | `KEEP + REDEFINE` | Material / Evidence / Match / Application clarification；必须说明会改变什么 |

现有 `career_intelligence` store 与 Control Center 保留为 legacy，不继续扩张；新主流程不读取其 direction proposal 作为 truth。

## S. Keep / Simplify / Deprecate

| 当前对象 / 模块 | 决定 | 说明 |
|---|---|---|
| SourceDocument | `KEEP AS CORE` | 原始 source of record、hash、Blob、provenance |
| DocumentBlock | `KEEP AS INFRASTRUCTURE` | Offline extraction/read/review；不承担 career semantics |
| Resume parser | `LEGACY / OFFLINE ONLY + SIMPLIFY` | 保留可用 extraction；停止作为 AI main path 前置 |
| Portfolio parser | `LEGACY / OFFLINE ONLY + SIMPLIFY` | 同上；不继续 benchmark-shopping |
| CareerEntity | `DEPRECATE FROM MAIN FLOW` | Local legacy intermediate；被 Reviewed Candidate Context + Evidence 取代 |
| CareerEvidence | `KEEP AS CORE` | claim-level、confirmed、grounded reasoning input |
| CapabilityBoundary | `SIMPLIFY` | claim/ownership guardrail |
| InterestSignal | `SIMPLIFY` | 仅 user-owned lightweight state |
| CareerDirectionHypothesis | `DEFER` | 退出主流程和高频推理 |
| OpenQuestion | `KEEP + REDEFINE` | contextual clarification only |
| AI Career Context Markdown | `KEEP AS AI INTERPRETATION ARTIFACT` | proposal/cache/provenance；不再称 confirmed canonical truth |
| AI Career Profile | `REPLACE LATER` | 过渡到 versioned Reviewed Candidate Context |
| Provider layer | `KEEP AS INFRASTRUCTURE` | provider/model/credential/delivery separation |
| Processing state | `SIMPLIFY THEN STRENGTHEN` | 使用真实可观察状态与 typed failure；不 fake progress |
| IndexedDB stores | `KEEP AS INFRASTRUCTURE + CONSOLIDATE` | 单一 DB version/repository module；additive migration，保留旧 records |
| SQLite jobs / JD-001～014 | `KEEP AS CORE` | 正式 Job repository；不重新录入 |
| Browser local jobs | `LEGACY / RECONCILE LATER` | 不再作为第二套正式 Job truth |
| job_analyses | `KEEP AS INFRASTRUCTURE / REPLACE OUTPUT LATER` | 可复用 run/validation 基础；V2 输出改为 JobRequirement |
| Career Model Control Center | `DEPRECATE FROM MAIN FLOW` | 保留历史；不继续做 direction reasoning |
| Review UI | `REPLACE LATER` | typed Human Cards + contextual correction |
| Offline UI | `SIMPLIFY / SEPARATE` | 独立 Local Document Tools 页面 |
| Jobs UI | `KEEP + EVOLVE` | Job Detail 成为 Match/Optimize 主工作面 |

## T. Migration Plan

最多三个 implementation milestones：

### Milestone 1｜Reviewed Candidate Context Bridge

把一份既有 AI Interpretation Artifact 转成 typed, human-readable Cards；记录 correction/clarification decision；确认后保存 versioned CandidateContextItem，并派生 CareerEvidence。旧 CareerEntity、JD、Evidence 均不迁移或删除。

### Milestone 2｜One Job Requirement + Evidence-grounded Match

选择一份已有高兴趣 JD；生成并审核 6–12 条 JobRequirements；用 Milestone 1 的 confirmed Evidence 形成逐 Requirement MatchJudgment，覆盖六类 difference type 与 failure cases。

### Milestone 3｜ApplicationDossier + Grounded Optimization

把一个 reviewed Match 保存为 ApplicationDossier；生成 Resume/Portfolio action plan。先输出 structured content/diff，不生成完整文档；随后再决定 neutral Resume renderer。

Offline 页面分离、旧 Control Center 隐藏与 IA 清理，只在上述 milestone 需要时做最小迁移，不单开大重构。

## U. ONE First Implementation Vertical Slice

选择：**`ONE EXISTING AI INTERPRETATION ARTIFACT → HUMAN CARDS → ONE CORRECTION → REVIEWED CANDIDATE CONTEXT → CAREEREVIDENCE`**。

不是直接选完整 Flow A，也不是先做 Matching。原因：当前最真实的痛点是 AI-first 结果仍停在 Markdown/Profile，Local fixed schema 又造成 >70% correction；如果 Candidate truth 没有闭环，后续 Match 只会把不稳定上下文放大。

### Slice 范围

1. 在同一浏览器 origin 选择一份已有 `ai_career_contexts` artifact；默认不发起新模型调用。
2. 将其 `## / ###` 结构转换为少量 Experience/Project/Other review cards；Card 是 View，不改变原 artifact。
3. 用户对一张卡做一次真实 correction，例如 ownership 从 unknown 改为 AI-assisted。
4. 保存 before/after、actor、source type、artifact/source refs 与 affected fields。
5. 用户确认卡后写入 additive `candidate_context_items` / `candidate_review_decisions`。
6. 只从 confirmed item 派生 CareerEvidence，并保留 source/user-statement provenance。
7. refresh 后恢复；原 AI artifact、CareerEntity、旧 Evidence、SQLite JD-001～014 不变。

### 验收

- 用户能快速指出 AI 理解对/错，而不是填完整 schema。
- 至少一条 ownership correction 可追溯且刷新后存在。
- 未确认 Card 不进入 Evidence。
- 缺 page/source ref 时 fail closed 为 `needs_review`，不生成 grounded Evidence。
- persistence 失败时：`Confirmed Candidate Context was not changed`。
- feature flag/新 store 可停用，旧流程仍可读取，具备回滚性。

### 必须覆盖的测试

- 正常：一 Project Card 确认并派生 Evidence。
- Failure：artifact 无稳定 item boundary；保留为 Other/needs_review，不猜项目。
- Failure：ownership correction 与原来源冲突；保存 mixed provenance，不覆盖原 source。
- Failure：写入事务失败；不产生半确认 context/evidence。
- Regression：SQLite 14 个 Job records、旧 CareerEntity/Evidence、accepted AI artifact 均未改变。
- Regression：统一 IndexedDB version，避免旧职位页 v2 打开 v7 database 的风险。

## V. Architecture Risks

1. **Artifact granularity**：当前 Markdown sections 不总能稳定切成 Experience/Project items；不得用脆弱 parser 假装已解决 semantic boundary。
2. **Cross-source merge**：同一项目可能出现在 Resume、Portfolio 和 user statement 中；需要 merge proposal，而不是自动合并 truth。
3. **Dual Job stores**：SQLite 与 browser jobs 的权威关系必须在 Matching 前收敛。
4. **Browser-local durability**：IndexedDB 缺少默认 backup/跨设备能力；local-first 不等于永久安全。
5. **Version drift**：Provider/model/prompt 变化会让旧 interpretation 与新 contract 不同；必须版本化而非静默覆盖。
6. **Review burden migration**：Card 不代表 review cost 自动下降；需测量修改 card 数、修改字段/claim 数和完成时间。
7. **Grounding illusion**：有 source ref 不代表 claim 就准确；source ambiguity 与 user correction 必须可见。
8. **Cost ambiguity**：Provider 未返回可靠价格时只能显示 usage 与 cost unknown，不能假装精确估价。
9. **Generated-material risk**：模板/renderer 很容易把选择与改写变成新 claim；必须先有 GeneratedClaim validator。
10. **Application privacy**：Resume/Portfolio 包含高敏信息；per-file/provider/purpose consent 和 no silent retry 是 hard requirement。

### Open Questions（进入实现前不阻塞本 Gate）

- 第一份 artifact 是否在当前常用 browser origin 中可访问；若不存在，是否由用户明确触发一次新 AI run。
- CandidateContextItem 第一版是否只覆盖 Project/Experience，还是需要 Education；建议先 Project + Experience + Other。
- user statement 的确认是否一次完成，还是需要独立 verification status；建议先保存 `confirmed_by_user`，不称 independent verification。
- ApplicationDossier 是否直接复用 `04_career/applications/APP-*` ID；建议先建立映射，不移动现有文件。

## W. New Transferable Knowledge

1. **Responsibility failure 与 accuracy failure 不同**：>70% correction 不一定要求更强 parser；它可能说明 parser 不应负责 semantic career modeling。
2. **Machine context、reviewed truth 与 Card 必须分层**：模型输出可以丰富，Card 可以简洁，但只有 review decision 能改变正式 context。
3. **Matching 不是一个 score**：可靠产品需要 Requirement → Evidence → Limitation → Difference → Action 的可解释链。
4. **Missing Evidence 是认识论状态，不是能力结论**：这会直接改变 gap taxonomy、question policy 和 generated claim boundary。
5. **Context efficiency 是产品架构**：版本化持久化 context 与 relevant-subset calls 同时改善成本、延迟、隐私和一致性。
6. **ApplicationDossier 是 bounded aggregate**：它比长期 Career Direction loop 更贴近用户任务，也更适合 Human-in-the-loop 与审计。

## X. User-owned Evidence

本 Gate 将以下内容记录为 **User-owned AI Product / Product Architecture Evidence**，不等同于独立软件工程能力：

1. 用户观察到 AI 理解后应先生成可快速检查的小卡片。
2. 用户定义 Card 同时是 misunderstanding review surface。
3. 用户把 Card conversation 收敛到补充、修改、纠错、ownership 与具体 uncertainty。
4. 用户定义问题必须降低 Evidence/Matching uncertainty，而不是做长 onboarding。
5. 用户拒绝系统推测“为什么投某职位”。
6. 用户把 token 与复杂度集中到 Candidate、Job、Match 与 Application Optimization。
7. 用户判断具体高兴趣 JD 比长期 Career Direction reasoning 更有直接价值。
8. 用户明确区分 Capability Gap、Evidence Gap、Expression Gap、Positioning Gap、Ownership Limitation 与 Unknown。
9. 用户提出 Template + Evidence + JD 作为未来 personalized material 路径。
10. 用户用 >70% Local correction 的真实观察触发 responsibility redesign，而不是继续堆规则。

证据等级：`User-owned Architecture Judgment / L2 Apply evidence candidate`。是否进一步支持 L3 Design，需要用户对本 Gate 的取舍、反例、第一 slice acceptance 与后续真实结果作出自己的解释和复审。

## Y. Tool-assisted Work

本轮以下工作属于 Codex / Tool-assisted，不升级用户独立 coding capability：

- 读取系统/项目 canonical context 与当前代码、schema、SQLite、UI、tests；
- 审计 SourceDocument、DocumentBlock、CareerEntity、CareerEvidence、AI Context、Provider、IndexedDB、Jobs 与 Control Center；
- 运行无 Provider、无 OCR benchmark 的离线合同/语法/回滚回归；
- 提出 V2 domain contracts、IA、data flows、keep/simplify/deprecate map 与三 milestone migration；
- 写入本 Architecture Gate 及增量维护文档。

没有生产实现、真实 Provider 调用、schema migration、前端重写或 Career data 修改。

## Z. Recommended Next Model

- Architecture Gate 用户确认后，第一个 implementation vertical slice：`TERRA MEDIUM`。
- 适用工作：additive browser persistence、Candidate Context cards、review decision、Evidence bridge、测试、真实用户观察与 targeted fixes。
- 纯文档同步/状态索引：`LUNA`。
- 只有出现新的重大 product responsibility 分歧、跨 milestone 架构冲突或 Terra 多轮无法解释的系统 failure，才回到 `SOL HIGH`。

## Final Decision

```text
PRODUCT ARCHITECTURE V2 = ADOPT WITH CHANGES
```

最终回答：

- **Job Radar 应该是什么？** Evidence-grounded Career Application Intelligence workspace。
- **不应该做什么？** 长期 Career Mentor、动机推测、general chat、generic score、自动申请与无来源材料生成。
- **Career data 的 source of truth 是什么？** Original Source 是 source of record；Reviewed Candidate Context 是产品 truth；CareerEvidence 是 reasoning truth。
- **AI 的责任是什么？** 理解、提案、比较、解释、提问和 grounded rewriting；不能自我确认或静默写 truth。
- **Human Card 的责任是什么？** 让用户快速读懂、发现误解、纠正、补充与追溯；Card 不是数据库 schema。
- **Job Matching 的核心 contract 是什么？** `Requirement → Judgment → Evidence → Limitation → Difference Type → Action`。
- **Personalized Application Material 是否值得进入 roadmap？** 值得；先 structured content，再 neutral/user-template renderer，且必须 GeneratedClaim → Evidence → Source。
- **第一条真正应该实现什么？** 现有 AI artifact 到 reviewed Candidate Context 与 CareerEvidence 的 Human Card bridge。

完成本 Gate 后停止；等待用户确认 Architecture，再开始实现。
