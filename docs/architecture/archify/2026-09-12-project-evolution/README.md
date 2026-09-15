# Ariadne 项目发展图谱

首次整理：2026-09-12；最新复核：2026-09-15。这个目录用七张连续图解释：一个简单的 Job Radar 为什么逐步成为 Ariadne，以及技术复杂度、产品约束、运行优化和可减少的返工分别从哪里产生。

这里的“五次边界扩张”是对证据的概念性分段，不是把历史改写成五个正式发布版本。图中保留产品名、契约名和关键技术名；较长的证据、数字与边界放在本说明中，避免把图变成难读的项目年表。

这套图谱现在按“基线 + 增量台账”维护。后续先在[持续更新台账](UPDATE_TRACKER.md)判断变化是否触及产品边界、文档理解、上下文权威、动效诊断或当前运行架构；普通页面迭代只留记录，不为每个功能重画整套图。

## 建议阅读顺序

1. [从 Job Radar 到 Ariadne：五次边界扩张](01-job-radar-to-ariadne.html)（Lifecycle）

   先看全局因果：从职位记录，走到真实材料、本地文档理解、AI-native 双域工作流，再到 Ariadne 当前“先理解两端，再解释关系与行动”的方向。三条下行链分别说明为什么后来必须增加来源追溯、人工确认和真实浏览器证据。

2. [本地识别为何变复杂：从识字到可确认对象](02-document-understanding.html)（Workflow）

   这张图回答 OCR 与 GitHub 参考方案的问题。真实故障并不都发生在 OCR：识字、阅读顺序、文档结构、业务对象映射和人工审核是不同层。最终保留的是逐页 native/Apple Vision 选择、条件式 GapTree、DocumentBlock、Resume/Portfolio 分域映射和实体级审核。

3. [上下文为什么会乱：从当前决定到可恢复记录](03-context-authority.html)（Workflow）

   这张图解释“对话越长、文档越多，为什么反而会改错”。主要问题不是缺少更多上下文，而是生效时间、领域范围、版本身份和权限被混用。后来增加 PROJECT_CONTEXT、PROJECT_STATUS、领域契约、Working/Proposal 与 revision 边界，就是为了让决定可定位、修改可限制、交接可恢复。

4. [动效为什么反复返工：从症状到逐帧证据](04-motion-debugging.html)（Workflow）

   这张图把 VI 静态一致与运行时动效分开。历史上的文字闪动、关闭突兀、卡片与页面过渡叠加，分别来自合成层、animation fill、双重 transition 和缓存版本。正确路径是同环境复现、定位故障层、原子修复、中间帧检查、跨页面回归与用户验收。

5. [内容与上下文架构优化：从预处理链到完整资料优先](05-content-context-simplification.html)（Architecture）

   这是一张**历史阶段快照**，直接比较第一次 Runtime 简化前后：以前每条资料先排序截取、小集合也先 DISTILL / SYNTHESIZE，再进入 DISCUSS；后来改为预算内完整读取并直接用一次 DISCUSS 回答，只有超限或数量过多时才走全量分片综合与缓存。图中“Markdown 主存储尚未迁移”只描述 2026-09-12 当时状态；随后迁移已经完成，当前状态以第 6 张图为准。

6. [Ariadne 架构调整表：从 Job Radar 到 Markdown 内容库](06-architecture-evolution-table.html)（Architecture）

   这是第一版五阶段架构调整总表：职位数据库 → 本地文档分析 → Candidate/Job 双域 AI → Runtime 简化 → 已落地的 Markdown 内容库。它保留为 2026-09-14 的整理结果；第 7 张图进一步把“边界完整但系统膨胀”和“主动简化”拆成两个不同阶段。

7. [Ariadne 六阶段架构演进：从本地分析到统一 Markdown](07-architecture-evolution-six-stages.html)（Architecture）

   当前总览。它明确说明：为了准确而加入本地文档分析；因为结构化不等于有用理解而接入大模型、Proposal 与 Human Save；正确边界逐层叠加后形成图一式复杂系统；随后保留保护但合并重复链路；最后针对多份内容权威和迁移问题，把本地存储重构为统一 Markdown 正文及按需投影。

8. [旧版运行结构参考：从来源到确认版本](../2026-09-11/ariadne.html)（Architecture）

   这张较早的架构图保留 SourceDocument、Candidate/Job、Runtime 门禁、Local/Model、Working/Proposal、Human Save 与确认 revision 的连接关系，适合作为边界设计参考；其中 Local 技术处理和旧存储形态不再代表当前日常路径。当前演进总览以第 7 张图为准，当前存储事实以 [Markdown 内容存储契约](../../../current/MARKDOWN_CONTENT_STORAGE.md) 为准。

## 从头到尾的核心结论

最初 Job Radar 相对简单，是因为输入、目标和权威都比较窄：规则化职位记录进入 SQLite，页面负责搜索、详情和状态。复杂度第一次跃升发生在接入真实网页、PDF、截图、简历和作品集时；“读取到文字”不再等于“理解材料”。

