# Ariadne 项目上下文

更新：2026-09-08。用途：新任务的项目入口与稳定产品约束；当前实现进度和验收结果由 [PROJECT_STATUS.md](PROJECT_STATUS.md) 记录。本文依据用户本次明确的产品目标整理，择要保留已有项目决策，不复制个人背景或学习记录。

## 1. 要解决的问题

用户有自己的经历、作品与资料，也有想接近的职位。Ariadne 的核心是让 AI 先理解个人资料，再理解职位描述，在此基础上帮助用户看清已有支持、待澄清之处和下一步可做的事。

产品主线：

1. **理解个人资料**：从用户提供的资料中理解经历、负责内容、成果与证据，保留冲突和未知，由用户校准。
2. **理解目标职位**：从职位原文中理解职责、要求、背景与不明确之处，不将页面导航、招聘宣传等当作岗位要求。
3. **建立有依据的关联**：针对用户选择的职位，说明哪些要求有资料支持，哪些还缺信息，以及差异属于能力、证据、表达还是相关性问题。
4. **帮助用户逐步行动**：围绕目标提出必要的澄清、证据补充或材料调整建议；用户决定是否行动及保存哪些变化。

这是产品方向，不表示完整行动闭环已经实现。“分别理解”指 Candidate/Job 各自有清晰的语义和来源，不规定固定模型调用次数，也不妨碍后续关联分析。

## 2. 保留的项目决策

| 决策 | 对产品的意义 | 本仓库依据 |
| --- | --- | --- |
| 有来源的理解与最少必要修改 | AI 可以解释和推理，但不能为了迎合职位补造个人经历；不需要修改也是有效结果 | [V2 产品架构](docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md) §A、§N |
| Candidate 与 Job 分别建模，再关联当前上下文 | 职位要求不反向变成个人事实；对话与建议使用当前有效版本 | [Candidate 对话契约](data/candidate_conversation_contract_v1.json)、[Job 智能契约](data/job_intelligence_contract_v1.json) |
| Working 与确认数据分离 | 模型的建议可以被讨论、编辑、拒绝；Human Save 才推进确认版本 | [持久化 schema](data/truth_persistence_v1.schema.json)、[当前状态](PROJECT_STATUS.md) |
| 来源先保存，派生内容可追溯 | 理解结果、来源恢复与后续校准能回到同一份原始材料 | [来源存储实现](public/raw-source-storage-domain.js)、[共享来源入口](public/source-input-domain.js) |
| Runtime 按模式、操作、能力分别解析 | 图片导入和对话可能需要不同能力；失败不能冒充成功或静默换成 Local | [能力解析实现](public/runtime-capability-gate.js)、[Runtime 合同](docs/current/ARIADNE_RUNTIME_EXECUTION_CONTRACT.md)、PROJECT_STATUS 的 2026-09-04 routing 条目 |
| 共用交互，保留领域边界 | Candidate/Job 的输入、等待、编辑、保存体验一致；各自的语义与修改权限明确 | [ProductShell](public/product-shell-domain.js)、[共享交互审查](docs/current/ARIADNE_GLOBAL_INTERACTION_PARITY_AUDIT.md) |
| 结构正确与理解正确分别验收 | schema、回归和 HTTP 成功不能单独证明模型回答贴合当前材料 | [技术证据](TECHNICAL_EVIDENCE.md)、[当前状态](PROJECT_STATUS.md) |

这些内容从旧工作区的项目规则、Ariadne 专属决策及本仓库现有契约中重新整理；相关依据已在本仓库，不引入旧工作区作为必需读取路径。未整份导入系统 AGENTS、全局决策日志或其他项目记录。

## 3. 当前实现与边界

