# 第一次部署 Ariadne：腾讯云 + ariadne.kai-nex.com

> 2026-09-18 新决定：先不购买服务器，使用 [Cloudflare Pages + Workers 免费部署](CLOUDFLARE_DEPLOYMENT.md)。下文保留为自有服务器的备选方法，本轮无需购买。

更新：2026-09-18。目标网址为 **https://ariadne.kai-nex.com**，直接显示模型选择页。当前只完成可部署代码和本机验证，没有购买服务器或修改腾讯 DNS。

下面以新建的 **腾讯云轻量应用服务器、新加坡、Ubuntu 24.04** 为例。新加坡在 [Gemini 官方支持地区](https://ai.google.dev/gemini-api/docs/available-regions) 中；这不替代用户账号资格、配额及实际调用验证。若使用其他云厂商，同样可部署 Docker 包，域名继续留在腾讯解析。

## 1. 准备服务器

打开[腾讯云轻量应用服务器控制台](https://console.cloud.tencent.com/lighthouse/instance)，选择创建实例。

| 项目 | 本项目的初始建议 |
| --- | --- |
| 地区 | 新加坡 |
| 镜像 | 系统镜像 → Ubuntu 24.04 LTS |
| CPU / 内存 | 至少 2 核 / 4 GB；当前服务单实例、最多同时处理两个重请求 |
| 磁盘 | 40 GB 或以上，保留镜像与版本空间 |
| GPU | 不需要，模型在用户选择的 API 服务或自己的 Codex 中执行 |
| 购买时长 | 初次验证可先按月，实际价格和库存以控制台为准 |

创建后记下 **公网 IPv4**，设置 Ubuntu 用户的 SSH 密钥或登录密码。不要把 SSH 私钥、服务器密码或 API Key 发到聊天里。[腾讯创建实例说明](https://cloud.tencent.com/document/product/1207/44548)；[Ubuntu 默认使用 ubuntu 登录](https://cloud.tencent.com/document/product/1207/44578)。

## 2. 放通访问端口

实例详情 → 防火墙，保留 SSH 登录方式所需规则，并添加：

| 协议 / 端口 | 来源 | 用途 |
| --- | --- | --- |
| TCP 22 | 你的公网 IP；若使用腾讯控制台登录，按其实际来源要求配置 | 管理服务器、上传包 |
| TCP 80 | 全部 IPv4 | HTTPS 证书验证与跳转 |
| TCP 443 | 全部 IPv4 | 网站 HTTPS |
| UDP 443 | 全部 IPv4，可选 | HTTP/3 |

应用 8080 和本机预览 8081 不需要对公网开放。若系统防火墙也已启用，同样允许以上所需端口，不要关闭整个防火墙。见[腾讯防火墙说明](https://cloud.tencent.com/document/product/1207/44577)。

## 3. 上传最新部署包

使用本次交付的 `.tar.gz`，不要把整个 Ariadne 工作目录上传。部署包已经排除个人工作区、数据库与凭据，并包含本地版下载文件。

在 **Mac 的终端**执行。把引号内路径替换为实际部署包完整路径，把 `SERVER_IP` 替换为刚才的公网 IPv4：

```sh
scp "/完整路径/部署包.tar.gz" ubuntu@SERVER_IP:~/ariadne-web.tar.gz
ssh ubuntu@SERVER_IP
```

如果使用 SSH 密钥，在 `scp` 和 `ssh` 后分别加 `-i "/私钥完整路径"`。首次连接核对服务器指纹；密码输入时终端不会显示字符。

连接成功后，以下命令都在 **服务器终端**运行。首次安装目录 `~/ariadne-release` 应尚不存在；已有部署时使用新的版本目录，不覆盖旧包：

```sh
mkdir ~/ariadne-release
tar -xzf ~/ariadne-web.tar.gz -C ~/ariadne-release --strip-components=1
cd ~/ariadne-release
```

## 4. 安装 Docker 并检查配置

```sh
sudo sh deploy/install-docker-ubuntu.sh
sudo docker compose -p ariadne -f deploy/compose.yaml config --quiet
sudo docker compose -p ariadne -f deploy/compose.yaml build
```

安装脚本只支持新 Ubuntu 24.04；已有 Docker 时只检查 Compose，不卸载已有容器软件。它使用 [Docker 官方软件源安装步骤](https://docs.docker.com/engine/install/ubuntu/)。若构建报错，先处理错误，再做下一步。

不需要填写你的 DeepSeek、Gemini 或千问 Key。用户各自在网页连接，服务器也不需要登录你的 Codex。

## 5. 在腾讯 DNSPod 绑定域名

打开 [DNSPod 控制台](https://console.cloud.tencent.com/cns)，进入 **kai-nex.com → 解析记录 → 添加记录**：

| 字段 | 填写内容 |
| --- | --- |
| 主机记录 | `ariadne` |
| 记录类型 | `A` |
| 线路 | 默认 |
| 记录值 | 服务器实际公网 IPv4 |
| TTL | 保持控制台默认值 |

不要填 `@`、`www` 或完整域名，不改现有主站记录。若已经存在 `ariadne` 的 A/CNAME/AAAA，先核对它指向的现有服务，只调整这个子域名的冲突记录；不要添加未配置服务器 IPv6 的 AAAA。[腾讯 A 记录说明](https://cloud.tencent.com/document/api/302/3449)。

回到 **Mac 的终端**检查：

```sh
dig +short ariadne.kai-nex.com A
```

返回值应为本次服务器公网 IP。解析缓存更新需要时间，未一致时暂不要把域名发给别人。

## 6. 启动网站和自动 HTTPS

在 **服务器终端**、`~/ariadne-release` 内执行：

```sh
sudo docker compose -p ariadne -f deploy/compose.yaml up -d
sudo docker compose -p ariadne -f deploy/compose.yaml ps
sudo docker compose -p ariadne -f deploy/compose.yaml logs --tail=60 https
```

DNS 已指向服务器且 80/443 可达时，Caddy 自动申请、续期证书，无需另买证书。[Caddy 自动 HTTPS 条件](https://caddyserver.com/docs/automatic-https)。不要反复删除证书卷或换 Compose 项目名。

在 Mac 检查：

```sh
curl -fsS https://ariadne.kai-nex.com/healthz
curl -fsS https://ariadne.kai-nex.com/api/web-runtime
```

第一条应返回 `ok: true`、`mode: web`；第二条的 `byok` 应包含 `deepseek`、`gemini`、`qwen`。打开网址后，每次从模型选择开始。

## 7. 用自己的连接做上线验收

1. 先选本地运行，保存一份无隐私测试材料，刷新后应能恢复。
2. 添加模型：Gemini 使用 Google AI Studio 的 API Key；千问使用百炼**北京地域** API Key；DeepSeek 使用 DeepSeek API Key。网页账号订阅不等于 API 额度。
3. 点击“同意验证并连接”。Gemini/千问将完整渲染并发送固定两页测试 PDF，验证两页读图和 JSON；会产生少量 API 费用，不会发送个人材料。失败时保留原运行选择，不自动换服务。
4. 再用合成图片、两页 PDF 做个人资料与职位导入，检查引用和所有页面；测试对话及人工保存。连接验证成功不能单独证明业务回答质量。
5. 用另一独立浏览器检查没有共享 Key 或资料。网页数据保存在各自浏览器，清空浏览器站点数据不会从网站服务器自动恢复。
6. 需要 Codex 时下载本地包，完成“登录 Codex”，启动“连接网页版”，在正式网页输入配对码；若浏览器要求本地网络访问许可，由用户确认。正式 HTTPS 配对必须在实际设备上验证。
7. 检查下载页显示的包 SHA-256 与下载文件一致，再向其他人分享正式网址。

## 常见问题与后续更新

- 网页打不开：检查域名 A 记录、80/443、防火墙和 `docker compose ... ps`。
- HTTPS 没准备好：看 `https` 容器日志；核对是否有旧 AAAA、其他服务占用 80/443，以及域名证书限制。
- 网页打开但连接模型失败：核对 Key 所属平台、千问地域、API 配额和服务器到 Provider 的网络；界面会给出失败。Gemini 是否可用还取决于 Google 的账号与地区要求。
- 更新代码：上传新包到新的版本目录，再用相同 `-p ariadne` 运行 `up -d --build`。保留旧版本与证书卷，不执行 `down -v`。更新会清空服务器临时执行缓存，应等用户正在进行的分析完成。
- 目前保持一个 Gunicorn 进程、一个服务副本。浏览器存储不因重启改变；在引入共享执行状态前，不通过增加 workers 或副本扩容。

这些命令是部署指南，尚未在你的云服务器执行。Docker/Linux、正式 HTTPS、自带 Key 真实模型和公网 Codex 配对需要在上述步骤中实际验收。
