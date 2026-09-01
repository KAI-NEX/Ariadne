# Ariadne Runtime / Local / AI Execution Contract

> **STATUS:** HUMAN REVIEWED / ARCHITECTURE FROZEN FOR SLICE 1
>
> **BASELINE:** `4f764ef6d4f763f1b89f5123f236ddb026738e2f` (`refine: simplify provider help links`)
>
> **PHASE:** Runtime / AI Architecture
> **DOCUMENT DATE:** 2026-09-01

## 1. Status and Authority

### Human Review 状态

- Architecture Human Review：`PASS`
- 本合同冻结后续 Slice 1 所依赖的 Runtime / Local / AI 产品与执行边界。
- UI Stabilization phase 已关闭；本合同开启 Runtime / AI Architecture phase。

### Authority

This document is the canonical Runtime / Local / AI execution contract for Ariadne.

If later implementation notes, old docs, demo behavior, or Codex thread memory conflict with this document, this document wins unless the user explicitly opens a new product/architecture decision.

中文权威规则：如果后续 implementation note、旧文档、demo 行为或 Codex thread memory 与本合同冲突，以本合同为准；只有用户明确重新开启产品或架构决策时，才允许修改已冻结规则。

### Implementation status disclaimer

本合同同时包含两个必须分开的层次：

- **当前现实（CURRENT REALITY）：** baseline commit 上实际执行的行为。
- **目标合同（TARGET CONTRACT）：** 后续 12 个 implementation slices 必须实现并验证的权威行为。

`HUMAN REVIEWED` 与 `FROZEN FOR SLICE 1` 不表示本文描述的目标行为已经全部实现。当前 Candidate/JD import、Model Runtime 与 AI Conversation 仍有不合规路径，必须按本合同逐 Slice 替换。

## 2. Product Scope

### Ariadne core

```text
Candidate Understanding
+
Job Understanding
→ Evidence-grounded Difference
→ Minimum Necessary Change
→ Application Optimization
```

Ariadne 是 Web-first、Local-first、BYOK、evidence-grounded 的 Personal Career Intelligence Layer。长期资产是用户确认的 CandidateContext、JobContext 及其可追溯 revision，而不是一次模型输出或一次聊天。

### Ariadne is not

- generic Career Mentor；
- auto-application bot；
- traditional Resume Generator；
- Job Board 或大规模岗位聚合器；
- 以不透明 match score 替代证据审查的工具；
- 允许模型静默写入用户经历的自动化系统。

## 3. Terminology

| 术语 | 权威定义 |
|---|---|
| 当前运行时（Current Runtime） | 用户当前选择且当前可用的执行模式：`LOCAL` 或一个具体的 `MODEL RUNTIME`。它只决定现在可以发起什么能力，不改写历史。 |
| 能力权限（Capability Authority） | 决定某个新操作当前是否可见、可发起及必须走哪条执行边界的唯一权威。Ariadne 中由 Current Runtime 承担。 |
| 运行时快照（RuntimeSnapshot） | 某次操作在规定捕获边界生成的不可变执行身份；包含 Provider/model/protocol/capability/version/delivery/credential reference，但不包含 secret。 |
| 历史来源（Historical Provenance） | artifact、action、message、proposal、review decision、revision 的实际生成方式和执行来源。它属于具体对象或 revision，不是整条 record 上可随 Runtime 改写的单一标签。 |
| `SourceDocument` | 用户提供的一个独立 source identity，包括原始材料、hash、类型、接收时间和本地引用。它权威说明“用户提供了什么”，不自动证明材料中的陈述为真。 |
| `ExtractionArtifact` | 从 SourceDocument 机械提取出的 text、OCR block、page/block location 或 parser output。它可持久化，但可能包含 OCR/parser error，非 confirmed truth。 |
| `ProcessingRun` | 一次 extraction、model inference、merge、conversation Send 或 retry 的执行记录，链接 RuntimeSnapshot、状态、错误和输出 artifact。 |
| 提案（Proposal） | deterministic 或 model 产生的候选结构、merge、patch 或 revision 建议。即使已存储，仍不是 authoritative truth。 |
| `ReviewDecision` | 用户对 Proposal 作出的 Confirm、Reject 或 Edit-and-Confirm 决定，包含时间、输入版本及关联 Proposal。 |
| `CandidateContext` | 用户确认的、可版本化的 Candidate authoritative state。 |
| `JobContext` | 用户确认的、可版本化的 Job authoritative state。 |
| 持久化（Persistence） | 把对象写入 durable store。它只描述存储状态，不描述事实权威性。 |
| 静默降级（Silent Fallback） | 用户选择 Model 操作后，系统未明确解释失败、未展示替代方案、未取得新选择，就改走 Local/deterministic/fixture 路径。该行为被禁止。 |

## 4. Core Epistemic Contract

以下规则不可由 implementation convenience、缓存命中、demo 数据或 Provider failure 绕过：

1. AI 不能编造用户经历、能力、偏好、职业目标或 Job 事实。
2. `Conversation is not truth.` Conversation message 不能直接成为 CandidateContext/JobContext 的 authoritative field。
3. AI inference 或 deterministic inference 不会因为已持久化而自动成为权威事实。
4. `Missing Evidence ≠ Missing Capability`；unknown、ambiguity 与 conflict 必须保留。
5. 用户提供的 source 对“输入内容”有权威性；涉及正式结构化事实时，仍须经过适用的 review/confirmation boundary。
6. 任何 AI-driven authoritative mutation 必须走：

```text
Proposal
→ Before / After / Why
→ User Confirm
→ Persist authoritative revision
```

7. Confirm 必须针对明确的 Proposal 和明确的 input version；版本已变化时必须停止并要求重新 review。

## 5. Current Reality Audit

本节仅总结 baseline 的已审计事实，不把仓库中未接入的潜在模块误报为当前产品能力。

