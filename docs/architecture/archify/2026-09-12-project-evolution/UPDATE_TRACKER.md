# Ariadne 项目发展图谱 · 持续更新台账

这个文件负责回答两个问题：项目在图谱交付后又发生了什么，以及这些变化是否已经大到需要重画某张图。

它不是产品需求列表，也不替代 `PROJECT_CONTEXT.md`、`PROJECT_STATUS.md`、领域契约或 Git 历史。图谱只解释已经有证据的演进与因果；尚未实现的愿景、普通讨论和一次性 next step 不进入正式图源。

## 当前基线

| 项目 | 当前值 |
| --- | --- |
| 图谱首次交付 | 2026-09-12 |
| 图谱基线 commit | `02700c8`（`docs: map Ariadne project evolution`） |
| 产品变化复核截至 | `eea3274`（2026-09-13） |
| 总阅读入口 | `README.md` |
| 当前架构演进表 | `07-architecture-evolution-six-stages.html` |
| 旧版运行结构参考 | `../2026-09-11/ariadne.html` |
| 项目稳定目标 | `PROJECT_CONTEXT.md` |
| 最新实现证据 | `PROJECT_STATUS.md` 最新适用条目 |
| 跨任务记忆 | 不启用外部项目记忆插件；以本台账、项目上下文、项目状态和 Git 为可审查记录 |

基线的四张专题演进图、运行优化阶段快照、架构调整总表及旧版运行结构参考共同组成一个整体：

1. `01-job-radar-to-ariadne`：产品边界为何从职位记录扩张为 Candidate / Job 分别理解、关联与行动。
2. `02-document-understanding`：真实材料为何把问题从 OCR 扩张为顺序、结构、领域映射与人工审核。
3. `03-context-authority`：为什么需要区分当前决定、适用契约、有界上下文、确认数据和增量记录。
4. `04-motion-debugging`：为什么静态视觉正确不等于浏览器过程正确，以及如何用逐帧证据停止返工。
5. `05-content-context-simplification`：上下文调用怎样从逐条截取、预先概况，简化为预算内完整读取和一次 DISCUSS，同时保留大集合保护。
6. `06-architecture-evolution-table`：从职位数据库、本地文档分析、双域 AI、Runtime 简化到 Markdown 内容库，哪些能力逐步加入、哪些退出日常路径、哪些保护继续保留。
7. `07-architecture-evolution-six-stages`：在 06 基础上把“边界完整但系统膨胀”与“保留保护、主动简化”拆开，形成适合 README 的六阶段主叙事。
8. `../2026-09-11/ariadne`：SourceDocument、Runtime、Local/Model、Working/Proposal 与 Human Save 如何连接；它是旧版结构参考，不再作为当前存储形态的唯一依据。

## 哪些变化需要更新哪张图

| 变化 | 更新对象 | 判断标准 |
| --- | --- | --- |
| 产品目标、核心对象或端到端阶段改变 | `01-job-radar-to-ariadne` | 出现新的长期边界，而不是单个页面功能 |
| 新资料类型、读取路径、OCR/native 选择、文档 IR 或审核边界改变 | `02-document-understanding` | 文档从来源到可确认对象的主路径或停止条件改变 |
| authority、上下文范围、Proposal/confirmed、revision、保存权限或项目恢复机制改变 | `03-context-authority` | “什么可以生效、何时生效、谁能写入”发生变化 |
| 新的系统性动效故障层或浏览器验收方法形成 | `04-motion-debugging` | 产生可复用的诊断方法，不只是修好一个像素问题 |
| Runtime、Provider、HTTP、本地服务、持久化或安全边界改变 | `../2026-09-11/ariadne` | 当前运行结构或真实数据流改变 |
| 上下文预算、截取、分片综合或模型调用编排改变 | `05-content-context-simplification` | 优化前后的主调用路径或保护分支改变 |
| 主存储形态、长期职责分层或重要架构阶段改变 | `07-architecture-evolution-six-stages` | 需要重新说明“从哪里来、为什么改、当前留下什么” |
| 文案、间距、单卡片能力或孤立 bug fix | 只记本台账 | 没有改变上述长期边界时不重画图 |