- 2026-09-08 用户确认模型接入最低要求：所有 Model 操作（包括纯文字对话）只使用有明确图片输入和视觉 PDF 处理能力的多模态模型。PDF 可原生发送，也可完整逐页转图；仅 OCR/文本抽取、模型列表存在、名称含 vision 或一次文字连通检查都不能替代能力证据。未来 Gemini/其他 Provider 同样遵守此门槛，且须完成对应 Ariadne adapter 验证后才能执行。
- 当前基础为 Candidate/Job 导入、Working、人工保存、确认版本、详情编辑、来源恢复和范围明确的模型对话；具体已验收路径与故障以 PROJECT_STATUS 最新条目及对应证据为准。
- Candidate Material Detail 的当前版本/同源 Working 同步，以及 Local/Model 隔离，是已修复且有回归覆盖的行为契约；后续改动应保留。
- Job 已有基于 Candidate 上下文的讨论、差距分类和建议契约；这不等于已完成建议执行、成果反馈及持续进展闭环。
- 完整目标推进、建议落实后回写 Candidate、自动简历优化与投递等后续能力，需在具体任务中定义和验收。本文整理不启动 J2，不改变当前功能或 Provider。
- 本仓库维护产品、代码、契约、测试与技术决策。个人学习日志、课程路线、能力掌握等级、全局职业综合和其他项目档案不纳入本次整理。产品可以给出职位相关的能力提升建议，这不要求复制开发者的个人学习档案。

## 4. 文档职责与适用顺序

项目文件不能覆盖当前用户明确指令，也不能把历史授权作为新的执行许可。

| 需要了解什么 | 入口 |
| --- | --- |
| 如何在本仓库工作 | [AGENTS.md](AGENTS.md) |
| 产品目标与稳定约束 | 本文件 |
| 当前完成到哪里、验证过什么 | [PROJECT_STATUS.md](PROJECT_STATUS.md) 最新适用条目 |
| 某项修复的依据、失败与证明 | [TECHNICAL_EVIDENCE.md](TECHNICAL_EVIDENCE.md) 及对应测试 |
| 实际数据结构和操作边界 | `data/` 中契约/schema，以及 `public/`、`src/` 中对应实现 |
| 历史设计取舍和阶段交接 | [架构目录](docs/architecture/)、[NEXT_PHASE_HANDOFF.md](NEXT_PHASE_HANDOFF.md) |
| 迁移位置、数据与运行验收 | [RELOCATION_HANDOFF.md](RELOCATION_HANDOFF.md)、[RELOCATION_MANIFEST.md](RELOCATION_MANIFEST.md) 最新记录 |

架构文档保留稳定设计约束；其中带日期的实现状态、next milestone、模型推荐和一次性执行指令属于当时快照。后续有明确记录的用户决策可修订对应约束；单凭较新的代码或 PASS 文案不能推翻行为契约。遇到实质冲突先核对相关决策、实现与证据，再作最小处理。

无需每次加载所有历史文件。按任务选择契约与必要来源，减少无关上下文对当前判断的影响。

## 5. 开发与运行入口

- 后端：根目录 `app.py`，Python 标准库；前端：`public/` 中原生 HTML/CSS/JavaScript；领域及 Provider 后端：`src/`。
- 持久化：当前交互数据主要在原浏览器 profile 的 IndexedDB；legacy JD 数据在 `data/job_radar.db`。改变浏览器 profile、host 或端口会改变浏览器数据上下文。
- 从仓库根启动：`PYTHONDONTWRITEBYTECODE=1 python3 app.py`，正常入口为 `http://127.0.0.1:8000/`。重启前先核对占用端口进程的 cwd 与身份。
- Node 回归按文件运行：`node tests/<name>_regression.mjs`；Python：`PYTHONPATH=. PYTHONDONTWRITEBYTECODE=1 python3 tests/<name>_regression.py`。跨语言 route suite 必要时设置 `ARIADNE_NODE_BINARY` 为现有 Node 可执行路径。
- 最新已记录的自动回归基线为 41 Node + 22 Python（2026-09-09）；计数会随项目变化，应以实际文件与运行结果为准。常驻 stub server、可选私有 fixture 和可选 smoke 不计作默认回归套件。
- 这是本地运行项目，当前没有 package/requirements/lock manifest；不要为文档整理安装依赖或引入新框架。测试日志、编译产物和私人截图保存在仓库外。
