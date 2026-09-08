# JOB RADAR NEXT PHASE HANDOFF

## 当前任务入口与历史授权边界 — 2026-09-08

新任务从 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)、[AGENTS.md](AGENTS.md) 和 [PROJECT_STATUS.md](PROJECT_STATUS.md) 最新适用条目开始。本文保留历次阶段交接与故障处理记录；下文 `CURRENT`、`唯一 next milestone` 或 `Stop after commit` 均须按所在日期和原任务理解，不能作为今天的阶段选择、提交、真实模型调用或清理授权。稳定行为约束仍须结合后续明确决策与对应测试核对。

## CURRENT J1 HOTFIX AUTHORITY — 2026-09-05

- Earlier Candidate Material PASS reports are superseded by Human usage and this hotfix's fresh evidence. Base is `13ff1fc764b7235ba624a82f3e9a6594d20ba6d3`; all required browser and automated gates have now passed for the authorized single hotfix commit.
- Candidate Material Detail repair and real post-regression Work Experience/Project/Education discussion, Working mutation, Human Save, parent list refresh, reopen, latest-state discussion, Local direct Edit, and Local Provider=0 checks passed. Model is restored. See current `PROJECT_STATUS.md` and `TECHNICAL_EVIDENCE.md` for trace, failures and exact regression inventory.
- The initial Job smoke blocked completion with `JOB_EDIT_INVALID`. After an explicit Human request to fix the diagnosed negation error, only the Job referent resolver was repaired and one additional same-question/same-Job smoke passed: Provider response visible, no Working or confirmed mutation. No wider Job changes are authorized. Final regression totals are 18 Node suites, 8 Python suites, 10 JS syntax checks, and 3 Python compilation targets; console and diff checks pass.
- Preserve all originals and the existing untracked private QA screenshot; it must remain unstaged. Only exact required hotfix code/tests/evidence belong in the single hotfix commit. No J2, import redesign, UI polish, or new architecture work. Stop after commit/report; do not repeat completed Provider calls.

## CURRENT RUNTIME-ROUTING AUTHORITY — 2026-09-04

- The earlier `READY FOR J1 HUMAN ACCEPTANCE — GLOBAL INTERACTION CONVERGED` statement was revoked by Human Acceptance and is historical only. Current implementation evidence supports the new runtime-routing stabilization gate; Human acceptance is still pending and no files are staged or committed.
- Ariadne mode, operation, and model capability are separate owners. `public/runtime-capability-gate.js` is the shared operation-aware resolver. In MODEL mode, an incompatible operation fails closed as Model-unavailable; it never calls the Local semantic structurer, Local proposal, Local correction, or Local review path.
- Candidate image/PDF import and Job image import use the configured `deepseek-v4-flash-vision-exp`; Job/Candidate conversation remains eligible for `deepseek-v4-pro`. Runtime load fills only missing configured pro conversation assignments, preserving existing Human choices. Do not restore the removed pro-backed Job import adapter or bind every operation to the current global conversation selection.
- Job image import preserves one ordered source bundle, performs durable source persistence before Provider execution, runs only read-only technical Source Preparation locally, sends the ordered original images plus bounded prepared text to the vision runtime, and creates a non-authoritative Working Job. Human Save remains the only path to a confirmed immutable Job revision.
- Desktop minibar authority is right-side + vertical center. While a Workspace is open, `.v1-page-shell` must not establish the fixed-position containing block, and `.v1-workspace-shell` reserves right-rail space. At `1280×720`, measured Workspace right edge is `1193` and minibar left edge is `1205`; hover does not move the minibar rectangle. Mobile behavior remains governed by the existing responsive fallback.
- Latest real-browser proof used only synthetic fixtures on isolated origin `127.0.0.1:8001`: Candidate image → vision Working; ordered two-image Job bundle → vision Working Job; Job conversation → pro with current Candidate Working context. The negative pro-only image state was disabled and stayed MODEL. Server evidence showed no Local Job semantic endpoint in Model mode.
- Latest automated baseline: `38` Node + `20` Python regression files passed; Local Candidate and Local Job were also run separately with Provider calls = 0. Do not stage or commit until Human Acceptance explicitly authorizes it.

## CURRENT REPO HANDOFF AUDIT — 2026-09-01

> **Next-thread reading rule:** this audit is the current repository snapshot. Older dated UI/version notes below are retained as history only. Where an older note conflicts with this section, do not infer the intended result and do not change code; ask the user to confirm the contract first. This audit changed no product code and made no Provider/API call.

### 1. Current implementation snapshot

- **A. Runtime:** `public/index.html` is the Ariadne Runtime screen at `runtime-ui-v48`. It renders the full-viewport ASCII canvas, one animated Runtime selector/dropdown, a circular next action, Local, discovered/added model choices, and the Add Model floating surface. Selection and added models persist in browser `localStorage`; Runtime → Workspace is a 240 ms opacity fade.
- **B. Workspace:** `public/workspace.html` is the two-folder Ariadne hub. The wordmark is centered. The pair uses the current `901px / 27px / 252px` geometry and is centered around `54vh`; Personal is light, JD is dark at rest. Both backs use the single continuous `public/assets/figma-folder-back.svg` mask and each folder contains three animated paper layers plus the front cover.
- **C. Personal Information:** `public/personal-information.html` has a compact top bar and a full-width responsive card grid generated from IndexedDB. The first card is the black-to-white “添加个人材料” guide; remaining cards are stored Candidate demo records. There is no hero/STEP/introduction block.
- **D. Personal Import:** `public/personal-import.html` exposes Resume / Portfolio / Project / Other and a full dashed click/drop surface. The browser receives only file metadata; current V1 code does not read the file body and creates three new sanitized Candidate fixtures with unique batch IDs. Duplicate detection runs before persistence and asks merge / keep / cancel. In selected-model mode, model merge is labelled but deliberately fails closed because no Provider call is authorized.
- **E. Candidate Detail:** `public/candidate-detail.html` is reused inside the 80% floating detail surface. The left side shows Candidate summary, facts, ownership and provenance. Current selected Runtime controls the tool surface: Local shows top-right “编辑” with preview/confirm persistence to the demo store; a model Runtime hides direct edit and shows scoped conversation plus a reviewable deterministic Candidate patch. The conversation is not a real model call.
- **F. JD:** `public/jd.html` mirrors the Personal library: the first card is the JD import guide and the rest are browser-local Job demo records in the same responsive grid.
- **G. JD Import:** `public/jd-import.html` has two modes, Document (“图像”) and pasted text, plus an optional provenance URL. Document mode validates PDF/PNG/JPG/JPEG/DOCX extensions. The current flow reads metadata/text length only, does not fetch the URL, creates one sanitized Job fixture, checks duplicates, then persists to the demo store.
- **H. Job Detail:** `public/job-detail.html` shows the scoped Job facts/requirements. Local Runtime shows the information surface only; there is no direct Job edit button. A model Runtime adds the right scoped conversation and a reviewable deterministic Job summary patch. It does not calculate Candidate fit and does not call a Provider.
- **I. Minibar/navigation:** desktop V1 pages receive a fixed four-item rail on the right (`Runtime → Workspace → Personal → JD`). It is compact at rest, expands near the pointer, uses a spring distance field, strongly marks the active section, and changes routes with a 320 ms page fade. At `<=700px` it is hidden and the circular top-bar menu is used instead.
- **J. Floating window:** `public/floating-window.js` is shared by Add Model and Personal/JD import/detail surfaces. The header drags; all four edges and four corners resize; movement is clamped to the visual viewport. Geometry is reset when the surface closes and is not persisted across reopen/reload.
- **K. Motion/transitions:** V1 is `v1-motion-33`. Page entry is a 420 ms fade; Workspace folder navigation is opacity-only; library cards/import guides open into a same-page 80% floating surface over 540 ms and close to the current source rectangle over 480 ms. The folder uses three staggered paper transforms and a rotating front cover. Reduced-motion paths remove or bypass these animations.
- **L. Browser-local persistence:** IndexedDB database `job-radar-local-first-v1` is at version 10 and uses `demo_candidate_items`, `demo_job_contexts`, `demo_conversations`, and `demo_ui_state` for this UI slice. A one-time duplicate-consolidation marker is stored in demo UI state. Selected Runtime, added models, and Provider API keys are stored in `localStorage`; transient route/runtime diagnostics use `sessionStorage`.
- **M. Provider state:** V1 Candidate/JD import, conversation and patch flows are deterministic local demo logic and do not invoke a Provider. Runtime load does call local `/api/runtime-options`; if a DeepSeek Keychain credential exists, the local server performs a real DeepSeek model-list request. Qwen is the only Add Model connector currently wired to a real synthetic multimodal connection check; DeepSeek/Gemini Add Model choices report that their connectors are still being integrated. Qwen sends the entered key to the local server endpoint, which forwards the synthetic check to the official Qwen endpoint. Provider keys entered in Add Model are currently persisted in browser `localStorage`.

### 2. Locked / confirmed / must preserve

- Ariadne is the user-facing brand. Do not migrate technical database keys, legacy IDs or file names as a branding side effect.
- Preserve the neutral `#f7f7f9` V1 canvas, current Recursive / Inter / IBM Plex Serif fallback stack, 20px soft rectangular surfaces, and supported-browser `corner-shape: squircle` enhancement.
- Preserve the current Workspace `901 / 27 / 252` geometry, 54vh visual center, centered Ariadne wordmark, Personal-light/JD-dark pairing, three-paper structure, and exact continuous Figma-derived folder-back SVG. Do not restore a rectangle plus pseudo-tab folder back.
- Preserve the four-section right-side desktop minibar order and its active/hover/proximity behavior; preserve the mobile top-bar menu fallback.
- Preserve Personal/JD as responsive card libraries with the import guide first and no restored hero/STEP/object-number introduction.
- Preserve the full dashed import targets, Personal four material types, JD Document + pasted-text modes, optional JD URL as provenance only, and the current supported document extension set.
- Preserve the same-page reversible floating import/detail architecture, shared `floating-window.js`, 80% desktop surface, drag/8-direction resize, viewport clamp, embedded same-origin pages, and rounded-surface scroll safe insets.
- Preserve Candidate and Job as separate data/scope boundaries. Conversation scope is one Candidate Item or one Job; Job conversation must not infer Candidate fit.
- Preserve `Evidence/record → proposal or edit preview → explicit user accept/reject/confirm → demo persistence`. Model/deterministic proposals must never silently overwrite stored facts.
- Preserve the distinction between local metadata-only demo import and AI-recognized provenance in the stored record, even though current UI visibility is selected-Runtime-driven. Do not relabel local fixtures as AI-recognized or real parsed content.
- Preserve the explicit boundary that current V1 fixture stores are not the formal Candidate Context, Career Model or production truth.
- Preserve current cache contracts `runtime-ui-v48` and `v1-motion-33` until an intentional product change updates all linked HTML/assets/tests together.
- Figma remains the visual authority for the seven active frames listed below. Do not bulk recapture over user edits or restore legacy/05–09 frames.