| 当前路径 | 分类 | baseline 上实际行为 |
|---|---|---|
| Runtime selection | **REAL** | `public/runtime-selection.js` 把 `{mode, provider, model}` 存入 `localStorage`，并影响部分 UI 可见性与 merge 分支；尚未成为所有执行路径的统一 authority。 |
| Provider connection / model discovery | **REAL / NOT IMPLEMENTED** | Qwen、DeepSeek 等存在部分真实 connection/discovery path，但 Provider 行为、credential 来源和全局 Runtime routing 未统一；部分 Add Model 连接器仍未接线。 |
| API-key usage | **REAL，fragmented** | 当前存在 browser `localStorage` 与 macOS Keychain 等不同方式；没有统一的 credential reference 随 RuntimeSnapshot 进入下游操作。 |
| Candidate file intake | **UI-ONLY / FAKE AI** | 当前 V1 仅保留文件名、MIME、size、extension 等 metadata，不读取 source bytes/text。 |
| Candidate extraction / semantic understanding / cards | **SYNTHETIC FIXTURE** | `public/v1-pages.js` 与 `public/v1-demo-domain.js` 生成固定 Candidate fixtures；输入内容没有进入 parser 或 selected model。 |
| JD file / pasted-text intake | **UI-ONLY / FAKE AI** | 文件仅保留 metadata；pasted JD 只保留 label/character count，未保留实际 text。 |
| JD extraction / semantic understanding / Job Context | **SYNTHETIC FIXTURE** | 当前 V1 生成固定 Job fixture，与 source 内容无关，也不调用 selected model。 |
| Duplicate detection | **LOCAL DETERMINISTIC** | 当前使用 normalized-field comparison 与固定 threshold；算法真实，但输入 record 仍可能来自 fixtures。 |
| Local duplicate merge | **LOCAL DETERMINISTIC** | 当前 deterministic union/summary/version/`merge_metadata` 后持久化。 |
| Model duplicate merge | **NOT IMPLEMENTED** | Model Runtime 下 merge 当前显式失败，不产生 merge result。 |
| Candidate / Job AI Conversation | **UI-ONLY / FAKE AI** | 当前使用 regex/template 生成 assistant copy；没有真实 Provider/model request。 |
| Persistence | **REAL，demo-scoped** | IndexedDB 真实保存 demo Candidate/Job records 与 conversations；Runtime/model/key 还涉及 `localStorage`，尚未形成正式 truth persistence contract。 |
| Provenance | **LOCAL DETERMINISTIC，incomplete** | 存在松散的 `imported_from`、`provider_id`、`model_id`、`merge_metadata` 等字段，但没有统一 RuntimeSnapshot、Proposal/ReviewDecision linkage 或 revision-level provenance。 |

仓库还存在未接入当前 V1 主路径的能力：本地 PDF/DOCX/TXT extraction、本地 Apple Vision OCR、部分真实 PDF→Provider ingestion、CandidateProposal builder/validator 及 CLI JD analysis。这些“仓库中存在”的模块不等于“当前用户路径已经执行”。

**关键合规结论：** 当前 Candidate/JD import 与 Candidate/Job conversation surfaces 尚不符合目标 Model Runtime contract。只要 UI 展示 Model identity，就不得继续把 fixture 或 local template 伪装为该 Model 的输出。

## 6. Runtime Capability Matrix

下表是目标合同，不是当前实现完成度声明。

| Capability | LOCAL | MODEL RUNTIME |
|---|---|---|
| intake | 接收并在本地保存 source；零 Provider call | 先在本地接收、标识、hash，再按 disclosure/consent 决定传输 |
| extraction | 本地执行 | 通常先本地执行；extraction 本身不算 model understanding |
| OCR | 有限本地 OCR；结果须 review | 可用本地 OCR 预处理；发送原图/渲染页要求 snapshot model 具有已验证 vision capability |
| deterministic parsing | 支持，必须标为 rule-based/local | 可作为 preprocessing，但不得冒充 model output |
| semantic understanding | 不支持 | 只有真实 selected Provider/model call 后才支持 |
| Candidate structuring | 规则明确时产生 limited local draft | selected model 产生 validated CandidateProposal |
| Job structuring | 对真实 extracted/pasted text 产生 limited local draft | selected model 产生 validated JobProposal |
| duplicate detection | 本地 deterministic | 仍为本地 deterministic；检测本身不需 model call |
| duplicate merge | 用户明确选择后的 deterministic merge | selected model → MergeProposal → validation → review → confirm |
| conversation | 不显示 pane；无 Send；零 Provider call | pane 可见；每次 Send 真实调用当次 snapshotted Provider/model |
| proposal generation | 仅 deterministic draft/edit preview，不称为 AI | model Proposal/Patch/MergeProposal，必须 validation 且保持非权威 |
| persistence | Source、artifact、draft、decision、confirmed revision 均可本地持久化 | 同样本地持久化，并附不可变 model execution provenance |

## 7. Current Runtime vs Historical Provenance

### Frozen authority split

```text
Current Runtime
→ determines capabilities available NOW

Historical Provenance
→ records how each past artifact/action/message/revision was produced
```

任何 UI 或 domain logic 都不得用 Current Runtime 重写已有 Historical Provenance，也不得只根据历史 Provider origin 决定现在能否发起新 AI 操作。

### Case A — Model-origin record，Current Runtime = Local

- 原 DeepSeek/其他 model provenance 保留。
- record 可在本地查看；合法的 local edit 产生新的 user/local revision provenance。
- AI Conversation pane 消失，Send 不可用，不能产生新 Provider call。
- historical origin 不得被改写为 Local。

### Case B — Local-origin record，Current Runtime = Model

- 原 Local provenance 保留。
- 当前 Model Runtime 可以授权新的 model operation。
- 新 Proposal、message、action 或 revision 记录自己的 Provider/model RuntimeSnapshot。
- 原 record 不得被追溯性改写为 Model-created。

Provenance 的最小粒度是 artifact/action/message/revision；record-level summary 只能由这些不可变事实派生。

## 8. RuntimeSnapshot Contract

### Required fields

```text
snapshot_id
captured_at
mode
provider
model
protocol
capabilities
adapter_version
prompt_version
schema_version
delivery_method
credential_ref
```

- RuntimeSnapshot 不可变。
- `credential_ref` 只指向 secret 所在位置或 handle；不得包含 API key、token 或 secret value。
- Local snapshot 中 Provider/model 可为空，但 `mode: LOCAL` 与 local capability set 必须明确。
- Snapshot validation 必须发生在网络传输或 operation start 前；不满足 capability 时 fail closed。

### Capture timing

| Operation | Frozen capture rule |
|---|---|
| Batch import | 在用户完成 disclosure/consent 并确认 Start 时捕获一次；整个 batch 固定使用该 snapshot。 |
| Per-file `ProcessingRun` | 链接或复制 parent batch snapshot；不得重新读取 global Runtime。 |
| Import duplicate dialog | 继承 parent import snapshot；dialog 打开期间 Runtime 改变不重定向该 operation。 |
| Standalone duplicate merge | 用户选择“融合材料”时捕获 snapshot。 |
| Proposal generation | 继承所属 import/merge/conversation run 的 snapshot。 |
| Conversation Send | 每次 Send 在 submit 时单独读取 Current Runtime、验证 capability 并捕获新 snapshot。 |
| In-flight request | 保持已捕获 snapshot 直到终止；Runtime switch 不得 retarget。 |
| Retry | 创建新的 ProcessingRun。复用原 snapshot 必须是明确的 same-runtime retry；改用其他 Runtime 必须重新 disclosure/choice 并创建新 snapshot。 |

一个 conversation session 可以包含多个不同 model provenance 的 messages；一个 in-flight request 只能属于一个 snapshot。

## 9. Local Execution Contract

