---
title: AI Job Radar Phase 4 Architecture & Reference Review
status: confirmed
date: 2026-08-24
confirmed: 2026-08-24
phase: Phase 4 pre-build architecture gate
scope: confirmed architecture contract; P4.1 implementation evidence is recorded separately
---

# AI Job Radar — Phase 4 Architecture & Reference Review

> 用户已于 2026-08-24 确认本文的四项核心 contract：domain model、SQLite/IndexedDB alternative-store 关系、P4.1→P4.4 顺序、Agent execution boundary。本文仍不是 Phase 4 closeout；P4.1 的实际实现与验证证据另见 `../history/P4_1_CAREER_EVIDENCE_CHECKPOINT.md`。

## 2026-08-24 Entity-first Amendment（当前 P4.1 权威）

外部源码审计与第一次产品验收发现，本文早期的 Candidate-CareerEvidence-first ingestion 会丢失 Work/Project 的 company、role、dates、location 与共同上下文。P4.1 当前 contract 已修订为：

```text
SourceDocument
→ ExtractionRun
→ typed CareerEntity
→ entity-level Human Review
→ Confirmed Career Model
→ selective CareerEvidence derivation
```

本修订只替换 Resume ingestion 与 review granularity，不推翻 IndexedDB/SQLite alternative-store、P4.1→P4.4 顺序、human-owned state 或 Agent execution boundary。本文后续凡将 `CareerEvidence` 描述为 Resume 的首个 canonical extraction record，均视为历史方案；当前实现与验收以 `../history/P4_1_CAREER_EVIDENCE_CHECKPOINT.md`、`../../data/domain_contracts/career_entity_v1.json` 和 `../../PROJECT_STATUS.md` 为准。Portfolio 仅建立 contract，不在 Resume milestone 实施完整解析。

## 执行结论

建议保持产品边界：

```text
Job Radar = Brain + Memory + Career Intelligence
External Agent / BrowserSkill = Hands + External Execution
```

Phase 4 不应从 scraper、MCP、RAG 或内部 Agent 开始。它应先把“我有什么可证明的职业证据”变成可审核、可追溯、可导出的本地数据，再依次建立 requirement-level matching、application workspace 和 portable Agent contract。

本轮架构判断：

- `CareerEvidenceStore` 是 Phase 4 的新核心边界；`CAREER_PROFILE.md` 只是其可读快照，不是唯一真相源。
- IndexedDB 是 browser-local 产品路径的首选 persistence；SQLite 保留为 reference/dev/test implementation。二者是同一 contract 的替代实现，不默认双向同步，也不互相静默覆盖。
- 原始文件、抽取文本、AI candidate、人工确认 evidence、派生 profile、职位事实、AI match、申请状态必须分层。
- 匹配的权威输出是 `JobRequirement ↔ CareerEvidence` 映射；总分只能是摘要。
- `application_status` 继续属于用户。`Applied` 不能只凭 Agent 自述，至少需要用户确认或真实 confirmation artifact。
- Phase 4 的 Agent 成功标准是可移植 context/result contract 被真实外部 Agent 使用一次，不是 Job Radar 自建 browser automation。

---

## A. Current Product State

### A1. 已验证的产品链路

截至 2026-08-24，当前代码与实际数据支持三条不同链路：

1. **SQLite-backed Job Registry**

   ```text
   14 local jobs
   → SQLite jobs
   → GET list/detail API
   → browser list/detail
   → user-owned application_status update
   ```

   实际 SQLite 为 14 条 jobs，其中 1 条 `application_status=applied`。现有 `jobs` schema 已分离 source evidence fields、JD lists 与 user-owned application status。

2. **Browser-local JD Intake**

   ```text
   link provenance + pasted text / 1–4 screenshots
   → local OCR or user-triggered DeepSeek vision
   → needs_review candidate
   → user confirm/discard
   → IndexedDB jobs
   → editable local gallery + JSON backup
   ```

   当前 IndexedDB 名为 `job-radar-local-first-v1`，只有 `jobs` 与 `candidates` object stores。确认职位会生成新的 local job ID；候选可放弃；备份当前只导出 jobs。

3. **Text JD Analysis Foundation**

   ```text
   SQLite JD
   → provider-independent input + separate instruction
   → deterministic Mock Provider
   → JSON/boundary validation
   → separate job_analyses(needs_review)
   ```

   实际 SQLite 只有 1 条 Mock `job_analyses(needs_review)`。DeepSeek text adapter 已编码，但没有保留的真实 text-analysis success record，也没有 analysis review API/UI。真实 DeepSeek 成功证据只属于 screenshot vision extraction，不可替代 text analysis proof。

### A2. 已经稳定、应保留的原则

