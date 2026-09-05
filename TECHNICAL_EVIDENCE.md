# AI Job Radar｜Technical Evidence

## 2026-09-05｜Bounded J1 Candidate Material conversation hotfix evidence

This supersedes earlier Candidate Material browser PASS claims, which Human usage disproved. Browser evidence here is from the normal `http://127.0.0.1:8000/` session, 1280×720, through Personal Information → Candidate Material Card → embedded Candidate Material Detail, using real typing/clicking and DeepSeek. No direct runtime invocation, mock event, or Provider test endpoint is counted as browser acceptance.

### First broken boundary and owner

The first user-visible NO was `submit_enabled`. Input was present and shared binding/domain/Model-operation selection existed. The causal owner was `candidateWorkingModelForDetail()` in `public/v1-pages.js`: it required the confirmed item identity to exist in a stored Working model, and threw `candidate_detail_item_not_in_working_model`. The observed source had Working versions but none contained the active legacy confirmed item. Initialization caught that failure and disabled Send. Classification: `ACTIVE_MATERIAL_BINDING` at the embedded Detail boundary, not an absent input handler or a Job-only adapter.

| Boundary | Broken baseline | Repaired real Work Experience discussion |
| --- | --- | --- |
| input_state_present | YES | YES |
| submit_enabled | NO | YES |
| submit_event_fired | NO | YES |
| conversation_binding_present | YES | YES |
| candidate_domain_selected | YES | YES |
| active_candidate_material_resolved | NO | YES |
| mode_model | YES | YES |
| operation_resolved | YES | YES |
| runtime_compatible | YES | YES |
| context_compiled | Not reached | YES |
| provider_called | NO | YES |
| provider_returned | Not reached | YES |
| response_valid | Not reached | YES |
| result_projected | Not reached | YES |
| assistant_rendered | NO new response | YES |

Evidence combines DOM input/Send/submit state, visible Processing/Assistant, and the existing allowlisted server acceptance diagnostic after validation (`EXPLAIN`, no Working proposal, no confirmed mutation). No credentials, private material bodies, or Provider reasoning are copied into this record. Earlier automated fixtures began with already-bound Working items; new integration coverage executes the actual Detail resolver with a missing legacy item and tests repeat-open idempotence.

### Repair and failure coverage

- Only the active confirmed item is bootstrapped into the newest source Working head, with original item/source identity and confirmed provenance retained. Existing Working items and pending edits are preserved. No import rerun or confirmed write occurs on open/discussion.
- Legacy Human Save/direct Edit advances Working and the existing confirmed context atomically, rejecting either stale Working or stale confirmed lineage. Workspace-v2 Save remains on its existing acceptance path. Parent Personal Information refreshes after closing the saved Detail.
- ITEM Provider context excludes the other-material directory; current-item content and relevant bounded history remain. Regression verifies unrelated synthetic titles are absent from the outbound request.
- One real Project request timed out at the Provider read boundary. Closing/reopening while it was pending also exposed a durable interrupted turn. Detail reopen now expires active records older than five minutes through existing guarded failure persistence, preserving the user message and writing no Assistant/action/Working/confirmed output. Fresh active turns are not expired. The Project retry returned a visible real Assistant answer.
- One final mutation response failed parsing (`MALFORMED_RESPONSE`); the UI showed failure and preserved confirmed state. One unchanged-prompt retry produced a real `PATCH_ITEM`, visible before/after Working, Human Save, refreshed Candidate Material Card, reopened Detail, and a subsequent Assistant answer with the saved value.
- Local direct Edit was tested while the model pane was hidden: zero Provider/POST calls across the observed 105-second Local window. Restoring Model and discussing the same material demonstrated the latest direct-edited title, not stale Working.

### Automated evidence (not a substitute for browser evidence)

17 Node suites passed: `candidate_model_runtime_regression`, `detail_behavioral_wiring_regression`, `candidate_workspace_conversation_integration_regression`, `candidate_conversation_domain_regression`, `candidate_conversation_persistence_regression`, `candidate_local_model_isolation_regression`, `candidate_context_regression`, `local_candidate_review_regression`, `candidate_context_removal_regression`, `personal_local_pipeline_stabilization_regression`, `final_candidate_job_parity_regression`, `runtime_capability_gating_regression`, `runtime_operation_routing_stabilization_regression`, `runtime_execution_contract_regression`, `runtime_selection_regression`, `shared_product_shell_regression`, and `ui_contract_addendum_regression` (all under `tests/`, `.mjs`). New integration checks cover missing-item bootstrap, repeat-open, EXPLAIN without mutation, atomic legacy Save/conflicts, expired-turn recovery, and the newest Candidate title in both conversation and newly built Job CandidateContext.

8 Python suites passed: `candidate_conversation_runtime_regression`, `candidate_workspace_route_contract_regression`, `candidate_context_provider_regression`, `candidate_model_runtime_regression`, `runtime_capability_gating_regression`, `runtime_execution_contract_regression`, `provider_runtime_regression`, and `job_conversation_runtime_regression` (under `tests/`, `.py`, run with `PYTHONPATH=.`). This includes 15 unittest cases and six executable assertion suites. Also passed: syntax for the three changed public JS files and five changed JS test files; Python compilation of `app.py`, the changed Candidate runtime and its test; `git diff --check`.

Final representative discussions, mutation/Save/reopen/current-state, and repeat Local isolation all passed. The initial Job smoke returned HTTP 422 / `JOB_EDIT_INVALID` after a real Provider call, with no new Assistant. Read-only execution of `resolveJobDetailReferent()` mapped the ordinary question with “不修改任何内容” to `job_edit_requested=true`; without that negative clause it mapped to false. Work paused at that mandatory gate. Its exact malformed Provider edit field remains unknown and no private response body was retained for diagnosis.

The Human subsequently authorized fixing this bounded defect and one additional Job smoke. `public/job-conversation-domain.js` now masks explicitly negated edit verbs only for routing, retaining the original Human message and separate affirmative edits. The Job foundation suite adds 10 non-edit and 6 affirmative/mixed-intent examples, including avoiding false negation for “分别修改” and “特别修改”. Total final gates: 18 Node suites (the 17 above plus `job_intelligence_foundation_regression.mjs`), the same 8 Python suites, 10 JS syntax targets (the 8 above plus the changed Job domain and its test), and the same 3 Python compilation targets.

The one authorized additional browser call used the identical failed question on the same existing Job Detail. Send enabled → visible Processing → DeepSeek → HTTP 200 → new visible Assistant answer passed. The allowlisted server diagnostic recorded `ASK_CLARIFICATION`, `working_proposal_created=no`, `confirmed_mutation_before_save=no`, and `assistant_copy_source=PROVIDER`. The visible answer summarized the core Job requirement; the normalized envelope is not described as EXPLAIN. Console warnings/errors were 0. There was no Job mutation, Save, prompt redesign, or further Provider retry. Candidate implementation was unchanged in this extension, and its completed browser evidence remains applicable. Overall hotfix gates are now satisfied.

Browser screenshots were displayed during verification and were not added to the repository. The viewport began at 1280×720 and was later resized to 733×581; no comprehensive responsive-design claim is made. The pre-existing private untracked QA screenshot remains untouched and must not be staged.

## 82. Figma-aligned workspace, native dropzones, and one-time duplicate consolidation（2026-08-31）

- Design evidence：Figma file `3XdQUI6Dd1BhGCZVhFOncF` nodes `9:2 / 13:2 / 14:2` 作为这次 code implementation authority。Workspace CSS 使用 1060 px max grid、32 px gap、297 px folder、`top:9.4%` front、`top:18.67% / height:61.77%` paper；982×782 浏览器实测 grid `x=42 / y=190 / w=898`，folders `433×297`，wordmark x=477、font 12/800，数量为 Candidate 3 / Job 1。
- Duplicate migration：`consolidateCandidateRecords()` / `consolidateJobRecords()` 以现有 duplicate score `>=0.72` 分组，按 `updated_at + id` 保留最早记录，复用 deterministic merge 汇总 facts/requirements/source refs/imported sources/uncertainties，并由 `consolidateExistingDuplicatesOnce()` 写入 `duplicate-consolidation-2026-08-31-v1` marker 后删除 duplicate keys。纯函数 regression 覆盖 3→1 Candidate 与 2→1 Job；浏览器实际 Personal 9→3。
- Import state evidence：Personal/JD 共用 `installFileDropzone()`；dragenter/dragover 只更新局部 visual state，drop 把第一个本地文件交给原 source preview。JD `configureJobImportType()` 默认 PDF，Image accept 为 PNG/JPG/JPEG，Paste 在第三个 tab；浏览器点击验证 tab order、`aria-pressed`、hidden states 与 accept/copy 同步，粘贴 23 字符后 processing button 正确启用。
- Truth boundary：本次 file surface 只改善选择/拖拽与 metadata flow，没有把本地文件误记为已由模型理解；一次性清理只作用于 `demo_*` stores，正式 Candidate/Career truth 未改。未来模型融合仍必须在 action-time Provider approval 后生成 proposal，并经人工确认。
- Regression：14 Node regressions、全部 Python regressions、17 public JS syntax、14 public HTML HTTP 200。无 Provider request、credential access、career material upload 或 billable inference。

## 81. Local import identity, full-width cards, and editable Figma subset（2026-08-31）

- Failure diagnosis：Personal import 的入口、fixture 选择、五阶段状态与完成消息均正常；“无反应”来自 `seedCandidateFixtures()` 每次以同一组 `demo-*` ID 执行 `put`，完成后只是覆盖原记录，library 数量和可见卡片不变。
- Local fix：新增 `importLocalCandidateFixtures()`，为每个本地批次生成唯一 `item_id`，保留来源元数据并强制 `recognition_mode: LOCAL / network_sent: false / ai_recognized: false`。浏览器实测 `beforeCards=4 / afterCards=7 / errors=[]`。
- Truth boundary：`isAIRecognizedRecord()` 对 `network_sent === false` 与 `recognition_mode === LOCAL` 先行返回 false；回归覆盖“本地记录残留 provider/model/ai_recognized”仍不得显示 AI。真实模型调用路径和已识别对象的 scoped conversation / Patch 均未改动。
- Layout evidence：`.v1-card-grid` 为 `repeat(auto-fit, minmax(min(100%, 300px), 1fr))`。1280 页面实测 grid `1149px`，3 列均为 `371px`，首行 x 为 `42 / 431 / 820`；不再按 masonry 顺序只填左半边。`.v1-conversation-message` 为 flex、`align-items:center`、`min-height:48px`、上下 `13px` padding。
- Figma evidence：文件 `3XdQUI6Dd1BhGCZVhFOncF` 的 `Job Radar — UI Screens` 只剩 7 个指定 Frame；每个顶层 `layoutMode=NONE`，所有后代 `autoLayoutDescendants=0`。旧 04E 不是完整顶层 Frame，已补建 `64:2`，截图确认职位信息/AI 对话中文双栏存在。没有 Provider/API/credential 操作。

## 80. Chinese UI, source-aware AI visibility, and editable Figma sync（2026-08-28）

- Localization boundary：用户界面 chrome、导航、状态、说明和演示数据统一为中文；模型名称、API/文件格式等技术标识以及来源原文不改写。旧 demo fixture 通过 `copy_locale: "zh-CN"` 做增量迁移，旧 conversation 只在 render path 翻译，不破坏 IndexedDB 中的用户消息。
- AI visibility contract：`isAIRecognizedRecord()` 先尊重 `network_sent === false`，其余仅在 `ai_recognized` 或明确 provider/model + `network_sent === true` 时返回 true。Candidate/Job detail 由同一个 `setAIRecognitionState()` 切换 `v1-ai-capable` 与 AI pane；local records 为单栏，model-recognized records 为双栏并保留 conversation / patch review。
- Browser evidence：Workspace hero/step/index 数量均为 0，字标中心与 `documentElement.clientWidth` / page shell 中心偏差均小于 0.01 px（`window.innerWidth` 额外包含 15 px 浏览器滚动条）；Personal intro 数量为 0；local Candidate 的 AI pane 为 hidden、单列 849 px，AI preview 的 pane 为 flex、双列 `458.453px 390.547px`，标题为“只讨论当前材料”。核心页面未发现未允许的可见英文 UI。
- Figma evidence：页面 `Job Radar — UI Screens` 共有 22 个 Frame、1443 个 Text 节点、STEP text 数量 0；Workspace brand node `9:7` 是可编辑 TEXT，中心与 Workspace frame 中心完全一致；local Candidate/Job 无 AI，模型识别 Candidate/Job 均有 AI。Job AI frame `47:114` 截图复核为中文双栏页面。
- Regression：4 个关键 JavaScript syntax 与全部 14 个 Node `.mjs` 通过；没有 Provider/API、Key、Career Material 或付费调用。

## 79. Import guide cards use the same in-page reversible overlay（2026-08-28）

- Interaction routing：`installDetailCardOverlay()` 的 delegated selector 从 saved `.v1-candidate-card` 扩展为 `.v1-candidate-card, .v1-add-guide-card`，且仍先于 legacy card-page transition 注册。Guide click 会设置 `data-overlay-kind="import"`，把 hover 时的白色 surface 锁定到 preview clone，再用与 saved card 相同的 540 ms open / 480 ms close motion；正常路径不替换父文档。
- Embedded import：iframe 加载现有 `/personal-import.html?embed=1` 或 `/jd-import.html?embed=1`。Embedded CSS 隐藏重复 topbar/minibar，保持导入页内部滚动、圆角 import card 与原控件；表单状态、Browser File API 元数据、sanitized fixture 和 processing state machine 全部仍由原 initializer 执行。
- Completion contract：`completeEmbeddedImport()` 只向 `window.location.origin` 发送 `job-radar-v1-import-complete`，父层同时校验 `event.origin`、`event.source === frame.contentWindow`、library/page 对应关系。父层在反向动画完成后调用原 `renderPersonalLibrary()` / `renderJobLibrary()`，再 focus `sourceKey`，避免先刷新 DOM 导致收回终点丢失。
- Browser evidence：Personal source `335×285`、JD source `335×330`；两者 final surface 都是 643.195×557.594，ratio `0.79999 / 0.79999`。Personal × 关闭后 URL 不变、overlay hidden、source visible；两条 fixture completion 后 URL 仍为 library、overlay hidden、guide visible，saved card 数分别为 3/1，focus key 准确。截图确认两张导入页均完整显示在圆角悬浮面板内。
- Regression：V1 `v1-motion-18`；13/13 Node `.mjs`、16 个 public JS syntax、8/8 HTTP pages 与 `git diff --check` 通过；无 Provider/API 请求。

## 78. Stored cards use a same-origin 80% reversible detail overlay（2026-08-28）

- Root cause：普通已保存卡片仍命中旧的 card clone → full-page navigation → arrival cover 链路；即使颜色已对齐，浏览器在文档替换和 iframe-like内容重建交接点仍可能产生一帧闪动。现在 `.v1-candidate-card` 在 Personal/JD library 内由 `installDetailCardOverlay()` 优先接管，不触发 document navigation。
- Motion contract：打开时以来源 card 的实时 `getBoundingClientRect()` 为起点，540 ms 连续插值到居中的 `80vw × 80vh`；关闭时重新读取当前来源 rect，480 ms 反向收回。source 在动画期只设为 hidden，完成后恢复并 focus；backdrop、Esc 与无外框 × 复用同一关闭状态机。
- Content contract：overlay iframe 只加载原详情 URL 并增加 `embed=1`。embedded mode 隐藏详情页 topbar/minibar，把现有 `.v1-split-view` 固定为 `minmax(0,1.08fr) minmax(280px,.92fr)`，信息与 scoped AI pane 各自使用 22 px 圆角、边框与 `overflow:auto`。因此数据读取、Direct Edit、Patch proposal 与 conversation persistence 均保持原实现。
- Browser evidence：在 804×697 视口中，Personal 与 JD surface 都实测为 643.195×557.594，ratio 为 `0.79999 / 0.79999`；iframe grid 为 `309px 280px`、gap 16 px、pane 数量 2。Personal src 为 `candidate-detail.html?item=demo-project-job-radar&embed=1`，JD src 为 `job-detail.html?job=demo-job-ai-product-manager&embed=1`。关闭中间帧位于 surface 与来源卡之间，结束后 overlay hidden、source visible；导入引导卡仍创建原 card transition layer 并导航到 import page。
- Regression：V1 cache 为 `v1-motion-17`；16 个 public JavaScript syntax、13 个 Node `.mjs`、6 个非历史-fixture Python scripts、8 个 localhost 页面和 `git diff --check` 通过。没有 Provider/API 请求。

## 77. Workspace folder route uses opacity-only navigation（2026-08-28）

- Video diagnosis：Workspace folder click 仍命中 `.v1-object-folder` 的 shared card transition selector，产生 folder clone → full-screen surface，再由 Personal/JD page shell fade-in；两段动画在 navigation handoff 叠加，导致用户录屏中的闪烁与颜色不一致。
- Implementation：`transitionSourceSelector` 现在只保留 `.v1-candidate-card, .v1-add-guide-card`；Workspace folder 与指向 `/workspace.html` 的 back link 由 `pageFadeSourceSelector` 单独处理。出场先清除 stale card route state，再添加 `v1-route-leaving`，320 ms 后导航；不创建 clone、cover 或 surface color animation。
- CSS root cause：`animation-fill-mode: both` 让已结束的 page fade keyframe 持续覆盖 route-leaving opacity。V1 `v1-motion-14` 改为无 persistent fill 的 420 ms entry animation；route leaving 为 320 ms opacity-only，transform 固定 `translateY(0)`，body 始终使用 `--paper: #f7f7f9`。
- Browser evidence：Workspace out `1 / .259687 / .057848 / .008094`；Personal in `0 / .628976 / .882248 / .964278 / .993097 / 1`。Personal back → Workspace 与 Workspace → JD 同样连续；每个采样点 `cardLayerCount = 0`、background `rgb(247,247,249)`。
- Regression：16 个 public JS syntax、13 Node `.mjs`、6 个非历史-fixture Python scripts、8 localhost HTTP pages 与 `git diff --check` 通过；未调用 Provider。

## 76. Card surface color interpolation and folder foreground isolation（2026-08-28）

- Video diagnosis：录屏中 add card 扩大后的最后一帧是 `#fff`，目标 import page 首帧是 `--paper: #f7f7f9`，即使页面 shell fade 正确，navigation handoff 仍会形成瞬时色温变化。`pagePaperColor()` 现在直接读取 body design token，并作为 Web Animation 的目标/起始 `backgroundColor`；正向为 `#fff → --paper`，反向为 `--paper → #fff`。
- Browser color samples（V1 `v1-motion-12`）：forward layer `rgb(253,253,254) → rgb(248,248,250) → rgb(247,247,249)`；destination body 与 arrival cover 都是 `rgb(247,247,249)`。这验证的是实际 computed color，不只是静态 CSS contract。
- Folder diagnosis：前盖 hover 的 `rotateX(-30deg)` 创建了独立 3D plane，旧 `translateZ(1px)` 文字会在动画中被盖住并在 leave 时重新出现，表现为闪动。`.v1-object-index`、`.v1-object-copy`、`.v1-object-count` 现固定为 `translateZ(96px)`，folder anchor 本身保持 `transform: none`；copy/count 使用 `bottom: 68px / 34px` 放置在下半部。
- Browser folder samples：Personal copy 在 hover 与 500 ms leave 后 relative top 都为 `208.1893615722656px`、opacity `1`、color `rgb(31,34,42)`；目视截图确认开盖时 Personal/JD 文字均持续显示。
- Regression：16 个 public JS syntax、13 Node `.mjs`、6 个非历史-fixture Python scripts、8 localhost HTTP pages 与 `git diff --check` 通过。既有 `career_entity_regression.py::test_real_portfolio` 仍在未改动的历史 fixture assertion 失败；本轮没有改其 source/fixture，也没有 Provider call。

## 75. Folder text compositing and fade color continuity（2026-08-28）

- Pre-fix risk：`.v1-object-folder:hover { filter: drop-shadow(...) }` 让包含标题文字的整张 anchor 在 hover/leave 时进入并退出独立 filter layer，造成文字抗锯齿栅格短暂变化。修复后 folder transition 不再包含 filter；shadow 由 back layer 的 box-shadow 承担，文字三层使用 stable `translateZ(1px)` / `backface-visibility: hidden`。
- Browser text sample：Personal copy 在 rest、hover、leave 55 ms、leave 205 ms、settled 均为 opacity `1`、`rgb(31,34,42)`、matrix3d translateZ(1)；folder computed filter 始终 `none`。
- Fade sample：body 永久 background `rgb(247,247,249)` / opacity `1`；Workspace leaving、Personal arrival 45 ms、Personal final 三段保持相同。只有 page shell 从约 `0.04` 到 `1`，不再通过 body fade 暴露默认白色/偏黄色底层。
- Cache：七个 V1 HTML 使用 `v1-motion-10`。变更只涉及 CSS motion/compositing 与 cache references；没有 Provider、IndexedDB、Candidate/Job truth 或 API 行为。

## 74. Video-matched folder / minibar / card transition regression（2026-08-28）

- Folder contract：三层 paper 的闭合 `--paper-y` 为 `18 / 12 / 6px`，hover 都只减去同一个 `12px`，因此 hover 与 leave 全程保持 6 px 相对层级，不再出现各层向不同方向散出的视觉。front hover 实测 `rotateX(-30deg)` matrix3d；闭合后回到 `18 / 12 / 6px`，三层 DOM 与边缘持续存在。
- Minibar contract：固定区域实测 `right: 8px`，804 px 视口中 rail 位于 `744–796px`，Workspace tooltip 位于左侧 `648–754px`。hover Workspace 时四段宽度约为 `29.3 / 34.0 / 30.3 / 20.8px`，active 为最长且 opacity `1`；label 与 dash 都在右侧 rail 内连续移动。
- Card forward sampling：120 ms 为原卡片连续放大且内容完整；340 ms 为接近全屏的同一白色卡片；470 ms 为内容柔和渐隐而不是突然 blank；导航后 arrival cover 与详情 page shell 交叉淡入，最终 body/shell opacity 均为 `1`、cover 已移除。未再观察到录屏中的黑/白瞬时跳帧或双层内容闪动。
- 自动回归：16 个 public JS syntax、13/13 Node `.mjs`、7 个 UI 无关 Python regressions、8/8 localhost HTTP 与 `git diff --check` 通过。`career_entity_regression.py::test_real_portfolio` 是既有 fixture assertion，未由本轮修改引入。没有 Provider/API、Key 或 Career Material 操作。

## 73. Motion continuity browser regression（2026-08-28）

- Add Model pre-fix browser sample：叉号 click 后 50 ms，panel 仍为 `matrix(1,0,0,1,...)`、opacity `1`，随后直接 hidden。修复后 55 ms 为 scale `0.846` / opacity `.359` / blur `2.78px`，200 ms 为 scale `0.769` / opacity ≈ 0；panel 与 Runtime selector 中心均约为 `(368.5,312.6)`。380 ms 后 sheet hidden、Runtime menu expanded，第二次打开 animationName 仍为 `add-model-float-expand`。
- Folder pre-fix sample：离场 80 ms 时 paper translations 已从 `-20/-32/-46` 回到约 `0/0.5/0.7px`，视觉上被 front 快速吞没。修复后 80 ms 仍为约 `-10.9/-12.0/-14.4px`，560 ms 后回到三层稳定槽位；closed visible caps 为 `34.4/24.8/15.1px`。
- White transition sample：Personal guide idle `rgb(32,35,42)`、hover/forward clone `rgb(255,255,255)`；JD guide 同值；JD folder hover/clone front 为 `rgb(255,255,255)`、text 为 `rgb(31,34,42)`。反向收回时 layer 与 target 都保持 `v1-transition-light`，layer 移除后 target 从中间灰度平滑回到 `rgb(32,35,42)`。
- Route robustness：card route key 忽略仅用于 cache-busting 的 `v` query，因此从带 `?v=v1-motion-8` 的页面进入后仍能走反向卡片动画；`item` / `job` 等业务 query 继续保留。
- Browser console warning/error = 0；自动与 HTTP 回归同 PROJECT_STATUS 最新条目。没有 API Key 输入、Provider request、职业资料读取或 truth mutation。

