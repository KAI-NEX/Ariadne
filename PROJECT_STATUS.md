# AI Job Radar｜Phase 4 Status

## 2026-09-09 — 持续个人理解 v1 与综合对话入口（本阶段 COMPLETE）

- 实施用户授权的持续理解第一版闭环：个人资料内新增「个人理解」页面，跨资料综合当前经历、来源关联与未知；对话中的事实、偏好、目标和修正先成为可编辑 Proposal，Human Save 后才进入个人确认记忆。Candidate/JD 原卡片及 Job 确认版本不被普通讨论静默修改。卡片、来源工作区和 JD 用户消息可转入有出处的个人补充草稿。
- 数据库 v15 → v16 仅增量添加六个 store，统一既有 opener。确认记忆追加版本，明确拒绝、重复保存、版本冲突、来源变化和停止使用边界；修正保留完整来源绑定，包括本轮只发送节选的长资料。旧来源、Blob 和历史原地保留。
- 新增按指纹复用的片段摘要与当前全局理解，资料/prompt 变化使旧理解失效。个人对话上下文上限 48 KB；JD 个人详细证据、历史和变更分别受预算约束，发送覆盖说明。词项检索只负责挑选，不冒充语义理解。过时聊天和旧记忆 delta 不回流为当前个人事实。
- 验证：以 `ff2e114` 加本阶段文件构成独立验收树，42 Node + 23 Python = **65/65** 默认 suite 通过；legacy analysis_review 另使用现有本地 fixture 数据库的只读备份运行，原库不变。共享工作区另有并行 VI/图标调整，整区当时为 63/65，两个失败来自未完成的图标断言；未放宽它们，也未纳入本阶段提交。新增长资料节选后保存、prompt 缓存失效及旧记忆历史排除回归。
- egolite 独立 :8020 合成人物/材料真实验证：两材料职责冲突、待确认而不写入、保存后刷新、偏好 v2 替换及 v3 停止使用、拒绝不改变确认内容、修正关联两份材料、JD 收到最新个人补充、JD 原话转入个人理解草稿。v15 合成 Blob 升级后逐字不变。真实更新复用两段摘要、只理解两段新增补充；再次更新 Provider 调用 0。未把私人材料发送 Provider。
- 真实模型初次综合因文本契约失败，后续收紧输出长度/空项/正文引用以及来源、空字段、职责推断规则；复验正确采用本人责任修正并保留未知，JD 明确不从部署职责推断未说明的设计/取舍职责。结构测试不替代语义判断，不宣称完全理解一个人。1280 px 与 390 px 布局、窄屏对话跳转、保存/拒绝及历史可见性已检验；egolite 截图 helper 在滚动位置产出空白，保留该产物并用同一浏览器原生 CDP viewport 截图完成复验。
- 已核对新根进程身份后重启 :8000，7 项新增/变化静态文件与当前文件逐字一致、个人理解运行签名一致。实施说明、边界和后续方向见 [持续个人理解 v1](docs/current/ARIADNE_PERSONAL_UNDERSTANDING_V1.md)；日志、合成请求/响应及截图保留于忽略目录 `.cache/personal-understanding-implementation-20260909/`。
- 本阶段仅本地 commit；并行视觉规范、介绍页和相关未完成改动原地保留，未写旧 Learning OS、未清理原文件、未 push。完整职业行动反馈、跨设备同步和语义向量检索尚未实现。


## 2026-09-09 — 中文品牌标题视觉校准（COMPLETE）

- 「衡」改为 Ariadne 字号的 86%（桌面 37.84 px、窄屏 32.68 px），按中文字形实际视觉高度校准，取代前序等字号处理；颜色改为灰色 `#7a7f89`，其他内容与交互不变。
- 沿用 egolite 截图技术故障后的 Chrome/Playwright 回退，验证 Workspace 标题打开、字号/颜色及返回，无 pageerror；审阅桌面 1280×800 与窄屏 390×700 截图，证据原地保存在 `.cache/about-popup-20260909/optical-gray-*.png`。仅提交此标题样式与记录，其他任务改动保留。

## 2026-09-09 — 删除介绍浮窗底部说明（COMPLETE）

- 按用户要求删除「衡」寓意及“目标由你选择，修改由你确认”两句底部文案，同时移除该段独用的分隔线样式；其他正文与交互不变。JS 语法、UI framework 回归及 diff 检查通过，HTTP 核对新模板已生效；本次纯文案删除未重复浏览器视觉验收。其他任务改动保留。

## 2026-09-09 — 介绍浮窗字号与后续对话说明（COMPLETE）

- 「衡」与 Ariadne 使用同等标题字号/字重（桌面 44 px、窄屏 38 px）。补充「了解我」和「了解职位概况」两个整体 AI 对话入口的规划，明确写明“正在搭建”“后续”，本次仅改介绍文案，不实现或宣称这些功能已完成。
- egolite 验证标题打开及正文；沿用截图技术故障后的 Chrome/Playwright 回退，审阅 1280×800、390×700 截图，验证同等字号、文案、无横向溢出及返回行为，无 pageerror；既有 UI framework 回归通过。证据保留于 `.cache/about-popup-20260909/copy-*.png` 及 `verify-copy.cjs`。其他任务未提交修改保留，仅提交本次字号、文案及记录。

## 2026-09-09 — Ariadne · 衡 介绍入口改为浮窗（COMPLETE）

- 按用户最新要求，Workspace 标题不再跳转独立页面：点击 Ariadne 从字标位置展开为简短介绍浮窗，说明产品用途、可做的事与「衡」的寓意。复用已有详情浮窗的展开/缩回动画（540/480 ms）及系统 `v1-back` 返回图标；点击左上角、浮窗外侧或 Esc 返回原处。
- 新样式仅在 Workspace 加载；支持窄屏、减少动态效果偏好、键盘焦点约束及关闭后的焦点恢复。原 `about.html` / `about.css` 保留原地，不再作为标题入口，本次不增加账号、下载或部署功能。
- 验证：3 项现有 Node 回归（UI framework、shared product shell、UI contract addendum）通过。egolite 验证标题打开、不换 URL、返回；截图技术超时后使用已安装 Chrome/Playwright 验证返回按钮、外侧、Esc、Tab、打开中途关闭、减少动态效果、390 px 窄屏，以及个人资料/职位原有 iframe 浮窗。无 pageerror；1280×800、390×700 和展开中间态截图已审阅，修复预览字标继承网格列导致的偏移。证据保存在忽略目录 `.cache/about-popup-20260909/`。
- 本地提交仅包含 Workspace 入口、介绍样式、共用浮窗中本次相关代码及此记录；并行个人理解任务的未完成改动保留、不纳入提交。无真实 Provider 请求或发布。

## 2026-09-09 — Ariadne · 衡 产品介绍页（COMPLETE）

- 文件夹选择页（Workspace）顶部 Ariadne 字标链接至 `about.html`。新增独立介绍页及作用域 CSS，延续既有字体、浅灰背景与深色按钮；包含中文品牌名「衡」、英文名典故、产品用途、三项现有能力、资料与保存边界、可展开 FAQ、本地启动说明和返回应用入口。
- 用户澄清“可登录”指能正常打开并进入应用，本次不新增账号系统。中文名是「衡」，不是音译；页面以“衡量、分寸、判断与取舍”表述本次用户提供的文化方向，不冒称已找回历史讨论原话。稳定命名已补入 PROJECT_CONTEXT。
- 下载区域标注“后续开放”，没有安装包、假下载按钮或发布承诺。提供已有源码项目在 Codex/终端打开、`python3 app.py` 启动、通过 localhost 使用的步骤，并说明当前 macOS 文档处理条件。
- 验证：既有 `step_02_03_ui_framework_regression.mjs` 通过。egolite 验证 Workspace 字标跳转与正文；截图接口技术超时后，使用已安装 Chrome/Playwright 完成 1280×900、390×900 截图审阅，修复共用旧 `main` 样式造成的窄内容区。复验标题、FAQ 展开/收起、页内锚点、5 个本地目标 HTTP 200、返回文件夹页面通过；无横向溢出、无 pageerror。证据保存在忽略目录 `.cache/about-page-20260909/`。
- 仅提交介绍页、字标链接及本条记录/命名约定；其他任务正在进行的个人理解、领域、存储和共享界面改动保留，不纳入本阶段提交。未进行真实 Provider 请求或发布部署。

## 2026-09-09 — 个人理解架构审计与快照移除一致性修复（本阶段 COMPLETE）

- 完成 [个人理解与 Candidate × Job 审计](docs/current/ARIADNE_PERSONAL_UNDERSTANDING_AUDIT.md)：JD 每轮实际接入跨资料最新个人快照；Candidate 详情仍限定当前卡片，来源工作区限定当前来源；尚无跨来源长期个人模型及 JD 新信息经提案保存回 Candidate 的闭环。不能宣称项目已实现“越聊越了解整个人”。
- 修复已移除卡片通过未接受的 Working 回流到 JD；移除记录只认可用户决定 authority，按 source/item 身份过滤，保留其他来源的独立条目。修复全部移除及仅未确认 legacy 数据时的空快照误报，保留异常接线的 fail-closed 检查；历史与来源不被快照编译改写。
- 41 Node + 22 Python = **63/63** 默认回归通过；新增移除回流用例修复前失败、修复后通过。egolite 隔离合成浏览器 4 轮验证跨资料入模、人工修正传播、逐项移除与合法空资料；生产后端校验后的 Provider payload 候选数量为 `2/2 → 2/2 → 1/1 → 0/0`（Confirmed/Working）。测试在外部请求前主动停止，Provider 调用 0，失败状态正确，历史保留。
- 仍未覆盖真实模型对私人多材料的理解质量；长期记忆、冲突综合、超长上下文，以及既有个人编辑预览不展示摘要变化的问题见审计。egolite 截图技术超时，本次以 DOM、IndexedDB 及后端 payload 作为交互证据，不声称布局验收。产物保留在忽略目录 `.cache/personal-understanding-audit-20260909/`。
- 本阶段仅本地提交相关实现、回归与项目记录；无 Provider/model 更换、原始文件清理、旧 Learning OS 写入或 push。

## 2026-09-09 — 文件上传上限统一为 30 MB（COMPLETE）

- 按用户要求，个人资料与职位描述上传的文档和 PNG/JPEG 均调整为每文件 ≤30,000,000 bytes（十进制 30 MB）；旧职业资料入口同步采用同一应用限制。后端共用 `src/upload_limits.py`，同步覆盖 Local 读取/OCR、Model 来源读取、Candidate/Job Model 原始输入校验；单文件 HTTP 请求允许 40 MB Base64 加 1 MB 元数据，多图请求允许四份满额文件的编码体积加元数据，仍保留有界请求。
- 原 8 MB 是早期 Local intake 的应用常量，见本文件历史 Inputs 条目及 TECHNICAL_EVIDENCE 的 Local intake boundary。历史记录未解释为何恰好选择 8 MB，没有依据把它归因于服务商硬限制；图片原先另限 5 MB。Provider 能力目录中的自身限制保持原义。
- 超限弹窗和两域提示同步为 30 MB；职位批量选择现在显示实际拒绝原因。连同上一轮已验证的“已保存在本机的 PDF”→“资料”文案一并收口。
- 验证：6 Node + 6 Python 相关回归文件通过，包括新增所有支持格式恰好 30 MB 接收、超 1 byte/空文件拒绝、后端 PDF/PNG/JPEG 解码与 hash 边界，以及 8 个真实 HTTP handler 的完整 Base64 请求读取/超限拒绝（下游执行用测试替身停止）。原有来源持久化、Local/Model 和领域回归通过。
- egolite 在正常 `:8000` 页验证个人资料 30 MB 合成文件选入及超限弹窗、职位 30 MB 合成图片选入及超限提示。浏览器仅验证选择与大小限制，未执行这些合成文件的 PDF/OCR/模型语义处理或 Human Save；未发起真实 Provider 请求。没有以本次验证宣称任意 30 MB 复杂文件的识别质量。
- 已启动本项目 `:8000` 服务供刷新使用；按阶段规则创建本地 commit，不 push。

## 2026-09-08 — 全操作多模态模型接入修复（COMPLETE）

- 用户明确要求所有可调用模型至少能理解图片和 PDF，后续 Gemini/其他 Provider 同样适用。规则已写入 AGENTS、PROJECT_CONTEXT 和 Runtime Contract 顶部增量条目；取代历史 Pro 对话例外，原历史记录保留。
- 根因：Runtime selector 通过 `ai_conversation=supported` 单独放行纯文本 `deepseek-v4-pro`，首页又自动给对话分配 Pro；旧的 `connection_verified` 记录也可恢复为 READY。现已在共用能力门槛、选择器、旧配置恢复、操作路由及后端执行/连接边界阻断这些路径。
- DeepSeek 可执行模型仅保留 `deepseek-v4-flash-vision-exp`；Candidate/Job 对话迁至同一模型（adapter v8/v10），保留领域 schema、Working、人工保存、版本及来源边界。旧 Pro 不自动替换：刷新后提示重新选择；用户选定 Vision 后才更新相应操作分配。历史来源和已有对话记录不迁移、不删除。
- PDF 能力要求原生 PDF 或完整逐页转图；纯文本/OCR 路径和未知模型名称不构成多模态认证。Gemini 文档发现增加确切模型白名单，直接连接请求拒绝未知 ID；未完成 Ariadne 领域适配的 Gemini/Qwen 连接不再成为可执行 Runtime。本阶段未新增这些 Provider 的领域能力。
- 验证：40 Node + 21 Python = **61/61** 自动回归通过（含新跨 Provider 门槛、旧配置保留、伪造能力标记、文本/未知模型在凭据读取前拒绝）；22 个受影响 JS/Python/JSON 文件语法检查及 diff 检查通过。真实 DeepSeek 合成测试通过：图片读取、两页 PDF 逐页转图按序读取、Candidate/Job 各一次讨论及一次修改提案，共 6 次推理；没有私人材料或确认数据写入。
- 浏览器：egolite 在独立 `:8001` 验证旧 Pro 阻止继续、仅 Vision 可选、显式选择后导入/对话分配收敛、历史记录保留、Local 可选及进入 Workspace。egolite 截图技术超时后，使用已安装 Chrome 的 Playwright 完成 1280×800 截图核对；无新增 JS 异常，既有 Google Fonts CSP 阻止记录与本修改无关，未扩大修改范围。
- 已核实原进程 cwd 后重启正式 `:8000` 服务；8 项 HTTP 检查通过，包括新模型列表、对话签名及 Pro 请求 422/Provider=0。证据原地保存在忽略目录 `.cache/multimodal-api-20260908/`，不提交凭据、运行数据或 QA 产物。
- 验收边界：真实合成 Provider 测试与浏览器选择流程分开记录；未以此宣称复杂私人 PDF 识别质量或完整个人资料端到端重新验收。完成后按当前项目规则创建本地 Git commit，不 push。

## 2026-09-08 — 迁移与项目规范阶段 Git 收口

- 用户明确要求提交当前项目，并将“每次大阶段完成且验收通过后主动创建一次本地 Git commit”作为后续工作规则；已写入 AGENTS.md，取代旧的不自动提交约定。此授权不包含 push、发布或额外清理。
- 本次提交范围为已完成的迁移/切换记录、README 与文档入口、项目专用 AGENTS/PROJECT_CONTEXT、gate #16 精确断言修复，以及迁移时已排除的 4 张 tracked 私有 QA 图片。原始图片继续保留在旧归档位置，未执行新的文件删除。
- 运行验收沿用本阶段已完成的 59/59 regressions、70/70 HTTP 及浏览器/数据完整性证据；后续改动仅为项目文档与提交规则，不改变运行代码。提交前检查文档链接、diff 格式与暂存文件范围。

## 2026-09-08 — 项目专用工作规范与上下文整理

- 用户重新明确主线：先理解个人资料，再理解用户选择的职位描述，通过有依据的关联、澄清与建议帮助用户逐步接近目标职位。
- 新增 AGENTS.md 与 PROJECT_CONTEXT.md，择要整理项目规则、领域边界和现有设计决策；只引用本仓库已有契约与证据，不整份复制旧系统规范或个人学习记录。
- README、docs/README 与 NEXT_PHASE_HANDOFF 增加当前入口及历史状态/授权说明，保留原正文和既有迁移收口记录。产品愿景与已实现范围分开；未启动新功能、未更换应用 Provider/model。
- 本次仅改项目文档；40/40 本地链接有效，四份既有文档原正文按原顺序保留，核对范围内 128 个旧目录文件无变化，既有改动保留，diff 检查通过且暂存区为空。未重跑产品回归或真实 Provider 请求，既有运行验收仍引用下方记录。

## 2026-09-08 — Human 正式切换与 Phase B

当前状态：**CUTOVER COMPLETE / PHASE B COMPLETE / ARIADNE ACTIVE**。用户已明确确认 `/Users/kai/Documents/GitKaiNex/Ariadne` 为正式开发目录，并授权按首次迁移快照 §15 清理旧实现。此前 READY FOR CUTOVER / Human confirmation pending 为前序历史状态。

