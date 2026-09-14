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

## 动画与素材（当前：11 秒慢速循环）

保留最初视频的鱼群、色彩、水窗与光影。原视频第 119 帧（约 4.958 秒）含内部硬切；同字节原片保存在 `public/media/ariadne-original.mp4`。当前首页只引用 `public/media/ariadne-original-slow-loop-v2.mp4`。

上一版 3.25 秒一圈，衔接出现过于频繁。本版使用原片 25–117 帧（118 帧仅作补间前瞻），将游速降至约三分之一：仅在这段连续素材的相邻帧之间进行运动补间，保持 24 fps；补间不跨原片硬切，也不跨首尾叠映。先得到 277 帧连续慢动作，再以固定 16 帧 smoothstep 叠映首尾。输出 1920×1080 / 24 fps / 261 帧，10.875 秒（约 11 秒）。

每圈约 10.21 秒是未叠映游动，过渡仍为约 0.67 秒，约占整圈 6%；不会因慢放变成长时间双影。过渡发生频率比 3.25 秒版降低约 70%。原片及先前叠映、正反播放、光流与三维试制全部原地保留。相邻帧运动补间依赖估计，不宣称每个新帧都是原始拍摄；有限原片也不保证每条鱼的物理轨迹闭合，接合仍有短暂淡入淡出。

`LoopingScene.jsx` 使用单个原生 `autoPlay muted loop playsInline` 视频，浏览器以正常播放速率播放已生成的慢动作。没有双视频切换、每圈更换 src、重新挂载或主动 load()；没有暂停按钮或减少动态效果自动暂停，重新可见及前台意外暂停时恢复播放，不重置 currentTime。浏览器后台和系统挂起仍由平台控制。

复现（依赖 numpy、opencv-python-headless、imageio-ffmpeg）：

```sh
python scripts/prepare_slow_loop.py public/media/ariadne-original.mp4 OUTPUT WORKDIR
python scripts/check_slow_loop.py public/media/ariadne-original.mp4 public/media/ariadne-original-slow-loop-v2.mp4 WORKDIR/slow-shot.mkv
```

编辑脚本针对这份素材的已核验切点，拒绝覆盖已有输出和中间片；历史版本仍可由 `prepare_original_loop.py` 复现。原片、无损慢动作中间片、成片和 QA 都保留。桌面保留 70% 水平构图，手机 85%；透明导航、三页及中英内容不变，生产页面无 Three.js 或运行时补间依赖。

## 验证与范围

- 媒体回归检查 11 秒总时长、固定短叠映、原帧时间锚点、无定格帧、游速降低及循环接缝；检查补间中的鱼身和光影。
- Vite 生产构建、VI 静态/负向和 diff 检查；egolite 实测连续六圈、0 暂停 / 重新加载 / 丢帧，并检查窄屏播放。本次页面截屏接口超时；保留当前浏览器视频帧、语义及布局读数、离线逐帧图像作为动画证据。
- 新证据在 `.cache/website-slow-loop-20260914/`。没有发布、push、域名修改、模型调用或资料读取；真实手机硬件及公网加载未测。