### 3. Known current problems — do not fix in the handoff thread

**A. USER-OBSERVED ISSUE**

- The user reports a repeated regression pattern: a local UI/motion fix breaks another confirmed surface, older valid requirements are missed, and later edits overwrite prior accepted states.
- Previously reported folder/paper leave flicker, card-opening color/flash, clipped floating scrollbars, folder notch geometry and missing detail-edit affordances have code/comments/tests claiming fixes, but the user has not accepted a fresh end-to-end visual baseline after the most recent shared-file changes. Treat their live status as requiring manual confirmation, not as proven fixed.

**B. CODE / TEST ISSUE**

- The Git repository has no commits. Every project path is untracked, so there is no usable code baseline, no historical diff, and no safe commit-level rollback point.
- Personal Import relies on the HTML `accept` hint but does not validate the dropped/selected extension in `v1-pages.js`; JD Import does validate the same five extensions. Drag/drop can therefore pass an unsupported Personal file into the metadata-only fixture flow.
- V1 “AI” Candidate/Job conversations and patches are deterministic browser demo responses, not requests to the selected model. UI copy can therefore look model-backed while no selected Provider/model is called.
- Personal/JD imports do not parse uploaded content: Personal always creates three canned sanitized fixtures and JD creates one canned sanitized fixture. Tests validate this boundary; they do not validate real document understanding.
- Runtime page initialization can cause an external DeepSeek model-list request through `/api/runtime-options` when a Keychain credential exists. This is not a career-material inference, but it means “open Runtime” is not always network-free.
- Add Model Provider keys are persisted in same-origin `localStorage`. Several older handoff sections claim session/memory-only behavior, so those historical security notes are no longer accurate.
- Current UI regressions are primarily static contract tests. They do not simulate real pointer timing, compositor flashes, CSS color continuity, iframe loading, drag/resizing, or multiple responsive viewports; a passing suite does not prove visual motion acceptance.

**C. UNCERTAIN — user decision required before code changes**

- Current code/tests/latest docs say selected Runtime determines Local edit versus model conversation. Older still-labelled authority says record provenance alone gates the AI pane. Do not silently choose between these contracts.
- Candidate Local detail has direct edit; Job Local detail does not. The repository does not establish whether this asymmetry is intentional.
- At `<=700px`, `.v1-object-copy` / `.v1-object-count` retain desktop `top` values while also receiving `bottom` values. Static tests do not establish whether the resulting mobile layout is intentional.
- Current code uses the Figma vector and documented geometry, but this audit did not modify/read live Figma or perform a new pixel/motion comparison. Exact visual parity remains unconfirmed.

### 4. Recent-change risk map

- `public/styles.css`: affects Runtime, every V1 route, responsive behavior, folder geometry/motion, cards, scrollbar safety, minibar, overlays and shared icon grammar.
- `public/v1-pages.js`: affects all seven V1 pages; owns navigation, minibar, overlays, imports, duplicate dialogs, library rendering, detail mode, conversation/patch UI and persistence triggers.
- `public/v1-demo-domain.js`: owns IndexedDB v10 demo schema access, fixtures, deduplication/merge, provenance classification, conversations and Candidate/Job patches across Workspace/Personal/JD.
- `public/floating-window.js`: shared by Add Model and both Personal/JD floating import/detail surfaces; drag/resize fixes can break every floating surface.
- `public/runtime-selection.js`: owns selected Runtime, model list, storage restoration, dropdown and Runtime → Workspace transition; it also initiates `/api/runtime-options` and `/api/runtime-check`.
- `public/add-model-sheet.js`: owns Provider key persistence, Qwen connection, Add Model motion and shared floating-window use.
- `public/assets/figma-folder-back.svg`: shared mask for both Workspace folders.
- All active HTML files pin the same cache-version contracts. Partial version bumps can produce mixed CSS/JS behavior.

### 5. Test baseline (no product edits, no real network)

- 14/14 Node `.mjs` regression scripts passed.
- 8/8 Python regression scripts passed, including all 16 real-fixture checks in `career_entity_regression.py`; the older handoff claim that `test_real_portfolio` still fails is no longer current.
- 17/17 `public/*.js` files passed `node --check`.
- Eight requested active HTML routes and `assets/figma-folder-back.svg` returned HTTP 200 from the existing localhost server.
- `git diff --check` emitted no errors, but this is not a meaningful tracked-diff guarantee because the repository has no commits and all paths are untracked.
- No current/new test failures were observed. No historical failing test reproduced in this audit.

### 6. Git snapshot

- Branch: `main`; state: initial branch with no commits.
- Remote: none configured.
- Status: `.gitignore`, all docs, `app.py`, `data/`, `docs/`, `document_benchmark/`, `public/`, `scripts/`, `src/`, `tests/`, `文件说明.md` and `文件说明.pdf` are untracked.
- Consequence: a new thread must not use Git history to infer accepted UI state and must not run destructive reset/checkout operations.

### 7. Figma authority (recorded from repository evidence; not modified in this audit)

- File: <https://www.figma.com/design/3XdQUI6Dd1BhGCZVhFOncF?node-id=9-2>
- File key: `3XdQUI6Dd1BhGCZVhFOncF`
- Page: `Ariadne — UI Screens`
- Active frames: Workspace `9:2`; Personal Import `13:2`; Personal Local `10:2`; Personal AI `47:2`; JD Import `14:2`; JD Local `12:2`; JD AI `64:2`.
- The current Workspace implementation additionally records Personal folder node `9:22` and JD folder node `9:60` as the source of the continuous folder-back path.
- Do not restore deleted legacy/05–09 frames and do not bulk recapture over user-edited frames. The next implementation thread should inspect only the specific active node it has been asked to change.

### 8. New thread start point

1. **Stage:** Ariadne is a browser-local, fixture-only V1 UI/prototype with Runtime selection, Workspace, Personal/JD libraries, reversible floating import/detail surfaces, deterministic duplicate handling and reviewable local demo patches. Real document parsing and real selected-model Candidate/JD interaction are not implemented in this V1 path.
2. **First priority:** establish a user-approved current visual/behavior baseline before any repair. Compare the running pages to the seven active Figma frames and record pass/fail screenshots for Runtime, Workspace rest/hover/leave, both library/import/detail flows, minibar, responsive layout and floating drag/resize.
3. **Must ask the user first:** selected Runtime versus record-provenance control of the AI pane; whether Job Local detail also needs direct edit; whether Runtime model-list discovery may occur automatically; whether browser-persisted Provider keys are acceptable; which previously reported visual regressions are still observable on the user’s machine.
4. **Do not touch initially:** ASCII background/settings, Provider/API endpoints, IndexedDB schema/data migration, duplicate merge semantics, scoped conversation/Patch truth boundaries, Figma file structure, shared motion/CSS or the folder SVG.
5. **Recommended first concrete task:** perform a read-only, screenshot-based acceptance matrix on the current localhost build and ask the user to mark the first single failing state. Only after that confirmation should a new thread make one narrowly scoped change plus a targeted visual regression check.

> 2026-09-01 Figma/runtime detail authority：Runtime 以 `runtime-ui-v48`、V1 以 `v1-motion-33` 为准。Workspace folder back 必须继续使用 `public/assets/figma-folder-back.svg` 中来自 Figma file `3XdQUI6Dd1BhGCZVhFOncF` node `9:2` 的连续矢量路径；不要恢复 rectangle + pseudo-tab 拼接。当前选中的 Runtime 决定详情操作面：Local 显示右上角 `编辑` 并隐藏 AI；模型 Runtime 保留右侧 scoped conversation 并隐藏直接编辑。Record provenance 仍单独保留，不得用来覆盖 Runtime 选择。Candidate/JD 模型修改必须先生成可审查 Patch，再由用户确认；不得静默写入。back/add/close 的可见 glyph 统一为 24px。没有 Provider call。

> 2026-08-31 Figma/import/dedup authority：V1 以 `v1-motion-29` 为准。Workspace 必须继续匹配 Figma node `9:2` 的 1060/32/297 几何与 `#f7f7f9` 背景；Ariadne 使用 Recursive 字标，中文 UI 保持 Inter/IBM Plex Serif fallback。Personal/JD import 使用点击或拖拽文件的统一 dropzone，不得恢复原生大号 file control 或“消毒示例”按钮；JD 顺序固定为 PDF、图片、粘贴文本，主动作是“开始理解职位”。现有 demo duplicate 已经由一次性 marker 收敛为 Personal 3 / JD 1；后续重复导入仍必须询问 merge/keep/cancel，不得静默修改正式 Career Model。没有 Provider call。

> 2026-08-31 local-import / Figma subset authority：本地 Personal import 必须创建新的唯一批次对象，不得再次用固定 demo ID 覆盖后造成“无反应”；任何 `network_sent:false` 或 `recognition_mode:LOCAL` 记录都必须保持无 AI 面板，模型识别记录的 scoped conversation 与 Patch 不得因此删除。V1 以 `v1-motion-27` 为准，Personal/JD cards 使用 full-width responsive Grid，对话气泡文字纵向居中。Figma 文件 `3XdQUI6Dd1BhGCZVhFOncF` 当前只保留 02、03A、03B、03E、04A、04B、04E 七个自由布局 Frame；不要批量重捕获或恢复 05–09/legacy 画面。没有 Provider call。

> 2026-08-28 中文界面与 AI 来源分流 authority：Runtime、Workspace、Personal、JD、导入与详情页的 UI 文案使用中文；技术协议名、模型名、文件格式、`JOB RADAR` 字标与原始 provenance 不做强制翻译。Workspace / Personal / JD 不得恢复顶部介绍、STEP 01/02/03 或对象编号。`Demo.isAIRecognizedRecord(record)` 是详情 AI 面板的唯一入口：本地导入（明确 `network_sent: false`）只显示信息，模型识别记录保留 scoped conversation 与 reviewable patch。Figma 文件 `3XdQUI6Dd1BhGCZVhFOncF` 已同步为可编辑结构，其中 `JOB RADAR（可编辑）` 必须继续是居中的 TEXT 节点。没有 Provider call。

> 2026-08-28 import-overlay authority：当前 V1 以 `v1-motion-18` 为准。Personal 的“添加个人材料”和 JD 的“添加职位描述”必须与 saved card 共用同一 80% 可逆悬浮容器；正常点击不得恢复 full-page import navigation。Import iframe 必须继续复用原 `personal-import.html` / `jd-import.html` 与既有 local fixture/IndexedDB contract；完成事件仅接受同源且 `event.source === frame.contentWindow` 的消息，必须先缩回来源 guide card，再刷新 library 并 focus 新对象。Reduced-motion 的直接导航可保留为无动画 fallback。真实浏览器已验证 Personal/JD 打开、取消和完成闭环；没有 Provider call。

