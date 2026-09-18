# Ariadne 本地部署包

系统要求：macOS 14 及以上、Apple 芯片；当前只在构建电脑的 macOS 26.6 上实际验收，未覆盖全部兼容系统。

适用于 Apple 芯片 Mac。新构建产物为独立窗口的 `Ariadne.app`，不要求先安装 Python、Node 或开发工具。包含 Ariadne 网站与后端、独立 Python、Codex CLI 0.153.4、预编译的文档读取与完整 PDF 转图工具。Codex 是可选连接方式，不是默认选择；Local 保存原件，DeepSeek、Gemini 3.7 Flash 和千问 Qwen 3.8 Max 使用用户自己的 API Key（千问当前支持百炼北京地域）。未完成 adapter 的模型不能执行。

## 开始使用

1. 解压新 ZIP，将 `Ariadne.app` 拖到「应用程序」，双击打开。也可以直接双击解压后的 App。首次自动安装运行文件到 `~/Library/Application Support/Ariadne Local`，在独立窗口打开运行选择页；以后每次打开也从此页开始。可将 App 固定到 Dock，不需要保持终端窗口。
2. 选择已经接入并通过资格检查的模型，或选择「本地运行」先保存原件，再点击继续进入工作空间。已保存的连接配置会保留。启动本身不调用模型，不传输资料、不选择 Provider。
3. 若使用 ChatGPT/Codex 订阅，从 Mac 菜单「Ariadne → 登录 Codex…」打开官方登录流程（此首次设置使用终端和系统浏览器），完成后回到「连接设置」选择 Codex。已有默认 Codex 登录可以复用；包中没有任何人的登录信息。API 使用者不必执行这个步骤。
4. 点击窗口红色关闭按钮、按 ⌘W 关闭最后一个 Ariadne 窗口，或按 ⌘Q 退出，即停止 App 自己启动的本地服务和子进程。最小化窗口只是收起，不停止服务。再次打开时已保存资料保留。

重复打开同一个 App 会回到原窗口。8000 若被旧终端版、开发版或另一份 App 占用，新 App 提示先退出原服务，不复用、不杀已有进程、不换资料地址。App 崩溃或被强制退出时，监护进程通过管道关闭信号停止本次服务。退出会中断未完成的本机处理，未保存编辑不会自动保存；已经发出的 API 请求可能仍在 Provider 端完成并计费。

这是未公证的本地测试 App（仅 ad-hoc 签名），macOS 可能提示无法验证开发者。确认下载来源及 SHA-256 后，按系统「隐私与安全性」的提示允许打开；不需要关闭系统安全保护。Windows、Intel Mac 与另一台电脑首次下载后的 Gatekeeper 流程未验收，因此暂不能承诺完全无提示安装。

## 数据与模型

资料写入 `~/Library/Application Support/Ariadne Local/data`，版本代码分别保留在 `releases`。下载包不含旧工作区、私人材料、API Key 或 Codex 凭据。App 使用持久的 WebKit 存储；它与原 Chrome/Safari/Codex 内置浏览器的设置和工作区映射独立。首次打开可能是空工作区，需要重新连接模型；旧磁盘资料和浏览器资料原地保留，不自动迁移或混入。以后使用相同 App 标识和地址会恢复该 App 的资料。升级保留旧 release 及共享 data。

### 从已有本地浏览器资料库迁入

用户明确要求同步时，先从该浏览器核对 `ariadne-content-workspace-v1`，再用 `scripts/copy_local_workspace.py --source-root <原资料根目录> --home <App数据目录> --workspace <已核对ID>` 复制。脚本持有源资料锁，校验全部当前记录及原件，再逐文件比较 SHA-256；保留原目录和历史，遇到已有目标或映射立即拒绝覆盖。失败的中间产物保留供诊断，不从旧 IndexedDB 备份覆盖最新磁盘数据。

仅在 App 本机数据目录创建 `desktop-workspace.json`。原生窗口核对 ID、固定 origin 和 HEAD 文件，只为尚无映射的 WebKit profile 初始化该 ID，不覆盖已有原生资料库。完成后退出已核实的旧开发服务，再启动 App；同一 `127.0.0.1:8000` 地址、同一 ID 的浏览器与 App 将访问同一份 App 磁盘库。原开发目录保留为迁入时快照，不执行双向合并。浏览器里的 API Key、Provider 选择和传输确认不复制，App 仍需要单独配置连接。

用户在「连接设置 → 添加新的模型」选择 DeepSeek、Gemini 或千问并填写对应 API Key。DeepSeek 验证固定测试图片；Gemini/千问验证固定两页测试 PDF 的完整页面与 JSON，点击前说明少量 API 费用。Key 分别保存在当前浏览器，实际请求时经本机服务送到所选服务；项目文件与 Codex 连接器不接收该 Key。原有本机 Keychain 配置仍受支持。连通不等于支持完整分析。模型调用仍需既有传输确认，结果由用户保存；不随启动器切换模型或修改推理强度。

## 可选：连接公开网页版

本地版不需要配对。旧包中的「连接网页版.command」仍保留；新 App 的兼容脚本在「显示包内容 → Contents/Resources/runtime」中，不作为日常入口。配对连接器是用户另行启动的服务，不属于 App 生命周期。公开 HTTPS 本地网络权限仍需网站实际部署后验收。

## 构建与发布

2026-09-19 新版 App 已公开发布：[20260918-172135](https://github.com/KAI-NEX/Ariadne/releases/tag/local-20260918-172135)，113,908,957 bytes，SHA-256 `e8d88429b9802537ec30e914263187abfafcee6e3b501d34ea59aa42d49918bd`。网页下载入口与安装步骤使用独立窗口 App（拖入「应用程序」、菜单登录 Codex、关闭窗口停止）；旧终端版 Release 保留为历史版本。实际发布验收见 PROJECT_STATUS 最新条目。

2026-09-18 已公开的旧终端版下载：[下载页](https://ariadne.kai-nex.com/download.html) · [GitHub Release](https://github.com/KAI-NEX/Ariadne/releases/tag/local-20260918-104410)。安装包 `20260918-104410` 为 111,601,193 bytes，SHA-256 `2636abcf8b5ab85f2921bc4c557e0deb09f4c5bd0583793faa109d68b28ae6eb`。该版本仍双击 command、关闭终端停止。本次 App 构建不自动替换公网下载；最新发布状态见 PROJECT_STATUS。大型 ZIP 托管于 GitHub，Pages 只发布下载元数据。

`scripts/build_local_package.py --python <独立Python根目录> --codex-dir <已校验的Codex目录> --publish-local` 每次产生独立版本并保留旧产物；`public/downloads/latest.json` 指向本机可下载的 ZIP。大型 ZIP 与运行时不提交 Git；部署公开网站时需要另外发布 ZIP、校验文件和 metadata，未发布时页面明确显示尚无可下载版本。

源代码通过 Git 跟踪文件的目录白名单收集，仅包含 app.py、src、public 和 data 中的公开契约；不复制运行数据。Codex 来源与官方发布 SHA-256 写入 release.json，Python 与 Codex 许可证随包保留。当前包的静态生成与本机验收不等于新电脑、公网下载或所有 Provider 的真实模型验收。

本机与网页的运行边界见 [用户自带连接方向](LOCAL_AND_WEB_RUNTIME_DIRECTION.md)。公开网页已通过 Cloudflare 托管，后续发布按 [Cloudflare 部署](CLOUDFLARE_DEPLOYMENT.md) 执行；[网页部署](WEB_DEPLOYMENT.md) 保留为原有服务器方案。
