# Ariadne 网页 + Skill

更新：2026-09-20。默认交付方向改为网页 + 可在 Codex 直接打开的本地 Skill；保留旧 Mac App、源码和资料。本阶段完成本机安装、独立 ZIP、发布构建与本地浏览器验收；未发布新的公网下载页，未覆盖另一台电脑或公网 HTTPS 的首次本地网络授权。

## 用户体验

默认：在 Codex 调用 `$ariadne` → 自动检查依赖 → 打开本地运行选择页面 → 选择 Codex/API/Local → 进入完整工作空间。本地同源使用无需配对码。

可选：要求「连接公开网页版」时才启动 8765 配对通道，输入一次性码并同意连接；适合继续使用公开网站中的浏览器资料。

Skill 有网页界面，不是仅输出分析文字。网页仍负责来源归档、Working/Proposal、人工确认和保存版本。Skill 启动的本地服务负责将本次确认的请求交给用户自己的 Codex；不把当前 Agent 的历史、工具或文件系统控制权开放给网页。无需 Ariadne.app，但服务须保持运行；模型推理仍由 OpenAI 提供，使用该用户账号额度。

## 安装与调用

发布构建产生 `Ariadne-Skill.zip` 和 SHA-256 文件。解压得到完整 `ariadne/`，内有 `SKILL.md`、`agents/openai.yaml`、启动脚本、含完整页面的 `runtime/`、逐文件 hash 和许可证。将整个文件夹交给 Codex，请它安装为 Ariadne Skill；已有同名技能时保留原件并先核对，不覆盖未知安装。不要只复制 `SKILL.md` 或脚本。

Codex 本机用户技能通常位于 `~/.codex/skills/ariadne`；支持 `.agents/skills` 的 Agent 也可使用其文档指定位置，但必须验证该 Agent 的执行环境。安装后调用 `$ariadne`；若尚未发现新技能，重开任务或重启 Codex。首版仅复用 Codex adapter，不声称任何 Agent 装上都能运行。

开发者可从源码执行，无需构建或安装 App：

```sh
python3 skills/ariadne/scripts/ariadne.py open
# 可选：只检查环境，或连接公开网页版
python3 skills/ariadne/scripts/ariadne.py doctor
python3 skills/ariadne/scripts/ariadne.py connect
```

默认本地页面固定为 `http://127.0.0.1:8766/`，与旧 8000/原 App/公网数据隔离，Agent 用 Codex 浏览器面板打开脚本返回 URL。macOS 的资料写入 `~/Library/Application Support/Ariadne Skill`，其他 POSIX 写入 `~/.local/share/ariadne-skill`；升级代码不会覆盖资料。缺少 Codex/PDF 依赖时仍允许打开 Local，但不启用 Codex。`--port` 与 `--data-dir` 只用于明确指定的环境与隔离验收，不自动换端口。

可选公开网页配对默认只允许 `https://ariadne.kai-nex.com`。开发验证可传 `--origin http://127.0.0.1:端口`。Agent 根据脚本返回的 `url` 打开网页，不在 URL 中携带配对码。配对码五分钟有效、只能使用一次；连接授权最长八小时，沿用精确 Origin/Host、token、路由白名单和既有撤销行为。

## 环境与数据

- Python 3.9+、POSIX 环境、用户已登录的兼容 Codex CLI、Poppler 的 `pdftoppm` 和 `pdfinfo`。不携带 Apple arm64 二进制；Intel Mac、Linux 仍需各自的实际验证，原生 Windows 暂不支持。
- `doctor` 仅检查运行时代码完整性、依赖可执行、CLI 所需参数和登录状态，不读取认证文件、自动登录、改变配置或请求模型。通过检查不等于完成图片/PDF 模型资格认证；继续使用既有 capability authority 和 adapter。
- 网页配对原件读取复用 `src/web_source_read.py`：图片保持原图，PDF 完整逐页转图并返回页数，文本/DOCX 使用已有技术准备。不调用 Apple OCR 冒充跨平台语义理解；hash 不一致、缺页或无法处理时明确失败。
- 本地 Skill 的资料位于独立磁盘库，公开网页资料在浏览器库；旧 App、Skill 与公开网页不自动同步。安装不迁移、不复制个人材料、凭据或浏览器状态。
- 本地页面固定监听 `127.0.0.1:8766`，可选配对连接器为 `127.0.0.1:8765`。端口冲突报告失败，不结束旧进程、换端口或接管已有服务。Ctrl+C/SIGTERM 撤销配对并退出；已发送到 OpenAI 的请求不保证取消或停止额度消耗。现有 App 不受影响。

## 构建与发布

```sh
python3 scripts/build_skill_bundle.py
python3 scripts/build_cloudflare_release.py --pdfjs /path/to/pdfjs-dist-5.4.624 --output /new/output/path
```

独立构建在 `.cache/skill-distribution/<时间>/` 保留源码包和 ZIP。Cloudflare 构建从当前公开源码白名单生成同款包，并将 ZIP、SHA-256 和 `downloads/skill.json` 放入 Pages；不复制本机已安装技能。下载页只在 metadata 和实际文件大小有效时显示入口。原 Mac App 下载 metadata 与 Release 保留在历史区。

Skill 包只含 Git 跟踪的运行源码、公开契约和完整公开网页资源，附启动脚本；不含 Python/Codex/Poppler 二进制、运行库、私有数据或登录文件。`runtime-files.json` 验证附带运行代码，外部 ZIP 完整性以独立 SHA-256 为准。不是代码签名或发行商身份认证。

## 本阶段验收

- 包含 `4b49193` 的页头对称布局，以及 `5063d20` 的两个资料库「编辑 / 完成」与卡片删除、职位生命周期、Markdown 库升级契约；直接从同一当前 checkout 构建，不维护第二份业务代码。
- 完整包本地启动到运行选择页面，在 Codex 内置浏览器进入工作空间，确认两个资料库编辑入口；本地无需配对。独立原件写入、错误版本拒绝、退出后重开保留、缺少 Codex/PDF 时仅禁用 Codex 的回归通过。

- 独立 ZIP 解压、逐文件完整性、损坏拒绝、缺依赖/登录/CLI 协议失败、端口冲突、启动/配对/撤销/退出回归。
- 实际本机 CLI 环境检查；egolite 在独立 loopback origin 下载完整 ZIP 并校验、配对后显示 GPT Sol、断开后授权失效、错误码失败；下载页桌面与 390px 布局检查。页面截图和下载证据保存在 `.cache/skill-distribution/`；浮窗中途动画截图只作过程记录，不作为视觉验收依据。
- 原件读取覆盖图片无 Apple OCR、PDF 完整页 manifest、hash 失败；既有 Codex transport/六类 runtime 描述符、Web 隔离、下载与 VI 回归。真实 PDF 渲染与模型语义质量分别记录，不将离线替身当真实模型。
- 本轮无真实模型请求、私人材料传输、公网发布或 Git push；正式 HTTPS 首次授权和另一台电脑首次安装仍待验收。