本轮清理已完成：按 74 个显式路径组移除 1,044 files；旧根 124 个原文件保留（123 个逐字节不变，README 仅加归档提示并保留原正文），另新增 RELOCATION_POINTER.md。清理后从新根直接执行 app.py，PID 85159；39 Node + 20 Python = 59/59 regressions、70/70 HTTP（63 静态字节对照）再次通过。255 个现行实现/测试/数据文件及 57 个原始浏览器 Blob 哈希不变，SQLite 完整性正常；main 37 commits/HEAD 不变，暂存区为空。无真实 Provider 请求，本轮未重复浏览器 UI 验收。

删除前核对：旧 1,168 files 无漂移；93 个 data/ 非缓存文件一致；原 Git 历史/对象完整，新仓库 main HEAD 不变，现有未提交内容保留。执行记录和每文件清单见 [Phase B 执行记录](/Users/kai/Documents/Codex/AI-Learning-OS/06_reports/ARIADNE_CUTOVER_PHASE_B_2026-09-08.md)。

旧根保留学习/历史/私有档案，入口见 [归档入口](/Users/kai/Documents/Codex/AI-Learning-OS/03_projects/job-radar/RELOCATION_POINTER.md)。本次不自动 commit，不修改产品代码，不发送模型请求，不启动 J2。Phase B 后旧根直接运行/回退方式失效，恢复需从新仓库及已保全的最新数据进行。

## 2026-09-08 — Ariadne 新目录迁移验收（READY FOR CUTOVER）

- 新 root：`/Users/kai/Documents/GitKaiNex/Ariadne`，`main @ a2b3512`。gate #16 的既有失败为 global-convergence 测试未同步 2026-09-05 hotfix 的 `canonicalRevision` 参数；依据确认版本 → 同源 Working 补齐/保留 pending edits/幂等性及 Human Save 契约，仅修正一条精确测试断言并加注释，运行代码不变。
- 复验全部通过：39 Node + 20 Python regressions、84 JS syntax、50 Python compilation、70 HTTP checks、Git diff/fsck。新位置现有 PID 77200 的 cwd/entrypoint 已核实，runtime audit 无旧 Learning OS 实现读取。
- 原 Codex profile + `http://127.0.0.1:8000` 的浏览器 smoke 通过：36 Candidate / 17 Job；两域 Detail Edit 首字段 focus、Cancel 不变、刷新重开不变；13 PDF 来源恢复、既有 Candidate Working 重开；console error/warning=0。本轮未执行真实 Provider turn、Human Save 或新导入，不据此新增语义质量或完整 E2E 声明。
- 旧目录 1,168 files hash/mode 无漂移、57 原始 Blob 同哈希、SQLite 完整性 ok。原未提交 README/QA exclusions/relocation docs 保留，无 staging/commit、Phase B 或旧 Learning OS 修改。技术迁移验收 READY FOR CUTOVER，正式开发切换仍由 Human 确认。
- 详情及临时证据路径见 `RELOCATION_HANDOFF.md` 顶部接手续验节；下方历史产品验收记录原样保留。

## 2026-09-05 — J1 Candidate Material conversation hotfix（browser and regression gates PASS）

- This entry supersedes earlier Candidate Material conversation PASS claims. Human usage disproved those claims; the hotfix is based on `13ff1fc764b7235ba624a82f3e9a6594d20ba6d3` and must not be committed until final real-browser gates pass.
- Reproduced on the normal `127.0.0.1:8000` Personal Information → Candidate Material Card → embedded Candidate Material Detail path. The composer retained input, but Send was disabled because the confirmed legacy item did not exist in its source's Working head. Existing tests assumed that binding already existed.
- Candidate-only repair: bootstrap the current confirmed item into the source's latest append-only Working head, idempotently; preserve pending Working edits; atomically persist legacy Human Save/direct Edit with confirmed revisions; refresh the parent Personal Information list after Save. ITEM Provider requests no longer include unrelated material directory entries. Expired interrupted Detail turns can be retried without fabricated Assistant output or Local fallback.
- First browser pass: Work Experience discussion, mutation, Working/Save/reopen/new-context; Project discussion after one Provider timeout and interrupted-turn recovery; Education discussion. Local Detail/direct Edit produced exactly zero Provider calls during the observed 105-second window. Original Model selection restored.
- Final automated gates: 18 Node suites, 8 Python suites (15 unittest cases plus six executable assertion suites), 10 JavaScript syntax checks, 3 Python compilation targets, and `git diff --check` passed. The additional Node suite covers the bounded Job negation repair, with 10 non-edit and 6 affirmative/mixed-intent cases.
- Final post-regression browser: Work Experience, Project, and Education discussions PASS; the same Work Experience mutation/Working/Human Save/refreshed Candidate Material Card/reopen/next-discussion PASS; Local Provider calls again exactly 0; original Model selection restored; captured console warning/error count 0. One mutation Provider response failed parsing without mutation, then one identical-prompt retry passed.
- The initial frozen Job smoke failed with `JOB_EDIT_INVALID`: its referent resolver misclassified “不修改任何内容” as an edit request. Work paused without staging/commit. The Human then explicitly requested the bounded repair and one additional smoke. Only negated edit-verb routing was changed; affirmative/mixed requests and the original Human message are preserved. The additional real call used the identical question and existing Job Detail: new Assistant answer visible, HTTP 200, Provider called, no Working proposal or confirmed mutation. The server recorded `ASK_CLARIFICATION` as its normalized non-mutating result type; no claim of an `EXPLAIN` envelope is made. No Job prompt, mutation implementation, Save, or UI redesign was performed. All required hotfix gates now pass.
- Checkpoint: Product Progress is the bounded conversation repair. New Transferable Knowledge is that a visible confirmed material and a source-scoped Working head are distinct identities, and Save must advance both coherently. User-owned Capability Evidence is the Human's counterexample and acceptance contract, not independent implementation. Implementation/debugging/tests/browser operation are Tool-assisted; final Human review remains a separate capability/acceptance checkpoint. No J2, import redesign, or UI polish.

## 2026-09-04 — Ariadne runtime capability routing stabilized（real browser verified）

- Runtime ownership is now split into three independent contracts: Ariadne mode (`LOCAL` / `MODEL`), operation (`candidate_image_import`, `job_image_import`, Candidate/Job conversation, and text variants), and model capability. One shared operation-aware resolver persists compatible per-operation model assignments; Runtime load seeds only missing configured pro conversation assignments and never overwrites an existing Human conversation choice. MODEL failures remain MODEL failures and never dispatch the Local semantic path.
- Candidate image/PDF and Job image imports resolve to the configured `deepseek-v4-flash-vision-exp` adapters. `deepseek-v4-pro` no longer carries a latent Job-import adapter and remains the verified Candidate/Job conversation runtime. Job image requests include ordered original image inputs plus bounded read-only Source Preparation; the Working proposal retains every ordered SourceDocument ID.
- Real browser on isolated `127.0.0.1:8001`: a synthetic Candidate PNG produced one non-authoritative Working card through the vision Provider; two ordered synthetic Job PNGs produced one Working Job through the vision Provider; a subsequent Job conversation used `deepseek-v4-pro` and received the current synthetic Candidate Working snapshot. The incompatible pro-only image state was disabled as Model-unavailable and did not enter Local.
- The shared minibar is fixed at the right edge and vertically centered. The import-page transform containing-block bug was removed while a Workspace is open; desktop Workspace width now reserves the rail. At `1280×720`, Workspace was `x=87…1193` and minibar `x=1205…1262`, with a 12 px gap. Hover expanded the rail while its bounding rectangle stayed byte-for-byte unchanged.
- Browser diagnostics recorded two read-only `/api/local-source-read` Source Preparation calls, one `deepseek-v4-flash-vision-exp` Job import call, and one `deepseek-v4-pro` Job conversation call. No `/api/local-job-extract`, `/api/local-job-image-ocr`, Local semantic proposal, or Local review path executed in Model mode. Separate Local Candidate and Job regressions retained Provider calls = 0.
- Regression: `38` Node regression files and `20` Python regression files passed. No staging or commit was performed. Human acceptance remains pending.
- Checkpoint: Product Progress is operation-specific runtime routing plus real multimodal Candidate/Job proof. New Transferable Knowledge is that mode authority, operation requirements, and model capabilities must be resolved independently, and technical source reads must authorize semantic adapters without becoming semantic structuring. User-owned Capability Evidence is the Human Acceptance diagnosis and explicit routing/visual contracts. Implementation and QA are Tool-assisted. Remaining Gap is Human acceptance on the user's normal `:8000` session.

## 2026-08-31 — Figma parity、导入入口收敛与现有重复卡片融合

- Workspace 已按 Figma `02 · 工作空间` 的几何重建：1280 设计基线为 1060 px 双栏、32 px gap、297 px 文件夹、58 px 顶栏；当前 982 px 浏览器实测为 `433 + 32 + 433`，y=190、h=297，背景固定 `#f7f7f9`，Ariadne 字标居中。文件夹纸张、前盖、标题与数量基线均按 Figma 比例落位，原内容与既有开合/fade motion 保留。
- Personal/JD import 取消原生大号 file input 与“消毒示例”入口，改为 Figma 风格点击/拖拽区。Personal 支持 PDF/PNG/JPG/JPEG/DOCX；JD 默认顺序为 PDF → 图片 → 粘贴文本，PDF/图片各自约束 accept，粘贴文本置于最后，职位链接仍为选填，主动作只显示“开始理解职位”。
- 新增一次性本地重复数据收敛：保留最早对象 ID，用确定性字段融合合并事实、来源、uncertainty 与版本，再删除重复副本并写入 migration marker。当前浏览器 Personal 从 9 张重复资料收敛为 3 张，JD 保持 1 张；Ariadne 项目名同步到现有演示记录。后续新导入仍先弹窗由用户选择融合/保留/取消，不会静默覆盖正式 Career Model。
- 字体合同为 Recursive → Inter → IBM Plex Serif Regular → 系统中文 fallback；返回箭头横线缩短为 17 px。V1 cache 升至 `v1-motion-29`。
- 验证：14/14 Node `.mjs`、全部 Python regression、17 个 public JavaScript syntax、14/14 HTML HTTP 200；真实浏览器验证 Workspace geometry/count、Personal 悬浮导入 80% + 8 个 resize handles、JD PDF/Image/Paste 顺序与状态、Personal 3 张唯一卡片通过。没有 Provider/API/Key/付费调用。
- Checkpoint：Product Progress 是 Figma 到实现的一致性、输入模式收敛与重复数据清理；New Transferable Knowledge 是“去重检测 → 人工决策 → 确定性融合 → provenance 留存 → 持久化”的本地闭环；用户提供了视觉验收标准与入口顺序，构成产品判断证据；CSS/JS、IndexedDB migration 与回归属于 Tool-assisted Implementation。Remaining Gap 是实际 PDF/图片正文解析仍未在本轮改变，也没有真实模型识别验收。

## 2026-08-31 — 本地导入可见闭环 + Figma 7 画面编辑基线

- 本地个人材料导入不再覆盖固定的 3 个演示 ID：`importLocalCandidateFixtures()` 为每次导入创建独立批次与新对象 ID，并强制记录 `recognition_mode: LOCAL`、`network_sent: false`、`ai_recognized: false`。浏览器回归中列表由 4 个入口/对象增长到 7 个，控制台无 warning/error。
- 本地与模型识别继续分流：`network_sent: false` 或 `recognition_mode: LOCAL` 现在优先阻断 AI 面板，即使旧记录残留 provider/model 字段也不会误开 AI；模型识别对象的 scoped conversation / reviewable patch 未删除、未改调用逻辑。
- Personal/JD 卡片区从 CSS columns 改为占满容器的响应式 Grid；桌面实测为 3 列 `371px`，横向覆盖 `1149px` 容器。AI 对话气泡使用 flex 垂直居中与对称纵向 padding。
- Figma `Job Radar — UI Screens` 只保留 7 个画面：02、03A、03B、03E、04A、04B、04E。保留画面中的 301 个 Auto Layout/Grid 容器已转换为自由布局，7 个顶层画面和所有后代的自动布局计数均为 0，因此拖拽不再被父布局回排。旧 `04E` 只有游离残片，已基于 03E 分栏结构补建为独立中文职位 + AI 画面。
- V1 静态资源版本升至 `v1-motion-27`，避免浏览器继续命中旧 CSS/JS。Node 回归、浏览器本地导入、Grid 几何和 Figma 结构/截图通过；没有 Provider 调用、API Key、职业资料上传或费用。

## 2026-08-28 — V1 中文界面与来源分流恢复（Browser + Figma verified）

- Runtime、Workspace、个人资料、职位描述、导入页、详情页与相关职业资料界面的用户界面文案已统一为中文；模型名、API、PDF/DOCX/JSON 等技术名词、`JOB RADAR` 产品字标与原始来源证据保持原样，避免改变协议或 provenance。Workspace / Personal / JD 顶部说明、STEP 01/02/03 与文件夹 01/02 编号已移除，Workspace 的 `JOB RADAR` 精确居中。
- AI 能力按来源分流：`network_sent: false` 的本地导入对象只显示资料信息，不创建对话面板；由模型识别、具有明确 provider/model provenance 的对象继续显示 scoped AI conversation 与可审核 Patch。历史本地 demo 记录会增量迁移中文副本，历史 AI 对话仅在展示层翻译，不删除用户数据。
- 现有 Figma 文件已原位同步为 22 个可编辑 Frame、1443 个可编辑 Text 节点；本地来源 Candidate/Job 页面不含 AI 面板，新增的模型识别 Candidate/Job 页面保留 AI 面板。Workspace `JOB RADAR` 为未栅格化的真实文字节点，名称为 `JOB RADAR（可编辑）`，画布中心与文字中心一致。
- 验证：4 个关键 JavaScript syntax、全部 14 个 Node `.mjs` regressions、localhost Workspace/Personal/Candidate 来源分流和 Figma 结构检查通过；未调用 Provider、未发送 API Key 或职业资料、未产生模型费用。

## 2026-08-28 — Personal/JD import guides share the reversible floating overlay（Browser verified）

- “添加个人材料”与“添加职位描述”不再进入独立全页导入路由；它们和已保存对象使用同一个 80% 悬浮容器，从原引导卡位置放大，点击 ×、遮罩或 Esc 后反向缩回原卡片。导入内容仍复用原 `personal-import.html` / `jd-import.html`，只增加 `embed=1` 显示模式，没有复制上传、fixture processing 或 IndexedDB 逻辑。
- 导入完成时，嵌入页只向同源父页面发送受限的完成消息；父页面先沿原路径收回悬浮层，再刷新相应 library，并把焦点放到新生成的 Candidate/Job 卡片。浏览器地址不发生变化，Personal/JD 的已有对象及 Add Guide 均保留。
- V1 cache 升至 `v1-motion-18`。浏览器验收：Personal guide `335×285`、JD guide `335×330` 都放大为 `643.195×557.594`（当前 804×697 视口的 80%）；Personal 取消后来源卡恢复；Personal 与 JD 使用消毒示例完成处理后，overlay hidden、body 解锁、列表原地刷新，焦点分别落在 `candidate:demo-work-experience` 与 `job:demo-job-ai-product-manager`。
- 验证：全部 13 个 Node `.mjs` regressions、16 个 public JavaScript syntax、8/8 localhost 页面与 `git diff --check` 通过；未执行 Provider/API 请求。

## 2026-08-28 — Stored card 80% reversible detail overlay（Browser verified）

- Personal Information 与 JD 中已经保存的普通卡片不再导航到独立详情页；点击后从原卡片位置连续放大为居中的悬浮详情层，桌面最终尺寸严格为视口 `80vw × 80vh`。关闭按钮、遮罩与 Esc 都沿相反路径缩回当前来源卡片，不再经过全屏白色 holding frame，因此消除了卡片放大后换页造成的闪动与色温跳变。
- 悬浮层内部复用原有同源详情页并添加 `embed=1`：左侧是资料/职位信息，右侧是现有 scoped AI conversation，两侧各为独立圆角卡片并可单独滚动。Candidate/Job 数据、Direct Edit、Patch 与对话状态仍使用原有 domain/IndexedDB contract，没有复制第二套业务逻辑或静默修改已存资料。
- “添加个人材料 / 添加职位描述”引导卡继续进入专用导入页，不被详情悬浮层拦截。版本升至 `v1-motion-17`；打开 540 ms、关闭 480 ms，使用相同 spring-like easing，并兼容 `prefers-reduced-motion`。
- 浏览器验收：Personal 与 JD 悬浮层在 `804×697` 视口中均为 `643.195×557.594`（宽高比例均约 `0.8`）；嵌入页均为 2 列、16 px 间距、22 px 圆角、独立滚动，关闭后来源卡恢复可见并可再次打开；导入引导卡仍正常导航。16 个 public JavaScript syntax、13/13 Node regressions、6 个非历史-fixture Python scripts、8/8 localhost 页面与 `git diff --check` 通过；未执行 Provider/API 请求。

## 2026-08-28 — Workspace folder navigation simplified to pure fade（Video + Browser verified）