如果一次变化同时影响多张图，先更新“当前架构”，再更新解释它为何出现的演进图。这样可以避免把愿景误画成已经运行的结构。

## 每次更新的固定流程

1. 读取本台账、`PROJECT_CONTEXT.md` 和 `PROJECT_STATUS.md` 中与本次页面、组件或主题相关的决定和例外。
2. 阅读 `PROJECT_CONTEXT.md`、`PROJECT_STATUS.md` 最新适用条目及受影响契约；从本台账记录的复核 commit 对比到当前 `HEAD`。
3. 先写一条台账记录，说明用户目标、真实变化、为什么发生、影响层、证据和是否需要改图。
4. 只有达到上表阈值时才修改对应的最终 typed JSON；旧 JSON、HTML、截图和失败候选原地保留。
5. 对改过的图重新执行 Archify showcase validation、deliver、visual-check 和实际视觉复核，并更新 `receipts.json`。
6. 更新本台账的“当前复核 commit”，在项目状态中记录结果；只提交本轮相关文件，不混入其他未完成改动。
7. 把有来源的决定、实际修改和验证结果写回本台账或项目状态，并以 Git commit 保存可审查证据。

## 更新记录

### 2026-09-15 · README 采用六阶段架构演进主线

- 用户目标：把项目从纯本地 Job Radar、本地文档分析、大模型语义理解、复杂架构、整体简化到本地存储重构的因果写清楚，并直接同步 GitHub。
- 实际变化：新增 `07-architecture-evolution-six-stages`；根目录中英 README 使用同一套六阶段说明和图像入口。旧图和 06 第一版总表继续保留。
- 为什么发生：06 把“边界完整但系统膨胀”和“保留保护、主动简化”压在同一步，不能充分解释用户提供的图一为何曾经合理、后来又为何需要简化。
- 影响范围：公开 README、图谱阅读入口和演进追踪；没有修改应用 Runtime、存储实现、Provider、资料或确认数据。
- 依据：`0b63323`、`c96c105`、`f761cd6`、`b470872`、`6435e14`、`eea3274`，以及当前项目上下文、状态、Markdown 存储契约和用户引用的 `SimplifyArchitecture` 任务。聊天只用于定位，具体事实回到仓库复核。
- 是否改图：是；新增六阶段 Architecture 图，06 保留为前一版五阶段总表。
- 验证：Archify showcase 9/9、0 errors、0 warnings；自动浏览器四个桌面尺寸无溢出；1440×900 与 2048×1320 明暗截图均通过视觉复核；交付后 0 轮修正。
- 未知与下一步：这是一份历史因果说明，不把真实模型质量、全部浏览器 profile 或未来功能写成已完成能力。

### 2026-09-14 · 新增从 Job Radar 到 Markdown 内容库的架构调整表

