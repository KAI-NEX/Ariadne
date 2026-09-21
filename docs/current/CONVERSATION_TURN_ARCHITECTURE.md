# 共用对话 Turn 架构

更新：2026-09-21。适用于 Candidate、Job、个人理解与职位概况的 Model 对话；领域语义、结果校验和人工保存权限仍分别维护。

## 为什么需要整合

此前附件组件已经共用，但每个领域仍各自编排 `prepare → fetch → parse → finish`。同一套附件落盘、网络异常和成功清理逻辑分散在四处，状态只能退化为总发送按钮的 loading。用户看到 DOCX 卡片和「正在理解」时，无法分辨正在校验文件、已在本机保存、正在传输，还是模型正在生成回复；页面分支也容易在后续修改中出现不同的失败与清理行为。

本轮把共用边界提升一层：所有 Model 对话经 `conversation-turn-transport.js` 进入同一 Turn Transport。页面/领域不再直接调用附件的 `prepare` 或 `finish`。

## 当前管线

1. **Composer / Attachment Controller**：`conversation-attachments.js` 只负责选择、格式与大小检查、明确传输确认、本机 `SOURCE_INPUT_ONLY` 原件记录，以及可见阶段状态。
2. **Turn Transport**：`conversation-turn-transport.js` 是唯一的前端网络编排入口，按顺序准备附件、标记模型请求、发送 JSON、解析统一错误，并且恰好一次完成或失败附件状态。
3. **Domain Contract**：Candidate、Job、个人理解、职位概况继续分别创建请求、检查 Runtime signature、校验结果和执行各自的 Working/Proposal/只读权限；共用传输不解释领域语义。
4. **Backend Attachment Adapter**：`src/conversation_attachments.py` 集中核对执行 ID、Provider/model 同意、文件名/MIME/大小/hash 和完整解码，再把本轮材料作为低权限 source material 放入对应领域 payload。
5. **Persistence / Delivery**：领域持久化只保存已校验的对话与 Working 结果；附件不会自动成为确认资料。模型选择 PDF/图解 deliverable 时，`conversation-output.js` 在本地生成下载文件。

可见阶段固定为：检查模型能力 → 读取并校验 → 本机安全保存 → 发送并等待模型理解 → 完成/失败。它们描述实际边界，不伪造 Provider 侧的上传百分比，也不重新引入每轮耗时计时。

## 不变量

- 选中文件不等于发送；未确认、Runtime 改变或 Local 模式均在网络请求前失败。
- 原件先在当前工作区持久化，持久化失败则不发送；失败后保留选择供重试。
- Turn Transport 只处理网络生命周期，不绕过领域 schema、来源范围、版本冲突或人工保存。
- Candidate/Job 不互相静默改写；个人补充仍是 Proposal/DRAFT；职位概况仍只读。
- 当前请求成功只说明本轮附件被模型处理。它不会自动成为资料卡，也不会在下一轮隐式重传。
- Skill 与 Web 共用此页面管线，但 transport 和存储路由仍由各自产品配置决定。

## 后续扩展原则

新增对话领域时，应提供 endpoint、domain identity、Runtime signature 与领域 error factory，然后接入 Turn Transport；不得复制一套附件收尾代码。需要更细的服务端进度时，应增加有契约的执行状态端点或事件通道，而不是用前端定时器猜测上传/推理阶段。