## 72. Runtime / Workspace motion refinement（2026-08-27）

- Runtime cache contract：`index.html` 使用 `runtime-ui-v44`；`add-model-sheet.js` 根据触发按钮中心写入 `--add-model-origin-x/y/scale`，430 ms 正向放大与 380 ms 反向收回复用 `close()`。Qwen verified 后 360 ms 自动 complete，再走同一 close path；没有重复的 success navigation 分支。
- Minibar contract：`.v1-mini-sidebar` 外部宽度保持 52 px；item 高度由 6 px 在 proximity 时过渡为 11 px，active dash 静止宽 14 px / opacity `.88`。mouse Y 距离场仍驱动连续宽度波形；切页改为 220 ms fade，不再使用旧 bloom overlay。
- Workspace visual contract：每个 folder 都有 back、front 与 3 个 paper layer，hover transform 分别为 `-20 / -32 / -46 px` 并带轻微 `rotateX`；DOM 不再含 `v1-object-arrow` 或 `v1-folder-tab`。Personal guide card 使用 black→white hover；`.v1-back` 与 `.v1-add-guide-icon` 为 symbol-only。
- Card route contract：`sessionStorage` 只保存 origin、destination 与 source key；正向 clone 从 source rect 放大至 viewport，反向从 viewport 收回 source rect。Candidate/Job fixture import 完成后定位到新生成卡片；不改变 Candidate/Job truth、Provider 或 IndexedDB schema。
- Regression evidence：`node --check` 通过 `v1-pages.js`、`add-model-sheet.js`、`runtime-selection.js`、`ascii-waves.js`；13/13 Node regression files 通过；8/8 localhost 页面返回 200；`git diff --check` 通过。自动浏览器 reload 被本地 URL 安全策略拒绝，故本条不声称新的 browser screenshot/console pass。

## 71. Reference mini sidebar motion（2026-08-27）

- Reference：`/Users/kai/Downloads/ScreenRecording_08-27-2026 00-05-00_1.mov`；只读分析 0.5 秒间隔帧，原始视频保持原位。
- Implementation：`v1-pages.js` 注入 4-item semantic nav；pointer Y 到各 dash center 的距离经 Gaussian `exp(-0.5 * (distance / 46)^2)` 转为连续 influence，再分别生成 width/opacity/scaleY targets。requestAnimationFrame spring 使用 stiffness `0.17` / damping `0.72` 收敛；label 跟随当前最近 dash，并保留 top/width/opacity/scale 与文字 blur/fade。
- Responsive/accessibility：desktop threshold 821 px；mobile 保留现有 menu；links 有 aria-label / aria-current，focus 与 pointer 共用动效，reduced-motion 将 transition 降至 1 ms。
- Cache：五个 V1 页面为 `styles.css` 与 `v1-pages.js` 使用 `mini-sidebar-2` query，确保本地浏览器立即加载连续 fisheye 更新。
- Browser evidence：桌面宽 1260 时 rail visible/menu hidden。靠近 Personal 时四项宽度约为 `45.5 / 52.0 / 39.9 / 25.5`；靠近 JD 时变为 `35.7 / 43.0 / 52.0 / 42.1`；离场后恢复各自 `31 / 24 / 11 / 17` 基线，label state=false，console error=0。

## 70. Web-first V1 STEP 02–03 fixture UI framework（2026-08-27）

- 新页面：`workspace.html`、`personal-information.html`、`candidate-detail.html`、`jd.html`、`job-detail.html`；共享状态/交互在 `v1-pages.js`，fixture 与 browser-local contract 在 `v1-demo-domain.js`。
- Candidate fixtures 严格为 `DEMO_FIXTURE + NEEDS_REVIEW`，类型恰为 Work / Project / Education。文件 input 本轮只读取 name/type/size metadata；页面脚本不包含 provider `fetch`。
- Candidate mutation boundary：Conversation message → fixture Patch Proposal → Before/After/Why → accept/reject；Direct Edit → preview → confirm。两者只写 `demo_candidate_items`，不写 `candidate_contexts`。
- Job 使用独立 `job-radar-job-context-v1` 与 `demo_job_contexts`；Conversation contract additive 支持 `JOB`，并由 `compileJobContext` 只编译当前 Job。没有 per-requirement chat、match score、application 或 Career Model mutation。
- IndexedDB 从 v9 additive 升至 v10；所有旧 opener 同步版本并包含四个 `demo_*` stores，避免高版本 DB 被旧页面以 v9 打开时产生 VersionError。
- Test evidence：`step_02_03_ui_framework_regression.mjs` 27 checks pass；全部 Node tests 12/12 files pass；全部 Python regression scripts pass；浏览器导入、状态、卡片、Patch、Direct Edit、刷新持久化、JD 5 requirements、JOB conversation 与移动断点通过，console error = 0。

## 64. Product Architecture V2 Gate Closeout（2026-08-25）

- `PRODUCT ARCHITECTURE V2 = FROZEN / CONFIRMED`；`Architecture Gate = COMPLETE`；`Implementation = NOT STARTED`。
- 当前最高 authority：`docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。
- 当前唯一 next milestone：`STEP 1 — ONE REAL RESUME / CANDIDATE IMPORT + HUMAN CALIBRATION`；完整链为 `Resume PDF → SourceDocument → DeepSeek consent → real ProcessingRun states → structured CandidateItem Proposal → Work/Project/Education Cards → Human Review → Direct Edit → card-scoped AI Correction → Context Patch → Before/After/Why → User Confirm → CandidateContext persisted → close/reopen → confirmed Cards remain`。
- 本 Closeout 只同步文档；没有开始 Step 1，没有修改 production code、UI、schema、SQLite、IndexedDB、Provider、credential、Figma 或 Git。
- 排除：Portfolio、Job Import、Match、Resume generation、Capability Card、Career Mentor、Architecture redesign、旧 CareerEntity migration、OCR benchmark、MCP/RAG/Agent/Skill/CLI。
- 历史 Career Intelligence V0、CapabilityBoundary/CareerDirectionHypothesis、CareerEntity AI path 与 Architecture Research 均不是 current next action。它们在本文件后续章节中只作为 timestamped technical evidence 保留。
- 硬原则维持：Card-first Human Calibration；Candidate Context semantic truth / Cards review views；user final authority；Direct Edit 零 LLM；AI Correction 为 task-scoped Patch proposal；Minimum Necessary Change later；Passit downstream baseline；CareerStack/KarriereVault candidate references；reference-first；Git/GitHub code versioning；CandidateContext user-data revision；Figma design authority；DeepSeek first。

## 63. Product Architecture V2 Final Consolidation（2026-08-25）

- Actual repo：localhost `app.py` + SQLite（14 jobs / 1 mock analysis）+ browser IndexedDB v7；AI path 仍为 SourceDocument → DeepSeek rendered pages → Canonical Markdown artifact → accepted AI profile，尚无 CandidateItem/Patch/ProcessingRun durable contract。
- SourceDocument/DocumentBlock/native extraction/Apple Vision/OCR 保留为 infrastructure；CareerEntity 决定为 `DEPRECATE FROM AI MAIN FLOW / LEGACY-OFFLINE INTERMEDIATE / REPLACE LATER`。
- Credential 使用 macOS Keychain；current model/account capability 必须在实现前按 DeepSeek 官方文档与 account listing 重新 preflight。JSON Output 仍需 local validation，并处理 empty/malformed response。
- Reference-first 采用 Passit JD–Evidence Matrix/Gap Interview、jobsearch-mcp review-before-save/changed-only、Open Career Format stable ID/provenance/review/lineage、Teal master→targeted view、Careerflow before/after review；不引入 MCP/Qdrant/Valkey/Docker/Tauri/Rust/RAG。
- Git audit：Workspace/Job Radar 均不是 Git worktree；`.gitignore` 仅含 Python cache。Figma audit：当前 Codex Figma plugin 为 `not_installed`。本 Gate 未执行 Git/Figma/Provider/生产变更。
- Architecture output：`docs/architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。

## 2026-08-24 — AI result observability and flexible-context correction

- 浏览器 AI send flow 现在明确分为资料传输确认、可能费用确认、发送中、已返回或失败；失败响应保留 `network_call_made` 语义，前端不再停留在“将发送”文案。
- `ai_career_contexts` 是唯一的 AI 结果 store。旧 `career_entities` 仅由本地高级 fallback 生成，页面明确标注其来源，避免把空字段或错误分类误判为 DeepSeek 输出。
- `canonical_career_context_v2_flexible` 要求输出只表达来源支持的字段；不能稳定映射的内容进入“待人工归类的原文片段”，并保留原文、页码与不确定原因。该灵活 Markdown 是审核面，不会强行转换为固定 Entity schema。
- `data/domain_contracts/canonical_career_context_v2_flexible.json` 将这一灵活审核边界显式化：AI artifact 不是 confirmed CareerEntity，且必须与 Local fallback entities 分离。
- 服务日志记录用户在旧 UI 中主动触发了多次 `/api/ai-career-ingest`，后端获得 DeepSeek HTTP 200；其中一次客户端在响应写回时断开。服务端按合同不持久化职业资料或模型正文，旧 UI 未可靠显示响应，故不能从日志复原或声称这些 AI 输出质量；后续必须在新版“AI 已返回”卡中逐项审核。
- UX 收敛：AI artifact 区的 Markdown 默认折叠；所有旧 Local Entity 审核、Control Center 与导出区作为一个默认折叠的高级 fallback。此改变不修改 IndexedDB 记录、原始文件、AI artifact 或 Local Entity 数据。
- 完整闭环：IndexedDB v7 新增 `ai_career_profiles`。AI Context Markdown 的二级标题被显示为可编辑的、非固定 schema 信息卡；用户确认后保存 Profile snapshot、生成 `MY_CAREER_PROFILE.md` 下载，并导航到 `career-profile.html`。两项确认与显式 progress state 阻止未确认发送和发送中的重复点击。
- Profile reader：`career-profile.js` 对已确认 Profile 区块进行安全的轻量 Markdown 渲染，默认去除正文中的审计 marker/页码并保留字段、子标题和列表；每块的证据行可折叠查看，下载仍保持完整原始 Markdown。

## 2026-08-24 — DeepSeek complete Career PDF adapter / AI-first UI

- 账号模型清单实际返回 `deepseek-v4-flash-vision-exp`；DeepSeek document preflight 不发送职业资料，仅确认该账号可用模型。
- AI contract 改为 `supports_complete_document_review + document_delivery`：DeepSeek 为 `rendered_pdf_pages`，Gemini 为 `original_pdf`。两者在产品层均是完整职业资料验证，来源 hash、模型、prompt version、review status 与本地 artifact persistence 不变。
- DeepSeek 发送前仅用 `pdftoppm` 在临时目录渲染完整 PDF 页面；不运行 Local parser、DocumentBlock、OCR text mapping 或 CareerEntity derivation。临时页不进入项目目录、SQLite 或 IndexedDB。
- UI 将 DeepSeek 设为默认完整资料验证 Provider，并将 Local Mode/本地解析记忆折叠为高级离线 fallback。Python/JS 合同回归与浏览器模型预检通过；未发送职业材料。

## 2026-08-24 — Career Intelligence V0 proposal/review slice

- 新增 `career_intelligence_v0` 合同及浏览器本地 `career_intelligence` IndexedDB v6 store；既有 store、SQLite、SourceDocument、CareerEntity 与 Evidence 均未迁移或改写。
- `confirmed CareerEvidence + GET /api/jobs` 可生成 CapabilityBoundary、InterestSignal、CareerDirectionHypothesis（最多 4）与 OpenQuestion；每项初始 `needs_review`，Confirm/Reject 与 CapabilityBoundary semantic state 通过刷新验证保留。
- 回归覆盖：confirmed evidence 可支持命名 capability；独立软件工程实现保持 `UNVERIFIED`；JD 导入信号明确不是 confirmed preference；方向均为 `PENDING_USER_CONFIRMATION`；OpenQuestion 明确声明会改变何种 Career Model 校准。
- 隔离 localhost 浏览器验证生成 1 个 `UNVERIFIED` capability boundary、14 个 observed interests、2 个 direction hypotheses、2 个 open questions；Confirm 后刷新仍显示 confirmed，控制台 0 errors。该隔离测试不是用户事实审核。

## 2026-08-24 — Formal Handover boundary

- `P4.1A` remains complete and production-usable; `P4.1B` remains in progress at the Gemini credential/model preflight gate; `Career Intelligence V0` is not started.
- This handover is documentation-only. No production code, schema, OCR, Provider, IndexedDB or UI changed in this synchronization pass.
- The next product slice is deliberately narrower than full matching: existing confirmed CareerEvidence and JD records will propose CapabilityBoundary, InterestSignal, CareerDirectionHypothesis and OpenQuestions for Human Review and local persistence.
- Learning boundary: Codex/AI implementation is `Tool-assisted Implementation`; user-owned capability evidence is recorded only when the user personally defines, predicts, judges, diagnoses, accepts, explains or makes a trade-off. This project is building AI Product / AI Systems Product judgment, not independent coding drills.

## 2026-08-24 — P4.1B product architecture decision

- **P4.1A:** Local / No-AI Career Material Ingestion is complete and production-usable for current scope. The accepted architecture and mapping closeout remain unchanged.
- **P4.1B:** AI-Assisted Career Material Ingestion is the active bounded milestone. Its default data flow sends the preserved original Resume/Portfolio directly to a configured multimodal provider, then validates and stores a high-fidelity Canonical Career Context Markdown artifact locally.
- **Mode boundary:** Local and AI are alternative modes. No automatic voting, fusion, consensus, ensemble parsing or required dual execution is part of product behavior.
- **Evaluation boundary:** intentional dual execution may be logged during development; original source inspection plus user judgment adjudicates disagreements.
- **Improvement boundary:** repeated source-confirmed Local errors justify targeted parser/mapping fixes and regressions, not renewed OCR framework shopping. AI errors are handled through prompt, output contract, context strategy and validation revisions.
- **Phase gate:** P4.2 remains not started until P4.1B reaches a usable baseline.

### Implemented vertical slice and evidence

- Added `src/ai_provider_capabilities.py` and updated `src/ai_career_ingestion.py`: capability records separate TEXT, IMAGE and direct PDF; Gemini direct-document payload validates exact original PDF bytes/hash and Chinese-first source-type-specific Markdown. It has no dependency on `src/career_evidence.py` or DocumentBlock.
- Added browser-local `ai_career_contexts` via additive IndexedDB v5. Artifact metadata includes source hash/ID, provider, model, prompt version, generated time, review status, Markdown, usage and original-source preservation.
- Cache regression proves only accepted artifacts with identical source hash/provider/model/prompt version are reusable. Changed source/model/prompt and needs_review artifacts do not suppress a future call; explicit regenerate bypasses reuse.
- Real input preflight: Touchine Resume PDF passed file/hash/SourceDocument validation but was not sent. Gemini preflight returned HTTP 428 `gemini_key_not_configured`, `network_call_made=false`, `persistence=not_written`.
- Browser/UI smoke: AI Mode exposes Gemini direct-PDF preflight, DeepSeek text preflight and provider-specific consent; Local Mode remains visible and independent; no Career Material was uploaded to Gemini.
- Regression: AI Python/JS contracts pass; complete real Local Resume/Portfolio grouping matrix, CareerEntity, confirmed-only CareerEvidence, Phase 3 rollback, Python compile and browser JavaScript syntax pass.
- A real direct-PDF AI quality result remains unknown until the external Gemini credential/tier boundary is crossed by the user. No fabricated Canonical Markdown fixture is reported as a real result.

### 2026-08-24 — P4.1B capability-aware provider priority and Chinese output

- **Provider boundary:** `src/ai_provider_capabilities.py` records the same explicit fields for DeepSeek, Gemini and Groq, including separate `supports_text`, `supports_image` and `supports_direct_pdf`. DeepSeek is TEXT-only for this route; Gemini is the first direct-original-PDF target; Groq is capability-registered only and has no direct-PDF adapter. OpenAI is not configured, requested or called for P4.1B.
- **Real bounded check:** the existing macOS Keychain DeepSeek credential was used for one user-authorized small Chinese text request. The account model listing selected `deepseek-v4-flash`; the response was `预检成功`; no career document, browser artifact, SQLite record or repository secret was written.
- **Gemini gate:** no Gemini Keychain/environment credential exists. `/api/ai-providers/gemini/document-preflight` therefore returned HTTP 428 before any provider request. The page now offers the matching Keychain-only configuration entry and, after a future model listing, requires provider-specific acknowledgement of Google’s free-tier privacy/usage notice before one direct-PDF send.
- **Presentation contract:** Canonical Markdown headings and epistemic markers are Chinese-first (`[原文明确支持]` / `[AI 解释]` / `[原文未明确 / 未知]`). Stable internal keys and source-language names, titles, tools and quotations remain unchanged.

## 2026-08-24 — Document Understanding foundation benchmark and freeze

- **User-owned decision:** benchmark general local capability on the full real corpus; preserve Entity-first review, local privacy, unsupported-field emptiness and provenance; prefer the simpler architecture when practical accuracy is similar.
- **Corpus/eval:** 20 documents / 305 pages classified by family/layout/format/text mode. Six selected truth documents all pass; 20/20 extract without crashes. Four non-Kai documents remain benchmark-only.
- **Winner:** native document blocks → selective Apple Vision V1 Auto for unusable PDF pages → GapTree-style ordering only for OCR Resume pages → DocumentBlock v1 → separate Resume/Portfolio grouping. Global GapTree and blind native/OCR overlap fusion were rejected by grouping regressions.
- **Challengers:** Paddle PP-StructureV3 completed one page in 725.617s with ~4GB observed RSS and read CASE `01` as `O1`; Docling completed in 35.615s with typed provenance but no Entity gain; Surya failed because its current local path requires llama-server/vLLM, and its model license is unsuitable for default integration.
- **Real fixes:** image-only English CV now produces 1 Basics / 3 Work / 2 Education / 1 Skills; architecture Portfolio produces four numbered Projects; Tencent Resume PDF/DOCX stay at 13 entities; Tencent Portfolio stays at four projects including `[4,5]`. Missing dates/outcomes remain null/empty.
- **Regression:** Python CareerEntity normal/failure/real fixtures, JS review/confirmed-only Evidence derivation, Phase 3 rollback, Node syntax, Swift typecheck, JSON validation, full corpus and HTTP extractor-v2 smoke pass.
- **Ownership boundary:** product/privacy constraints and benchmark interpretation are user-owned. Parser/adapters/implementation/regression are Codex-assisted and do not upgrade independent coding evidence.
- **Freeze:** `CAREER DOCUMENT UNDERSTANDING FOUNDATION = COMPLETE / ARCHITECTURE BENCHMARKED AND FROZEN`. No P4.2, cloud document model, RAG, MCP or Agent work started.

## 状态

- 审计起点：只读项目检查，2026-08-18（Asia/Shanghai）
- 当前状态：`v0_complete / local_only / one_real_jd / learning_evidence_closed`
- Master V1 Priority：`COMPLETE / V0`; 下一阶段仅在用户明确启动后进入。
- 进入条件：Mac Setup 已于 2026-08-21 完成并冻结；Job Radar 现在按 V0 普通软件/API/SQL 顺序推进，不直接进入 LLM/RAG/MCP/Agent。
- 代码修改：2026-08-21 至 2026-08-23 完成最小本地实现、字段扩展与详情 UI；无外部服务、无模型调用。
- 结论等级：V0 实现与本地运行检查 `verified_local`；用户对核心数据/API 概念有 L1 / L1 Apply 证据，独立 SQL/API coding、完整 diagnosis/fix/regression 与外部 ingestion 仍待后续实践。

## 1. 证据范围与发现

| Evidence ID | 事实 | 来源 / 位置 | 状态 |
| --- | --- | --- | --- |
| JR-EV-001 | 在本次审计输出创建前，项目工作目录为空；除本文件外未发现 README、源代码、配置、依赖、测试、运行或部署记录 | `03_projects/job-radar/`；2026-08-18 只读目录盘点 | sourced_by_inventory |
| JR-EV-002 | Batch 04 代码项目入口为空，未发现可导入的 Job Radar 项目材料 | `00_inbox/batch-04-code-projects/`；2026-08-18 只读目录盘点 | sourced_by_inventory |
| JR-EV-003 | 主控规范将 AI Job Radar 定义为主线项目，并规划 V0–V7 演进路线 | `AI_Systems_Learning_OS_启动与维护规范.md` §4.1 | sourced |
| JR-EV-004 | 只读审计开始时，Project Index 将 AI Job Radar 标为 `not_started / unknown`；本次已增量更新为更精确的审计状态 | `05_system/PROJECT_INDEX.md`；2026-08-18 审计前读取 | sourced_by_readonly_inspection |
| JR-EV-005 | 现有 Knowledge Map 的通用等级来自 Lovable、BusinessCard、Workspace 等历史材料，不是 Job Radar 实践认证 | `02_learning/KNOWLEDGE_MAP.md`；`05_system/batch_manifests/BATCH_03_INTAKE.md` | sourced |
| JR-EV-006 | 外部 `shenzhen_job_sample.md` 是时效性岗位样本，不是 Job Radar 应用实现 | `/Users/kai/Documents/Codex/2026-08-16/Lovable多月体验复盘_AI建站边界与产品分析/work/lovable_ai_pm_research/shenzhen_job_sample.md` | sourced / out_of_scope |

## 2. Problem 分析

### 当前能确认的 Problem

主控规范表达了一个方向：把职位发现与求职相关任务，从普通职位网站逐步升级为可评估的 AI / Agent 系统。V0 先处理普通职位网站，后续再增加 JD 解析、智能搜索、知识问答、自动获取职位和工作流自动化。

### 仍未冻结的 Problem 要素

以下内容没有项目证据，必须在实现前确认：

- 目标用户：本人、求职者群体、招聘方，或其他角色；
- 首个 Job-to-be-Done：发现职位、筛选职位、理解 JD、比较岗位，还是追踪申请状态；
- 职位来源：手工录入、公开 API、网页采集、导入文件，或混合来源；
- 数据新鲜度、重复职位处理、来源可信度和失效职位处理；
- “有用”的定义：节省时间、提高匹配质量、减少漏看，还是更好地解释岗位要求；
- 成功指标、失败案例、隐私边界和可公开展示范围。

因此，当前 Problem 状态是：`direction_defined / MVP_problem_unknown`。

## 3. Architecture 分析

### 已有架构证据

没有。当前项目目录和 Batch 04 入口均没有代码或架构文件。

### 主控规范中的目标演进

| 版本 | 目标能力 | 计划引入的核心概念 | 当前证据状态 |
| --- | --- | --- | --- |
| V0 | 普通职位网站 | HTML、Frontend、Backend、API、Database、SQL | planned only |
| V1 | AI 自动解析 JD | LLM、Prompt、Model API、JSON、Structured Output | planned only |
| V2 | 职位智能搜索 | Embedding、Semantic Search | planned only |
| V3 | 职位知识问答 | Retrieval、RAG、Chunk、Context | planned only |
| V4 | 自动获取职位 | Tool Calling、Browser / Search / API | planned only |
| V5 | 连接多个服务 | MCP、Permissions | planned only |
| V6 | 自动完成找工作工作流 | Agent、State、Approval、Retry、Fallback | planned only |
| V7 | 验证系统是否变好 | Dataset、Eval、Metrics、Failure Cases、Observability、Cost | planned only |

这是一张路线图，不是现有系统的组件清单。尤其不能从路线图反推出已使用 React、某个数据库、某个模型、RAG、MCP 或 Agent。

## 4. Data Flow 分析

当前没有可以运行、截图、日志或代码定位的数据流。下面只记录根据路线图整理出的待验证假设：

| 阶段 | 可能的数据流 | 尚缺的实现证据 |
| --- | --- | --- |
| V0 | 职位输入 → Backend/API → Database/SQL → Frontend 展示与查询 | 输入格式、API 契约、schema、查询、错误处理、运行结果 |
| V1 | JD 文本 → Model API → JSON/Structured Output → 校验与保存 → UI 展示 | Prompt、模型、schema、解析失败、人工修正与版本记录 |
| V2–V3 | 职位/用户问题 → Embedding 或 Retrieval → 排序/上下文 → 搜索或回答 | chunk、向量模型、ranking、检索质量、引用与失败样本 |
| V4–V5 | Search/Browser/API/Tool → 权限检查 → 外部结果 → 规范化存储 | 工具 schema、权限、限流、超时、来源与回退 |
| V6–V7 | 用户目标 → State/Workflow/Agent → Tools → Approval/Retry/Fallback → 日志与评测 | 状态持久化、停止条件、评测集、指标、trace、成本与安全日志 |