- 用户目标：参考 2026-09-12 至 2026-09-13 的内容迁移，说明 Ariadne 从一开始到现在怎样一点点改变，而不是只展示某一次优化后的静态结构。
- 实际变化：新增 `06-architecture-evolution-table`，在一张图中串联五个阶段：Job Radar 职位数据库、本地文档分析、Candidate/Job 双域 AI、Runtime 简化、Markdown 内容库；另列“退出日常路径”“保留保护”“当前五项职责”。
- 为什么发生：早期复杂度分别解决真实问题——职位收集、本地材料识别、两域语义与写入权、长上下文成本；迁移后的优化不是放弃这些边界，而是把多份语义表示和多条处理链收敛为“一份 Markdown 正文，多种按需投影”。
- 当前事实：Local 正式导入只归档原件；同一 Markdown 正文既投影为人看的卡片，也生成有范围、有预算的模型上下文；旧 IndexedDB 只作备份，不双写。实际 Codex 浏览器主库已恢复并迁移 1,854 条记录。
- 影响范围：更新演进阅读入口和持续跟踪规则；第 5 张图保留为第一次 Runtime 简化的历史快照，第 6 张图承担当前跨阶段总览。旧版运行结构图继续保留作边界参考。
- 依据：`b470872`（Local 原件归档）、`6435e14`（Markdown 内容库迁移）、`eea3274`（历史 hash 表示恢复与 1,854 条主库迁移），以及 [Markdown 内容存储契约](../../../current/MARKDOWN_CONTENT_STORAGE.md)、[内容架构复核与简化](../../../current/CONTENT_ARCHITECTURE_SIMPLIFICATION.md)、[项目上下文](../../../../PROJECT_CONTEXT.md) 和 [项目状态](../../../../PROJECT_STATUS.md)。引用任务仅用于定位本次迁移结论，事实回到仓库复核。
- 是否改图：是；新增 `06-architecture-evolution-table`，不覆盖 01–05 和旧版运行结构图。
- 验证：Archify showcase 9/9、0 errors、0 warnings；自动浏览器四个桌面尺寸无溢出；1440×900 与 2048×1320 的浅色/深色端点截图全部通过视觉复核；正式交付后 0 轮修正。
- 未知与下一步：图只说明已经有证据的架构演进，不声称模型语义质量已经由用户全面验收。后续主存储、职责分层或端到端阶段变化时优先更新本表。

### 2026-09-12 · 停用并清理 Letta 项目记忆插件

- 用户决定：Ariadne 不再调用 `letta-kai-memory`，清除该插件并取消后续记忆检查点。
- 实际状态：插件管理器未列出 `letta-codex-memory`，卸载接口返回未安装；个人插件缓存目录、Codex hooks/config、MCP 列表及运行进程均无 Letta 可执行残留。
- 项目调整：移除本台账中读取或写入 Letta 的流程，后续用 `PROJECT_CONTEXT.md`、`PROJECT_STATUS.md`、本台账和 Git 维护跨任务证据。
- 保留边界：历史任务和输入历史中的文字提及属于非执行记录，继续保留；不会触发插件或记忆调用。

### 2026-09-12 · 新增内容与上下文优化对比图

- 用户目标：用架构图说明现在比之前优化了什么，并继续跟踪后续变化。
- 实际变化：新增 `05-content-context-simplification`，把旧的“逐条排序与 6 KB 截取 → 强制概况 → DISCUSS”与当前“整体预算门禁 → 预算内完整读取 → 一次 DISCUSS”并列；大集合继续走全量分片综合与缓存。
- 为什么发生：此前的复杂度把小集合也送入为规模问题准备的压缩链，增加调用与语义损失；现在按整体预算和数量决定路径，让常见输入保留完整当前语义，同时不牺牲大集合覆盖。
- 影响范围：上下文准备与模型调用编排；未改变来源身份、Candidate/Job 隔离、Provider 能力门禁、Working/Proposal、Human Save 或 confirmed revision。
- 依据：`f761cd6`、[内容架构复核与简化](../../../current/CONTENT_ARCHITECTURE_SIMPLIFICATION.md)、[项目状态](../../../../PROJECT_STATUS.md) 的 2026-09-12 COMPLETE 条目。
- 是否改图：新增独立对比图；当时没有把尚未迁移的 Markdown 主存储画成当前状态。随后迁移已在 `6435e14` 完成，当前跨阶段状态由 `06-architecture-evolution-table` 接续说明。
- 验证：Archify showcase 9/9、0 errors、0 warnings；自动浏览器四个桌面尺寸无溢出，浅色/深色端点截图通过人工视觉复核；1 轮视觉修正。
- 当时未知与后续结果：当时尚未验收 Markdown 主存储往返、真实模型质量和完整存储迁移；其中存储迁移后来已经完成，真实模型语义质量仍须按具体任务验证。未来上下文预算、分片条件或 authority 变化时更新本图。

