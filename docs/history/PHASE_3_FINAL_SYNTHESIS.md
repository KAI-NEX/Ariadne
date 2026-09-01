# AI Job Radar｜Phase 3 Final Synthesis

> 状态：`canonical phase closeout`  
> 日期：2026-08-23  
> 范围：Phase 3 当前代码、SQLite / IndexedDB、真实 Thread 学习证据与回归；不是新的 Master Synthesis，也不重新分析职业方向。

## A. Phase 3 Implementation Outcome

### 最终产品结果

Phase 3 完成的是一个**有边界的本地优先职位导入与模型辅助切片**，不是自动找工作系统：

1. 14 条既有 JD 可进入 SQLite 列表 / 详情产品；JD-001 保留腾讯来源证据和用户自己的 `application_status = applied`。
2. 单一 Tencent Careers 来源完成了 raw capture、source-specific normalization、duplicate match、幂等 source-evidence merge 与 SQLite / UI 追溯。
3. 浏览器 local-first intake 可接收来源链接、粘贴原文或 1–4 张截图。链接默认只作 provenance；原文、本机 OCR 或用户主动开启的视觉模型只生成 `needs_review` candidate。
4. 本机 OCR 使用 macOS Vision；真实 DeepSeek 多模态请求使用原始截图，而不是把 OCR 错字作为唯一输入。
5. DeepSeek 视觉输出经过 JSON shape、字段类型、长度、图片编号和 evidence presence 检查后进入人工审核；审核确认后写入当前浏览器 IndexedDB。
6. “我的职位”页面读取同一 IndexedDB，显示、展开、切换全部原始截图并编辑同一 `job_id`。
7. 独立的文本 JD analysis foundation 已完成 Mock Provider、input / instruction / provider adapter、结构与边界验证、`job_analyses(needs_review)` 持久化和 review lifecycle regression。

### Model Integration 审计结论

| 问题 | 当前事实 |
| --- | --- |
| DeepSeek API 是否真实调用成功？ | **是，但只对截图视觉提取链路有真实成功证据。** 用户在页面主动触发，候选进入审核，记录到一次总用量 2,949 tokens。 |
| 通用文本 JD analysis 是否真实调用成功？ | **没有可验证证据。** `scripts/call_model_api.py` 已实现 DeepSeek 请求，但 SQLite 只有一条 `mock / deterministic-fixture-v0` analysis；不能写成真实文本 analysis 已完成。 |
| 视觉模型输入是什么？ | 1–4 张用户本次选择的原始 PNG/JPEG、固定完整视觉 instruction、JSON object response request；Key 从 macOS Keychain 读取。 |
| 文本 analysis input 是什么？ | JD facts：ID、标题、公司、地点、经验、职责、要求；以及 source name / external ID / raw path / hash / fetch time。明确排除 `application_status`。 |
| instruction 是什么？ | 视觉链路要求只使用可见截图事实、缺失写 `unknown`、排除招聘者/CTA/广告、返回字段、职责、要求与图片 evidence。文本链路要求只使用输入 JD / provenance、不得推断用户状态或岗位开放状态、输出保持 `needs_review`。 |
| 返回结果是什么？ | 视觉链路返回 provider raw text 内的 JSON object；文本 Mock 返回 fixture JSON。二者都不是自然语言自由回答。 |
| Structured Output 程度 | 视觉链路是 provider JSON mode + 本地自定义结构校验；文本 foundation 有独立 JSON Schema，但本地 validator 目前没有执行完整 JSON Schema library 校验，只检查 required fields 和业务边界。 |
| Validation 做到什么？ | JSON 可解析、顶层 key / 字段集合、基本类型与长度、required fields、禁止 `application_status`、必须 `needs_review`、evidence 字段名 / 图片编号 / 非空证据。**没有证明引用文字真的支持结论，也没有 factual entailment。** |
| Analysis 是否保存？ | SQLite 只持久化一条 Mock `job_analyses`；真实视觉 candidate / raw model output / model metadata 先保存在浏览器 IndexedDB，确认后随本地 job 保留。 |
| Human Review 是否实现？ | 视觉 / OCR / 原文 candidate 有真实审核表单、编辑、确认和放弃。`job_analyses` 只有事务内 `needs_review → rejected` regression，没有 analysis review API / UI。 |
| 用户能看到什么？ | 原图、OCR 原文或模型原始结构化响应、候选字段及 evidence、token usage、审核表单、保存后的本地职位卡片 / 详情 / 图片。看不到 SQLite `job_analyses` 的产品化审核界面。 |

