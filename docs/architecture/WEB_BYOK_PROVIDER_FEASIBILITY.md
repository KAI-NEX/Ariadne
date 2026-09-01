# Web BYOK Provider Feasibility Spike

**Date:** 2026-08-26  
**Status:** `SPIKE_COMPLETE / NO_BILLABLE_INFERENCE`  
**Question:** Can a browser-hosted, local-first Job Radar later call a user-selected provider directly, without a Job Radar proxy?

## Boundary and result

This is a small independent feasibility spike, not V3 and not a Provider runtime refactor. It does not add a proxy, SaaS backend, Tauri/Desktop route, Candidate Context feature, resume/JD upload, RAG, Agent, MCP, analytics, telemetry, or a production key store. No Career data was read or sent. No provider inference was made.

**Result:** Browser transport is feasible for all five tested endpoints from `http://localhost:8011`: each preflight completed and yielded a readable provider HTTP response. That is deliberately narrower than a successful model call. It proves neither a user key, model availability, streaming, structured output, billing, regional access, nor permission to make that provider the product default.

## Status contract

Every provider needs both dimensions below; they must never be collapsed into one “supported” flag.

| Dimension | Meaning |
| --- | --- |
| `browser_transport` | `CONFIRMED_HTTP_RESPONSE` only after a real browser-origin probe receives a readable HTTP response. It is not an inference or key-validity result. |
| `default_policy` | The product decision about whether an explicit user-owned key may be offered in a future UI. It remains separate from transport. |

Allowed policy values are `SESSION_BYOK_CANDIDATE` (only after a dedicated UX/security review), `REFERENCE_ONLY`, and `NOT_DEFAULT_ALLOWED`. No policy permits a silent Job Radar proxy.

## Reference-first audit

### Chatbox main: useful patterns and rejected patterns

The audit reviewed Chatbox's provider registry, `src/renderer/platform/web_platform.ts`, `src/shared/models/openai-compatible.ts`, `src/shared/models/utils/fetch-proxy.ts`, `src/renderer/platform/web_logger.ts`, and platform storage split.

- Adoptable only as a reference: provider identity, model descriptors and protocol-specific request construction are separated; web and desktop storage are explicit platform concerns.
- Rejected: its OpenAI-compatible route can call `createFetchWithProxy(useProxy, ...)`; a client-to-proxy request can carry the request URL, headers and body. Job Radar must not route a BYOK key or career payload to a default proxy.
- Rejected: its web platform initializes analytics and app logging, while its web logger persists logs locally. A BYOK surface must not put keys or prompt content in telemetry, diagnostics, console output, URLs, or local logs.

### chatbox-lite: constrained contrast, not authority

`lfbear/chatbox-lite` demonstrates a frontend-only layout with direct REST/SSE calls, but it persists keys/chats in `localStorage`. Its Gemini path places the API key in the URL and its Claude path deliberately sends the browser-direct header. These are implementation observations, not proof of provider policy. Job Radar rejects persistent-by-default storage and rejects credentials in URLs.

## Official material and capability matrix

| Provider | Official capability / security signal | Browser transport evidence | Streaming / structured / file path | Default policy for a future UI |
| --- | --- | --- | --- | --- |
| DeepSeek | OpenAI-compatible API; current Responses docs expose `deepseek-v4-flash`, SSE, JSON object/schema, and state that image/file inputs are unsupported on this Responses path. No official browser-key or ephemeral-token stance found in this audit. | `CONFIRMED_HTTP_RESPONSE`: `GET /models` -> 401 from local browser with a fixed invalid placeholder. | API-level streaming and structured output documented; file route not established. | `SESSION_BYOK_CANDIDATE`, only behind an explicit risk disclosure and one approved synthetic smoke test. |
| Google Gemini | Official JS/REST interfaces exist. Google documents key restrictions and a Live-API-specific ephemeral-token flow; that token flow is not evidence for ordinary REST document/chat requests. | `CONFIRMED_HTTP_RESPONSE`: `GET /v1beta/models` -> 400. | API-level streaming/structured/multimodal support; a real browser request/model combination remains untested. | `SESSION_BYOK_CANDIDATE` only for a deliberately restricted user key and explicit disclosure. |
| OpenAI | OpenAI says keys are secrets and must not be exposed in browsers/client-side code; its official JS SDK disables browser use by default. `dangerouslyAllowBrowser: true` only removes that SDK guard—it does not make a long-lived secret safe or change the API recommendation. | `CONFIRMED_HTTP_RESPONSE`: `GET /v1/models` -> 401. | API supports streaming/structured/file features, but that does not override the browser-secret warning. | `NOT_DEFAULT_ALLOWED`. Treat as technical transport evidence, not a recommended browser-BYOK route. |
| Anthropic Claude | Official auth guidance treats API keys as secrets for local development, prototypes, scripts, or single-tenant servers with controlled secret storage; web has no browser-specific short-lived equivalent established here. | `CONFIRMED_HTTP_RESPONSE`: `GET /v1/models?limit=1` -> 401 with the explicit browser-direct header. | API features are outside this no-inference test; browser delivery requires a separate policy review. | `REFERENCE_ONLY` for this product direction. |
| OpenRouter | Official OAuth PKCE guide explicitly supports browser authorization and a direct fetch to its OpenAI-compatible endpoint; this is routing to an aggregator, not a Job Radar proxy. | `CONFIRMED_HTTP_RESPONSE`: `GET /api/v1/models` -> 200. | OpenAI-compatible model listing/chat; capabilities vary by upstream model. | `REFERENCE_ONLY` until the user accepts aggregator/upstream-routing disclosure and model-specific data policy. |