### Frozen flow

```text
raw source
→ local extraction
→ deterministic parsing/structuring
→ reviewable local draft
→ user confirm
→ confirmed record
```

Local 表示：

- zero Provider/model calls；
- no AI Conversation；
- extraction、OCR 与 deterministic structuring 在本地完成；
- 不把 parsing/OCR/deterministic rules 标成“AI understanding”“AI recognized”或任何 model output；
- sparse/unsupported input 输出 unknown、needs_review 或 manual selection，不补造 fixture facts。

### Truthful Local V1 by format

| Format | Local V1 可真实承诺的行为 | 不得声称的能力 |
|---|---|---|
| PDF | 提取 native text；对无足够可用文本的 image page 可使用现有本地 Apple Vision OCR；保留 page/block provenance | 不保证复杂视觉布局语义，也不称为 AI understanding |
| DOCX | 提取 `word/document.xml` 中的 paragraph text | 不保证 page geometry、embedded image、复杂 layout、header/footer 或视觉关系理解 |
| image | 对当前支持的 PNG/JPEG 进行本地 OCR，展示 extracted text/manual review | 在 Slice 4 产品决策前，不从任意图片自动声称 Candidate semantic structuring |
| text | 对 Candidate TXT/Markdown 与 JD pasted text 保存实际内容并执行保守规则解析 | 不把缺失字段推断为用户没有相应能力或经历 |

Candidate rules 可以识别明确 section heading、日期、work/project/education/skill patterns；portfolio 与 `Other` 输入在无法可靠结构化时必须停在 review/manual state。JD pasted text 必须保存真实 text，不能继续仅保存 character count。

## 10. Model Execution Contract

### Frozen flow

```text
SourceDocument
→ local preservation/hash
→ capability check
→ disclosure/consent
→ RuntimeSnapshot
→ Provider adapter
→ structured response
→ syntax/schema/grounding validation
→ Proposal
→ review
→ confirmation
→ authoritative CandidateContext/JobContext revision
```

### Local boundary and transmission boundary

始终留在本地的内容：

- Source identity、local storage reference 与 hash；
- credential secret；
- 未被本次 disclosure/consent 纳入的其他 Candidate/Job records、sources 和 conversations；
- review decision、confirmed revision 与完整 provenance store（除非未来另有明确同步产品决策）。

可能离开设备的内容必须在 action-scoped disclosure 中明确：

- PDF：selected adapter 明确支持时可发送原 PDF；否则可发送本地渲染页或 extracted text；
- DOCX：首个安全版本默认只发送 extracted text；
- image：只有 snapshot model 具备 verified vision capability 时才可发送原 image bytes 或 rendered page；
- pasted text：可发送用户本次提供的 exact text；
- source URL：默认只保留为 local provenance，不自动 fetch 或 transmit。

Credential 永远不得进入：

- model context；
- Proposal；
- log；
- export；
- conversation message content；
- RuntimeSnapshot secret-bearing field。

### Provider routing and validation

中央 Provider adapter 必须解析并执行：

```text
provider + model + protocol + verified capabilities
+ adapter_version + credential_ref
+ prompt_version + schema_version + delivery_method
```

结构化响应至少依次通过：response extraction、JSON parsing、versioned schema validation、allowed-field validation、source-reference/grounding validation、proposal-state validation。失败只产生 failed ProcessingRun，不产生 partial authoritative record。

任何 Model-capable operation 必须真实调用所选 Provider/model。只显示 model identity、后台仍执行 fixture/local fake AI 的路径一律不合规。

## 11. Multi-file Batch Contract

### Identity and queue

```text
ONE FILE = ONE SOURCE IDENTITY

one intake action
→ one batch
→ one RuntimeSnapshot
→ sequential processing
→ per-source commit
→ one normal completion only if the queue completes normally
```

- Personal multi-file import 与 JD multi-file import 使用同一顺序队列合同。
- 每个 file 建立独立 SourceDocument identity；一个 JD file 对应一个独立 Job source/JobContext candidate。
- Pasted JD 保持 single-entry。
- 每个成功 source 独立提交；batch 不是一个需要整体 rollback 的原子事务。
- 新的独立 intake action 会替换尚未开始处理的 pending batch；除非未来用户明确重新做产品决策。
- 已进入 processing 的 batch 不能被新 intake、Runtime switch 或 multi-tab change 静默 retarget。

## 12. Multi-file Cancel Contract — Frozen

### Authoritative transition

```text
用户选择“取消上传”
→ 当前 source 不形成成功导入结果
→ 当前 batch = CANCELLED
→ 立即终止剩余 queue
→ 后续 files 不处理
→ 后续 files 不产生 Provider call
→ 已成功持久化的前序 records 保留
→ no rollback
→ no normal success completion
```

该合同适用于：

- Personal multi-file import；
- JD multi-file import；
- Local Runtime；
- Model Runtime；
- duplicate review 中的“取消上传”；
- model merge failure 后用户选择的“取消上传”。

Single-file 等价于：当前 source 不形成成功导入结果，batch 进入 `CANCELLED`，import 结束且不触发 success completion。

### Source persistence clarification

“当前 source 不持久化”的冻结产品含义是：

- 当前 source 不成为成功 imported Candidate/Job result；
- 不创建或更新 authoritative CandidateContext/JobContext；
- 没有 pending Proposal 被视为 confirmed；
- 不计入 successful import count。

它**不自动决定**以下已经创建的 operational artifacts 是否必须物理删除：

- SourceDocument；
- ExtractionArtifact；
- ProcessingRun；
- RuntimeSnapshot；
- cancellation history。

这些 operational artifacts 的 retention/deletion policy 是 Slice 3 的 persistence decision。在 Slice 3 冻结该 policy 前，它们不得被当作 successful import truth，cancellation status 必须明确，且 cancelled source 不得产生 authoritative Candidate/Job record。

### State semantics

| Batch state | 含义 |
|---|---|
| `COMPLETED` | queue 正常处理完毕，并且只触发一次 normal completion。 |
| `FAILED` | source/transport/provider/model/validation/persistence 执行失败；必须暂停或进入显式 failure resolution，不能伪装成 cancel。 |
| `CANCELLED` | 用户主动终止当前 batch；立即停止 queue，不 rollback，不触发 normal completion。 |

`COMPLETED_WITH_FAILURES` 是否进入正式 schema 延后到 Slice 3；该延后不得弱化 `CANCELLED` 终态。

### Side-effect boundary

