# Codex 本机运行与 Web 连接器

更新：2026-09-09。本阶段实现 Codex Model Provider，以及网页连接本机 Codex 的配对通道。公开域名尚未部署。

## 两种运行方式

| 方式 | 请求路径 | 使用条件 |
| --- | --- | --- |
| 本机直连 | 浏览器 → 本机 Ariadne（8000）→ 本机 Codex CLI → OpenAI | 在本机登录 Codex，启动 Ariadne；无需配对连接器 |
| Web 配对 | HTTPS Ariadne 网页 → 127.0.0.1:8765 连接器 → 本机 Codex CLI → OpenAI | 本机连接器保持运行；网页来源与配对授权一致；浏览器允许本地网络访问 |

两者都属于 **Model** 模式。Codex 在本机运行客户端，模型推理仍向 OpenAI 发出请求，使用本机登录账号的额度；不等于离线 Local。原有 Local 继续保持 Provider 调用为零。

## 本机准备

当前实测组合为 macOS、`codex-cli 0.153.4`、ChatGPT 登录、`gpt-5.6-sol`、medium reasoning。没有更改开发任务使用的模型或用户 Codex 配置。其他 Codex 模型不会因出现在列表中而自动获得执行资格。

1. 本机安装 Codex，执行 `codex login`，用 `codex login status` 确认登录。
2. Python 能运行本项目，`pdftoppm` 在启动服务的 PATH 中；原有本地技术解析依赖仍适用。
3. 本机直连可执行 `ARIADNE_CODEX_ENABLED=1 python3 app.py`，然后在运行方式页选择 Codex。
4. 本机持久配置放在忽略目录 `data/runtime/codex-local.json`，内容如下。本次已为当前电脑配置并启动 8000 服务。

```json
{"enabled":true,"model":"gpt-5.6-sol","qualification":"ariadne-codex-v1","prefer_codex":true}
```

`prefer_codex` 是本机操作者明确选择的初始偏好：本机运行方式页面在当前 origin 首次应用一次，随后尊重用户的新选择。单纯读取模型列表不会选择模型。配置没有登录 token。`ARIADNE_CODEX_ENABLED=0` 可明确禁用；不删除已有资料。

## Web 配对

在本机项目目录运行：

```sh
python3 scripts/run_codex_connector.py
```

默认只允许 `https://web.ariadne.kai-nex.com`。在该网页的运行方式菜单点击「连接本地 Codex」，或使用「添加新的模型」弹窗底部的同名链接，在配对弹窗中输入本机终端显示的一次性配对码。成功后原页更新模型选择；关闭或取消不会产生迟到的选择。开发环境可以通过 `--origin http://127.0.0.1:8017` 指定一个准确的 loopback origin；生产来源必须为 HTTPS，不能含路径、凭据或通配符。

- 配对码五分钟有效，只能兑换一次，五次错误后失效。兑换后的随机 token 仅放在网页 sessionStorage；连接器内存只保留其 hash，八小时过期。它不是 Codex/OpenAI 登录凭据。
- 断开连接会请求撤销当前 token；停止本机连接器会撤销其内存中的所有访问授权。重启后重新配对。关闭标签页会丢弃本页连接信息。
- 连接器绑定 loopback，校验 Host、精确 Origin 和 token。CORS 不使用通配符，同时提供私有网络预检响应。只有列出的 Ariadne 领域及技术准备接口可达；不提供任意代理、文件路径读取、Keychain 配置、历史任务或 Codex 控制接口。
- 配对通道只允许 Codex 模型执行，不允许借用本机其他 Provider 的凭据。断连、过期或撤销明确失败；不自动切到 Local、DeepSeek 或云端后端继续模型请求。
- 配对后的模型确认框继续显示实际 Provider/model。原始材料先 durable 保存；语义结果仍进入 Working/Proposal，确认版本由人工保存生成。

后续托管 Web 需要独立提供 Ariadne HTML/JS 和公开契约 manifest；本机 app.py 仅允许 loopback Host/Origin，不能直接反向代理为公网服务。本阶段没有创建纯静态导出器、云端中继、账号同步或公网 Codex daemon。HTTPS 网站访问 loopback 的权限仍受浏览器版本、企业策略及用户授权影响，不能通过服务端 CORS 绕过。首次公开部署后需在真实 HTTPS origin 再验收此权限路径。

