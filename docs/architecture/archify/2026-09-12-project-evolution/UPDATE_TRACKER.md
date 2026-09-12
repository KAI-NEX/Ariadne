# Ariadne 项目发展图谱 · 持续更新台账

这个文件负责回答两个问题：项目在图谱交付后又发生了什么，以及这些变化是否已经大到需要重画某张图。

它不是产品需求列表，也不替代 `PROJECT_CONTEXT.md`、`PROJECT_STATUS.md`、领域契约或 Git 历史。图谱只解释已经有证据的演进与因果；尚未实现的愿景、普通讨论和一次性 next step 不进入正式图源。

## 当前基线

| 项目 | 当前值 |
| --- | --- |
| 图谱首次交付 | 2026-09-12 |
| 图谱基线 commit | `02700c8`（`docs: map Ariadne project evolution`） |
| 产品变化复核截至 | `f761cd6`（2026-09-12） |
| 总阅读入口 | `README.md` |
| 当前产品架构图 | `../2026-09-11/ariadne.html` |
| 项目稳定目标 | `PROJECT_CONTEXT.md` |
| 最新实现证据 | `PROJECT_STATUS.md` 最新适用条目 |
| 项目记忆 | letta-kai-memory 已启用；用于保存有来源的决定、修改、验证和任务检查点 |

基线的四张演进图、运行优化对比图及当前架构图共同组成一个整体：

1. `01-job-radar-to-ariadne`：产品边界为何从职位记录扩张为 Candidate / Job 分别理解、关联与行动。
2. `02-document-understanding`：真实材料为何把问题从 OCR 扩张为顺序、结构、领域映射与人工审核。
3. `03-context-authority`：为什么需要区分当前决定、适用契约、有界上下文、确认数据和增量记录。
4. `04-motion-debugging`：为什么静态视觉正确不等于浏览器过程正确，以及如何用逐帧证据停止返工。
5. `05-content-context-simplification`：上下文调用怎样从逐条截取、预先概况，简化为预算内完整读取和一次 DISCUSS，同时保留大集合保护。
6. `../2026-09-11/ariadne`：SourceDocument、Runtime、Local/Model、Working/Proposal 与 Human Save 如何连接。

## 哪些变化需要更新哪张图

| 变化 | 更新对象 | 判断标准 |
| --- | --- | --- |
| 产品目标、核心对象或端到端阶段改变 | `01-job-radar-to-ariadne` | 出现新的长期边界，而不是单个页面功能 |
| 新资料类型、读取路径、OCR/native 选择、文档 IR 或审核边界改变 | `02-document-understanding` | 文档从来源到可确认对象的主路径或停止条件改变 |
| authority、上下文范围、Proposal/confirmed、revision、保存权限或项目恢复机制改变 | `03-context-authority` | “什么可以生效、何时生效、谁能写入”发生变化 |
| 新的系统性动效故障层或浏览器验收方法形成 | `04-motion-debugging` | 产生可复用的诊断方法，不只是修好一个像素问题 |
| Runtime、Provider、HTTP、本地服务、持久化或安全边界改变 | `../2026-09-11/ariadne` | 当前运行结构或真实数据流改变 |
| 上下文预算、截取、分片综合或模型调用编排改变 | `05-content-context-simplification` | 优化前后的主调用路径或保护分支改变 |
| 文案、间距、单卡片能力或孤立 bug fix | 只记本台账 | 没有改变上述长期边界时不重画图 |

如果一次变化同时影响多张图，先更新“当前架构”，再更新解释它为何出现的演进图。这样可以避免把愿景误画成已经运行的结构。

## 每次更新的固定流程

1. 读取 Letta 项目记忆中与本次页面、组件或主题相关的决定和例外。
2. 阅读 `PROJECT_CONTEXT.md`、`PROJECT_STATUS.md` 最新适用条目及受影响契约；从本台账记录的复核 commit 对比到当前 `HEAD`。
3. 先写一条台账记录，说明用户目标、真实变化、为什么发生、影响层、证据和是否需要改图。
4. 只有达到上表阈值时才修改对应的最终 typed JSON；旧 JSON、HTML、截图和失败候选原地保留。
5. 对改过的图重新执行 Archify showcase validation、deliver、visual-check 和实际视觉复核，并更新 `receipts.json`。
6. 更新本台账的“当前复核 commit”，在项目状态中记录结果；只提交本轮相关文件，不混入其他未完成改动。
7. 用 Letta 保存有来源的决定、实际修改、验证结果和任务检查点。项目记忆是检索入口，仓库文件和 Git commit 仍是可审查证据。

## 更新记录

### 2026-09-12 · 新增内容与上下文优化对比图

- 用户目标：用架构图说明现在比之前优化了什么，并继续跟踪后续变化。
- 实际变化：新增 `05-content-context-simplification`，把旧的“逐条排序与 6 KB 截取 → 强制概况 → DISCUSS”与当前“整体预算门禁 → 预算内完整读取 → 一次 DISCUSS”并列；大集合继续走全量分片综合与缓存。
- 为什么发生：此前的复杂度把小集合也送入为规模问题准备的压缩链，增加调用与语义损失；现在按整体预算和数量决定路径，让常见输入保留完整当前语义，同时不牺牲大集合覆盖。
- 影响范围：上下文准备与模型调用编排；未改变来源身份、Candidate/Job 隔离、Provider 能力门禁、Working/Proposal、Human Save 或 confirmed revision。
- 依据：`f761cd6`、[内容架构复核与简化](../../../current/CONTENT_ARCHITECTURE_SIMPLIFICATION.md)、[项目状态](../../../../PROJECT_STATUS.md) 的 2026-09-12 COMPLETE 条目。
- 是否改图：新增独立对比图；不把 Markdown 主存储画成当前状态，也不以此替代完整运行架构图。
- 验证：Archify showcase 9/9、0 errors、0 warnings；自动浏览器四个桌面尺寸无溢出，浅色/深色端点截图通过人工视觉复核；1 轮视觉修正。
- 未知与下一步：Markdown 主存储往返、真实模型质量和完整存储迁移仍未验收；未来上下文预算、分片条件或 authority 变化时更新本图。

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
- 新增机制：本台账负责判断图是否需要更新；Letta 项目记忆负责跨任务找回有来源的决定、变更和验证。
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