- Cancel 不能撤回已经发生的 Provider request 或费用。
- 已返回或稍后返回的结果不得因此写入 authoritative record。
- 未确认 Proposal 可按 Slice 3 policy 删除或标记 `CANCELLED_BY_USER`。
- 后续 queue item 不创建新的 ProcessingRun、extraction、Provider request、Proposal 或 record。
- 如果记录 batch summary，未开始 items 只能标为 `NOT_STARTED_DUE_TO_BATCH_CANCEL`。
- Cancel 后不得调用 `completeEmbeddedImport(...)`、发送 `job-radar-v1-import-complete`、执行 success return animation 或发出等价 normal completion signal。
- Runtime 再次切换不能恢复 cancelled batch；重新导入剩余 files 必须创建新 batch、新 disclosure/consent 与新 RuntimeSnapshot。

本节是已冻结产品合同。后续 Slice 不得改回“只取消当前 source、继续处理剩余 queue”的 rejected behavior，除非用户明确开启新的产品决策。

## 13. Duplicate Detection and Merge Contract

### Duplicate detection

Duplicate detection 在 Local 与 Model Runtime 下都使用 versioned local deterministic algorithm。检测结果是 review signal，不是事实裁决，也不应为检测本身支付 model call。

### Local merge

```text
duplicate detected
→ 用户选择“融合材料”
→ deterministic explicit merge
→ persist merged revision
→ continue queue
```

“融合材料”的 click 是对已说明 deterministic merge algorithm 的明确授权；它不属于 AI mutation，但 merge provenance 和 input versions 仍须保留。

### Model merge

```text
duplicate detected
→ 用户选择“融合材料”
→ inherit/import or capture RuntimeSnapshot
→ selected model generates MergeProposal
→ validate
→ Before / After / Why
→ User Confirm
→ input version check
→ persist merged revision
→ continue queue
```

- Model merge 不得 auto-persist。
- MergeProposal 只能组合 source-supported facts；conflict 必须保留为 uncertainty，不能由模型静默裁决。
- validation、Provider 或 persistence failure 时，existing record 不变。

### Exact action and queue semantics

| Action | 当前 source | Remaining queue | Completion |
|---|---|---|---|
| `融合材料` | Local：完成 deterministic merge；Model：Proposal 经确认后 persist | 当前处理合法完成后继续 | queue 正常耗尽时只完成一次 |
| `各自保留` | incoming source 作为独立 result persist | 继续 | queue 正常耗尽时只完成一次 |
| `取消上传` | 不形成 successful import result | 立即终止 | batch=`CANCELLED`；不触发 normal completion |

Model merge failure 必须暂停当前 queue，并提供明确的 retry、各自保留、取消上传或显式 Local merge alternative。系统不得自动跳过、自动继续或静默 Model→Local fallback。

最小 `merge_metadata`：

```text
merge_id
method: LOCAL_DETERMINISTIC | MODEL_PROPOSAL
algorithm_or_prompt_version
duplicate_score
detector_version
input_record_ids
input_versions
processing_run_id?
runtime_snapshot_id?
provider?
model?
schema_version?
proposal_id?
review_decision_id
confirmed_at
```

## 14. AI Conversation Contract

### Local

- AI Conversation pane 不存在。
- Send 不可用。
- zero Provider calls。
- 已持久化的历史 conversation 可以保留在本地，但 Local capability surface 不显示可继续 AI 对话的入口。

### Model Runtime

每次 Send 必须：

1. 读取提交瞬间的 Current Runtime；
2. 验证 conversation capability；
3. 创建独立 RuntimeSnapshot；
4. 编译 bounded、scope-isolated context；
5. 发起一次真实 selected Provider/model request；
6. 保存 assistant message 及其 Provider/model/ProcessingRun provenance。

Conversation session 绑定一个 Candidate item 或一个 Job，不绑定永久 model identity。一次 Send 的 RuntimeSnapshot 不受提交后的 Runtime switch 影响。

### Candidate context isolation

Candidate conversation 只能使用该 Candidate scope 中经允许的：当前 Candidate fields、version/review state、compact source refs、uncertainties、同 scope recent messages，以及本次明确允许的 excerpts/attachments。不得默认发送整个 CandidateContext 或无关 sources。

### Job context isolation

Job conversation 只能使用该 Job scope 中经允许的：title、company、location、summary、requirements、Job source refs、uncertainties 与同 scope history。不得自动注入 CandidateContext，不得把 Job Understanding 偷换成 Candidate fit/match inference。

Conversation source transmission 的精确默认范围仍是 Slice 10/11 前的开放产品决策；在决策冻结前，推荐默认值是“current structured record + compact cited excerpts + 最近八条同 scope messages”，完整 source/page/image 只通过显式 per-send attachment/disclosure 发送。

### Mutation boundary

```text
Conversation
→ optional ContextPatch / JobPatch Proposal
→ Before / After / Why
→ version check
→ User Confirm
→ persist new revision
```

Assistant text、tool-looking response 或已持久化 message 均不得直接写 Candidate/Job authoritative store。Runtime 切换为 Local 后，conversation pane 可以隐藏，但 pending Proposal 仍可作为非 AI execution 的本地 review object 展示；确认时仍须 version check。

## 15. Runtime Switching and Concurrency

| State / event | Frozen behavior |
|---|---|
| Workspace / passive viewing | 动态读取 Current Runtime；record 始终按 Historical Provenance 展示来源。 |
| Pending import before Start | 尚无 snapshot；Runtime 可变。新的独立 intake action 可替换 unprocessed pending batch。 |
| Processing batch | 使用 Start 时捕获的 batch snapshot；Runtime switch 不得 retarget、pause、resume 或改变 queue semantics。 |
| Duplicate dialog | Import 中继承 batch snapshot；standalone merge 在选择 action 时捕获。dialog 打开后 Runtime switch 不改变已有 operation。 |
| Open conversation | pane visibility 动态跟随 Current Runtime；切到 Local 后 Send 消失。 |
| Send | submit 时捕获 per-send snapshot；同一 session 的下次 Send 可使用后来选择的新 Runtime。 |
| In-flight request | 继续使用原 snapshot；完成后按原 Provider/model provenance 保存为 message/Proposal，不能直接改 truth。 |
| Retry | 新 ProcessingRun；same-snapshot retry 或改 Runtime retry 都必须是用户明确选择，后者需新 snapshot/disclosure。 |
| Multi-tab Runtime change | 所有 passive/new-action capability surface 应收敛到同一 Current Runtime；已捕获 operation 不受另一个 tab 的变化影响。 |

额外 queue invariant：`CANCELLED` 是当前 batch 的终态。Runtime change、tab refresh、retry control 或重新打开 dialog 都不得恢复 remaining queue；剩余 files 只能通过新的 intake action 进入新 batch。

## 16. Error / Fallback / Cancel Policy