> 2026-08-28 stored-card overlay authority：当前 V1 以 `v1-motion-17` 为准。Personal/JD library 中已保存的 `.v1-candidate-card` 必须使用 80vw × 80vh 的同页可逆悬浮详情层，打开从来源卡放大、关闭重新读取来源 rect 后缩回；不得恢复普通 saved card 的 full-page navigation / arrival cover。详情内容必须继续通过同源 `embed=1` 复用原 Candidate/Job detail 与 IndexedDB/scoped conversation contract，左侧信息、右侧 AI 对话保持两张独立圆角卡片；不要复制 domain/state。Personal/JD 的 add guide card 仍走专用 import page，不得被 overlay 拦截。真实浏览器已验证双向中间帧、精确 80% 尺寸、两列和 guide navigation；没有 Provider call。

> 2026-08-28 Workspace folder route simplification：当前 V1 以 `v1-motion-14` 为准。Workspace 的 Personal/JD folder 以及 Personal/JD 返回 Workspace 必须使用 opacity-only page fade，不得重新加入 `transitionSourceSelector` 或恢复 folder clone/full-screen surface。`.v1-page-shell` 入场 animation 不能使用 `both/forwards` persistent fill，否则会覆盖 route-leaving opacity；出场 320 ms、入场 420 ms，transform 保持不动，body 全程 `--paper: #f7f7f9`。Candidate/JD 内部普通卡片仍保留现有 card expand/return，不受此规则影响。真实浏览器已验证双向中间帧与零 card layer；没有 Provider call。

> 2026-08-28 card/folder continuity final：当前 V1 以 `v1-motion-12` 为准。card forward 必须把 clone background 从 `#fff` 连续插值到运行时 `--paper`，return 反向插值；body 与 arrival cover 必须保持同一 `--paper: #f7f7f9`，不要恢复纯白 holding frame。Folder 标题/计数属于固定 `translateZ(96px)` 前景平面，不能退回 1 px 或让整个 folder anchor 参与 transform/filter，否则开盖会遮字、离场会重现闪动。标题保持在 folder 下半部。真实浏览器已验证颜色中间帧、hover/leave 坐标与可见性；没有 Provider call。

> 2026-08-28 compositing/color refinement：V1 以 `v1-motion-10` 为准。不要把 `filter` 恢复到 `.v1-object-folder`，阴影只属于 folder back/front；文字层保持 stable translateZ。页面背景必须始终为 `--paper: #f7f7f9`，只允许 `.v1-page-shell` fade，arrival/return cover 继续使用 `var(--paper)`。浏览器已验证 hover/leave 全中间帧文字 opacity 1、folder filter none，以及跨页前中后 background 精确一致。

> 2026-08-28 video-matched motion refinement：V1 以 `v1-motion-9` 为准。Workspace papers 必须共享同一 hover delta，front 承担开盖动作；不要恢复 `-20/-32/-46px` 的分散弹出。minibar 固定右侧、dash 右对齐、tooltip 向左展开，保留 spring proximity 与 active 强调。card forward 必须先保持卡片内容到 300 ms，再与白色 arrival cover/page content 交叉淡入；不要提前把 clone children 设为透明，也不要恢复 body 的重复 route-in fade。两段用户录屏和真实浏览器中间帧均已复核；没有 Provider call。

> 2026-08-28 motion continuity fix：以 Runtime `runtime-ui-v45`、V1 `v1-motion-8` 为准。Add Model 叉号必须先解除正向 animation 对 transform 的占用，再收回 selector；folder 离场必须保留三层 closed paper caps；Personal guide、JD folder、JD guide 的 forward/reverse clone 必须保持白色，只有静止且未 hover 的源卡片恢复黑色。浏览器已验证 query/no-query forward-return、重复打开与 console 0 error；不要移除 `is-close-ready`、`v1-transition-light` 或 routeKey 的 `v` 参数归一化。

> 2026-08-27 Runtime / Workspace motion refinement：当前可打开版本为 Runtime `runtime-ui-v44` 与 V1 页面 `v1-motion-7`。Add Model 从入口放大为悬浮配置页，并对取消/成功使用同一反向收回；minibar 默认短、靠近展开、active 更突出，切页只 fade；Workspace folder 有三层纸张 hover，Personal/JD 卡片与导入完成具备双向卡片→页面过渡。13 个 Node regression files 与 8 个 localhost 页面 smoke 通过；没有 Provider call。后续改动不得恢复 bottom sheet、bloom navigation、folder 右上箭头或 framed back/add icons。

> 2026-08-27 STEP 02–03 UI framework：Workspace / Personal Information / JD 的 fixture-only browser-local demo 已完成。当前可从 `/workspace.html` 点击完整体验：Personal import → 3 Candidate Cards → split detail → Patch/Direct Edit，以及 JD import → 1 Job Card → JOB split conversation。IndexedDB 已统一 additive v10，所有示例只进 `demo_*` stores。下一阶段若要接真实 Resume/JD 或真实模型，必须重新定义具体数据、Provider、费用与用户确认；不得把当前 fixture UI 误记为真实 Candidate truth、真实模型理解或用户能力证据。

> 2026-08-25 implementation update：Step 1 已完成 Preflight 与不会发送资料的 Phase A–B contract preparation。当前仍以本文件及 Final Consolidation 的 frozen scope 为准；尚未导入真实 Resume、未执行 Provider inference，Card UI 也尚未开始。下一可执行操作是先取得 Figma Candidate Human Calibration Kit，再由用户选择一份真实 Resume 并在页面内完成 action-scoped consent。

> 2026-08-26 targeted runtime update：Figma Runtime Selection 已连接并实现到 localhost 首页。当前状态机为 `IDLE → CHECKING → READY / FAILED` 与 `LOCAL_READY`；Local → Workspace 已真实验证。账号列出了 `deepseek-v4-flash`、`deepseek-v4-pro`、`deepseek-v4-flash-vision-exp`。对 vision model 的一次经批准最小 text ping 返回空内容，因此 UI 正确保持 `FAILED`、无 arrow；未发送任何 Career Material。下一步仅在用户再次明确批准后，选择 `deepseek-v4-flash` 进行一次独立最小 ping；成功后才可完成 AI Ready → Workspace 验收。

> 2026-08-26 provider audit correction：不要再把 vision-exp 的 empty text output 视为 Provider unavailable，或对 account-visible model 轮流猜测 endpoint。`src/provider_runtime.py` 现将 selected model 绑定到 explicit protocol/capability；官方 contract 的 `deepseek-v4-flash` 仅能经 `/responses` 测试，实验 vision model 的 text capability 为 unconfirmed。完整 adoption/rejection rationale 在 `docs/architecture/PROVIDER_REFERENCE_FIRST_AUDIT.md`。任何新的 paid smoke test 都要在发送前逐次说明并等待批准。

> 2026-08-26 scoped conversation foundation：已新增 `public/scoped-conversation-domain.js`、IndexedDB v9 的 `conversation_sessions` / `conversation_messages`。第一 scope 仅为 `CANDIDATE_ITEM`；Context Compiler 只选择当前 Item、可选 source、最近 8 个同 scope turns 与当前输入。Conversation 不写 CandidateContext，Provider/model 切换不复制 session。当前没有 Candidate Card Detail UI、真实 conversation call 或 Patch Generation；不要以此扩张为 general career chat、Job/Requirement conversations、RAG/Agent 或自动 fallback。

> 2026-08-26 Web BYOK feasibility spike：`docs/architecture/WEB_BYOK_PROVIDER_FEASIBILITY.md` 记录了 localhost browser direct transport evidence（placeholder-only，no inference）。HTTP 400/401/200 只证明 CORS/transport，不是 Provider ready。DeepSeek/Gemini future session-BYOK candidate；OpenAI not default；Claude/OpenRouter reference only。无 Job Radar proxy；key 不入 server、URL/log/console/telemetry，默认只在 session/memory。唯一可以以后请求批准的 paid 行为是 DeepSeek Flash `/responses` synthetic `Reply only: OK` smoke，且必须逐次 action-time approval。

> 2026-08-26 Gemini browser real smoke：用户已批准一条 Gemini synthetic smoke。Runtime Selection 已在 `public/gemini-browser-runtime.js` 接上 browser direct model discovery + `generateContent` request。它只从 account-returned stable Flash candidates 选择 `gemini-3.1-flash-lite` 优先的 text model，请求 `Reply only: OK` / max 16，并在 non-empty normalized result 后启用 arrow。当前 UI 实测了 selection、session-only input 与 empty-key fail-closed；唯一未满足条件是 user-supplied session key，故没有 real API call、费用或 provider pass claim。用户输入 key 后只跑这一条，成功即关闭 Provider spike 并开始 browser-local Resume → Candidate Proposal/Cards；不得继续 Provider research。

> 2026-08-26 model-level capability correction（以本段为准）：DeepSeek 官方公告 `news260821` 确认 `deepseek-v4-flash-vision-exp` 是支持图文混合输入、Base64 图片与 Chat Completions 的实验多模态视觉理解 API 模型。V1 只显示这个已接入的 exact model；`deepseek-v4-flash`、`deepseek-v4-pro` 和 unknown 均为非图文候选并隐藏，绝不从 Provider 继承视觉能力。选中 vision-exp 使用 `OFFICIAL_MODEL_CAPABILITY` 状态启用 Workspace arrow，且不发送任何网络请求；这不等于 `MULTIMODAL_CONNECTION_READY`，后者仍须未来独立 synthetic smoke。Gemini 不在当前 Runtime Selection 显示；“添加新的模型”是唯一的扩展入口。

> 2026-08-26 add-model interaction shell：`＋ 添加新的模型` 现为当前 Runtime 页上的 iPhone-settings 风格 bottom sheet，不跳页。它只包含 DeepSeek/Gemini/Qwen 的 fixed model-level compatibility catalog：`deepseek-v4-flash-vision-exp`、`gemini-3.7-flash`、`qwen3.8-max`。Key 只存在 input state，可清空，绝不进 URL/log/persistence/server；未获 action-time approval 时“连接并读取可用模型”不会 fetch 或 call Provider，只显示等待批准，✓ 完成保持 disabled。后续真实路径必须先逐项说明 Provider、account-returned model list、endpoint、synthetic multimodal smoke、成本与用途，获批后才能填入候选列表、验证、启用完成并回写主选择器。

## 0.0 Frozen authority and only next milestone