- source facts、derived AI analysis 与 user-owned state 分离。
- `HTTP 200`、valid JSON、contract-valid、grounded、human-approved 是不同层级。
- 未知事实保持 `unknown` / `needs_review`，不由模型补猜。
- `application_status` 不被 source sync 或 model output 覆盖。
- Provider / Model / Credential 分离；DeepSeek 继续是当前唯一真实 Provider 路径。
- local-first / BYOK；credential 在 macOS Keychain，不进入前端源码、IndexedDB、备份或 Git。
- UI 只服务 workflow 验证，视觉精修继续延后。

### A3. 当前不是“已有能力”的部分

- 没有 Resume / Portfolio / Project document import。
- 没有 Career Evidence、Career Profile 或 claim-level provenance store。
- 没有 atomic JobRequirement、EvidenceMatch 或 ApplicationDossier。
- 没有真实 application event timeline、next-action engine 或 longitudinal career signals。
- 没有 portable Agent context、AgentTask / AgentResult contract 或 interoperability proof。
- 没有正式 Eval、RAG、MCP、内部 Agent、自动发现或自动投递。

本地依据：[`PHASE_3_FINAL_SYNTHESIS.md`](../history/PHASE_3_FINAL_SYNTHESIS.md)、[`PROJECT_STATUS.md`](../../PROJECT_STATUS.md)、[`TECHNICAL_EVIDENCE.md`](../../TECHNICAL_EVIDENCE.md)、[`NEXT_PHASE_HANDOFF.md`](../../NEXT_PHASE_HANDOFF.md)、[`data/schema.sql`](../../schema.sql)、[`app.py`](../../app.py)、[`public/local-first.js`](../../public/local-first.js)、[`data/job_radar.db`](../../data/job_radar.db)。

---

## B. Gap between Phase 3 and Final Product

| Product layer | Phase 3 actual | Phase 4 required | Gap type |
| --- | --- | --- | --- |
| Career source | JD link/text/screenshots | Resume, Portfolio, projects, PDF/DOCX/MD/TXT/paste | New input domain |
| Evidence | JD field/section evidence | Claim-level career evidence with source location, verification and limitation | New canonical data |
| Profile | None | Derived, reviewable CareerProfile + `CAREER_PROFILE.md` export | New derived view |
| Job understanding | Normalized JD + Mock analysis foundation | Atomic reviewed JobRequirement records | Productize analysis |
| Matching | None | Requirement-level Supported/Weak/Missing/Unverified mapping | New intelligence layer |
| Suggestions | None | Resume/portfolio/answer suggestions, each grounded in evidence | New bounded generation |
| Application | One current status field | Event history, dates, materials, notes, next action, feedback, outcome | New workflow model |
| Career feedback | None | Traceable repeated strengths/gaps/outcome signals | New longitudinal layer |
| External execution | None | Portable context + task/result import proof | New interface boundary |
| Persistence | Separate SQLite jobs and IndexedDB jobs/candidates | Versioned domain contracts with alternative store adapters | Architecture gap |
| Reliability | Syntax/regression + small AI failures | Workflow, contract, provenance and real-use regression per milestone | Evidence gap |

关键产品差距不是“缺少更多 AI”，而是缺少一条可靠链路：

```text
Raw Career Material
→ reviewable claim
→ confirmed career evidence
→ job requirement mapping
→ grounded suggestion
→ user action / external result
→ traceable feedback
```

旧 `NEXT_PHASE_HANDOFF.md` 中的 Automation Feasibility Gate 不被丢弃，但本轮用户请求已把顺序明确为 P4.1–P4.4。因此该 Gate 被吸收到本架构审查与 P4.4，不先于 P4.1 执行外部自动化 build。

---

## C. P4 Domain Model

### C1. 分层原则

```text
Immutable-ish Source
    SourceDocument / original Job evidence
                ↓ extract
Candidate / Review Layer
    Candidate CareerEvidence / JobRequirement
                ↓ human decision
Confirmed Domain Facts
    CareerEvidence / reviewed JobRequirement / user-owned ApplicationEvent
                ↓ derive
Intelligence Layer
    CareerProfile / EvidenceMatch / ApplicationDossier / NextAction
                ↓ package
Interoperability Layer
    AgentTask / AgentResult / AgentContextPackage
```

禁止让下游派生数据反向覆盖上游原始证据。修改 source 后应创建新 version 或使旧派生结果 stale，而不是静默改写历史结论。

### C2. Core entities

#### SourceDocument

代表用户导入的一份原始职业资料，而不是已经确认的能力事实。