| Failure | Required behavior |
|---|---|
| invalid/missing key | 可检测时在 source transmission 前失败；标记 credential failure；该 Runtime 不可发起新 operation |
| Provider unavailable | failed run；保留 local source/extraction；不产生 Proposal |
| network failure | failed transport run；不 blind retry，不伪造 assistant/model result |
| rate limit | 保留 `Retry-After`（如有）；允许 manual retry；不 fallback |
| timeout | outcome 标为 uncertain；retry 前提醒 Provider 可能已经处理 request |
| unavailable model | 禁止使用该 selection 发起新 operation；要求用户重新选择 |
| invalid JSON | parsing failure；不创建 Proposal |
| schema mismatch | contract validation failure；不创建 Proposal |
| unsupported vision | transmission 前停止；可明确提供“仅使用 extracted text”等替代方案 |
| model import failure | confirmed record 不变；保留 SourceDocument 与合法 local artifacts |
| merge failure | existing record 不变；queue 暂停等待显式 retry/keep/cancel/Local choice |
| conversation failure | 不生成 fabricated assistant message；保存 failed run 与 user-message delivery state |
| persistence failure | 不报告成功；不得修改 confirmed truth；可保留 recoverable validated Proposal |

### No Silent Fallback

```text
Model operation fails
→ UI explains the failure
→ UI describes an explicit alternative
→ user makes a new choice
→ new execution decision / ProcessingRun / provenance
```

禁止 silent Model→Local fallback。显式 Local alternative 也不能复用或伪装为原 Model provenance。

### Failure and cancel are distinct

- `FAILED` 表示执行没有按合同完成，系统进入 failure resolution。
- `CANCELLED` 表示用户主动终止 batch，remaining queue 立即结束。
- Failure 不自动等于 cancel；cancel 不自动等于 failure。
- Failure UI 中用户选择“取消上传”后，才进入第 12 节定义的 `CANCELLED` 终态。

## 17. Truth / Persistence / Provenance

### Conceptual objects

| Object | Meaning | Epistemic authority | Required provenance |
|---|---|---|---|
| `SourceDocument` | 用户提供的 exact source 与 identity/hash | 权威说明输入了什么；不自动证明其全部陈述 | intake action、local reference、hash |
| `ExtractionArtifact` | mechanical extraction/OCR/parser blocks | 非权威；可有 extraction error | source id、extractor/version、locations |
| `Proposal` | deterministic/model suggested structure or mutation | 非权威，即使 persisted | inputs、ProcessingRun、RuntimeSnapshot、schema/prompt/algorithm version |
| `ReviewDecision` | 用户 Confirm/Reject/Edit-and-Confirm | 权威 decision event | proposal id、input version、decision、time |
| `CandidateContext` / `JobContext` revision | 用户确认的 reusable state | authoritative product truth | prior revision、ReviewDecision、supporting source refs |
| `ProcessingRun` | operation execution record | execution history，不是内容 truth | RuntimeSnapshot、status、errors、artifact links |
| `RuntimeSnapshot` | immutable execution identity | execution history | capture time 与 normalized identity |

### Frozen invariants

- `PERSISTED` 不是 epistemic state。
- Persisted Proposal 仍不是 authoritative truth。
- Rejected Proposal、failed run、cancel history 可以持久化，但不得进入 confirmed context。
- Confirmed revision 必须链接 ReviewDecision；AI-driven revision 还必须能追溯到 Proposal、ProcessingRun 与 RuntimeSnapshot。
- Batch per-source commit 表示前序成功 results 在后来 cancel 时保留；不得因为 batch `CANCELLED` 改写其 provenance 或删除其 confirmed revisions。
- 无需为了本阶段引入完整 Event Sourcing platform；使用最小 additive contracts 与 version linkage 即可。

## 18. Synthetic Fixture Migration

冻结迁移方向：

1. 建立 central capability 与 RuntimeSnapshot contract。
2. 当前 V1 fail closed：Model import/Send 不再生成 fixture output；Local terminology 不再声称 AI understanding。
3. 增量建立 SourceDocument、ProcessingRun、Proposal、ReviewDecision 与 Job contracts。
4. 接入真实 Local Candidate extraction。
5. 接入真实 Local JD extraction 与 pasted text。
6. 建立统一 Provider adapter、credential handle、capability/discovery、error 与 schema validation boundary。
7. 实现真实 Model-backed Candidate import。
8. 实现真实 Model-backed JD import。
9. 实现 Local merge 与 Model MergeProposal review。
10. 实现真实 Candidate-scoped conversation。
11. 实现真实 Job-scoped conversation。
12. 退役 user-facing fixture execution，并 gate/deprecate Runtime-bypassing legacy pages。

Fixture 必须停止成为 user-facing execution path，但在真实替代路径存在前不得过早删除。历史/demo data 可保留且必须可识别；产品 action 不得继续新生成 fixture result 并把它展示成 Local truth 或 Model output。

## 19. Test / Eval Contract

### LOCAL

- Provider adapter spy 对所有 Local operation 保持 zero calls。
- AI Conversation pane 不存在，Send 不可触发。
- Local UI/copy 不使用 AI/model identity 或“AI understanding”描述 deterministic work。
- PDF、DOCX、image OCR 与 pasted text 的输出必须受真实 source content 影响。
- unsupported/sparse input 产生 unknown/manual review，不生成 fixture facts。

### MODEL

- outbound adapter call 包含用户选择的 exact Provider 与 model。
- RuntimeSnapshot identity 与 ProcessingRun、Proposal/message provenance 一致。
- 每个 Model-capable operation 都有真实 adapter invocation；fixture/deterministic output 不能声明 Model provenance。
- capability 不满足时在传输前停止。

### PROVENANCE

- DeepSeek-origin record 切换 Local 后仍保留 DeepSeek origin。
- Local-origin record 切换 Model 后仍保留 Local origin。
- Model A in-flight 时切换 Model B，结果仍记录 Model A。
- 同一 conversation session 中不同 Send 可保留不同 historical model provenance。

### SWITCHING AND CONCURRENCY

- pending action 动态读取 Runtime；captured operation 不被切换 retarget。
- multi-tab Runtime change 更新 passive/new-action capability，但不改变 batch、merge、Send 的 snapshot。
- retry 必须创建新 ProcessingRun；更换 Runtime 时创建新 RuntimeSnapshot。

### FAILURE AND FALLBACK

- key/network/rate-limit/timeout/invalid JSON/schema/persistence failure 不修改 confirmed record。
- 不发生 silent Local fallback。
- timeout retry 显示 uncertain prior completion。
- persistence failure 不报告 success。

### MERGE

- Local deterministic merge 版本化并保留 input provenance。
- Model 只产生 MergeProposal，不 auto-persist。
- Model merge 在 confirmation 与 input-version match 后才持久化。
- failure 保持 existing record unchanged 并暂停 queue。
- 三个 action 的 source 与 queue 语义分别覆盖。

### CONVERSATION

- 每个 Model Send 恰好调用一次 selected adapter。
- Local 下无 Send、无 Provider call。
- Candidate 与 Job context 严格隔离。
- assistant message 不能直接写 Candidate/Job stores。
- Patch confirmation 执行 optimistic version check。