- 对照 `Screen Recording 2026-08-28 at 11.06.29.mov`，Workspace folder 点击仍走 card clone 放大，再叠加目标页入场 fade；两种 motion 与表面颜色在导航交接点相互覆盖，形成闪烁和色温跳变。Workspace 的 Personal/JD folder 现已退出 card-to-page transition，只使用与 minibar 相同的整页 opacity fade；Personal/JD 返回 Workspace 也走同一路径。
- 发现并修复 fade-out 未生效的直接原因：`.v1-page-shell` 的入场 animation 使用 `fill: both`，结束后持续占用 `opacity: 1`，覆盖 `.v1-route-leaving`。现移除 persistent fill，出场 320 ms、入场 420 ms 都只改变 opacity，不再位移或创建 card clone。
- 当前 V1 cache 版本为 `v1-motion-14`。浏览器采样：Workspace opacity `1 → .260 → .058 → .008`，Personal `0 → .629 → .882 → .993 → 1`；返回 Workspace 与打开 JD 同样连续；全过程 card transition layer 数量为 0，body background 始终 `rgb(247,247,249)`。
- 验证：16 个 public JavaScript syntax、13/13 Node regressions、6 个非历史-fixture Python scripts、8/8 localhost 页面与 `git diff --check` 通过；未执行 Provider/API 调用。

## 2026-08-28 — Card color interpolation + stable folder text plane（Video + Browser verified）

- 对照 `Screen Recording 2026-08-28 at 11.02.13.mov`，卡片 clone 原本以纯白结束，而导入页以 `--paper: #f7f7f9` 开始，导航交接时因此出现可见的白→冷灰闪变。正向与反向 card transition 现在都显式在 `#fff` 与运行时读取的 `--paper` 之间连续插值；arrival cover 与目标 body 使用同一个实际颜色。
- Workspace folder 的文字闪动不只来自旧 filter：hover 时旋转前盖会在 3D 合成上下文短暂盖过 `translateZ(1px)` 的文字。序号、标题与计数现固定到独立 `translateZ(96px)` 前景平面；folder anchor 不再位移，标题下移到 folder 下半部，hover / leave 均保持同一坐标与 opacity。
- 当前 V1 cache 版本为 `v1-motion-12`。浏览器采样：正向颜色 `rgb(253,253,254) → rgb(248,248,250) → rgb(247,247,249)`，目标 body/cover 均为 `rgb(247,247,249)`；Personal title hover/leave 相对 top 均为 `208.189px`、opacity 均为 `1`，且打开时持续可见。
- 验证：16 个 public JavaScript syntax、13/13 Node regressions、除既有历史 fixture assertion 外的 Python regressions、8/8 localhost 页面与 `git diff --check` 通过；未执行 Provider/API 调用。

## 2026-08-28 — Folder text compositing + exact fade background（Browser-verified）

- Workspace 文字闪动来自 hover 时给整个 folder anchor 添加/移除 `filter: drop-shadow()`，浏览器会在离场时撤销整卡合成层并重新栅格化文字。阴影现在只作用于 `.v1-folder-back` 的 `box-shadow`；标题、序号与计数固定在 `translateZ(1px)` 合成层，folder 本体全程 `filter: none`。
- V1 fade 原先把 animation 加在整个 body 上，透明阶段会露出浏览器默认底色。现在 body 的 `--paper: #f7f7f9` 永远不透明，只让 `.v1-page-shell` fade；card arrival/return cover 也统一使用 `var(--paper)`。版本升至 `v1-motion-10`。
- 浏览器采样：Personal folder 文字在 rest / hover / leave 55 ms / leave 205 ms / settled 的 opacity 均为 `1`、color 均为 `rgb(31,34,42)`、folder filter 均为 `none`；Workspace → Personal fade 的 leaving / arrival / final body background 均为 `rgb(247,247,249)`、body opacity 均为 `1`。未执行 Provider/API 调用。

## 2026-08-28 — Folder / right minibar / card transition refinement（Video + Browser verified）

- 对照 `Screen Recording 2026-08-28 at 10.09.31.mov`，Workspace folder 不再让三张 paper 分别弹散：paper 使用固定 6 px 层级槽位与同一 12 px hover 位移，作为一组进出；front 改为 `rotateX(-30deg)` 的明确开盖动作。鼠标移开后 paper 相对间距保持不变，闭合后仍能看到三层文件边缘。
- minibar 镜像到右上角：dash 右对齐、tooltip 向左展开，当前页静止宽 16 px / opacity `.96`；13 px proximity field 与 spring loop 保留连续 fisheye wave，切页仍为 220 ms fade。桌面阈值调整为 701 px，使当前 in-app browser 804 px 视口也能直接使用。
- 对照 `Screen Recording 2026-08-28 at 10.12.01.mov`，card-to-page 不再在动画中途突然清空内容：460 ms 放大先保持 card 内容，300 ms 后才渐隐；到达页用白色 arrival cover 与 page content 交叉淡入，且取消 body 的重复初始 fade，消除双层重绘闪动。
- 版本：V1 `v1-motion-9`。浏览器逐帧验证 folder hover/leave/settle、右侧 minibar proximity、card 120/340/470 ms 与 arrival/final 帧；13 个 Node regression files、7 个不相关 Python regressions、16 个 public script 语法检查、8 个 localhost 页面与 `git diff --check` 通过。既有 `career_entity_regression.py::test_real_portfolio` fixture assertion 仍失败，与本轮 UI 无关且未改动。未执行 Provider/API 调用。

## 2026-08-28 — Motion continuity bugfix（Browser-verified / No Provider Call）

- Add Model 关闭缺少动画的根因是正向 CSS animation 以 `both` 持续占用 `transform`，覆盖关闭 transition。关闭前现在先进入 `is-close-ready`、解除 animation 并强制建立起始帧，再以 380 ms 收回 Runtime selector 中心；关闭后菜单恢复、再次打开仍正常。
- Workspace folder 的纸张离场原先使用强前置 easing，80 ms 内几乎全部掉回前盖后方。现在离场为 560 ms 柔和滑回，并在闭合状态保留三层 34.4 / 24.8 / 15.1 px 的纸张边缘，不再像删除内容。
- Personal 引导卡、JD folder、JD 引导卡都改为 idle 黑色、hover 白色。card-to-page clone 与反向 return clone 使用 `v1-transition-light` 锁定白色；返回后再以现有颜色 transition 平滑恢复黑色，消除点击/返回闪黑。
- 版本：Runtime `runtime-ui-v45`；V1 `v1-motion-8`。13 个 Node regression files、7 个不相关 Python regressions、4 个脚本语法检查、8 个 localhost HTTP 页面、浏览器开合/hover/leave/forward/return sampling 与 console 0 warning/error 通过。未执行 Provider/API 调用。

## 2026-08-27 — Runtime / Workspace motion refinement（No Provider Call）

- Runtime 的“添加新的模型”不再从底部上滑：现在从触发按钮位置按统一比例放大为居中悬浮页；左上返回、遮罩、Esc 与 Qwen 验证成功都复用同一条反向收回路径。Runtime 下拉菜单更贴近选择框，垃圾桶保留原按钮边框，仅缩小内部图标。
- V1 minibar 仍保持 52 px 外部宽度，但默认四段纵向间距更短，靠近后纵向展开；当前页 dash 在静止与交互时都有更强区分，Runtime / Workspace / Personal / JD 之间只用轻量 fade 切换。
- Workspace 的 Personal Information / JD 改为三张纸张的分层文件夹：hover 时纸张依次弹起、folder front 轻微打开，移除了原右上角箭头。Personal 首张引导卡默认为黑色，hover 变白；返回符号与引导卡加号均无外框。
- 文件夹、Personal/JD 卡片与导入引导卡使用共享的卡片→全屏 420 ms 过渡；详情返回与导入完成复用反向全屏→原卡片过渡。所有可操作按钮维持轻微按压缩放，并尊重 `prefers-reduced-motion`。
- 验证：13 个 Node regression files、4 个浏览器脚本语法检查、8 个 localhost 页面 HTTP 200 与 `git diff --check` 通过。浏览器自动 reload 受本地 URL 安全策略限制，本轮未据此新增视觉通过声明；未执行 Provider/API 调用、未发送 Key 或职业资料。
- 学习边界：交互目标与视觉判断来自用户；CSS/JS 状态、动画路由、session transition contract 与回归实现属于 Tool-assisted Implementation。

## 2026-08-27 — Reference mini sidebar motion

- 依据用户提供的 12.155 秒录屏与后续精确交互合同，Web-first V1 桌面导航改为常驻 mini rail：鼠标纵向距离形成连续 fisheye 波形，最近 dash 最长最深，相邻 dash 按高斯距离场逐级衰减；宽度、opacity 与厚度由带速度/阻尼的 spring loop 回弹。
- rail 仍只有 Workspace / Personal Information / JD / Runtime，不展开成后台式 sidebar。Candidate detail 归属 Personal，Job detail 归属 JD；hover 与 keyboard focus 使用相同反馈。
- 小于 821 px 时隐藏 rail，继续使用现有圆形 menu；支持 `prefers-reduced-motion`。没有修改 Runtime、Candidate/Job schema、fixture、IndexedDB 或 Provider 路径。
- 验证：44 项 UI/fisheye contract、全部 12 个 Node test files、桌面距离场数值采样、离场回弹、focus 与移动 fallback 通过；浏览器 console error = 0。

## 2026-08-27 — Web-first V1 STEP 02–03 UI Framework complete（Fixture-only）

- Workspace 已收敛为两个可点击对象：`Personal Information` 与 `JD`；无永久 sidebar，统一 menu 只保留 Workspace / Personal / JD / Runtime。
- STEP 02 已实现 Personal library empty state、Resume/Portfolio/Project/Other bottom sheet、Browser File API 元数据预览、无百分比的五阶段状态流，以及 1 Work / 1 Project / 1 Education 的消毒 fixture cards。
- Candidate detail 采用左侧 structured item + 右侧 `CANDIDATE_ITEM` scoped conversation；对话只能先提出 Before/After/Why Patch，再由用户接受或拒绝。Direct Edit 为零模型调用，先预览后确认。
- STEP 03 已实现 JD library、Paste/PDF/Image bottom sheet、fixture processing、1 个独立 `job-radar-job-context-v1` Job Card、5 条 Requirements 与 `JOB` scoped conversation；没有 match、application 或 Candidate mutation。
- IndexedDB 仍为同一个 `job-radar-local-first-v1`，additive 升至 v10；新增 `demo_candidate_items`、`demo_job_contexts`、`demo_conversations`、`demo_ui_state`，与正式 Candidate/Job truth 完全分离。
- 验证：27 项 STEP 02–03 contract checks、全部 12 个 Node test files、全部 Python regression scripts、桌面浏览器全流程与 390 px responsive DOM 验收通过。没有真实 Provider call、API Key、Resume/JD 正文读取或外部传输。

## 2026-08-25 — Product Architecture V2 Gate Closeout

```text
PRODUCT ARCHITECTURE V2 = FROZEN / CONFIRMED
Architecture Gate = COMPLETE
Implementation = IN PROGRESS / Phase A–B contract preparation complete
Current Milestone = STEP 1 — ONE REAL RESUME
                    CANDIDATE IMPORT + HUMAN CALIBRATION
```

当前最高 authority：`docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。本文件以下更早日期的 P4.1、Career Intelligence V0、CareerEntity、CapabilityBoundary、CareerDirectionHypothesis、OCR 与旧 V2 Gate 内容只保留为实现/决策历史，不是当前主线、next action 或 architecture research backlog。

## 2026-08-26 — Add Model Sheet Interaction Shell（No Provider Call）

- Runtime Selection 的“＋ 添加新的模型”已从旧的全页跳转改为当前页 bottom sheet：遮罩、上滑、关闭、Esc、Provider picker、Key 输入/清空、动态官方 Key 链接、状态区、候选模型区与禁用的完成按钮均已实现。
- 首批 catalog 严格按 model-level 只含 `deepseek-v4-flash-vision-exp`、`gemini-3.7-flash`、`qwen3.8-max`；文本模型与 account unknown 不会进入 sheet 的可用图文模型列表。当前主选择器不显示 Gemini/Qwen，只有当前官方接入 DeepSeek 模型与“添加新的模型”。
- “连接并读取可用模型”在本轮不读取或传输 API Key，也不调用 Provider；输入满足前置条件后只显示等待 action-time 批准。只有后续获得账号模型列表、选中图文模型并通过真实对应验证，✓ 完成才可启用并回写主选择器。
- 浏览器验证：sheet 显示三家 Provider，切换 Qwen 会显示正确 Key 链接，关闭后覆盖层隐藏；Key 未输入、未发送。离线 catalog/UI/现有 runtime/provider regressions 与 Python compile 通过。

## 2026-08-26 — Runtime Selection 多模态能力修正（Implementation Ready / Paid Smoke Not Run）

- **V1 normal selector = multimodal-only：** DeepSeek 官方 2026-08-21 公告确认 `deepseek-v4-flash-vision-exp` 是支持图文混合输入的多模态视觉理解 API 模型；该 exact ModelDescriptor 因此以 `official_contract + TEXT/VISION + VERIFIED` 进入 V1 并可继续。`deepseek-v4-flash`、`deepseek-v4-pro` 与 unknown 均不继承视觉能力且不显示；Gemini browser-BYOK 路线未接入当前选择器。
- **连接边界：** 进入 Workspace 是已接入官方图文模型的选择状态，不代表已发起过付费请求；`MULTIMODAL_CONNECTION_READY` 仍是未来真实 synthetic smoke 的独立证据。没有 API Key 读取、Provider inference 或职业资料传输。
- **readiness 定义修正：** 不再以 `Reply only: OK` 的纯文本回包认定图文模型 ready。统一 smoke 是固定 360×96 JPEG（文字 `JOB RADAR TEST`）加指令 `Read the text in this image. Reply only with the text you see.`；仅在可见文本规范化后精确为 `JOB RADAR TEST` 时产生 `MULTIMODAL_CONNECTION_READY`。`STRUCTURED_OUTPUT_VERIFIED` 是独立、尚未验证的后续状态。
- **vision-exp 重新定位：** 先前经批准的纯文本 ping 空回包只证明该请求不适合该模型，不能显示为连接失败。官方公告现确认该 exact model 的图文合同；descriptor 使用 `OPENAI_CHAT_COMPLETIONS`、`TEXT + VISION`、PDF page JPEG/Base64 `image_url` 与 `choices[0].message.content`，允许进入 Workspace，但不声称已完成真实 smoke。
- **对话上下文边界：** Context Compiler 默认只发当前 Card、相关文字、同 scope 最近对话与用户消息；只有调用者明确提供相同来源的 `relevant_source_image` 时才包含图片。没有新增对话 UI、真实对话 call 或 CandidateContext 写入。
- **验证：** 图文 request/normalization、V1 selector filter、Gemini key safety、成功/失败 arrow、scoped conversation 的无自动图片与明确相关图片路径的离线回归均通过。未读取 API Key、未发送职业资料，也未执行任何 Provider inference。

## 2026-08-26 — Web BYOK Provider Feasibility Spike

- 独立、无计费的 Web-first 可行性 Spike 已完成，权威记录为 `docs/architecture/WEB_BYOK_PROVIDER_FEASIBILITY.md`。它不改变 V2、Candidate Context、Job/Résumé scope、Provider runtime、IndexedDB/SQLite，也不引入 Job Radar proxy、SaaS backend、Tauri、RAG、Agent 或 MCP。
- 实际浏览器证据：从 `http://localhost:8011` 使用固定无效 placeholder key 对 DeepSeek/Gemini/OpenAI/Claude/OpenRouter 的 model-list GET 触发预检并取得可读取 HTTP 结果（401 / 400 / 401 / 401 / 200）；无职业数据、真实 key、请求 body、模型 inference 或费用。该证据只证明 browser transport/CORS path，不证明真实 key、模型、stream、结构化输出、地区或安全默认值。
- 正式状态合同分离 `browser_transport` 与 `default_policy`。DeepSeek/Gemini 是 future `SESSION_BYOK_CANDIDATE`；OpenAI 为 `NOT_DEFAULT_ALLOWED`（官方明确禁止 client-side exposure）；Claude/OpenRouter 为 `REFERENCE_ONLY`。所有未来 UI 均维持 session-only default、no URL/log/telemetry/proxy、显式存储选择与删除 key。
- 下一外部边界仍只有一项：若用户重新 action-time 批准，可作 DeepSeek `deepseek-v4-flash → POST /responses` synthetic `Reply only: OK`（reasoning none / max 16 / no source data / no stream）的单次浏览器直连 smoke。未获批准前绝不执行，且本 Spike 不能标记 real inference ready。

## 2026-08-26 — Gemini Browser BYOK Runtime Smoke（历史 text-only 方案，已由上方图文方案取代）