```text
PRODUCT ARCHITECTURE V2 = FROZEN / CONFIRMED
Architecture Gate = COMPLETE
Implementation = IN PROGRESS / Phase A–B contract preparation complete
Current Milestone = STEP 1 — ONE REAL RESUME
                    CANDIDATE IMPORT + HUMAN CALIBRATION
```

当前最高 authority：`docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。下一线程唯一任务是 Step 1：`ONE REAL RESUME PDF → SourceDocument → DeepSeek consent → real ProcessingRun states → structured CandidateItem Proposal → Work / Project / Education Cards → Human Review → Direct Edit → card-scoped AI Correction → Context Patch → Before / After / Why → User Confirm → CandidateContext persisted → close / reopen → confirmed Cards remain`。

不得在 Step 1 加入 Portfolio、Job Import、Match、Resume generation、Capability Card、Career Mentor、Architecture redesign、旧 CareerEntity migration、OCR benchmark、MCP、RAG、Agent、Skill 或 CLI。不要继续 Career Intelligence V0，不要把 CapabilityBoundary/CareerDirectionHypothesis 作为待实现项，不要把 CareerEntity 接回 AI main flow，不要继续 Architecture Research。

硬原则：`CARD-FIRST HUMAN CALIBRATION`；Candidate Context 是 semantic truth，Cards 是 human review views；用户是最终 Candidate Context authority；Direct Edit = 0 LLM calls；AI Correction = task-scoped Context Patch proposal；未来 Job/Application 遵循 Minimum Necessary Change；Passit 是下游 JD Evidence Match baseline；CareerStack/KarriereVault 是 Candidate representation references；reference-first；Git/GitHub 管 code versioning，CandidateContext revision 管 user-data versioning；Figma 是 Human Calibration UI design authority；DeepSeek first。

推荐实现模型：`Terra Medium`。Step 1 的 contracts preparation 已完成；真实 Resume send、Card UI 与 human calibration 均尚未开始。以下内容均为既有实现 inventory / historical handoff，不得覆盖本节的 frozen authority 与唯一 next milestone。

## 0.1 Historical UI milestone：基础工作台已完成

入口为 `/workspace.html`。这是既有 UI 事实，不是当前 next action；原先“下一步做职位 Match”的描述已由 Step 1 ONE REAL RESUME 覆盖。详见 `docs/current/WORKSPACE_MVP_UI_ARCHITECTURE.md`。

> **Historical pre-closeout snapshot：** 以下 `ADOPT WITH CHANGES / AWAITING USER CONFIRMATION` 状态已由本文件 §0.0 的 `FROZEN / CONFIRMED` 覆盖；旧 Gate 不是当前 authority。

> **主线变化：** Job Radar 收缩为 `Evidence-grounded Career Application Intelligence`。下一条实现只验证 `AI Interpretation Artifact → Human Cards → Reviewed Candidate Context → CareerEvidence`；不继续扩大 OCR、Provider、Career Direction、Control Center 或 general chat。

> **清理说明：** P4.1 归档清理只移除了可恢复的生成字节码/Finder 元数据；原始资料、SQLite、IndexedDB 所属数据、benchmark truth/audit evidence 均保留。阅读顺序：`PROJECT_STATUS.md` → 本文件 → `TECHNICAL_EVIDENCE.md` → `docs/current/` → source/tests。

## 0. Historical Product Architecture V2 handoff

- Product definition：`Reviewed Candidate Context + CareerEvidence + JobRequirements → MatchJudgment → ApplicationDossier`。
- Source of truth：Original Source 是 source of record；Reviewed Candidate Context 是产品 truth；CareerEvidence 是 claim-level reasoning source。
- CareerEntity：退出 AI main path，只保留为 Local/Legacy intermediate，不删除。
- Career Intelligence objects：CapabilityBoundary 简化为 claim/ownership guardrail；InterestSignal 只保留 user-owned lightweight state；CareerDirectionHypothesis defer；OpenQuestion 改为 material/evidence/match clarification。
- Target IA：Career / Jobs / Applications / Offline / Settings；不设一级 Overview，Applications 仅在首个 Dossier 可用后出现。
- ONE first slice：复用一份现有 AI artifact，生成 typed cards，记录一次真实 correction，确认后保存 versioned Candidate Context 与 grounded Evidence；不得改写 JD-001～014、旧 Entity/Evidence 或原 artifact。
- Next model：Architecture 经用户确认后使用 `Terra Medium` 实现；纯文档同步使用 Luna。
- Stop condition：本 handoff 仅记录已采纳的 Architecture Gate，不自动开始实现。

## 1. 当前阶段状态

### P4.1A — Local Career Material Ingestion

`COMPLETE / PRODUCTION-USABLE BASELINE`

真实 Resume / Portfolio 的 Entity-first ingestion、grouping、entity review、provenance、persistence、confirmed-only CareerEvidence derivation 已完成。no-model Document Understanding architecture 与 targeted mapping fixes 已关闭。

### P4.1B — AI-Assisted Career Material Ingestion

`IN PROGRESS / NOT QUALITY-ACCEPTED`

- capability-aware Provider contract 已实现：DeepSeek = TEXT；Gemini = direct original PDF 目标；Groq = TEXT/IMAGE 登记但未做 direct PDF。
- 已使用本机 Keychain 中的 DeepSeek credential 完成一次小型真实中文文字预检：`deepseek-v4-flash → 预检成功`。未发送任何 Career Material。
- Gemini Key 未配置；model listing、direct-PDF preflight 与真实 Resume/Portfolio ingestion 尚未完成。故不得声称 P4.1B 完成。
- IndexedDB v5 的 `ai_career_contexts`、accepted-only cache 与中文-first Canonical Context UI/validation 已存在，但真实 AI 质量结果仍未知。
- Historical open item：P4.1B runtime 与旧 contract marker 曾不一致；它不是当前 Step 1 外的独立 next action，不得在 Closeout 后抢占唯一 milestone。
- **最新实现：** DeepSeek 账号模型清单确认 `deepseek-v4-flash-vision-exp`。AI-first UI 将其作为完整职业资料验证通路：完整 PDF 仅在 localhost 瞬时渲染为全部页面图像，用户确认后整份发送；Gemini 保留其原始 PDF delivery。产品层不再把文字/PDF 能力暴露为用户选择，内部 delivery adapter 仍留存于 provenance。Local parser 现为折叠的高级离线 fallback；没有删除或架构重开。
- **最新纠正：** AI 输出只以可变的 Canonical Context Markdown 存在，绝不自动写入旧 Local `CareerEntity` 字段卡。发送改为“确认资料传输 → 确认可能费用 → 发送”的可观察状态机；返回、失败、Provider/model 与时间可见。Prompt v2 要求模型不硬填固定字段，无法稳定分类的原文保留为带页码的待人工归类片段。

### Historical Career Intelligence V0 implementation

`IMPLEMENTED / REAL USER REVIEW PENDING`

原始 Job Radar V0 的 JD records 与既有 CareerEvidence 现可在 `career-evidence.html` 的 Career Model Control Center 中生成 review-only CapabilityBoundary / InterestSignal / CareerDirectionHypothesis / OpenQuestion。`public/career-evidence-domain.js` 的规则化 proposal layer 只读 confirmed Evidence 与 `/api/jobs`；IndexedDB v6 新增 additive `career_intelligence` store。真实用户尚未审核，因此不可标记为 usable baseline，也不得进入 P4.2。

## 2. 后续可复用能力与实际文件位置

| 能力 | 实际位置 | 当前边界 |
|---|---|---|
| SourceDocument / 本地资料持久化 | `public/career-evidence.js`、`data/domain_contracts/career_evidence_v0.json` | 浏览器 IndexedDB；原始 Blob 保留，服务端不写 SQLite |
| Resume / Portfolio ingestion | `src/career_evidence.py`、`src/extraction/`、`app.py` 的 `/api/career-document-extract` | Resume 与 Portfolio 分开 extraction/grouping，统一进入 CareerEntity |
| CareerEntity | `public/career-evidence-domain.js`、`data/domain_contracts/career_entity_v1.json` | entity-level review，默认 `needs_review` |
| CareerEvidence | `public/career-evidence-domain.js`、`data/domain_contracts/career_evidence_v0.json` | 只从 confirmed entities 派生；reopen/reject 会失效 |
| Human Review / provenance | `public/career-evidence.html`、`public/career-evidence.js`、`career_entity_v1.json` | entity review、field provenance、page/line/source anchors |
| Persistence / duplicate identity | `public/career-evidence.js`（IndexedDB v4/v5）、`tests/career_entity_regression.py`、`tests/ai_career_context_regression.mjs` | additive stores；source hash/entity identity 防重复 |
| JD records | `data/jd-001.json`、`data/batch06_candidates/`、`data/job_radar.db`、`app.py` `/api/jobs` | 原始 Job Radar V0 的职位、来源、状态数据 |
| DeepSeek / Provider integration | `app.py` Keychain + `/api/ai-providers/deepseek/text-preflight`；`src/ai_provider_capabilities.py`；`src/provider_registry.py` | DeepSeek real text preflight 已通过；JD screenshot vision 是独立旧路径 |
| Gemini AI ingestion path | `src/ai_career_ingestion.py`、`app.py`、`public/career-evidence.html/js` | direct PDF 仅在 credential/model preflight 后，逐次隐私确认 |
| Relevant contracts | `data/domain_contracts/`、`data/model_contracts/` | CareerEntity、Evidence、DocumentBlock、ExtractionRun、Canonical Context、JD analysis |
| Regression evidence | `tests/`、`document_benchmark/`、`docs/architecture/` | P4.1A truth/regression 与 P4.1B offline contract regression |

## 3. 已冻结的决定

Local ingestion architecture 已冻结。没有新的、重复的真实 failure evidence 时，不重新打开 Paddle、Docling、Surya、global GapTree、blind native/OCR fusion 或大规模 OCR architecture benchmarking。

冻结不等于永远不能修 bug。保留唯一诊断循环：

`real failure → source check → failure-layer diagnosis → targeted fix → regression`

任何新的修复必须保持 SourceDocument、DocumentBlock v1、CareerEntity、Human Review、confirmed-only CareerEvidence 与本地数据边界不变，除非另行批准架构变更。

## 4. 产品定位变化

Job Radar 的新产品 hypothesis 是：

`local-first + AI-native + evidence-grounded Personal Career Intelligence Layer`

长期共享的核心是一个由用户确认的 Career Model，未来不同 AI Agent 可以使用同一个 Career Model；本阶段不实现 CLI、Skill、MCP、RAG 或 Agent automation。

核心逐渐转向：

`CareerEvidence + Capability Boundary + Interest Signals + Career Direction Hypotheses + Human-confirmed Career Model`

## 5. 必须保留的 epistemic principles

- `Interest Signal ≠ Capability Evidence`
- `Missing Evidence ≠ Missing Capability`
- `AI-assisted Implementation ≠ Independent Engineering Capability`
- `Observed Behavior ≠ Confirmed Preference`
- `Career Direction Hypothesis ≠ User Goal`
- `LLM Proposal ≠ Stored Truth`

所有下一阶段输出必须经过 provenance、unknown/ambiguity 标记与 Human Review；模型建议不得直接成为已确认事实。

## 6. Superseded handoff：Career Intelligence V0（不得执行）

本节是 2026-08-24 的历史 handoff，已被 §0.0 覆盖。Career Intelligence V0、CapabilityBoundary 与 CareerDirectionHypothesis 均不是当前 next milestone。

第一轮只做：

`existing CareerEvidence + existing JD records → CapabilityBoundary → InterestSignal → CareerDirectionHypothesis → OpenQuestions → Human Review → persistence`

第一轮明确不做：

- 完整 Requirement ↔ Evidence Matching
- CLI、Skill、MCP
- storage migration
- UI redesign
- OCR work
- new Provider work
- RAG / vector DB

第一轮的最小产品结果是可审阅、可追溯、可持久化的 Career Intelligence proposals，不是自动求职、自动匹配或自动投递。

## 7. Superseded 新 Thread 启动说明（不得执行）

以下是历史读取顺序，不得用于启动当前线程；当前线程只遵循 §0.0 与 Final Consolidation authority：

1. `PROJECT_STATUS.md`
2. `NEXT_PHASE_HANDOFF.md`（本节为当前权威状态）
3. `TECHNICAL_EVIDENCE.md`
4. `文件说明.md`
5. `docs/current/P4_1B_AI_ASSISTED_INGESTION.md` 与 `docs/current/REPOSITORY_STRUCTURE_AUDIT.md`
6. `data/domain_contracts/career_entity_v1.json`、`career_evidence_v0.json`、`portfolio_project_v1.json`、`extraction_run_v1.json`

然后 inspect：

- `public/career-evidence-domain.js` 与 `public/career-evidence.js` 的 CareerEntity / CareerEvidence / review / persistence flow；
- `src/career_evidence.py` 的 Resume / Portfolio ingestion boundary；
- `data/jd-001.json`、`data/batch06_candidates/` 与 `app.py` 的 JD routes；
- `tests/career_entity_regression.py`、`tests/career_evidence_regression.mjs`、`tests/analysis_review_regression.py` 作为现有回归基线。

此处原有“新 Thread 开始 Career Intelligence V0”指令已作废；当前新线程只能执行 §0.0 的 Step 1，且仍需用户明确启动。

## 8. 本次 Handover 的完成边界

本轮只同步权威文档与索引，不修改生产代码、schema、IndexedDB、OCR、Provider 或 UI。Career Intelligence V0 未启动；P4.2 未启动。

## 9. Learning-by-Building / Capability Objective

Job Radar 同时是一个 AI Product / AI Systems Product 的 Learning-by-Building 项目。目标不是把用户训练成独立软件工程师，而是通过真实产品开发形成以下可迁移判断能力：

- Product problem definition、product hypothesis 与 acceptance criteria；
- User / AI / deterministic system boundary、data flow、domain model、state/persistence responsibility；
- Model API boundary、prompt/schema/structured output、Human-in-the-loop、provenance 与 epistemic uncertainty；
- Eval design、failure diagnosis、architecture trade-off 与 agent/tool interface design。

后续实现必须遵守：

- 大量 Codex/AI 实现统一标记为 `Tool-assisted Implementation`，不自动计入用户独立 coding capability；
- 学习主线不退化为大量 JavaScript/Python 逐行教学、语法训练、算法刷题或 implementation drill；
- 当用户亲自完成定义、预测、判断、诊断、验收、trade-off 或解释时，才记录为 `User-owned Capability Evidence`；
- 每个 meaningful milestone 至少记录 Product Progress、用户作出的判断、Tool-assisted work、Remaining Gap 与下一步；
- 新阶段优先让用户参与 hypothesis、failure-layer prediction、acceptance judgment、epistemic boundary 和 explain-back，而不是只观看代码产出。

本段只保留为旧 Career Intelligence V0 Thread 的历史学习约束，不构成当前任务。

## Historical implementation notes

以下内容保留此前 P4.1 / Phase 3 的实现叙述，用于追溯，不构成下一阶段状态或新的开发指令。

## Phase 4 Execution Mode — Continuous Milestone Build

- Within a user-confirmed milestone, Codex proceeds continuously through implementation, local run, observation, diagnosis, fix and regression. It does not pause after ordinary code, schema, parser, review-UI, non-destructive IndexedDB or test changes.
- A failure is briefly reported with its observed symptom and diagnosed/fixed from evidence. A user layer prediction is invited only when it helps product learning; it is not an implementation blocker.
- Stop only for external credentials/payment/login/permissions, destructive or irreversible operations, private-data upload/centralisation, major scope/architecture expansion, or missing required real input.
- User corrections may become local-only correction memory or reviewed truth inputs. They must not be uploaded, centrally collected or used for shared training by default.
- Model/provider comparison remains evidence-led: propose Gemini vs DeepSeek only when a documented residual OCR/deterministic document-understanding limit remains after local fixes.

## Project goal

Build an AI Job Radar gradually: stable JD data first, then external source synchronization, then Model API structured analysis, then Eval. Do not treat V0 as an automated job-search system.

## Canonical Phase 3 exit

- Phase 3 implementation, learning closeout and evidence sync are formally complete. Authority: `docs/history/PHASE_3_FINAL_SYNTHESIS.md`.
- The bounded completed product is link / original evidence → local OCR or user-triggered real DeepSeek vision → structured `needs_review` candidate → human confirmation → IndexedDB → editable local gallery.
- The separate text JD analysis system is Mock-proven only: provider-independent input/instruction, validation and `job_analyses(needs_review)` persistence exist, but no retained real-provider text analysis result or analysis review UI exists.
- The next phase is **not Eval by default**. It is `AUTOMATION FEASIBILITY & ARCHITECTURE GATE`.
- ONE NEXT ACTION: build a decision matrix for Automatic Discovery, Matching, Resume / Portfolio Suggestion and Application across user value, data, allowed access, deterministic / AI responsibility, human approval, failure/risk and smallest MVP. Stop after selecting one Automation MVP.
- `RAG = Not Yet Justified`; `MCP = Not Yet Justified`; `Agent = Not Yet Justified` until the gate finds a real retrieval or multi-tool planning problem.
- `UI POLISH = DEFERRED UNTIL CORE AUTOMATION / RELIABILITY STABILIZES`.

## Current AI PM learning/build protocol

- Goal: use Job Radar to build AI Product Manager / Design Technologist judgement: product definition, system flow, model integration, reliability, human responsibility, diagnosis and trade-offs. Do not treat it as default Software Engineer training.
- Meaningful milestones follow: system problem → connected concept cluster → useful slice → observation → explain-back → user-owned decision/modification → failure/diagnosis/regression → product review/checkpoint. Working AI-generated code is not user capability evidence.
- Each meaningful closeout distinguishes Product Progress, New Transferable Knowledge, AI PM Capability, User-owned Evidence, Tool-assisted work, Remaining Gap and Next Milestone. A UI choice or terminology explanation alone is not learning progress.
- Technical depth: apply system flow/contracts/structured output/validation/review/Eval/AI boundary; understand storage, CORS, credentials, local-first and deployment sufficiently for product judgement; delegate deep infrastructure/crawler implementation unless a real product problem requires it.
- Default progression is answer → teach → advance → checkpoint. Stop only for material scope/architecture choices, credentials/payment/external access, destructive action, security/legal boundary, or a core understanding blocker.

## Current implementation

- V0 is complete: one real JD → JSON seed → SQLite → SQL → local HTTP list/detail API → browser search/card/detail → persistent application status.
- P4.1 Career Material Entity-first is complete: Resume and Portfolio use separate extraction paths, then share SourceDocument → ExtractionRun → CareerEntity → entity review → confirmed model → selective derived CareerEvidence → IndexedDB v4 refresh restore.
- P4.1 reliability extension is complete: IndexedDB v4 local correction memory, unified select/drag/paste intake, selectable source cards and re-recognition of stored browser Blobs. Real DOCX now generates the same 13 Resume entity types as the PDF; no user career material is uploaded or centrally retained.
- Real Resume acceptance produced 13 complete entities. Real image-only Portfolio acceptance produced 4 CASE-aware projects using local coordinate-aware OCR; Material Card correctly spans pages 4–5, while MUPAHKC stops on page 7. Duplicate import, entity confirmation, Evidence derivation, refresh restore, additive preservation and failure regressions pass.
- Final mapping closeout is complete: the image-only English CV now produces 3 Work, 2 Education, 3 SkillGroups, 2 Languages and 3 Awards; Touchine now produces five real project names including Mac Setup while CASE/category labels remain metadata. All targeted and existing regressions pass, and a normal browser review left every entity unconfirmed with zero derived Evidence.
- No provider comparison is currently justified: local OCR/layout reconstruction resolved the observed failure. Further deepening needs a new approved milestone with residual-failure evidence.
- Runtime: `python3 app.py` in this folder; open `http://127.0.0.1:8000/`.
- Current data: 14 local records. JD-001 remains `application_status = applied`; JD-002…JD-014 were imported from user-provided Batch 06 evidence and start `application_status = unknown`.

