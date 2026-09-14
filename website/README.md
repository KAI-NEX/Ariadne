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

## 动画与素材（当前：精简叠映循环）

保留最初视频的鱼群、色彩、水窗与光影。原视频第 119 帧（约 4.958 秒）含内部硬切；同字节原片保存在 `public/media/ariadne-original.mp4`。当前首页只引用 `public/media/ariadne-original-blend-v2.mp4`。

新版选取 25–118 帧，尾部 103–118 帧与开头 25–40 帧用 16 帧 smoothstep 叠映，随后自然衔接第 41 帧。输出 1920×1080 / 24 fps / 78 帧（3.25 秒）。两端鱼群分布更接近，叠映从上一版 1 秒缩短到约 0.67 秒；两幅画面都保持原速度正向播放，鱼与光影一起处理，不改变鱼身几何。固定裁切、透明导航、三页及中英内容保持。

用户试看后选择保留叠映。本次没有采用正反播放试片；原片、上一版叠映、正反播放、光流与三维试制及 QA 全部原地保留。有限原片不能保证每条鱼都沿闭合路径游动，过渡仍有短暂淡入淡出；优化目标是减少大范围双影和接缝突变。

`LoopingScene.jsx` 使用单个原生 `autoPlay muted loop playsInline` 视频。过渡已合成在同一 MP4 中，没有双视频切换、每圈更换 src、重新挂载或主动 load()；没有暂停按钮或减少动态效果自动暂停，重新可见及前台意外暂停时恢复播放，不重置 currentTime。浏览器后台和系统挂起仍由平台控制。

复现（依赖 numpy、opencv-python-headless、imageio-ffmpeg）：

```sh
python scripts/prepare_original_loop.py public/media/ariadne-original.mp4 OUTPUT WORKDIR --start-frame 25 --overlap 16
python scripts/check_original_loop.py public/media/ariadne-original.mp4 public/media/ariadne-original-blend-v2.mp4 --start-frame 25 --overlap 16 --reference-loop public/media/ariadne-original-blend-v1.mp4
```

编辑脚本针对这份素材的已核验切点，并拒绝覆盖已有输出；省略新参数仍可复现上一版。桌面保留 70% 水平构图，手机 85%；生产页面无 Three.js 运行依赖。

## 验证与范围

- 检查整段原视频及输出所有帧：原片内部硬切的鱼群区域相邻变化为 18.63，新版整段峰值 5.04、循环接缝 2.35，接缝处于普通相邻帧范围；缩短叠映后的峰值与上一版差异小于 10%。
- Vite 生产构建、VI 静态/负向和 diff 检查；egolite 实际浏览器检查整圈及连续循环。
- 原片与历史试制在原目录保留，新证据在 `.cache/website-blend-refine-20260914/`。没有发布、push、域名修改、模型调用或资料读取；真实手机硬件及公网加载未测。