### 明确未实现

- 自动职位发现、自动轮询、多来源 crawling、登录 / CAPTCHA / anti-bot 绕过。
- 通用“任意 URL → JD”读取；BOSS 与飞书测试只建立了 source/access boundary。
- 真实文本 JD → DeepSeek analysis → `job_analyses` → review UI 的完整产品链路。
- 自动 matching、ranking、简历 / 作品集建议、自动申请。
- Eval dataset / metrics / dashboard、RAG、MCP、Agent、Vector DB、云端多用户产品。

## B. Final System Flow

### B1. 已实现：单来源结构化同步

```text
Allowed Tencent URL
→ bounded HTTP/API read
→ raw JSON capture + SHA-256 + fetch time
→ source-specific normalization
→ identity: source + external_job_id
→ duplicate match against JD-001
→ merge: keep human primary fields and application_status
→ write source_* provenance to SQLite
→ existing Job Radar API
→ existing detail UI
```

### B2. 已实现：真实 DeepSeek 视觉导入

```text
User-selected screenshots + optional canonical source link
→ Browser request to localhost app.py
→ save original evidence images locally
→ read DeepSeek credential from macOS Keychain
→ fixed vision instruction + original images
→ DeepSeek V4 Flash Vision API
→ provider HTTP response
→ extract raw model content
→ JSON / structure / evidence-presence validation
→ browser IndexedDB candidate(needs_review)
→ human compares image / raw output / proposed fields
→ confirm or discard
→ IndexedDB job
→ local jobs gallery / detail / edit / backup
```

### B3. 已实现但只到 Mock：文本 JD analysis foundation

```text
SQLite JD-001
→ provider-independent model input
→ separate instruction
→ Mock Provider
→ raw JSON response
→ parse
→ required-field / boundary / evidence-field validation
→ job_analyses(needs_review)
→ transaction-only human review regression
→ analysis API / analysis UI: designed but not implemented
```

### B4. 已编码但没有真实成功证据

```text
SQLite JD
→ input + instruction
→ DeepSeek text Model API via scripts/call_model_api.py
→ response / validation / job_analyses
```

状态：`implemented adapter, not proven by a retained real-call result`。

## C. What I Actually Understand

以下只依据用户的预测、解释、纠正、产品决定和真实观察，不把 Codex 代码算作理解：

1. **普通 API 与 Model API 的责任不同。** 用户能区分 Job Radar API 是产品自己控制的确定性数据接口；Model API 是后端向外部模型 Provider 发请求并接收不确定输出。
2. **HTTP 成功不等于 AI 分析正确。** 用户明确接受：有 provider response 只证明边界有返回；模型仍可能遗漏、误分类或与原始 evidence 冲突。
3. **Input、Instruction、Output Contract 是三件事。** 用户能围绕“分析哪些 JD / evidence”“告诉模型如何处理”“必须返回什么字段与状态”做独立产品判断，虽然不能独立实现契约代码。
4. **结构正确不等于事实正确。** 用户从 contract-valid 但错误经验要求的 fixture，逐步建立 structure validation、grounding / semantic review 与 human review 的区分。
5. **Provider、Model、Credential 应分开。** 用户主张更换 Provider 时产品层尽量不变，并选择 DeepSeek 作为第一条真实调用；同时能解释 API key 是用户 credential，不能公开进入前端源码 / Git / URL。
6. **Source、OCR、Extraction、Grounding 是不同 failure layer。** 用户多次提出“网页没回应所以没有内容”“OCR 有字但没有映射”“招聘者信息混进要求”“截图路径可能没有传到 OCR”等可检验假设。
7. **Human-owned state 不应被外部来源或模型覆盖。** `application_status` 的最终含义和写入归用户；source facts、derived analysis 和 application state 必须分离。
8. **Local-first / BYOK 是产品责任选择。** 用户决定公开网页的职位、简历、作品集和 model credential 尽量由用户自己的浏览器 / 设备持有，接受清除浏览器数据需要备份的取舍。

仍未证明理解到可独立应用的部分：完整 JSON Schema 设计、Provider payload 差异、Python / JavaScript 实现、数据库 migration、完整 Eval 指标、生产安全与部署。