**Region/model availability:** all rows remain `account-and-region-dependent`; model listing and valid-key tests must be recorded separately from the static registry.

Official sources: [DeepSeek Responses API](https://api-docs.deepseek.com/api/create-response/), [DeepSeek Models](https://api-docs.deepseek.com/quick_start/pricing), [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key), [Gemini ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [OpenAI API overview](https://developers.openai.com/api/reference/overview), [Anthropic authentication](https://platform.claude.com/docs/en/manage-claude/authentication), and [OpenRouter OAuth PKCE](https://openrouter.ai/docs/guides/overview/auth/oauth).

The official [openai-node authentication guide](https://github.com/openai/openai-node/blob/main/docs/authentication.md) is explicit: browser use is disabled by default because client-side credentials can be extracted, and `dangerouslyAllowBrowser` should only be enabled after that risk has been mitigated. It is an opt-out of the SDK guard, not a safety feature or a CORS signal.

## Browser test evidence (no charge)

Harness: `tests/web_provider/browser-byok-probe.html`, served by `python3 -m http.server 8011`; origin `http://localhost:8011`.

It issued only `GET` requests to model-list endpoints with the fixed non-secret placeholder `job-radar-browser-byok-invalid`, custom authentication header names, `mode: cors`, and `cache: no-store`. These custom headers caused browser preflight. It sent no body, career material, real key, model request, or file.

| Provider | Endpoint | Readable result |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/models` | 401 |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models` | 400 |
| OpenAI | `https://api.openai.com/v1/models` | 401 |
| Anthropic | `https://api.anthropic.com/v1/models?limit=1` | 401; exposed `access-control-allow-origin: *` |
| OpenRouter | `https://openrouter.ai/api/v1/models` | 200 |

The browser console had zero entries and did not contain the placeholder. A readable 400/401/200 is CORS/transport evidence only. It is not authorization, cost, model, response-shape, streaming, or safety proof.

## Security baseline for any later Web BYOK slice

1. The API key must never go to a Job Radar server, proxy, analytics/telemetry/error pipeline, console, URL/query string, or persisted app log.
2. Default key lifecycle is memory/session only. Persistent storage requires an explicit opt-in and a visible delete action; browser-side encryption is not an OS keychain and must be described honestly.
3. Strict CSP must enumerate exact provider `connect-src` origins; no wildcard or inline script is needed by this harness.
4. Key entry, consent, request disclosure, model selection, and source-data disclosure are separate UI states. No request occurs merely on saving a key or changing a selector.
5. Provider/model results are proposals, never Candidate Context truth; no real career source is transmitted without action-time consent.
6. The first production request needs a per-request audit record that stores no secret and only minimal metadata: provider/model/endpoint/protocol, declared purpose, consent state, timestamp, status, and usage if returned.

## Scope and follow-up gate

This spike does not authorize a Web Provider runtime implementation. Its recommendation is **web-first remains technically credible**, with DeepSeek and Gemini as the first two *candidate* direct-BYOK providers, but only on the session-only/no-proxy boundary. OpenAI transport works but is not a browser-default choice under its official secret guidance. Claude and OpenRouter remain comparison/reference routes.

Exactly one next billable test is proposed, not run: from the same `http://localhost:8011` origin, use a user-supplied DeepSeek key to `POST https://api.deepseek.com/responses`, model `deepseek-v4-flash`, input `Reply only: OK`, `reasoning.effort: none`, `max_output_tokens: 16`, no stream, no source data. Purpose: validate one real direct browser inference and response normalization. It requires fresh action-time user approval.

## Multimodal smoke implementation update (prepared; not approved for execution)

Web V1 Runtime Selection is now multimodal-only: text adapters remain internal, but ordinary selection must not list a text-only, unknown or `UNVERIFIED` descriptor. A previous plain-text `Reply only: OK` request cannot decide whether a vision model is usable. The single capability check is now a fixed synthetic image containing `JOB RADAR TEST` plus `Read the text in this image. Reply only with the text you see.`; success requires normalized visible output exactly `JOB RADAR TEST`. This sets `MULTIMODAL_CONNECTION_READY`; structured output remains independently unverified and non-blocking.

For Gemini, browser-direct discovery must return the official text+image model `gemini-3.1-flash-lite`; this remains a retained but not currently displayed route. DeepSeek's official 2026-08-21 announcement now supplies the exact model-level contract for `deepseek-v4-flash-vision-exp`: a multimodal visual-understanding API model supporting mixed text/image input, Base64 images and Chat Completions. The current product uses its established route: `POST https://api.deepseek.com/chat/completions`, text plus `data:image/jpeg;base64,...` `image_url`, `max_tokens: 32`, visible `choices[0].message.content`. The model is selectable as an official integrated multimodal model, but this does not claim that a paid synthetic request has already completed.

`GEMINI_BROWSER_REAL_INFERENCE = NOT_RUN_AWAITING_MULTIMODAL_APPROVAL`. No actual Provider request is authorized by this implementation; a user-entered key alone is insufficient until the exact smoke is approved again.

## Learning / evidence boundary

Product judgment in this spike is a documented architecture decision. The audit, test harness, browser probe, implementation and documentation are Tool-assisted; they do not create independent user engineering capability evidence.