- 用户批准的单次 Gemini real browser smoke 已以 Browser Direct BYOK 接入现有 Runtime Selection；没有使用历史 macOS Keychain、Python proxy 或 server-side credential。`public/gemini-browser-runtime.js` 先对 Gemini model-list direct fetch，再只从账号实际返回且支持 `generateContent` 的 stable Flash candidates 选择最低成本优先模型；当前官方优先候选为 `gemini-3.1-flash-lite`，但绝不在模型 discovery 之前假设其可用。
- 测试请求已固定：`POST https://generativelanguage.googleapis.com/v1beta/models/<account-returned-model>:generateContent`，协议 `GEMINI_REST_GENERATE_CONTENT`，synthetic input `Reply only: OK`，`maxOutputTokens: 16`，无文件/图像/职业资料/结构化 schema/历史/重试/fallback。`normalized.text` 非空且为 `OK` 或语义等价才会使 arrow enabled。
- Web UI 已实测：Runtime Selection 保持无 key 输入；选择 `Gemini · Browser Direct BYOK` 会进入 `/gemini-connect.html` 专页，显示 session-only password input、Google AI Studio key 获取链接与本地安全说明页。空 key 显示轻量 credential failure；Runtime arrow 保持 disabled。CSP 只允许 self 与 Gemini `connect-src`，无 key URL/console/IndexedDB；connection test 不创建 Conversation 或 Candidate truth。
- 当前唯一阻塞是用户在页面输入当次 Gemini API Key；不读取/复用 Keychain。输入后才会执行已经批准的唯一计费调用并记录 AUTH/CORS/PROVIDER/MODEL/REQUEST/RESPONSE_EXTRACTION/EMPTY_RESPONSE 之一。成功后关闭 Provider spike，回到 Resume → Candidate Proposal/Cards 的 browser-local Step 1。

Step 1 唯一范围：`ONE REAL RESUME PDF → SourceDocument → DeepSeek consent → real ProcessingRun states → structured CandidateItem Proposal → Work / Project / Education Cards → Human Review → Direct Edit → card-scoped AI Correction → Context Patch → Before / After / Why → User Confirm → CandidateContext persisted → close / reopen → confirmed Cards remain`。

明确不做：Portfolio、Job Import、Match、Resume generation、Capability Card、Career Mentor、Architecture redesign、旧 CareerEntity migration、OCR benchmark、MCP、RAG、Agent、Skill、CLI。Step 1 仅完成不会发送资料的 Phase A–B preparation，尚未运行真实 Resume 或完成任何 Card UI。

持续硬原则：`CARD-FIRST HUMAN CALIBRATION`；Candidate Context 是 semantic truth，Cards 是 human review views；用户是最终 Candidate Context authority；Direct Edit = 0 LLM calls；AI Correction 只提交 task-scoped Context Patch proposal；Minimum Necessary Change 保留为未来 Job/Application 原则；Passit 是下游 JD Evidence Match 基线，CareerStack/KarriereVault 是 Candidate representation 参考；reference-first；Git/GitHub 管代码版本，CandidateContext revision 管用户数据版本；Figma 管 Human Calibration UI 设计；DeepSeek first。

## 2026-08-25 — Step 1 Implementation Preflight + Phase A–B Preparation

- Git：项目已初始化为本地空仓库，尚无 commit、branch 或 remote；新增 `.gitignore` 忽略 credentials、runtime DB、local OCR uploads、private candidate material、exports、logs 与 cache。没有移动、删除、加入暂存区或推送任何文件。
- DeepSeek：Keychain credential presence 已确认；对账号只执行了 `/models` listing（没有 Resume、没有 model inference），可见 `deepseek-v4-flash`、`deepseek-v4-pro` 与 `deepseek-v4-flash-vision-exp`。官方当前支持该 vision model 以 image inputs 接收内容，故现有“本地完整 PDF 渲染为页图 → DeepSeek”delivery 可继续作为 Step 1 主路径。
- Phase A：新增 `public/candidate-context-domain.js` 的最小 V2 runtime contract；浏览器 IndexedDB 从 v7 additive 升至 v8，新增 `candidate_contexts`、`candidate_proposals`、`candidate_context_patches`、`processing_runs`、`processing_consents` 五个 stores。旧 SourceDocument、CareerEntity、CareerEvidence、AI Markdown artifact 与现有 records 未删除、未迁移、未写入。
- Phase B preparation：新增 `src/candidate_context.py`。它构建 DeepSeek JSON Output request，要求 CandidateItem Proposal 并对 empty / malformed / ungrounded output fail closed；它只返回 `NEEDS_REVIEW` proposal，不能写入 confirmed CandidateContext。此模块尚未连接页面或实际 Provider send，因此不会绕过 explicit consent。
- 验证：新的 JavaScript contract regression、Python provider-boundary regression、既有 AI artifact regression、Python compile 与 IndexedDB migration consistency check 均通过；没有真实 Resume、Candidate Context、Provider inference 或 UI Card acceptance。
- 下一真实阻塞：Phase C 前需连接/提供 Figma Candidate Human Calibration Kit 作为 Card visual authority；真实 Phase B execution 还需要用户提供一份 Resume PDF，并在 UI 内对具体文件、DeepSeek、用途与可能费用作 action-scoped consent。

## 2026-08-26 — Step 1A Runtime Selection + Real Connection Test

- Figma `01 — Runtime Selection`（node `9:3`）已作为第一屏 UI authority 实际读取。localhost 首页现在只保留单一 Runtime Selector 与单一圆形 Status/Next control；没有独立成功 checkmark 或后续页面重设计。
- 新增 `/api/runtime-options` 动态读取账号可见 DeepSeek 模型；`/api/runtime-check` 对所选模型执行不含职业资料的 `CONNECTION_TEST`（`Reply only: OK`，最多 4 output tokens），返回 token usage 与内部诊断；credential / transport / provider / model / unexpected response 分层失败。
- 真实测试：`deepseek-v4-flash-vision-exp` 已在用户明确批准后收到一次最小文本 ping；Provider 返回可解析但无内容，前端正确进入 `FAILED`，不显示 arrow，可通过重新选择模型重试。没有发送 Resume、Portfolio、Candidate Context 或 JD，也未创建 Candidate truth。
- Local：`LOCAL_READY` 不发 Provider request，arrow 已验证能进入现有 `/workspace.html`。离线 runtime regressions 与既有相关 regressions 均通过。
- 当前待决：该 vision model 的文本 ping 不能证明 ready。选择并测试已列出的 `deepseek-v4-flash` 会是独立的最小 API call，需在 action time 获得用户批准；未获批准前 Step 1A 不可标记 complete。
- 修正候选：DeepSeek 当前默认 thinking 可能让 `max_tokens: 4` 耗尽在 reasoning 而不返回 visible content。connection test 将改为显式 `thinking: disabled`、`max_tokens: 16`；仍只发送固定健康提示，下一次调用需单独验证。

## 2026-08-26 — Provider Reference-First Audit + Targeted Adapter

- 审计 authority：`docs/architecture/PROVIDER_REFERENCE_FIRST_AUDIT.md`。Chatbox、Cherry Studio、Resume Tailor 与 LiteLLM 的共通模式是：Provider identity、model descriptor、protocol、capability、request transform 与 response normalize 分层；“OpenAI-compatible”不等于所有 endpoint/protocol/capability 兼容。
- 新增 `src/provider_runtime.py`：DeepSeek model listing 规范化为 runtime-only `ModelDescriptor`；`deepseek-v4-flash` 走 `OPENAI_RESPONSES + TEXT`，`deepseek-v4-pro` 走 `OPENAI_CHAT_COMPLETIONS + TEXT/STRUCTURED_JSON`，`deepseek-v4-flash-vision-exp` 标记为 account-discovered experimental，未声明 plain-text capability，因此不会被 text ping 误判失败。
- Runtime UI 仍是 Figma 的单 selector + action control；账号可见但 capability 未确认的模型显示轻量说明、arrow disabled。Local 不调用 Provider，已再次验证进入 `/workspace.html`。修复 localhost 静态入口缓存，避免新 API 被旧 runtime script 解析。
- 新增 fixture-only protocol/capability/normalization regression；所有 targeted 与既有 Candidate contract regressions 通过。审计后没有新的 paid inference；剩余的 `deepseek-v4-flash → POST /responses` synthetic smoke test 必须逐次取得批准。

## 2026-08-26 — Scoped Conversation Foundation

- 已正式采用 `Scoped Conversation`：Conversation 属于 Job Radar object，不属于 Provider；第一版仅支持 `CANDIDATE_ITEM`。同一 Candidate Item 取得稳定 conversation ID；未来换 Provider/model 不复制 session，单个 assistant message 独立保留 canonical provider/model/protocol/usage provenance。
- 已新增 `public/scoped-conversation-domain.js` 和 IndexedDB v9 的 additive `conversation_sessions` / `conversation_messages` stores。Context Compiler 只编译当前 CandidateItem、可选 relevant source、最近 8 条本 session message、当前 user message 与固定规则；它没有网络调用、没有 credential、不会默认加入完整 Resume/Portfolio/CandidateContext/JD。
- 硬边界保持：Conversation ≠ Candidate truth；Conversation 只能支持未来的 Context Patch proposal，仍须 `validate → Before / After / Why → user confirm`。Direct Edit 仍为零模型调用。
- 当前 repo 尚没有 V2 Candidate Card Detail，因此未擅自加入右侧聊天 UI、真实对话、streaming 或 Patch Generation。`tests/scoped_conversation_regression.mjs` 与既有 Candidate/workspace regressions 通过；无 Provider call、无职业资料传输、无 CandidateContext 改写。

## 2026-08-25 — Product Architecture V2 Final Consolidation complete

Historical pre-closeout status：`PRODUCT ARCHITECTURE V2 FINAL CONSOLIDATION = ADOPT WITH CHANGES / IMPLEMENTATION PAUSED`。该状态已由上方 Gate Closeout 覆盖；其架构内容继续有效。

