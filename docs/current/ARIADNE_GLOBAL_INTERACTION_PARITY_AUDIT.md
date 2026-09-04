# Ariadne Global Interaction Parity Audit

Status: pre-implementation symbol audit
Date: 2026-09-04
Scope: Candidate / Job input, processing, workspace, detail, conversation, and edit behavior

## Classification key

- `REUSE_EXACT_SYMBOL`: both domains already invoke the same implementation.
- `EXTRACT_TO_SHARED_PRIMITIVE`: equivalent behavior is currently duplicated or only partially shared.
- `DOMAIN_SPECIFIC`: the behavior legitimately differs because of its data or semantic contract.
- `REMOVE_DUPLICATE`: a domain-only presentation branch must be deleted after shared extraction.

## Input parity map

| Behavior | Candidate current symbol | Job current symbol | Classification | Convergence target |
|---|---|---|---|---|
| Click upload | `installFileDropzone("personal-dropzone", ...)` | `installFileDropzone("job-dropzone", ...)` | `EXTRACT_TO_SHARED_PRIMITIVE` | Shared source-input binding |
| Drag/drop | `installFileDropzone` | `installFileDropzone` | `REUSE_EXACT_SYMBOL` | Move the exact symbol into a standalone shared domain module |
| Multiple images/files | `acceptCandidateFiles` + `selectedCandidateSources` | `acceptJobFiles` + `selectedJobSources`; Model branch rejects more than one | `EXTRACT_TO_SHARED_PRIMITIVE` | One ordered bundle contract; domain preparation stays separate |
| Source preview | `showCandidateSource` | `showJobSource` | `REMOVE_DUPLICATE` | Shared ordered bundle preview renderer |
| Remove/replace | `replace-personal-file` listener | `replace-job-file` listener | `EXTRACT_TO_SHARED_PRIMITIVE` | Shared replace/reset interaction; domain cancellation remains domain-specific |
| Pasted text | not present in current Candidate import | `job-paste-input` + `LocalJob.preparePastedText` | `DOMAIN_SPECIFIC` | Job text mode remains domain-specific |
| Clipboard image | absent | absent | `EXTRACT_TO_SHARED_PRIMITIVE` | One guarded clipboard handler for both dropzones |
| Source persistence/integrity | `RawSource.persistDurableSource` / `resolveRawSource` | same symbols | `REUSE_EXACT_SYMBOL` | Preserve unchanged |

## Processing parity map

| Behavior | Candidate current symbol | Job current symbol | Classification | Convergence target |
|---|---|---|---|---|
| Local state | `setCandidateExtractionState` | direct writes to `job-processing` | `REMOVE_DUPLICATE` | Shared `ProcessingIndicator` state setter; domain copy supplied by caller |
| Model state | `setCandidateExtractionState` + `setCandidateWorkspaceProgress` | direct writes + `setJobWorkspaceProgress` | `EXTRACT_TO_SHARED_PRIMITIVE` | Shared indicator plus existing shared progress renderer |
| Waiting animation | `.v1-processing-orbit` and `.v1-workspace-processing-dot` | same CSS classes, separate writes | `EXTRACT_TO_SHARED_PRIMITIVE` | One mounted animated indicator primitive |
| Failure presentation | Candidate and Job domain dialogs | Candidate and Job domain dialogs | `DOMAIN_SPECIFIC` | Keep domain copy; use shared terminal indicator transition |
| Transition to Working | `ProductShell.showWorkspace` + `ModelWorkspaceUI.setProcessingState` | same symbols | `REUSE_EXACT_SYMBOL` | Preserve |

## Workspace / detail parity map

| Behavior | Candidate current symbol | Job current symbol | Classification | Convergence target |
|---|---|---|---|---|
| Import shell | `ProductShell.bindImportShell` | same | `REUSE_EXACT_SYMBOL` | Preserve |
| Working workspace | `ProductShell.bindWorkspaceShell` / `showWorkspace` | same | `REUSE_EXACT_SYMBOL` | Preserve |
| Workspace progress | `ModelWorkspaceUI.renderProgress` | same | `REUSE_EXACT_SYMBOL` | Preserve |
| Detail shell | `ProductShell.bindDetailShell` | same | `REUSE_EXACT_SYMBOL` | Preserve |
| Header / close / padding / radius | shared HTML class contract and `styles.css` | same | `REUSE_EXACT_SYMBOL` | Preserve and browser-audit |
| Content/conversation panes | ProductShell workspace/detail contract | same | `REUSE_EXACT_SYMBOL` | Preserve |
| Scroll architecture | shared `v1-workspace-scroll-region`, `v1-workspace-history`, `v1-conversation-pane` CSS | same | `REUSE_EXACT_SYMBOL` | Preserve and browser-audit |
| Save/authority | Candidate Working Model acceptance | Job proposal-to-revision save | `DOMAIN_SPECIFIC` | Keep authority contracts; share only presentation |