```text
source_document_id
document_type: resume | portfolio | project_description | other
original_filename / pasted_text_label
media_type
content_hash
storage_ref
extracted_text_ref or extracted_text
extraction_method / version / status
imported_at
privacy_classification
```

规则：原文件或原文保留；抽取失败不删除 source；AI structuring 不能把 source 本身标成“已证实能力”。

#### CareerEvidence

代表一个可独立审核、可被职位要求引用的职业 claim。

```text
evidence_id
claim
evidence_type
capability_category
source_document_id
source_location
source_excerpt_or_reference
verification_status: needs_review | confirmed | rejected
confidence
limitations[]
created_at / updated_at
reviewed_at / review_note
```

设计要求：

- `claim` 与 `source_excerpt_or_reference` 分开；用户编辑 claim 时不改写原摘录。
- `confirmed` 只表示用户确认“资料支持这个 claim”，不等于外部机构认证。
- AI-assisted implementation 必须在 limitation 中保留责任边界，不能写成独立 coding evidence。
- rejected evidence 可保留最小 review record 用于 failure learning，但不得进入 profile/matching。

#### CareerProfile

由 confirmed CareerEvidence 生成的当前职业上下文快照。

```text
profile_id / profile_version
target_roles[]
verified_capabilities[] → evidence_ids[]
projects[] → evidence_ids[]
preferences / constraints
known_limitations[]
generated_at
source_evidence_set_hash
review_status
```

`CAREER_PROFILE.md` 与 `EVIDENCE.json` 是 export views。权威来源仍是 confirmed evidence records 与 profile version metadata。

#### Job

沿用现有 source facts 与 user-owned state 分离原则，并逐步把职责/要求从 JSON list 升级为可追溯 records。Job 继续保留原始 JD、source provenance、capture/freshness 与未知状态。

#### JobRequirement

把 JD 中一个可审核要求或职责表示为 atomic unit。

```text
requirement_id
job_id
requirement_type: qualification | responsibility | preference | constraint
text
source_location / source_excerpt
priority: required | preferred | unknown
verification_status
extraction_method / version
```

不能把“AI 推测这很重要”写成 JD 明示事实；priority unknown 是合法值。

#### EvidenceMatch

连接一条 requirement 与零或多条 career evidence。

```text
match_id
job_id / requirement_id
verdict: supported | weak | missing | unverified
evidence_ids[]
reasoning
limitations[]
confidence
method / model / instruction_version
review_status
created_at / reviewed_at
```

约束：

- `supported` / `weak` 必须至少引用一个 confirmed evidence ID。
- `missing` 表示当前证据集中没有找到支持，不等于用户绝对没有能力。
- `unverified` 用于 requirement 本身不清楚、source 不可靠或 candidate evidence 尚未审核。
- 单一 match score 如存在，必须由 requirement results 派生，且不能隐藏原始映射。

#### ApplicationDossier

一个 target job 的可追溯申请包视图，而不是不可审查的大段 AI 文本。

```text
dossier_id / version / job_id
job_analysis_ref
interest_signal
evidence_match_ids[]
capabilities / gaps / uncertainties
relevant_evidence_ids[] / relevant_project_ids[]
resume_suggestions[]
portfolio_suggestions[]
talking_points[]
application_answers[]
material_refs[]
current_status
next_action_id
review_status
```

每条 suggestion/answer 必须携带 `evidence_ids[]`、source references、limitations 与 review status。没有 evidence 的草稿必须明确标记 unsupported，不能进入 finalized material。

#### ApplicationEvent / Status

ApplicationEvent 是用户或外部系统发生的一次可追溯事件；current status 是事件流的派生/缓存结果。

```text
event_id / job_id
event_type: interested | preparing | applied | follow_up | interview | offer | rejected | closed | note | feedback
occurred_at / recorded_at
actor: user | external_agent | system
confirmation_status
confirmation_evidence_ref
notes
```

规则：

- Agent 可以提出 `applied` candidate event；只有满足确认策略后才进入 confirmed event/current status。
- 状态流不是不可逆直线。面试后仍可能 follow-up/rejected/closed；采用 event history 比只扩一个 enum 更可靠。
- 当前 `application_status` 可在迁移期作为 cached projection 保留，不能成为唯一历史记录。

#### NextAction

```text
next_action_id / job_id
action_type
reason
due_at
priority
source_state_refs[]
status: proposed | accepted | done | dismissed
generated_by: deterministic_rule | model | human
```

优先用确定性规则生成候选，例如 overdue follow-up、临近面试、未完成材料。模型可以解释和排序，但不能发信、投递或改变状态。

#### AgentTask / AgentResult

AgentTask 表达 Job Radar 希望外部 Agent 完成的 WHAT / WHY / CONTEXT；AgentResult 表达执行后可导入的结构化结果。