冻结 Sidebar：AI 工作区、导入资料、查看资料、导入职位、查看职位、设置。第一实现只能是一个真实 Resume 的完整 Candidate Import + Calibration lifecycle，之后才做一个真实 JD；Match、Minimum Necessary Change 与材料生成均为 later。当前 Job Radar 不是 Git worktree，Figma plugin 未安装；本 Gate 未修改生产代码、schema、SQLite、IndexedDB 或 Provider。完整决定：`docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。

## 2026-08-25 — 基础工作台 UI 已实现

- 新增 `/workspace.html`：在单一入口呈现本机的简历/作品集 Material Card、AI Context Card、已审核 Job Card 与下一步。
- 导入职业材料、AI 审核、导入职位与职位详情仍分别由现有页面承担；工作台不触发上传或模型调用。
- 浏览器 IndexedDB 打开版本已统一为 `7`（`local-first.js`、`local-jobs.js`、Career 页），消除旧页面回退到 `v2` 的兼容风险。
- 回归：新增 `tests/workspace_contract_regression.mjs`；既有 Career/AI/Analysis 回归仍通过，未产生网络调用。

## 2026-08-25 — Product Architecture V2 Gate adopted with changes

`PRODUCT ARCHITECTURE V2 = ADOPT WITH CHANGES`。Job Radar 的产品核心从长期 `Personal Career Intelligence / Career Mentor` 收缩为 `Evidence-grounded Candidate Understanding + Job Understanding + Application Intelligence`。当前 Build 继续暂停，等待用户确认 Architecture 后再进入实现；本 Gate 没有修改生产代码、schema、IndexedDB、SQLite、Provider、OCR 或前端。

V2 的正式 source-of-truth 边界是：Original Source = source of record；Reviewed Candidate Context = 产品正式 Candidate truth；confirmed CareerEvidence = matching/generation 的 claim-level reasoning source。AI Markdown 只是 `AI Interpretation Artifact`，Human Card 是 review/edit View，二者都不能自行成为 stored truth。

旧 `CareerEntity` 决定为 `DEPRECATE FROM AI MAIN FLOW / LEGACY-OFFLINE INTERMEDIATE / REPLACE LATER`；`CapabilityBoundary = KEEP + SIMPLIFY`，`InterestSignal = lightweight metadata`，`CareerDirectionHypothesis = DEFER / remove from main flow`，`OpenQuestion = contextual clarification only`。现有对象、records、tests 与 JD-001～014 均保留，不删除或重录。

ONE first implementation slice 已选定：`one existing AI Interpretation Artifact → typed Human Cards → one user correction → versioned Reviewed Candidate Context → confirmed CareerEvidence`。它默认复用现有 browser artifact，不发起新 Provider 调用；验证通过后才进入 one-JD JobRequirement/Match 与 ApplicationDossier。完整决定见 `docs/architecture/PRODUCT_ARCHITECTURE_V2_GATE.md`。

## 2026-08-24 — AI-first quality/review correction pending real result

用户对当前 AI-first 页面给出关键产品诊断：原先的单次发送确认没有清晰表现资料传输、费用确认、发送中、失败或返回内容；同时，页面下方的旧 Local fallback `CareerEntity` 卡片被误认为 DeepSeek 输出，造成“邮箱被当职业标签”、大量空字段和待分类原文的不可用观感。实际边界是：AI 通路只保存 Canonical Career Context Markdown；Local Entity 卡片没有使用 AI 输出。

已将界面改为两步确认（资料传输 → 可能费用 → 发送），并显示明确的发送中、失败或“AI 已返回”结果与 Provider/model/时间。Local Entity 卡片明确标注为高级 fallback、未调用 AI。Canonical prompt 升级为 `canonical_career_context_v2_flexible`：只保留证据支持的字段，无法稳定映射的片段进入带页码的“待人工归类的原文片段”，而不是硬填固定表单。服务日志随后确认用户已主动发起多次 DeepSeek 完整资料请求并收到 HTTP 200；旧前端没有可靠地呈现这些响应，且服务端不持久化响应正文，因此这些调用的实际 Markdown 仍需从浏览器本地 artifact 或一次明确的新发送中复核。

后续用户观察确认旧 Local Entity 审核仍造成强烈误导与阅读负担。页面已收拢为 `AI 返回职业上下文（默认可见，全文按需展开）` 与 `旧版本地 Entity 审核与导出（默认折叠）` 两层；AI artifact 不再被呈现为固定字段表单。邮箱→职业标签是 Local fallback 规则误投影的已知失败，不能归因为 DeepSeek prompt 或 AI 返回。

用户随后确认目标交互为完整闭环。AI-first 路径现为：选择 PDF → “资料将传输”与“可能费用”两个勾选 → 单一状态框（等待/可发送/已发送/已返回/失败）→ 可直接编辑的 AI 信息卡 → 确认使用。确认会将审核后的可变区块保存为浏览器本地 `ai_career_profiles` snapshot、下载 `MY_CAREER_PROFILE.md`，并跳转至 `career-profile.html` 专属个人 Profile 页面。该 Profile 不再依赖或写入旧 Local Entity 表单。

个人 Profile 初版暴露原始 Markdown 审核标记，阅读负担过高。`career-profile.html` 现采用阅读器呈现：字段加粗、子项目和列表被渲染为正常内容；`[原文明确支持]`、`[AI 解释]`、未知标记和页码移动到每块默认折叠的“查看依据与不确定项”。原始 Profile Markdown 下载仍保留。

## 2026-08-24 — AI-first Career Material path: DeepSeek complete-document verification

用户确认将 Career Material 主入口转为 AI-first。DeepSeek account model listing 返回 `deepseek-v4-flash-vision-exp`；现在可将完整 PDF 在本机瞬时渲染为全部 JPEG 页面后，以一份完整资料请求发送给 DeepSeek。Gemini 继续作为另一条完整资料验证通路。产品合同不再向用户区分“文字/PDF 能力”，只记录 Provider 内部 `document_delivery` 适配方式。Local parser/OCR 保留为折叠的高级离线 fallback，未删除、未重开 benchmark。

预检、离线合同回归与浏览器 UI 验证通过；没有职业 PDF 被发送，因此 AI 输出质量、隐私/费用体验和真实 Career Context 仍待用户主动测试。

## 2026-08-24 — Career Intelligence V0 control surface implemented; user review pending

`Career Intelligence V0` now has an additive, browser-local V0 proposal flow: confirmed CareerEvidence plus existing SQLite JD records generate review-only CapabilityBoundary, InterestSignal, CareerDirectionHypothesis and OpenQuestion records. IndexedDB v6 adds only `career_intelligence`; Confirm/Reject and CapabilityBoundary state edits survive refresh. The deterministic proposal layer preserves provenance and enforces that JD interest is not capability evidence, `UNVERIFIED` is not absence of ability, and AI-assisted implementation is not independent engineering capability.

This is **not** yet a usable baseline: the browser verification used an isolated test profile and no real user has reviewed or confirmed a Career Model V0. The next required action is real user review in the Control Center; do not start P4.2.

## 2026-08-24 — Formal Handover: Career Intelligence V0 is next

```text
P4.1A — LOCAL CAREER MATERIAL INGESTION = COMPLETE / PRODUCTION-USABLE BASELINE
P4.1B — AI-ASSISTED CAREER MATERIAL INGESTION = IN PROGRESS / GEMINI CREDENTIAL GATE
CAREER INTELLIGENCE V0 = NOT STARTED
P4.2 — EVIDENCE-GROUNDED MATCHING & APPLICATION INTELLIGENCE = NOT STARTED
```

`NEXT_PHASE_HANDOFF.md` is the authoritative next-thread handover. Document Understanding / OCR is now ingestion infrastructure. The next bounded product hypothesis is `existing CareerEvidence + existing JD records → CapabilityBoundary → InterestSignal → CareerDirectionHypothesis → OpenQuestions → Human Review → persistence`. This handover changed documentation only; no production code, schema, OCR, Provider, IndexedDB or UI was changed.

Learning-by-Building constraint: implementation remains `Tool-assisted Implementation`; only the user's own definitions, predictions, judgments, diagnoses, acceptance decisions, trade-offs and explanations count as `User-owned Capability Evidence`. The learning target is AI Product / AI Systems Product judgment, not independent software-engineering drills.

## 2026-08-24 — P4.1B AI-Assisted Career Material Ingestion: Provider Strategy Updated

```text
P4.1A — LOCAL CAREER MATERIAL INGESTION = COMPLETE / PRODUCTION-USABLE BASELINE
P4.1B — AI-ASSISTED CAREER MATERIAL INGESTION = IN PROGRESS
P4.2 — EVIDENCE-GROUNDED MATCHING & APPLICATION INTELLIGENCE = NOT STARTED
```

- Job Radar now defines **Local / No-AI Mode** and **AI-Assisted Mode** as alternative user-selected ingestion modes. Normal product use runs one mode; automatic voting, fusion, consensus, ensemble parsing and mandatory dual execution are out of scope.
- Local Mode retains the accepted native-first + selective Apple Vision + conditional OCR Resume GapTree + DocumentBlock v1 architecture. “Frozen” stops architecture-shopping; it does not block source-confirmed targeted fixes followed by regression.
- P4.1B's direct path is `Original Resume / Portfolio → multimodal AI → high-fidelity Canonical Career Context Markdown → local persistence / reuse`. It does not place local OCR or the deterministic parser in front of the model.
- Optional Local-vs-AI execution is an evaluation workflow only. The original source plus user judgment remains the adjudication authority; neither mode wins by default.
- P4.2 remains not started until P4.1B reaches a usable baseline.

### Current vertical-slice result

- Implemented a capability-aware Provider layer: DeepSeek = TEXT only; Gemini = direct original-PDF target; Groq = TEXT/IMAGE registered but direct PDF unsupported. OpenAI is not a P4.1B test provider and is not requested or configured.
- The page requires explicit Provider/model selection and private-document transmission consent. The original PDF Blob remains in SourceDocument; the localhost service does not persist the document or response and never writes SQLite.
- Existing DeepSeek Keychain credential passed a small real Chinese text preflight using account-returned `deepseek-v4-flash` → `预检成功`; no career material was sent. Its direct-PDF capability remains unsupported; existing JD screenshot behavior is unchanged.
- Gemini uses a separate `GEMINI_API_KEY` / Keychain entry, dynamic model listing and provider-specific privacy confirmation. It is not configured yet, so no Resume/Portfolio has been sent. Canonical Markdown and epistemic markers are Chinese-first while source-language names remain unchanged. P4.1B is **not yet a usable baseline**.
- Offline AI contract/cache regressions and all authoritative Local Resume/Portfolio, CareerEntity, confirmed-only CareerEvidence and Phase 3 regressions pass.

## 2026-08-24 — P4.1 Archive Cleanup & Workspace Reorganization

- Removed only 208 KB of regenerated Python bytecode and Finder metadata plus an empty, benchmark-created Paddle cache hierarchy. Shared Hugging Face/Docling cache remains `REVIEW_REQUIRED` and untouched.
- Root documentation is now limited to everyday entry points: `README.md`, `PROJECT_STATUS.md`, `NEXT_PHASE_HANDOFF.md`, `TECHNICAL_EVIDENCE.md` and `文件说明.md`/`.pdf`. Completed architecture reports live in `docs/architecture/`; completed phase checkpoints live in `docs/history/`.
- Durable evaluation evidence remains in `document_benchmark/`, which now has `README.md` and `CLEANUP_MANIFEST.md`.
- Post-cleanup CareerEntity, CareerEvidence, Phase 3, native PDF and Apple Vision OCR smoke regressions pass with `0 architecture regressions`.
- This is housekeeping only: the no-model architecture remains frozen and P4.2 has not started.

## 2026-08-24 — Repository Structure Cleanup

- Root now exposes `app.py`, five daily documentation entry points, and the primary folders `src/`, `scripts/`, `tests/`, `data/`, `public/`, `docs/` and `document_benchmark/`.
- Production Python modules moved to `src/`; Swift extraction adapters to `src/extraction/`; bounded/manual operations to `scripts/`; authoritative regressions to `tests/`; SQLite schema to `data/schema.sql`.
- `app.py`, scripts, regressions, benchmark harness, README commands and Markdown references now use the new paths. `docs/current/REPOSITORY_STRUCTURE_AUDIT.md` records the responsibility classification and dependency map.
- All authoritative regressions and a localhost application smoke passed after the move. No production behavior or frozen architecture contract changed.

## 2026-08-24 — Final No-model Document Understanding Closeout

```text
CAREER DOCUMENT UNDERSTANDING FOUNDATION = COMPLETE
NO-MODEL ARCHITECTURE = FROZEN
TARGETED MAPPING FIXES = CLOSED
```

- English image-only CV mapping now preserves `3 WorkExperience / 2 Education / 3 SkillGroup / 2 Language / 3 Award` entities. Award dates and other unsupported fields remain empty; every added entity retains source anchors.
- Touchine Portfolio mapping now returns five real project identities: `MemoryBlock`, `MUPAHKC`, `Material Card`, `Mac Setup`, and `Material Resonance`. CASE/category labels remain `category` / `section_label` metadata, and overview/contact pages are not promoted to projects.
- The complete real regression matrix passed: English CV, Touchine Portfolio, Tencent Resume PDF, Tencent Resume DOCX, Tencent Portfolio, 45-page comprehensive Portfolio, CareerEntity, confirmed-only CareerEvidence, duplicate/stable identity, refresh persistence, syntax/contracts, and existing Phase 3 analysis review.
- Normal browser acceptance passed without confirming career facts: English CV displayed 14 pending entities; Touchine displayed five pending projects; source-card switching worked; provenance expanded to page/line anchors; same-type duplicate import added `0`; refresh retained the five entities; confirmed entities and derived Evidence remained `0`.
- No OCR provider, Apple Vision selection, DocumentBlock v1, IndexedDB ownership boundary, or confirmed-only Evidence behavior changed. P4.2 has not started.

Remaining non-blocking limitations: ambiguous source-section semantics, conservative review calibration, and portfolios without reliable project boundaries that correctly remain `needs_manual_selection`.

## 2026-08-24 — Independent Blind Review Final Architecture Judgment

Historical audit verdict: `KEEP FROZEN WITH TARGETED FIXES`. The two targeted fixes identified here are now closed by the final no-model closeout above.

The native-first + selective Apple Vision + conditional OCR-Resume GapTree + DocumentBlock v1 architecture remains frozen. Independent review of the 45-page comprehensive Portfolio matched Job Radar on all five named projects, multi-page grouping, unknown outcomes and provenance. Two real implementation gaps remain: the image-only English CV has OCR blocks for awards and skill categories that are not fully projected into CareerEntity, and the Touchine Portfolio omits Mac Setup while using CASE/category labels as project names. Both are Document Structure / CareerEntity Mapping fixes, not evidence for reopening OCR or replacing the architecture.

`CAREER DOCUMENT UNDERSTANDING FOUNDATION` was architecture-complete at this gate. Current implementation status is `COMPLETE / FROZEN / TARGETED MAPPING FIXES CLOSED`. Full judgment and closeout addendum: `docs/architecture/DOCUMENT_UNDERSTANDING_FINAL_ARCHITECTURE_REVIEW.md`.

## 2026-08-24 — Document Understanding Architecture Gate

`CAREER DOCUMENT UNDERSTANDING FOUNDATION = COMPLETE / ARCHITECTURE BENCHMARKED AND FROZEN`.

The production path is native-document-first, selective Apple Vision V1 Auto only for unusable PDF pages, and conditional GapTree-style ordering only for OCR Resume pages. Outputs normalize to DocumentBlock v1 before the existing Entity-first boundary; Resume and Portfolio keep separate extraction/grouping logic.

Real corpus: 20 documents / 305 pages, 20 completed, 0 crashes, 18 reviewable, 2 external benchmark-only Portfolios safely `needs_manual_selection`, and 6/6 truth documents passed. Tencent Resume PDF/DOCX remain 13 entities; Tencent Portfolio remains four projects; the image-only English CV now yields 3 Work + 2 Education + Skills; the architecture Portfolio yields four projects with unsupported role/outcome fields empty.

Paddle, Surya and Docling were tested; none justified replacing the local Apple/native path. Details: `docs/architecture/DOCUMENT_UNDERSTANDING_ARCHITECTURE_BENCHMARK.md`. Do not resume OCR/framework experimentation without repeated new real-user evidence. Do not start P4.2 automatically.

## Phase Decision

- Current Phase: `ACTIVE / Phase 4 Career Intelligence Workspace & Agent Backend`.
- Active milestone: `P4.1 Career Material Entity-first Import`.
- Current slice: `COMPLETE / REAL RESUME + REAL PORTFOLIO ACCEPTANCE VERIFIED`.
- Current ingestion contract: `SourceDocument → ExtractionRun → CareerEntity → Entity Review → Confirmed Career Model → selective CareerEvidence derivation`.
- `CareerEvidence` remains the future JobRequirement matching layer; it no longer stores the Resume itself.
- IndexedDB and SQLite remain alternative implementations, not automatic replicas.
- Resume and Portfolio share the CareerEntity/review/evidence domain but use separate extraction paths.

## P4.1 Closeout — Career Material Entity-first Import

- Real Resume PDF: 13 `needs_review` entities — Basics 1, WorkExperience 3, Education 2, Resume Project 3, SkillGroup 2, Language 2. Missing/ambiguous fields remain null/low-confidence rather than guessed.
- Real image-only Portfolio PDF: native PDF text was empty; local PDFKit rendering plus macOS Vision OCR produced 4 `PortfolioProject` entities. No cloud/model request occurred.
- Portfolio grouping: same explicit CASE number is the only automatic multi-page merge signal. Material Card is `[4,5]`; MUPAHKC is `[7]`, so working-method and contact pages are not falsely attached.
- Layout-aware mapping: OCR blocks now preserve normalized coordinates/confidence. Field extraction accepts text from the same column below a label, rejects low-confidence/neighbouring-card blocks, and leaves unsupported fields empty. `Problem`, `Role`, `Process`, `Tools`, `Outputs`, `Boundaries`, source pages/assets and field anchors are reviewable.
- Browser acceptance in an isolated localhost IndexedDB origin: Portfolio import `4`; Resume import `13`; duplicate Portfolio import `0`; four Portfolio entities confirmed in acceptance simulation; `10` derived Evidence exported; reload retained sources, 13 pending entities, 4 confirmed entities and 10 active derived Evidence; browser console had no errors.
- Existing v0–v4 stores and records remain additive/preserved. SQLite was not written by career-document extraction.
- Gemini/DeepSeek document comparison is not justified in P4.1: the observed image-only/layout failure was resolved by the local coordinate-aware OCR path. A later comparison requires a documented residual document-understanding failure.

## Execution Mode Update — Continuous Milestone Build

For user-confirmed Phase 4 milestones, normal implementation, diagnosis, fixes and regressions continue without per-small-step approval. Pause only at material external, destructive, privacy/security, scope/architecture or missing-input blockers. Local user corrections may inform local-only correction memory; they are not centralised or used for shared training by default.

## P4.1 Reliability Extension — Local Correction Memory + Source Interaction

- IndexedDB v4 adds `correction_memory`: `ocr_replacement`, `section_alias` and `classification_correction` records are browser-local and versioned by `local_correction_memory_v1.json`.
- Corrections are applied only to the local extraction request. The localhost service validates/bounds the data but does not persist it; no provider call, SQLite write, upload or shared training occurs.
- Entity edits automatically remember bounded string corrections; a manual local-memory form supports aliases such as `PROFESSIONAL EXPERIENCE → work`.
- One unified intake zone supports file selection, drag/drop and clipboard file/plain-text paste. Pasted text is stored as a browser-local TXT SourceDocument.
- Source cards are now selectable and synchronize the lower review/confirmed/evidence view. Each existing source has `重新识别此资料`, which reruns the current local parser against its retained browser Blob without deleting source data.
- Real DOCX regression and UI re-recognition now yield the same 13 Resume entities as the real PDF. Browser evidence confirmed an OCR correction and section alias applied on pasted Resume input, persisted after reload, and current DOCX re-recognition created 13 pending entities with no console errors.
- Isolated browser acceptance also changed one complete WorkExperience to Education before confirmation: only name/institution, date, location and supported highlights carried over; unsupported Education fields remained empty, the confirmed card became Education, and the browser console stayed clean.

## Implemented Resume Slice

- Inputs: PDF, DOCX, Markdown and UTF-8 TXT, maximum 8 MB.
- Local route: `POST /api/career-document-extract`; no external model and no SQLite write.
- Resume entities: Basics, WorkExperience, Education, Resume Project, SkillGroup and Language.
- Complete WorkExperience grouping retains company, role, raw/normalized dates, location and all wrapped bullets.
- Deterministic extraction does not guess missing dates or ambiguous company/title boundaries; it lowers confidence and adds warnings.
- IndexedDB `job-radar-local-first-v1` uses additive version 4 stores: `extraction_runs`, `career_entities`, `entity_review_decisions`, `correction_memory`; all prior stores and records remain.
- Review unit is one entity. Confirm, edit-and-confirm, reject and reopen are recorded without changing source anchors.
- Confirmed entities project to a JSON Resume-compatible Career Profile and selectively derive capability/responsibility/outcome Evidence.
- Resume entity, extraction-run and Portfolio-project contracts are versioned in `data/domain_contracts/`.

## Verified Behavior

- Real Tencent-targeted one-page Resume: 13 entities — 1 Basics, 3 Work, 2 Education, 3 Project, 2 SkillGroup and 2 Language.
- The three Work entities preserve `company + role + dates + location + 2/1/1 highlights`; the wrapped Good Art bullet remains one item.
- Duplicate browser import creates 0 additional entities and leaves the review count unchanged.
- One Work entity was edited at entity level, confirmed, and produced 2 selective Evidence records; reopening removed it from the confirmed derivation, and reconfirming rebuilt the two records.
- Browser refresh retained 12 pending entities, 1 confirmed entity and 2 derived Evidence records.
- Additive upgrade retained two pre-existing SourceDocuments and seven legacy v0 Evidence records. Legacy records remain visible as preserved data but do not enter the v1 profile.
- Python, JavaScript and JSON contract checks pass; existing Phase 3 analysis regression remains unchanged.
- Empty/no-CASE Portfolio text returns 0 Project entities and `needs_manual_selection`; image-only PDFs proceed to the local visual OCR path. This is a fail-closed boundary test.

## Failure Coverage

- Missing Work date → `startDate/endDate = null`, `missing_date`, low confidence.
- Ambiguous company/title → empty unresolved field, `ambiguous_company_or_title`, low confidence.
- Header-only/partial Work text → `no_highlights_detected`, low confidence, still `needs_review`.
- Duplicate import → stable entity identities and no uncontrolled entity creation.
- Entity reopen → derived Evidence becomes stale/not active until reconfirmed.
- IndexedDB v2→v4 → creates only missing stores; old data remains.

## Learning and Ownership Boundary

- Product lesson: Resume entities own chronology and context; Career Evidence owns job-relevant claims derived from confirmed entities.
- Extraction confidence is not human verification. Every entity starts `needs_review`.
- The implementation, parser, schema, migrations, regressions and browser acceptance were Codex-assisted; they do not establish independent user coding ability.
- The one confirmed Work entity in the browser is an implementation acceptance action executed during testing, not a new independently verified employment claim.

## Historical P4.1A Stop Gate

P4.1A Local is complete. The user has now explicitly approved P4.1B AI-Assisted ingestion, which is the only active extension. Do not automatically start P4.2, RAG, MCP, Agent or Job Discovery.

## Runtime Selection — Qwen direct multimodal verification (2026-08-26)

- By user decision, Qwen now requires only an API Key. A click sends one minimal synthetic text+image request to fixed `qwen3.8-max` and visibly progresses through `正在发送模型列表请求 → 正在等待 Qwen 响应 → 正在验证图文输入能力 → 验证成功/失败`.
- The API Key is read from Provider-scoped browser `localStorage` and forwarded once by the local process when the user clicks connect; the server does not persist it. The request contains the fixed `JOB RADAR TEST` image and instruction only: no Resume, JD, Candidate data or SQLite persistence.
- Success means the returned text contains the synthetic image label, so the selectable model is actual image-input verified rather than name- or provider-inferred. This may incur minimal Qwen usage.
- Static and mocked HTTP regressions pass. The live call happens when the user refreshes and presses the updated Qwen connection button; the prior keyed page was not inspected or migrated.
- Selection persistence correction: a verified Qwen model is inserted into the main selector's `addedModels` collection and stored in browser `localStorage` without any Key. The chosen runtime is stored separately, so refresh/reopen restores Qwen and the asynchronous DeepSeek catalog load cannot replace it.
- A cache-versioned script URL (`runtime-ui-v4`) ensures an existing Runtime Selection tab receives the current readiness/persistence/menu fix on refresh.

## Runtime Selection — Add Model sheet interaction correction (2026-08-27)

- The Add Model overlay remains a bottom sheet. Its top grabber now supports continuous vertical resizing and three system-like height detents; Arrow Up/Down provides the same adjustment for keyboard users.
- Provider selection is one native dropdown for DeepSeek, Gemini and Qwen. The provider-specific API Key guide link switches immediately with the selected option.
- API Keys are now explicitly user-authorized browser-local persistence, keyed per Provider under `job-radar-provider-api-key:<provider>`. The sheet restores the last Provider and its saved Key after refresh; the trash icon removes only that Provider's saved Key. Keys are still excluded from the controller's exposed state and from the added-model selector record.
- The interface copy now says the Key is stored in the local browser and not uploaded to Job Radar cloud. This is browser storage, not OS Keychain isolation: same-origin scripts can read it.
- The connection button owns its visible state: idle text; spinner with no text while sending/waiting/verifying; a standalone check after verification; and `重试连接` after failure. The old bottom status row was removed visually while an `aria-live` announcement remains for assistive technology.
- The top-right completion action is icon-only and remains disabled until a Provider, saved/entered Key, verified multimodal model and selected model are all present.
- Regression contracts and live local-browser checks passed for Provider/link switching, refresh restoration, icon-only completion, visual status removal and height adjustment. No Provider request or career data transmission was made during this correction.

## Runtime Selection — default readiness + Apple-style menu correction (2026-08-27)

- Root cause: `loadModels()` copied the default DeepSeek descriptor into `state.provider/state.model` but left `state.phase = IDLE`. The UI therefore displayed a selected model while the next button still evaluated `ready = false` until the user selected the same model again.
- Fix: the default, restored and clicked paths now share `applyReadyModel(ModelDescriptor)`. A verified default DeepSeek model enters `OFFICIAL_READY` immediately; a previously verified added model enters `READY`; local mode enters `LOCAL_READY`. Display value and button readiness can no longer diverge.
- Browser-local continuity: added models and the selected runtime now use `localStorage`, with one-time migration from the earlier session record. Qwen's Provider-scoped Key is re-persisted on input/change/blur/close and immediately before connection. No Key is stored in the added-model or selected-runtime records.
- Origin rule: local development canonicalizes `localhost:8000` to `127.0.0.1:8000`, because browser storage is origin-scoped and the two hostnames cannot share a Key. A Key that existed only under the old hostname must be entered once at the canonical address.
- Motion/UI: the next arrow keeps the existing black/white visual language and adds soft hover elevation, shadow, arrow translation and press scale. The selector border/shadow transitions continuously. The menu uses a 20 px rounded translucent surface, blur, scale/translate/opacity entrance, staggered option reveal, selected checkmark and no redundant menu titles.
- Acceptance: fresh reload showed `DeepSeek · deepseek-v4-flash-vision-exp` with `runtime-action ready`; clicking the arrow navigated directly to `/workspace.html` without opening the list. Menu computed style changed from hidden `opacity 0 / translateY(-9px) / scale(.985)` to visible `opacity 1 / identity transform`; hover shadow changed from `0 2px 7px` to `0 14px 30px + 0 4px 10px`. Console errors/warnings: 0. No Provider connection was submitted.

## V1 floating-window unification + continuous detail plane（2026-08-28）

- Runtime cache contract is now `runtime-ui-v47`; V1 is `v1-motion-20`.
- Saved Personal/JD detail and Add Guide overlays now render as one continuous 80% surface: left object detail and right scoped AI conversation have zero inner radius/gap and one `1px` center divider. The underlying detail/conversation content and boundaries are unchanged.
- Runtime Add Model and the shared Personal/JD overlay now use `public/floating-window.js`: the header drags the surface; four edges and four corners resize it; viewport margins and minimum dimensions prevent losing the window; an interaction shield preserves pointer continuity across embedded iframes.
- Embedded detail panes reserve 52px bottom safe space, stable scrollbar gutters and inset WebKit scrollbar tracks. Import overlays reserve 56px safe space plus a 24px terminal margin, preventing end content/thumbs from being clipped by the outer rounded surface.
- Verification: all 14 Node `.mjs` regressions passed. Browser final-version acceptance confirmed eight resize handles, `gap: 0px`, inner radii `0px`, divider `1px`, and bottom padding `52px`; the left pane scrolled to exact maximum with the last item still 64px above the visible pane edge. Local JD page returned HTTP 200. No Provider/API request or user career-data mutation occurred.

### Learning checkpoint

- Product Progress: one window grammar now covers model configuration, saved detail and import overlays; detail and AI remain separate functional columns within one spatial object.
- New Transferable Knowledge: visual grouping can be changed independently of the information boundary; resize/drag input must be clamped and must survive iframe pointer crossing; rounded containers need explicit scroll-end safe zones.
- User-owned Capability Evidence: the user identified the misleading two-card hierarchy, requested one divider-based surface, required universal window manipulation, and detected the rounded-scroll clipping defect.
- Tool-assisted Implementation: shared controller, geometry clamping, CSS integration, cache versioning, regression coverage and browser measurement were implemented and validated by Codex.
- Remaining Capability Gaps: no independent user-authored implementation evidence was produced; touch-device manipulation and OS-level accessibility testing remain future acceptance work.

## Workspace folder attached-copy + staged paper motion（2026-08-28）

- V1 cache contract is now `v1-motion-21`.
- Root cause 1: folder title/subtitle/count were sibling layers fixed at `translateZ(96px)`, so they visually floated above the front cover while that cover rotated. They are now children of `.v1-folder-front` at a 2px local depth, and therefore inherit the exact same open/close 3D transform.
- Root cause 2: all three paper layers previously had different resting Y positions and received the same hover delta. The interface was effectively swapping between two already-separated arrangements. All three papers now overlap at the same resting transform, then separate in order with 0/42/84ms entrance delays and merge in reverse with 0/42/84ms exit delays. Every change remains a continuous 560ms transform; no display/visibility switch is used.
- Browser evidence: at rest the three paper top coordinates were exactly `627.99 / 627.99 / 627.99`. During opening they progressed through distinct intermediate positions and settled at `293.81 / 300.76 / 307.72`. The copy is DOM-contained by the front cover and moved continuously while the cover reached `rotateX(-30deg)`.
- Regression: all 14 Node `.mjs` suites, all public JavaScript syntax checks and `GET /workspace.html` HTTP 200 passed. No Provider/API call or persistent data mutation occurred.

### Learning checkpoint

- Product Progress: the folder now reads as one physical object; one visible paper becomes three on approach and the label behaves like printing on the cover rather than a floating HUD.
- New Transferable Knowledge: elements that represent one physical plane should share a transform ancestor; staggered enter/exit motion needs explicit rest equivalence and reverse ordering, not only different end positions.
- User-owned Capability Evidence: the user diagnosed both the detached text plane and the abrupt one-to-three/three-to-one state change from a real recording.
- Tool-assisted Implementation: DOM nesting, 3D depth correction, staged timing, regression contracts and frame/state measurement were implemented by Codex.
- Remaining Capability Gaps: physical mouse/touch feel remains a subjective acceptance item for the user; no independent user-authored code evidence was added.

## Workspace folder exit-order regression fix（2026-08-28）

- V1 cache contract is now `v1-motion-22`.
- Root cause: the first staged implementation collapsed the back paper before the two papers in front. During the first 35ms of pointer leave, the back paper crossed the middle paper (`307.67 / 302.92 / 307.72`), which looked like one page was abruptly removed even though every individual transform was continuous.
- Fix: exit now merges front → middle → back with `0/56/112ms` delays. The exit uses a calmer `660ms cubic-bezier(.22,.72,.2,1)` paper curve and a `640ms` cover curve; entrance retains the faster `0/42/84ms` separation and existing open endpoint.
- Real-pointer browser acceptance ran three enter/leave cycles on both Personal Information and JD. In all six cycles, open coordinates were `293.81 / 300.76 / 307.72`, every sampled exit frame preserved `back ≤ middle ≤ front`, and rest returned to `324.49 / 324.49 / 324.49`.
- All 14 Node regressions, 17 public JavaScript syntax checks and Workspace HTTP 200 passed. No Provider/API call or domain-data mutation occurred.

### Learning checkpoint

- Product Progress: the folder no longer loses a visible page while closing; both object folders share the same stable physical stacking rule.
- New Transferable Knowledge: continuous transforms can still create a discontinuous perception when 3D layers cross; exit sequencing must preserve visual occlusion order, not merely reverse entrance delays.
- User-owned Capability Evidence: the user detected the residual leave-only defect after the first motion correction.
- Tool-assisted Implementation: pointer reproduction, frame measurement, exit-order correction, cache versioning and regression coverage were implemented by Codex.
- Remaining Capability Gaps: touch/pencil hover behavior and device-specific GPU compositing remain future acceptance work.

## Workspace JD dark-folder surface synchronization（2026-08-28）

- V1 cache contract is now `v1-motion-23`.
- JD paper layers and their document lines now share the dark resting palette with the JD folder. Hover/focus/transition-light changes the back, papers, paper lines, front cover and copy to the existing light palette through the same 360ms color transition.
- Browser acceptance measured rest paper `rgb(42,46,54)` / line `rgb(85,91,103)`, hover paper `rgb(245,246,248)` / line `rgb(217,222,231)`, and exact return to the dark values after pointer leave. The non-crossing paper motion contract remains intact.
- All 14 Node regressions, all 17 public JavaScript syntax checks and Workspace HTTP 200 passed. No Provider/API call or career-data mutation occurred.

## Workspace folder compositor-flicker and paint-cost correction（2026-08-28）

- V1 cache contract is now `v1-motion-24`.
- Root cause: the three paper layers shared the same 3D depth and z-index; at the end of close, the front cover also changed from a matrix to `transform: none`. That combination allowed a final compositor layer reorder that appeared as a paper briefly piercing the closed folder. The animated hover shadows added paint work during the same interval.
- Fix: back/paper/front planes now retain deterministic depths `-4 / -3 / -2 / -1 / 0px` and explicit z-order. The front cover keeps `translate3d(0,0,0)` at rest, so it is never demoted at transition completion. Paper exit is shortened to `500ms` with `0/40/80ms` front-to-back delays; all papers finish before the `640ms` cover close.
- Performance: hover motion now animates compositor-friendly transforms and the already-required color transitions only. Folder, paper and cover shadows are stable rather than animated; the folder establishes an isolated layout/style containment boundary and all 3D surfaces hide their back faces.
- Real-pointer acceptance: Personal Information and JD each completed three full enter/leave cycles, followed by a rapid leave/re-enter/leave reversal. Every cycle returned to stable paper depths `[-3,-2,-1]`, z-order `[1,2,3]`, front identity matrix and no hover state. Open, close midpoint and final frames were visually inspected; browser logs were empty.
- All 14 Node `.mjs` regressions, all 17 public JavaScript syntax checks and Workspace HTTP 200 passed. No Provider/API request or career-data mutation occurred.

### Learning checkpoint

- Product Progress: folder close no longer exposes a last-frame paper/compositor flash, and hover/leave requires less per-frame paint work.
- New Transferable Knowledge: continuous CSS values are insufficient when multiple 3D surfaces are coplanar; stable depth ownership and a non-`none` terminal transform prevent compositor handoff artifacts. Animated shadows are a paint concern even when transform motion is GPU-composited.
- User-owned Capability Evidence: the user repeatedly isolated a leave-only visual defect and explicitly connected animation feel with rendering cost, prompting a layer/compositor diagnosis rather than another cosmetic timing adjustment.
- Tool-assisted Implementation: layer-depth stabilization, close sequencing, paint optimization, cache versioning, regression contracts and real-pointer verification were implemented by Codex.
- Remaining Capability Gaps: touch/pencil hover and low-end-device frame-time profiling remain future acceptance work; no independent user-authored implementation evidence was added.

## Floating import scrollbar safe-inset correction（2026-08-28）

- V1 cache contract is now `v1-motion-26`.
- Root cause: Personal/JD import embeds declared `overflow:auto` on `body`, but browser root-scroll propagation still assigned the visible scrollbar to the iframe viewport. The outer floating surface clipped that viewport scrollbar at its rounded bottom corner, so the thumb looked abruptly cut off.
- Fix: import `body` is now a fixed `100vh` non-scrolling viewport and `.v1-page-shell` owns the actual internal scroll. The shell keeps 52px scroll-end padding, stable gutter, thin scrollbar styling and a 20px top/bottom track inset. Structured detail and scoped-conversation panes share the same rounded thumb and track contract.
- Browser acceptance: at the equivalent 1022×516 iframe viewport, Personal shell measured `clientHeight=516`, `scrollHeight=696`, `max=180`; a real wheel event reached `scrollTop=180.5`. JD measured `516 / 668 / 152` and reached `scrollTop=152`. In the actual 80% Personal import overlay, the right thumb remained inside the floating surface with bottom clearance rather than touching the rounded corner.
- All 14 Node `.mjs` regressions, all 17 public JavaScript syntax checks and all 8 active V1 page HTTP checks passed. No Provider/API request, Key access or career-data mutation occurred.
- Figma export preflight: the official Figma plugin was installed for the requested MCP workflow. Because connector tools are loaded only at the beginning of a task turn, the current turn could not hot-load `generate_figma_design/use_figma`; the exact 15-page public UI inventory and existing target file key are retained in `NEXT_PHASE_HANDOFF.md` for immediate continuation.

### Learning checkpoint

- Product Progress: import overlays now own their scrolling inside the rounded surface, so scroll-end affordance and content safe space agree visually.
- New Transferable Knowledge: setting overflow on `body` does not guarantee a nested scroll container because root overflow can propagate to the viewport; a fixed viewport body plus an explicit child scroller makes scrollbar geometry controllable.
- User-owned Capability Evidence: the user identified the scrollbar as a boundary/clipping defect rather than a missing content-padding defect and requested an editable design handoff.
- Tool-assisted Implementation: scroll ownership correction, scrollbar styling, cache versioning, browser measurement and regression coverage were implemented by Codex; the later MCP import milestone below supersedes the earlier pending note.
- Remaining Capability Gaps: the user still needs to review and adjust the imported editable Figma frames; no independent user-authored implementation evidence was added.

## Local-only detail UI + Figma MCP handoff（2026-08-28）

- Candidate Detail and Job Detail no longer render scoped AI conversation panes. Both reuse the existing local fixture/IndexedDB read path and present one structured information pane; Candidate direct edit remains available.
- The shared floating overlay iframe is now labelled `本地资料详情`. Personal/JD import overlays keep their existing local file/paste, processing and completion flow without a conversation UI.
- A new-account Figma file was populated directly through Figma MCP with 20 named editable frames: 14 public routes plus Runtime dropdown, Add New Model, Personal import/detail overlay and JD import/detail overlay states.
- Figma file: <https://www.figma.com/design/3XdQUI6Dd1BhGCZVhFOncF/Job-Radar-Web-first-V1-%E2%80%94-UI-Screens>. No paid plugin continuation, account upgrade, Provider request, API Key, browser secret or personal source file was used.
- Final verification: 14 Node regressions, 17 public JavaScript syntax checks, 14 HTTP page checks and zero remaining Figma capture scripts passed. Browser inspection measured `conversation=0`, `structured=1` for Job detail and `conversation=0`, `filePicker=1` for Personal import.

### Learning checkpoint

- Product Progress: editable design handoff is complete and the local information flow is visually simpler; AI conversation is no longer presented inside the local import/detail surface.
- New Transferable Knowledge: MCP can write rendered local web pages into editable Figma layers, but exact browser rendering still requires a temporary capture bridge; that bridge should be removed and CSP restored after export.
- User-owned Capability Evidence: the user rejected the paid plugin path, required direct MCP use, and explicitly simplified the local import boundary by removing AI conversation.
- Tool-assisted Implementation: UI removal, regression updates, MCP capture, frame cleanup/naming, screenshot comparison and capture-script cleanup were performed by Codex.
- Remaining Capability Gaps: Figma visual edits and any design decisions derived from them still require user review before code synchronization.
## Ariadne UI consistency + duplicate-aware local intake（2026-08-31）

- Product/UI: user-facing `Job Radar` branding is now `Ariadne`; Workspace and the V1 pages share the neutral `#f7f7f9` canvas. Recursive is the Latin display/body preference, Inter is the CJK preference, and IBM Plex Serif Regular remains the final named fallback. Soft rectangular surfaces use a 20px radius; browsers that support CSS `corner-shape` receive the squircle approximation, while the editable Figma surfaces use corner smoothing `0.6` exactly.
- Layout: Personal and JD card grids stretch every card to the same row height and retain one 18px row/column gap. Workspace folders are 10% smaller, centered as a pair and retain the existing hover/open/close motion. Existing drag/resize, card-to-floating-surface, minibar and press animations were not removed.
- Local duplicate contract: Candidate and JD imports now normalize text, score possible duplicate records, and pause before persistence. Local mode offers `融合重复内容 / 保留为新卡片 / 取消导入`; deterministic fusion preserves the existing object ID, unions sources/list fields, increments the item version and records merge metadata. The JD form also accepts an optional provenance URL without attempting to fetch it.
- Model-assisted boundary: if a model runtime is selected and the user chooses model fusion, the UI stops before write and explains that a real Provider call requires explicit approval. This milestone made no Provider request and did not transmit career material. Local import, local fusion, static AI-view rendering and the deterministic scoped-conversation response were verified.
- Figma: the editable file page is now `Ariadne — UI Screens` and retains only the seven requested frames: Workspace, Personal import/local/AI, and JD import/local/AI. The frames use the new brand, typography, 20px/60% surfaces, centered Workspace geometry, optional JD URL field, and black AI / white user message ownership.
- Verification: all Node `.mjs` regressions and all Python regression scripts passed. Browser acceptance created and then fused a sanitized duplicate JD into one card, measured exact 18px card gaps/equal row heights, verified 20px squircle surfaces, checked black AI/white user messages, and ended with zero console errors. The original Qwen runtime selection was restored after the local-only test.