结论：目前只能说“目标数据流尚待实现和观察”，不能说系统已经具备上述链路。

## 5. 已有技术与实现状态

| 类别 | Job Radar 当前状态 | 可追溯证据 |
| --- | --- | --- |
| 前端 | unknown；无代码 | JR-EV-001、JR-EV-003 |
| Backend / API | unknown；无代码 | JR-EV-001、JR-EV-003 |
| Database / SQL | unknown；无 schema 或查询 | JR-EV-001、JR-EV-003 |
| LLM / Structured Output | unknown；无模型调用或输出样本 | JR-EV-001、JR-EV-003 |
| Embedding / Retrieval / RAG | unknown；无索引、检索或评测 | JR-EV-001、JR-EV-003 |
| Search / Browser / Tool / MCP | unknown；无工具调用或权限记录 | JR-EV-001、JR-EV-003 |
| Agent / State / Eval / Observability | unknown；无状态图、数据集、指标或日志 | JR-EV-001、JR-EV-003 |

历史材料中出现的 React/Vite、SwiftUI、OCR、JSON 存储、Git、浏览器和文件索引经验，属于其他项目或工作流，不能自动归入 Job Radar 技术栈。参见 `01_profile/AI_EXPERIENCE.md` 与 `05_system/batch_manifests/BATCH_03_INTAKE.md`。

## 6. 复杂度分析

### 当前复杂度

当前没有实现，因此工程复杂度为 `not_applicable`；主要工作是定义问题与建立可验证的 V0 边界。

### 完整路线的预期复杂度

如果一次实施 V0–V7，系统复杂度将达到高水平。关键复杂度不是页面数量，而是跨层状态和证据链：

| 复杂度来源 | 为什么复杂 | 当前状态 |
| --- | --- | --- |
| 职位数据 | 来源、时效、重复、失效、版权/隐私和可追溯性互相影响 | unknown |
| LLM 解析 | 输出不稳定、字段缺失、事实幻觉、schema 失败和模型版本变化 | planned |
| 搜索与检索 | 关键词/语义/混合检索、排序、召回与相关性的权衡 | planned |
| 外部工具 | 权限、限流、超时、来源可信度和回退路径 | planned |
| Agent 工作流 | 状态、停止条件、重试、人工审批和副作用控制 | planned |
| 生产评测 | Golden Set、失败分类、指标、日志、成本和可重复回归 | planned |

建议复杂度策略：先把 V0 做成可解释的普通软件闭环，再一次只引入 1–2 个新概念；这与主控规范 §4.1 和 §11.1 一致。

## 7. 用户知识缺口与掌握边界

Job Radar 专属知识等级已写入 `02_learning/KNOWLEDGE_MAP.md`。本次审计可确认的缺口为：

1. V0：前后端、HTTP request/response、API、数据库 schema、SQL、错误处理和部署回滚；
2. V1：模型 API、Prompt 版本、JSON schema、结构化输出校验与失败处理；
3. V2–V3：embedding、chunk、semantic search、ranking、retrieval、RAG、context construction 与检索评测；
4. V4–V5：tool/function calling、Browser/Search/API、MCP、权限与人工审批；
5. V6–V7：state、workflow、retry、fallback、dataset、eval、metrics、logging、tracing、latency、cost、security。

这些是“需要通过项目验证的知识缺口”，不是对用户能力的最终判断。当前总体 Knowledge Map 中的 Level 1/2 partial 只说明用户在其他案例中有部分接触或分析证据。

## 8. Codex 已完成但用户尚未真正理解的部分

- **Job Radar 本项目**：`none_verified`。没有代码、配置或自动生成实现可供归因。
- **可迁移的历史黑箱风险**：BusinessCard 的 OCR、字段抽取、JSON 存储、搜索与打包流程，以及 Lovable 官网中生成的 React/平台实现，已有来源证明其存在或被使用，但用户独立解释、修改和诊断程度仍标为 `needs_review` / `partial`；它们不能被包装成 Job Radar 已完成能力。
- **未来必须设置的理解门槛**：每个由 Codex 协助实现的模块，都要保留真实输入、输出、中间状态、至少一个失败案例、替代方案和用户自己的解释。否则只能标记为 `codex_assisted / user_understanding_unknown`。

## 9. 当前待确认项

本轮不替用户做下一步选择，保留以下决策入口：

- 是否把个人求职职位整理作为 V0 的唯一用户场景；
- V0 是手工导入小数据集，还是接入一个真实职位来源；
- V0 是否只做列表、筛选、详情和状态记录，不引入 LLM；
- V0 的最小验收标准、失败案例和可展示证据是什么。

下一步只有在用户决定后再执行；本轮没有创建代码、依赖或运行环境。

## 10. V0 实现与验证（2026-08-21）

### 实际架构与数据流

```text
data/jd-001.json
  → data/schema.sql（固定数据契约）
  → data/job_radar.db（SQLite 持久化）
  → GET /api/jobs?location=深圳（SQL 查询）
  → public/app.js（HTTP 请求）
  → public/index.html（职位卡）
```

这是单机、本地、无依赖的学习闭环，不是生产招聘系统。

| Evidence ID | 事实 | 来源 / 位置 | 状态 |
| --- | --- | --- | --- |
| JR-EV-007 | V0 使用固定 JSON、SQLite、普通 HTTP API 与原生浏览器 UI；无第三方依赖 | `README.md`、`app.py`、`data/schema.sql`、`public/` | verified_local |
| JR-EV-008 | 表包含稳定 ID、JD 事实、来源定位、抓取日期、发布时间、招聘状态和投递状态；`review_status` 因当前输入均已人工筛选而不进入 V0 | `data/schema.sql`、`data/jd-001.json`；2026-08-21 用户字段决策 | verified_scope |
| JR-EV-009 | `published_date` 为 SQLite `NULL`，UI/API 显示为 unknown；`posting_status` 与 `application_status` 均为 `unknown`，未伪造外部或个人状态 | `data/jd-001.json`、`data/schema.sql`、API response | verified_local |
| JR-EV-010 | 正常、空结果与不存在 ID 的 API 行为均通过本地 HTTP 检查 | `GET /api/jobs?location=深圳`、`GET /api/jobs?location=上海`、`GET /api/jobs/JD-999`；2026-08-21 | verified_local |

### 当前学习边界

- V0 产物存在、可运行，并保留一条可观察的 Input → Data Structure → Storage → Query → Output → Failure 链路。
- 用户对 Record / Field / Schema / unknown 已有概念 L1 证据；用户尚未亲自运行、改动 SQL/API 或诊断失败，不能升级为 Persistence、SQL、HTTP/API 的 L2。
- Model API 仍在 V1 之后；V0 不新增 LLM、RAG、MCP、Agent 或 Vector DB。

## 11. V0 用户状态写入（2026-08-21）

- **产品问题：** JD 的发布时间与招聘状态来自外部证据；“我是否投递”是用户自己的可变状态，必须分开保存。
- **实际链路：** 浏览器状态选择 → `POST /api/jobs/JD-001/application-status` + JSON body → API 验证允许值 → SQL `UPDATE` → SQLite → API 返回更新后的记录 → UI 重查显示。
- **验证：** `not_applied` 写入后由详情 API 读回；不存在的 `made_up` 状态被拒绝并返回 HTTP 400；测试后记录已恢复为 `application_status = unknown`。
- **学习边界：** 这新增了“写入”与“API 输入验证”的可观察材料；用户仍需亲自完成一次状态修改、刷新观察与失败判断，才能作为 API/Persistence 的用户应用证据。

## 12. Learning-Driven Build Checkpoint 01（2026-08-22）

- **用户实际操作：** 用户将 JD-001 的 `application_status` 从 `unknown` 改为 `applied`，并确认页面刷新后状态仍为 `applied`。
- **用户解释证据：** 能区分 SQLite 是数据储存位置、SQL 是向 SQLite 查询/更新的语言；能判断 server 未运行时请求不能到达 API，指定但不存在的 JD 返回 404，而集合查询无结果返回 200 + 空列表。
- **校正记录：** 当前 POST 不是“修改意见”的专有请求，而是向 server 提交数据/请求动作；本例提交 `{application_status: "applied"}`。实际输出链路是 API 验证 → SQL UPDATE → SQLite → API 返回更新记录 → 浏览器再 GET 查询并渲染。
- **Current Level：** Runtime/HTTP route、GET/POST、SQLite/SQL、用户状态持久化达到 L1；本次是用户主导的 Apply evidence。L2 不升级：尚无用户主导 schema/query 修改、完整 failure 定位、fix 与 regression。
- **下一缺口：** 查询意图与 API 语义：为什么集合空结果是 200 + `[]`，指定记录不存在是 404；下一轮只在用户回答后进行最小验证，不自动新增功能。

## 13. Learning-Driven Build Checkpoint 02（2026-08-22）

- **用户解释证据：** 用户将地点输入“上海”解释为浏览器请求 → app.py 查询 → 页面不显示岗位；经校正后能区分“查询成功但没有匹配记录”与“查询失败/指定资源不存在”。
- **实际语义：** `GET /api/jobs?location=上海` 是集合查询。JD-001 依然存在，只是不匹配该条件，因此 API 以 HTTP 200 返回空 `jobs` 列表，页面显示无匹配岗位。
- **Current Level：** 集合查询与指定资源查询的 API 语义达到 L1；尚未由用户修改查询条件、读写 SQL 或完成失败定位与回归，不能判为 L2。
- **下一缺口：** 用户主导地改变一个查询规则，并在修改前预测 Data Structure → Query → Product Output 的变化。

## 14. Learning-Driven Build Checkpoint 03（2026-08-23）

- **用户解释证据：** 用户能区分浏览器输入的临时状态、运行中 `app.py` 的 Runtime state 与 SQLite `.db` 的 Persistent state；关于 SQLite 刷新后“会消失”的表述已由用户说明为笔误，实际理解为持久化数据会保留。
- **Current Level：** 浏览器状态 / Runtime / 持久化状态的责任边界达到 L1。
- **下一缺口：** API 返回 JSON 数据而非最终页面；用户需要能区分 API output 与 `app.js` 的页面渲染责任。

## 15. Learning-Driven Build Checkpoint 04（2026-08-23）

- **用户实际观察：** 用户直接打开 `GET /api/jobs?q=腾讯`，读到包含 JD-001 的 JSON `jobs` 数组与 `count: 1`，并能说明 API 返回的是完整结构化信息，`app.js` 将其转成可读职位卡。
- **校正记录：** schema 约定字段和允许的数据形态，并不安排界面；HTML/CSS 负责页面位置与视觉布局，`app.js` 负责把 API 返回字段映射进入页面。
- **Current Level：** API JSON response 与 browser rendering 的责任边界达到 L1。
- **下一缺口：** 页面并不会展示 API 返回的每个字段；需要由产品决定哪个字段应展示、隐藏或仅用于内部追溯。

## 16. Learning-Driven Build Checkpoint 05（2026-08-23）

- **用户主导决定：** 职位卡不显示 `captured_date`；`published_date` 继续显示；`source_path` 保留作冲突或验证时的证据追溯，但不面向普通职位卡。
- **最小实现与回归：** 仅从 `public/app.js` 的职位卡模板移除 `captured_date` 行；SQLite 和 API JSON 都仍保留该字段，职位卡不再显示“保存日期”，仍显示“发布日期”。`source_path` 原本就未在职位卡显示，不是本次代码变更。
- **Current Level：** 用户主导字段可见性决策，能预测 Storage / API 不变而 UI 映射变化；达到 L1 Apply evidence。
- **下一缺口：** `file://` 直接打开静态 HTML 与 `http://127.0.0.1:8000/` 经由运行中 server 打开时，API 相对路径为何有不同结果。

## 17. Learning-Driven Build Checkpoint 06（2026-08-23）

- **自然 failure：** 用户从 Finder 直接打开 `public/index.html`，页面静态结构出现，但搜索点击没有反应，也没有 API 错误文本。
- **定位：** HTML 已加载；`file://` 下的绝对资源路径 `/app.js` 解析为 `file:///app.js`，不是项目 `public/app.js`，所以浏览器行为脚本未加载。请求未发出，API、app.py、SQL 和 SQLite 都没有被调用。
- **修复/边界：** 不为 `file://` 增加兼容代码。项目的正确运行入口是 `http://127.0.0.1:8000/`，由运行中的 app.py 同时提供 HTML、app.js 和 API。该入口回归已验证。
- **Current Level：** 用户能从“页面有结构、点击无行为”判断问题优先在 JavaScript 资源加载，而非 SQL；HTTP origin / 静态资源路径边界达到 L1。
- **下一缺口：** 同一份数据库数据可有集合 API 和单条详情 API；需要理解为什么产品通常不让列表页一次返回所有追溯字段。

## 18. Learning-Driven Build Checkpoint 07（2026-08-23）

- **用户决定与证据：** 用户提供 `https://careers.tencent.com/jobdesc.html?postId=2055186895503273984` 作为 JD-001 的真实 `source_url`。自动抓取官方页面超时，故本项目将其标记为 user-provided，未声称独立验证。
- **最小实现：** schema 新增可为空 `source_url`；启动时安全迁移已有 SQLite 表并补写空值；列表 API 在原有 `GET /api/jobs` response 中加入该字段；职位卡仅在 URL 已知时显示“打开原始职位链接”。
- **验证：** SQLite 中 JD-001 已保存 URL；`GET /api/jobs?q=腾讯` 返回 `source_url`；浏览器职位卡显示对应链接。原有 `application_status = applied` 保留。
- **用户解释证据：** 能说明未新增 route，因为 HTTP method 与 path 没变；能说明 API 输出变更是同一 handler 的查询和 JSON 新增 `source_url` 字段。
- **Current Level：** Schema / persistence / API payload / UI mapping 的最小字段扩展，以及 API route 与 response field 的区分：L1 Apply。
- **下一缺口：** 详情 endpoint 是现有 route，但页面尚未让用户进入详情；下一步由用户定义“点开一条 JD 时，哪些追溯信息才应该出现”。

## 19. Learning-Driven Build Checkpoint 08（2026-08-23）

- **用户主导决定：** 列表以独立“查看详情”按钮进入，避免与复制标题或打开来源链接冲突；详情显示 `source_path`、职责与任职要求。
- **最小实现与验证：** 职责与任职要求以有序 lists 写入 seed JSON、SQLite JSON text 字段；`GET /api/jobs/JD-001` 将它们返回为 JSON arrays。点击详情按钮后页面显示 4 条职责、5 条要求和本地证据路径，request label 为 `GET /api/jobs/JD-001`。
- **用户解释证据：** 能说明列表应保持简洁，长内容按需经详情 API 获取；能区分 JSON 是结构化输入/传输格式、SQLite 是支持 SQL 查询与持久化的数据库。已校正 API handler、SQL、schema 和 UI render 的责任边界。
- **Current Level：** Collection/detail API、结构化 list 数据、JSON / SQLite boundary：L1 Apply。
- **下一缺口：** V0 不再增加功能；进行一轮用户主导的端到端 acceptance + failure regression，确认每一层的正常与失败行为。

## 20. V0 Final Acceptance & Learning Closeout（2026-08-23）

- **正常路径已验证：** `GET /api/jobs?q=腾讯` 返回一个职位集合并显示一张职位卡；用户点击“查看详情”后，`GET /api/jobs/JD-001` 返回一条 record，页面显示 4 条职责、5 条要求与 `source_path`。
- **失败回归已验证：** `GET /api/jobs?q=上海` 返回 HTTP 200 与空 `jobs` 列表；`GET /api/jobs/JD-999` 返回 HTTP 404 与 `job_not_found`。用户最终能明确说明“上海是职位集合的筛选条件；JD-999 是一条具体职位记录的 ID”。
- **V0 Exit：** 单条真实 JD → fixed schema → SQLite persistence → SQL list/detail query → HTTP GET/POST API → browser list/detail → user-owned status 的闭环完成。无 LLM、Model API、RAG、MCP、Agent、Vector DB、外部抓取、账号或云部署。
- **Current Learning Level：** Structured record/schema/unknown、SQLite/SQL、HTTP/API、JSON/UI rendering、collection/detail、route/response、状态持久化、failure classification 均有可信 L1 / L1 Apply evidence。L2 不升级：复杂 schema/query 的独立修改、完整 debug fix/regression、外部数据同步与评估仍主要由 Codex 或尚未发生。
- **下一学习边界：** 只有用户决定开始下一阶段时，才进入外部 HTTP data source / source freshness / duplicate / update 的设计；Model API 与技能缺口推断继续排在其后，不能提前启动。

## 21. External HTTP Raw-Capture Milestone 01（2026-08-23）

- **允许范围：** 用户确认唯一允许来源为 Tencent Careers 的 JD URL；仅允许一次用户触发的 HTTPS GET，不登录、不轮询、不跨来源、不自动重试扩大访问，也不绕过来源限制。
- **实际观察：** `scripts/fetch_tencent_jd.py` 对该 URL 的手动读取返回 HTTP 200、`text/html` 与 2,145-byte HTML bootstrap page。正文未包含预期 external job ID `2055186895503273984`，故保存原始 HTML、URL、SHA-256 和 metadata 为 `outcome: needs_review` / `response_validity: unexpected_content`，而非将其当作 JD 事实。
- **失败回归：** 传入 `https://example.com/` 时 allowlist 在请求前拒绝 URL，写入 `source_url_not_allowed` 记录；无外部请求发生。
- **动态资源边界：** 经用户一次性明确授权后，对页面引用的精确 Tencent CDN job-page script 发起一次 GET，返回 HTTP 403。经后续明确授权，以普通浏览器 `User-Agent` 与同站 `Referer` 重试一次后返回 HTTP 200、`application/javascript`、82,710 bytes，并保存 SHA-256 evidence。对已保存脚本的本地检查发现 `postApi.ByPostId` 声明 `/tencentcareer/api/post/ByPostId` 与 `postId`/`language` 参数；该 endpoint 尚未访问。

## 22. External API Raw Capture & Candidate Normalization（2026-08-23）

- **API evidence：** 用户明确授权后，对脚本声明的精确 `ByPostId` endpoint 发起一次 GET，返回 HTTP 200 JSON。`Data` 含 external job ID、职位名、地点、经验要求、4 条职责、5 条要求和 `LastUpdateTime`；原始 JSON、metadata 和 SHA-256 已保存。
- **最小 normalization：** `scripts/normalize_tencent_jd.py` 仅读取已保存 API JSON，输出待审查 candidate，不写 SQLite。空 `ComName` 映射为 `company: unknown`；`LastUpdateTime` 保留为来源更新时间，不推断 `published_date`；`posting_status` 仍为 `unknown`；`application_status` 明确不映射。
- **本地 failure/regression：** 首次运行因相对路径无法生成项目相对 evidence link 而失败；修复后，对同一 raw JSON 重跑成功。无第二次 API 请求。
- **下一边界：** 先由用户确认 candidate 的事实/unknown 边界，再做 duplicate key 与 JD-001 的 SQLite 处理；不得覆盖用户投递状态。

## 23. Duplicate Handling Preview（2026-08-23）

- **匹配结果：** candidate 的 `Tencent Careers:2055186895503273984` 与 JD-001 的 `source_url` 中 `postId` 相等，reconciliation plan 判为 `existing_record_matched`，目标为 `JD-001`。
- **保护规则：** plan 的 user-owned policy 是 `preserve_application_status`；现有 `applied` 仅被读取，不被 candidate 覆盖，`jobs` 表未写入。
- **待决差异：** API `ComName` 为空，candidate 为 `company: unknown`；API 的 title/location/seniority 是较短来源字符串，JD-001 是人工整理的较丰富文本。字段权威性尚未决定，故不能自动同步。

## 24. Safe SQLite Source-Evidence Sync（2026-08-23）

- **用户字段策略：** 用户决定以互补方式保留字段：JD-001 的人工整理公司、标题、地点、经验继续为主字段；来源 API 的 title/location/seniority 进入独立 `source_*` 字段。空 `ComName` 不建立 `source_company`；`LastUpdateTime` 不保存。
- **最小 migration 与写入：** `data/schema.sql` 和启动迁移新增来源名称/外部 ID、来源 title/location/seniority、raw capture path/hash 与 `last_successful_fetch_at`。`scripts/sync_tencent_candidate.py` 仅在 reconciliation plan 确认为 existing record 且 policy 为 preserve user status 时写入这些 evidence 字段。
- **验证：** SQLite 查询与既有 `GET /api/jobs/JD-001` 均显示 external source fields；人工主字段与 `application_status: applied` 未改变。无新外部请求。
- **下一边界：** 由用户决定详情 UI 是否展示哪些 external sync evidence；列表卡继续保留人工整理主字段。

## 25. External Sync Detail UI（2026-08-23）

- **用户主导信息层级：** 用户决定职位卡继续显示人工整理主字段；详情页新增“外部同步证据”区块，显示来源、外部岗位 ID、本地成功读取时间与来源 title/location/seniority，不显示 raw hash。
- **实际映射：** `GET /api/jobs/JD-001` 的现有 detail payload 已因 `SELECT *` 包含新增 SQLite fields，`public/app.js` 只在详情 render 这些字段；没有新 route，也没有新外部请求。
- **回归：** JavaScript syntax check 通过；运行中的 detail API 保留 `application_status: applied`，并返回 Tencent source fields。职位卡模板未改动。

## 26. External Ingestion Learning Closeout（2026-08-23）

- **用户 explain-back：** 用户能说明外部收集的数据经过规则整理并与既有资料整合；经校正后，完整链路为 external source → raw/candidate → identity match → provenance-aware merge → SQLite persistence → app.py detail API → browser detail UI。
- **可迁移概念：** source of truth 是按字段划分的，而非笼统的单一数据库；provenance 保留来源、raw evidence/path/hash 与读取时间；idempotent sync 对同一 candidate 连续执行两次后仍只有 JD-001，`application_status: applied` 与来源 evidence 结果稳定。
- **用户产品判断：** 用户提出外部标题可作为优先来源，但正确指出人工发现来源错误时需要 durable override 才能抵抗后续 sync。当前实现保持已验证的“human primary + source evidence”规则；external-primary + `human_title_override` 留作后续独立 policy，未隐式改变。
- **Phase exit：** 单一明确允许来源的 HTTP read、raw capture、normalization、duplicate handling、freshness/status boundary、SQLite source evidence、detail API/UI、正常与失败回归均已完成。Model API Phase 可进入 planning/contract learning，尚未开始模型调用。

## 27. Model API Contract Planning 01（2026-08-23）

- **最小设计：** `data/model_contracts/jd_analysis_v0.json` 定义模型未来可接收的 job facts 与 provenance，显式排除 user-owned `application_status`；输出要求 summary、capabilities、unknowns 和 field-level evidence，默认 `analysis_status: needs_review`。
- **验证/失败边界：** 非 JSON、缺 required fields、缺证据的 claim 或缺 provenance input 不得自动持久化/批准；当前只有 contract JSON 校验，无模型凭据、API 请求或模型输出。
- **学习状态：** 这是 contract artifact，不构成用户 Model API/structured-output 能力 evidence。下一步通过本地 invalid-output validation 实验建立可观察 failure。

## 28. Model Output Validation Failure 01（2026-08-23）

- **最小实现：** `src/validate_model_output.py` 根据 contract 验证 required fields、evidence field names、`analysis_status` 与 forbidden user-owned fields；它不调用模型，也不写数据库。
- **失败样本：** `invalid_model_output.json` 同时含 `application_status: applied`、`analysis_status: approved` 和“仍在招聘”但无 source field 的 claim。validator 返回 `valid: false`、三项错误与 `storage_action: do_not_persist`。
- **边界：** `application_status` 的前端可选值由 `app.js` 展示，HTTP 写入由 `app.py` 验证，SQLite `CHECK` 作最终存储保护；model output contract 则完全排除此字段。下一步先获得用户 explain-back，再做 compliant local output 验证。