## D. New Transferable Knowledge

### Causal Model

- 不确定模型位于确定性软件链路中间；前后必须有输入边界、输出检查、失败分支和人工责任。
- 原始 evidence、normalized facts、derived AI analysis 与 user-owned state 必须分层，否则 sync 或 model output 会污染用户事实。

### System Boundary

- Browser ↔ Job Radar API ↔ SQLite 与 Job Radar backend ↔ Provider API ↔ Model 是两条不同的 request / response 边界。
- Provider adapter 隔离供应商格式；产品逻辑不应与 DeepSeek / OpenAI 名称绑死。
- Credential 只用于证明调用权限，不是模型、Provider 或产品数据。

### Failure Model

- `HTTP 200`、`provider response received`、`valid JSON`、`contract_valid`、`grounded claim`、`human approved` 是逐层更强、但互不等价的状态。
- Source access failure、图片覆盖不全、OCR 字符错误、section extraction 错误、model semantic error、persistence bug 和 UI display bug 需要不同修复。

### Trade-off

- OCR-first 省 token 且默认不外发，但在中文长文本、布局和噪声 UI 上会错；多模态模型直接看原图可以改善映射，却增加成本、隐私与概率性失败。
- Local-first 减少服务器持有私人数据和 API key 的责任，但带来浏览器隔离、清除数据、换设备和备份恢复问题。
- 完整 prompt 的固定 token 并不是总成本主因；缩短 prompt 可能损失召回且总 token 仍可能增加。

### Decision Method

换一个 AI 产品仍可使用：

```text
Evidence available?
→ deterministic rules sufficient?
→ model input boundary
→ instruction
→ output contract
→ validation layers
→ human responsibility
→ persistence boundary
→ normal/failure regression
→ Eval before automation expansion
```

## E. User-owned Evidence

### Product

- 决定 `application_status` 始终属于用户，不被 source sync 或 model output 修改。
- 决定 source evidence 与 normalized / human fields 分离；外部冲突不能静默覆盖人工修正。
- 决定 AI analysis 是 derived data，应有独立 review lifecycle，不污染 `jobs`。
- 决定截图候选必须先审核；多图是同一 JD 的 user-owned grouping。
- 决定保留完整视觉规则，移除质量回退的 compact prompt 选择。
- 决定 URL 默认只作 provenance；无法稳定读取的来源使用截图 / 原文证据。
- 决定公开产品长期采用 local-first 个人数据方向，而不是默认多用户 SaaS 数据库。

### AI System

- 能指出 API 请求成功仍可能没有“具体正确信息”。
- 能指出 source content 与人工记录冲突属于 evidence / grounding 问题，而 provider 无响应属于 boundary 问题。
- 主张每个 capability 必须带 `evidence_fields`，否则无法回溯模型为什么得出结论。
- 能说明 schema / backend / persistence / output review 承担不同检查责任。
- 选择 DeepSeek 作为第一 Provider，并要求以后更换 Provider 时尽量不改变产品层。

### Architecture / Security

- 主动追问网页输入 API key 的泄露、网站被攻陷、SaaS 与本地客户端差异。
- 决定当前 Mac 开发版把 Key 放 macOS Keychain；公开网页长期要让用户自己控制数据和模型连接。
- 认识到“网站不保存 key”不等于完全没有浏览器脚本、恶意扩展或被攻陷页面读取输入的风险。

### Debugging / Diagnosis

- 提出腾讯页面可能只有 shell / 未返回 JD，故不能直接写 SQLite。
- 提出 OCR 文本存在但 review fields 全 unknown，原因可能是 Extraction → Structured Candidate mapping 未实现或规则不足。
- 提出粘贴截图 → localhost OCR 的传输路径可能失败，并要求按输入、base64、backend、Vision、response 分层检查。
- 发现招聘者信息被写入任职要求，是 section boundary / semantic filtering failure，不是 OCR 是否有字的问题。
- 发现职位详情只显示第一张截图和弹窗中缺编辑按钮，形成可观察 UI regression。

## F. Tool-assisted Evidence

主要由 Codex / AI 完成，不能直接记为用户 Coding L2：