### Learning checkpoint

- Product Progress: Ariadne now has one consistent visual grammar and a Human-in-the-loop duplicate decision before local persistence.
- New Transferable Knowledge: duplicate detection and duplicate resolution are different stages; deterministic local fusion can be implemented and tested without granting an LLM authority over stored truth. Figma corner smoothing is an exact design property, while the closest current web expression is a progressive CSS enhancement.
- User-owned Capability Evidence: the user supplied the spacing, typography, interaction, merge-policy and design-handoff acceptance criteria and identified the need to distinguish local fusion from model-assisted fusion.
- Tool-assisted Implementation: normalization/scoring/merge helpers, modal state, visual-token reconciliation, Figma construction, browser measurement and regression execution were implemented by Codex.
- Remaining Capability Gaps: a real Qwen fusion/ingestion request remains deliberately unexecuted pending explicit approval; user review of the updated editable Figma frames is still required. No independent user-authored implementation evidence was added in this milestone.

## Ariadne material-routed intake + compact Workspace refinement（2026-09-01）

- UI contract: V1 cache contract is now `v1-motion-32`. Personal/JD import use the entire dashed surface as one click/drop target; visible “选择文件” and supported-format copy were removed, while the hidden file input still accepts PDF/PNG/JPG/JPEG/DOCX. Upload copy opacity is 90%.
- JD intake: PDF and image are consolidated into one user-facing `图像` mode with a single five-format accept/validation contract; `粘贴文本` remains the second mode and the optional provenance URL remains unchanged.
- Candidate AI boundary: `src/candidate_context.py` now routes Resume / Portfolio / Project / Other to four distinct grounded prompt profiles. Unknown material types fail closed. The browser import metadata records the chosen prompt-profile ID, but this milestone does not connect or execute a Provider request.
- Workspace/navigation: Ariadne is mathematically centered. Folder geometry is 85% of the previous footprint (`901px` pair width, `27px` gap, `252px` height), positioned at 54vh center; the tab/body seam overlaps by 2px to avoid a missing corner. The top-right minibar is approximately 10% larger. All V1 return arrows share one 24px rounded SVG-mask path.
- Card copy: stored Candidate/JD cards no longer show “打开材料 / 打开职位上下文”. Personal/JD guide cards removed the category-format subtitle and cross-fade from the requested default sentence to “文件仅在当前浏览器中处理” on hover/focus.
- Verification: 14/14 Node regressions passed; 7/8 unrelated Python regression scripts passed, with the pre-existing `career_entity_regression.py::test_real_portfolio` assertion still failing outside this UI/prompt scope. The targeted material-prompt suite passed 5/5. All 17 public JavaScript files passed syntax checks and seven active V1 pages returned HTTP 200. Browser acceptance measured exact Workspace centering and 85% folder geometry, 53×57 minibar, a 230px full hit-area dropzone, 0.9 upload-copy opacity, two JD modes, six identical arrow masks, reversible JD import overlay, and no stale open labels. No Provider/API/Key/cost action occurred.

