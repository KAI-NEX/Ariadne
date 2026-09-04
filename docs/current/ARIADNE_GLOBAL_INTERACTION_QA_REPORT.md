# Ariadne Global Interaction Convergence QA Report

Status: `J1 CHECKPOINT COMPLETE`
Date: 2026-09-05
Human acceptance: confirmed

## Outcome

The prior Global Interaction readiness statement was revoked by real Human Acceptance. The resulting stabilization separates Ariadne mode, operation, and model capability in one shared resolver. Candidate and Job image imports now use `deepseek-v4-flash-vision-exp`; Candidate/Job conversation remains operation-specifically routed to `deepseek-v4-pro`; unsupported image operations stay MODEL and fail closed instead of becoming Local.

Fresh real-browser proof on an isolated origin used only synthetic images: Candidate PNG → one vision-backed Working card; two ordered Job PNGs → one vision-backed Working Job retaining both source IDs/names; subsequent Job conversation → pro-backed response using the current Candidate Working context. The right-side minibar is vertically centered and no longer overlaps the desktop Working shell. Current automated baseline is `38` Node plus `20` Python regression files, with separate Local Candidate/Job Provider-call count = 0.

Candidate and Job now use shared implementations for source selection, ordered multi-source bundles, guarded clipboard-image paste, source preview, processing/waiting presentation, Working/detail shells, edit lifecycle, and conversation presentation. Candidate and Job retain only their domain schemas, semantic preparation, actions, authority, and persistence adapters.

The mandatory real-browser gates passed. A three-image Model Job import produced one Working Job through one DeepSeek request, then one confirmed Job Revision. The saved record retained ordered per-source provenance and extracted `AI产品经理` / `深圳想向着陆科技有限公司` / `深圳·南山区`; navigation, recruiter UI, calls-to-action, legal/privacy/footer and copyright chrome did not become Job fields or requirements.

The third QA image was a recompressed derivative of an existing source image because another available image was byte-identical to source 1 and the shared input primitive correctly deduplicated it. The original source files were not moved, renamed, overwritten, or deleted.

## Final shared-primitive map

| Behavior | Candidate symbol | Job symbol | Shared primitive | Reuse type |
|---|---|---|---|---|
| Drag/drop | `candidateSourceInputBinding` + `#personal-file-dropzone` | `jobSourceInputBinding` + `#job-file-dropzone` | `AriadneSourceInput.bind()` | `REUSE_EXACT_SYMBOL` |
| Click upload | `candidateSourceInputBinding` + `#personal-file-input` | `jobSourceInputBinding` + `#job-file-input` | `AriadneSourceInput.bind()` / `openChooser()` | `REUSE_EXACT_SYMBOL` |
| Multi-image bundle | `selectedCandidateSources` | `selectedJobSources` | `AriadneSourceInput.mergeSources()` ordered/deduplicated collection contract | `REUSE_EXACT_SYMBOL` |
| Clipboard paste | Candidate dropzone binding | Job dropzone binding | `AriadneSourceInput.bind()` guarded document-level paste handler | `REUSE_EXACT_SYMBOL` |
| Source preview | `#personal-source-preview-list` | `#job-source-preview-list` | `AriadneSourceInput.renderBundlePreview()` | `REUSE_EXACT_SYMBOL` |
| Processing indicator | Candidate import/conversation status hosts | Job import/conversation status hosts | `AriadneProcessingIndicator.ensure()` / `set()` / `clear()` | `REUSE_EXACT_SYMBOL` |
| Working workspace | `candidateSharedWorkspace()` | `jobSharedWorkspace()` | `AriadneProductShell.bindWorkspaceShell()` / `showWorkspace()` + `AriadneModelWorkspaceUI` | `REUSE_EXACT_SYMBOL` |
| Detail shell | `#candidate-ai-pane` inside shared detail contract | `#job-ai-pane` inside shared detail contract | `AriadneProductShell.bindDetailShell()` / `applyDetailRuntime()` | `REUSE_EXACT_SYMBOL` |
| Edit shell | Candidate detail form controller | Job detail form controller | `AriadneProductShell.createDetailEditController()` | `REUSE_EXACT_SYMBOL` |
| Human bubble | `.v1-conversation-message.user` | `.v1-conversation-message.user` | `AriadneConversationUI.renderMessages()` | `REUSE_EXACT_SYMBOL` |
| Assistant bubble | `.v1-conversation-message.assistant` | `.v1-conversation-message.assistant` | `AriadneConversationUI.renderMessages()` | `REUSE_EXACT_SYMBOL` |
| Composer | `.v1-conversation-form` | `.v1-conversation-form` | `AriadneProductShell.bindConversation()` + shared CSS contract | `REUSE_EXACT_SYMBOL` |
| Input | `.v1-conversation-form textarea` | `.v1-conversation-form textarea` | `AriadneProductShell.CONTRACT.conversation.input` | `REUSE_EXACT_SYMBOL` |
| Send button | `.v1-conversation-form button[type="submit"]` | `.v1-conversation-form button[type="submit"]` | `AriadneProductShell.CONTRACT.conversation.send` | `REUSE_EXACT_SYMBOL` |
| Scroll | `.v1-conversation-thread` / `.v1-conversation-pane` | `.v1-conversation-thread` / `.v1-conversation-pane` | `AriadneConversationUI.renderMessages()` / `settle()` | `REUSE_EXACT_SYMBOL` |
| Loading | Candidate execution adapter | Job execution adapter | `AriadneConversationUI.setExecutionState()` / `waitForIndicatorPaint()` + `AriadneProcessingIndicator.set()` | `REUSE_EXACT_SYMBOL` |
| Failure | Candidate failure copy/semantic adapter | Job failure copy/semantic adapter | Shared terminal indicator/presentation; domain error mapping remains separate | `DOMAIN_SPECIFIC` adapter over shared primitive |