```text
AgentTask
  task_id / contract_version / created_at
  task_type
  goal
  target_job_refs[]
  context_package_version / context_hash
  allowed_actions[] / forbidden_actions[]
  required_human_approval[]
  result_schema_version

AgentResult
  task_id / contract_version
  execution_status
  source_capabilities_observed[]
  candidate_jobs[] / application_events[]
  evidence_artifacts[]
  human_approval_records[]
  errors[] / limitations[]
  started_at / finished_at
```

输入 package 和返回 result 都必须版本化、校验、可拒绝。AgentResult 不是自动可信事实；导入后仍要通过 source/evidence/application boundary。

### C3. Supporting models

为避免核心实体承载过多责任，P4.1 可保留少量 supporting models：

- `DocumentExtraction`：原始抽取文本、页码/段落映射、工具版本、失败。
- `ReviewDecision`：approve/edit/reject、actor、time、before/after 与理由。
- `AgentContextPackage`：一组 export files 的 manifest、schema versions 与 hashes。

不建议在 P4.1 一次创建全部表；先实现 SourceDocument、CareerEvidence、ReviewDecision、CareerProfile snapshot 所需最小集合，其余按 milestone 增量加入。

---

## D. Persistence Architecture

### D1. 目标结构

```text
Domain contracts + state-transition rules + shared fixtures
                         │
             CareerEvidenceStore port
                    ┌────┴────┐
                    │         │
          IndexedDB adapter   SQLite adapter
          browser-local       reference/dev/test
                    │         │
          browser instance    local Python runtime
```

`ModelProvider`、`JobSource`、`AgentInterface` 与 persistence port 独立；例如换 DeepSeek model 不改变 CareerEvidenceStore，换 IndexedDB/SQLite 不改变 evidence review 规则。

### D2. 避免重复 product logic 的方法

1. 建立 versioned language-neutral contracts（建议未来放在 `data/domain_contracts/`）：JSON Schema、状态迁移表、normal/failure fixtures。
2. 把当前散落在 `local-first.js` 的 review/domain transformation 拆成纯 domain functions；IndexedDB adapter 只做 `get/put/list/transaction`。
3. SQLite adapter 主要用于 reference API、migration、contract/regression；不复制一套独立的 Phase 4 UI business flow。
4. 对两个 adapter 跑同一 fixture suite：相同 input、review decision 与 export 应得到相同 domain record shape。
5. 不做自动双向 SQLite ↔ IndexedDB sync。需要迁移时使用显式、版本化 export/import，并显示 conflict。

### D3. IndexedDB role

建议在确认后将 browser DB 升到新版本，逐步增加 stores；精确 schema 由每个 milestone 冻结，而不是本轮一次建完。P4.1 最小 stores：

```text
source_documents
career_evidence
review_decisions
career_profiles (snapshots)
jobs / candidates (existing, migrated carefully)
```

原始 PDF/DOCX/MD/TXT 或 pasted text 应以 Blob/text + content hash 保存在 browser-local store。若本机 `app.py` 协助 extraction，处理结果返回浏览器；Python filesystem/SQLite 不应在不提示的情况下成为另一个 source of truth。

### D4. SQLite role

SQLite 继续承担：

- 现有 14 jobs、source evidence 和 Mock analysis 的历史 reference/test asset；
- domain contract 的 reference persistence 与 API regression；
- 本地开发时查看 schema、transactions、migrations 与 failure；
- 如果未来需要 local desktop backend，可作为实现候选，但不能默认升级为 SaaS/server truth。

### D5. Export / recovery contract

现有 JSON backup 只导出 jobs，Phase 4 必须升级为版本化 package：

```text
manifest.json
source_documents metadata + blobs/references
career_evidence.json
career_profile.json / CAREER_PROFILE.md
jobs.json
application data (when available)
schema_versions
content hashes
```

P4.1 的真实 persistence 验收必须包含：save → refresh → confirmed evidence remains → export → clear in disposable test store → import → same IDs/hashes/confirmed claims。正式用户数据不用于破坏性测试。

### D6. Conflict and migration rules

- ID 稳定；import 不因相同 claim 文本自动合并不同 source evidence。
- 同 ID + same hash 可 idempotent；同 ID + different hash 必须 conflict review。
- schema migration 失败时保留旧 DB 与可导出的原始记录，不做 silent partial migration。
- profile/matches/dossiers 保存生成时使用的 evidence-set hash；上游 evidence 变化后标记 stale，等待重算/复审。

---

## E. Reference Pattern Matrix

下表只借 pattern，不复制 architecture 或代码。2026-08-24 本轮未 clone、安装或复用任何第三方项目，因此没有源码 attribution 变更；若未来复用具体代码，必须另行核对 license、版本与 notices。