## 领域与传输契约

- 统一能力 authority 只接纳已验证的 `codex / gpt-5.6-sol / CODEX_EXEC_JSONL` 组合。Candidate 导入、Job 导入、Candidate 对话、Job 对话、个人理解、职位概况均校验各自 adapter、prompt、schema、operation、来源、版本和保存权限。
- 六条领域流程复用原有语义 schema 与校验。Codex adapter 有独立前缀；领域 manifest 中历史命名的 request/prompt 版本继续表示复用的领域契约，不表示网络调用 DeepSeek。
- Codex CLI 从独立临时目录执行，显式选择模型，使用 ephemeral 会话，忽略用户 config 和 execpolicy rules，关闭项目文档注入、shell、浏览器、插件、apps、图像生成和多代理工具。清除继承的桌面工具管道、任务身份、权限配置和 API 环境覆盖。只将当前领域请求和附件交给该进程。
- 使用受支持的独立 OpenAI provider 配置通过 HTTPS 调用，避免实测环境中的 WebSocket 重试延迟。没有读取或复制 Codex 登录 token。
- 对函数 schema，wire 层把 optional 字段编码为 required + nullable，返回后恢复 optional 表达，再经过完整领域校验。内部 chat-shaped envelope 是领域转换结构，不声称 Codex 原生返回 Chat Completions 或实际执行了该函数工具。
- 每次执行限制 180 秒、最多两个并行子进程、8 MB 事件输出。只接受完成的 JSON 对象；子进程失败、非预期工具活动、截断/不完整输出和超时均失败。取消仍沿用原有 generation 校验，不能保证已经发出的上游请求立即停止。

## 图片和完整 PDF

Candidate 原图与 PDF 均经实际图片输入验证；PDF 共用 `src/pdf_delivery.py` 完整逐页转图，保持顺序，不只发送提取文字。

Job PDF 修复了旧路径只发送提取文字的问题：技术准备先生成完整页数/位置 manifest，执行时重新校验原始 PDF hash、完整渲染、验证页数与页位置，再附带全部页图。视觉页 marker 是来源定位，不能被当作原文。此更新同时适用于 DeepSeek 和 Codex 的 Job 导入，adapter 升至 `*-job-multimodal-import-v3`；旧快照会被拒绝，刷新后重新确认。

Job PDF 受最多 48 个来源块的完整处理预算约束，PDF 页图总字节仍受既有 40 MB 上限约束；任何缺页或超限都停止，不截取前几页冒充完整理解。图片、DOCX 和粘贴文本的既有路径保留。

## 验收与证据

- **77/77** Python/Node suite、VI 门禁和 diff 检查通过。离线回归覆盖原有领域、Local 隔离、保存/版本边界、模型身份、可选 schema、配对/过期/撤销、Host/Origin、接口白名单、断连不降级、子进程失败/超时，以及两个 Provider 的完整 Job PDF 与原件完整性。
- 真实 Codex 合成调用覆盖独立图片、两页 PDF 标记（`ALPHA 739`、`BETA 284`）、Candidate 导入、Job 文本/PDF 导入、两类详情对话与修改提案、个人理解和职位概况。初次 Candidate schema 不兼容已修复并复验；模型输出仍有随机性，测试通过不等于以后永不失败或所有真实材料语义都正确。
- egolite 在分离的网页/连接器 origin 上验证配对、实际 PDF 请求、来源保留、Working 与人工保存边界以及断连报错。Chrome 补做运行选择、配对页面的桌面/移动截图与溢出检查；egolite 截图接口超时，交互检查继续使用 egolite。
- 合成请求、结果、PDF、浏览器与回归证据留在 `.cache/codex-integration-20260909/`，不加入 Git；没有用私人简历或真实职位进行质量认证。

实现参考：[Codex 配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)、[Codex 认证](https://learn.chatgpt.com/docs/auth)。本机 CLI 的 `exec --help` 和实测结果用于核对当前安装版本。