### MULTI-FILE CANCEL

Personal 与 JD 必须共享以下 mandatory regressions：

- 中间 source 选择“取消上传”后，batch 进入 `CANCELLED`。
- 当前 source 不形成 successful Candidate/Job result。
- remaining queue 不 resume、不 continue。
- 后续 files 不执行 extraction、Provider call、Proposal creation 或 authoritative persistence。
- 前序已成功持久化 records 保留，且不 rollback。
- cancelled batch 不调用 `completeEmbeddedImport(...)`、不发出 `job-radar-v1-import-complete` 或等价 normal completion。
- Runtime switch、multi-tab change、refresh 或 retry control 不得恢复 cancelled queue。
- 重新处理剩余 files 必须创建新 batch 与新 RuntimeSnapshot。
- `FAILED` 与 `CANCELLED` 在 state、UI 与 telemetry/provenance 中保持不同。
- Single-file cancel 结束 import 且不触发 normal success completion。

## 20. ADR Decisions

### ADR-01 — Current Runtime 是 Capability Authority

- **DECISION：** 所有新 operation 的当前能力由 Current Runtime 唯一决定。
- **WHY：** 用户可预测当前是否会发生 Provider call，避免 capability 来自多套互相冲突的状态。
- **ALTERNATIVES REJECTED：** 由 record origin、页面局部 flag 或 legacy route 各自决定。
- **IMPLEMENTATION CONSEQUENCE：** 所有 action 使用 central capability resolver；legacy Provider action 必须受 gate 或禁用。

### ADR-02 — Historical Provenance 独立且不可被 Current Runtime 改写

- **DECISION：** provenance 属于 artifact/action/message/revision。
- **WHY：** Runtime switch 只改变未来能力，不能改变过去实际执行来源。
- **ALTERNATIVES REJECTED：** record 上仅保存一个会随 Runtime 覆盖的 origin label。
- **IMPLEMENTATION CONSEQUENCE：** revision 与 ProcessingRun 保留 immutable execution linkage。

### ADR-03 — RuntimeSnapshot 按 operation 捕获

- **DECISION：** batch import 捕获一次；conversation 每次 Send 捕获；merge 按 parent/standalone rule 捕获；in-flight 固定。
- **WHY：** 防止 mid-flight model switch 与错误 provenance。
- **ALTERNATIVES REJECTED：** 执行过程中持续读取 global Runtime。
- **IMPLEMENTATION CONSEQUENCE：** ProcessingRun 必须链接 immutable snapshot，retry 创建新 run。

### ADR-04 — Local 使用 extraction/deterministic terminology

- **DECISION：** Local 不声称 semantic AI understanding。
- **WHY：** parsing/OCR 与 model semantic reasoning 是不同能力。
- **ALTERNATIVES REJECTED：** 为统一 UI copy 把 deterministic output 称为 AI。
- **IMPLEMENTATION CONSEQUENCE：** Local labels、progress states 与 provenance 必须真实。

### ADR-05 — Model operation 必须真实执行 selected identity

- **DECISION：** Model import、merge、conversation 必须调用所选 Provider/model。
- **WHY：** UI identity、费用、隐私和结果 provenance 必须一致。
- **ALTERNATIVES REJECTED：** 显示 model 但返回 fixture/local output。
- **IMPLEMENTATION CONSEQUENCE：** adapter 未可用时 fail closed，不生成假结果。

### ADR-06 — AI Conversation 只在 Model Runtime 可用

- **DECISION：** Local 无 pane、无 Send；Model 每次 Send 真实调用。
- **WHY：** Local 的 zero-call guarantee 必须覆盖所有界面。
- **ALTERNATIVES REJECTED：** Local 显示空壳或 template conversation。
- **IMPLEMENTATION CONSEQUENCE：** pane 与 Send 由 capability gate 控制，message 保存 per-send provenance。

### ADR-07 — Conversation 不能直接修改 truth

- **DECISION：** 建议修改必须成为 Patch Proposal，经 Before/After/Why、version check 与 Confirm。
- **WHY：** Conversation text 不是用户确认的 authoritative state。
- **ALTERNATIVES REJECTED：** assistant response 或 tool-looking command 直接写 store。
- **IMPLEMENTATION CONSEQUENCE：** conversation transport 与 authoritative mutation 分离。

### ADR-08 — Duplicate detection 始终 Local deterministic

- **DECISION：** Local 与 Model Runtime 共用 versioned deterministic detector。
- **WHY：** 检测可解释、低成本，不需要 semantic generation。
- **ALTERNATIVES REJECTED：** 每次 duplicate check 调 model。
- **IMPLEMENTATION CONSEQUENCE：** detector version 与 score 写 provenance；merge method 独立选择。

### ADR-09 — Local merge deterministic；Model merge proposal-based

- **DECISION：** Local explicit merge 可直接按规则 persist；Model 只生成 MergeProposal 并要求确认。
- **WHY：** Model merge 包含语义判断和 conflict resolution risk。
- **ALTERNATIVES REJECTED：** Model merge auto-persist；Model failure 自动调用 Local merge。
- **IMPLEMENTATION CONSEQUENCE：** Before/After/Why、input version 与 ReviewDecision 是 Model merge 必需条件。

### ADR-10 — No Silent Fallback

- **DECISION：** Model→Local alternative 只在 failure explanation、explicit alternative 和新 user choice 后执行。
- **WHY：** 防止 fake AI、错误费用预期与 provenance corruption。
- **ALTERNATIVES REJECTED：** timeout/error 后自动执行 deterministic substitute。
- **IMPLEMENTATION CONSEQUENCE：** fallback 创建新的 execution decision、ProcessingRun 与 provenance。

### ADR-11 — Confirmation 创建新的 authoritative revision

- **DECISION：** Proposal confirmation 通过 optimistic version check 产生新 revision。
- **WHY：** 保留 auditability，避免 stale proposal 覆盖新数据。
- **ALTERNATIVES REJECTED：** 原地覆盖 current object 或“已持久化即确认”。
- **IMPLEMENTATION CONSEQUENCE：** confirmed revision 链接 Proposal 与 ReviewDecision。

### ADR-12 — 取消上传终止 remaining batch，不 rollback

- **DECISION：** `取消上传 = abort remaining batch without rollback`。
- **WHY：** 这是已实现并由用户验收的 multi-file 产品合同；source 独立提交，但 queue 属于同一次 intake action。
- **ALTERNATIVES REJECTED：** 只取消当前 source 后继续 queue；回滚前序成功 records；把 cancelled batch 报告为 normal completion；cancel 后自动切换 Runtime/fallback。
- **IMPLEMENTATION CONSEQUENCE：** batch loop 收到 cancel 后立即终止；后续 Candidate/Job source 不处理；不发 normal completion；前序 committed records 保留；Personal 与 JD 共享回归合同。

