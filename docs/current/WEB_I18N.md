# Ariadne Web 中英文界面

更新：2026-09-21。

## 当前行为

- 公开 Web 仅在连接设置首页的底部中央显示 `EN/中`；进入工作空间及后续页面后不再重复显示。点击后在简体中文与英文之间切换，选择保存在当前浏览器的 `ariadne.ui.locale.v1`，同一 Web origin 内跨页面保持。
- 页面标题、导航、表单、说明、弹窗、空状态、加载/失败/重试、附件、模型选择、资料审核和投递阶段等产品文案共用 `public/i18n.js`。运行时新增的界面节点由同一语言层处理。
- `html lang` 随选择更新为 `zh-CN` 或 `en`；可访问名称、placeholder、title、图片替代文字和产品 metadata 同步切换。
- Web 与 Skill 共用页面源码，但语言按钮只由 Web 连接设置首页的显式页面标记创建；Skill 和其他页面均不显示。本阶段不改变 Skill 的单语言入口，也不改变 Web/Skill 的存储与模型边界。

## 内容边界

- 只翻译 Ariadne 产品界面。用户上传的材料、职位原文、保存的个人补充、模型历史回复和用户自定义卡片内容保持原文，不因界面语言切换而改写。
- 英文模式下，预设快捷问题及产品自动生成的附件提示使用英文。已存在的用户/模型历史按原语言显示。
- 当前可执行 Skill 调用 `$ariadne 打开 Ariadne` 保持原样，避免把展示翻译成无法执行的命令。
- 切换语言只读写浏览器本地偏好，不发出网络请求，不修改确认资料或来源文件。

## 验收

- `tests/i18n_regression.mjs` 覆盖共用脚本接线、核心固定/计数翻译、未知个人内容不改写、Web/Skill 显示边界及无网络调用。
- 相关 Runtime、ProductShell、附件、个人理解、职位概况、投递状态与全局交互回归通过；VI 检查及负向门禁通过。
- egolite 实际检查 Web 中文→英文→中文、跨页偏好、添加模型弹窗、模型菜单及主要页面英文空状态；390 px 下 9 个主要页面无横向溢出，按钮保持 44 px 点击高度。桌面与窄屏截图保存在 `.cache/i18n-20260921/`。
- 2026-09-21 后续修复英文 minibar：tooltip 同时采用翻译后文字测量和内容固有宽度，避免 `Personal Profile`、`Connection Settings` 等较长英文被裁切或侵入导航 rail；701 px 与 920 px 检查四个英文标签完整，390 px 首页按钮水平居中且内页按钮数量为零。证据保存在 `.cache/i18n-minibar-20260921/`。
- 2026-09-21 已从源码提交 `74b1f9d` 发布 Cloudflare Pages 生产部署 `5a893081-8199-4309-a896-bb967e77fa07`（`https://5a893081.ariadne-7pc.pages.dev`），正式域名继续使用 `https://ariadne.kai-nex.com`。本次只更新 Pages，API Worker、Service Binding 和 DNS 未变更。
- 正式域名检查根页、`/i18n.js?v=1`、`/healthz` 与 `/api/web-runtime` 均为 HTTP 200；egolite 完成中英往返、跨页保持，并在 390 px 下检查 16 个当前 Web 页面，英文标题、语言属性、切换按钮和横向布局均通过。证据保存在 `.cache/web-i18n-publication-20260921/`。
- 2026-09-21 minibar 与按钮位置修复从提交 `c2c3a3b` 发布为 Pages 生产部署 `38b616f1-4923-49a9-b39b-8bbf808fa5f3`（`https://38b616f1.ariadne-7pc.pages.dev`）。正式域名再次验证中文→英文切换、390 px 首页按钮中心偏差为 0、内页按钮数量为 0，920 px 下 `Connection Settings` 与 `Personal Profile` 文字均完整留在 tooltip 内且不覆盖 rail；静态资源与隔离发布包逐字节一致。API Worker 与 DNS 未变更。
- 本阶段未调用真实模型、未发送个人材料；英文模型回答语言仍由当前问题、上下文和模型行为决定，不改写既有回复。
