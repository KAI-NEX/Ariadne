# Ariadne 网页部署

目标入口：`https://ariadne.kai-nex.com`。2026-09-17 用户确认直接进入模型选择与应用；取代此前官网与 `web` 子域拆分方案。DNS 由腾讯管理，目前没有已选服务器。此文档与部署文件不表示已上线。

## 当前网站如何运行

- 原生页面 + 独立 Python WSGI 入口 `web_app.py`。首页仍先选模型或本地运行，点击继续进入工作空间。
- 网页资料、原件、确认版本与对话保存在当前浏览器；不开放本机磁盘工作区、SQLite、Keychain、旧导入路由或服务器 Codex。HTTPS 域名确定后应保持稳定；本机、预览域名和正式域名的数据彼此独立。
- DeepSeek 使用用户自己的 Key；六个领域执行复用现有能力 authority、校验、来源和人工保存契约。发送前仍需用户确认。Key 与请求原件只在请求内存/处理临时目录中使用，不写入持久存储；PDF 临时文件在处理结束后清理。结果在服务器内存短暂缓存，用于同次导入重试。
- 浏览器随机会话与请求 Key 摘要共同隔离幂等、取消和删除状态；Key 变化也隔离。最多 32 个活跃命名空间，空闲 30 分钟后在后续请求时清理，正在执行的状态不清理。每个导入 registry 最多 128 个操作、1 MB 结果缓存，超预算保留回执、拒绝自动重复付费执行。服务重启清空临时状态，浏览器资料不受影响；不要自动重试模型 POST。
- Codex 留在用户自己的电脑。网页用配对码连接本机连接器，默认来源改为 `https://ariadne.kai-nex.com`；没有配对就不把 Codex 材料发送至网站服务。HTTPS 下的本地网络访问仍须在正式域名上线后实测。
- 仅开放已经适配的 DeepSeek；Gemini/Qwen 不因部署而开放。文本、图片、PDF、简单 DOCX 走原有领域边界；网页 Job 的复杂 Word 内嵌图像要求导出 PDF，避免悄悄丢图。PDF 在 Linux 使用 Poppler 完整逐页转图，最多 48 页、长边 2048 像素、40 MB 图像输出；超限拒绝整次处理，不截断。网页请求正文上限 41 MB（约 30 MB 原件及上下文）；本机既有上限不变。

## 先在本机看网站版本

开发预览（不用于公网）：

```sh
python3 scripts/preview_web.py --port 8081
```

用 Chrome / Edge 打开 `http://ariadne.localhost:8081/`。`.localhost` 指向本机，页面按网页模式使用浏览器内容库。当前端口若已占用，换一个未占用端口；不要停止身份不明的服务。

生产入口使用 Gunicorn 26.2.0，而非把 `app.py` 的本机 HTTP 服务暴露到公网：

```sh
python3 -m venv .venv-web
.venv-web/bin/pip install -r deploy/requirements.txt
ARIADNE_WEB_ORIGINS=https://ariadne.kai-nex.com .venv-web/bin/gunicorn --config deploy/gunicorn.conf.py 'web_app:create_app()'
```

必须由 HTTPS 反向代理或托管平台接入。`ARIADNE_WEB_ORIGINS` 只填准确来源，临时预览域名可用逗号加入；禁止 `*`。没有配置来源时拒绝启动。不要设置开发者 API Key、Codex 登录目录或用户资料卷。

## 部署到支持 Docker 的服务器

仓库提供单实例部署：Caddy 自动 HTTPS，请求头读取限时 10 秒、上传正文限时 120 秒；Gunicorn 单进程八线程、最多两个重处理请求；容器只读、非 root，临时目录有界。当前内存任务状态要求**一个进程、一个副本**；不能直接增加 workers 或副本数，否则重试与取消失去同一状态。需要扩容时再增加共享执行状态。

1. 准备有公网地址、可访问模型服务的 Linux Docker 主机，或支持 Dockerfile、长请求和至少约 1.5 GB 内存的托管服务。最终费用、地区与账号由用户选择；本阶段不购买资源。
2. 用下列命令导出公开代码与可选本地下载包。不会复制开发者数据库、工作区、Keychain 或 `.codex`：

```sh
python3 scripts/build_web_release.py --include-local-package
```

3. 将生成目录上传到服务器。若使用 Docker Compose，在目录中运行：

```sh
docker compose -f deploy/compose.yaml up -d --build
```

4. 在云控制台只开放 80/443。8080 只在容器网络中提供服务。Caddy 默认不记录请求访问日志；不要增加请求体、Key、Cookie 或 Authorization 日志。若添加 CDN/WAF，API 不缓存、不记录正文，保持 Host 与 Origin。
5. 先检查首页、`/healthz`、Local 原件保存与恢复，再由用户用自己的连接验证模型。网页 URL、API 转发及 TLS 验收通过后才对外提供链接。

托管平台如已经提供 HTTPS，可以直接使用 Dockerfile，不额外运行 Caddy；设置平台端口为 8080、来源为准确的 HTTPS 域名，单副本。不要使用只托管静态文件的平台来声称六条 Python API 已可用。

## 腾讯 DNS 如何填写

在腾讯云 DNSPod 中选择已有的 `kai-nex.com`，添加 **主机记录 `ariadne`**。域名大小写不影响解析，统一使用小写。

| 获得的部署目标 | 记录类型 | 记录值 |
| --- | --- | --- |
| 云服务器公网 IPv4 | A | 服务器实际公网 IP |
| 托管平台提供的目标域名 | CNAME | 平台实际给出的目标域名 |

记录值不填 `https://`、路径或 `127.0.0.1`，也不要凭空填写服务器地址。同一主机记录不要同时配置互相冲突的 A/CNAME。使用托管平台时先把 `ariadne.kai-nex.com` 添加为自定义域名，并按平台实际要求补齐验证记录；使用 Compose 时，DNS 指向服务器并开放 80/443 后，Caddy 申请证书。暂不修改现有 DNS。

参考：[腾讯云主机记录和记录值](https://intl.cloud.tencent.com/zh/document/product/1295/77014)、[Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)、[Gunicorn 部署](https://gunicorn.org/deploy/)。选择服务地区前核对相应平台的域名接入条件；本文不预设购买、备案或账户操作已完成。

## 发布验收边界

本机回归、合成 Provider 替身和真实浏览器预览只能证明实现与边界。没有云账号/服务器就没有公网地址；没有真实 Provider 运行就不声称新域名模型质量已验收。正式上线还需实际 Linux 镜像启动、HTTPS、用户自带 Key 的图片/完整 PDF、下载 hash、Codex 本地网络授权及两个浏览器的资料隔离验证。