### Learning checkpoint

- Product Progress: one file surface now supports all required local document formats, while semantic material type and input transport remain separate decisions.
- New Transferable Knowledge: MIME/extension acceptance, prompt routing, and persistence authority are three distinct boundaries; changing one must not silently broaden the others.
- User-owned Capability Evidence: the user supplied the exact copy, geometry, format consolidation, prompt-routing and visual-alignment acceptance criteria.
- Tool-assisted Implementation: DOM/CSS refinement, prompt routing, validation, regression updates, browser geometry checks and documentation were implemented by Codex.
- Remaining Capability Gaps: real Provider ingestion and model-assisted merge still require a separate explicit authorization and bounded content/cost decision; the historical Portfolio fixture assertion remains outside this milestone.

## Figma vector folders + runtime-scoped detail controls（2026-09-01）

- Figma authority: Workspace node `9:2` in file `3XdQUI6Dd1BhGCZVhFOncF` was re-read through Figma MCP. Its Personal/JD folder back is one continuous vector rather than a rectangle plus a separately stitched tab. The exact Figma path is now committed as `public/assets/figma-folder-back.svg` and used as the shared CSS mask, removing the residual notch/gap without changing the established three-paper hover motion.
- Detail-mode contract: the current Runtime selection, rather than record provenance alone, controls the editing surface. Local Runtime shows a top-right `编辑` action and hides the AI pane; opening it scrolls and focuses the existing summary/facts form so the interaction is immediately visible. A selected model keeps the scoped conversation on the right and hides direct local editing.
- Human-in-the-loop boundary: Candidate and JD model conversations can produce reviewable before/after patches. Accept/reject remains explicit; no model output silently overwrites the stored object. The browser QA route used deterministic preview logic only and made no Provider request.
- Icon grammar: back, add and close use a common 24px rounded glyph inside a 36px interactive target where applicable. Duplicate text/pseudo crosses were removed from Add Model and detail overlays.
- Cache contracts: Runtime is `runtime-ui-v48`; V1 is `v1-motion-33`.
- Verification: 14/14 Node `.mjs` regressions, all public JavaScript syntax checks, 5/5 Candidate prompt regressions and 9/9 active pages/assets HTTP checks passed. Real-browser checks covered the seamless Figma folder, Local edit focus/scroll, model-side Candidate/JD patch proposals and single-glyph close icons. No Provider/API/Key/cost action occurred.

### Learning checkpoint

- Product Progress: one selected Runtime now leads to one predictable detail-editing mode, and the Workspace folder geometry matches the editable design source.
- New Transferable Knowledge: record provenance and active interaction mode are separate state dimensions; the former explains how evidence was created, while the latter determines which editing tool the user is currently using.
- User-owned Capability Evidence: the user identified the unreachable edit affordance, required Local/model behavior to diverge, and supplied the Figma folder geometry as the visual acceptance authority.
- Tool-assisted Implementation: Figma path extraction, SVG-mask integration, runtime-mode branching, reviewable JD patch flow, icon normalization and browser/regression verification were implemented by Codex.
- Remaining Capability Gaps: a real model-backed edit/ingestion request still requires explicit provider/model/content/cost authorization and remains unexecuted.

## J1 final acceptance stabilization（2026-09-04，Human acceptance pending）

- Product/runtime authority: Job import no longer exposes a per-import Local/AI selector. The current Ariadne Runtime now selects the Local or Model path; model failure does not invoke a hidden Local semantic fallback.
- Review lifecycle: Candidate-proven import lifecycle states are shared through `model-import-lifecycle-domain.js`. Job Model import moves through source, processing, proposal, review, ready-to-save and saved states; unresolved work is visible and actionable instead of leaving the page on an indefinite “等待审核完成”.
- Shared presentation: Candidate and Job conversations now use the same message-thread and composer primitives. Real-browser computed style inspection matched message width, radius, padding, ownership colors, composer height, field geometry and send-button geometry.
- Job-scope semantics: short prompts in an active Job Detail resolve to current Candidate × active Job and emit a deterministic safe `turn_scope`; capability, evidence, presentation and relevance gaps remain distinct, and missing evidence is not treated as missing capability.
- Real-browser evidence completed: Model Job import, Local Job import, review/save, immutable Job Revision creation, Candidate Model processing preservation, Candidate/Job conversation UI parity and forced `MODEL_FAILED` with no fake proposal or Local fallback. Local import made zero Provider calls; the successful Model import made one expected DeepSeek call and skipped Local semantic structuring.
- Automated evidence: 34/34 Node `.mjs` suites, 20/20 Python `*_regression.py` suites, 40/40 public JavaScript syntax checks and seven final-backend HTTP checks passed.
- Fresh real-Candidate turn: after explicit action-time confirmation, the active Job received “我还需要补充什么能力？”. DeepSeek returned one relevant Candidate × Job gap analysis without a Candidate-vs-Job clarification. Backend safe diagnostics recorded `candidate_snapshot_present=true`, `confirmed_count=27`, `working_count=29`, `project_count=11`, `evidence_count=54`; the request returned HTTP 200 and the analysis was appended without mutating Candidate truth.
- CandidateDelta continuity: the same real Job history preserves the earlier Candidate project change turn and its bounded relevance/non-proof analysis; the new turn recompiled the current Candidate snapshot. Historical Job analysis remained unchanged and visible.
- Acceptance boundary: no READY claim has been made. Mandatory implementation, automated and browser evidence are complete; final Human acceptance of the product path is still required before any staging or commit.

### Learning checkpoint

- Product Progress: runtime selection, import authority, human review and shared conversation presentation now form one consistent J1 path.
- New Transferable reminders: source preparation is not semantic structuring; a visible review state must have an actionable transition; shared UI is proven through shared ownership and computed behavior, not similar CSS values.
- User-owned Capability Evidence: the user rejected the earlier READY report based on real UI failures and specified the product/runtime, review and Job-scope acceptance contracts.
- Tool-assisted Implementation: lifecycle extraction, runtime-driven branching, shared UI promotion, deterministic referent scope, failure isolation, regressions and browser smoke were performed by Codex.
- Remaining Capability Gaps: final Human acceptance remains open; no staging or commit is authorized.

## J1 final product convergence（2026-09-04，Human acceptance still pending）

- Product flow correction: Model Job import no longer opens the Local field-by-field review surface. Its visible lifecycle is now `Source → durable source → provider-safe preparation → DeepSeek → NON_AUTHORITATIVE WORKING JOB → Job workspace/conversation → Human Workspace Save → immutable confirmed Job Revision`. Local import retains its Proposal/Review/Save path.
- Shared product infrastructure: Candidate and Job processing both call `AriadneModelWorkspaceUI.renderProgress()` and `setProcessingState()`. Candidate, Working Job and confirmed Job conversations all use `AriadneConversationUI.renderMessages()`, the same user/assistant bubble classes and the same composer classes.
- Conversation correction: each Provider request now carries bounded prior Human/Assistant messages as actual chat turns and the latest Human message last. Failed orphan Human attempts remain in the local audit record but are excluded from both the visible connected thread and later Provider history. The Provider is instructed to answer that latest request, resolve follow-up referents, advance instead of repeat, use plain text, and state that realtime Web Search is unavailable rather than inventing repositories or URLs. The exact Provider `output.message` is the Human-visible Assistant copy.
- Browser proof completed so far: a synthetic realistic Job source was durably stored and sent once to `DeepSeek / deepseek-v4-pro`; the page opened the Working Job workspace with the model/runtime indicator, no Local Review UI, then Human Workspace Save created and opened the confirmed Job detail. Backend recorded exactly one Job import Provider call.
- Real conversation proof: all ten explicitly authorized Job-conversation calls were used. Five completed connected turns over the current Candidate × confirmed Job: requirement summary, strongest-evidence comparison, two concrete project-strengthening actions, one-action prioritization with minimum completion criteria, and a three-step plan plus Web-capability boundary. The final answer stated that this Runtime has no Web Search and returned no fabricated repository or URL. Five attempts failed closed and wrote no Assistant copy: one semantic-schema 422, three JSON-mode `EMPTY_RESPONSE` results, and one text-mode `MALFORMED_RESPONSE`.
- Provider-response stabilization: DeepSeek JSON mode was replaced for this contract by one forced strict function call. The last three authorized calls then succeeded 3/3. The plain-text rule prevents future Markdown delimiters; one earlier successful Provider response still contains literal `**` and remains unchanged because Provider copy is append-only evidence.
- Automated proof: all 34 Node `.mjs` suites, all 20 Python `*_regression.py` suites, 41 public JavaScript syntax checks, Python compilation and seven live HTTP checks passed.
- Acceptance boundary: implementation, automated checks, synthetic Model import, five connected real-Candidate turns and Web-unavailable behavior are complete. Human acceptance is still failed/pending; this section does not claim READY. No additional Provider-call authorization remains, and no staging or commit was performed.

### Learning checkpoint

- Product Progress: Model import now hands off to an editable conversational Working object, while Local review remains a separate deterministic product path.
- New Transferable Knowledge: an internal proposal record may support provenance and atomic save without forcing the product to expose a proposal-review queue; Provider-authored conversational copy and system-owned mutation authority are independent contracts.
- User-owned Capability Evidence: the user identified that the technically functioning Model import still violated the accepted product interaction and required exact Candidate-flow reuse plus natural connected conversation.
- Tool-assisted Implementation: working-object lifecycle, shared processing symbols, Provider history/prompt contract, safe diagnostics, regressions and synthetic browser smoke were implemented by Codex.
- Remaining Capability Gaps: only final Human acceptance remains open; no staging or commit is authorized.

## J1 shared product shell convergence（2026-09-04，READY FOR J1 HUMAN ACCEPTANCE）

- Architecture convergence: Candidate and Job now depend on one neutral `AriadneProductShell` for import binding, workspace binding/show/hide, detail binding/runtime application, conversation binding, and edit-panel control. Candidate-owned generic workspace class names were replaced by neutral `v1-workspace-*` shell classes; Candidate keeps its accepted appearance while Candidate/Job schemas, renderers and semantic actions remain domain-specific.
- Exact UI ownership: both detail pages use the same `v1-detail-shell → v1-split-view → structured/conversation panes` contract, the same `AriadneConversationUI.renderMessages()` renderer, the same Human/Assistant bubble classes, and the same composer/input/send selectors. Job's separate detail-composer structure was removed. Both import workspaces bind through the same `ProductShell.bindWorkspaceShell()` and `ProductShell.showWorkspace()` symbols.
- Browser correction: the first real reload exposed `product_conversation_messages_missing` because the workspace message nodes had not declared the shared renderer class. Candidate and Job markup were corrected together to `v1-workspace-conversation v1-conversation-messages v1-conversation-thread`, and both a shell regression and the earlier UI-framework regression now enforce that exact contract.
- Real browser proof: Candidate and Job card-library entry, floating detail shell, content/conversation split, fixed composer, and shared edit-controller activation passed with empty console error logs. Local Job completed `paste → deterministic extraction → Human field correction → confirmation → immutable Job card`, and recorded only `POST /api/local-job-extract`. The fresh Model path completed `paste → DeepSeek → NON_AUTHORITATIVE WORKING JOB → Human Workspace Save → immutable Job Revision` on the same shared shell and never exposed the Local review queue.
- Connected Job reasoning: the saved Job then completed the required five-turn current Candidate × active Job sequence. The Provider compared existing evidence, selected the highest-priority existing project, proposed concrete evidence-strengthening work, supplied a resume-only alternative, and prioritized the actions without treating AI-assisted implementation as independent engineering capability. Two intermediate contract failures returned HTTP 422, produced no Assistant copy, and were excluded from visible and future connected history.
- CandidateDelta acceptance: two source-backed blank project-summary fields were filled without inventing facts; each used the Local preview/confirm path and retained its previous version. A first technically valid but semantically imprecise delta answer remains append-only evidence. The payload was then corrected to carry Provider-safe exact previous/current records and changed fields. A fresh delta turn correctly identified the blank-to-summary change, stated that no function/runtime evidence was added, kept the priority unchanged, and left every earlier Assistant message byte-for-visible-text unchanged.
- Targeted contract fixes: non-mutating EXPLAIN/ASK_CLARIFICATION action labels are canonically derived from the actual clarification payload; project/resume advice cannot trigger a Job edit unless the Human explicitly requests a Job-field mutation; CandidateDelta now binds the Provider to the exact changed record and field while excluding canonical identities, hashes and filesystem paths. Explicit Job edits remain strict and all mismatch paths still fail closed.
- Provider accounting: this final acceptance used 10 actual DeepSeek requests—1 successful Model import, 5 required successful Job turns, 2 fail-closed conversation attempts, 1 append-only but semantically imprecise CandidateDelta answer, and 1 final precise CandidateDelta success. Local import and both Candidate edits used zero Provider calls.
- Automated evidence: 35/35 Node `.mjs` suites, 20/20 Python `*_regression.py` suites, 42/42 public JavaScript syntax checks, Python compilation, and `git diff --check` passed. Staged files remain zero; no reset, stash, checkout, add, or commit was performed.
- Acceptance boundary: `J1 HUMAN ACCEPTANCE: PASS`. Functional scope is frozen; this record is ready for the authorized final J1 closeout commit. No J2 scope is started here.

### Learning checkpoint

