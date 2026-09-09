# 参与 Ariadne

使用 Python 3.11+ 和 Node.js 20+。从 [README](README.md) 启动本机实例；图片/PDF 的完整路径与平台条件见 [Codex 指南](docs/current/CODEX_RUNTIME_CONNECTOR.md)。

1. 先读 [项目约束](AGENTS.md) 和相关 `data/` 领域契约。
2. 使用合成数据复现问题；不要提交自己的简历、真实职位抓取、API Key 或浏览器存储。
3. 保留 Local 零模型调用、来源完整性、领域/版本校验和人工保存边界。普通对话不能改写确认数据。
4. 运行 `python3 scripts/run_regressions.py`；视觉变化还需 `python3 scripts/check_vi.py` 和实际浏览器验证。测试日志只留 `.cache/`。
5. PR 说明问题、变化、验证和限制。公开 Issue 不含凭据；安全问题通过私密漏洞报告提交。

VI token 与图标源在 `public/vi/manifest.json`；通过 `python3 scripts/build_vi.py` 生成，不直接编辑生成资源。

项目以 MIT 开源；提交贡献时，请确保有权以该许可提供内容。Codex/OpenAI 与其他 Provider 是第三方服务，账号、额度和服务条款独立于本仓库。
