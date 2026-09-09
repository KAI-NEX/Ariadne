# 安全与本机隔离

## 报告问题

请使用仓库 Security 页的 **Report a vulnerability** 私密报告入口。不要在公开 Issue、PR、截图或日志中粘贴 API Key、Codex token、配对码或个人原件。

## 凭据与资料

- 仓库不提供作者的 API Key、Codex 登录或共享额度。每位使用者自行配置账号。
- Codex 登录由本机 CLI 管理；Ariadne 不读取/复制其登录 token。`local-codex://authenticated-session` 只是内部传输标识，不是有效凭据。
- 配对码与连接器 token 是独立、短期的访问授权，不是 Codex 凭据；不要分享。网页 token 仅放 sessionStorage，连接器仅保存 hash。
- `.env`、`.codex/`、`auth.json`、数据库、原件、个人导出和 `.cache/` 不进入 Git。不要使用 `git add -f` 上传这些目录。公开时必须检查历史，新增 `.gitignore` 无法移除历史泄漏。
- 当前部分 Provider 的 API Key 保存在使用者本地浏览器 localStorage；它不是加密密钥库，同一 origin 的 JavaScript 可以读取。不要把不可信脚本加入页面，也不要把浏览器配置/存储导出上传到仓库。
- 个人与职位资料保存在浏览器 IndexedDB；换 origin/profile 会使用另一个工作区。Model 模式会将确认范围内的材料发给选定 Provider，Local 模式不发出模型请求。界面当前从 Google Fonts 加载字体，因此 Local 不等于完全零网络请求。

## 网络边界

- `app.py` 只监听 `127.0.0.1:8000`，所有模式都校验准确 Host/Origin，拒绝跨站 API 请求。静态资源限制在 `public/` 内，禁止目录列表和越界 symlink。
- `scripts/run_codex_connector.py` 只监听 `127.0.0.1:8765`，另行校验精确 HTTPS 来源、一次性配对和 token，只开放明确列出的领域/技术准备 API。它不是 Codex 控制接口或通用代理。
- 不要把本机 Python 服务或连接器通过公网端口、反向代理、隧道或路由器映射公开。网站可以链接到这个开源仓库；公开 Web 前端部署是另外一项工作，不能以暴露作者电脑作为实现。
- 任何 Model 操作仍需合格的图片/视觉 PDF 模型与领域 adapter；失败不静默降级。Codex 请求以独立临时目录和 ephemeral CLI 会话执行，shell、插件、浏览器和其他工具关闭。
- 同一台电脑上的恶意软件、不可信浏览器扩展或用户主动分享 token 不在 loopback/Origin 机制的保护范围内。开源和安全检查不等于绝对没有漏洞。

## 断开与撤销

在连接弹窗点「断开本页连接」清除本页配对，在线连接器同时撤销此授权；要撤销所有网页访问，在连接器终端按 `Ctrl+C`。本机直连用户可切换到「本地运行」以停止后续 Codex 调用。已经发出的上游请求不保证立即停止。更多细节见 [连接器指南](docs/current/CODEX_RUNTIME_CONNECTOR.md)。

## 发布检查

运行 `python3 scripts/check_public_release.py`、`python3 scripts/run_regressions.py` 及 `python3 scripts/check_vi.py`。使用 Gitleaks 扫描全部 Git 历史；只允许精确、已复核的历史误报指纹。GitHub secret scanning/push protection 与 CI 提供后续防护，不替代人工复核。