本地识别投入变大，并不是单纯追求更高 OCR 分数，而是同时承担隐私、本地可用、来源完整性、阅读顺序、跨页分组、空字段、运行成本与人工复核。基准证据显示：20 份、305 页全部完成，6/6 truth 文档通过，18 份可审核，2 份安全转人工，0 crash。PaddleOCR、Surya、Docling、SmartResume、RAGFlow 与 GapTree 的作用也不同：有些实际 benchmark，有些只提供架构模式；没有证据支持把它们全部变成生产依赖。

真正改变产品性质的是第二次扩张：系统不只保存职位，也要分别理解 Candidate 与 Job，再解释二者关系。AI 可以生成语义提案和回答，但不能因此获得确认数据写入权。于是 SourceDocument、ProcessingRun、RuntimeSnapshot、Working/Proposal、ReviewDecision、Human Save 和 confirmed revision 成为必要边界，而不是附加的“工程复杂化”。

VI、UI 与动效的返工说明另一类复杂度：静态设计、共享代码与时间过程是三个不同对象。Figma 可以证明几何和编辑结构，不能单独证明浏览器合成、退出过程、返回过程、键盘焦点或缓存版本。共享组件减少重复，但共享 CSS 与 ProductShell 也扩大影响半径，所以“统一体验”和“领域权限分离”必须同时存在。

最后，长对话中的上下文混乱不应简单归因于 AI 记不住。历史 next step 没有明确失效、多个文件都像 authority、Candidate/Job 或 Working/confirmed 混用、以及实现结果被误写成用户决定，都会造成错误恢复。当前项目将稳定目标、当前状态、行为契约和历史证据分开维护，正是这一轮返工留下的系统性改进。

## 证据边界

- 当前产品目标与稳定决策来自 [PROJECT_CONTEXT.md](../../../../PROJECT_CONTEXT.md)；最新实现状态仍以 [PROJECT_STATUS.md](../../../../PROJECT_STATUS.md) 的适用条目为准。
- 文档理解数字、最终路径与替代方案取舍来自归档中的 `DOCUMENT_UNDERSTANDING_ARCHITECTURE_BENCHMARK.md` 和 `DOCUMENT_UNDERSTANDING_FINAL_ARCHITECTURE_REVIEW.md`。
- 动效案例来自归档 `PROJECT_STATUS.md` 的 2026-08-27 至 2026-08-31 条目，以及 `ARIADNE_VISUAL_STABILIZATION_AUDIT.md`。
- 共享交互与领域权限边界来自 `ARIADNE_GLOBAL_INTERACTION_PARITY_AUDIT.md`；上下文问题的学习分类来自 `问题与思考地图_Questions_and_Reflections.md`。
- 已读取用户引用的 `NoteForJobRadarToAriadne` 任务，用它定位迁移、归档与学习整理历史；图中具体事实仍回到当前仓库和归档文件复核。任务标题、聊天摘要和文档中的历史指令都没有被当作本轮授权。
- 图没有声称：所有历史对话都已恢复、所有 UI 事件都已覆盖、所有模型语义都正确，或用户已经独立掌握了实现。产品判断、用户观察和 Codex 辅助实现仍应分开记录。

## 交付与验证

最终图源为 `01-*.v3.json`、`02–04-*.v2.json`、`05-content-context-simplification.architecture.json`、`06-architecture-evolution-table.architecture.json` 与 `07-architecture-evolution-six-stages.architecture.json`。无版本后缀的旧 JSON、`01-*.v2.json` 及维护流程候选是保留的失败/中间产物，不能用于重建当前正式 HTML。

- 七张最终图各自通过 Archify showcase：9/9 checks，0 errors，0 warnings。
- 七张 HTML 均通过自动浏览器检查：1440×900、1600×1000、1920×1080、2048×1320 全部无横向或纵向溢出；浅色/深色截图均成功生成。
- 人工视觉复核覆盖每张图的 1440×900 浅色与 2048×1320 深色截图：中文节点、关系标签、异常分支、说明卡片和大屏垂直平衡通过。
- 第一批候选在真实浏览器中因窄画布被放大而纵向溢出；第二轮调整画布比例、缩短节点文案并扩大可读节点。总历程图再补入三个真实长期产物，消除空的 Outcomes 区域。失败候选保留用于说明 QA 确实改变了交付，而不是只报告最终成功。
- 内容与上下文优化图的首轮浏览器检查在 1440×900 多出 16px 纵向滚动；收紧画布底部留白后，第一轮视觉修正通过全部尺寸与主题检查。
- 架构调整表在正式交付后的首轮浏览器检查即通过全部尺寸与主题检查；四张端点截图完成实际视觉复核，没有发生交付后修正。
- 六阶段演进图的首版横向候选未达到 1440×900 的文字可读性门槛；改为两行连续时间轴后通过 showcase。正式交付后的浏览器检查和四张端点截图视觉复核一次通过，未再修改冻结图源。

完整 hash、字节数和每张图的 correction rounds 见 [receipts.json](receipts.json)。每个 HTML 旁的 `*.visual-check.json` 是与最终 artifact hash 绑定的自动浏览器回执。