## 21. Atomic Implementation Slices

Slice 顺序已经通过 review。Multi-file Cancel Contract 修订**不需要调整顺序**；只增加相应 acceptance 与 regression constraints。

### Slice 1 — Execution identity kernel

- **Objective：** 定义 `RuntimeCapability`、RuntimeSnapshot、Local/Model execution identity 与 snapshot validation。
- **Dependency：** 无。
- **Likely files/areas：** new `src/execution_contract.py`、`public/runtime-capabilities.js`、runtime contract tests。
- **Risks：** 重复已有 Provider registry；把 secret 误放进 snapshot。
- **Acceptance criteria：** Local/Model normalized snapshot 可验证；包含 capability/version/delivery/credential reference；不包含 secret。
- **Regression/eval：** 现有 runtime/provider contract tests；snapshot immutability、identity normalization、secret exclusion tests。
- **Recommended model：** Sol High。
- **Git commit boundary：** `arch: define runtime capability and execution snapshot contracts`

### Slice 2 — Truthful capability gating

- **Objective：** centralize Runtime reads；禁用 fixture Model import/conversation；修正 Local terminology；gate legacy Provider actions。
- **Dependency：** Slice 1；`Legacy Provider pages` 产品决策须在本 Slice 前确定。
- **Likely files/areas：** `public/runtime-selection.js`、`public/v1-pages.js`、import/detail HTML、UI regressions。
- **Risks：** 破坏已验收的 visibility/motion 与 multi-file cancel behavior。
- **Acceptance criteria：** Local 无 AI surface；Model 不生成 fixture result；capability 来自 Current Runtime；cancel 后立即退出 batch loop，不触发 normal completion，前序 records 保留。
- **Regression/eval：** Local zero-call/no-pane；Model fail-closed；Personal/JD cancel 不 continue、不 rollback；`completeEmbeddedImport(...)` 与 completion event negative assertions。
- **Recommended model：** Terra Medium。
- **Git commit boundary：** `fix: enforce truthful runtime capability gates`

### Slice 3 — Source and review persistence

- **Objective：** 增量定义 SourceDocument、ExtractionArtifact、ProcessingRun、Proposal、ReviewDecision 与 Job contracts。
- **Dependency：** Slice 1。
- **Likely files/areas：** domain JS、schema JSON、IndexedDB migration、contract tests。
- **Risks：** IndexedDB backward compatibility；误把 persisted proposal 当 confirmed context；过早删除 cancelled operational artifacts。
- **Acceptance criteria：** Proposal 与 confirmed context 分离；ProcessingRun/Batch 可表达 `CANCELLED`；batch summary 可记录 `completed_source_ids`、`cancelled_source_id`、`not_started_source_ids`、`cancelled_at`、`cancel_reason: USER_CANCELLED_UPLOAD`；明确 operational artifact retention policy。
- **Regression/eval：** migration compatibility；proposal authority；cancelled source 不产生 authoritative record；前序 per-source commit 保留；`COMPLETED_WITH_FAILURES` 可继续 deferred。
- **Recommended model：** Sol High。
- **Git commit boundary：** `arch: add source proposal and review persistence contracts`

### Slice 4 — Real Local Candidate import

- **Objective：** 将 Personal import 接入真实 PDF/DOCX/text extraction 与 truthful Candidate draft。
- **Dependency：** Slices 2–3；`Local Candidate images` 决策须在本 Slice 前确定。
- **Likely files/areas：** `public/v1-pages.js`、`app.py`、`src/career_evidence.py`、Candidate adapters/tests。
- **Risks：** legacy CareerEntity 到 Candidate draft 的语义映射；unsupported image/portfolio 被过度结构化。
- **Acceptance criteria：** actual content 影响 output；unsupported case 进入 manual review；Local copy 不声称 AI understanding；逐 source 顺序提交。
- **Regression/eval：** PDF/DOCX/text real-content fixtures；zero Provider calls；中间 cancel 停止后续 extraction；前序 record 不 rollback；Personal queue contract。
- **Recommended model：** Sol High。
- **Git commit boundary：** `feat: wire truthful local candidate extraction`

### Slice 5 — Real Local JD import

- **Objective：** 将 pasted text 与 supported files 接入 deterministic Job draft。
- **Dependency：** Slices 2–3。
- **Likely files/areas：** `public/v1-pages.js`、`app.py`、JD domain/tests。
- **Risks：** PDF/DOCX extraction-to-JD rules；继续丢弃 pasted text；把 Job understanding 混入 Candidate match。
- **Acceptance criteria：** pasted text 原文被保存和解析；file output 受实际内容影响；不生成 fixture JobContext；逐 source 顺序提交。
- **Regression/eval：** pasted/file content tests；zero Provider calls；中间 cancel 停止后续 extraction；前序 record 不 rollback；JD 与 Personal cancel semantics 一致。
- **Recommended model：** Terra Medium。
- **Git commit boundary：** `feat: wire truthful local job extraction`

### Slice 6 — Provider execution boundary

- **Objective：** 建立 central adapter、credential reference、discovery/capability 与 normalized failures。
- **Dependency：** Slices 1–3；`Initial Provider allowlist` 与 `Credential storage` 须在本 Slice 前确定。
- **Likely files/areas：** new `src/provider_execution.py`、`provider_runtime.py`、`app.py`、Add Model/runtime UI。
- **Risks：** Provider protocol 与 credential storage 差异；重复连接逻辑；secret leakage。
- **Acceptance criteria：** selected identity 恰好进入一个 adapter；capability fail closed；key 不进入 Proposal/log/export/model context。
- **Regression/eval：** adapter routing、exact model propagation、credential-reference-only、normalized error、unsupported capability preflight tests。
- **Recommended model：** Sol High。
- **Git commit boundary：** `arch: centralize provider execution and credentials`

### Slice 7 — Model-backed Candidate import

- **Objective：** 实现真实 CandidateProposal generation、validation 与 review。
- **Dependency：** Slices 3、4、6。
- **Likely files/areas：** `src/candidate_context.py`、new route、Personal UI、tests/evals。
- **Risks：** grounding、malformed output、vision/source delivery、cancel 后 late response 写 truth。
- **Acceptance criteria：** selected Provider/model 真实调用；validated Proposal；不 auto-confirm；cancelled source 不形成 authoritative record。
- **Regression/eval：** exact adapter identity；schema/grounding failure；no silent fallback；cancel 后后续 files 无 Provider call；新导入剩余 files 创建新 batch/snapshot。
- **Recommended model：** Sol High。
- **Git commit boundary：** `feat: add model backed candidate import proposals`

### Slice 8 — Model-backed JD import