## Current learning evidence

- Understands at L1: record/field/schema/unknown, SQLite vs JSON, persistence, API route/request-response, list vs detail, 200 empty collection vs 404 missing record, and major failure layers.
- User-owned decisions: stable JD IDs; unknown values; application status; search scope; card/field visibility; source URL; detail information hierarchy.
- New Phase 3 understanding: ordinary API vs Model API, provider/model/credential, input/instruction/output contract, structured output, contract-valid vs factual correctness, grounding and Human Review are credible L1; AI feature / review / responsibility design has L2 Apply product evidence.
- Still not L2 implementation: independent SQL/Python/JS, schema migration, provider payloads, full diagnosis-fix-regression, validation implementation and Eval execution.

## Key files

- `docs/history/PHASE_3_FINAL_SYNTHESIS.md` — authoritative Phase 3 implementation, learning, capability and exit record.
- `PROJECT_STATUS.md` — concise current phase state.
- `docs/history/P4_1_CAREER_EVIDENCE_CHECKPOINT.md` — completed Entity-first implementation checkpoint and Portfolio gate history.
- `README.md` — run instructions and V0 scope.
- `data/schema.sql`, `data/jd-001.json`, `data/job_radar.db`, `app.py`, `public/` — working slice.
- `scripts/import_batch06_evidence.py`, `data/batch06_candidates/`, `data/batch06_import_report.json` — reviewable, idempotent local-evidence batch import.
- `TECHNICAL_EVIDENCE.md` §20–59 — V0 through Phase 3 plus P4.1 Entity-first and final no-model mapping closeout evidence.
- `02_learning/AI_BEGINNER_OBSERVATION_LOG.md` Q-018–Q-030 — reusable Job Radar questions.