No common behavior in this required list remains a separately owned Candidate/Job presentation implementation.

## Real-browser evidence

- Model multi-image Job: three ordered image sources appeared in one bundle, were processed once, opened one non-authoritative Working Job directly, and saved as one immutable Job Revision. No Local-style Model review queue appeared.
- Grounding/page chrome: title, company, location, summary and requirements were sane and source-grounded. BOSS navigation, recruiter name, CTA, legal/privacy/footer and copyright content were excluded from the semantic fields.
- Clipboard: a real clipboard PNG was accepted from both the focused Candidate dropzone and focused Job dropzone. With the Job textarea focused, normal text paste remained exact and was not intercepted by the image handler.
- Edit parity: Candidate Detail and Job Detail both exercised Edit → Preview → Return to Edit → Cancel through `AriadneProductShell.createDetailEditController()`.
- Conversation parity: Candidate and Job both used the same thread, bubble, composer, textarea, send, focus, scroll and execution-state symbols. A real Candidate turn and real Job turns produced grounded Assistant responses.
- Waiting animation: real Candidate and Job Model conversations exposed `v1-processing-indicator is-active`, `data-state=WAITING`, `aria-busy=true`, and the shared `v1-processing-loop` animation. Real Model import also displayed the shared processing pill before completion.
- Failure: later Provider `EMPTY_RESPONSE` attempts failed closed, displayed no fabricated Assistant answer, made no Local semantic fallback, and did not mutate Candidate or Job truth.
- Candidate × Job: a real Job conversation received the current Candidate snapshot; safe server diagnostics recorded `candidate_snapshot_present=true`, `confirmed_count=27`, `working_count=29`, `project_count=11`, and `evidence_count=54`.

Screenshots:

- `docs/current/qa/ariadne-job-three-source-bundle.png`
- `docs/current/qa/ariadne-model-import-processing.png`
- `docs/current/qa/ariadne-working-job-grounded.png`
- `docs/current/qa/ariadne-job-conversation-waiting.png`

## Automated verification

- All executable Candidate/Job regression scripts passed: `58` suites total (`38` Node plus `20` Python regression suites, excluding the long-running stub server).
- Final JavaScript syntax checks passed.
- `git diff --check` passed.
- Local Candidate and Local Job retained Provider calls = 0.
- Model failure retained no-Local-fallback behavior.
- CandidateContext, CandidateDelta, source persistence/integrity, Job revision lineage, authority, privacy, stale/version and legacy reopen coverage remained in the passing suite.

## Evidence anchors

- Source input primitive: `public/source-input-domain.js`
- Processing primitive: `public/processing-indicator-domain.js`
- Conversation renderer/state: `public/conversation-ui-domain.js`
- Shared shell/edit controller: `public/product-shell-domain.js`
- Candidate/Job adapters and Model Working flows: `public/v1-pages.js`
- Ordered Job source-bundle contract: `public/job-model-runtime-domain.js`
- Model grounding and page-chrome semantic boundary: `src/job_model_runtime.py`
- Convergence regression: `tests/global_interaction_convergence_regression.mjs`
- Pre-implementation parity audit: `docs/current/ARIADNE_GLOBAL_INTERACTION_PARITY_AUDIT.md`

## Acceptance boundary

The implementation, machine/browser evidence, and final Human acceptance are complete. The checkpoint commit is authorized after the final staged-diff audit.

## Addendum contract verification

The final product-contract addendum is included in this readiness result:

- Runtime authority: both import buttons now dispatch through the same `AriadneProductShell.dispatchRuntimeImport()` symbol. Local Runtime invokes only the Local callback; Model Runtime invokes only the Model callback. A thrown/failed Model callback propagates as failure and can never invoke Local.
- Capability boundary: a verified Candidate vision Runtime exposes `使用 DeepSeek 分析`; a verified Job Model Runtime exposes `使用人工智能解析`; Local Runtime exposes `开始本地提取/整理`. A selected Model without the domain-specific verified import adapter remains disabled and explicitly states that it will not switch to Local.
- Model semantic isolation: Candidate Model execution contains no `processCandidateSource`, `processCandidateProposal` or `/api/local-candidate-structure` call. Job Model execution contains no `processJobSource`, `JobContext.proposalFor`, Local review renderer or Local extraction route. Technical PDF/image/DOCX/text reading remains read-only Source Preparation.
- Durable source-first gate: Candidate and Job Model consent paths now call the same `AriadneSourceInput.persistDurableBundle()` before showing consent or permitting Provider execution. It validates returned SourceDocument identity and content hash. Job pasted text now populates the same `selectedJobSources` collection as file/drop/clipboard sources, fixing the only addendum provenance gap found in the audit.
- Micro-interactions: source preview entry, upload hover/drag/focus/clipboard acceptance, primary/secondary button hover/press, input focus, Processing-to-Working entry, message entry, edit enter/exit, save success and failure use the shared SourceInput, ProductShell, ModelWorkspaceUI, ConversationUI, ProcessingIndicator and common CSS symbols. Reduced-motion disables the shared entry/loading animations and collapses shared transition durations.
- Browser proof: Local Runtime automatically produced Local Candidate/Job actions with zero import-level runtime selectors. Candidate vision Runtime automatically produced the Model action. Job Model pasted text reached consent with the source-first copy and one source in the shared preview. Consent was cancelled, so the addendum verification made no new Provider request. The focused Job textarea computed to the shared blue border and three-pixel focus ring; the loaded stylesheet contained the shared hover/pressed/message/reduced-motion contracts.
- Regression: all 38 Node and 20 Python suites passed; all 44 public JavaScript files passed syntax checking; `git diff --check` passed; staged files remain zero.

## UI contract correction verification

- Exact shared primitives affected: `AriadneProcessingIndicator.ensure/set/clear/setButton`, `AriadneConversationUI.setExecutionState/waitForIndicatorPaint`, `AriadneProductShell.CONTRACT.conversation.field` and `bindConversation`, `AriadneSourceInput.renderBundlePreview`, plus the shared CSS symbols `.v1-processing-loop`, `.v1-conversation-form`, `.v1-composer-field`, `.v1-consent-action`, the back/close selectors and `.v1-mini-sidebar`.
- Reused without forking: both Candidate and Job keep the same ProductShell conversation binder, ConversationUI request lifecycle, ProcessingIndicator state machine and SourceInput preview/provenance path. Domain adapters retain only their labels, source semantics and Provider request/persistence behavior.
- Refined centrally: the ornamental loader became one restrained blue circular loop; the same loop now drives import status, conversation waiting and the busy submit button. The composer now has one required `v1-composer-field` wrapper with `46 / 44 / 42 px` field/input/button geometry, exact vertical centering and a contained rounded focus ring. Back/close hover is scale-only, the minibar is right-side and vertically centered, and the consent action uses the shared light treatment.
- Job import correction: the Model action is exactly `使用人工智能解析`. The visible source region contains only the source card/list/actions; the two verbose explanatory lines are absent. Source URL/body/provenance persistence was not removed.
- Real browser: desktop and `390 × 844` mobile Add Job passed with no horizontal overflow. The minibar is right-side and vertically centered on desktop and hides on mobile. The back button center remained fixed while its rendered size changed from `36 × 36` to `37.44 × 37.44` on hover. Candidate and Job composer measurements both resolved to `46 / 44 / 42 px` and a shared 3 px contained focus ring.
- Async browser proof: a synthetic Job Model import showed `WORKING` with the shared loop before Provider completion. A synthetic Job conversation showed both the shared `WAITING` indicator and a centered busy-loop submit button while keeping composer geometry unchanged; the page was reloaded before that conversation reached Provider transmission. Final Add Job console errors were zero.
- Failure boundary observed: the synthetic Model import Provider response failed existing output-schema validation and surfaced `MODEL_FAILED`; it did not silently execute Local. This is valid fail-closed behavior and does not invalidate the UI convergence gate.
- Final automated gate: `38 Node + 20 Python = 58` suites passed; all `44` public JavaScript files passed syntax checking; `git diff --check` passed; staged files remain zero.

The UI addendum passed Human acceptance and is included in the final J1 checkpoint.

## Final Candidate Material integrity closeout

- Real DeepSeek coverage passed on Work Experience, Project, and Education Candidate Material Details. Each category completed discussion, Candidate-owned mutation, NON_AUTHORITATIVE Working, unchanged confirmed state before Human Save, Save, reopen, and next-turn current-state verification.
- Work Experience additionally passed direct Edit through the same confirmed-revision authority.
- Deterministic coverage exercises every current Candidate Material type: `work_experience`, `project`, `education`, `skill_group`, `language`, `award`, and `custom_section`.
- Frozen Job regression smoke passed with current CandidateContext, no Working, no confirmed mutation, and no visible internal reference.
- Final gate: `40/40` Node, `21/21` executable Python, `84/84` JavaScript syntax, Python compilation, `10/10` HTTP, browser console errors `0`, visible-copy ID leaks `0`, and `git diff --check` PASS.
- One Candidate conversation screenshot containing readable personal material was deliberately excluded from the checkpoint; it is retained locally and is not part of this report's committed evidence set.