### 2026-09-12 · Local 原件归档

- 用户修订：本地识别用于学习，正式 Local 仅保存原件，接入 AI 后再分析。
- 实现：两域共用原件保存与来源选择；保留原始 bytes/hash、职位材料顺序和链接，取消页面内本地 OCR/提取/结构化编排。已有卡片、人工保存与模型执行契约保留。
- 图源影响：当前架构图中的 Local 识别主分支已成为历史，需要在下次架构图修订时替换为归档、随后显式发起 Model 的路径；现有图/截图原地保留，不将旧图称为最新运行证据。
- 依据：[内容简化](../../../current/CONTENT_ARCHITECTURE_SIMPLIFICATION.md)、[Runtime 现行修订](../../../current/ARIADNE_RUNTIME_EXECUTION_CONTRACT.md)、PROJECT_STATUS 同日条目。Markdown 主存储尚未迁移。

### 2026-09-12 · 内容架构复核与上下文简化

- 用户目标：卡片面向人、多份 Markdown 面向 AI、保留原件；重新审视复杂度并在保留现有功能的前提下简化。
- 实际变化：小集合职位对话直接读取完整当前语义、一次 DISCUSS；个人/职位预算内正文不先截取，大集合继续全量分片综合；共用分批与模型配置身份函数。
- 影响范围：上下文选择和对话编排。来源、确认版本、存储 authority、领域权限和 Provider 边界未切换。
- 依据：[内容架构复核与简化](../../../current/CONTENT_ARCHITECTURE_SIMPLIFICATION.md)、[项目状态](../../../../PROJECT_STATUS.md) 同日条目，相关两域 Node/Python 回归和隔离浏览器证据。
- 是否改图：最初未重画完整当前架构，因为五项目标职责及 Markdown 主存储仍是迁移设计；用户随后明确要求解释优化前后，已新增独立对比图，但仍未把迁移愿景冒充当前运行结构。实际切换主存储时须更新当前架构与上下文权威图。
- 未知：Markdown 与既有字段、来源、草稿及历史的完整往返还未实现；本次运行简化不作为存储迁移或真实模型质量证明。

### 2026-09-12 · 建立持续跟踪基线

- 范围：重新复核四张演进图、当前架构入口、交付回执、项目上下文、最新项目状态和基线后的 Git 历史。
- 结论：现有五张图的分工仍成立；四张演进图继续解释“为什么”，当前架构图继续解释“现在怎样连接”。
- 基线后变化：`4dacae0` 为职位卡片增加已有原始职位链接，保留 HTTP/HTTPS、安全打开与无链接不占位边界。
- 是否改图：否。该变化加强来源可见性，但没有改变 SourceDocument、Candidate/Job、Runtime、Proposal/Save 或确认版本的主结构。
- 新增机制：本台账负责判断图是否需要更新；项目上下文、项目状态与 Git 负责跨任务找回有来源的决定、变更和验证。
- 可视化尝试：`05-evolution-maintenance.*` 是本轮生成的流程图候选；确定性 showcase 校验通过，但两轮压缩后仍未通过桌面首屏纵向 containment，因此没有加入正式阅读顺序或 `receipts.json`。相关 JSON、HTML 与失败浏览器 sidecar 保留为 QA 证据。
- 仍未知：下一次会触发图谱更新的具体产品阶段尚未发生，不提前把候选功能写入正式图。

## 记录模板

后续每次在本节上方追加一条：

```markdown
### YYYY-MM-DD · 变化名称

- 用户目标：
- 实际变化：
- 为什么发生：
- 影响范围：
- 依据：commit / PROJECT_STATUS 条目 / 契约 / 测试 / 浏览器证据
- 是否改图：否；或列出图名与原因
- 验证：
- 未知与下一步：
```