- Python HTTP server、SQLite schema / migration、SQL query、Tencent source adapter、normalizer、duplicate / merge / sync scripts。
- Provider registry、DeepSeek request payload、Keychain subprocess、Mock Provider、stable analysis ID、`job_analyses` persistence。
- JSON contracts、JSON Schema、validator、failure fixtures、review regression 和 Python / JavaScript syntax checks。
- macOS Vision OCR adapter、base64 image intake、multi-image evidence storage、rule-assisted normalizer。
- local-first IndexedDB candidate / jobs stores、backup / restore / clear、gallery、detail、edit和多图切换 UI。
- 具体 HTTP probes、测试脚本、数据迁移、文件与 Canonical Context 更新。

## G. Failure / Debug Evidence

| Observed Symptom | User Hypothesis / Judgment | Evidence Checked | Failure Layer | Fix | Regression |
| --- | --- | --- | --- | --- | --- |
| Tencent page GET 200 但无 JD 字段 | 页面可能没有真正回应职位内容 | raw HTML 只有 bootstrap；后续 public API JSON 有 PostId / JD | Source response / page shell | source-specific API contract | expected PostId、字段、raw hash、duplicate / sync regression |
| BOSS URL 无法读 | 不是 schema / AI 问题，而是来源没有内容 | 11 次授权 single GET 均 302 / zero body | Source access | 不绕过；link-as-provenance + screenshot fallback | batch probe report |
| OCR 有文字但 fields 全 unknown | 缺 Extraction → Structured Candidate 映射 | 对比 OCR lines、heading rules、candidate form | Extraction / normalization | fail-closed rule-assisted extractor | JD-014 / Alibaba fixtures and manual observation |
| OCR 输出乱码 / `AI → Al` | 可能是截图像素 / 缩放 / OCR 限制，不应让 text model 猜 | 重跑原图、比较 raw OCR 与原图 | OCR | 保留原图、人工审核、可选 direct vision | five-image boundary sample |
| 招聘者 / CTA 混入任职要求 | section boundary / unrelated UI filtering 错 | 对比原图布局和 extracted section | Semantic extraction | vision instruction 排除 recruiter / CTA / ads；review remains | visual candidate user check |
| Model output JSON 合法但“三年经验”错误 | evidence field reference 不等于语义支持 | misleading fixture 对照 JD seniority / requirements | Grounding / semantic validation | 保持 `needs_review`；未来 Eval / stronger grounding | validator deliberately passes contract but human detects error |
| Model 返回 `approved` 并写 application status | 模型越过 user-owned boundary | invalid fixture | Output contract / responsibility | validator rejects and does not persist | analysis count unchanged |
| 详情弹窗只有首图、无编辑按钮 | UI detail 没消费完整 evidence / action | IndexedDB record 有多条 `evidence_paths` | UI rendering | detail 内加编辑；所有截图 thumbnails | JS syntax / served-script check；等待用户最终可见复测 |

用户已经开始使用 layered diagnosis，但多数 `Evidence Checked → Fix → Regression` 仍由 Codex 执行，故 Debugging 只到 L1。

## H. Capability Reassessment Table

### Software / System

| Capability | Current Level | Confidence | User-owned Evidence | Tool-assisted Evidence | Missing Evidence to Next Level |
| --- | --- | --- | --- | --- | --- |
| Software Flow | L1 | high | 能解释 browser / app.py / API / SQLite 和 local-first / IndexedDB 两条流 | 完整实现与测试 | 用户独立追踪一条 request 的 input / transform / output / failure 并修改共同入口 |
| Structured Data | L1，Apply candidate | high | 主导 unknown、字段所有权、source / derived / user state 分层 | schema、JSON contract、migration | 用户亲自修改 contract / schema 并预测正常和失败影响 |
| Persistence | L1 | high | 能区分 SQLite、IndexedDB、页面刷新、备份；保护 application status | SQLite / IndexedDB implementation | 独立修改 persistence rule 并验证 reload / duplicate / recovery |
| HTTP / API | L1 | high | 区分 collection / record、ordinary API / Model API、source HTTP failure | routes、requests、status handling | 用户独立检查 request / response / status 并修复一个 API failure |
| Debugging / Diagnosis | L1 | medium | 多次提出正确层级假设并发现 UI / mapping failure | 绝大多数定位、fix、regression | 用户主导复现 → 证据检查 → 修改 → 相邻回归 |
| Technical Architecture | L1 | medium-high | 决定 local-first、provider boundary、link provenance、review boundary | 具体 adapter / storage / routes | 比较两个架构、明确非功能约束并亲自验证失败代价 |

