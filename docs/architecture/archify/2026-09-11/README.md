# Ariadne 架构分析 · Archify

2026-09-11；代码基线 `1b397470b9bb3ff57adedea14da5286e87a0477c`。本次交付为代码分析、交互架构图和验证记录，没有修改 Ariadne 应用逻辑、模型配置或用户资料。

[打开交互架构图](ariadne.html) · [可编辑图源](ariadne.architecture.json) · [校验与交付回执](delivery.json) · [验收摘要](verification.json)

Ariadne 已形成以来源、独立领域、模型执行契约和人工确认为核心的结构。最值得保留的是确认数据的写入边界；最值得逐步改善的是集中在页面与 HTTP 入口的编排职责。当前代码和本次抽样回归支持这些判断，但不能证明所有模型回答都语义正确，也不能据此宣布公开 Web 部署可用。

## 分析方法与范围

使用 [Archify](https://github.com/tt-a1i/archify) 的 `architecture` 类型，将代码中核对到的关系写成 typed JSON，再由其本地 Node.js 渲染器生成独立 HTML。**分析结论由本次代码阅读形成；Archify 负责表达、布局和产物校验，不是自动发现全部依赖或漏洞的扫描器。**

安装目录为 `~/.codex/skills/archify`，包内 release 标识为 `2.17.0-dev.1`（development）。通过 Codex 的 skill-installer 从 `tt-a1i/archify` 的 `archify/` 子目录安装；包内无需另外安装 npm 依赖。`doctor` 全部检查通过。保留上游 [MIT 许可](ARCHIFY_LICENSE.txt)。图使用 Archify 自身的文档视图，未改动 Ariadne 产品 VI。

分析读取当前项目上下文、最新状态、领域实现与相关契约，没有读取浏览器私人资料、凭据或真实材料库，没有调用 Ariadne 的外部模型。起始工作区已有 Mac App 与公开入口文档改动，本图不将它们当作本次完成或验收的功能。源代码文件指纹见 [source-evidence.json](source-evidence.json)。

图包含 10 个概念组件、11 条逻辑关系。为保持可读性，合并了 Candidate/Job 工作区、六类后端领域 Runtime，以及两个外部推理目的地；这些合并**不表示共享数据权限或相同传输协议**。箭头表示处理顺序或依赖：模型回包仍经本机领域校验，Local 技术处理也可通过本机 HTTP 接口执行。图不是部署拓扑、实际网络抓包或完整调用图。纯讨论可以只生成回复，不必经过提案与保存；当前上下文也可读取明确标记为未确认的 Working，图只突出确认版本的主循环。

## 组件与代码依据

下表行号对应上述基线，链接保留为仓库相对路径，便于本地和版本库中阅读。

| 图中组件 | 实际职责与边界 | 主要实现依据 |
| --- | --- | --- |
| 原始资料 | 输入文件先形成 durable SourceDocument；原件、来源 ID、hash 与有序 bundle 绑定 | [raw-source-storage-domain.js](../../../../public/raw-source-storage-domain.js) 第 126、157 行；[source-input-domain.js](../../../../public/source-input-domain.js) |
| Candidate / Job | 共用输入、等待、对话与详情体验，分别维护语义、操作和版本 | [product-shell-domain.js](../../../../public/product-shell-domain.js)；[v1-pages.js](../../../../public/v1-pages.js) |
| Runtime 门禁 | Local/Model、操作资格、模型多模态能力、设置修订和不可变快照；后端再次校验 | [runtime-capability-gate.js](../../../../public/runtime-capability-gate.js)；[execution_contract.py](../../../../src/execution_contract.py)；[model_settings.py](../../../../src/model_settings.py) |
| 领域执行服务 | Python 标准库 HTTP 服务，路由到 Candidate/Job 导入、两域对话、个人理解、职位概况六类 Runtime | [app.py](../../../../app.py) 第 848、1030、2416 行；`src/*_runtime.py` |
| Local 技术处理 | 本地读取、OCR、确定性提取；结果仍待审阅，Provider 调用为零 | [career_evidence.py](../../../../src/career_evidence.py)；[local-candidate-extraction-domain.js](../../../../public/local-candidate-extraction-domain.js)；[local-job-extraction-domain.js](../../../../public/local-job-extraction-domain.js) |
| 外部语义推理 | DeepSeek 经官方 HTTPS；Codex 通过本机隔离 CLI 调 OpenAI，仍属于 Model | [runtime_binding.py](../../../../src/runtime_binding.py)；[codex_runtime.py](../../../../src/codex_runtime.py) 第 44、171、184 行；[模型更新记录](../../../current/DEEPSEEK_MODEL_UPDATES.md) |
| Working / Proposal | 导入、对话修改形成可审阅状态，模型输出没有确认版本写入权 | [candidate-model-runtime-domain.js](../../../../public/candidate-model-runtime-domain.js)；[job-model-runtime-domain.js](../../../../public/job-model-runtime-domain.js)；[candidate-workspace-conversation-runtime.js](../../../../public/candidate-workspace-conversation-runtime.js) |
| 用户明确保存 | 校验提案、接受内容及来源关联，在 IndexedDB 事务内检查版本再写入 | [truth-persistence-domain.js](../../../../public/truth-persistence-domain.js) 第 764、840 行 |
| 确认版本 | 同一 IndexedDB 中不同 object store，Candidate 与 Job 独立 revision；保留历史 | [truth-persistence-domain.js](../../../../public/truth-persistence-domain.js) 第 12–89 行；[truth_persistence.py](../../../../src/truth_persistence.py) |
| 当前上下文 | 个人理解、职位集合概况各自维护范围；单 JD 对话才组合所需 Candidate 上下文 | [job-overview-domain.js](../../../../public/job-overview-domain.js) 第 10 行；[job-candidate-context-domain.js](../../../../public/job-candidate-context-domain.js) 第 192、335 行；[personal-context-domain.js](../../../../public/personal-context-domain.js) |

## 三个关键边界

**来源与确认。** 原始材料、技术提取、模型推断、用户自述及确认 revision 有不同身份。用户保存说明用户接受该版本，不代表外部事实已经核验。当前核心数据位于 `job-radar-local-first-v1`（DB version 17），旧 SQLite JD 存储仍存在，但不能把 `data/job_radar.db` 当成当前个人资料的唯一数据库。

**浏览器与本机服务。** 原生 HTML/CSS/JS 承担状态管理、上下文编译和多数持久化。`app.py` 在 `127.0.0.1:8000` 提供静态资源及受限 API；它还依赖本机技术工具完成某些文档处理。存储受浏览器 profile 与 origin 约束，改 host/端口会改变可见的浏览器工作区。当前不是账号云同步架构。

**本机与模型。** 当前代码的 DeepSeek 型号为 `deepseek-flash`；Codex 固定 `gpt-5.6-sol / CODEX_EXEC_JSONL`，可用推理强度由现有目录决定。Codex 在独立临时目录、ephemeral 会话中执行，关闭工具与项目上下文注入，接收本轮领域材料。两条路径都把推理请求发往外部服务；配对连接器只放行约定接口和 Codex 执行，不是任意本机代理。这里陈述的是仓库配置和既有记录，本次没有重新认证模型能力。

## 维护观察与建议

| 观察 | 依据和影响 | 建议的下一步 |
| --- | --- | --- |
| 页面编排较集中 | `public/v1-pages.js` 4,075 行，包含导入、Working 保存、对话、恢复等多个流程；`app.py` 2,423 行，汇总路由、连接、旧 JD 与新领域执行。行数是复杂度线索，不是性能或缺陷证明 | 后续有相关需求时，逐块提取页面控制器和路由分发；保持领域 schema、输入/输出以及既有保存边界，不先做整仓重写 |
| 前后端契约维护存在同步成本 | JS 与 Python 都有 runtime、truth persistence、模型设置与领域校验。两端重复校验是必要的，但字段和版本漂移会增加回归成本 | 共用中立的契约 fixture 和跨语言一致性验收；保留两端各自的权限执行，不删除服务端复核 |
| 回复等待受完整响应链路约束 | `src/codex_runtime.py` 第 184–212 行在子进程结束后读取、解析结果；页面使用 `response.json()`。UI 逐字呈现不能改变首字到达时间 | 真正流式须单独实现公开回复增量和最终验收；未校验的提案不得提前生效，沿用[既定流式边界](../../../current/CONVERSATION_OUTPUT_AND_STREAMING.md) |
| Web 发布仍有本机依赖 | 文档读取、凭据和 Codex transport 位于本机；配对连接器已有实现，但实际公开 HTTPS origin 的本地网络权限尚待部署后验收 | 公开部署前验证稳定 origin、真实浏览器授权、断连/撤销及完整 PDF 路径；本次不推断已发布或已具备纯静态独立运行能力 |
| 状态记录有局部滞后 | PROJECT_STATUS 仍保留 Job 导入 `createMessage` 断言失败的历史；当前 HEAD `1b39747` 已修正断言，本次对应 suite 通过。PROJECT_CONTEXT 中的历史 suite 数也已落后于文件清单 | 新结论使用当前代码和执行证据，历史记录保留；本次新增状态条目注明已重跑通过，避免把旧失败当当前阻塞 |

优先保留现有来源、人工保存和领域隔离机制。下一次维护应围绕具体问题拆分编排职责并完善契约一致性检查；真正流式与公开 Web 验收是独立交付项，不由本图或本次分析自动开启。

## 本次验证

- Archify `doctor` 通过；一次标签位置修正后，`validate` 与 `deliver` 均通过 showcase：9/9 检查、0 errors、0 warnings。
- Archify 自带 `visual-check` 实际测量 1440×900、1600×1000、1920×1080、2048×1320，均无横向或纵向溢出；生成首尾两种尺寸的浅色/深色截图。该命令使用自身 Chrome 测量器；结果为 `browser_evidence: passed`。
- 逐张查看四张截图，核对中文节点、箭头、标签和说明卡片，无可见截断或遮挡；`visual_review: passed`。1440 宽的概览说明字较小，细节可通过缩放或节点聚焦查看，不以自动最小字号阈值代表所有人的阅读体验。
- egolite 实际打开本地交互图，验证节点搜索、Working 节点聚焦与关联关系、关闭详情和导出控件；具体导出结果见验收摘要。
- 11/11 相关离线 suite 通过：JS/Python truth persistence、JS/Python runtime capability gating、JS/Python multimodal policy、raw source persistence、job overview、personal understanding、Codex connector、Job model import。使用禁用 Codex 的离线环境与测试替身，不是 11 次真实模型调用。仓库已跟踪默认回归文件共 92 个（58 JS + 34 Python），另有本轮开始前未跟踪的 macOS suite；本次没有运行全部 suite。
- QA 截图、浏览器侧回执与导出样本原地保留；不将它们或安装的第三方 Skill 源码混入产品实现。源码、图源和交付字节摘要见相邻 JSON 回执。

未覆盖：真实私人材料质量、全量应用回归、所有 Archify 交互/导出格式、真实模型速度、生产安全审计和公开 HTTPS 部署。图中的可达关系只基于手工编写的逻辑边，不可作为运行时影响半径或性能分析。

## 复现

使用本机已存在的 Node（当前 shell 的 PATH 没有 `node`，未修改用户 PATH）：

```sh
ARCHIFY_NODE=/Users/kai/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
ARCHIFY_SKILL=/Users/kai/.codex/skills/archify
"$ARCHIFY_NODE" "$ARCHIFY_SKILL/bin/archify.mjs" doctor
"$ARCHIFY_NODE" "$ARCHIFY_SKILL/bin/archify.mjs" validate architecture docs/architecture/archify/2026-09-11/ariadne.architecture.json --quality showcase --json
```

需要重渲染时，使用 `deliver architecture <图源.json> <新输出.html> --quality showcase --json`，输出选择新路径以保留本次验收快照。修改图源后必须重新验证并生成与新文件绑定的回执。此图没有启用 Archify 的公开 Git revision 源码跳转，源码依据集中在本报告和指纹清单。