## 29. Model Output Validation Normal Case 01（2026-08-23）

- **正常样本：** `compliant_model_output.json` 含 `needs_review`、source-supported role summary/capabilities、unknowns 与 field-level evidence，不含 `application_status`。
- **验证结果：** validator 返回 `valid: true` 与 `storage_action: await_human_review`；没有模型调用，也没有 SQLite analysis 写入。
- **学习边界：** schema/contract validation 可证明格式与边界符合要求，但不自动证明分析内容足够准确或有用，因此仍需要 human review。下一步由用户 explain-back 后再决定人工 review 通过时的 persistence contract。

## 30. Structurally Valid but Semantically Misleading Output（2026-08-23）

- **样本：** `misleading_but_valid_model_output.json` 保持 `needs_review`、required fields 与 evidence field reference，故 validator 返回 `valid: true`。
- **人工可见错误：** 样本声称“至少三年工作经验”，但 saved candidate 的来源 `seniority` 是“一年以上工作经验”，requirements 也不支持三年要求。当前 validator 仅验证 JSON/field-level boundary，不具备逐项语义蕴含判断。
- **学习结论：** 原始网站/API 可正确，模型转换仍可能错误；validation pass 不等于 factual/semantic pass。human review 是当前无 Eval 的必要控制，不是仅在 source 不确定时才需要。

## 31. Contract Validity Naming Correction（2026-08-23）

- **问题：** validator 原来输出 `valid: true`，容易被误读为模型结论事实正确；语义误读样本说明该含义不成立。
- **最小修正：** 输出改为 `contract_valid`，明确其只表示 JSON、required fields、field boundary 和最低 evidence-shape 通过；`storage_action` 仍是 `await_human_review`。
- **回归：** semantic-misleading sample 返回 `contract_valid: true` / `await_human_review`；违规 sample 返回 `contract_valid: false` / `do_not_persist`。

## 32. Human-Review Persistence Contract Planning（2026-08-23）

- **最小设计：** `analysis_persistence_contract_v0.json` 将未来分析定义为独立 `job_analysis` record，而非覆盖 `jobs`。它保留 job ID、analysis contract 版本、input raw hash、verbatim output、review state/reviewer/time/note。
- **状态边界：** validator/model 只能创建 `needs_review`；只有 human reviewer 可转为 `approved` 或 `rejected`；approved/rejected output 均不得覆盖原始 JD 事实或用户状态。
- **实现状态：** `data/schema.sql` 已创建独立 `job_analyses` table；`tests/analysis_review_regression.py` 使用合规模拟输出，在可回滚事务中验证 `needs_review → rejected`。它读取 JD-001 的 raw SHA-256 作为输入版本链接，并确认 JD-001 的 `title` 与 `application_status` 前后一致；测试分析记录已回滚，未调用模型。
- **边界与下一步：** 该回归不规范化字段、不写入持久测试分析、不更新 API/UI，也不判断模型结论事实是否正确。用户需 explain-back 独立 analysis lifecycle，之后才决定是否增加只读 analysis-detail API；不进入模型调用。

## 33. Provider-Independent Model System Foundation（2026-08-23）

- **实际链路：** `scripts/run_model_analysis.py` 从 SQLite 读取 JD-001；`src/model_analysis_pipeline.py` 只选择 task-relevant JD facts 与 provenance，明确排除 `application_status`；独立的 `model_instruction_v0.json` 提供控制指令；Mock Provider 返回 raw JSON；validator 依序做 JSON syntax、required/schema 与 boundary/evidence-field 检查；合格结果以 stable analysis ID 写入 `job_analyses` 为 `needs_review`。
- **可靠性模型：** provider response received 只证明 provider boundary 有返回。`contract_valid` 只证明格式/边界最低要求；field-reference grounding 仍不能证明语义蕴含，错误分类、遗漏和无依据推断仍必须在 human review 或未来 Eval 中处理。
- **正常与幂等回归：** `--scenario compliant` 创建 `AN-e09ec765c33f3bda`，保留 input raw hash、instruction version、`mock`/`deterministic-fixture-v0`、exact input/output JSON。对同一 input 再运行，stable ID 相同且 `created: false`；不会产生第二条 analysis。
- **受控 failure：** `--scenario invalid` 仍得到 raw provider response，但 validator 返回 `contract_valid: false`，原因是 `forbidden_user_owned_field:application_status`、`model_must_not_auto_approve` 与 `claim_without_evidence_fields`；`storage_action: do_not_persist`，SQLite analysis count 保持 1。
- **边界：** Mock Provider 是本地 deterministic fixture，不是 LLM 或真实 Model API evidence；没有 API key、认证、限流、网络或真实模型调用。用户下一步需先分类该 failure 并亲自修改一个 contract/input/validation 规则，再回归；之后才需要 Provider/Model/Credential 决定。

## 34. User-Owned Capability Evidence Rule（2026-08-23）

- **用户判断：** 用户选择“每个 capability 都必须有 `evidence_fields`”，因为自动 ingestion/解析后的模型结论仍需能追溯到输入事实；无 evidence 的 capability 无法判断是否正常。
- **最小实现：** `jd_analysis_v0.json` 将 capability evidence 明确为 required；`src/validate_model_output.py` 对每一个 capability 检查 evidence 非空且字段名属于允许的 model input；`capability_without_evidence_model_output.json` 是专用受控 failure fixture。
- **边界：** evidence field reference 证明“模型声明使用了哪类输入”，不自动证明 claim 的语义必然正确。自动 source capture 的正确性、normalization/merge 正确性、模型 grounding 正确性仍是相互独立的控制层。

## 35. Multi-Provider Preflight Boundary（2026-08-23）

