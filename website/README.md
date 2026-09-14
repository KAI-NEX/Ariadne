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

## 动画与素材（当前：8.5 秒循环，约 3 秒叠映）

当前首页使用 `public/media/ariadne-original-soft-loop-v2.mp4`，保持原鱼群、水窗和光影。用户先将一圈调到 8.5 秒，再要求延长淡入淡出；因此沿用已有无损慢动作中间片，将叠映从 16 帧扩至 72 帧，使用起止斜率为零的 smoothstep 曲线。

成片 1920×1080 / 24 fps / 205 帧，媒体时长 8.541667 秒。`LoopingScene.jsx` 在元数据就绪及重新可见时按 `duration / 8.5` 设置速度（约 1.005 倍），让页面实际周期保持 8.5 秒。其中约 5.51 秒为连续游动，约 2.99 秒为渐入渐出的叠映，比上一版约 0.52 秒的过渡更舒缓。延长叠映也意味着双影存在更久，不宣称每条鱼的独立运动路径物理闭合。

中间片来自原片 25–117 帧（118 帧仅作补间前瞻），相邻原帧之间补间后以约三分之一速度播放。补间不跨原片内部硬切或首尾叠映，保留原始时间锚点；不是重新生成鱼群，也不是原始拍摄的新帧。当前仅重新合成叠映，不重复估计运动。原始 193 帧视频保存在 `public/media/ariadne-original.mp4`，第 119 帧已有内部硬切，持续避开该切点。

页面使用单个原生 `autoPlay muted loop playsInline` 视频。没有双视频切换、每圈更换 src、重新挂载或主动 load()；没有暂停按钮或减少动态效果自动暂停，重新可见及前台意外暂停时恢复播放，不重置 currentTime。浏览器后台和系统挂起仍由平台控制。

复现（依赖 numpy、opencv-python-headless、imageio-ffmpeg）：

```sh
python scripts/prepare_slow_loop.py public/media/ariadne-original.mp4 OUTPUT WORKDIR --overlap 72
python scripts/check_slow_loop.py public/media/ariadne-original.mp4 public/media/ariadne-original-soft-loop-v2.mp4 WORKDIR/slow-shot.mkv --overlap 72 --loop-seconds 8.5 --expected-blend-seconds 3
```

已有无损中间片时，可加 `--intermediate PATH/slow-shot.mkv` 跳过重复补间；检查命令也使用同一路径。脚本拒绝覆盖源和已有输出；默认 16 帧参数保留旧版复现。原片、试片、无损中间片和 QA 全部原地保留。桌面 70% / 手机 85% 构图、透明导航、三页及中英内容不变，生产页面无 Three.js 或运行时补间依赖。

## 验证与范围

- 媒体回归检查帧数、8.5 秒播放目标、约 3 秒叠映、原帧时间锚点、无定格帧及循环接缝。
- Vite 生产构建、VI 静态/负向和 diff 检查；egolite 实测有效播放时长、连续循环及无暂停或重新加载，保留浏览器视频帧及运行记录作为动画证据。
- 新证据在 `.cache/website-soft-loop-3s-20260914/`。没有发布、push、域名修改、模型调用或资料读取；真实手机硬件及公网加载未测。