| Reference | 已核对的 pattern | Job Radar 借用 | 明确不借用 | Source |
| --- | --- | --- | --- | --- |
| Simplify | 一个 profile 驱动 matching、tailoring、autofill 和 tracking；tailored resume 可审核、保留原版 | 一份 confirmed Career Profile 驱动多个下游；建议先 review | 不复制大规模 job board/autofill 覆盖，不以自动表单为核心 | [Simplify onboarding](https://help.simplify.jobs/articles/0738509-signing-up-for-simplify)、[resume tailoring](https://help.simplify.jobs/articles/0515607-auto-tailoring-your-resume-with-copilot) |
| Teal | Job Tracker 作为 single source of truth；extension capture + manual add；保存完整 JD；状态、follow-up、notes | Tracker/workspace 是申请真相中心；unsupported source 有 manual import | 不复制 extension/site coverage；不把 tracker status 当 external fact | [Teal tracking guide](https://help.tealhq.com/en/articles/14435727-how-to-track-your-job-applications)、[Job Tracker](https://www.tealhq.com/tools/job-tracker) |
| Huntr | requirements/responsibilities 的 Covered/Not Covered 解释；支持 semantic match；每个 job 有 application packet | requirement-level EvidenceMatch + linked dossier；分数从明细派生 | 不采用“分数即真相”；不生成虚构 achievement | [Huntr Match Score](https://help.huntr.co/en/articles/12241684-job-match-score)、[Application Packets](https://help.huntr.co/en/articles/14367332-application-hub-and-packets) |
| Careerflow | centralized tracker、reminders、status/analytics、skill match；实际申请可跳转外部站点；应用后仍需确认 | central workspace + next action + feedback；external execution 与 internal tracking 分开 | 不复制一体化 SaaS、LinkedIn optimization 或大量 dashboard | [Careerflow Job Tracker](https://help.careerflow.ai/en/articles/8936729-getting-started-job-tracker)、[Job Portal](https://help.careerflow.ai/en/articles/11525851-getting-started-job-portal) |
| TadMSTR/jobsearch-mcp | profile → search → detail → score → track 的模块化 flow；profile parse 先返回 review；optional services 未配置时明确失败；多级 JD enrichment | modular ports、review-before-save、capability degradation、清楚 failure | 不复制 Postgres/Qdrant/Valkey/Docker/background poller；不默认 MCP/semantic stack | [GitHub repository](https://github.com/TadMSTR/jobsearch-mcp) |
| privacydied/job-application-skill | per-source adapters/recipes；local personal context；target-role screening；on-profile-only；`Applied` 需要 confirmation artifact | source capability matrix、truthful profile boundary、confirmation evidence、local files | 不内置 anti-detect/browser drivers、数十站点维护或 blind submission | [GitHub repository](https://github.com/privacydied/job-application-skill) |
| FoundRole jobs-mcp-proxy | assistant-facing search/detail/track/reminder tools；read/search 与 authenticated writes 分层 | future AgentInterface 的任务粒度与 read/write boundary | Phase 4 不先做 MCP、OAuth service 或 remote SaaS backend | [GitHub repository](https://github.com/foundrole/jobs-mcp-proxy) |
| Tencent BrowserSkill | shell-capable Agent 通过本地 bridge 使用已登录浏览器；agent-independent；captcha/login/confirmation 可人工接管 | 把真实浏览器执行留给外部层；记录 takeover/confirmation | 不重建 browser extension/CLI，不把安装它作为 P4 成功条件 | [BrowserSkill README](https://github.com/Tencent/BrowserSkill/blob/main/README.md)、[Skill contract](https://github.com/Tencent/BrowserSkill/blob/main/skill/SKILL.md) |
| YuJunWang/104-job-hunter-mcp | source-specific API search、browser detail、persistent local session、final submit human approval | 一个 source 的 capability 可来自不同 mechanism；final submit 由人 | 不复制 104 特定逻辑、stealth/browser profile 或 MCP server | [GitHub README](https://github.com/YuJunWang/104-job-hunter-mcp/blob/main/README.md) |
| JSON Resume | portable JSON resume schema、validation 与 ecosystem interchange | profile export 可参考标准字段；保持 portable contract | 不把 resume schema 当 evidence/provenance schema；不能代替 CareerEvidence | [JSON Resume](https://jsonresume.org/)、[schema definition](https://jsonresume.org/docs/013-schema-definitions) |
| Reactive Resume | privacy/control、self-hosting、JSON import/export、保留用户数据所有权 | local-first export/import 与可移植资料的产品原则 | 不复制 resume builder UI、Postgres/Auth/storage stack | [GitHub repository](https://github.com/AmruthPillai/Reactive-Resume) |

### E1. Synthesized reference decisions

1. **One reviewed evidence base, many derived views.** Simplify 的 one profile pattern 可用，但 Job Radar 需要更强 provenance：profile 只从 confirmed evidence 派生。
2. **Tracker is truth for user workflow, not source truth.** Teal/Careerflow 的中心 tracker 有价值；职位来源事实与用户 application event 必须分开。
3. **Requirement-level explanation is authoritative.** Huntr 的 covered/not-covered 模式最贴合 P4.2，但用 Job Radar 的 Supported/Weak/Missing/Unverified 与 evidence IDs 替代只看分数。
4. **Capability degradation is architecture, not failure.** source 支持 search/read/import/apply 的能力不同；manual import 与 external agent 是正式 fallback。
5. **Execution belongs outside the brain.** BrowserSkill/104/job-application-skill 证明 real browser + human takeover 是独立 execution concern；Job Radar 只提供 context、constraints 和 result contract。

---

## F. P4.1–P4.4 Architecture

### P4.1 — Career Evidence Foundation

**System problem：** 当前 Job Radar 只有职位证据，没有可信、可计算的“用户能力证据”。直接做 match 会迫使模型从简历段落临时猜测，无法稳定回答 “Why do we believe this?”。

**Smallest meaningful architecture slice：**

```text
1 Resume or project text/PDF
→ SourceDocument saved locally
→ deterministic text extraction with location map
→ AI or rules propose 3–8 CareerEvidence candidates
→ approve / edit / reject
→ confirmed CareerEvidence saved
→ refresh persistence check
→ CAREER_PROFILE.md + EVIDENCE.json export
```

输入优先级：TXT/Markdown/pasted text 先证明 contract；PDF/DOCX 在同一 milestone 内通过 adapter 加入，不让文件解析阻塞 evidence lifecycle。扫描 PDF 需要 OCR 时明确降级并保留页图/页码。

AI responsibility：从原文提出结构化 candidate、分类、可能 limitation。Deterministic responsibility：file/hash、text extraction、schema validation、state transition、persistence、export。Human responsibility：approve/edit/reject 与最终 claim wording。

P4.1 Exit evidence：

- real Resume + one selected project/portfolio material；
- 每条 confirmed evidence 可回到 document + location/reference；
- approve/edit/reject 三条路径均跑过；
- refresh 后仍存在；
- export/import 在 disposable test store 恢复相同 IDs/hashes；
- `CAREER_PROFILE.md` 可读且与 `EVIDENCE.json` 一致；
- normal + extraction failure + unsupported claim regression。

### P4.2 — Evidence-grounded Matching & Application Intelligence

**System problem：** “像不像”或一个百分比分数不能区分兴趣、真实能力、证据不足与缺口。

```text
confirmed Job
→ reviewed atomic JobRequirements
+ confirmed CareerEvidence
→ candidate EvidenceMatches
→ contract validation
→ human review
→ ApplicationDossier
→ grounded resume/portfolio/answer suggestions
```

第一版 matching 不需要向量数据库。建议：

1. deterministic metadata/keyword shortlist evidence；
2. 把全部 confirmed evidence 或 shortlist 放入 direct context；
3. 模型只返回 requirement_id、verdict、evidence_ids、reasoning、limitation；
4. 本地 validator 检查 ID、状态和 evidence boundary；
5. 用户抽查/纠正关键 requirements。

P4.2 Exit evidence：至少一个真实 JD 的全部关键 requirements 可见；Supported/Weak/Missing/Unverified 都有真实或受控案例；所有 suggestion 都能回到 evidence/source；interest 与 capability 分开展示；错误 evidence mapping 会被拒绝或标成 needs_review。

### P4.3 — Career Workspace / Career Copilot

**System problem：** 一个 status 字段无法表示准备、材料、follow-up、面试、反馈与下一动作，也无法提供长期职业反馈。

```text
ApplicationEvent history
→ current status projection
+ dossier/material/due dates/feedback
→ deterministic NextAction candidates
→ optional model explanation/ranking
→ user accept/done/dismiss
```

先验证最小 lifecycle：Interested → Preparing → Applied → Follow-up → Interview → Offer/Rejected/Closed。状态根据真实使用调整，不先追求覆盖所有招聘流程。

Longitudinal signals 只从可追溯 records 聚合：重复要求、重复证据缺口、重复优势、面试/拒绝反馈。没有足够跨 job data 时返回 `insufficient_evidence`，不生成漂亮但无依据的趋势。

P4.3 Exit evidence：一个真实 application 从 interest/preparing 进入至少一个后续 confirmed event；next action 可解释其 source state；overdue/complete/no-action 三个分支；feedback 可回溯且不会覆盖 CareerEvidence。

### P4.4 — Agent Interface & Automation Gate

**System problem：** 外部 Agent 若每次读取散乱文件并自由解释，很容易丢失边界、使用过期资料或误报执行结果。

先导出：

```text
job-radar-agent-context/
  manifest.json
  CAREER_PROFILE.md
  EVIDENCE.json
  SEARCH_CRITERIA.md
  TARGET_ROLES.md
  EXCLUDE_RULES.md
  ACTIVE_APPLICATIONS.json
  AGENT_INSTRUCTIONS.md
  AGENT_TASK.schema.json
  AGENT_RESULT.schema.json
```

然后做一次真实、低风险 interoperability test：让一个 shell-capable external Agent 使用 package 完成只读职位发现或 prepare-only task；如果站点需要浏览器，由外部 BrowserSkill 层执行；结果按 AgentResult import，仍进入 candidate/review。

#### Preliminary automation decision matrix

| Capability | User value | Required data | Deterministic / AI role | Human approval | Main risk/fallback | Phase 4 decision |
| --- | --- | --- | --- | --- | --- | --- |
| Discovery | medium；减少重复搜索 | search criteria + source capability | rules filter；Agent/source search | import review | access/ToS/stale JD；manual import | P4.4 interoperability proof only |
| Matching | high；决定是否投入申请 | reviewed JD requirements + confirmed evidence | rules shortlist + model mapping | review key matches | overclaim/missed evidence；show Unknown | P4.2 core MVP |
| Resume/Portfolio Suggestion | high，但依赖 matching | confirmed evidence + dossier | model draft + deterministic citation validation | every final edit | fabrication/exaggeration；reject unsupported | P4.2 after match |
| Application execution | medium convenience, highest risk | approved materials + site/account | external Agent/browser | final submit always human | login/captcha/false submit/terms；prepare-only | not a native Phase 4 build |

这张表选择的第一个 intelligence MVP 是 **Evidence-grounded Matching**，但它必须建立在 P4.1 confirmed evidence 上。外部 automation 的第一 proof 只做 discovery/import 或 prepare-only，不做 blind submit。

P4.4 Exit evidence：package 可由另一个 Agent 独立读取；input/result hashes 和 versions 可核对；一个 structured result 成功 import；一个 invalid/stale result 被拒绝；source capability 与 human approval 可见。

Gate 输出在 P4.4 closeout 才正式判定：

- `RAG = USE / DEFER / NOT JUSTIFIED`
- `MCP = USE / DEFER / NOT JUSTIFIED`
- `INTERNAL AGENT = USE / DEFER / NOT JUSTIFIED`

当前 pre-build 状态仍是 `NOT YET JUSTIFIED`，不是 Phase 4 最终结论。

---

## G. Golden Path

```text
[Human imports Resume + Portfolio/Project]
              │
              ▼
[SourceDocument + immutable reference/hash]
              │ deterministic extraction / explicit OCR fallback
              ▼
[Candidate CareerEvidence]
              │ AI proposes; schema validates
              ▼
[Human approve / edit / reject]
              │
              ▼
[Confirmed CareerEvidenceStore]
              │ derives, never replaces evidence
              ▼
[CareerProfile + CAREER_PROFILE.md export]
              │
              ├───────────────┐
              ▼               │
[Real JD + provenance]        │
              │               │
              ▼               │
[Reviewed JobRequirements] ◄──┘
              │
              ▼
[Requirement ↔ EvidenceMatch]
              │ unsupported/ambiguous remains visible
              ▼
[ApplicationDossier]
              │ every suggestion cites evidence
              ▼
[Human-reviewed materials + Application workspace]
              │
              ▼
[ApplicationEvent → NextAction → Feedback]
              │
              ▼
[Versioned Agent Context + AgentTask]
              │
              ▼
[External Agent / BrowserSkill when needed]
              │ structured result + artifacts + approval record
              ▼
[AgentResult validation → Human Review → Job Radar update]
```

失败分支必须保留：unsupported file、empty extraction、AI non-JSON、unknown source location、unconfirmed evidence、stale profile, invalid evidence ID、browser access failure、captcha/login、user cancels submit、Agent claims success without confirmation、IndexedDB quota/clear、export version conflict。

---

## H. Major Risks

| Risk | Why it matters | Architecture response | Proof needed |
| --- | --- | --- | --- |
| SQLite / IndexedDB dual truth | 同一 job/profile 可能分叉 | alternative adapters；无自动 sync；versioned explicit import/export | same fixtures; visible conflicts |
| PII / career document leakage | Resume/portfolio 高敏感 | local Blob/text storage；explicit model send；data minimization；Keychain | inspect request payload + backup |
| Provenance drift after edits | 改写 claim 后可能失去原文支持 | original excerpt immutable；review before/after；content hash/version | edit evidence and trace back |
| AI overclaim / fabricated metrics | 直接损害求职可信度 | confirmed evidence IDs required；unsupported rejected；limitations visible | adversarial fixture |
| PDF/DOCX/OCR extraction loss | 页面、表格、扫描件会丢信息 | page/paragraph location map；fail closed；original retained | normal text + scanned failure |
| Ambiguous JD requirement | 模型会把偏好/职责变必需项 | requirement source excerpt + priority unknown + review | ambiguous fixture |
| False `Applied` | Agent/redirect 不等于提交成功 | append-only event + confirmation artifact/user approval | claimed success rejected |
| Browser storage loss/quota | local-first 把 durability 责任交给设备 | backup reminder、versioned export、recovery test、quota error | refresh/export/import/clear test |
| Derived data staleness | Evidence 更新后 profile/match 仍旧 | evidence-set hash + stale state + re-review | update upstream evidence |
| Source/Agent capability drift | 站点、登录、API 随时变化 | capability matrix + observed_at + manual fallback | one degraded source case |
| Contract/version drift | 外部 Agent 可能返回旧格式 | manifest, schema version, hash, strict import | invalid/stale result fixture |
| Premature retrieval stack | 小数据量引入 RAG 增加复杂度 | direct context baseline + retrieval triggers | measured recall/noise/cost issue |
| Review overload | 每条 evidence/match 都审会失去价值 | atomic claims、batch review、risk-based priority；不自动放行 | measure edit/reject/time |
| Existing text analysis mistaken as proven | 已编码 adapter 容易被写成完成 | status remains unproven until retained real result + review UI | separate real text slice if needed |

---

## I. What NOT to Build

Phase 4 明确不把以下内容作为成功条件：

- Universal Job Scraper 或 native LinkedIn/BOSS scraper；
- 内置/重建 BrowserSkill 或维护数十 ATS recipes；
- blind auto-submit 或 Agent 自述即 `Applied`；
- 在证据库尚未形成前做 match score；
- 只输出百分比而隐藏 requirement-level evidence；
- 把兴趣信号写成能力 evidence；
- 把 AI-assisted implementation 写成用户独立 coding evidence；
- MCP before portable file contract friction is proven；
- RAG/vector DB before direct context/filter/keyword baseline fails；
- internal Agent before dynamic planning/state/retry ownership is proven；
- SaaS multi-tenant backend、账号系统、云同步；
- large multi-provider expansion；
- SQLite 与 IndexedDB 自动双向同步；
- major UI branding/animation/responsive polish；
- 大型 analytics dashboard 或无可追溯数据的 career trend；
- 一次性创建 P4.1–P4.4 全部 schema/UI/code。

---

## J. ONE NEXT ACTION

**Gate outcome（2026-08-24）：用户已确认本文的四项核心 contract——domain model、SQLite/IndexedDB alternative-store 关系、P4.1→P4.4 顺序、Agent execution boundary。**

P4.1 的第一个 meaningful slice 已按该 contract 实现：

```text
1 份真实 Resume 或项目材料
→ SourceDocument
→ 3–8 条 Candidate CareerEvidence
→ approve / edit / reject
→ confirmed local evidence
→ refresh
→ CAREER_PROFILE.md + EVIDENCE.json export
```

当前唯一下一动作是用户在 `career-evidence.html` 审核真实履历生成的 7 条候选，然后导出第一份 confirmed-only `CAREER_PROFILE.md` 与 `EVIDENCE.json`。P4.2 在该动作前不启动；Model Provider、BrowserSkill、RAG、MCP 与内部 Agent 均不加入本切片。

---

## Confirmed Architecture Checklist

用户已确认以下四个产品判断：

1. 你是否同意“原始资料 → candidate evidence → 人工确认 evidence → profile”是职业事实主链？
2. 你是否同意 IndexedDB 与 SQLite 是替代实现，不自动同步成两个真相源？
3. 你是否同意 P4.2 的权威结果是每条 requirement 的 evidence mapping，而不是总分？
4. 你是否同意 Job Radar 只提供 WHAT/WHY/CONTEXT，真实网站操作留给外部 Agent，最终 submit 永远由人确认？

若未来证据要求修改其中一项，只需版本化对应 contract，不需要重做 Phase 1–3。当前实现和验证记录见 `../history/P4_1_CAREER_EVIDENCE_CHECKPOINT.md`。