## Learning guardrails

- Use Learning-Driven Build Mode: 1–3 concepts → user prediction → one minimal implementation/observation → explain-back → user-owned modification → failure + regression → checkpoint.
- Do not infer L2 from working code. Explain Input → Data Structure → Storage → Query → Output → Failure before syntax.
- Preserve unknown / NULL and source provenance; do not fabricate source dates, posting status, URLs, or JD content.

## Completed external ingestion objective

One permitted external HTTP source ingestion slice is complete: source contract, raw capture, normalized record, duplicate key, source-evidence sync, local successful-fetch freshness, `unknown` external status, UI detail evidence, and normal/failure handling.

## Confirmed external-source contract

- Allowed source: `Tencent Careers` only, using `https://careers.tencent.com/jobdesc.html?postId=2055186895503273984`.
- External job ID: `2055186895503273984` from URL parameter `postId`; duplicate key is `Tencent Careers + external_job_id`. Missing/unreadable external ID is `needs_review`, never a fabricated ID.
- Read boundary: one user-triggered public HTTP `GET` to the JD page plus one explicitly authorized GET to its exact Tencent CDN job-page script; no further reads, polling, login, credentials, multi-source access, automatic retries that enlarge access, or attempts to bypass source restrictions. A cross-domain redirect, login/challenge response, timeout, or non-2xx response is a failure to record and review, not a reason to circumvent it.
- Evidence: retain the relevant raw response fragment, original URL, and a SHA-256 content hash. The hash is a content-integrity/change fingerprint, not URL protection.
- Time/status semantics: `last_successful_fetch_at` is the local successful-read time; it never substitutes for `published_date` or `posting_status`. Keep externally unsupported values as `NULL` / `unknown`.

## External ingestion closeout

Completed on 2026-08-23: one manual `GET` to the confirmed Tencent URL returned HTTP 200 and a 2,145-byte HTML bootstrap page. The body did not contain the expected `postId`, so it is saved as raw evidence with `response_validity: unexpected_content` and `outcome: needs_review`; it is not normalized or written to SQLite. The source allowlist regression rejected `https://example.com/` before making a request.

One additionally authorized GET to the page's exact Tencent CDN `p_zh-cn_jobdesc.build.js` script initially returned HTTP 403. A later user-authorized single retry with ordinary browser `User-Agent` and same-page `Referer` returned HTTP 200 and captured an 82,710-byte JavaScript resource. Local inspection identifies a frontend declaration for `postApi.ByPostId` at `/tencentcareer/api/post/ByPostId`, with `postId` and `language` parameters; this is an inference from the saved script, not an API response.

Completed: the user authorized one exact GET to `https://careers.tencent.com/tencentcareer/api/post/ByPostId?postId=2055186895503273984&language=zh-cn`. It returned HTTP 200 JSON with the expected `PostId`, title, location, experience requirement, 4 numbered responsibilities, 5 numbered requirements, and `LastUpdateTime`. `scripts/normalize_tencent_jd.py` produced `data/normalized_candidates/tencent-careers-2055186895503273984.json`; it preserves `company: unknown` because API `ComName` is empty, keeps `published_date: null` / `posting_status: unknown`, and does not map the user-owned application status.

Completed: duplicate handling generated `data/reconciliation_plans/tencent-careers-2055186895503273984.json`. Its `Tencent Careers:2055186895503273984` key matches `JD-001` by `source_url.postId`; `application_status: applied` is explicitly preserved and no SQLite write occurred.

Completed: approved safe sync added external source evidence to JD-001 in SQLite: source name/ID, source title/location/seniority, raw path/hash and local successful-fetch time. Existing company/title/location/seniority and user-owned `application_status: applied` remain unchanged; no source-company or source-last-update-time field is stored. The existing detail API returns these new fields without a route change.

Completed: detail UI now has an “外部同步证据” section for source name, external job ID, local successful-read time, source title, location and seniority. Cards retain curated primary fields and do not show raw hashes. Existing detail route/API required no new endpoint and regression preserves `application_status: applied`.

Learning closeout: the user can distinguish identity (`source + external job ID`), provenance (raw evidence/path/hash/fetch time), merge policy (human primary fields versus `source_*` evidence), persistence (SQLite sync), and idempotency (same candidate sync twice creates no record and retains user status). The current merge policy remains “human primary + source evidence.” An external-primary title with durable `human_title_override` is a separate future policy design, not silently enabled here.

## Historical implementation narrative

The following sections preserve the chronological implementation narrative. When an older sentence conflicts with the Canonical Phase 3 exit above, the closeout section and `docs/history/PHASE_3_FINAL_SYNTHESIS.md` take precedence. A real DeepSeek **vision** request was later completed; a real DeepSeek **text `job_analyses`** request remains unproven.

The user has selected the product direction: **public web, local-first user data, no default multi-user SaaS database**. In the future public version, each browser owns its own IndexedDB records; current SQLite/app.py remains the local development and regression asset. A cloud Model API would receive only the selected user's input directly from that user's device, not through a Job Radar server; a fully on-device model would be a separate future choice.

**Phase 3 closed — local-first intake + review + gallery:** `public/local-first.html` / `local-first.js` provide link-as-provenance plus browser-local `needs_review` candidates → user-edited confirm → IndexedDB job, with JSON export/import and a user-confirmed clear action. Pasted original text or screenshots provide content; links are never read from the UI. The visual request uses only `vision_extract_v1_full`; the A/B selector has been removed. `public/local-jobs.html` / `local-jobs.js` read confirmed records from the same IndexedDB as an image-prioritised card flow; cards open full details, screenshots and canonical source links, and their edit buttons update the existing IndexedDB record without duplication. The user confirmed gallery content is correct; syntax/route regressions pass.

**Historical proposal at this checkpoint: Eval.** This was the next milestone proposed before the Phase 3 final synthesis. It is preserved as history but is superseded by the canonical `AUTOMATION FEASIBILITY & ARCHITECTURE GATE` above. The useful Eval idea remains: build a small reviewed truth set from confirmed screenshot/JD records, measure field/section precision and recall separately for local OCR and DeepSeek vision, and keep image coverage, OCR error, extraction/mapping error, model semantic error and human corrections as distinct failure labels.

**Final gallery usability correction:** detail dialogs contain their own `编辑此职位` action and display every saved evidence image as clickable thumbnails, rather than only the first image. Editing keeps the same `job_id`; image switching is presentation only and never removes evidence.

**Screenshot evidence intake — partial implementation/validation:** `local-first.html` accepts PNG/JPEG file selection and clipboard paste. `POST /api/local-ocr` is localhost-only and invokes macOS Vision. A supplied JD-002 screenshot returned 53 text lines through both Vision and the API, including title/location/description content, but also OCR errors such as `AI → Al` and broken lines. The result is therefore candidate evidence only. Browser-automation file-chooser testing timed out before selection (test-tool failure); manual browser file/paste behaviour still needs user observation. This is a local development adapter, not yet a pure public-web OCR engine.

The manual JD-text entry has been removed by product decision. OCR now directly creates a browser-local `needs_review` record and opens the review UI. One intake accepts 1–4 screenshots belonging to the same JD; their raw evidence is stored separately and OCR/extraction output identifies each fact as `screenshot N + line N`. `rule_assisted_ocr_v1` is a narrow, fail-closed candidate extractor: it proposes title/location/seniority/salary only from visible text patterns; proposes company only from an explicit recruiter label or the explicit `公司基本信息` card; and proposes responsibility/requirement blocks only after recognised semantic headings such as `岗位职责` / `你会做的事情` / `任职要求`. Each proposal is displayed with the original image(s) and numbered raw OCR text. No proposal writes a job without human confirmation; absent/ambiguous data remains `unknown`. JD-014 two-image regression produced 78 lines, title and section evidence in screenshot 1; company stayed unknown because neither allowed company signal was visible.

**Prompt A/B result — keep v1 as default:** two truth-linked jobs were tested. For JD-001 (two screenshots rendered from public Tencent page; API JSON is truth), v1/v2 extracted the same visible 3 responsibilities and 5 requirements; both lacked the true fourth responsibility because it was outside the screenshot coverage. v2 reduced input 1,051 → 1,003 (-48) but completion increased 2,328 → 2,816, so total increased 3,379 → 3,819. For JD-002 (AI Agent engineer screenshot), v2 reduced total 1,882 → 1,557 but returned only 3 requirements where v1 returned 4 visible requirements; screenshot/Batch-truth requirement #4 disagreement is a snapshot-truth issue, but v2's omission relative to v1 is still a quality regression. Therefore `vision_extract_v1_full` remains default; do not choose v2 merely to save its small fixed prompt overhead. The current local directory has 12 unique screenshots, not 15, and only JD-001/JD-002 have a reliable truth binding; remaining images are not valid accuracy-scored A/B items until their user-owned JD grouping and reviewed truth are recorded.

**OCR / Vision decision evidence:** a five-image boundary sample (JD-002, JD-005, JD-006, JD-014 and the user-provided Alibaba qoder screenshot) found every selected header/section anchor, but still observed character substitutions, long-line truncation, CTA/UI text and at least one user-observed severe unreadable OCR segment. Therefore OCR is sufficient as a local evidence intake first pass, not as a correctness guarantee for detailed JD prose. `V4-Flash-Vision-Exp` is treated as the user's selected multimodal DeepSeek vision model. A direct-image vision request can inspect layout and pixels that OCR lost, but still cannot recover cropped/absent evidence or replace review. `app.py` now stores the user-provided Key in macOS Keychain and exposes a localhost-only `POST /api/vision-extract`; the UI enables the explicit AI button only after Key configuration and image selection. The request sends original images, not OCR text as its sole source, and requires an evidence-backed JSON result before a browser-local `needs_review` candidate is created. The exact experimental image schema/model availability is unverified until the first user-authorized response; HTTP/provider/schema failures write no job. The existing `model_assist_recommendation` remains a non-calling product cue and must not become an automatic trigger.

### BOSS direct-URL feasibility result

On 2026-08-23, the user authorized one exact BOSS job-URL probe. `scripts/probe_boss_jd.py` made one no-login/no-cookie/no-redirect/no-retry GET. It returned HTTP 302 with no body; query/visit/security parameters were not persisted, only the canonical URL and metadata file in `data/raw/`. This is a source/access failure, not an OCR/model/normalization failure. Do not follow the redirect, log in, reuse the access parameters, or retry without a new contract. BOSS is not currently an allowed reliable direct-ingestion source.

