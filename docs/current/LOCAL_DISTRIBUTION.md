# Ariadne 本地部署包

系统要求：macOS 14 及以上、Apple 芯片；当前只在构建电脑的 macOS 26.6 上实际验收，未覆盖全部兼容系统。

适用于 Apple 芯片 Mac。本包不是 Apple App，也不要求先安装 Python、Node 或开发工具。包含 Ariadne 网站与后端、独立 Python、Codex CLI 0.153.4、预编译的文档读取与完整 PDF 转图工具。Codex 是可选连接方式，不是默认选择；Local 保存原件，DeepSeek、Gemini 等 API 入口沿用当前 Provider 接入与能力资格，未完成 adapter 的模型不能执行。

## 开始使用

1. 解压 ZIP，在 Finder 双击「启动 Ariadne.command」。首次自动安装到 `~/Library/Application Support/Ariadne Local`，随后打开默认浏览器的 `http://127.0.0.1:8000/` 运行选择页。
2. 在网页选择 Local 或已经接入并通过资格检查的模型。启动本身不调用模型，不传输资料、不选择 Provider。
3. 若使用 ChatGPT/Codex 订阅，首次双击「登录 Codex.command」，完成官方浏览器登录，再回到运行选择页选择 Codex。已有默认 Codex 登录可以复用；包中没有任何人的登录信息。API 使用者不必执行这个步骤。
4. 以后直接双击「启动 Ariadne.command」。首次安装后的文件在 Application Support 中，原下载包可以留作启动入口；移动整个解压目录不影响已安装的数据。不要只移动其中的 command 文件。

保持服务终端打开；按 Ctrl+C 停止，资料不会删除。重复启动同版本会打开已有服务。8000 若被开发版或另一版本占用，会提示先停止原服务，不自动杀进程、不换端口。

这是未公证的本地测试包，macOS 可能提示无法验证开发者。确认下载来源及 SHA-256 后，按系统「隐私与安全性」的提示允许打开；不需要关闭系统安全保护。Windows、Intel Mac 与首次下载后的 Gatekeeper 流程未验收。

## 数据与模型

资料写入 `~/Library/Application Support/Ariadne Local/data`，版本代码分别保留在 `releases`。下载包不含旧工作区、私人材料、API Key 或 Codex 凭据。新安装不自动迁移开发版的磁盘资料；同一个浏览器与 localhost 地址可能保留旧的工作区映射，应保留旧项目并先明确迁移，不把新库的空白误认作删除。

API Provider 沿用原有配置和能力验证，连通不等于支持完整分析。模型调用仍需既有传输确认，结果由用户保存；不随启动器切换模型或修改推理强度。

## 可选：连接公开网页版

本地版不需要配对。以后使用公开网站时，可双击「连接网页版.command」，输入准确的 HTTPS 来源（默认 `https://ariadne.kai-nex.com`），将终端配对码填入网站。配对五分钟有效、一次性，连接器退出即撤销；公开 HTTPS 本地网络权限仍需网站实际部署后验收。

## 构建与发布

`scripts/build_local_package.py --python <独立Python根目录> --codex-dir <已校验的Codex目录> --publish-local` 每次产生独立版本并保留旧产物；`public/downloads/latest.json` 指向本机可下载的 ZIP。大型 ZIP 与运行时不提交 Git；部署公开网站时需要另外发布 ZIP、校验文件和 metadata，未发布时页面明确显示尚无可下载版本。

源代码通过 Git 跟踪文件的目录白名单收集，仅包含 app.py、src、public 和 data 中的公开契约；不复制运行数据。Codex 来源与官方发布 SHA-256 写入 release.json，Python 与 Codex 许可证随包保留。当前包的静态生成与本机验收不等于新电脑、公网下载或所有 Provider 的真实模型验收。
