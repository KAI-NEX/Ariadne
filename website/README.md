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

## 动画与素材（当前：原画面融合循环）

保留最初视频的鱼群、色彩、水窗与光影。原视频不只是结尾有跳变：第 119 帧（约 4.958 秒）已有一次内部硬切。原片同字节保存为 `public/media/ariadne-original.mp4`；当前首页使用 `public/media/ariadne-original-blend-v1.mp4`。

编辑只选取内部硬切前的 0–118 帧，尾部与开头用 24 帧 smoothstep 柔和叠化，输出 1920×1080 / 24 fps / 95 帧（约 3.958 秒）。最后一帧接回自然相邻的原帧，没有内部硬切或文件末尾直接跳回。叠化期间两组原画面会短暂重叠；这是保留原素材的柔和融合，不宣称每条鱼的独立物理轨迹闭合。全程正向播放，无鱼身几何变形、倒放或三维替换。

`LoopingScene.jsx` 使用原生 `autoPlay muted loop playsInline`；没有暂停按钮或减少动态效果自动暂停，重新可见及前台意外暂停时恢复播放，不重置 currentTime。浏览器后台或系统挂起仍由平台控制。

复现：`python scripts/prepare_original_loop.py SOURCE OUTPUT WORKDIR`，依赖 numpy、opencv-python-headless、imageio-ffmpeg；脚本针对这份素材的已核验切点，不作为通用自动剪辑器，并拒绝覆盖已有输出。原片、光流变形试片、三维试制和历史 QA 全部原地保留，当前构建只引用选定融合素材。运动对齐试片出现变形，未用于页面。

桌面保留 70% 水平构图，手机 85%；水窗留在导航下方，透明导航、中英切换、三页结构与淡入淡出保持。生产页面无 Three.js 运行依赖。

## 验证与范围

- 检查整段原视频及输出所有帧：鱼群区域最大相邻变化从内部硬切的 18.63 降至 4.94；循环接缝变化为 2.30，处于正常相邻帧范围。
- Vite 生产构建、VI 静态/负向和 diff 检查；egolite 实际浏览器检查整圈及连续循环。
- 原片与历史试制在原目录保留，新证据在 `.cache/website-flow-loop-20260914/`。没有发布、push、域名修改、模型调用或资料读取；真实手机硬件及公网加载未测。