On 2026-08-23, the user separately authorized one exact new BOSS URL feasibility probe. A one-time no-login/no-cookie/no-redirect/no-retry GET again returned HTTP 302 with a zero-byte body and no job/embedded JSON marker. The full signed URL was not persisted. Therefore a generic “BOSS URL → Job Radar candidate” button would only produce an access failure. DeepSeek cannot extract a JD when the system has no raw JD content/image; an Agent/browser session also does not grant site access or permission to bypass redirects/login/anti-bot controls. Keep screenshot/vision as the user-owned fallback. A future URL parser remains feasible only for a source whose allowed HTTP/API response actually contains job content.

Tencent shows the contrasting source pattern: one exact no-login/no-cookie page GET returned HTTP 200 / 2,145-byte HTML bootstrap with no title or post ID, while the same page rendered in an ordinary browser after its public frontend requests and the already captured allowlisted Tencent `ByPostId` API returned JD-001 content. Thus “page HTML has no JD” does not equal “source cannot be read.” A URL input feature should be source-specific: recognise a Tencent canonical URL and its `postId` → call the allowed Tencent position API → normalize/review; it should not send the URL string itself to a model. BOSS remains a screenshot fallback under the current contract.

**Implemented URL check/import regression (2026-08-23):** `GET /api/source-link-status` identifies the supported Tencent canonical shape without network access. On the user-clicked import route, `POST /api/source-link-import` made one bounded Tencent `ByPostId` request for JD-001, returned HTTP 200 and generated only a browser-local `needs_review` candidate with source evidence; it did not write SQLite jobs or change `application_status`. The same status check for a BOSS URL returned `fallback_required` without an external BOSS request. `POST /api/text-candidate` produces the same review-only shape from pasted original text. This is a three-input intake surface, not generic URL crawling.

**Screenshot + link provenance:** when a user supplies screenshots and also types a link, OCR and vision candidates retain the canonicalised link alongside local image evidence. For sources such as BOSS that do not yield readable app content, this supports human revisit without storing signed query parameters or claiming direct ingestion. A model API receives screenshots/text when explicitly called; it does not itself open or bypass a URL.

**Recovered 14-JD link check:** the original Batch 06 intake thread was inspected on user request. JD-001 has the existing Tencent structured-source result; JD-003…JD-012 had recoverable BOSS links; JD-002 had one probable adjacent-thread BOSS link; JD-013/JD-014 had none. Eleven BOSS links each received one newly authorized, no-login/no-cookie/no-redirect/no-retry GET and all returned HTTP 302 with zero-byte bodies. The non-secret report is `data/raw/batch06-link-probe-2026-08-23.json`. This establishes a source-level BOSS access boundary across the available batch, not a one-link anomaly. Keep screenshots as BOSS content evidence; do not retry/follow redirects or build a generic BOSS parser.

**Generic link-read closeout:** one user-authorized Bambu Lab/Feishu position-page GET returned HTTP 200 and 129,011 bytes of HTML, but no supplied position ID or recognised embedded position JSON. It is an HTML shell, not a generic normalized-JD input. The product decision is now **link-as-provenance**: remove the local-first “test/import link” action; do not automatically read any source URL. A link plus screenshots/pasted original text is the default evidence bundle. Retain the already-built Tencent adapter only as dormant source-specific capability; re-enable it only under a future explicit source contract.

First validate and learn from multi-JD data intake. The next source-import design is deliberately narrow:

```text
allowed public URL → raw capture → source-specific deterministic parser
→ normalized candidate + provenance → duplicate/review decision → SQLite/UI
```

For a user-supplied screenshot/image, use an OCR extraction branch instead of a URL parser. A later model may assist candidate extraction or analysis only after raw evidence exists; it must retain evidence references and become `needs_review`, never silently overwrite source facts or application state. Do not fetch the existing BOSS links: their supplied URLs may include access parameters and were imported from local evidence instead.

After that narrow intake slice is verified across these records, select whether the first real Model API analysis should run on a bounded sample.

## Retained Model API foundation (not the active build)

Model API Phase — in progress, provider-independent system foundation. `src/model_analysis_pipeline.py` separates JD/provenance input from `model_instruction_v0.json`, then exposes a narrow provider adapter. `scripts/run_model_analysis.py --provider mock --scenario compliant` runs one local deterministic vertical slice: JD-001 → request → Mock Provider raw response → syntax/schema/boundary validation → idempotent `job_analyses(needs_review)` persistence. The user decided every capability must have `evidence_fields`; `--scenario missing_capability_evidence` now fails validation and does not persist. `--scenario invalid` receives a response but rejects it before persistence for forbidden `application_status`, self-approval, and claim without evidence. `contract_valid` means only structural/boundary validity; a contract-valid but semantically misleading output remains for human review. Input/raw hash, instruction version, provider/model identifiers and exact input/output JSON are retained with the analysis. No credential or network call has occurred. Next: user explain-back automatic ingestion → normalized source facts → model input/evidence chain, then select a real provider/model/credential decision.

`src/provider_registry.py` now adds uncalled OpenAI and DeepSeek request builders behind the same provider-independent input. OpenAI is configured for Responses `json_schema` strict output; DeepSeek is configured for JSON Output plus local validation. The user selected DeepSeek as the first real Provider. `scripts/call_model_api.py --provider deepseek --model <account-available-model-id>` is implemented but stops safely if `DEEPSEEK_API_KEY` is absent; it sends no request until the user configures the key and explicitly authorizes a call. It maps credential/network/provider/empty-output/syntax-schema-boundary failures to `do_not_persist`; only contract-valid output becomes a separate `needs_review` analysis. Other domestic providers remain future individual adapters after official capability/account checks.

## Still out of scope

No RAG, MCP, Agent, Vector DB, automatic application, login automation, cloud deployment, multi-source crawling, or automatic polling. Model API implementation still requires its own source/model/credential decision; Eval follows the Model API slice.

## Qwen Runtime Selection follow-up

- Implemented: by explicit user decision, Qwen's Add Model path asks only for its API Key and immediately runs one minimal text+synthetic-image readiness request to `qwen3.8-max`, with visible sending/waiting/verification/success-or-failure state.
- Acceptance action: refresh `http://localhost:8000/`, select Qwen, paste the API Key and press `连接并读取可用模型`. A response that returns `JOB RADAR TEST` enables the selectable model and ✓ completion. This is a real Provider call and may incur minimal usage; it sends no user career material.
- UI correction completed on 2026-08-27: Add Model is now a vertically resizable bottom sheet; Provider is a dropdown; the top-right action is check-only; trash clears the active Provider Key; the Key persists per Provider in browser `localStorage`; the guide link switches by Provider; and the connection button changes from label → spinner → standalone check without a separate visible status row. Browser storage is same-origin readable and is not equivalent to Keychain security.
- Runtime Selection correction completed on 2026-08-27: default DeepSeek now enters `OFFICIAL_READY` automatically, so the arrow works without reopening the menu. Added Qwen models and the chosen runtime persist in browser `localStorage`; Provider Keys stay in their separate Provider-scoped records. Local development canonicalizes `localhost` to `127.0.0.1` to avoid split storage. The selector/menu/action use the new rounded Apple-style gradual motion while retaining the existing monochrome palette.

## Current UI handoff — floating surfaces（2026-08-28）

- Treat `public/floating-window.js` as the shared interaction authority for current user-visible floating surfaces. Do not fork new one-off drag/resize logic for Add Model versus Personal/JD overlays.
- Current cache contracts are `runtime-ui-v47` and `v1-motion-20`. Saved detail is one continuous surface: detail left, scoped AI right, exactly one center divider. Do not reintroduce inner rounded-card borders/gaps unless the product decision changes.
- The header is the drag handle; four edges and four corners resize. Preserve viewport clamping, minimum-size handling and the iframe interaction shield. Closing must still animate back to the source selector/card from the current moved/resized rectangle.
- Keep scroll-end protection: 52px detail-pane safe padding, stable gutters, 14px track inset; import embeds retain 56px bottom padding plus 24px final-card margin. This is part of the rounded-surface acceptance contract.
- Verified locally with all 14 Node `.mjs` regressions and final-version browser measurement. No real Provider call was made. A future material change should add a browser touch/pointer accessibility pass; it must not change Candidate Context, Patch or conversation truth boundaries as a side effect.

## Current Workspace folder motion handoff（2026-08-28）

- Current V1 cache version is `v1-motion-26`.
- Keep `.v1-object-copy` and `.v1-object-count` inside `.v1-folder-front`; they represent ink on the same physical cover and must inherit its transform. Do not restore a high independent `translateZ` plane.
- Keep the papers visually overlapped at rest but on stable physical planes: back/paper-3/paper-2/paper-1/front use Z depths `-4/-3/-2/-1/0px`; paper z-index is `1/2/3`, front is `4`, index is `5`. Never return the front cover to `transform: none`.
- The visual contract is one sheet at rest, three continuously separated sheets on hover/focus, then front → middle → back continuous merging. Do not use display, visibility or abrupt opacity switching.
- Entrance uses `480ms` with `0/32/64ms` delays. Exit uses `500ms` with `0/40/80ms` front/middle/back delays; all papers finish by 580ms before the cover finishes at 640ms. This ordering and terminal depth are required to prevent layer crossing and the final compositor flash.
- Do not restore hover-animated `box-shadow`. Shadows are static; paper/front transition properties must remain transform plus color/border only. Preserve folder `contain: layout style`, `isolation: isolate` and animated-surface `backface-visibility: hidden`.
- Preserve JD color synchronization: the JD paper stack is dark at rest and the back/papers/lines/front/copy become light together on hover, focus or transition-light. Do not restore an always-white `.dark .v1-folder-paper` rule.
- Three real-pointer enter/leave cycles on both Personal and JD plus a rapid reversal returned to the same stable terminal transforms; all 14 Node regressions passed. No model/provider or domain-state behavior changed.

## Completed Figma MCP full-page import（2026-08-28）

- New-account target file: `https://www.figma.com/design/3XdQUI6Dd1BhGCZVhFOncF/Job-Radar-Web-first-V1-%E2%80%94-UI-Screens` (`fileKey=3XdQUI6Dd1BhGCZVhFOncF`). Authenticated handle was `OXOOOOX`; no purchase or plan mutation was initiated.
- Figma page `Job Radar — UI Screens` contains 20 named editable frames: 14 current public pages, Runtime Dropdown, Add New Model, Personal Import/Detail Overlay and JD Import/Detail Overlay.
- Runtime ASCII canvas and Add Model were captured from `runtime-ui-v47`; V1 routes and overlays were captured from `v1-motion-26`. Only sanitized fixture UI was included. API Keys, localStorage values, credentials and personal source files were not transmitted.
- Frames were cleaned, de-duplicated and arranged in Runtime / Workspace / Personal / JD / legacy groups. Add Model, Candidate local-only detail and Job local-only detail screenshots were visually inspected after import.
- The temporary Figma capture script was removed from every HTML file and original CSP rules were restored. Final check: 14 Node regressions, 17 JS syntax checks, 14 HTTP routes and zero remaining capture-script references.
- Next action: the user edits UI details in Figma, then supplies a node link or screenshot for selective code synchronization. Do not overwrite those user edits with a bulk re-capture.
## Current Ariadne UI / duplicate-intake handoff（updated 2026-09-01）

