# Ariadne 官网

React / Vite / Tailwind CSS 展示站，当前为「首页、介绍、体验」三个独立视图，支持完整中英切换。官网不加载工作区脚本、读取个人资料或调用 Provider。

```sh
cd website
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm preview
```

开发预览 `http://127.0.0.1:5173/`；静态产物在 `website/dist/`。`base: './'` 支持独立域名或子目录。构建需要仓库共用的 `public/vi/`，不需要 Python 后端。既有输出原地保留，发布引用当前 `dist/index.html` 与其最新资源依赖；旧构建文件不作为当前运行依据。

## 页面与链接

- 点击导航才切换页面；没有滚动驱动的导航或 smooth scroll。沿用应用的 320 ms 淡出 / 420 ms 淡入，支持快速切换、前进/后退、hash 深链、页面焦点和旧 `#web/#download` 到体验页的兼容。小屏内容可在本页滚动，但不会滚动进入另一页。
- `[中/EN]` 切换全部页面、导航、标签、标题和描述，只在本 origin 的 `ariadne-website-language` 保存语言偏好。首页 slogan 为「看清自己，走向想去的地方。」/「From here to anywhere.」。
- 介绍页解释独立理解、来源与未知、用户决定和保存；底部链接 `https://github.com/KAI-NEX/Ariadne`，许可依据仓库 MIT LICENSE。
- 用户明确要求预接即将部署的 Web 入口：`https://web.ariadne.kai-nex.com`。不再根据 loopback 环境替换成本机入口，也不阻断尚未解析的稳定域名。
- 体验页并列 Web 和本地使用；GitHub v0.1.0 当前没有独立安装包，下载使用真实 `https://github.com/KAI-NEX/Ariadne/archive/refs/heads/main.zip`，明确标注「下载源码 / Download source」及需要本机配置。准备好安装包后再更换真实下载 URL。

## 动画与素材

最终素材为 `public/media/ariadne-fish-loop-v4.mp4`，由用户提供的 8.04 秒 CloudFront 视频非破坏编辑：鱼群按连续位置跟踪，保留一条红白主鱼，其余做柔和多色调色，保持原水面和光束。输出 1920×1080 / 24 fps / 157 帧（6.54 秒）；1.5 秒首尾叠化，并在叠化中对齐主鱼，文件接缝接回连续源帧。**属于原片调色与叠化循环，不是重新生成鱼种或完整运动轨迹；衔接段可见短暂叠化。**

离线编辑脚本：`scripts/prepare_hero.py SOURCE WORKDIR OUTPUT`；需要 numpy、opencv-python-headless、imageio-ffmpeg。它针对这份构图与素材设置鱼群范围，不作为通用视频分割器。最终媒体显式 import，经 Vite hash 打包；`publicDir: false` 避免把保留的 v2/v3 试制素材自动复制到新构建。原片、试制视频、QA 和回执原地保留，不纳入发布源码。

首页导航无背景遮罩与 blur；视频给导航预留空间，手机另作构图，使水窗在标题下方。暂停/播放、字体回退与减少动态效果保留。无视频时仍呈现完整文字和导航。

## 本阶段验证与边界

- Vite 构建、VI 静态/负向检查、官网 CSS token 扫描与 diff 检查。
- egolite 桌面 1440×900、手机 390×844 和 320×640：中英页面、菜单关闭/键盘焦点、点击淡入淡出、滚动不换页、返回/快速切换、语言刷新、旧链接、下载/Web href、减少动态效果。
- 原视频从远端转为本站静态媒体。连续经过两次循环仍处于播放状态；后台浏览器的回调节流不用于声明帧率或无丢帧。静态输出另验证媒体解码及文件接缝。
- Web 入口是用户要求的待部署链接；不声称已上线。真实源码 ZIP 返回 200 / application/zip。没有发布、修改 DNS、push、模型请求或资料操作。
- QA 在 `.cache/website-v2-20260914/`，第一版与试制素材保留。外部字体来自 Google Fonts，其他系统字体和公网性能尚未验收。
