# v0.1.0 公开发布检查

日期：2026-09-09。范围：公开源代码、Git 历史、本机 HTTP 与 Codex 配对边界。维护者选择 MIT，并明确保留现有仓库与已核验历史。

## 发布内容

- 发布源代码、schema、合成测试、项目文档、MIT 许可和 CI。
- 不发布 `.env`、`.codex`、Codex auth、Keychain 内容、浏览器 profile、API Key、数据库、原件、私人导出或 `.cache`。
- 历史文档中的旧本机路径、设计文件标识及开发记录按维护者决定保留；它们不是运行所需配置，也不是访问凭据。

## 已执行检查

- Git 全部可达历史的 Gitleaks 8.30.1 扫描；官方发行文件校验 SHA-256。两条 generic-api-key 命中经复核为历史 Figma file key，不是认证秘密；`.gitleaksignore` 仅记录其完整 commit/path/rule/line 指纹，不扩大规则或目录白名单。
- 对全部可达 blob 与 commit metadata 追加凭据格式检查；对旧 PDF 提取文本复核。测试中的两种明确假凭据用于验证禁止秘密进入运行快照，公开文件检查只精确豁免这两个值及两个测试路径。
- 本机 HTTP 在 Codex 开启/关闭时均拒绝伪造 Host、跨站/opaque Origin 与跨站 API 请求；禁止目录列表、路径越界和指向私有文件的 symlink。连接器继续要求来源、短期 token 及领域 API 白名单；HEAD 不在允许列表。
- 干净初始化不依赖私有 JD seed。legacy 人工审阅回归改为临时合成数据库，不读取或改写使用者数据库。
- 78 项离线回归通过，包含新网络隔离测试；VI 静态门禁通过。真实 Codex 图片/PDF/领域及浏览器配对证据沿用此前已完成阶段，本次安全修改不重新发送材料到模型。

## 持续检查与限制

GitHub CI 使用固定 commit 的 Actions、只读权限、完整历史 checkout、离线回归、公开文件检查、VI 门禁与固定版本 Gitleaks；凭据不进入 workflow。发布时另行核对 GitHub CI、公开状态、secret scanning、push protection 与私密漏洞报告设置。

扫描与回归是针对已知格式和边界的证据，不是所有未来缺陷或所有第三方软件的安全保证。公开项目不启动作者电脑的公网服务；真正的 Web 托管、HTTPS 本地网络权限及其他平台完整材料路径需要单独验收。