- User-facing product name is `Ariadne`. Keep technical database keys, legacy IDs, file names and the synthetic Provider readiness token unchanged unless a deliberate migration is planned.
- Current V1 cache contract is `v1-motion-32`. Preserve equal 18px library-card gaps, the centered 901/27/252 Workspace geometry, neutral `#f7f7f9` canvas, 20px soft-surface radius and all existing motion/floating-window contracts. Folder center is intentionally at 54vh and the tab overlaps the back body by 2px to avoid a visible missing corner.
- Duplicate intake authority lives in `public/v1-demo-domain.js`; UI policy lives in `public/v1-pages.js`. Always detect before persistence. Local resolution may deterministically merge/keep/cancel. Never treat model output as stored truth without an explicit Provider call, visible proposal, user decision and provenance.
- JD source URL is optional provenance only. Do not fetch it automatically. The current form reads `#job-link-input` and stores the value with the imported source.
- Import file transport is one full dashed click/drop target for PDF/PNG/JPG/JPEG/DOCX. JD exposes only `图像` and `粘贴文本`; do not restore separate PDF/Image tabs or visible format/“选择文件” copy.
- Candidate prompt routing lives in `src/candidate_context.py`; Resume / Portfolio / Project / Other have distinct grounded guidance and unsupported types fail closed. Browser metadata records a prompt-profile ID, but a real Provider call still requires explicit authorization.
- Current Figma file: <https://www.figma.com/design/3XdQUI6Dd1BhGCZVhFOncF?node-id=9-2>. Page `Ariadne — UI Screens` contains only the seven active design frames requested by the user. Do not bulk recapture over future user edits; inspect the edited node and synchronize selectively.
- The only intentionally incomplete acceptance item is a real model-assisted duplicate fusion/ingestion call. It requires explicit authorization of provider, model, bounded test content and possible cost before implementation/testing continues.
## Global interaction convergence acceptance handoff（2026-09-04）

- Status: `READY FOR J1 HUMAN ACCEPTANCE — GLOBAL INTERACTION CONVERGED`; Human acceptance is pending.
- Canonical evidence: `docs/current/ARIADNE_GLOBAL_INTERACTION_QA_REPORT.md` and `docs/current/ARIADNE_GLOBAL_INTERACTION_PARITY_AUDIT.md`.
- Product state: shared Candidate/Job source input, ordered bundles, guarded clipboard paste, processing indicator, Working/detail/edit shells and conversation primitives are implemented. Three-image Model Job, grounded page-chrome exclusion, clipboard/text paste, exact edit/conversation symbol parity, real waiting animation, Candidate × Job reasoning, Local Provider=0 and failure without Local fallback passed browser/regression gates.
- Next action: the Human reviews the retained browser Job Detail and QA screenshots, then records PASS or a concrete failing interaction. Do not begin J2 or alter frozen intelligence contracts unless acceptance reveals a regression.
- Repository boundary: no files are staged; no commit was made.

## Final product-contract addendum handoff（2026-09-04）

- Runtime import authority is `AriadneProductShell.dispatchRuntimeImport`; source-first authority is `AriadneSourceInput.persistDurableBundle`. Do not reintroduce an import-level Local/AI selector or a Model-to-Local retry.
- Job pasted text is now a first-class member of `selectedJobSources` and follows the same durable SourceDocument/body/integrity path as files, drag/drop and clipboard images.
- Candidate/Job Model flows are regression-locked against Local semantic structurers and Local review surfaces. Unsupported domain/model capability is a visible fail-closed precondition, not permission to run Local.
- Shared micro-feedback and reduced-motion contracts are in `public/styles.css`, driven by SourceInput, ProductShell, ModelWorkspaceUI, ConversationUI and ProcessingIndicator.
- Addendum browser and all 57 automated suites passed. No new Provider request, staging or commit occurred. Next action remains Human acceptance only.

## UI contract correction handoff（2026-09-04）

- Keep `AriadneProcessingIndicator.setButton()` and `.v1-processing-loop` as the single loading language for import, conversation waiting and busy submit. Do not restore the prior ornamental mesh/orb/glow treatment or a plain disabled-looking submit button.
- Keep every Candidate/Job composer on the exact ProductShell-required `.v1-conversation-form > .v1-composer-field > textarea + button` structure. Current shared geometry is `46 / 44 / 42 px`; do not add page-specific composer wrappers or dimensions.
- Job Model import copy is `使用人工智能解析`. The source UI should show the source card/list/actions only; provenance bodies, URLs and hashes remain durable even though the two verbose inline explanations stay hidden.
- Shared back/close hover is scale-only. The minibar is right-side and vertically centered; the top-right zone remains reserved for a future settings control, and no settings feature was added.
- Real desktop/mobile browser checks, Candidate/Job composer measurements, import WORKING, conversation WAITING, light consent action, back motion and minibar placement passed. A synthetic Model import separately demonstrated fail-closed `MODEL_FAILED` on schema-invalid Provider output with no Local fallback.
- Final automated gate is 58 suites (`38 Node + 20 Python`), 44 public JavaScript syntax checks and `git diff --check`; staged=0. Human acceptance is the only remaining action.

## Candidate ↔ Job parity repair handoff（2026-09-04）

- Status: Candidate current-card AI editing, shared Candidate/Job Detail edit shell and single ordered source preview are implemented and verified; Human acceptance remains pending.
- Acceptance target: on Candidate Material Detail, the required role-wording replacement must show a Candidate Working diff for the active Candidate Material, keep confirmed data unchanged before save and expose no internal ID or Job schema. Ordinary questions must remain discussion.
- Shared-shell target: Candidate and Job Edit must retain the same ProductShell roles and measured geometry. Keep Job canonical delete hidden unless the domain later gains an explicit, separately approved deletion contract.
- Provenance target: keep one ordered preview list while preserving every original source body, bundle order, hash/integrity metadata and Source Retrieval. Do not restore the duplicate summary block.
- Runtime boundary: Candidate conversation uses its own Provider tool contract and fails closed. Do not introduce Job semantics, Local semantic structuring or Model-to-Local fallback.
- Final evidence gate: `38 Node + 20 Python`, `44` public JS syntax checks, Python compilation, real Candidate/Job browser checks, zero console errors and `git diff --check` passed. No staging or commit was performed. Next action is Human J1 acceptance only.

## Detail behavioral wiring stabilization handoff（2026-09-04）

- Status: the Human-reported Candidate submit, Job response projection and Edit focus failures were reproduced, traced to their first broken owners, repaired and re-verified in the real browser. The previous READY claim was not reused as evidence.
- Keep `AriadneProductShell.bindConversationAdapter()` as the single shared composer binding. Bind once, then resolve domain availability and active target at submit; do not return to initialization-time conditional listeners.
- Keep explicit adapters: Candidate targets the active Candidate item and projects `PATCH_ITEM` into Candidate Working; Job targets the active revision and compiles confirmed Job + CandidateContext + connected history. Neither adapter may mutate confirmed state before Human Save.
- Keep `createDetailEditController()` as the owner of enter/cancel/preview/back/focus behavior for both detail forms. Do not reintroduce page-specific listener forks or center-scroll behavior that can leave the first Job field off-screen.
- Provider validation must preserve `network_call_made=true` after transmission. Optional Job `source_need` advisory mismatches may be dropped, but the required action/message contract remains strict and fail-closed.
- Acceptance evidence: fresh Candidate `把长期兼职改成兼职` → `PATCH_ITEM` → Working → Human Save; Job exact two-turn sequence → grounded Provider answers with no Working and no pre-save mutation; final browser errors and ID leaks zero.
- Final automated gate: `39 Node + 20 Python`, 44 public JS syntax checks, Python compilation and diff checks. Model runtime is restored and the local service remains running. Human J1 acceptance is the only next action; do not start J2, stage or commit.

## Computer-use-first E2E handoff（2026-09-05）

- Status: final visible A–E is complete on the real Candidate and Job workspaces. Human J1 acceptance is the only next product decision; do not start J2.
- Keep Candidate explicit replacement as Provider semantic `PATCH_ITEM` and Job explicit deletion as `PROPOSE_JOB_EDIT`. Discussion must remain non-mutating. Never introduce Model→Local fallback or local semantic correction.
- Keep Candidate workspace-v2 direct Edit on the Working → Workspace Acceptance → confirmed revision route. Do not call the legacy proposal-review direct-edit path for workspace-v2 revisions, and clear obsolete Working UI after a successful direct Save.
- Keep Job delete absent until an explicit canonical deletion contract is approved. Candidate delete is supported and remains visible.
- Acceptance baseline: real Provider `deepseek-v4-pro`; Save-before/after isolation and reopen checks passed; no visible internal IDs; post-fix console errors `0`; Local Provider calls `0`.
- Final gate: `40 Node + 20 Python`, `44` public JavaScript syntax checks, Python compilation and diff checks. No files were staged or committed; keep the local service available for Human acceptance.
## Final J1 checkpoint handoff（2026-09-05）

- J1 Candidate Material integrity is complete. Preserve the Candidate Material Card → Candidate Material Detail flow: durable source first, technical preparation, Provider semantics, NON_AUTHORITATIVE Working, Human Save, confirmed revision, reopen/current-state verification.
- Preserve Candidate item-scoped context compiler v2 and the three-layer Human Copy boundary. Structured references may support grounding but must never render as Candidate/Job IDs, fingerprints, requirement refs, or turn-local aliases.
- Preserve runtime isolation: Local Candidate and Local Job Provider calls are exactly zero; Model failure is `MODEL_FAILED`; never route a failed Model intent through Local semantics.
- Preserve source provenance across click, drag/drop, clipboard image, ordered multi-image bundle, and pasted text. Do not discard original source bodies or regress Source Retrieval.
- Frozen Job smoke is green. Do not broaden Job scope while using this checkpoint as the J1 baseline.
- Regression baseline: Node `40/40`, executable Python `21/21`, JavaScript syntax `84/84`, Python compile PASS, HTTP `10/10`, final console errors `0`, visible-copy ID leaks `0`.
- Deferred: J2, Web Search, automatic application, scoring, and general product polish.
