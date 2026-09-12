# Ariadne 项目发展图谱

日期：2026-09-12。这个目录用四张连续图解释：一个简单的 Job Radar 为什么逐步成为 Ariadne，以及技术复杂度、产品约束和可减少的返工分别从哪里产生。

这里的“五次边界扩张”是对证据的概念性分段，不是把历史改写成五个正式发布版本。图中保留产品名、契约名和关键技术名；较长的证据、数字与边界放在本说明中，避免把图变成难读的项目年表。

## 建议阅读顺序

1. [从 Job Radar 到 Ariadne：五次边界扩张](01-job-radar-to-ariadne.html)（Lifecycle）

   先看全局因果：从职位记录，走到真实材料、本地文档理解、AI-native 双域工作流，再到 Ariadne 当前“先理解两端，再解释关系与行动”的方向。三条下行链分别说明为什么后来必须增加来源追溯、人工确认和真实浏览器证据。

2. [本地识别为何变复杂：从识字到可确认对象](02-document-understanding.html)（Workflow）

   这张图回答 OCR 与 GitHub 参考方案的问题。真实故障并不都发生在 OCR：识字、阅读顺序、文档结构、业务对象映射和人工审核是不同层。最终保留的是逐页 native/Apple Vision 选择、条件式 GapTree、DocumentBlock、Resume/Portfolio 分域映射和实体级审核。

3. [上下文为什么会乱：从当前决定到可恢复记录](03-context-authority.html)（Workflow）

   这张图解释“对话越长、文档越多，为什么反而会改错”。主要问题不是缺少更多上下文，而是生效时间、领域范围、版本身份和权限被混用。后来增加 PROJECT_CONTEXT、PROJECT_STATUS、领域契约、Working/Proposal 与 revision 边界，就是为了让决定可定位、修改可限制、交接可恢复。

4. [动效为什么反复返工：从症状到逐帧证据](04-motion-debugging.html)（Workflow）

   这张图把 VI 静态一致与运行时动效分开。历史上的文字闪动、关闭突兀、卡片与页面过渡叠加，分别来自合成层、animation fill、双重 transition 和缓存版本。正确路径是同环境复现、定位故障层、原子修复、中间帧检查、跨页面回归与用户验收。

5. [当前 Ariadne：从来源到确认版本](../2026-09-11/ariadne.html)（Architecture）

   前四张解释“为什么走到这里”；这张已有架构图解释“现在各部分怎样连接”。它覆盖 SourceDocument、Candidate/Job、Runtime 门禁、Local/Model、Working/Proposal、Human Save、确认 revision 与当前上下文。

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

最终图源为 `01-*.v3.json` 与 `02–04-*.v2.json`。无版本后缀的 JSON 及 `01-*.v2.json` 是保留的失败/中间候选，不能用于重建当前 HTML。

- 四张最终图各自通过 Archify showcase：9/9 checks，0 errors，0 warnings。
- 四张 HTML 均通过自动浏览器检查：1440×900、1600×1000、1920×1080、2048×1320 全部无横向或纵向溢出；浅色/深色截图均成功生成。
- 人工视觉复核覆盖每张图的 1440×900 浅色与 2048×1320 深色截图：中文节点、关系标签、异常分支、说明卡片和大屏垂直平衡通过。
- 第一批候选在真实浏览器中因窄画布被放大而纵向溢出；第二轮调整画布比例、缩短节点文案并扩大可读节点。总历程图再补入三个真实长期产物，消除空的 Outcomes 区域。失败候选保留用于说明 QA 确实改变了交付，而不是只报告最终成功。

完整 hash、字节数和每张图的 correction rounds 见 [receipts.json](receipts.json)。每个 HTML 旁的 `*.visual-check.json` 是与最终 artifact hash 绑定的自动浏览器回执。
