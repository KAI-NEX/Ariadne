# 对话实时反馈与证据边界

更新：2026-09-24。适用：Web API 与本机 Skill 的六个对话入口。不是模型内部推理展示，也不是新的 Agent 权限层。

## 用户看见什么

- 发送时显示本轮已选的详细资料范围（若当前编译器提供 coverage）、服务端接收、输入准备与真实模型调用边界。图片计数含完整转图后的 PDF 页面，不代表模型已逐页理解。
- Web 从所选 Provider 的 Chat Completions SSE 中提取公开 `message` / `summary` / `semantic_action.message` 文字，作为生成中的临时预览。不显示 function 参数全文、patch、来源正文包或 `reasoning_content`。
- Skill 不更换 `CODEX_EXEC_JSONL`，也不扩大工具权限。执行期间增量读取 JSONL：公开 `agent_message` 完成时立即显示阶段反馈或公开回复预览；`reasoning` 不传给页面。CLI 没有提供的 token delta 不凭空生成；并非持续逐字输出，也不保证每轮都有阶段消息。
- 完整结果返回后仍执行原有领域结构、动作、来源范围、执行代次与版本校验。服务端通过后，临时预览清除，过程记录折叠；前端继续自己的校验与持久化。记录写明最终结果以对话历史为准，不能把“服务端校验通过”解释为已经保存或事实已证实。
- 断流、失败或缺少完整终止帧：预览撤回，保留明确的失败与重试提示。附件按原有机制恢复并重新确认，不自动重发付费请求。

过程记录只是当前页面的临时反馈，不作为已确认资料，也不会在刷新后恢复。模型观察标注为未核验；结构校验不等于事实核验。来源依据、未知与需要用户核对的事实仍应在最终回复和领域证据入口中说明。此阶段没有新增独立语义验证调用、伪造检查数量或模拟“正在思考”的定时消息。

## 传输和隔离

请求仍 POST 至原来的四个领域 endpoint，以 `Accept: application/x-ariadne-turn+ndjson` 协商事件；旧 JSON 服务端可兼容返回整包，界面明确标为非实时。DISTILL/SYNTHESIZE 沿用 JSON。请求中选定的 Provider/model、推理强度、传输同意及多模态资格不变。

`src/conversation_events.py` 使用请求局部 ContextVar。事件严格递增 seq，类型白名单为 received、input_ready、model_started、update、preview、checking、result；终态携带实际业务 status 与原领域结果。浏览器拒绝乱序、缺终态、额外终态、未知类型、过大响应或损坏 UTF-8。局部预览只作纯文字渲染，不执行 Markdown HTML 或工具。

- 本机 HTTP：即时 flush，同一响应连接携带事件及终态；原 loopback/Origin 与 Skill Provider 门禁继续有效。
- 普通 WSGI Web：有界队列转发同一次请求，所有 origin/key/session/配额与领域验证仍由原 dispatch 执行。消费者断开不代表 Provider 已取消，不承诺返还额度。
- Cloudflare：同一 Durable Object、同一凭据/会话 namespace 与执行收据。ReadableStream 直接发送事件，上游 Reader 按 SSE 行读取，避免 WSGI 和原上游整包缓冲。没有新增跨域通道、日志正文或持久化模型答案。实现方式参考 [Cloudflare Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/)。

## 验收与限制

- 自动回归覆盖分字节中文解码、公开字段与私有字段隔离、Provider 身份/输出限制、提前预览、断流与终态顺序、原件/附件收尾，以及完整 Web 领域成功与不合法动作拒绝。
- 一次真实 Codex `gpt-5.6-sol / medium` 合成资料调用：13.066 秒收到公开答复，16.943 秒得到终态；相差约 3.88 秒。只使用虚构年份/原型/收入冲突，未发送私人资料。此样本没有额外 commentary，不据此声称持续 token 流或普遍性能提升。
- 实际 workerd 合成上游：公开预览先于终态约 1 秒；成功/422 失败终态保持；中文 SSE 被逐块读取，隐藏 reasoning 未转发。发现并修复 SDK Request 到 JS Request 的克隆类型错误。不是公网 Provider 付费验收。
- egolite 验证生产六页面的共用渲染与传输（延迟合成服务端），含 1920px/1392px 桌面、390px 窄屏、失败撤回、完成折叠和减少动效。没有用测试数据写入真实资料库。浏览器一次缓存加载缺失经当前任务禁缓存并重载恢复；测试前未选择 Model 导致发送按钮禁用属正确门禁，合成测试单独绕过页面提交守卫，没有改变生产门禁。
- 2026-09-24 已发布 Pages `8b602e80`、API `6c86cee2-5816-4e43-a525-5b77e8ee2634`，本机 Skill 更新至干净提交 `eccac62`。官网浏览器核对事件通道和无模型调用的 422 拒绝终态、脚本/CSS hash 与公开 ZIP；两个下载来源 SHA-256 一致。本机 219 个运行文件校验通过，694 个资料文件更新前后及重开后不变。
- QA、生成包与中间失败保留在 `.cache/conversation-transparency-20260924/`。真实 API 账号的三家 Provider 流式行为与其他电脑安装尚未验证；不能把合成上游或公网边界检查等同于全部真实服务已验收。