## Conversation parity map

| Behavior | Candidate current symbol | Job current symbol | Classification | Convergence target |
|---|---|---|---|---|
| Human bubble | `ConversationUI.renderMessages` | same | `REUSE_EXACT_SYMBOL` | Preserve exact symbol |
| Assistant bubble | `ConversationUI.renderMessages` | same | `REUSE_EXACT_SYMBOL` | Preserve exact symbol |
| Composer | `ProductShell.bindConversation` + `.v1-conversation-form` | same | `REUSE_EXACT_SYMBOL` | Preserve exact symbol |
| Textarea/input | `ProductShell.CONTRACT.conversation.input` | same | `REUSE_EXACT_SYMBOL` | Preserve exact symbol |
| Send button | `ProductShell.CONTRACT.conversation.send` | same | `REUSE_EXACT_SYMBOL` | Preserve exact symbol |
| Focus style | shared `.v1-conversation-form` / `:focus-visible` CSS | same | `REUSE_EXACT_SYMBOL` | Preserve |
| Waiting state | `ConversationUI.setExecutionState` with text-only status | same | `EXTRACT_TO_SHARED_PRIMITIVE` | Make the exact shared symbol mount `ProcessingIndicator` |
| Streaming/wait placeholder | text-only status | text-only status | `EXTRACT_TO_SHARED_PRIMITIVE` | Shared animated waiting placeholder |
| Failure state | Candidate/Job domain copy around shared state reset | same pattern | `DOMAIN_SPECIFIC` | Keep copy; shared indicator terminal transition |
| Bottom anchoring | `ConversationUI.settle` + shared flex/grid CSS | same | `REUSE_EXACT_SYMBOL` | Preserve and browser-audit |

## Edit parity map

| Behavior | Candidate current symbol | Job current symbol | Classification | Convergence target |
|---|---|---|---|---|
| Enter/edit transition | `ProductShell.createDetailPanelController` | same | `REUSE_EXACT_SYMBOL` | Preserve exact controller |
| Field geometry / spacing | `.v1-edit-form`, `.v1-detail-state-panel` | same | `REUSE_EXACT_SYMBOL` | Preserve |
| Populate form | inline Candidate listeners | `openEdit` | `EXTRACT_TO_SHARED_PRIMITIVE` | Shared detail edit-shell controller callbacks |
| Cancel / preview / back | inline Candidate listeners | inline Job listeners | `EXTRACT_TO_SHARED_PRIMITIVE` | Shared lifecycle controller; domain serializers remain callbacks |
| Confirm/save | Candidate revision persistence | Job revision persistence | `DOMAIN_SPECIFIC` | Preserve separate authority logic |
| Delete | Candidate source/card lifecycle | Job source/card lifecycle | `DOMAIN_SPECIFIC` | Preserve semantics and shared visual placement |
| Return to read mode | panel controller plus duplicated callers | panel controller plus duplicated callers | `EXTRACT_TO_SHARED_PRIMITIVE` | Shared edit-shell lifecycle symbol |

## Job semantic path audit

Current path is `SourceDocument -> /api/local-source-read -> JobModel.sourcePreparationFor -> prepared text blocks -> src/job_model_runtime.py -> DeepSeek -> grounded proposal`.

Observed gaps before implementation:

1. Every OCR/text line is passed with equal weight; no explicit semantic instruction distinguishes job body from page chrome.
2. The Model request accepts exactly one SourceDocument and one preparation.
3. Block references are unique only inside one source.
4. The proposal persists exactly one source ID, so a multi-screenshot JD cannot retain ordered per-source provenance as one import intent.
5. Grounding validation is strong for block existence, but the prompt does not explicitly forbid treating header/footer/navigation/legal content as job fields or requirements.

Convergence target: ordered source bundle -> per-source read-only preparation -> one Model semantic request -> one grounded Working Job carrying all referenced SourceDocument IDs. Local structuring remains isolated and Provider calls remain zero.