- **最小实现：** `structured_output_schema_v0.json` 将现有 output contract 变为可发送的 JSON Schema；`src/provider_registry.py` 将同一 product request 分别映射为 OpenAI Responses `json_schema` strict payload 与 DeepSeek Chat Completions JSON Output payload；`scripts/provider_preflight.py` 只报告 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` 是否存在，绝不打印 credential，也绝不发网络请求。
- **架构意义：** Job Radar 的 JD input、instruction、local validation、review/persistence 不依赖某一家 Provider；Provider-specific endpoint/payload/output mode 被隔离在 registry。DeepSeek JSON Output 仅保证 JSON-format boundary，且官方说明可能有 empty content，因此不取代 local validation/human review。
- **边界与下一步：** 未配置或读取任何 API key，未选择具体 model，未调用 OpenAI/DeepSeek。用户需选择一个 Provider/model 并自行安全配置环境变量，随后才可明确授权一条真实 API request；其他中国 Provider 逐家确认 schema support、account availability 与 key 后再加 adapter。

## 36. First Real Provider Selection: DeepSeek（2026-08-23）

- **用户决定：** 第一条真实 Model API call 选择 DeepSeek；OpenAI 及其他国产 Provider 暂不调用或扩展。
- **最小实现：** `scripts/call_model_api.py` 复用 provider-independent request 与 DeepSeek JSON Output payload；将 HTTP response 提取为 model text，依次处理 credential absent、network、HTTP/provider、empty output、syntax/schema/boundary failures。仅 `contract_valid: true` 结果通过既有 persistence 写为独立 `needs_review` analysis；analysis ID 对真实 Provider/model 纳入 identity，避免与既有 Mock output 冲突。
- **边界：** 未配置、显示或读取实际 key，未选择 DeepSeek account 可用 model，未发送网络请求。运行真实请求仍需要用户在本机安全设置 `DEEPSEEK_API_KEY` 并另行明确授权。

## 37. Batch 06 Local-Evidence Import（2026-08-23）

- **产品问题：** 用户已有 13 份截图、`normalized.md` 与 `extracted.md`，但 Job Radar 只有 JD-001；在设计新 URL 抓取或真实模型调用前，必须先证明现有 list/detail/persistence 能承载多条、且不完整的真实记录。
- **实际链路：** `00_inbox/batch-06-jd-company-roles/JD-002…014/{normalized,extracted}.md` → `scripts/import_batch06_evidence.py` 解析为 `data/batch06_candidates/*.json` → `INSERT OR IGNORE jobs` → SQLite → 既有 `GET /api/jobs` / `GET /api/jobs/:id` → 既有浏览器卡片与详情。没有外部 HTTP 请求。
- **来源与安全边界：** supplied BOSS URLs 可能含 `securityId` 等访问参数，故 import candidate 的 `source_url` 一律为 `NULL`；保留相对本地 `source_path`，并把来源说明标为 user-provided evidence。此策略不是“隐藏 URL 的安全加密”，而是避免把可能不适合公开的数据复制进产品库。
- **未知/冲突处理：** JD-003 的 title/location 仍为 `unknown`；JD-005 的 company conflict 原样保留为 `needs_review` 文本。解析器不补写、推断或用模型修复这些事实。
- **正常与幂等回归：** dry-run 产生 13 candidates；首次执行插入 JD-002…JD-014；第二次执行插入 0 条、报告 13 条 existing。SQLite count 为 14；JD-001 仍是 `applied`，新 records 皆为 `unknown`。`GET /api/jobs` 返回 14 条，浏览器搜索深圳显示匹配卡片；JD-014 detail 显示 5 条职责、6 条要求和 source path。
- **受控 failure 与修复：** 首次 dry-run 在系统 Python 3.9 因 `datetime.UTC` import failure 停止，未写 SQLite；改为兼容的 `timezone.utc` 后重跑。随后发现 Batch root 含未规范化的原始 JD-001 目录；目录筛选改为仅处理含 `normalized.md` 的记录，避免把目录名误当成已可导入 record。
- **下一边界：** 新 URL 不能以“任意 URL → OCR/模型”泛化。必须先为一个明确允许的来源定义 raw capture 与 source-specific deterministic parser；OCR 是用户上传截图的输入路径。模型日后只能生成可审查 candidate/analysis，不能取代 source evidence 或静默覆盖 jobs facts / `application_status`。

## 38. Browser Local-first Intake Slice（2026-08-23）

- **产品问题：** 公开网页若要让每位用户保留自己的 JD，又不把资料写入 Job Radar server，需要 browser-owned persistence、review before persistence 和可迁移备份。
- **实际链路：** `local-first.html` 的 pasted JD text/source metadata → IndexedDB `candidates`（`needs_review`，含 raw text）→ 用户编辑 company/title/location/seniority/职责/要求 → IndexedDB `jobs` → 刷新后的本地列表。该页面不访问 `app.py`、SQLite、外部 URL 或模型。
- **用户数据边界：** storage key 由浏览器 origin 管理；本页的个人记录留在该浏览器，当前 Python/SQLite 的 14 条开发 fixture 不会自动进入它。JSON export/import 是防止清浏览器数据、换浏览器或换电脑时丢失的用户控制。
- **验证：** 浏览器中创建 candidate 后显示 `needs_review`；确认一条“验证公司 / AI 产品经理 / 深圳”记录后，reload 仍显示 1 条。对相同 `source_url` 再生成 candidate，被 duplicate guard 拒绝。测试记录只存在本次浏览器本地 storage，不进入项目 SQLite。
- **Failure UX：** 不支持的备份格式会被拒绝；IndexedDB 打不开时显示 storage/隐私设置错误；清空动作要求浏览器确认。当前 URL 只是保存的 provenance string，页面不会读取它，因此 CORS/source contract 仍未进入该 slice。
- **学习边界：** 这提供了 local-first、persistence boundary、review-before-commit、backup/recovery、duplicate UX 的可观察产品切片；不构成 OCR、crawler、Provider credential、Model API、Eval 或 production security 能力 evidence。

## 39. BOSS Direct-URL Feasibility Failure（2026-08-23）

- **用户问题：** 手动粘贴 JD 原文会让用户承担提取/判断负担；希望直接输入 BOSS URL 后读取职位信息。
- **授权与 contract：** 用户授权一次 exact URL probe。`scripts/probe_boss_jd.py` 仅接受 HTTPS BOSS `/job_detail/` URL；发送一次 GET，无登录、无 Cookie、无重试，且禁止 redirect。它不把 query/visit/security 参数写入 metadata，只保存 canonical URL。
- **观察：** 读取得到 HTTP 302、`text/plain`、0 bytes body。metadata 保存于 `data/raw/boss-73fb508f7de2b01c0nJ-09S4GFFW-2026-08-23T115201Z.json`；没有 raw body。
- **诊断：** failure 位于 Source/Access boundary：尚未获取 JD raw content，故没有 parser、schema、OCR、Model API、candidate 或 IndexedDB 写入可执行。它不能被解释为“模型识别失败”。
- **产品结论：** BOSS 在当前无登录、无跳转 contract 下不是可靠公开 URL intake 来源。不能通过追随跳转、模拟登录或绕过限制来“修复”。截图输入/OCR 是用户拥有的可控 fallback；另一个明确允许且可读的公开来源才可进入 source-specific URL parser。
- **自动搜索边界：** 自动找工作首先是 source discovery/collection、allowlist、rate/permission、dedupe 与 freshness 的产品问题；Model API 可后续用于排序、匹配、摘要或推荐，不是取得网站 JD 内容的前置条件。

## 40. Local Screenshot OCR Experiment（2026-08-23）

- **产品问题：** BOSS URL 在无登录 contract 下返回 302，且用户通常复制截图而非保存/复制页面文字；需要一个用户拥有、无需外网上传的 evidence intake fallback。
- **实现：** `local-first.html` 增加 PNG/JPEG file input 与 clipboard paste zone。图片经同机 `POST /api/local-ocr` 传至仅监听 `127.0.0.1` 的 `app.py`；`src/extraction/ocr_with_vision.swift` 用 macOS Vision 的中文/英文 accurate recognition 返回 text 和 line count。结果写回 pasted-text intake，生成 `needs_review` candidate，不自动写 job。
- **正常观察：** Batch 06 的 JD-002 screenshot 经 Vision 与 localhost API 都返回 53 lines；可识别职位标题、深圳、薪资、技能标签和职责段落。图片落在本机 `data/local_ocr_uploads/`，无外网请求。
- **质量/failure 观察：** `AI Agent` 被识别为 `Al Agent`，且长行会断裂、图标/页面噪音也进入 text。因此 OCR success/HTTP 200 不等于 candidate facts 正确；human review 必须检查标题、公司、地点、职责/要求边界。浏览器 automation 的 file chooser 在 3 秒超时，属于测试工具 failure，未证明真实用户的 file/paste UI failure。
- **边界：** 此 macOS Vision route 是 local development adapter，不是未来纯静态 public web 的最终 OCR；后者需要 browser-bundled/WASM OCR 或 local companion。尚未做 OCR confidence score、image quality gate、URL fetch、Model API 或 Eval。

## 41. Evidence-Backed OCR Candidate Extraction（2026-08-23）

- **产品问题：** OCR 的纯文字与 Job schema 之间仍缺 extraction layer；同一批真实 BOSS screenshots 在手机/桌面、章节名称、内容长度和截图范围上不同，固定坐标或第 N 行规则不可靠。
- **最小实现：** `app.py` 的 `extract_ocr_candidates()` 产生 `rule_assisted_ocr_v1` 输出：字段候选含 `value`、`status: proposed|unknown`、`evidence_lines` 与 rule reason；章节候选仅在明确标题后收集，并保留 heading line 和内容行。`local-first.js` 将候选预填到 review form，同时显示原截图、候选理由和编号 OCR 原文。用户确认前，candidate 仍是 IndexedDB `needs_review`，不会写 SQLite 或外网。
- **正常案例：** 对 JD-014 原截图的本地 `POST /api/local-ocr` 返回 HTTP 200、32 OCR lines；title `AI产品经理`（第 4 行）、location `深圳`（第 5 行）、seniority `3-5年`（第 9 行）、salary `25-40K`（第 8 行）及职责章节（标题第 20 行）均为候选并可回看图片。
- **受控 failure / 修复：** 初版 title rule 曾将 `AI产品经理 25-40K·15薪` 作为完整 title；由于薪资已有独立可见 pattern，title candidate 现在先移除 salary substring。JD-014 的任职要求截图在第一条中途截断且混入“立即沟通”，系统仍只提出 partial candidate，不伪造完整要求；company 无 explicit recruiter label 时保持 `unknown`。
- **边界与下一步：** rule result is not factual correctness and not a universal BOSS parser. Next use reviewed Batch 06 screenshots as a small Golden Set to measure missing/wrong fields, wrong section boundaries, OCR mistakes and image truncation before choosing richer layout OCR, bounded model extraction or source-specific rules.

## 42. Multi-Image JD OCR Evidence Group（2026-08-23）

- **用户观察：** 真实 BOSS JD 常需 2–3 张截图；单图 intake 会把同一岗位的公司卡、详情、职责和要求割裂。用户的阿里云 qoder 截图也显示 OCR 已读取 `阿里巴巴`，但旧 company rule 因只接受 recruiter label 而保持 unknown。
- **最小实现：** file picker 支持 multiple，paste zone 可连续加入图片；一次 intake 最多 4 张，每张 PNG/JPEG ≤5 MB、总 decoded size ≤12 MB。`POST /api/local-ocr` 接受 `image_data_urls`，逐张在 localhost Vision OCR，保存独立 evidence image，再将 page texts 共同送入 extractor。IndexedDB candidate 存储 `evidence_paths[]`；审核 UI 并列显示每张图片、每张独立 OCR 行号和跨图 candidate evidence。
- **公司卡规则：** 在不存在 explicit recruiter label 时，仅在 OCR 出现精确 `公司基本信息` 标题后检查紧邻卡片值；跳过 `E2`、上市状态、人数、行业和 BOSS CTA 等可见 metadata。测试 fixture 得到 `阿里巴巴`，证据为 screenshot 2 / line 3；这仍是 review candidate，不是 source truth。
- **正常回归：** `python3 -m py_compile app.py`、bundled Node `--check public/local-first.js` 与两图 extraction fixture 均通过。两张真实 JD-014 screenshot 通过同一 localhost request 返回 2 images / 78 OCR lines；title `AI产品经理`、职责和要求 sections 回指 screenshot 1 的具体行，两个独立 evidence paths 均保存本机。用户提供的阿里云 qoder screenshot 也实际返回 company `阿里巴巴`（screenshot 1 / line 50, `company_card_after_explicit_heading`）、title、Shenzhen、1–3 years 与 40–65K。浏览器 reload 后新版 1–4 image text 可见，console 无 error。
- **边界：** 多图只表示“这些图属于同一次用户 intake”，不证明它们必然是同一岗位；当前由用户在选择时承担该分组判断。没有 URL fetch、云 OCR、Model API 或外部上传。

## 43. OCR Boundary Sample and Model-Assist Gate（2026-08-23）

- **测试：** 对 JD-002、JD-005、JD-006、JD-014 与用户提供的 Alibaba qoder 原截图运行同一本机 Vision OCR。各样本的选择性 header/section anchors 全数出现（分别 5/5、5/5、5/5、6/6、6/6），证明高质量截图的标题、地点、经验、薪资与常见章节可作为 OCR-first candidate input。
- **边界：** 同一批结果仍出现 `AI → Al`、词语错字、长行截断、移动端第一条 requirement 截断、以及 BOSS CTA/UI text 混入；用户曾观察到整段不可读字符。OCR 只选择最接近的像素字形，没有语义真实性检查。对当前 Alibaba 原图的重跑得到大部分正文正确，说明截图在 browser → localhost base64 路径未被重新压缩；不可读段应优先归因于当时输入图的像素/缩放/裁切与 OCR 识别局限，而非 candidate mapping。
- **Model 决策：** text-only model 不能可靠复原没有被 OCR 读出的像素；在 unknown/乱码上直接调用会消耗 token，并可能生成看似流畅却无来源的文本。保留 OCR-first + human review。`extract_ocr_candidates_from_pages()` 新增 `model_assist_recommendation`：仅在 ≥2 core fields unknown 且已有至少 12 行 OCR，或 ≥20 行 OCR 未识别职责/要求章节时提示未来可选 model assist。推荐只在 UI 显示，不调用 provider、不发送图片/text、不写 analysis。
- **UI / regression：** 审核区始终显示为第 2 步；没有 candidate 时 fields disabled 并解释需先完成截图 OCR。候选生成后才启用字段、显示 evidence 和 model-assist recommendation。`py_compile`、bundled Node syntax check、recommendation normal/unclear fixtures、浏览器 reload（review heading/idle message/disabled state，console no error）均通过。

## 44. User-Triggered Vision Entry Boundary（2026-08-23）

- **产品判断：** 保留本机 OCR 作为零云 token、默认不外发的快速证据路径；新增用户明确点击的“开启 AI 读取截图”，用于将来让多模态模型直接检查原图的文字和页面布局。它不是“把 OCR 文本再交给语言模型猜”。
- **当前实现：** 未选择图片时该按钮禁用；选择 1–4 张图片后才可点击。当前点击只显示尚未连接的边界说明，确认不会上传图片，且不创建 candidate、不调用 Provider、不读取 API key。
- **待实现 contract：** 确认 DeepSeek `V4-Flash-Vision-Exp` 的官方 image request schema、实际账户可用 model ID 与单次请求 usage；仅把用户本次选中的图片和限定 extraction instruction 发送给 Provider；保存 raw provider response、structured candidate、每项 image evidence 与 `needs_review`，不自动写入 jobs。输出还必须排除 BOSS CTA、广告和招聘者信息。
- **学习结论：** OCR failure 与 extraction/semantic-boundary failure 不应混为一层。多模态视觉可降低“像素转文字/布局理解”的损失，但 schema valid 不等于内容正确，原图证据与 human review 仍是提交前的 source of truth。

## 45. Local Keychain + User-Triggered DeepSeek Vision Slice（2026-08-23）

- **实现：** `app.py` 新增 localhost-only Keychain config/read route 与 `/api/vision-extract`。用户输入的 Key 使用 macOS `security` 写入 `AI-Learning-OS.JobRadar.DeepSeek` Keychain item；不会写入 IndexedDB、JSON backup、SQLite 或项目文件。截图在 API request 前先作为本机 evidence 保存；只有用户点击 AI 按钮才将当前 1–4 张原图发送至 DeepSeek endpoint。
- **输入/输出边界：** 固定尝试模型 ID `deepseek-v4-flash-vision-exp`，发送 OpenAI-compatible image-content message、extraction instruction 与 `json_object` response request。输出必须拥有五个字段、职责/要求 lists、以及每个非 unknown 值的 screenshot index + visible quote evidence；缺 Key、HTTP/provider/network、非 JSON、schema 或 evidence failure 一律不创建 candidate/job。
- **回归：** `py_compile` 与 JS syntax check 通过；本地 valid fixture 通过 candidate transform；malformed JSON fixture 被拒绝。未配置 Key 的 valid-image request 返回 HTTP 428 / `deepseek_key_not_configured`，`network_call_made: false`，且未写入 screenshot evidence。浏览器 fresh-tab 验证 Key input、Keychain save button 与 disabled vision button 可见，console 无 error。
- **未知：** 未输入真实 Key、未发送任何图片或 API request，故不能证明该实验模型 ID、图片 payload compatibility、价格或实际 semantic quality。首次用户自行触发的请求将产生本 milestone 的正常或 provider-failure evidence，之后再决定是否继续 Golden Set 比较。

## 46. First Real DeepSeek Vision Request + Usage Observability（2026-08-23）

- **用户观察：** 用户在 localhost 页面自行保存 Key、选择截图并点击后，DeepSeek vision extraction 成功进入审核；候选字段正常，实际 UI 回报 total usage 为 2,949 tokens。没有 `jobs` 自动写入或 `application_status` 修改。
- **含义：** 这证明本机 Keychain → 用户主动发送原图 → DeepSeek → JSON/evidence validation → IndexedDB `needs_review` 的真实 Provider slice 可用。它不证明模型字段都正确，也不能单凭 total tokens 判断 prompt、图片还是输出哪个是主要成本。
- **实现更新：** 返回/候选现在保留 `prompt_version: vision_extract_v1_full` 与 Provider 的完整 usage object；审核 evidence 区和成功消息展示输入、输出、总 token（Provider 未返回的值显示 unknown）。下一实验应保持同一截图、字段 schema 与 review 标准不变，只缩短 instruction，以比较质量与成本。

## 47. BOSS URL Access Recheck + Prompt A/B Setup（2026-08-23）

- **一次授权 URL probe：** 对用户给出的新 BOSS URL 执行一次 in-memory、no-login/no-cookie/no-redirect/no-retry GET；返回 HTTP 302、body 0 bytes、无职位标题或 embedded-job-JSON marker。完整含 `securityId` 的 URL 没有写入项目。结论仍是 source/access failure：当前没有可供 parser 或 DeepSeek 提取的 JD raw content。
- **边界：** HTTP URL ingestion 本身可行，前提是允许来源返回可读 HTML/JSON，例如已经完成的 Tencent API source contract。该 BOSS link 失败不是“HTTP 无法实现”；Agent 也不能凭空获得页面内容，更不能成为绕过登录、跳转或网站限制的理由。故不新增误导性的 BOSS direct-URL import UI；截图 + user-triggered vision 是当前 fallback。
- **成本实验实现：** `vision_extract_v1_full` 为 901-character prompt；新增页面下拉选择的 `vision_extract_v2_compact` 为 633 characters，少 268 characters，仍要求 visible-only、unknown、JSON、field/list evidence、image index，并排除 recruiter/CTA/ads/company-card metadata。除 prompt 文本外，图片、schema、temperature 与 review 标准均不变。下一次用户对同图各调用一次，记录 input/output/total token 和 candidate quality。

## 48. Tencent OCR/Vision Truth Comparison + Prompt A/B Result（2026-08-23）

- **Tencent page access contrast：** one exact page GET returned HTTP 200, 2,145-byte HTML bootstrap, with neither JD-001 post ID nor title in body; a real browser rendered the complete JD after public frontend loading, and the prior allowlisted Tencent position API is the structured truth. This distinguishes page-shell HTTP from source-specific API access. It cannot justify generic scraping or a BOSS retry.
- **JD-001 truth comparison：** two screenshots (page top/responsibilities and requirements) were passed to local OCR and v1 vision. OCR returned 53 lines but merged title/metadata, used `Al` for `AI`, missed seniority and leaked navigation/footer into sections. Vision v1 returned title/location/seniority/salary unknown correctly and 5 requirements correctly, but returned 3 of 4 responsibilities because screenshot coverage omitted the fourth. It proposed `Tencent` as company from page context, while the API source's `ComName` is empty: this remains reviewable provenance ambiguity, not an automatic source fact.
- **A/B observations：** JD-001 v1: input 1,051 / completion 2,328 / total 3,379; v2: 1,003 / 2,816 / 3,819. Visible candidate content did not improve or regress, but v2 cost more because completion/reasoning varied. JD-002 v1: 643 / 1,239 / 1,882; v2: 595 / 962 / 1,557. Both gave header fields and 4 responsibilities; v2 gave 3 requirements whereas v1 gave 4 visible requirements. Batch truth's fourth requirement differs from the screenshot text, so that is source-snapshot disagreement; v2's loss versus v1 remains a recall failure.
- **Decision / validity：** retain `vision_extract_v1_full` as default. v2's fixed input saving is only 48 tokens in both tests and does not yet outweigh quality risk. The local OCR evidence directory contains 20 files but only 12 unique images; only JD-001 and JD-002 can currently be tied to reviewed truth. Do not claim a 15-JD accuracy rate until the user-owned screenshot groups and their reviewed source records are explicitly bound.

## 49. Three-Input Local-first Intake: Source-specific Link, Text and Screenshot（2026-08-23）

- **Product decision:** retain a URL field, but make its action explicit: “测试并导入链接” means local classification first, then one allowed source read only if supported. Screenshot OCR/vision and manual pasted JD text remain parallel inputs into the same review-only candidate surface.
- **Implementation:** `GET /api/source-link-status` is a no-network classifier. Tencent `https://careers.tencent.com/jobdesc.html?postId=<digits>` is the sole supported shape. A user click on `POST /api/source-link-import` calls the already evidenced `ByPostId` JSON endpoint with a 20-second timeout, redirect rejection and 2 MB cap; it verifies `Code == 200` and matching `PostId`, writes a local raw capture with SHA-256, and returns a source-evidenced candidate. `POST /api/text-candidate` keeps pasted text local and invokes only the existing deterministic candidate extractor. Browser candidates retain `source_url`, raw text/response and `evidence_kind` (`source`, `text`, `ocr`, or `vision`) in IndexedDB until user confirmation.
- **Normal regression:** status classified JD-001 Tencent as supported. One explicit import returned HTTP 200, canonical URL, post ID `2055186895503273984`, title `AI设计工程师`, location `深圳`, seniority `一年以上工作经验`, responsibilities and requirements; its result was review-only and did not write a job. A small pasted-text fixture returned a title/location/seniority and two explicitly headed sections as candidates.
- **Failure/regression:** a BOSS URL status result was `fallback_required`; no BOSS HTTP request occurred. Unsupported, malformed or unverifiable source responses produce no candidate/job. URL canonicalisation removes query and fragment parameters for non-Tencent pasted-source references, so signed/security tokens are not copied into the local record. This does not claim generic link extraction, does not use a model to read a URL, and does not expand the one-source contract.
- **Evidence usability update:** screenshot OCR and user-triggered vision candidates now inherit the canonicalised source URL typed above the screenshots. Thus an unsupported BOSS/LinkedIn link can remain a human-clickable reference beside the locally stored screenshots, without retaining signed query parameters or pretending that the app read the page. This joins image and link provenance; it does not make a model API a browsing tool.

## 50. Recovered Batch 06 BOSS Link Regression（2026-08-23）

- **Input recovery:** the user directed the system to the original Batch 06 intake thread. It contained ten clearly associated BOSS links for JD-003…JD-012 and one link immediately preceding the JD-002 screenshots (recorded as a probable, not proven, association). JD-013 and JD-014 had no supplied link. Full signed URLs were used only in memory.
- **Authorized test:** each recovered BOSS URL received exactly one `GET` with no login, cookies, redirects or retry; each result persisted only its canonical path and minimal metadata. JD-001 remains the contrasting existing Tencent API success.
- **Result:** all eleven BOSS requests returned HTTP 302, `text/plain`, zero-byte body. Thus the batch result is not an isolated stale-link failure: within the stated access boundary, BOSS gave no raw JD to normalize, OCR or send to a model. The non-secret per-JD summary is `data/raw/batch06-link-probe-2026-08-23.json`.
- **Product consequence:** a usable first comparison loop is `Tencent/API link candidate` versus `screenshot OCR/vision candidate`; for BOSS, the link is provenance and the screenshot is the content evidence. Do not label the BOSS result as an AI extraction failure, and do not retry, follow redirects or automate sign-in to alter this conclusion.

## 51. Feishu Job Page Shell Test + Link-as-Provenance Decision（2026-08-23）

- **Single authorized test:** `https://bambulab.jobs.feishu.cn/experienced/position/7673163998896654635/detail` received one no-login/no-cookie/no-redirect/no-retry HTTP read, capped at 512 KB. It returned HTTP 200 `text/html`, 129,011 bytes, but its body contained neither the supplied position ID nor a recognised embedded JSON marker.
- **Interpretation:** this is a readable HTTP page shell, but not verified raw JD content that the generic normalizer can map. Discovering and calling its browser runtime data endpoint would be a new source-specific contract, not an automatic consequence of an HTTP 200.
- **Product decision:** remove the local-first UI action that tested/imported links. Links are now provenance-only; screenshots or pasted original text are the required content evidence. Existing Tencent source-adapter code and evidence are retained for future explicit source contracts, but it is not a default user action. Screenshot OCR/vision candidates retain the canonicalised link so users can revisit the source alongside their local image evidence.

## 52. Fixed Full Vision Rule + Local Jobs Gallery（2026-08-23）

- **Product decision:** prompt A/B has concluded: retain `vision_extract_v1_full`, remove the UI rule selector, and never let a user accidentally select the quality-regressing compact rule. The vision request now always sends the full-rule version; local OCR receives no irrelevant prompt-version field.
- **Implementation:** after review confirmation, the existing browser-local `jobs` record is rendered by new `local-jobs.html` / `local-jobs.js` from the same IndexedDB. The page is an image-prioritised responsive card flow: first original screenshot when available, title/company/facts/one content summary, then an accessible dialog for full responsibilities, requirements and canonical source link. It does not call SQLite, a model, or an external source.
- **Verification / remaining checkpoint:** bundled Node syntax checks pass for intake and gallery JS; localhost serves both pages and the removed rule selector is absent. The final user regression is persistence-specific: confirm one candidate, open `local-jobs.html`, then reload and verify its card/detail remains. On passing, Phase 3 has a complete bounded vertical slice: evidence → OCR/vision → structured candidate → validation/review → IndexedDB → gallery.

## 53. Editable Local Job Cards + Phase 3 Closeout（2026-08-23）

- **Implementation:** every confirmed-job card now exposes an `编辑` action separate from its detail click. The edit dialog writes the modified company/title/location/seniority/salary/source link/responsibility and requirement lists back to the same IndexedDB `job_id`, adds `updated_at`, then redraws the gallery. It never creates a second job, calls a model, or changes source evidence files.
- **Verification:** bundled Node syntax checks pass for `local-first.js` and `local-jobs.js`; localhost returns the gallery script containing edit/save paths. The user confirmed the gallery content has no issue.
- **Phase decision:** Phase 3 is complete: local original evidence, optional real visual model call, evidence-backed structured candidate, validation/review, browser persistence, editable card gallery and backup boundary are all present. The next phase is Eval, not additional UI/database micro-experiments.
- **Usability correction:** user observation showed the card-level edit action was hidden once a detail dialog was open, and the dialog rendered only the first of multiple saved screenshots. The detail dialog now has its own `编辑此职位` action, and renders all `evidence_paths` as clickable thumbnails that switch the active original image. This changes display/navigation only; it retains all original image evidence and the existing record identity.

## 54. Phase 3 Final Reconstruction / Evidence Audit（2026-08-23）

- **Two model paths must remain separate:** the real DeepSeek success evidence belongs to screenshot vision extraction: original images → fixed instruction → DeepSeek → JSON/evidence validation → IndexedDB `needs_review` candidate → human confirmation. The general text JD analysis path is Mock-proven only; `scripts/call_model_api.py` exists, but SQLite contains only `mock / deterministic-fixture-v0`, and there is no analysis review API/UI.
- **Validation boundary:** current visual validation checks exact top-level/field keys, types/lengths, image indices and evidence presence. Text validation checks required fields, `needs_review`, forbidden `application_status` and allowed evidence-field references. Neither proves semantic entailment or factual truth; `misleading_but_valid_model_output.json` intentionally passes contract validation.
- **Regression:** Python and JavaScript syntax checks pass; analysis review regression keeps JD-001 title and `application_status = applied` unchanged and rolls back its test row. Mock compliant reuse is idempotent; invalid and missing-evidence fixtures do not persist. Database inspection shows 14 jobs and one Mock `job_analyses(needs_review)` row.
- **User capability boundary:** ordinary/model API, input/instruction/output, structured output, provider/model/credential, contract vs factual validity, grounding and layered failures support credible L1. Human/AI responsibility, local-first/BYOK direction and AI feature boundary support L2 Apply product evidence. Independent coding, validator implementation, full diagnosis/fix/regression and Eval remain below L2.
- **Formal exit:** `PHASE 3 IMPLEMENTATION = COMPLETE` for the bounded local-first vision intake/review/persistence slice; `LEARNING CLOSEOUT = COMPLETE`; `EVIDENCE SYNC = COMPLETE`. This does not claim automatic discovery/matching/application or a completed real text-analysis feature.
- **Next gate:** `AUTOMATION FEASIBILITY & ARCHITECTURE GATE`; first create one decision matrix and select only one Automation MVP. RAG, MCP and Agent are not yet justified. UI polish remains deferred.
- **Canonical report:** `docs/history/PHASE_3_FINAL_SYNTHESIS.md`.

## 55. P4.1 Career Evidence Foundation — First Slice（2026-08-24）

- **Architecture decision:** 用户确认 `docs/architecture/PHASE_4_ARCHITECTURE_REFERENCE_REVIEW.md` 的四项核心 contract：CareerEvidence domain、IndexedDB/SQLite alternative stores、P4.1→P4.4 顺序，以及 Job Radar Brain/Memory 与 external Agent Hands/final-human-submit 边界。
- **Domain + persistence:** `career_evidence_v0` 定义 SourceDocument、candidate/confirmed/rejected CareerEvidence、ReviewDecision、derived CareerProfile 与 confirmed-only export。浏览器 DB 升到 version 2，新增 `source_documents`、`career_evidence`、`review_decisions`、`career_profiles`；既有 `jobs`/`candidates` 保留。
- **Local intake boundary:** `POST /api/career-document-extract` 接受 ≤8 MB PDF/DOCX/MD/TXT data URL。PDF 经本机 PDFKit，DOCX/文本经 Python 标准库；响应明确 `model_call_made: false`，服务端不写 SQLite。原始 Blob 由浏览器 IndexedDB 持有。
- **Real normal case:** 一份 151,161-byte 一页中文履历（SHA-256 `e7b46470ce45f0da85e895d0721d9ea4aff9a3bf62283deb27230e73f169a9dc`）产生 stable source ID `source-e7b46470ce45f0da85e8` 与 7 条 clean `needs_review` evidence，均保留 page/line source excerpt 和“简历自述，尚未独立验证” limitation；Lovable 项目额外标注“不构成独立 Coding Evidence”。浏览器刷新后仍为 1 source / 7 needs_review / 0 confirmed。
- **Review/export contract:** UI 支持 approve、edit-and-approve、reject，并保持 immutable source excerpt。Domain regression 验证 normal、三条 review transition、confirmed-only profile/export 与 empty-claim rejection。真实候选未被工具代替用户审核；因此当前 export 尚无 confirmed evidence，这是预期的人机边界，不是失败。
- **Failure evidence:** 不支持的 `.exe`/MIME 请求返回 HTTP 400、`unsupported_document_type`、`persistence: not_written`、`model_call_made: false`。Python compile、JavaScript syntax、contract JSON parse、real PDF HTTP、browser import/reload 全部通过。
- **Capability boundary / next action:** 本轮新增的是产品实现证据，不是用户能力升级证据。用户下一步在 `career-evidence.html` 对 7 条候选逐条确认、编辑确认或拒绝；只有该人类审查后才能生成第一份有用户 ownership 的 CareerProfile，并判断 P4.1 是否进入下一切片。

## 56. P4.1 Entity-first Resume Migration（2026-08-24）

- **Superseded ingestion model:** §55 的 `SourceDocument → atomic CareerEvidence` 首切片未通过产品验收。它保留为 v0 historical evidence，但不再是当前 Resume model。Header 被当作 boundary 丢弃、bullet 被提升为顶层 record，是 company/role/date/location fragmentation 与逐句审核成本的直接原因。
- **Current contract:** `SourceDocument → ExtractionRun → CareerEntity(needs_review) → EntityReviewDecision → Confirmed Career Model → selective CareerEvidence`。新增 `career_entity_v1`、`extraction_run_v1` 和 contract-only `portfolio_project_v1`，不覆盖 `career_evidence_v0`。
- **Persistence evidence:** IndexedDB `job-radar-local-first-v1` 从 version 2 additive upgrade 至 version 3，只新增 `extraction_runs`、`career_entities`、`entity_review_decisions`。浏览器验收仍显示两个旧 SourceDocument 和七条 `Legacy v0 Evidence（保留）`；没有 clear、deleteObjectStore、SQLite migration 或 Phase 1–3 job/application write。
- **Real Resume result:** 同一份 `郭开泷_腾讯AI设计工程师_针对性简历.pdf` 经真实 localhost API 生成 13 entities：Basics 1、Work 3、Education 2、Project 3、SkillGroup 2、Language 2。三份 Work 保留完整 company、role、raw/normalized dates、location 与 2/1/1 highlights；Good Art 的跨行 bullet 合并为一条；同一行的两段 Education 正确拆分。
- **Review/derivation evidence:** 浏览器重复导入显示 `0` new entities、总数仍 13。第一份 Work 在一张 entity card 内把两条 unclassified highlights 移入 responsibilities 后确认，派生 2 条 Evidence；reopen 后 active derivation 降为 0，reconfirm 后恢复 2。刷新保持 12 pending / 1 confirmed / 2 derived，console error 为 0。EVIDENCE export UI 报告从 1 confirmed entity 导出 2 records。
- **Fail-closed regression:** missing date → null + `missing_date`/low；ambiguous company/title → unresolved field + `ambiguous_company_or_title`/low；header-only partial text → `no_highlights_detected`/low/needs_review；duplicate parse → stable entity IDs；image-only Portfolio → `needs_visual_extraction` + 0 entities。Python/JS syntax、real fixture regression、domain review/derivation、JSON contracts 和既有 Phase 3 `tests/analysis_review_regression.py` 均通过。
- **Provenance boundary:** PDFKit 当前只提供 page + extracted-line location，没有 bbox/layout geometry，因此 v1 anchors 明确标记 `approximate_text_location`，不伪造精确坐标。用户编辑 entity data 不改写 anchors/excerpts。
- **Learning/ownership boundary:** 本次 domain、parser、persistence、UI、tests 和 diagnosis/fix 由 Codex 辅助完成，不升级用户独立 coding/debugging 证据。浏览器中的一次 Work confirm 是产品验收动作，不是对雇佣经历的外部认证。下一 gate 是用户判断 Resume grouping/review 成本是否通过；不得自动开始 Portfolio、Gemini comparison、RAG、MCP、Agent 或 Job Discovery。

## 57. P4.1 Career Material Entity-first Closeout（2026-08-24）

- **Scope update completed:** P4.1 now covers both Resume and Portfolio under a shared `CareerEntity → Entity Review → Confirmed Career Model → CareerEvidence` domain, with separate Resume and Portfolio extractors. No common parser was introduced.
- **Generic visual extraction:** `src/extraction/extract_pdf_visual_text.swift` renders each PDF page locally and returns OCR `text + normalized coordinate + confidence`. `src/career_evidence.py` retains those blocks in anchors and reconstructs labelled Portfolio fields from the same-column region below each label; low-confidence/neighbouring-card blocks are excluded. The parser uses no project-specific titles or source-specific content conditions.
- **Failure/fix evidence:** (1) zero PDF text was an Extraction failure, fixed by local rendered-page Vision OCR; (2) MUPAHKC absorbing pages 8–9 was Entity Grouping, fixed by requiring a repeated explicit CASE number for automatic continuation; (3) Material Card field pollution was Entity Mapping, fixed by coordinate-aware column reading and section-break quality gates. Review, persistence and evidence derivation were intentionally unchanged because they were not causal.
- **Real Portfolio acceptance:** `郭开泷_腾讯AI设计工程师_作品精选.pdf` generated four review-only projects: Memoryblock Tea Product page 3, Material Card pages 4–5, Material Resonance page 6, MUPAHKC page 7. Explicit source text supports Product lead; Material Card problem, HTML/JavaScript/CSV tools, outputs and no-backend boundary; MUPAHKC AI-assisted contribution and no-independent-full-stack boundary. Unsupported fields remain empty, including outcomes.
- **Browser acceptance:** fresh localhost IndexedDB imported Portfolio → 4, Resume → 13; duplicate Portfolio → 0. Four Portfolio entities were confirmed in a dedicated acceptance simulation, producing/exporting 10 provenance-linked Evidence records. After reload: two source documents, 13 pending, 4 confirmed, 10 derived; browser console errors 0. Existing user browser data/v0 evidence were not cleared; SQLite was not written.
- **Regression/model decision:** Python compile, Swift typecheck, real Resume/Portfolio fixtures, synthetic multi-column mapping, JS domain regression and Phase 3 analysis regression all pass. Gemini/DeepSeek comparison is not justified: the observed document-understanding gap is resolved by the local path; a future provider comparison needs a newly evidenced residual limitation.

## 58. P4.1 Reliability Extension — Local Correction Memory + Interactive Sources（2026-08-24）

- **Local-memory contract:** browser IndexedDB v4 adds `correction_memory`, with `ocr_replacement`, `section_alias` and `classification_correction` records defined in `local_correction_memory_v1.json`. Corrections are browser-owned, bounded to 240 characters and sent only to the same localhost extraction request; `src/career_evidence.py` validates/apply them transiently and never persists them server-side.
- **Generic correction behaviour:** OCR replacements rewrite only exact local source strings; section aliases normalize headings before section parsing; classification corrections are low-confidence review suggestions, not automatic confirmation. Entity edits record scalar text changes locally. There is no project-name-specific logic, cloud upload, central corpus or shared-model training.
- **Real UI evidence:** a pasted Resume fixture with `Al Product Manager` and `PROFESSIONAL EXPERIENCE` was imported through the unified paste zone after local corrections `Al Product → AI Product` and `PROFESSIONAL EXPERIENCE → work`; it produced Basics label `AI Product Manager` and one Work entity. Editing that label to `AI Product Lead` and confirming created a third persisted local correction. Refresh/new tab retained all three records.
- **Source interaction fix:** source cards are selectable and report pending/confirmed/derived-Evidence counts while filtering the lower panels. Existing source cards include `重新识别此资料`. The real previously-uploaded DOCX was `needs_manual_selection`; re-recognition with the current parser changed it to `needs_review` and created 13 new entities without deleting its Blob or other data. The standalone real DOCX regression expects the same `1/3/2/3/2/2` entity distribution as the real PDF.
- **Input UX:** file chooser, drag/drop and clipboard file/plain-text paste route through one local import function. Pasted text becomes a browser-local TXT SourceDocument. Browser console errors were 0 after source selection/reload; Python, JS and Phase 3 regressions pass.

## 59. Final No-model Document Understanding Mapping Closeout（2026-08-24）

- **Frozen boundary:** No OCR code/provider, Apple Vision selection, `document_block_v1.json`, IndexedDB ownership/migration, or confirmed-only CareerEvidence rule changed. The implementation changes are limited to Resume/Portfolio document-structure and CareerEntity mapping, plus additive Award review/profile projection and regressions.
- **English CV root cause/fix:** `VISION_V1_AUTO` DocumentBlocks already contained the category headers, skills, award rows and language text. The parser only covered compact skill lines and did not map the Awards section. Mapping now reconstructs English category-per-line skills without splitting parenthesized commas, creates two explicit Language entities, and joins column-aligned award continuations into three Award entities. Missing dates/issuer/location/summary remain null or empty; each field points to original page/record anchors.
- **Touchine root cause/fix:** the previous Portfolio boundary recognizer only opened CASE sections and used the CASE label as the entity name. Mapping now treats the demonstrated `CURRENT PRODUCT EXERCISE` boundary as an independent project, resolves supported body titles, and preserves CASE/category/section labels as metadata. Frozen expected output is `MemoryBlock [3,4]`, `MUPAHKC [5]`, `Material Card [6,7]`, `Mac Setup [8]`, `Material Resonance [9]`; pages 1, 2 and 10 do not become projects, and outcomes remain empty.
- **Real regression matrix:** `tests/career_entity_regression.py` passes synthetic failure/stable-ID tests plus Tencent Resume PDF, Tencent Resume DOCX, Tencent Portfolio, English CV, Touchine Portfolio and 45-page comprehensive Portfolio fixtures. `tests/career_evidence_regression.mjs` passes entity review, Award profile projection, selective derivation, reopen invalidation and private-basics boundaries while keeping derived Evidence count unchanged for Awards. Python/JavaScript syntax, JSON contracts, and `tests/analysis_review_regression.py` also pass; Phase 3 job facts remain unchanged and its transaction rolls back.
- **Architecture invariants:** SHA-256 checks recorded unchanged `document_block_v1.json` (`abbf1150…`), `src/extraction/extract_pdf_visual_text.swift` (`c0674ae1…`) and `src/extraction/extract_pdf_text.swift` (`16a9de20…`). Successful Resume/Portfolio grouping fixtures remain green. No unsupported field was populated by inference, and all real fixtures retain traceable page/line or page/block provenance.
- **Normal browser acceptance:** on isolated localhost origins, English CV displayed `14 needs_review` entities (`1/3/2/0/3/2/3` for Basics/Work/Education/Project/Skill/Language/Award); Touchine displayed five named Project entities with category metadata and empty outcomes. Source cards switched the lower Entity Review correctly, provenance expanded to page/line anchors, same-type duplicate Touchine import added `0`, and refresh retained five pending projects. No entity was confirmed on the user's behalf; Confirmed Career Model and derived Evidence both stayed `0`.
- **Completion decision:** `CAREER DOCUMENT UNDERSTANDING FOUNDATION = COMPLETE`, `NO-MODEL ARCHITECTURE = FROZEN`, `TARGETED MAPPING FIXES = CLOSED`. Remaining non-blocking limits are source-section semantic ambiguity, conservative review calibration, unsupported long-tail Resume sections, and portfolios without reliable boundaries that remain `needs_manual_selection`. P4.2 was not started.

## 60. P4.1 Archive Cleanup & Documentation IA Closeout（2026-08-24）

- **Cleanup boundary:** `document_benchmark/CLEANUP_MANIFEST.md` classified project bytecode/Finder metadata as `SAFE_DELETE`; benchmark JSON, GPT audit, contracts, source material, Phase 3 OCR screenshots, production source and documentation as `KEEP`; shared Hugging Face/Docling/Paddle cache references as `REVIEW_REQUIRED`. No broad cache parent, global runtime, original material, IndexedDB, SQLite or legacy Evidence was deleted.
- **Deletion result:** removed two project-local `__pycache__` directories (192 KB), two `.DS_Store` files (16 KB), and an empty benchmark-created Paddle cache hierarchy. Approximate reclaimed space: 208 KB.
- **Regression after deletion:** all CareerEntity fixtures passed, including English CV, Touchine, Tencent Resume PDF/DOCX, Tencent Portfolio and 45-page Portfolio. CareerEvidence/domain and Phase 3 analysis review regressions passed; native smoke reported `macos_pdfkit_native_blocks_v1`, OCR smoke reported `native_pdf+selective_apple_vision_v1_auto` with page 1 OCR. Result: `0 architecture regressions`.
- **Documentation IA:** root now exposes five daily entry documents. Frozen architecture reports moved to `docs/architecture/`, completed phase records to `docs/history/`, and `document_benchmark/README.md` separates durable truth/final/audit artifacts from retained historical/challenger measurements. `README.md` records the frozen architecture, current capability and intentional non-goals. P4.2 remains unimplemented.

## 61. Repository Structure Cleanup（2026-08-24）

- **Responsibility layout:** `app.py` remains the stable localhost entrypoint. Production modules are `src/`, OCR/PDFKit/Vision adapters are `src/extraction/`, bounded manual operational commands are `scripts/`, and authoritative regressions are `tests/`. `data/schema.sql` joins the database, contracts and evidence it defines; `public/`, `data/domain_contracts/`, original materials and benchmark evidence were not moved.
- **Dependency update:** app imports `src.career_evidence` and resolves schema/OCR adapters from their new paths. Scripts bootstrap the project root only when invoked directly and then import `app.py`/`src` as needed. Tests and `document_benchmark/run_benchmark.py` import `src` and invoke the relocated Swift adapters. README commands and Markdown paths were updated.
- **Post-move proof:** Python compilation, full CareerEntity fixtures, Node CareerEvidence regression, Phase 3 rollback regression, Mock provider operation and no-network DeepSeek preflight all passed. A temporary localhost server served `/`, `/career-evidence.html` and `/api/jobs` successfully with 14 local jobs. No product data or architecture contract changed.

## 62. Product Architecture V2 Gate Audit（2026-08-25）

- **Gate boundary:** architecture/documentation only. No production source, schema, IndexedDB, SQLite, Provider, OCR, Career record or JD was changed; Master Synthesis and OCR/Provider benchmarks were not rerun.
- **Actual split discovered:** Local CareerEntity/CareerEvidence and AI `ai_career_contexts`/`ai_career_profiles` are parallel paths. Career Intelligence V0 reads confirmed Local Evidence plus `/api/jobs`, not the accepted AI Profile; therefore the current default AI-first Candidate understanding has no grounded bridge into downstream Evidence/Matching.
- **Persistence risk:** `career-evidence.js`/`career-profile.js` open `job-radar-local-first-v1` at version 7, while `local-first.js`/`local-jobs.js` still request version 2. Opening an IndexedDB database below its existing version can raise `VersionError`; this is a code-level architecture risk, not a browser-reproduced failure in this Gate.
- **Two Job truths:** SQLite contains 14 formal jobs (JD-001～014) and one Mock `job_analyses` record; the browser `jobs` store separately holds human-confirmed screenshot/text imports. V2 design keeps SQLite as formal Job repository and marks browser jobs for later explicit reconciliation.
- **V2 decision:** `ADOPT WITH CHANGES`. CareerEntity becomes Local/Legacy intermediate; new main contract is `AI Interpretation Artifact → Human Cards → Reviewed Candidate Context → CareerEvidence`, followed later by `JobRequirement → MatchJudgment → ApplicationDossier`.
- **Offline verification:** bundled Python compilation; browser JS syntax; AI Career artifact/cache; CareerEntity review/selective Evidence; Career Intelligence epistemic boundaries; AI ingestion/provider capability; and rollback-only analysis persistence all passed. No provider request occurred; OCR real-fixture/benchmark tests were intentionally not run.

## 67. Scoped Conversation Foundation（2026-08-26）

- **Product boundary:** adopted object-scoped, provider-independent discussion; v1 scope is `CANDIDATE_ITEM` only. A deterministic session identity prevents cross-card history and preserves identity when a future user changes models. It is not General Career Chat.
- **Reference-first:** OpenAI Agents SDK Sessions contributed stable session/custom-storage/recent-history concepts only; Chatbox contributed provider/model/protocol separation. Neither SDK, hosted conversation store, session UI nor provider configuration platform was introduced. Exact adoption matrix: `docs/architecture/SCOPED_CONVERSATION_FOUNDATION.md`.
- **Implementation:** `public/scoped-conversation-domain.js` supplies pure Session/Message validators, canonical assistant result storage, canonical error taxonomy and an eight-message Context Compiler. IndexedDB v9 adds `conversation_sessions` and `conversation_messages` additively across each browser database opener.
- **Safety evidence:** regression verifies card isolation, no history leakage, model switching with session identity intact, per-turn provenance, compilation exclusions, normalized error boundary and unchanged CandidateContext. No Provider call, credential access, source transmission, Candidate truth mutation or UI redesign occurred.
- **Remaining scope:** no V2 Candidate Card Detail currently exists, so no chat surface or actual conversation send is claimed. Any future model call remains subject to the existing action-time disclosure/consent rule; any future Context Patch remains proposal → user review → confirm.

## 68. Web BYOK Provider Feasibility Spike（2026-08-26）

- **Scope:** an isolated browser transport spike only. New files are `tests/web_provider/browser-byok-probe.{html,css,js}`, `tests/web_byok_harness_regression.mjs`, and `docs/architecture/WEB_BYOK_PROVIDER_FEASIBILITY.md`; no production provider implementation, Candidate data model, database store, proxy, key store, telemetry path, or product UI changed.
- **Real browser evidence:** browser origin `http://localhost:8011` made only credential-placeholder model-list `GET` requests. DeepSeek/OpenAI/Anthropic produced HTTP 401, Gemini 400, and OpenRouter 200; custom auth headers required browser preflight. Browser console log count was 0. No real credential, request body, career source, Candidate Context, JD, model inference, stream, response content, or paid use occurred.
- **Meaning:** results are `browser_transport = CONFIRMED_HTTP_RESPONSE`, not provider readiness. The contract independently holds `default_policy`: DeepSeek/Gemini candidate session-BYOK routes; OpenAI not default allowed under official client-secret guidance; Claude/OpenRouter reference only.
- **Safety / learning boundary:** strict CSP enumerates the five exact provider origins. The probe forbids persistence and key query strings. Audit and harness are Tool-assisted; the user has no new independent implementation capability evidence. One later direct `deepseek-v4-flash /responses` synthetic smoke may be proposed only with new action-time approval.

## 69. Gemini Browser BYOK Runtime Smoke Wiring（2026-08-26）

### 69B. Add Model Bottom Sheet Contract（2026-08-26）

> Historical pre-implementation record. Section 70 supersedes its session-only/no-persistence statements.

- **Scope:** current-page UI interaction only, no Provider integration expansion. `public/add-model-sheet.js` owns a pure three-Provider model-level catalog and an explicit state machine; `index.html` supplies the accessible overlay/dialog and `runtime-selection.js` receives a verified completion only through the sheet callback.
- **Compatibility filter:** the catalog contains exactly DeepSeek `deepseek-v4-flash-vision-exp`, Gemini `gemini-3.7-flash`, and Qwen `qwen3.8-max`. `compatibleModels(providerId, accountIds)` is an intersection, so returned text-only/unknown IDs never become candidates and a Provider-level capability cannot leak across models.
- **Key and call boundary:** the Key stays only in the mounted sheet state and is blanked on close; the code has no fetch, persistence, API proxy, URL key or console path. The connect action deliberately enters `AWAITING_APPROVAL`; a future approved adapter must supply account-returned IDs and an independently verified selected model before ✓ completion can be enabled.
- **Verification:** offline catalog/filter, sheet markup and runtime integration regressions pass. Browser observation verified the sheet title/provider picker, Qwen official key link, disabled completion and close behavior. No Key input, Provider request, Candidate data or career source was sent.

### 69A. Multimodal Readiness Contract Correction（2026-08-26）

- **Root cause corrected:** the earlier `Reply only: OK` synthetic text request was a protocol-matched check only for text models. Applying its empty-content result to `deepseek-v4-flash-vision-exp` was an invalid capability inference, not evidence of a provider outage or an unavailable vision route.
- **Official capability correction:** DeepSeek's 2026-08-21 announcement identifies the exact `deepseek-v4-flash-vision-exp` model as an experimental multimodal visual-understanding API model and documents mixed text/image, Base64, URL and Files image inputs plus Chat Completions support. Its `ModelDescriptor` is therefore `official_contract + TEXT/VISION + VERIFIED`; it alone is eligible for the current DeepSeek V1 selector. The announcement explicitly contrasts text-only `deepseek-v4-flash`, so provider-level capability is not spread to flash/pro or unknown IDs.
- **Entry versus network evidence:** selecting the official model records `OFFICIAL_MODEL_CAPABILITY` and enables the local Workspace arrow without calling a Provider. It does not set `MULTIMODAL_CONNECTION_READY` or `STRUCTURED_OUTPUT_VERIFIED`; those retain their respective future test contracts.
- **Correct synthetic request shape:** `multimodal_connection_request` is protocol-driven. The DeepSeek Chat Completions adapter emits one text part, then a synthetic `data:image/jpeg;base64,...` `image_url`, disables thinking, uses `max_tokens: 32`, and normalizes `choices[0].message.content`. The test passes only for normalized `JOB RADAR TEST`, not merely non-empty content. The fixed 360×96 asset is `public/job-radar-multimodal-smoke.jpg`; it contains no user or career data.
- **Gemini parity:** browser discovery accepts only the returned, official text+image candidate `gemini-3.1-flash-lite`; its `generateContent` request contains the same instruction, an `inlineData` PNG created in-memory by canvas, and `maxOutputTokens: 32`. Key lifecycle remains request-memory only; session diagnostics omit the key. No actual API call was made.
- **Conversation contract:** `compileContext` has no automatic image insertion. It returns `relevant_source_image: null` for text-only discussion and only includes an explicitly supplied image tied to a relevant source. This remains an offline domain contract, not a conversation UI or inference path.
- **Regression evidence:** provider protocol/capability, mocked runtime request, Gemini request/normalizer/key-safety, runtime selector UI and scoped conversation regressions passed; Python compilation passed. These are Tool-assisted implementation checks, not real multimodal capability evidence.

- **Superseded record:** the former text-only `Reply only: OK` request / max 16 / text-model selector description is historical only. The preceding 69A contract replaces it; code now has an explicit `MULTIMODAL_SMOKE_APPROVED = false` gate, so key entry cannot itself issue a billable request.

## 66. Provider Reference-First Audit + Runtime Adapter（2026-08-26）

- **Decision boundary:** after two earlier, user-approved minimal calls produced an HTTP response with empty visible content, no further Provider endpoint/model guessing or paid call was made. The result is `protocol / request-shape / response-normalization unresolved`, not `Provider unavailable`.
- **Reference adoption:** `docs/architecture/PROVIDER_REFERENCE_FIRST_AUDIT.md` records inspected Chatbox, Cherry Studio, Resume Tailor, LiteLLM and official DeepSeek materials. The adopted minimal pattern is `model descriptor → declared protocol + capability → request transform → response normalizer`; it deliberately does not add a provider marketplace, gateway, new UI flow or a second stack.
- **Implementation:** new pure `src/provider_runtime.py` declares `deepseek-v4-flash = OPENAI_RESPONSES + TEXT`, `deepseek-v4-pro = OPENAI_CHAT_COMPLETIONS + TEXT/STRUCTURED_JSON`, and `deepseek-v4-flash-vision-exp = ACCOUNT_EXPERIMENTAL + no declared text capability`. `app.py` selects the descriptor before constructing a request; `public/runtime-selection.js` renders official versus account-visible experimental status. An unconfirmed text capability returns HTTP 422 without model inference.
- **Known-safe tests:** protocol routing, request payload construction, response normalizers, empty-response fail-closed behavior, experimental-model blocking, selector state and Local → Workspace navigation pass. No Resume, Portfolio, Candidate Context, JD, Candidate truth, SQLite or IndexedDB record was sent or changed by this slice.
- **Still unverified:** a real `deepseek-v4-flash` `/responses` smoke result is pending a new action-time approval. The approved future request must be exactly disclosed (provider/model/endpoint/protocol/synthetic input/output cap/reason) before it is sent. `Step 1A` therefore remains `IN PROGRESS`, and this implementation remains Tool-assisted; there is no new user-owned capability evidence.

## 69B. Qwen direct multimodal verification (2026-08-26)

- **UX decision:** by user decision, Qwen requires only the API Key. The connection button immediately reports `正在发送模型列表请求`, `正在等待 Qwen 响应`, `正在验证图文输入能力`, followed by success or a bounded failure message.
- **Provider contract:** Qwen's OpenAI-compatible Chat endpoint accepts the fixed model `qwen3.8-max` and an image URL message part. The local check posts only the 360×96 synthetic `JOB RADAR TEST` image plus its text-reading instruction to `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`.
- **Local boundary:** `POST /api/runtime-providers/qwen/connection-check` accepts only request-memory API Key, never logs/stores/returns it, and receives no career material. It is not a cloud Job Radar proxy. A real call can incur minimal usage.
- **Capability decision:** only a response whose visible content contains `JOB RADAR TEST` enables the exact `qwen3.8-max`; Qwen/provider labels and model names cannot inherit vision.
- **Regression:** `tests/add_model_sheet_regression.mjs` asserts the user-visible live state flow and absence of `AWAITING_APPROVAL`; `tests/qwen_runtime_connection_regression.py` mocks the synthetic image request, expected output, header boundary and invalid-key no-network behavior. Browser refresh with an already-entered key was rejected by browser security policy, so no key was read, moved, sent or live-tested in this run.
- **Selector persistence correction:** verified additions are a separate `addedModels` list, keyed by provider and model and persisted only in `sessionStorage` without credential or Provider response. The primary selector renders these models alongside the local DeepSeek catalog, and `loadModels()` initializes its default only when no selected model exists; its async completion cannot replace Qwen.

## 65. Step 1 Implementation Preflight + Phase A–B Contract Preparation（2026-08-25）

- **Scope and unchanged boundaries:** V2 architecture remains frozen. This update only begins Step 1's safe implementation preparation: no Portfolio, Job, Match, generation, Capability Card, Career Mentor, OCR benchmark, old CareerEntity migration, MCP/RAG/Agent/Skill/CLI, Master Synthesis, SQLite write, source deletion, or external push. Existing `SourceDocument`/`CareerEntity`/`CareerEvidence`/AI Markdown records remain untouched.
- **Git privacy baseline:** `job-radar` and its parent were confirmed not to be Git worktrees. A local empty Git repository was initialized after `.gitignore` was expanded to exclude credentials, runtime SQLite, local OCR uploads, private candidate document/export folders, logs, cache and Finder metadata. `git status` shows no initial commit and no remote exists. `git check-ignore` confirms both `data/job_radar.db` and `data/local_ocr_uploads/` are ignored. No data was staged, committed, moved, deleted, or pushed.
- **Provider preflight:** Keychain credential presence was checked without reading/printing the secret. An account-authorized `GET https://api.deepseek.com/models` returned `deepseek-v4-flash`, `deepseek-v4-pro`, and `deepseek-v4-flash-vision-exp`; no Resume or model inference request was sent. The current official docs confirm OpenAI-compatible chat completions, vision image input for `deepseek-v4-flash-vision-exp`, and JSON Output via `response_format: {type: json_object}` while warning that JSON-mode content can be empty. See <https://api-docs.deepseek.com/>, <https://api-docs.deepseek.com/guides/vision/>, and <https://api-docs.deepseek.com/guides/json_mode/>.
- **Phase A — minimal additive contracts:** added `public/candidate-context-domain.js` with CandidateItem/CandidateProposal/CandidateContext/ContextPatch validation, action-scoped ProcessingConsent, actual ProcessingRun state transitions and failure-layer requirement. IndexedDB is now v8 in every opener (`career-evidence.js`, `career-profile.js`, `local-first.js`, `local-jobs.js`, `workspace.js`) and creates only five new stores: `candidate_contexts`, `candidate_proposals`, `candidate_context_patches`, `processing_runs`, `processing_consents`. The migration does not delete, rename or transform legacy stores.
- **Phase B preparation — structured proposal boundary:** added `src/candidate_context.py`, which builds a DeepSeek vision request with JSON Output, a source/page/provenance-aware CandidateItem contract, and a local parser/validator. Empty content, malformed JSON, a missing source ref, an unknown item type, duplicate IDs, a non-`NEEDS_REVIEW` item, or invalid uncertainty fails closed. A valid response becomes a review-only CandidateProposal with usage metadata; it cannot create confirmed CandidateContext. The module remains unconnected to the page/API until the action-scoped consent and Card flow are implemented, so no code path silently sends a Resume.
- **Regression:** `tests/candidate_context_regression.mjs` passed CandidateProposal validation, confirmed-context boundary, Patch-preview boundary, real ProcessingRun transitions, and consent state. `tests/candidate_context_provider_regression.py` passed JSON-mode payload, valid review-only proposal, and empty/malformed/ungrounded failure cases. Existing `tests/ai_career_context_regression.mjs` and Python compilation also passed. These are contract regressions only, not real-user acceptance evidence.
- **Known blockers / next action:** Card visual implementation intentionally waits for the Figma Candidate Human Calibration Kit. Real Proposal execution requires one user-selected Resume PDF and a UI-created ProcessingConsent that names the file, DeepSeek, purpose and possible API cost. There is no real CandidateContext, Card review, Direct Edit, AI correction, Patch confirmation, persistence/reopen test, or token-cost result yet.

## 70. Add Model sheet resizable/persistent/stateful interaction（2026-08-27）

- **Implementation boundary:** changed only `public/index.html`, `public/styles.css`, `public/add-model-sheet.js`, the Runtime Selection mount mapping and their targeted regressions. No Provider adapter, Candidate Context, conversation, patch, Resume/JD flow or paid smoke-test behavior changed.
- **Resizable sheet:** `#add-model-drag-handle` uses pointer capture, clamps height to the current visual viewport, and snaps to 52% / 72% / 90% detents on release. The panel is flex-based with a separately scrolling body; keyboard Arrow Up/Down changes height by 72 px.
- **Provider/key state:** the segmented Provider buttons were replaced with `#add-model-provider`. `localStorage` uses Provider-scoped keys (`job-radar-provider-api-key:deepseek|gemini|qwen`) plus one last-Provider key. Input writes immediately; trash removes the active Provider's value; close no longer clears the Key. Controller snapshots continue to redact `apiKey`.
- **Stateful button:** `SENDING|WAITING|VERIFYING → is-loading`, `VERIFIED → is-success`, `FAILED → is-failed`. CSS collapses the label while loading/success, spins a dedicated SVG loader, and exposes only the check SVG after success. The visually removed status row is retained only as `.sr-only[aria-live]` so state changes remain accessible.
- **Acceptance evidence:** `tests/add_model_sheet_regression.mjs` and `tests/runtime_selection_regression.mjs` pass under bundled Node; both modified scripts pass `node --check`. In the local browser, DeepSeek/Gemini/Qwen links resolved to their respective Key pages, the sheet height changed 592→520 px through the accessible resize control, and a fake Key on an isolated `127.0.0.1:8001` origin left the connection action enabled after refresh. A visual screenshot confirmed dropdown layout, trash icon, local-storage copy, icon-only completion and absence of the old bottom status row. No connection button was submitted and no external Provider call occurred.

## 71. Runtime default readiness / durable Qwen selection / Apple menu（2026-08-27）

- **Bug classification:** UI state synchronization. The default `ModelDescriptor` populated provider/model fields but did not transition the runtime phase, leaving the displayed DeepSeek selection paired with a disabled next action.
- **Single readiness path:** `applyReadyModel()` now owns default, restored and clicked readiness. Official DeepSeek → `OFFICIAL_READY`; verified added Provider model → `READY`; local choice → `LOCAL_READY`. `loadModels()` restores a saved compatible descriptor before falling back to its default and never replaces a ready restored Qwen selection.
- **Durable browser state:** `job-radar-added-runtime-models` and `job-radar-selected-runtime` are Key-free JSON records in `localStorage`. Earlier session-only added models migrate forward when found. Provider Keys remain separate under `job-radar-provider-api-key:<provider>` and are written on input/change/blur/close/pre-connect. `localhost` is redirected to `127.0.0.1` to prevent two browser-storage origins.
- **Interaction implementation:** no Uiverse color/layout was copied. The existing monochrome action received only interaction qualities: cubic-bezier elevation, two-layer hover shadow, 3 px arrow translation and `.94` press scale. The selector receives continuous border/shadow/scale transitions. The listbox now stays mounted for animation and uses `visibility + opacity + translateY + scale`, 20 px rounded/blurred surface, staggered row reveal, selected checkmark and redundant-title removal.
- **Browser evidence:** after reload, selected text was exact DeepSeek model, `#runtime-action` was enabled with class `ready`, and direct click navigated to `/workspace.html`. The menu transitioned from `opacity=0, visibility=hidden, matrix(.985,...,-9)` to `opacity=1, visibility=visible, identity`; its computed radius was 20 px. Action hover shadow increased to `0 14px 30px` plus `0 4px 10px`, transform translated Y by -2 px. Browser error/warning log was empty. No Provider request or credential transmission occurred.

## 72. Shared floating-window controller + embedded scroll safety（2026-08-28）

- **Implementation:** `public/floating-window.js` exports pure `moveRect` / `resizeRect` geometry and a DOM mount controller. It installs one drag surface plus `n/e/s/w/ne/nw/se/sw` resize zones, clamps all results to the visual viewport, supports effective minimum dimensions on narrow viewports, and resets inline geometry when a reversible overlay closes. Runtime Add Model and the Personal/JD shared detail/import surface use the same controller.
- **Iframe boundary:** during an active gesture, one fixed interaction shield sits above iframe content so pointer movement cannot be swallowed when crossing the embedded page. The shield and selection lock are removed on pointerup/pointercancel/reset.
- **Single-plane detail:** embedded `.v1-split-view` computed `gap = 0px`; both inner pane radii and general borders computed `0px`; the left pane computed `border-right-width = 1px`. Both panes use the same paper surface; their business markup, scoped conversation contract and two independent scroll regions remain intact.
- **Scroll-end proof:** both embedded panes compute `padding-bottom = 52px` and stable scrollbar gutters; WebKit tracks are inset 14px. Browser automation moved the left pane to `scrollTop = max = 665`; its final child bottom was `433.656px` against pane bottom `497.5px`, leaving approximately 64px visible clearance. The right no-overflow pane retained 52px clearance. Import pages additionally use 56px bottom padding and 24px terminal-card margin.
- **Regression:** all 14 top-level Node `.mjs` regressions passed, including new geometry tests for viewport clamping, corner growth and minimum-size enforcement. Final browser cache version `v1-motion-20` confirmed eight handles, zero gap/radius, 1px divider and 52px safe padding. Runtime `runtime-ui-v47` confirmed eight Add Model handles, one draggable header and reversible close state. `GET /jd.html` returned HTTP 200. No Provider request, credential access or career-data mutation occurred.

## 73. Workspace folder transform ownership + bidirectional paper staging（2026-08-28）

- **Reference inspection:** ten frames from `Screen Recording 2026-08-28 at 13.08.18.mov` confirmed that front-cover rotation and copy movement were visually disconnected, while the paper stack appeared/disappeared as a hard state change.
- **Transform ownership:** `Personal Information` / `JD`, subtitle and count nodes now live inside `.v1-folder-front`. Their local `translateZ(2px)` only prevents z-fighting; the cover owns perspective rotation, translation and return. The `01/02` index remains on the folder back plane by design.
- **Paper rest/open contract:** every `.v1-folder-paper` rests at exact `translate3d(0,8px,0) rotateX(0) scale(.98)`, so later DOM order exposes one sheet. Open endpoints are `-8/-19/-30px` with `.98/.96/.94` scale. Entrance delay is front-to-back `0/42/84ms`; base/exit delay is back-to-front `0/42/84ms`. All use `560ms cubic-bezier(.16,1,.3,1)` and `will-change: transform`; no opacity/display/visibility discontinuity exists.
- **Measured browser sequence:** rest top coordinates were `[627.99, 627.99, 627.99]`. Opening samples showed `[324.49,324.49,321.38] → [319.20,312.19,312.31] → [302.54,304.68,309.31] → [293.81,300.76,307.72]`. The front transform advanced continuously from identity to the -30° matrix while the nested copy position changed in the same frames.
- **Verification:** `tests/step_02_03_ui_framework_regression.mjs` now asserts nested copy ownership, unified rest transform, staged delays and symmetric hover/focus-visible behavior. All 14 Node suites, 17 public JS syntax checks and localhost Workspace HTTP 200 passed. No external request or data write occurred.

## 78. Workspace folder leave-order / layer-crossing correction（2026-08-28）

- **Observed failure:** a real pointer leave on `v1-motion-21` sampled paper tops as `[293.81,300.76,307.72] → [307.67,302.92,307.72]`. The back paper therefore crossed the middle layer almost immediately and disappeared behind it, producing the user's apparent “page deletion” flash.
- **Corrected physical rule:** close the front paper first, then middle, then back. Rest delays are now paper-1 `0ms`, paper-2 `56ms`, paper-3 `112ms`. Entrance remains paper-1/2/3 `0/42/84ms`, so one sheet still fans into three in the intended order.
- **Independent exit motion:** the rest state owns `660ms cubic-bezier(.22,.72,.2,1)` for paper transforms and `640ms` for the cover. Hover/focus owns the existing faster `560ms` paper / `520ms` cover spring-like curves. No opacity, display or visibility switch was introduced.
- **Real-pointer regression:** browser CUA moved into and out of both Workspace folders for three cycles each. Every sampled close state preserved `paper-3 top ≤ paper-2 top ≤ paper-1 top`; all six cycles returned to exact overlap `[324.49,324.49,324.49]`. Key frames were visually inspected at open, close +120ms and closed.
- **Automated verification:** V1 cache version is `v1-motion-22`; the targeted motion regression, all 14 Node suites, all 17 public JS syntax checks and Workspace HTTP 200 passed. No Provider request or persistent career-data write occurred.

## 79. JD folder paper/color state synchronization（2026-08-28）

- **Problem:** `.v1-object-folder.dark` owned a dark back/front palette, but `.v1-folder-paper` was permanently forced to `#f5f6f8`. The saved paper therefore remained white while the JD folder was black.
- **Implementation:** dark rest paper/background/border/line colors are `#2a2e36 / #3b404a / #555b67`. The existing `:hover`, `:focus-visible` and `.v1-transition-light` states now jointly restore paper/background/border/line colors to `#f5f6f8 / #d9dee7`. Paper background and border transitions were added to the existing motion transition without altering geometry.
- **Browser evidence:** rest measured paper `rgb(42,46,54)`, border `rgb(59,64,74)`, line `rgb(85,91,103)`; hover measured paper `rgb(245,246,248)`, border/line `rgb(217,222,231)`; the 180ms leave frame showed continuous intermediate colors, then returned exactly to dark rest values.
- **Verification:** V1 cache version is `v1-motion-23`; all 14 Node regressions, 17 public JS syntax checks and Workspace HTTP 200 passed. No external request or stored domain state changed.

## 80. Folder terminal-frame compositor stabilization（2026-08-28）

- **Reproduced risk:** the previous closed cover ended with computed `transform: none`, while all three papers occupied `translateZ(0)` with the same z-index and completed their delayed transitions around the same final interval. The browser could therefore rebuild/demote layers and momentarily reorder a paper above the cover.
- **Stable planes:** `.v1-folder-back` now remains at `translateZ(-4px)`; papers use `--paper-depth: -3/-2/-1px` and z-index `1/2/3`; the cover remains at `translate3d(0,0,0)` with z-index `4`; the index remains at z-index `5`. `backface-visibility: hidden` is applied to all animated physical surfaces.
- **Deterministic close:** papers close over `500ms cubic-bezier(.22,.72,.2,1)` with front/middle/back delays `0/40/80ms`. Their maximum completion is 580ms, before the cover's 640ms close. Hover separation uses 480ms with `0/32/64ms` delays and retains the same visual endpoints.
- **Paint reduction:** hover no longer interpolates `box-shadow`; `transitionProperty` measured as `transform, background-color, border-color` for papers and cover. Shadows are static, and `.v1-object-folder` uses `contain: layout style` plus `isolation: isolate` to constrain invalidation without clipping the tab geometry.
- **Real pointer evidence:** both folders were opened and closed three times. Open paper tops were consistently `[294.125,300.961,307.812]`; closed tops were consistently `[324.732,324.653,324.573]`, the small terminal difference being the intentional fixed perspective depth. Final transforms retained Z depths `[-3,-2,-1]`, z-order stayed `[1,2,3]`, and the cover returned to identity without `none`. A rapid reversal also returned to the exact same terminal state. Open, 300ms close and final screenshots were inspected; browser console logs were empty.
- **Verification:** V1 cache version is `v1-motion-24`; all 14 Node `.mjs` regressions, 17 public JavaScript syntax checks and `GET /workspace.html` HTTP 200 passed. No Provider request, credential access or persistent domain-data write occurred.

## 81. Embedded import scrollbar ownership and rounded-corner clearance（2026-08-28）

- **Observed failure:** the screenshot showed the Personal import scrollbar thumb ending directly at the floating surface's lower-right clip. Although the body selector declared `overflow:auto` and a track margin, standards-mode root overflow propagation left the iframe viewport as the effective scroll owner, so the intended inset did not govern the visible bar.
- **Implementation:** embedded Personal/JD import bodies are fixed to `height:100vh; overflow:hidden`. Their `.v1-page-shell` elements are now the explicit `100vh` scroll containers with `overflow-y:auto`, `overflow-x:hidden`, `overscroll-behavior:contain`, 52px scroll padding, stable gutter and thin scrollbar fallback. WebKit tracks use `margin-block:20px`; thumbs use a transparent 3px border, `background-clip:padding-box` and a 999px radius.
- **Personal evidence:** at 1022×516, the body remained `516/516` with hidden overflow; the shell measured `clientHeight=516`, `scrollHeight=696`, maximum `180`. A real CUA wheel event scrolled the shell to `180.5` while window scroll stayed zero. The final screenshot showed bottom clearance inside the actual 80% floating overlay.
- **JD evidence:** the same viewport produced shell `clientHeight=516`, `scrollHeight=668`, maximum `152`; a real wheel event reached `152`. This confirms both import routes share the same scroll authority rather than only matching CSS text.
- **Verification:** cache version is `v1-motion-26`; all 14 Node regressions, 17 public JS syntax checks and 8 active V1 HTTP routes passed. No external request or persistent domain-state write occurred.
- **Figma MCP state:** this pending note is superseded by evidence 82 below.

## 82. Local-only detail boundary + direct Figma MCP export（2026-08-28）

- **UI boundary change:** `candidate-detail.html` and `job-detail.html` no longer include `.v1-conversation-pane` markup. `v1-pages.js` no longer loads/writes demo conversation messages from these pages, while Candidate/Job retrieval, structured rendering, local import processing and Candidate direct edit remain unchanged.
- **Layout change:** `.v1-split-view` and embedded detail now use one `minmax(0,1fr)` information column. The shared overlay iframe title changed from `资料信息与 AI 对话` to `本地资料详情`; unused conversation UI CSS was removed.
- **Browser proof:** a real JD card opened an 80% overlay whose iframe contained one `.v1-structured-pane`, zero `.v1-conversation-pane`, and title `本地资料详情`. The Personal add card opened an import overlay with one `.v1-file-picker`, zero conversation panes and title `添加个人材料`.
- **Direct MCP export:** Figma MCP authenticated `OXOOOOX`, captured the 14-page public inventory plus six interactive states, removed five duplicate/spurious captures, and arranged 20 named editable frames on page `Job Radar — UI Screens` in file `3XdQUI6Dd1BhGCZVhFOncF`.
- **Visual proof:** Figma-rendered screenshots confirmed Add New Model, Candidate local-only detail and Job local-only detail. The detail screenshots show full structured data without a right-side AI surface.
- **Security/payment boundary:** the paid `html.to.design` continuation was not accepted; no upgrade action was executed. Captures used sanitized fixture UI only. Temporary `mcp.figma.com` script/CSP allowances were removed after export, leaving zero capture-script references.
- **Regression:** all 14 top-level Node `.mjs` suites, all 17 public JavaScript syntax checks and all 14 public HTML HTTP checks passed. No Provider/API request, credential read, API Key transmission or personal career-data mutation occurred.
## 2026-08-31｜Ariadne duplicate-aware intake and Figma parity

- **Changed code:** `public/v1-demo-domain.js` adds pure text normalization, overlap scoring, duplicate lookup, deterministic Candidate/JD merge and local persistence helpers. `public/v1-pages.js` adds the accessible duplicate-resolution dialog and branches by selected runtime. `public/jd-import.html` adds an optional source URL. `public/styles.css` centralizes the Ariadne font stack, neutral workspace canvas, equal card-grid rows, 20px squircle-compatible surfaces and AI/user message colors.
- **Persistence invariant:** duplicate detection occurs before the write. Local merge retains the existing ID and provenance, unions fields/sources, increments version and annotates `merge_metadata`; keep creates a distinct record; cancel performs no write. The model-selected merge branch performs no hidden deterministic fallback and no silent write.
- **Model/API boundary:** no Provider endpoint was called. Selecting model fusion results in a visible approval-required error before persistence. This preserves the existing `AI Proposal → User Review → Persist` boundary until a bounded Provider test is explicitly authorized.
- **Browser evidence:** a sanitized AI Product Manager JD plus optional URL was imported in Local mode; one duplicate group was detected; `融合重复内容` produced one final card. Personal grid row heights and all gaps measured equally at 18px. Figma/card surfaces computed to 20px; supporting browsers reported `cornerShape=squircle`. Static AI Candidate detail showed user bubbles white and AI bubbles black. Console errors were zero and the original Qwen runtime was restored.
- **Regression evidence:** every `tests/*.mjs` suite passed with the bundled Node runtime. Every `tests/*.py` script passed with `PYTHONPATH=.` and the bundled Python runtime. The synthetic Provider smoke token intentionally remains `JOB RADAR TEST` because it is an external readiness contract, not user-facing branding.
- **Figma evidence:** file `3XdQUI6Dd1BhGCZVhFOncF`, page `Ariadne — UI Screens`, frames `9:2`, `13:2`, `10:2`, `47:2`, `14:2`, `12:2`, `64:2`. Verified properties include `cornerRadius=20`, `cornerSmoothing≈0.6`, Recursive/Inter text, optional JD URL, black AI messages and white user messages.

## 2026-09-01｜Material-routed intake and V1 geometry evidence

- `src/candidate_context.py` exposes `MATERIAL_TYPE_GUIDANCE` for Resume / Portfolio / Project / Other and `normalized_material_type()` rejects any unsupported label. `PROMPT_VERSION` is `candidate_item_proposal_v2_material_routed`; page labels in the JSON-mode request carry the selected material type.
- `public/v1-demo-domain.js` maps the same four UI types to stable prompt-profile IDs. `public/v1-pages.js` persists the selected profile in local import metadata; no `fetch()` or Provider call was added.
- Personal and JD file inputs retain `.pdf,.png,.jpg,.jpeg,.docx`; JD has exactly two modes (`Document/图像`, `Paste/粘贴文本`). File validation accepts only those five extensions in Document mode.
- Browser measurements at `720×782`: Workspace wordmark center `360px` equals viewport center `360px`; folder pair uses CSS `901/27/252` at desktop and each folder rendered `256.797×252px` in the current viewport; minibar rendered `57×53px`. Personal dropzone outer/inner deltas are exactly the 1px border on each side (`542×232` / `540×230`), and upload text opacity is `0.9`.
- All six back-arrow pages reported the same pseudo geometry (`24×24`, `left 3`, `top 6`) and the same round-cap/round-join mask. JD guide opened a reversible overlay with `jd-import.html?embed=1`; close restored source visibility.
- Automated evidence: 14 Node `.mjs` regressions, targeted Candidate prompt 5/5, 17/17 public JS syntax and 7/7 active V1 HTTP 200 passed. One existing Portfolio fixture assertion remains in `tests/career_entity_regression.py`; it predates and is unaffected by this UI/prompt-only change. No real user document, API Key or Provider endpoint was accessed.

## 2026-09-01｜Figma vector folder and runtime-scoped editing evidence

- **Design source:** Figma MCP `get_design_context` inspected file `3XdQUI6Dd1BhGCZVhFOncF`, Workspace node `9:2`, including Personal folder node `9:22` and JD folder node `9:60`. The exported folder back contains one continuous SVG path. `public/assets/figma-folder-back.svg` preserves that path and `public/styles.css` applies it as a mask; the old pseudo-element tab is disabled with `content:none`.
- **Runtime authority:** `public/v1-pages.js::setDetailRuntimeMode()` reads the active selected Runtime. Local mode sets `data-detail-runtime=local`, hides the scoped conversation and exposes `#open-direct-edit`; model mode sets `data-detail-runtime=ai`, keeps the right conversation and hides direct editing. Record recognition provenance remains separately available as `data-record-recognition`.
- **Visible local response:** browser navigation through Runtime → Workspace → Personal → stored Education card showed the top-right `编辑`. A real click expanded the form, invoked smooth `scrollIntoView`, focused the summary textarea and exposed preview/confirm/cancel controls without leaving the floating detail surface.
- **Reviewable model path:** deterministic QA routes for Candidate and JD kept the right conversation, accepted Chinese correction requests, and rendered before/after/reason proposals with accept/reject actions. `jobPatchFor()` and `applyDemoJobPatch()` add the same scope/version validation already used by Candidate patches; neither path performs a Provider call.
- **Icon evidence:** computed/contract checks require the back mask, add pseudo glyph, sheet close and detail close to render at `24×24`; close hit targets remain `36×36`. Add Model and embedded detail DOM no longer include a second literal `×` glyph.
- **Automated evidence:** 14/14 Node `.mjs` suites, public JavaScript syntax, 5/5 `candidate_context_provider_regression.py` tests and 9/9 HTTP page/asset checks passed. Browser screenshots covered Workspace rest, Local edit, model conversations and Add Model close. Runtime cache is `runtime-ui-v48`; V1 is `v1-motion-33`.
- **Safety:** no real career document, credential, Provider endpoint or paid inference was accessed.

## 2026-09-04｜J1 final acceptance stabilization evidence（not yet Human-accepted）

- **Runtime-driven Job import:** `jd-import.html` contains no per-import processing selector. `v1-pages.js` reads the stored product Runtime and gates `job_import` or `job_model_import` accordingly. Browser smoke switched Runtime at `/index.html`, then proved Local and Model imports took their respective paths without another mode decision.
- **Explicit lifecycle:** `model-import-lifecycle-domain.js` defines `SOURCE_SELECTED → SOURCE_STORED → MODEL_PROCESSING → PROPOSAL_READY → REVIEWING → READY_TO_SAVE → SAVED`, plus `MODEL_FAILED`. The Job import surface exposes the current state in `data-job-import-lifecycle`; browser smoke completed actionable review/save in both Runtime modes.
- **Dead-state root cause and correction:** restored Job proposals were previously shown when no source was selected, allowing an unrelated unresolved proposal to control the page. Review restoration is now restricted to proposals whose `source_document_ids` intersect the explicit current selection. The primary action says “请完成下方审核” while visible unresolved content exists and does not remain on an opaque waiting label.
- **Model import proof:** one synthetic realistic pasted Job was stored, sent under explicit DeepSeek consent, semantically structured, reviewed and saved as a new immutable Job Revision. Backend evidence showed one `job_model_import_provider_call` and no Local semantic structurer call.
- **Local import proof:** a separate synthetic realistic pasted Job was deterministically structured, reviewed and saved. Backend evidence showed `POST /api/local-job-extract` and Provider calls = 0.
- **Failure proof:** after source selection and consent, the backend was deliberately stopped before confirmation. The real page entered `MODEL_FAILED`; DOM inspection found zero Local-fallback buttons, zero proposal/review headings and one explicit `/index.html` Runtime link. The final backend was then restarted from the current worktree.
- **Shared conversation UI proof:** both Candidate and Job render inside `.v1-conversation-thread` and use `.v1-conversation-form.v1-workspace-composer` with the same field/button DOM. Browser computed geometry matched: message `max-width:92%`, `border-radius:20px`, `padding:10px 13px`; composer height `44px`, gap `10px`; field radius/height `14px/44px`; textarea height/padding/line-height `42px/11px/20px`; send button `42px` circular. Human messages were white and Assistant messages black in both surfaces.
- **Job referent contract:** `job-conversation-domain.js` resolves short active-Job prompts such as “我还需要补充什么” to `CURRENT_CANDIDATE_X_ACTIVE_JOB` with safe gap taxonomy. `job_conversation_runtime.py` instructs the Provider to honor this scope and avoid unnecessary Candidate-vs-Job clarification. Automated runtime evidence logs only safe counts and reports `candidate_snapshot_present=true`.
- **Regression proof:** 34 Node `.mjs` suites, 20 Python regression suites, 40 public JavaScript syntax checks and seven final-backend HTTP checks passed. Python used the bundled Node path through `ARIADNE_NODE_BINARY`, eliminating environment-only route-test drift.
- **Fresh real-Candidate Provider turn:** after explicit action-time confirmation, the real Job Detail sent “我还需要补充什么能力？” through `deepseek-v4-pro`. Assistant message count increased exactly once, the answer analyzed AI-product ownership, evaluation/failure recovery, structured output/source/privacy evidence and a bounded existing-project signal, and it did not ask whether the prompt referred to Candidate or Job. The UI reported that analysis was saved while Job changes still require Human confirmation.
- **Safe structural diagnostics:** immediately before the Provider call the backend logged only `candidate_snapshot_present=true`, `confirmed_count=27`, `working_count=29`, `project_count=11`, `evidence_count=54`; `POST /api/job-conversation-turn` returned HTTP 200. No private Candidate text, persistent IDs, hashes, filesystem paths or credentials were logged.
- **CandidateDelta/historical analysis proof:** the same restored real Job conversation retained its prior three required Job-scope turns and the earlier project-update turn, including the deterministic boundary between relevance and what the new project information still cannot prove. The fresh turn recompiled current Candidate state; existing historical assistant turns remained byte-for-visible-text unchanged in the page history.
- **Open acceptance item:** technical and real-browser evidence are complete, but Human acceptance is still pending. No git staging or commit was performed.

## 2026-09-04｜J1 final product convergence evidence（Human acceptance still pending）

- **Working Job lifecycle:** `model-import-lifecycle-domain.js` adds `WORKING`. `executeJobModelProcessing()` stores the real source and model proposal, then calls the shared processing workspace and opens Working Job; it does not call `renderAwaitingJobReviews()`. `saveJobWorkingWorkspace()` is the only transition that applies Human edits and creates an immutable confirmed revision.
- **Local/Model separation:** model-generated proposals carry `model_generated_non_authoritative` and are excluded from the Local review queue. `job-context-domain.js::workingPayload()` rejects non-model proposals. Local Job import continues to use its existing actionable Review/Save surface and makes zero Provider calls.
- **Exact shared symbols:** both import workspaces call `AriadneModelWorkspaceUI.renderProgress()` and `setProcessingState()`. Candidate, Working Job and confirmed Job use `AriadneConversationUI.renderMessages()` with `.v1-conversation-message.user/.assistant`, `.v1-conversation-form.v1-workspace-composer` and `.v1-workspace-composer-field`.
- **Natural turn transport:** `job_conversation_runtime.py` serializes bounded successful Human/Assistant history as actual chat-role messages and appends the latest Human request last. `connectedHistory()` excludes failed orphan Human attempts from the visible thread and later Provider context while retaining them in local audit storage. The prompt requires follow-up referent resolution, non-repetition, concrete alternatives, exact Provider-owned `message`, plain text, and an honest `Realtime Web Search is unavailable` boundary.
- **Safe diagnostics:** successful real turns emit only `provider_called=true provider=deepseek model=deepseek-v4-pro assistant_copy_source=PROVIDER`; runtime validation requires the same metadata. No Candidate prose, identifiers, hashes, paths or credentials are included in this acceptance line.
- **Synthetic real-browser flow:** a bounded synthetic Job source was pasted in the real product UI, consented, sent once to `deepseek-v4-pro`, rendered as NON_AUTHORITATIVE WORKING JOB, edited-capable, and saved through Human Workspace Save. The resulting confirmed Job Detail showed no Local review surface.
- **Five connected real turns:** ten authorized Job-conversation Provider calls were consumed. Five succeeded and visibly formed one connected current Candidate × confirmed Job conversation: core requirements; closest existing project evidence; two project-strengthening actions; prioritization/trade-off/minimum completion criteria; and a three-step plan with the user-owned decision identified. The fifth answer explicitly reported that the current Runtime lacks Web Search and produced no repository name or URL.
- **Fail-closed evidence and repair:** five attempts produced no accepted Assistant copy—one semantic-schema HTTP 422, three JSON-mode `EMPTY_RESPONSE` failures and one text-mode `MALFORMED_RESPONSE`. DeepSeek JSON mode was replaced with a single forced strict `deliver_job_conversation` tool call; response normalization accepts only that tool's arguments (plus the retained mock-compatible stop path). The final three calls succeeded 3/3. One pre-plain-text successful response visibly retains literal `**`; it was not rewritten because append-only Provider copy remains the evidence authority.
- **Final browser state:** the confirmed Job page showed exactly the five successful Human/Assistant pairs, the `DeepSeek · deepseek-v4-pro` indicator and the honest no-Web answer. Failed orphan attempts were absent, and browser console logs were empty.
- **Automated evidence:** 34/34 Node suites, 20/20 Python regression suites, 41/41 public JavaScript syntax checks, Python compilation and 7/7 live HTTP routes passed.
- **Open acceptance item:** all authorized technical and real-browser acceptance work is complete. Human acceptance remains pending/failed; no READY claim, staging or commit was made, and no authorized Provider calls remain.

## 2026-09-04｜Shared product shell convergence evidence（READY FOR J1 HUMAN ACCEPTANCE）

- **Shared module:** `public/product-shell-domain.js` exports frozen `CONTRACT` plus `bindImportShell`, `bindWorkspaceShell`, `showWorkspace`, `hideWorkspace`, `bindDetailShell`, `bindConversation`, `applyDetailRuntime`, and `createDetailPanelController`. Candidate and Job call these same function objects from `public/v1-pages.js`; there is no Candidate/Job fork of the neutral module.
- **Candidate preservation:** generic Candidate workspace CSS selectors were renamed to neutral `v1-workspace-*` ownership without changing their layout values. Browser inspection of the accepted Candidate detail showed the same two-pane surface, 58px input minimum height and 42×42 send control; the shared edit controller opened and focused the existing Candidate edit form.
- **Job convergence:** Job Detail now has the exact Candidate detail composer structure—form, label, direct textarea and icon submit button—and uses the same conversation thread class. Browser inspection measured identical detail split columns (`619.375px 527.625px` at the acceptance viewport), 58px input minimum height and 42×42 send control. The floating Job detail and shared edit controller both opened through the card library with no console error.
- **Initialization regression and fix:** real `jd-import.html` initially failed closed with `product_conversation_messages_missing`. Root cause was that both workspace message containers used only `v1-workspace-conversation v1-conversation-thread`, while the new shared binder correctly required the shared renderer class. Candidate and Job were fixed together, then reloaded successfully; the exact three-class identity is now asserted by `shared_product_shell_regression.mjs` and `step_02_03_ui_framework_regression.mjs`.
- **Runtime/import browser proof:** Model mode exposed no import-local runtime controls and displayed `使用 ARIADNE AI 理解`. A bounded realistic JD was sent to `DeepSeek / deepseek-v4-pro`, opened directly as a NON_AUTHORITATIVE WORKING JOB in the shared workspace, and was saved through Human Workspace Save as an immutable confirmed Job Revision. No Local review surface or Local semantic structurer appeared. Local mode separately showed `开始本地整理`, called only `/api/local-job-extract`, exposed the Local review form, accepted Human corrections, and displayed the saved Job card.
- **Regression result:** `FULL_MATRIX_PASS node=35 python=20 public_js=42 py_compile=pass`; `git diff --check` passes and the staging area is empty. Python conversation route output (`200/422`) came from synthetic in-process/mock tests, not a real Provider.

| Behavior | Candidate symbol | Job symbol | Shared primitive | Reuse type |
|---|---|---|---|---|
| Import shell | `initPersonalImport() → ProductShell.bindImportShell(document)` | `initJobImport() → ProductShell.bindImportShell(document)` | `AriadneProductShell.bindImportShell` + `CONTRACT.import` | `REUSE_EXACT_SYMBOL` |
| Model processing | Candidate processing calls `ModelWorkspaceUI.renderProgress/setProcessingState` | Job processing calls `ModelWorkspaceUI.renderProgress/setProcessingState` | `AriadneModelWorkspaceUI` + `ProductShell.showWorkspace` | `REUSE_EXACT_SYMBOL` |
| Working Workspace | `candidateSharedWorkspace()` / `showCandidateWorkspaceLayer()` | `jobSharedWorkspace()` / `showJobWorkingWorkspace()` | `bindWorkspaceShell`, `showWorkspace`, `hideWorkspace` | `EXTRACT_TO_SHARED_PRIMITIVE` |
| Detail shell | Candidate `setDetailRuntimeMode(...)` | Job `setDetailRuntimeMode(...)` | `bindDetailShell` + `applyDetailRuntime` | `REUSE_EXACT_SYMBOL` |
| Message renderer | `renderCandidateWorkspaceConversation()` delegates to shared renderer | `renderJobConversationMessages()` delegates to shared renderer | `AriadneConversationUI.renderMessages` | `REUSE_EXACT_SYMBOL` |
| Human bubble | Candidate message role `user` | Job message role `user` | `.v1-conversation-message.user` | `REUSE_EXACT_SYMBOL` |
| Assistant bubble | Candidate message role `assistant` | Job message role `assistant` | `.v1-conversation-message.assistant` | `REUSE_EXACT_SYMBOL` |
| Composer | Candidate `#candidate-*-form` | Job `#job-*-form` | `.v1-conversation-form` + `bindConversation` | `EXTRACT_TO_SHARED_PRIMITIVE` |
| Input | Candidate textarea IDs | Job textarea IDs | `CONTRACT.conversation.input = textarea` | `REUSE_EXACT_SYMBOL` |
| Send button | Candidate submit button | Job submit button | `CONTRACT.conversation.send = button[type=submit]` | `REUSE_EXACT_SYMBOL` |
| Scroll container | `#candidate-workspace-history` | `#job-workspace-history` | `.v1-workspace-history` / `conversationScroll` | `EXTRACT_TO_SHARED_PRIMITIVE` |
| Loading/failure state | Candidate lifecycle + processing nodes | Job lifecycle + processing nodes | `ModelImportLifecycle`, `AriadneModelWorkspaceUI`, shared shell show/hide | `REUSE_EXACT_SYMBOL` |

- **Domain boundary retained:** Candidate/Job schemas, semantic structuring, content renderers, edit actions and conversation semantics remain separate adapters. CandidateContextSnapshot, CandidateDelta, source retrieval, Job revision lineage, stale/version/privacy protections and Provider failure behavior were not redesigned.
- **Five-turn connected proof:** the same confirmed Job completed five successful Human/Assistant pairs: remaining work, strongest existing project, concrete strengthening, resume-only alternative, and priority order. All five answers were grounded in the current Candidate × active Job, preserved the capability/evidence distinction, and remained visible and unchanged after later Candidate edits. Two rejected attempts failed closed with HTTP 422, created no visible orphan Human or Assistant message, and did not enter later Provider history.
- **Exact CandidateDelta proof:** Local Candidate review filled only source-backed blank summary fields; previous versions were retained and no Provider was called for either edit. The final Provider turn received exact Provider-safe previous/current records and `changed_fields`, named the field transition precisely, stated that no new functionality/runtime evidence existed, and left the earlier priority unchanged. Canonical IDs, hashes and filesystem paths remained outside the Provider delta view.
- **Failure diagnosis and repair:** a redundant EXPLAIN/ASK_CLARIFICATION action discriminator and a spurious `job_edit` on advice turns caused the two 422 responses. The server and browser now canonicalize non-mutating actions from actual clarification content and gate Job edits on an explicit Human edit request; explicit mutations remain strict. A first semantically imprecise CandidateDelta answer exposed under-specified delta context, so the provider-safe delta contract now includes exact previous/current records and field-level changes, with prompt version `ariadne-job-intelligence-prompt-v7`.
- **Provider accounting:** 10 actual DeepSeek requests were made for this final acceptance: 1 Model Job import success; 5 required Job-conversation successes; 2 fail-closed attempts; 1 technically successful but semantically imprecise, append-only delta analysis; and 1 precise delta success. Local Job import and Local Candidate edits used zero Provider calls.
- **Final gate:** the real page remained non-blank with no framework overlay, the final Job Detail kept the first five Assistant texts byte-for-visible-text unchanged, and browser console error/warning output was empty. Final full matrix: `35 Node / 20 Python / 42 public JS syntax / Python compile`, plus `git diff --check`; `J1 HUMAN ACCEPTANCE: PASS` and the scope is frozen for final closeout.

## 2026-09-04｜J1 final closeout evidence（Human Acceptance PASS）

- **Privacy audit:** the committed evidence contains redacted field-level CandidateDelta descriptions only. No private Candidate project names, summaries, persistent IDs, filesystem paths, credentials, or raw Provider reasoning are committed in the J1 evidence surface.
- **Scope audit:** no Web Search client, automatic Local fallback, destructive migration, automatic Candidate mutation, provider/model switch, or acceptance-only runtime path is present. Local imports remain Provider=0.
- **Deferred scope:** Candidate Learning / CandidateUpdateProposal execution; Job clarification-to-Candidate learning; grounded resume optimization execution; project-to-evidence updates; live Web/GitHub research; automatic application; and match percentage/scoring remain outside J1.
## 2026-09-04｜Global interaction and source convergence evidence（READY FOR J1 HUMAN ACCEPTANCE）

- Shared source primitive: `public/source-input-domain.js` owns click, drag/drop, guarded clipboard-image paste, ordered deduplication and bundle preview. Candidate and Job bind the same symbol; editable targets are excluded before clipboard inspection so normal text paste remains native.
- Shared waiting primitive: `public/processing-indicator-domain.js` owns the dark pill, mesh/orb state, `aria-live`, `aria-busy` and active/terminal transitions. `public/conversation-ui-domain.js` mounts it for both domains and waits for two animation frames plus a bounded paint window before Provider work.
- Shared shell/edit/conversation: `public/product-shell-domain.js::createDetailEditController` is called by both detail adapters. Both conversations call `AriadneConversationUI.renderMessages/setExecutionState/settle` and use the same thread, bubble, composer, textarea and button selectors.
- Model Job bundle: `public/job-model-runtime-domain.js` validates ordered source documents/preparations and sends one `source_bundle`; `src/job_model_runtime.py` validates all source IDs, keeps grounded block references and instructs the Model to distinguish Job content from navigation/header/footer/legal/privacy/copyright/site-service/recruiting chrome.
- Browser proof: one three-image DeepSeek Job import created one Working Job directly and then one Job Revision. Saved fields were `AI产品经理`, `深圳想向着陆科技有限公司`, `深圳·南山区`; ordered sources 1/2/3 remained recoverable. Candidate/Job clipboard paste, non-hijacked textarea paste, shared edit lifecycle, exact conversation primitives and visibly animated waiting states passed. Real Candidate × Job context injection also passed. Later empty Provider results failed closed with no Assistant fabrication or Local fallback.
- Automated proof: 57 executable Candidate/Job Node/Python regression suites passed, final JavaScript syntax checks passed and `git diff --check` passed. No test removal, staging or commit occurred.
- Full report: `docs/current/ARIADNE_GLOBAL_INTERACTION_QA_REPORT.md`.

## 2026-09-04｜Final product-contract addendum evidence

- `AriadneProductShell.dispatchRuntimeImport()` is invoked exactly twice, once by each domain import adapter. Unit checks prove Local selects only Local, Model selects only Model, and a thrown `MODEL_FAILED` is not caught as a Local retry. Browser DOM contained zero Candidate/Job processing-mode selectors.
- `AriadneSourceInput.persistDurableBundle()` is invoked exactly twice before the Candidate/Job Model consent dialog. It delegates domain SourceDocument construction to the existing adapter, calls the canonical durable raw-source writer, and validates returned source identity/hash. Job pasted text now sets `selectedJobSources = [selectedJobSource]` before the shared consent/persistence path.
- Candidate Model source-to-Provider code contains no Local semantic proposal/structuring call; Job Model contains no Local structurer, Local proposal generator, Local review renderer or Local extraction endpoint. Existing read-only preparation results still require `model_call_made=false`, `network_call_made=false`, `read_only=true` and `writeback=false` before Provider execution.
- Shared micro-interaction evidence: source preview and conversation message entry use `v1-feedback-in`; ProductShell owns common success/failure status state; ModelWorkspaceUI owns `is-working-ready`; common button and input selectors own hover/pressed/focus; the reduced-motion media query removes the new entry/orb/pulse animations and reduces transitions to 1 ms.
- Browser evidence: Local Runtime automatically exposed `开始本地提取` and `开始本地整理`, Candidate vision Runtime exposed `使用 DeepSeek 分析`, and every import page had zero per-import runtime selectors. Job Model pasted text appeared as one source and reached source-first consent. The consent was cancelled before Provider execution. Focused Job textarea computed `rgb(82, 111, 218)` border and `rgba(82, 111, 218, 0.16) 0 0 0 3px` shadow.
- Final matrix: 36 Node suites, 21 Python suites, 44 public JavaScript syntax checks and `git diff --check` passed; staged=0.

## 2026-09-04｜UI contract correction evidence

- **Exact reuse:** Candidate and Job workspace/detail composers all contain the same `.v1-conversation-form > .v1-composer-field > textarea + button[type=submit]` structure and are bound by `AriadneProductShell.bindConversation()`. `AriadneConversationUI.setExecutionState()` calls `AriadneProcessingIndicator.setButton()` for both domains.
- **Shared loader:** `public/processing-indicator-domain.js` renders `.v1-processing-loop`; `public/styles.css` defines one calm blue border loop with no glow, gradient or percentage. The same keyframe is used by status indicators and `.is-loading` submit buttons; `prefers-reduced-motion` disables it.
- **Measured composer:** desktop Candidate and Job both measured `field=46px`, `textarea=44px`, `button=42px`, with identical center Y inside each composer. Focus computed to `rgb(82, 111, 218)` plus `rgba(82, 111, 218, 0.16) 0 0 0 3px`, contained by the 16 px field radius.
- **Waiting state:** real browser execution showed `aria-busy=true`, disabled duplicate send, visible `.is-loading` submit loop and shared `WAITING` indicator without geometry change. Import execution painted the `WORKING` indicator before awaiting Provider work.
- **Job import/UI:** the primary label is `使用人工智能解析`; the two verbose inline source explanations are absent while the source card, ordered source list and local provenance data remain. `.v1-consent-action` has transparent/light styling and visible hover/focus/press feedback.
- **Navigation/layout:** shared back/close hover changes scale only and preserves center; desktop minibar center matched the content viewport center, while the 390 px mobile layout had no overflow and hid the minibar.
- **Failure/console:** a synthetic import payload failed existing Provider-output schema and surfaced `MODEL_FAILED` without Local fallback. Final Add Job browser errors were zero.
- **Final matrix:** 37 Node suites, 21 Python suites, 44 public JavaScript syntax checks and `git diff --check` passed; staged=0.

## 2026-09-04｜Candidate ↔ Job parity repair evidence

- Candidate item focus: `submitCandidateDetailConversation()` passes `focus: { type: "ITEM", item_id: itemId }` to the Candidate conversation runtime. `PATCH_ITEM` results are projected by `showCandidateDetailWorkingProposal()` into the existing Candidate review surface without exposing the item ID.
- Authority boundary: the required role-wording replacement changed only the intended Working field while the confirmed title and confirmed-facts serialization remained unchanged. Only the existing Human accept action calls the shared workspace-acceptance persistence path.
- Conversation transport: Candidate requests force the Candidate-only `deliver_candidate_action` tool. A real `deepseek-v4-pro` ordinary question and the required edit both returned HTTP 200; the earlier empty response failed closed. No Job tool/schema or Local fallback participates.
- Shared edit shell: both detail pages expose the same `data-ariadne-edit-shell="detail"`, five shared edit fields, one shared action region, `取消`, `预览修改`, `确认保存` and `返回编辑` roles. Browser measurements matched at `1076.609375 px` field/action width, `70 px` first-field height and `44 px` action height.
- Source preview: both import pages contain one ordered `<ol>` and zero legacy summary blocks. Browser checks rendered Candidate and Job single-source lists with one item and multi-image bundles with two items in original order. Existing Job Source Retrieval still showed both clipboard images and `原始来源可恢复`.
- Final gates: `38/38` Node regression files, `20/20` Python regression files, `44/44` public JavaScript syntax checks, Python compilation and browser QA passed. Candidate and Job browser error logs were empty; `git diff --check` passed and staged files remained zero.
## 2026-09-04｜Runtime capability routing stabilization evidence

- Shared resolution: `public/runtime-capability-gate.js` stores compatible model assignments per operation under `ariadne-operation-runtimes-v1`. Current Ariadne LOCAL mode always wins as Local authority; MODEL mode resolves the requested operation against its compatible stored runtime and otherwise returns the selected Model with an unsupported capability state. Runtime discovery seeds `deepseek-v4-pro` only into missing conversation assignments (`only_unassigned`) so existing browsers regain the accepted conversation runtime without overwriting a Human choice. There is no Local fallback branch.
- Adapter identities: Candidate multimodal import is `deepseek-candidate-multimodal-v2` with `source_or_rendered_images`; Job multimodal import is `deepseek-job-multimodal-import-v2` with `source_images_with_prepared_text`; Candidate/Job conversations remain pro-backed domain adapters. The obsolete `deepseek-job-import-v1` pro adapter was removed from the shared gate.
- Source boundary: Candidate direct PNG/JPEG requests validate MIME, signature, size, content hash and SourceDocument identity before the vision call. Job multi-image requests validate ordered bundle identity, each original image signature/hash/size, and request operation before constructing one mixed text/image Provider message. Source Preparation remains read-only, has no writeback or Provider call, and now authorizes verified Candidate/Job semantic adapters as well as conversation adapters.
- Browser Candidate: synthetic `ariadne-candidate-routing.png` reached the consent dialog naming `deepseek-v4-flash-vision-exp`, displayed the shared Processing state, returned HTTP 200 from `/api/candidate-model-structure`, and produced one non-authoritative `Evidence Workflow` Working card. No Candidate Local semantic processing function is present in the Model execution slice.
- Browser Job: synthetic `ariadne-job-routing-1.png` and `ariadne-job-routing-2.png` displayed as one ordered two-source bundle. Two `/api/local-source-read` calls returned 200, the server logged `job_model_import_provider_call provider=deepseek model=deepseek-v4-flash-vision-exp`, `/api/job-model-structure` returned 200, and the restored Working header displayed both filenames in order.
- Browser conversation: the Working Job surface explicitly displayed `Conversation · DeepSeek · deepseek-v4-pro`. The server logged `candidate_snapshot_present=true`, `working_count=1`, `project_count=1`, `evidence_count=1`, followed by `provider_called=true ... model=deepseek-v4-pro`; the grounded answer compared the Job requirements to the current synthetic Candidate and named evidence gaps.
- Negative/browser fail-closed: with only pro selected and no compatible image assignment, Candidate and Job image controls were disabled with copy stating that Model structuring is unavailable and Local will not be used. A pre-fix Source Preparation capability mismatch produced `MODEL_FAILED` and no Local fallback; the capability check was corrected and the same durable two-source bundle then succeeded.
- Layout evidence: at `1280×720`, `.v1-workspace-layer` measured the full `0…1280` viewport, `.v1-workspace-shell` measured `87…1193`, and `.v1-mini-sidebar` measured `1205…1262`, vertically `333.5…386.5`. Pointer hover added `is-expanded` but left all four minibar bounds unchanged.
- Automated gates: `38/38` Node regression files and `20/20` Python regression files passed. Local Candidate and Local Job subsets passed separately with Provider calls = 0. No `git add` or commit was executed.

## 2026-09-04｜Detail behavioral wiring stabilization evidence

- Candidate binding failure: the submit listener was installed only when `conversationAllowed` was true during initialization. Runtime capability could become available later, leaving a visible enabled composer without a submit owner. `AriadneProductShell.bindConversationAdapter()` now installs one stable listener, records safe binding metadata, resolves runtime availability and the active `{sourceId, itemId}` target at submit, then calls `submitCandidateDetailConversation()`.
- Job projection failure: the request reached DeepSeek, but an optional `source_need` advisory mismatch discarded an otherwise valid result and the exception path incorrectly reported `provider_called=false`. The runtime now canonicalizes that optional advisory to null and preserves `network_call_made=true` for post-Provider validation failures.
- Adapter map: Candidate Detail uses `candidate / candidate_conversation / CANDIDATE_CONVERSATION_TURN`; Job Detail uses `job / job_conversation / JOB_CONVERSATION_TURN` with the active Job revision. Both use the same ProductShell composer primitive; semantic contracts and persistence remain domain-specific.
- Edit owner: `createDetailEditController()` now binds trigger/cancel/preview/back itself. Both `#candidate-edit-form` and `#job-edit-form` enter with the first field visible and focused; at 1280×720 the first-field top was approximately 339px on both pages, form/action width was 1076.609375px, and action height was 44px.
- Candidate Provider proof: the required role-wording replacement fired one submit and one Provider turn. During waiting the duplicate submit was disabled. The accepted result was `PATCH_ITEM`, Working=yes, confirmed mutation before save=no; the visible diff changed only the active Candidate Material role. Human Save created confirmed version 2 and hid Working.
- Job Provider proof: exact inputs `这个职位最重要的三个要求是什么？` and `按照我现在的个人资料，我最缺什么？` each fired once through `deepseek-v4-pro`. The first returned `EXPLAIN`; the second returned a grounded `ASK_CLARIFICATION` answer that distinguished evidence gaps from missing capability and used the current Candidate snapshot plus prior conversation. Working=no and pre-save confirmed mutation=no for both.
- Browser closeout: the saved Candidate value and both Job answers remained visible; Candidate Working was absent; error states and persistent-ID leakage were zero. The global runtime was restored to Model.
- Automated closeout: `39/39` Node, `20/20` Python, `44/44` public JS syntax and Python compilation passed. The local server remained available for Human acceptance; staged files remained zero.

## 2026-09-05｜Computer-use-first A–E evidence

- Environment: visible local pages `http://127.0.0.1:8000/personal-information.html` and `http://127.0.0.1:8000/jd.html`; detail views were opened from those workspaces. Provider/runtime label was `DeepSeek · deepseek-v4-pro`.
- Candidate A/B: discussion showed shared Processing and a real Provider answer with Working absent and Confirmed unchanged. The explicit replacement generated `PATCH_ITEM`; Working changed visibly while Confirmed remained old until Human Save, then the reopened Candidate Material Detail showed the accepted value and no internal ID.
- Job C/D: both discussion turns called the Provider and used current Candidate evidence while producing no mutation. The explicit summary deletion generated `PROPOSE_JOB_EDIT`; the model-authored message correctly described Working and the Save boundary. Human Save created the next Job revision and reopening showed the deletion.
- Job mutation routing now includes delete/remove verbs and the summary/requirements referents. A valid Provider edit with redundant confirmation copy is normalized by dropping only that control-plane clarification; field, desired value and Human Save remain authoritative.
- Candidate direct Edit originally exposed `record_not_json_serializable` on workspace-v2 revisions and then a stale Working/conversation projection. The final implementation routes workspace-v2 Human edits through a new validated Candidate Working model, Workspace Acceptance and revision, persists the lineage, updates the active working head, and clears obsolete proposal UI. Subsequent Candidate mutation resolution uses the newly confirmed value.
- Final UI evidence: Candidate and Job enter with the first field focused; Preview, Return to Edit, direct Save and Cancel/exit work. Candidate exposes its supported delete action; Job does not render an unsupported delete action.
- Fail-closed evidence: an intermediate Job edit Provider response failed with `CLARIFICATION_ACTION_MISMATCH`; the UI displayed model failure and performed no Local fallback or mutation. After adapter hardening, the entire A–E sequence was restarted and passed.
- Final gates: `40/40` Node regression suites, `20/20` Python regression suites, `44/44` public JS syntax checks, Python compilation and `git diff --check` passed. Local Provider calls = `0`; final post-fix console errors = `0`; staged files = `0`.
## 2026-09-05｜Final J1 Candidate Material integrity evidence

- **Representative real Provider coverage:** Work Experience, Project, and Education Candidate Material Details each completed a real DeepSeek discussion and semantic mutation. Every mutation produced NON_AUTHORITATIVE Working first, changed no confirmed state before Human Save, survived Save plus reload/reopen, and was observed by the next conversation. Work Experience also passed direct Edit through the same confirmed-revision authority.
- **Systematic type coverage:** `tests/candidate_conversation_runtime_regression.py` validates active-item focus and title/role semantic mutation for all current types: `work_experience`, `project`, `education`, `skill_group`, `language`, `award`, and `custom_section`.
- **Current-state contract:** Candidate context compiler v2 filters item-scoped history by current item and current Working/version/fingerprint. Focused turn-local references are accepted only when they resolve to the current item. Mutation actions remain field-level `SET`; wholesale `REPLACE` is forbidden.
- **Human Copy contract:** persistent IDs, fingerprints, requirement references, and turn-local aliases remain in structured grounding fields only. Candidate and Job server normalization, client projection, and shared render-time sanitation keep them out of visible messages without deleting historical source or conversation records.
- **Failure evidence:** one real Candidate Provider result failed strict schema validation as `MALFORMED_RESPONSE`; it created no Working, changed no confirmed state, logged no private body, and did not fall back to Local. A retry succeeded through the Model path.
- **Frozen Job smoke:** one real Job Detail CandidateContext-grounded answer passed with no Working, no confirmed mutation, no visible internal identifiers, and no browser console error.
- **Isolation/provenance:** Local Candidate=0 Provider calls and Local Job=0 Provider calls remain regression-locked. Model paths exclude Local semantic structuring/proposal/correction/review. Click, drop, clipboard image, ordered multi-image bundle, and pasted text use durable Source/provenance persistence before Provider; original bodies remain retrievable.
- **Automated gate:** Node `40/40`; executable Python `21/21`; JavaScript syntax `84/84`; Python compilation PASS; HTTP `10/10`; final Candidate/Job browser console errors `0`; visible-copy ID leaks `0`; `git diff --check` PASS. `tests/candidate_conversation_stub_server.py` is a non-terminating fixture and is not counted as an executable suite.
- **Privacy/scope:** no API key, credential, raw Provider reasoning, private source body, or persistent internal identifier is added to Human-facing evidence. No J2, Web Search, automatic application, or unrelated redesign was introduced.
