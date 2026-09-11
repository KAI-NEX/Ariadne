# DeepSeek V4.1 迁移与模型更新

日期：2026-09-11。范围：DeepSeek 接入迁移、只读发现及一次确认验证切换，不新增其他 Provider 执行能力。

## 当前接入

- 直接连接官方 `https://api.deepseek.com/chat/completions`，模型 ID `deepseek-flash`，不是 DeepSeek 网页版或第三方转发。凭据仍由本机钥匙串读取，既有本地配对连接器路径保留。
- 官方于 2026-09-10 发布 V4.1 Flash；`deepseek-flash` 指向此版本，旧 `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` 已退役并临时转向新版。依据：[官方公告](https://deepseek.com/news/deepseek-v4-1-flash/)、[API 更新公告](https://api-docs.deepseek.com/zh-cn/news/news260910/)、[视觉 API 文档](https://api-docs.deepseek.com/guides/vision/)。不把 9 月 14 日以后的 Pro 路由变化提前当成当前事实。
- 当日本机账号 `/models` 实际返回 `deepseek-flash`、`deepseek-v4-pro`。本次只开放前者；名字或返回列表不认证后者的多模态/领域能力。
- 请求/响应继续按精确 model、协议、领域 schema、来源身份和版本校验。新 descriptor revision 为 `deepseek-v41-20260911`；思考参数仍沿用已有固定配置，不擅自开放未验收的调节项。

## 迁移与历史

`model-settings-catalog.json` 的 `migrations` 只用于当前偏好读取，将用户已授权迁移的旧实验型号映射到新 ID。`retired_models` 仅提供历史设置校验元数据，不出现在可执行列表。历史快照验证不调用当前偏好映射；后端旧型号绑定不能执行。

新请求捕获新 model/descriptor/settings 指纹，不沿用旧模型的派生理解缓存；原始资料、旧消息、Working、确认版本、来源文件与浏览器数据库不批量改名或删除。已有 Codex、Local 和其他 Provider 选择不改变。打开中的旧页面需要刷新，服务部署需重启，不能将已发出请求改派给新型号。

## 发现 → 一次确认 → 验证并切换

1. 首页或六个对话入口在当前 Provider 为 DeepSeek 时读取 `/api/model-updates`。可见空闲页面进入/返回前台/偏好变化/每 15 分钟触发检查；后端对成功发现缓存 15 分钟。无凭据/网络失败不影响现有对话；Local/Codex 页面不会为发现发起 DeepSeek 请求。检查不含材料或推理。
2. 候选型号须同时通过后端资格 authority、当前加载的参数目录及页面 operation authority。已知旧型号不重复提示；未知型号显示等待适配而不是获得执行权。
3. 一条短提示说明仅发送测试图片/PDF及可能少量费用，按钮为「验证并切换」「稍后」。点击确认才 POST 精确的 provider/model/revision/confirmed；拒绝私人材料、任意字段、未确认或未适配型号。
4. 服务再次检查账号可用性；读取独立合成图片、生成真实两页合成 PDF、完整逐页转图，一次请求验证三张图片的内容与顺序、精确响应型号和严格工具输出。重复验证、缺页、异常响应或网络失败均不能切换。自动验证不上传个人资料，不写候选/职位数据。
5. 通过后在原 scope 与选择修订仍一致、页面未开始新请求时，直接通过既有 Web Locks + CAS 保存。首页切应用默认，对话只切当前对话；不二次确认。失败保留旧选择并可重试；「稍后」按型号/修订在本次浏览器会话内收起。

## 自动化的边界

- 此次是 DeepSeek provider adapter；后续 Provider 可以复用前端交互/状态层，但各自的发现协议、凭据、视觉与领域验收必须独立完成。本次未自动接入 Gemini/Qwen。
- `/models` 发现的是账号模型 ID，不是一个保证实时、包含内部权重版本的发布订阅。页面关闭时不监控，最长约 15 分钟缓存；同一 ID 背后的服务端更新不能仅靠列表检测，也没有声称模型具有实时联网资料。
- 全新型号需要官方协议核实、实际图片与完整视觉 PDF 验证、受影响领域 adapter 验收，再同步 Python/浏览器 authority 和目录 revision。通过这些开发侧准入以后，用户侧仅需一次确认完成本机验证与切换。不允许新名字套用旧能力。
- 应用升级后重启服务并刷新页面；新前后端目录不一致时按钮不得假称可以切换。更新发现不自动改变当前模型。

## 本次验证证据

- 真实独立图片返回 `JOB RADAR TEST`，响应 ID 对应模型 `deepseek-flash`；组合验证图片 + 两页视觉 PDF + 工具输出通过。
- 使用纯合成测试资料，Candidate PDF、Job PDF、Candidate 对话、Job 对话、个人理解、职位概况六条真实领域执行均通过；解析结果保持 source refs、未确认/已确认分层与人工保存边界。响应仅记录在 QA 文件，未保存进产品资料库。
- 人工检查：Candidate 保留岗位、2024 年份与两页来源；Candidate 对话先澄清两项经历而不猜测；个人偏好仅提案，Job 关联区分证据不全与能力缺失；职位概况保留地点矛盾。首轮合成 Job PDF 的长行被页面边界截断，模型如实报未知；缩短测试行后重跑，完整读出职责与 AI 产品经验要求。两轮证据原地保留，不将 schema 通过等同于所有真实材料语义无误。
- 真实调用证据：`.cache/deepseek-v41-20260911/1789110785163254000/`（组合视觉+六领域），`1789111331867454000/`（修正后的 Job PDF）。明确运行 `scripts/verify_deepseek_migration.py --live` 才产生合成 API 用量；`--case job_pdf` 可定向复测。
- 离线回归覆盖迁移/历史身份、缓存、未知型号、可用性撤销、缺页、响应型号/结构错误、确认字段、重复验证、Local 零调用、一次点击、失败及跨页/scope/忙态冲突。浏览器 egolite 验证失败保留、成功直接更新标签、旧首页偏好迁移与桌面/390 px 布局。浏览器切换测试使用显式响应替身，不能代替前述真实模型证据。