- **Objective：** 实现真实 JobProposal 与 requirement structuring。
- **Dependency：** Slices 3、5、6。
- **Likely files/areas：** Job contracts、Provider prompt、route、JD UI、tests/evals。
- **Risks：** 将 Candidate matching 混入 Job Understanding；malformed/ungrounded requirements；cancel late result。
- **Acceptance criteria：** 真实 selected model call；Job-only structured Proposal；review/confirm 后才形成 JobContext revision。
- **Regression/eval：** exact adapter identity；Job/Candidate scope isolation；no silent fallback；cancel 后 remaining files 无 Provider call；前序 results 保留。
- **Recommended model：** Sol High。
- **Git commit boundary：** `feat: add model backed job import proposals`

### Slice 9 — Duplicate merge contracts

- **Objective：** version deterministic detector/merge，并实现 Model MergeProposal review。
- **Dependency：** Slices 7–8。
- **Likely files/areas：** `public/v1-demo-domain.js` replacement domain、Candidate/Job merge schemas、UI/tests。
- **Risks：** stale input version、multi-file queue 回归、Model failure 被自动降级。
- **Acceptance criteria：** 三个 action 精确分离；`融合材料` 完成后继续；`各自保留` persist 后继续；`取消上传` 当前 source 不成功、立即终止 batch、保留前序 records、不处理后续 files、不发 normal completion；Model merge 不 auto-persist；failure 暂停 queue。
- **Regression/eval：** Local/Model merge、Before/After/Why、version mismatch、no hidden fallback；Personal/JD 与 model-merge-failure cancel 全部满足 frozen batch-cancel contract。
- **Recommended model：** Sol High。
- **Git commit boundary：** `feat: add explicit duplicate merge proposals`

### Slice 10 — Real Candidate conversation

- **Objective：** 实现 per-send snapshot、Candidate context compiler、Provider call 与 optional ContextPatch。
- **Dependency：** Slices 6–7；`Conversation source transmission` 须在本 Slice 前确定。
- **Likely files/areas：** `scoped-conversation-domain.js`、Candidate detail/UI、conversation route/tests。
- **Risks：** privacy/context leakage、token truncation、assistant direct mutation。
- **Acceptance criteria：** 每次 Send 调 selected model；message 有 snapshot provenance；ContextPatch 在 Confirm 前保持独立。
- **Regression/eval：** one real call per Send；Local no Send；Candidate scope isolation；raw source disclosure；direct-store-write negative test；optimistic version check。
- **Recommended model：** Sol High。
- **Git commit boundary：** `feat: add real candidate scoped conversation`

### Slice 11 — Real Job conversation

- **Objective：** 复用 transport/session infrastructure，实现 strict Job-only context 与 JobPatch。
- **Dependency：** Slices 6、8、10；Job conversation source transmission 细节最迟本 Slice 前确定。
- **Likely files/areas：** scoped conversation domain、Job detail/UI、tests。
- **Risks：** accidental Candidate-fit inference；跨 scope source leakage。
- **Acceptance criteria：** Job-only context；每次 Send 真实调用；JobPatch review/confirm 后才形成 revision。
- **Regression/eval：** exact snapshot identity；Job/Candidate isolation；Local no pane；direct mutation negative test；source transmission policy。
- **Recommended model：** Terra Medium。
- **Git commit boundary：** `feat: add real job scoped conversation`

### Slice 12 — Fixture and bypass retirement

- **Objective：** 退役 user-facing fixture execution，并将 legacy Provider pages 纳入 Current Runtime gate 或 archive route。
- **Dependency：** Slices 4–11。
- **Likely files/areas：** `public/v1-demo-domain.js`、V1 pages、legacy HTML/JS routing、regressions。
- **Risks：** historical IndexedDB records、direct bookmarks、替换 store 时破坏 multi-file cancel。
- **Acceptance criteria：** fixture 只作为可识别 historical/demo data 保留；product action 不再生成 fixture result；legacy action 不绕过 Runtime authority；cancel contract 不变。
- **Regression/eval：** no new fixture generation；no Runtime bypass；historical data readability；Personal/JD cancel 不变成 rollback 或 cancel-and-continue。
- **Recommended model：** Terra Medium。
- **Git commit boundary：** `chore: retire user facing fixture execution paths`

每个 Slice 只能在自己的 acceptance 与 regression 通过后形成独立 commit。不得把 Candidate import、JD import 与 Conversation 合并为一个 giant implementation commit。

## 22. Open Product Decisions

### A. Blocks Slice 1

**无。**

Slice 1 只冻结通用 capability authority、RuntimeSnapshot、execution identity、validation 与 secret-free credential reference。下面的 Provider、credential、image 与 transmission 选择不阻塞 Slice 1。

### B. Required before a named later Slice

| Decision | Latest decision gate | Why |
|---|---|---|
| Initial Provider allowlist | Slice 6 前 | Provider boundary 需要知道首个真正 end-to-end 支持 import、merge、conversation 的 adapter，避免过度实现未就绪 Provider。 |
| Credential storage | Slice 6 前 | 必须冻结 Keychain、session memory、browser-direct handle 与 localhost boundary。 |
| Local Candidate images | Slice 4 前 | 必须决定 image 仅为 OCR/manual review，还是允许有限 deterministic Candidate draft。 |
| Conversation source transmission | Candidate：Slice 10 前；Job：最迟 Slice 11 前 | context compiler、privacy disclosure、token budget 与 attachment UI 依赖该决定。 |
| Legacy Provider pages | Slice 2 前 | truthful capability gating 必须知道 legacy pages 是 read-only、受 Current Runtime gate，还是从 product execution surface 退役。 |

### C. Current recommended defaults，not yet frozen

在到达上述 decision gate 前，可按以下推荐默认值继续规划，但这些默认值不等于最终产品决定：

- **Initial Provider allowlist：** 先只开放一个真正端到端可用的 Provider；其他 model choice 在 import、merge、conversation 全部合规前隐藏或 disabled。
- **Credential storage：** desktop localhost 使用 macOS Keychain；未来 browser-direct BYOK 使用 session memory；不把 API key 持久化到 `localStorage`。
- **Local Candidate images：** 本地 OCR + extracted-text/manual review；不声称从任意图片完成 semantic Candidate understanding。
- **Conversation source transmission：** 默认发送 current structured record、compact cited excerpts 与最近八条同 scope messages；完整 source/page/image 需要显式 per-send attachment/disclosure。
- **Legacy Provider pages：** 保留 historical data readability；Provider action 默认受 Current Runtime gate，无法合规接入的 action 暂时 disabled。

## 23. Gate Status

```text
Architecture Human Review: PASS

Canonical Contract: FROZEN FOR SLICE 1
```

当前没有产品决策阻塞 Slice 1。

Slice 1 implementation 只有在本 canonical document 本身完成人工接受并作为独立 commit 提交后才允许开始。在此之前，不得把本合同状态误报为 implementation complete。