- Product Progress: Candidate and Job are now two domain adapters inside one actual product shell instead of parallel presentation implementations.
- New Transferable Knowledge: shared UI is an executable contract—symbol identity, DOM roles and state transitions—not a visual resemblance. Real browser initialization is necessary even when static regressions pass, because a shared binder can expose missing runtime DOM invariants.
- User-owned Capability Evidence: the user defined the product-shell/domain-adapter boundary and required Candidate to remain the accepted reference.
- Tool-assisted Implementation: symbol mapping, neutral shell extraction, duplicate removal, regression adaptation, browser interaction and Local vertical acceptance were performed by Codex.
- Remaining Capability Gaps: J1 has no remaining acceptance gate. The implementation and evidence are Tool-assisted and do not by themselves constitute user-owned independent engineering capability.

## J1 final closeout（2026-09-04，Human Acceptance PASS）

- Scope and privacy audit: no credentials, raw Provider reasoning, Human-visible local filesystem paths, persistent internal IDs, destructive migration, hidden Local fallback, Local Provider call, Web Search implementation, or runtime/provider switch was included in the J1 diff. Candidate evidence in this project status is represented only as a redacted field-level change description.
- Functional scope is frozen after acceptance. Deferred work remains outside J1: Candidate Learning / CandidateUpdateProposal execution, Job clarification-to-Candidate learning, grounded resume optimization execution, project optimization-to-evidence updates, live Web/GitHub research, automatic application, and match percentage/scoring.
## Ariadne global interaction convergence（2026-09-04，READY FOR J1 HUMAN ACCEPTANCE）

- Shared interaction ownership: Candidate and Job now call the same `AriadneSourceInput`, `AriadneProcessingIndicator`, `AriadneConversationUI`, `AriadneProductShell` and `AriadneModelWorkspaceUI` primitives for common input, waiting, Working, detail, edit and conversation behavior. Schema, semantic structuring, actions and persistence authority remain domain-specific.
- Source bundle: both domains accept ordered multi-image accumulation through click, drag/drop or guarded clipboard paste. Normal text paste in text inputs remains native. Model Job sends the bounded bundle once and retains every durable source ID; Local paths remain deterministic with Provider=0.
- Semantic correction: the Model Job prompt now identifies the actual job-content region across the bundle and excludes navigation/header/footer/legal/privacy/copyright/site-service/recruiting CTA chrome from title, company, location, summary, responsibility and requirement fields. Missing or uncertain fields remain unknown rather than being invented.
- Real-browser proof: a three-image DeepSeek Job import produced one Working Job directly, with sane grounded fields and ordered recoverable provenance; Candidate and Job clipboard intake, text-paste non-hijacking, shared Edit lifecycle, exact conversation symbols, live waiting animation, Candidate × Job reasoning and fail-closed Provider behavior all passed.
- Automated proof: all 57 executable Candidate/Job Node/Python regression suites and final JavaScript syntax checks passed; `git diff --check` passed. No tests were removed.
- Acceptance boundary: `READY FOR J1 HUMAN ACCEPTANCE — GLOBAL INTERACTION CONVERGED`. Human acceptance remains pending. No staging or commit was performed.

### Learning checkpoint

- Product Progress: Candidate and Job now behave as two domain adapters inside one interaction system, including source acquisition and perceptible async waiting rather than only a shared visual shell.
- New Transferable Knowledge: source transport, semantic understanding and persistence authority are independent boundaries; UI reuse is proven by common callable symbols and state transitions, while model grounding must explicitly separate content regions from page chrome.
- User-owned Capability Evidence: the user defined the convergence contract, page-chrome failure class, clipboard safety rule and real-browser readiness gates.
- Tool-assisted Implementation: shared primitive extraction, Job bundle/model grounding, UI integration, real-browser execution, regressions and evidence documentation were performed by Codex.
- Remaining Capability Gaps: final Human acceptance is still required; the implementation does not constitute independent user-authored engineering evidence.

## Ariadne Candidate ↔ Job parity repair（2026-09-04，Human acceptance pending）

- Product Progress: Candidate Material Detail now routes item-focused natural-language edits through the Candidate Provider contract and projects the resulting NON_AUTHORITATIVE Working into the existing review/save region. The required role-wording replacement produced a Candidate-only title diff while confirmed facts remained unchanged until Human Save; ordinary questions remain discussion turns.
- Shared edit contract: Candidate and Job Detail now bind the same ProductShell edit-shell roles, field geometry, action region, Cancel, preview, apply/back and existing destructive-action pattern. Job canonical deletion remains unavailable because the current domain does not support it; no new deletion semantics were introduced.
- Source preview: Candidate and Job import surfaces now show one ordered source list only. Single- and multi-image browser checks preserved bundle order, durable original bodies, provenance, hash validation and Source Retrieval.
- Failure boundary: Candidate conversation transport now uses a Candidate-specific forced tool contract. It does not use the Job schema, Local semantic structuring, or a Local fallback; Provider failure remains visible and fail closed.
- Verification: all `38` Node regression files, `20` Python regression files, `44` public JavaScript syntax checks, Python compilation and real-browser Candidate/Job checks passed. Final browser console errors were zero; the global runtime was restored to Model.

### Learning checkpoint

- New Transferable Knowledge: a shared visual shell is only stable when both domains bind the same semantic roles and acceptance authority; matching CSS alone does not prevent divergent behavior.
- User-owned Capability Evidence: the user identified the exact Candidate edit, Job edit-shell and duplicate source-preview failures and specified the Human Save and provenance boundaries.
- Tool-assisted Implementation: Provider contract repair, shared-shell extraction, UI integration, automated regressions and browser execution were performed by Codex.
- Remaining Capability Gaps: Human J1 acceptance is still required. No J2 work, staging or commit is authorized.

## Ariadne final product-contract addendum（2026-09-04，READY FOR J1 HUMAN ACCEPTANCE）

- Runtime-driven import: Candidate and Job now dispatch through one `ProductShell.dispatchRuntimeImport()` contract. There is no import-level Local/AI selector. Local invokes only Local; Model invokes only Model; unavailable domain capability or Model failure fails closed and never invokes Local.
- Model isolation: Candidate and Job Model slices were re-audited and regression-locked against Local semantic structuring, Local proposal generation and Local review rendering. Source decoding/OCR/read/hash/bounded preparation remains technical Source Preparation only.
- Provenance correction: Job pasted text now joins `selectedJobSources`, so paste, click, drop and clipboard sources all reach the shared durable source-bundle gate. Both Model consent paths call `SourceInput.persistDurableBundle()` before consent/Provider, validate identity/hash, and preserve original bodies for Source Retrieval.
- Micro-interactions: common source, button, input, Working transition, message, edit, save and failure feedback use shared Ariadne symbols. Motion is subtle; reduced-motion disables new entry/orb/pulse animation and collapses transitions.
- Browser proof: Local Candidate/Job actions were selected automatically with zero per-import selectors; Candidate vision Runtime selected the Model action; Job Model pasted text reached source-first consent as one shared source. Consent was cancelled, so no new Provider call occurred. Shared input focus and loaded hover/pressed/message/reduced-motion rules were verified.
- Verification: `36 Node + 21 Python = 57` suites, 44 public JS syntax checks and `git diff --check` passed; staged files remain zero.

### Learning checkpoint

- Product Progress: runtime authority and durable-source authority are now executable shared gates, including pasted text, rather than conventions duplicated in two event handlers.
- New Transferable Knowledge: capability gating is distinct from fallback—a Model Runtime may fail closed before execution when its domain adapter is unverified, but it must never reroute the same intent through Local semantics.
- User-owned Capability Evidence: the user specified runtime ownership, semantic-boundary and source-first invariants plus the micro-interaction acceptance surface.
- Tool-assisted Implementation: shared dispatch/persistence helpers, pasted-text correction, motion/focus feedback, browser QA, regressions and documentation were performed by Codex.
- Remaining Capability Gaps: final Human acceptance remains pending; no J2 work is authorized.

## Ariadne UI contract correction（2026-09-04，READY FOR J1 HUMAN ACCEPTANCE）

- Product Progress: Add Job now uses `使用人工智能解析`, hides the two verbose inline provenance explanations while retaining durable source metadata, and uses the shared light `确认并发送` action.
- Shared interaction refinement: `AriadneProcessingIndicator.setButton()` applies the same restrained blue loop to import, conversation and submit waiting. `AriadneProductShell.CONTRACT.conversation.field` requires the same `v1-composer-field` wrapper in all four Candidate/Job workspace/detail composers; their field/input/button geometry is `46 / 44 / 42 px` with exact vertical centering and a contained focus ring.
- Layout/motion: shared back/close controls use scale-only hover and milder press without lateral translation. The shared minibar is horizontally centered, leaving the top-right zone unoccupied for a future settings control. Reduced-motion removes the continuous loop and shortens shared transitions.
- Browser evidence: desktop and 390 px mobile Job import, light consent action, Model import WORKING state, Job conversation WAITING state, Candidate/Job focused composer geometry, stable busy submit layout, scale-only back hover and centered minibar all passed. Final Add Job console errors were zero.
- Failure evidence: the synthetic Model Job import returned a Provider payload that failed the existing schema and surfaced `MODEL_FAILED`; no Local fallback ran. The synthetic conversation waiting capture was cancelled by reload before Provider transmission.
- Verification: `37 Node + 21 Python = 58` suites, 44 public JS syntax checks and `git diff --check` passed; staged files remain zero. No add/commit/reset/stash was performed.

### Learning checkpoint

- Product Progress: shared async feedback and composer geometry are now structural ProductShell contracts rather than page-level visual approximations.
- New Transferable Knowledge: a loading state needs both semantic state (`aria-busy`, duplicate-submit prevention) and perceptible, layout-stable feedback; shared CSS alone is insufficient if pages do not share the required DOM wrapper and state setter.
- User-owned Capability Evidence: the user identified the recurring oversized composer, frozen-looking submit state, ornamental loader, misplaced minibar and ambiguous Job action copy as concrete product-contract failures.
- Tool-assisted Implementation: shared primitive refinement, regression coverage, desktop/mobile browser measurement and evidence updates were performed by Codex.
- Remaining Capability Gaps: Human visual/interaction acceptance is pending; the synthetic Provider schema failure is a separate model-output quality observation, not evidence of a Local fallback.

## Ariadne Detail behavioral wiring stabilization（2026-09-04，READY FOR J1 HUMAN ACCEPTANCE）

- The earlier READY claim was revoked after Human observation exposed real Detail failures. The first broken owners were Candidate `UI_BINDING`, Job post-Provider `RESULT_PROJECTION` validation, and the shared Edit controller's entry/focus behavior.
- Shared wiring: `AriadneProductShell.bindConversationAdapter()` now owns the single composer submit primitive and calls explicit Candidate/Job domain adapters with the current target and runtime capability. `createDetailEditController()` owns Edit/Cancel/Preview/Back and scrolls/focuses the first field consistently on both detail pages.
- Candidate proof: the required role-wording replacement produced Provider `PATCH_ITEM`, created a NON_AUTHORITATIVE Working proposal, and left confirmed data unchanged. Human Save then confirmed the requested field-level change and retained the previous version.
- Job proof: `这个职位最重要的三个要求是什么？` returned a Provider `EXPLAIN`; `按照我现在的个人资料，我最缺什么？` returned a grounded Provider answer using the current confirmed Job, CandidateContext and prior conversation. Neither turn created Working or mutated confirmed data.
- Safe execution evidence records only submit/domain/operation/provider/model/result/Working/pre-save mutation fields. Candidate logged Provider=true, `deepseek-v4-pro`, `PATCH_ITEM`, Working=yes, pre-save mutation=no. Job logged Provider=true for both turns and remained fail-closed; no private source bodies, internal IDs or chain-of-thought were logged.
- Edit parity was exercised end-to-end on Candidate and Job: enter, first-field focus, preview, back-to-edit, cancel, and shared action geometry. Final browser checks found zero error states and no persistent ID leakage.
- Verification: `39/39` Node regression suites, `20/20` Python regression suites, `44/44` public JavaScript syntax checks and Python compilation passed. Human J1 acceptance remains pending; no J2 work, staging or commit was performed.

### Learning checkpoint

- Product Progress: Detail conversation and Edit behavior now have shared executable owners plus explicit domain adapters.
- New Transferable Knowledge: a visible control can still be unwired when capability is resolved after initialization; availability must be evaluated at submit time, while the binding itself remains stable.
- User-owned Capability Evidence: the user identified the exact Candidate and Job behavioral failures, required observation-first proof, and explicitly authorized the two real Job Provider turns.
- Tool-assisted Implementation: fault tracing, shared binding/controller repair, semantic-validation normalization, regressions, Provider execution and browser verification were performed by Codex.
- Remaining Capability Gaps: final Human J1 acceptance is still required; implementation work is not independent user-authored engineering evidence.

## Ariadne Computer-use-first E2E acceptance gate（2026-09-05）

- Final status: real in-app browser A–E passed after the last runtime/UI fix. Native Computer Use was attempted first but the host safety layer disallowed controlling the Codex app, so the same visible Candidate/Job flows were completed through Browser Control in the existing in-app browser.
- Candidate discussion stayed non-mutating. The explicit role-wording replacement produced Provider `PATCH_ITEM`, visible NON_AUTHORITATIVE Working, no pre-Save confirmed mutation, Human Save, and a reopened confirmed revision with no internal ID in the UI.
- Job discussion returned two real Candidate-grounded DeepSeek answers without Working or mutation. The explicit summary deletion produced `PROPOSE_JOB_EDIT`, visible Working, no pre-Save mutation, Human Save, and a reopened immutable revision.
- Candidate/Job Edit share enter/focus/preview/back/cancel behavior. Direct Save was exercised on both. Candidate workspace-v2 direct edits now persist through a new Working + Workspace Acceptance + confirmed revision, keeping subsequent Candidate conversation context synchronized; obsolete Working UI is cleared after Save. Candidate delete remains available; Job delete remains absent because its canonical delete contract is not implemented.
- Final verification: `40/40` Node suites, `20/20` Python suites, `44/44` public JavaScript syntax checks and Python compilation passed. The final post-fix A–E run produced zero new browser console errors, no Model→Local fallback and zero Local Provider calls. No staging or commit was performed.

### Learning checkpoint

- Product Progress: the final Candidate/Job interaction and persistence gates are now verified through visible Human actions rather than inferred from code or synthetic tests.
- New Transferable Knowledge: a successful confirmed write is incomplete if its non-authoritative working projection remains stale; revision lineage, Working lineage, acceptance artifacts and rendered state must converge together.
- User-owned Capability Evidence: the user defined the acceptance prompts, Save boundary, no-fallback rule, provenance/privacy constraints and the requirement to restart A–E after every code fix.
- Tool-assisted Implementation: fault tracing, minimal fixes, real Provider calls, browser execution and regression verification were performed by Codex.
- Remaining Capability Gaps: Human product acceptance remains the next decision; this implementation does not count as independent user-authored engineering evidence.
## J1 Candidate Material integrity checkpoint（2026-09-05，COMPLETE）

- Candidate Material Detail: real DeepSeek discussion and semantic mutation passed for Work Experience, Project, and Education. Work Experience additionally passed direct Edit, preview, Human Save, reload/reopen, and subsequent-conversation current-state checks. Confirmed state remained unchanged before Save; Provider output remained NON_AUTHORITATIVE Working.
- Candidate Material coverage: deterministic/runtime regressions exercise every currently supported type: `work_experience`, `project`, `education`, `skill_group`, `language`, `award`, and `custom_section`.
- Item/context integrity: context compiler v2 limits item history to the active Candidate Material and its current Working/version/fingerprint lineage. Stale turn-local aliases cannot retarget another item.
- Human Copy boundary: Provider-facing structured references remain available for grounding, while server normalization, client projection, and render-time sanitation prevent Candidate/Job internal IDs or aliases from appearing in visible messages, including legacy persisted history.
- Job regression: the frozen Job Detail completed one real CandidateContext-grounded DeepSeek smoke turn with no Working and no confirmed mutation.
- Runtime/source isolation: Local Candidate and Local Job Provider calls remain exactly zero; Model failure is `MODEL_FAILED` and never falls back to Local. Model imports persist the original ordered source/source bundle before Provider execution and retain bodies for Source Retrieval.
- Final verification: `40/40` Node regression suites, `21/21` executable Python regression suites, `84/84` JavaScript syntax checks, Python compilation, `10/10` HTTP checks, browser console checks, visible-copy ID checks, and `git diff --check` passed. The Python stub server was correctly excluded because it is a non-terminating test fixture, not an executable suite.
- Scope: J1 only. J2, Web Search, automatic application, and general polish remain deferred.

### Learning checkpoint

- Product Progress: Candidate Material current-state integrity, shared interaction behavior, source-first provenance, and Candidate/Job Human Copy boundaries are now closed as one J1 foundation.
- New Transferable Knowledge: semantic authority, durable source authority, current-item context, and visible Human Copy are separate contracts and need independent fail-closed validation.
- User-owned Capability Evidence: the user defined the runtime, provenance, Human Save, Candidate Material parity, and real-provider acceptance gates and authorized repeated DeepSeek execution through completion.
- Tool-assisted Implementation: runtime repairs, real Provider/browser execution, systematic coverage, privacy/scope audit, and regression verification were performed by Codex.
- Remaining Capability Gaps: deferred J2 capabilities remain unimplemented by design.
