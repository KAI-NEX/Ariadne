# Job Radar｜Scoped Conversation Foundation

日期：2026-08-26  
状态：`ADOPTED / FOUNDATION IMPLEMENTED / NO PROVIDER CALL`

## Decision

`Scoped Conversation` is a Job Radar object-owned discussion layer, not a General Career Chat and not a Provider-owned thread.

The first supported scope is only `CANDIDATE_ITEM`. A stable `conversation_id` is derived from `scope_type + scope_id`; it therefore survives model changes without copying the session. `JOB` and `JOB_REQUIREMENT` remain future scope candidates, not current stores, UI or automatic sessions.

Conversation text never changes CandidateContext. A request to change a card remains a separate flow:

```text
Candidate Item conversation → optional Context Patch proposal
→ local validation → Before / After / Why → user confirm → CandidateContext revision
```

Direct Edit bypasses Conversation and model calls.

## Reference Adoption Matrix

| Reference | Exact inspected documentation / code | Adopt | Do not adopt |
| --- | --- | --- | --- |
| [OpenAI Agents SDK Sessions](https://openai.github.io/openai-agents-js/guides/sessions/) | `Session` behavior; `getItems`, `addItems`, custom storage, `sessionInputCallback`, recent-history trim | Stable session identity, provider-swappable persistence, deterministic history selection before a run | `@openai/agents`, OpenAI-hosted session memory, server-managed conversation IDs, compaction |
| [Chatbox provider architecture](https://github.com/chatboxai/chatbox/blob/main/docs/technical/ai-providers.md) and [provider config](https://github.com/chatboxai/chatbox/blob/main/src/renderer/utils/provider-config.ts) | provider/model/protocol/capability are separately modeled; `openai` / `openai-responses` / `anthropic` distinguish transport types | Conversation remains above provider selection and stores canonical message content plus per-turn provenance | Chatbox global chat/session UI, provider marketplace, proxy/config import system |
| Current Job Radar | `src/provider_runtime.py`: `ModelDescriptor`, `ConnectionRequest`, `NormalizedResponse`; `public/candidate-context-domain.js`: `CandidateContext`, `ContextPatch`; browser IndexedDB v8 stores | canonical provider/model/protocol/usage provenance; existing patch-confirm boundary; additive persistence style | Provider-specific response objects in conversation; CandidateItem embedding or mutating messages |

## Minimal Contract

### `ConversationSession`

```text
conversation_id       deterministic: conv_candidate_item_<scope_id>
scope_type            CANDIDATE_ITEM (v1 only)
scope_id              current CandidateItem.item_id
created_at
updated_at
```

### `ConversationMessage`

```text
message_id
conversation_id
role                  USER | ASSISTANT
content               canonical plain text only
created_at

# only for ASSISTANT
provider
model
protocol
processing_run_id?    future run linkage, not required for local foundation
usage
finish_reason?
warnings[]
```

No message stores `choices[0]`, DeepSeek `output`, Claude content blocks, raw HTTP errors, source document blobs or a full CandidateContext.

## Context Compiler v1

`ScopedConversationDomain.compileContext()` is pure and local. It compiles only:

1. three fixed system rules;
2. the current CandidateItem;
3. one caller-selected relevant source reference, if any;
4. up to the latest eight valid messages from the same `conversation_id`;
5. the current user message.

It excludes all other Candidate Items, all other conversations, whole Resume/Portfolio documents, whole CandidateContext and all Jobs by default. It returns a provider-independent canonical request input; it does not call an adapter or persist a message.

## Persistence and Current UI Boundary

IndexedDB moves from v8 to v9 with only two stores:

- `conversation_sessions` keyed by `conversation_id`
- `conversation_messages` keyed by `message_id`

All existing stores remain in place. The current repository has no V2 Candidate Card Detail page to host the intended left-card/right-conversation surface. This foundation intentionally does not introduce that UI, streaming, model calls, automatic conversations, Job/Requirement conversations, RAG, embeddings, vector storage, Agent behavior, fallback models or patch generation.

## Test Evidence

`tests/scoped_conversation_regression.mjs` verifies separate Card IDs, no cross-card history, reload-persistable record shapes, normalized assistant provenance, model switching within one session, eight-message compilation limit, canonical errors, CandidateContext non-mutation and scope mismatch rejection. Existing CandidateContext regression verifies patch and confirmation boundaries independently.
