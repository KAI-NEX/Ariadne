# Ariadne 官网

独立的 React / Vite / Tailwind CSS 展示站，包含首页、介绍、网页版、下载四个区块。应用仍在原 `public/` 入口，官网不加载应用脚本、读取工作区、访问个人资料或调用 Provider。

```sh
cd website
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm preview
```

开发预览默认 `http://127.0.0.1:5173/`；静态发布产物在 `website/dist/`。`base: './'` 支持独立域名或子目录静态预览；构建保留既有输出。依赖与构建产物不提交，源码与 lockfile 提交。必须从仓库内构建，因为共用 VI 源在 `public/vi/`。

## 内容与发布边界

- 参考用户提供的 Foldcraft 视频、布局和动效规格，替换为 Ariadne 中文文案；使用原始远端视频，不加色彩遮罩。Geist 承担官网英文/数字，中文走现有系统黑体回退；字标保留 Recursive。
- 四个原生锚点可直接链接，固定导航跟随当前区块；手机菜单支持 Escape、焦点循环、背景 inert、点击收起和跨桌面断点收起。
- 视频支持自动静音循环、手动暂停与减少动态效果；网络或视频失败时保留深色背景和完整文案，隐藏失效播放按钮。
- 当前网页版域名 `web.ariadne.kai-nex.com` 尚未解析，公开页不放死链；仅 localhost/127.0.0.1/IPv6 loopback 预览显示本机 8000 工作区入口。当前没有独立公开安装包，下载区明确说明状态，不将本机启动器冒充安装包。
- 后续有独立上线授权并验收 Web 应用后，在 `WebSection` 中切换为已确认的稳定 Web URL。安装包有实际可分发版本后再提供真实下载及系统要求。
- 本阶段没有发布、修改 DNS、push 或更换运行中的应用；官网预期域名仍为 `ariadne.kai-nex.com`。

视频来自用户提供的 CloudFront URL，字体来自 Google Fonts；均依赖网络，未复制到工作区。字体加载失败使用无衬线回退。跨平台字体及公网部署需要另行验收。