### AI Systems

| Capability | Current Level | Confidence | User-owned Evidence | Tool-assisted Evidence | Missing Evidence to Next Level |
| --- | --- | --- | --- | --- | --- |
| Model API | L1 | high | 能解释外部模型服务 request / response 和概率性结果 | DeepSeek vision call code | 用户独立修改一次 input / instruction / validation 并复跑真实 call |
| Provider / Model / Credential | L1 | high | 选择 DeepSeek；要求 Provider 可替换；理解 key 是 secret | registry、Keychain code | 比较两个 Provider 的真实响应 / failure / cost，而非只接第二个 adapter |
| Model Input Contract | L1 | medium-high | 能判断应含 JD / evidence、不含 application status | build_model_input | 用户亲自增删一个输入字段并解释信息收益 / 隐私 / token 影响 |
| Prompt / Instruction | L1 | medium | 理解 instruction 与 JD data 分开；选择保留完整规则 | prompt v1/v2 实现 | 用户亲自修改一条规则并以固定 truth set 观察质量变化 |
| Structured Output | L1 | high | 知道任意文本难以验证、映射和持久化 | JSON mode / schema / parser | 用户定义一次最小 output contract 并处理缺字段 / extra field |
| Validation | L1 | high | 能区分格式、backend / DB约束、人工内容检查 | validator / fixtures | 用户主导新增一条 validation rule、制造失败并回归正常样本 |
| Grounding | L1 | medium-high | 主张 capability 必须有 evidence；识别 source conflict | evidence_fields / image quotes | 对固定 truth set 做 claim-level supported / unsupported 判定 |
| Human Review | L2 Apply | high | 决定哪些状态必须用户确认、哪些不能自动覆盖 | review UI / lifecycle regression | 设计 review workload / escalation / reviewer agreement 并以真实数据评估 |
| AI Failure Model | L1 | medium-high | 能区分 provider boundary、OCR、mapping、grounding、UI | failure fixtures / logging | 用户独立完成三次不同层 failure diagnosis 与修复回归 |
| Eval Awareness | L1 | medium | 主动要求用多个 JD、token 与正确率比较；接受 coverage / OCR / mapping 分开 | two-item A/B and boundary sample | 冻结 reviewed truth set、metrics、baseline、error taxonomy、repeatable regression |

### Product

| Capability | Current Level | Confidence | User-owned Evidence | Tool-assisted Evidence | Missing Evidence to Next Level |
| --- | --- | --- | --- | --- | --- |
| AI Feature Definition | L2 Apply | high | 决定 OCR default、vision opt-in、review gate、link provenance | implementation | 用外部用户 / usage data 验证价值和触发条件 |
| AI Product Judgment | L2 Apply | high | 多次拒绝无学习价值 UI、generic crawler、compact prompt、自动覆盖 | implementation options | 跨两个产品重复做价值 / 风险 / cost decision |
| AI Boundary Judgment | L2 Apply | high | 区分 deterministic rule / AI / human responsibility | technical guards | 在真实发布环境验证隐私、安全和 fallback |
| Product Architecture | L2 candidate | medium-high | public web + local data / BYOK direction；source / candidate / job / analysis 分层 | concrete local architecture | 完成 Automation Gate 并选择一条 MVP architecture |
| Technical Product Communication | L1，L2 candidate | medium | 能用自然语言描述 mapping / boundary / override 问题 | Codex 将其翻译为 contracts / code | 独立画出流、定义验收并与实现结果逐项核对 |
| Human / AI Responsibility Design | L2 Apply | high | application status / final confirmation / submission approval归人 | constraints / UI | 评估 review burden、误放行与拒绝错误 |
| Reliability Thinking | L2 candidate | medium-high | 要求 evidence、unknown、failure、regression、full prompt | validators / regression | 建立可量化 reliability target 和 Eval loop |

### AI Coding

| Capability | Current Level | Confidence | User-owned Evidence | Tool-assisted Evidence | Missing Evidence to Next Level |
| --- | --- | --- | --- | --- | --- |
| AI Coding Accountability | L2 Apply | high | 能区分 AI 实现与自己的判断；指出黑箱与错误完成 | all code | 在一次变更中独立审查 diff / tests / residual risk |
| Reading AI-generated Implementation | L1 | medium | 能定位 app.py / schema / JS 大致责任，但不记语法 | code explanations | 独立读关键函数并预测改动影响 |
| Modifying AI-generated Systems | L0–L1 | high | 主要是自然语言提出修改，未亲自改代码 | all edits | 用户亲自完成一个小 contract / validation / UI mapping 修改 |
| Debugging AI-generated Systems | L1 | medium | 能观察和提出 failure hypothesis | fixes / regressions | 独立最小复现、读证据、改动与回归 |
| Independent Coding | L0 | high | 无独立 coding evidence | 完整系统由 Codex 协助实现 | 不以本项目强行训练；未来仅在职业活动真正需要时复审 |

## I. Capability Delta Since Master Synthesis V1

### Clearly Improved

- Software Flow：从 L0 / L1 awareness 进入可信 L1。
- Structured Data / Persistence / HTTP API：从 L0–L1 gap 进入可信 L1，并有多次产品应用判断。
- Model API / Structured Output / Validation：从“路线图术语”进入真实 DeepSeek 视觉调用和可观察 failure boundary，达到 L1。
- Debugging：从没有用户验证证据进入 L1 layered hypothesis / symptom observation。
- Technical product explanation：已能使用来源、输入、映射、保存、输出和 failure 描述问题，不再只说“功能坏了”。
- Human / AI responsibility 和 AI Feature Definition：形成 L2 Apply 产品证据。

### Strengthened But Same Level

- Eval：从 intent 发展到 A/B 和 failure taxonomy awareness，但没有冻结 dataset / metrics / repeatable report，仍是 L1。
- Technical Architecture：架构判断增强，但实现和比较验证主要由 Codex 完成，保持 L1 / L2 candidate。
- Reading / debugging code：对文件责任更熟，但未形成独立修改证据。

### Still Tool-assisted

- Python、JavaScript、SQL、schema migration、provider payload、Keychain、安全处理、JSON validator、IndexedDB、tests / regression。
- 真实系统运行不等于用户能独立重建或维护。

### Still Missing

- Independent Coding、完整 diagnosis / fix / regression L2。
- 真实文本 JD analysis 的可回放 provider result 和 analysis review UI。
- 正式 Eval、RAG / retrieval execution、MCP、Agent、自动 job discovery、自动 application。
- 云部署、多用户隔离、生产 credential / threat model 和真实外部用户数据。

## J. AI PM / Design Technologist Capability Growth

Phase 3 真正增强了：

- **Product Definition**：把“自动读职位”拆成来源、证据、候选、审核、保存与回溯。
- **System Thinking**：能讨论 browser、backend、database、Provider、model、review 的上下游责任。
- **AI Feature Definition**：知道何时用 OCR、何时用户主动开启视觉模型，以及不能让模型自动决定什么。
- **Technical Literacy**：能与工程 / AI coding system讨论 API、credential、input、instruction、output、validation 和 failure layer。
- **Model Reliability Thinking**：接受模型成功返回仍可能错，要求 evidence、unknown、review 和未来 Eval。
- **Human-in-the-loop Design**：把 user-owned application status、candidate confirmation 和 future final submission approval留给人。
- **Architecture Trade-off Judgment**：能比较 local-first / SaaS、OCR / multimodal model、generic URL / source-specific adapter、full / compact prompt。
- **AI Coding Accountability**：能指出 Codex 实现不是自身 coding evidence，并通过产品判断纠正实现偏移。

它支持 `AI Design Engineer / Design Technologist / Design-led AI Product Builder / AI PM adjacent` 的增长结论；**不支持 Software Engineer、Backend Engineer、ML Engineer 能力结论**，因为独立编程、生产系统、模型训练、数据工程和持续运维均缺证据。

## K. Remaining Gaps

1. 没有正式 Eval：只有小样本 A/B 和 qualitative observations。
2. 真实文本 JD analysis 尚未完成 productized call / review UI。
3. SQLite 14 jobs 与浏览器 IndexedDB jobs 是两个并行数据世界，没有统一迁移 / identity contract。
4. local-first 公开网页与当前 localhost Keychain / Python adapter 仍不是同一个可部署架构。
5. 没有自动 discovery、matching、ranking、resume suggestion 或 application workflow。
6. 没有真实外部用户、使用频率、纠错成本、质量目标和 retention evidence。
7. `evidence_fields` / quote presence 不等于语义 grounding；claim-level Eval 尚缺。

## L. 100 Questions Sync

新增 Q-022–Q-030，且不重复 Q-015 / Q-016：

- Q-022：普通产品 API 与 Model API 的责任为什么不同？
- Q-023：为什么 HTTP 200 / provider response 不代表 AI 结果正确？
- Q-024：Model Input、Instruction 与 Output Contract 为什么必须分开？
- Q-025：Structured Output 解决什么问题，为什么 schema-valid 仍可能事实错误？
- Q-026：Provider、Model 与 Credential 为什么应该分开？
- Q-027：AI product harness 是什么，为什么不等于模型或产品逻辑？
- Q-028：Eval 与普通软件测试有什么不同？
- Q-029：Human Review 为什么不能被 schema validation 替代？
- Q-030：BYOK / local-first 获得什么，又把哪些责任交给用户设备？

Q-016 同步扩展 AI failure layers：Source → HTTP → Backend → Credential → Provider → Model → Parsing → Contract Validation → Grounding → Persistence → UI。

## M. Files Updated

本 Closeout 的权威更新目标：

- Project：`PHASE_3_FINAL_SYNTHESIS.md`、`PROJECT_STATUS.md`、`TECHNICAL_EVIDENCE.md`、`NEXT_PHASE_HANDOFF.md`、`README.md`、`文件说明.md/.pdf`。
- Learning：`LEARNING_LOG.md`、`KNOWLEDGE_MAP.md`、`AI_BEGINNER_OBSERVATION_LOG.md`、`AI_BEGINNER_QUESTION_INDEX.md`。
- System：`TECHNICAL_EVIDENCE_INDEX.md`、`PROJECT_INDEX.md`、`DECISION_LOG.md`。
- 明确未修改：`MASTER_SYNTHESIS.md`、Batch 01–07、Career Hypotheses。

## N. Phase 3 Exit Status

`JOB RADAR PHASE 3 IMPLEMENTATION = COMPLETE — bounded local-first intake / real vision extraction / review / persistence slice`

`JOB RADAR PHASE 3 LEARNING CLOSEOUT = COMPLETE`

`JOB RADAR PHASE 3 EVIDENCE SYNC = COMPLETE`

解释：Phase 3 完成不表示所有“AI analysis”愿景完成。真实文本 JD analysis、analysis review UI 与正式 Eval 被明确留作未实现能力；它们不阻止已约定的视觉导入 vertical slice 关闭。

## O. Automation Feasibility Preview

| Capability | Preview | 当前理由 |
| --- | --- | --- |
| Automatic Job Discovery | Uncertain | 技术可行性取决于合法、稳定、可读的 source/API/feed；BOSS / 飞书已显示来源访问不是模型可解决的问题。 |
| Automatic Matching | Likely | 可先用结构化字段、关键词 / SQL 与 bounded model comparison；目前不需要 RAG。 |
| Resume / Portfolio Suggestions | Likely | 只能基于真实 Career Evidence 提建议，必须 human review，并把 unsupported claim 作为核心 Eval failure。 |
| Automatic Application | Uncertain / partial | 材料准备和表单草稿可能自动化；登录、CAPTCHA、平台条款和外部副作用限制较大；最终提交必须明确人工批准。 |
| RAG | Not Yet Justified | 当前 corpus 和规模尚未证明 direct context / metadata retrieval 不够。 |
| MCP | Not Yet Justified | 当前没有模型需要统一调用多个稳定外部工具的真实问题。 |
| Agent | Not Yet Justified | 当前流程可由 deterministic orchestration + explicit user actions 完成；动态规划、多工具状态与重试需求尚未出现。 |

## P. Next Phase

下一阶段固定为：

`AUTOMATION FEASIBILITY & ARCHITECTURE GATE`

**ONE NEXT ACTION：**建立一张 `Capability → User Value → Required Data → Allowed Access Method → Deterministic / AI → Human Approval → Failure / Risk → MVP` 决策矩阵，先比较 Automatic Discovery、Matching、Resume / Portfolio Suggestion 与 Application 四条能力，再只选择一条 Automation MVP。

本 Closeout 不自动开始该动作。

## Q. UI Status

`UI POLISH = DEFERRED UNTIL CORE AUTOMATION / RELIABILITY STABILIZES`

当前 UI 只需保证输入、证据、loading / error、review、保存和回溯可理解；不在 Phase 3 Closeout 扩大视觉美化。
