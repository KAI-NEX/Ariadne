# Job Radar｜Provider Reference-First Audit

日期：2026-08-26  
范围：DeepSeek-first runtime connection infrastructure；不改 Candidate / Job architecture，不发送 Career Material。

## 结论

当前 `empty content` 不能解释为“DeepSeek 不可用”。已确认的失败层是 **model / protocol / response extraction contract 未显式建模**：旧 Runtime Selection 将所有 account-visible model 一律当作 `/chat/completions` text model，且曾以极低 token 预算运行默认 thinking。`deepseek-v4-flash-vision-exp` 目前仅是账号可见的实验模型，不是公开确认的 plain-text runtime contract。

当前最小修复是 `src/provider_runtime.py`：账户模型先变成 `ModelDescriptor`，再按 `protocol + capabilities` 选择 request builder 和 response normalizer。它不保存 Key、不做网络调用；Keychain、HTTP 与 Career Material consent 仍留在 `app.py` 的既有边界。

## Reference Adoption Matrix

| Reference | Existing solution / exact inspected files | Job Radar reuse | Adapt vs Copy | Reject | Why |
| --- | --- | --- | --- | --- | --- |
| [Chatbox](https://github.com/chatboxai/chatbox/blob/main/docs/technical/ai-providers.md) | `defineProvider()` registry；`OpenAICompatible` base；`CustomOpenAI` / `CustomOpenAIResponses` protocol split；`capabilities` | provider definition 与 model implementation 分离；protocol 是 runtime routing 输入 | Adapt pattern | 30+ provider registry、OAuth/UI settings system | Job Radar 只有 DeepSeek + Local，仍需要避免把“OpenAI-compatible”误当作所有 endpoint 都兼容 |
| [Cherry Studio](https://github.com/CherryHQ/cherry-studio/blob/main/docs/references/provider-model/provider-registry.md) | Registry lookup/normalization；connection config read-time merge；model endpoint/reasoning profile runtime-only | `ModelDescriptor` 只表达 discovery source、protocol、capability；不把 endpoint profile 写入 Candidate/IndexedDB truth | Adapt pattern | 60+ provider directory、registry DB/seeding | 需要一个小型 model metadata layer，但不需要平台级 provider management |
| [Resume Tailor](https://github.com/simaqian/resume-tailor) | `src-tauri/src/llm/mod.rs` `Provider` trait；`openai.rs` one OpenAI-compatible transport；Keyring 在 provider module 外 | HTTP adapter 只处理 protocol/payload/normalization；Keychain 继续由 app boundary 负责 | Adapt pattern | Rust/Tauri/React 迁移；其全局 JSON-only trait | 与 Job Radar 同为 local-first/BYOK，但当前 Python browser-local stack 已足够 |
| [LiteLLM](https://github.com/BerriAI/litellm/blob/main/litellm/llms/deepseek/chat/transformation.py) | provider-specific request transformation；`thinking` toggle；Chat/Responses endpoint distinction | explicit request builders、response normalizers、failure taxonomy；不从 output 反推 model capability | Adapt pattern | LiteLLM dependency/gateway/fallback engine | LiteLLM 的 [open issue](https://github.com/BerriAI/litellm/issues/35648) 也表明 DeepSeek V4 Flash native `/responses` 不能被泛化为 Chat bridge |

## Current DeepSeek Contract Decision

| Account-visible model | Runtime protocol | Declared capability | Discovery source | Connection-test behavior |
| --- | --- | --- | --- | --- |
| `deepseek-v4-flash` | `OPENAI_RESPONSES` | `TEXT` | official contract | synthetic Responses request only；`reasoning.effort=none`；`max_output_tokens=16` |
| `deepseek-v4-pro` | `OPENAI_CHAT_COMPLETIONS` | `TEXT`, `STRUCTURED_JSON` | official contract | synthetic Chat request only；`thinking=disabled`；`max_tokens=16` |
| `deepseek-v4-flash-vision-exp` | `ACCOUNT_EXPERIMENTAL` | none declared | account discovered | no speculative text ping；UI keeps arrow disabled and reports unconfirmed text capability |

`deepseek-v4-flash` is documented by DeepSeek as the only current native Responses model; `deepseek-v4-pro` is not claimed as native Responses compatible. [DeepSeek Responses API](https://api-docs.deepseek.com/api/create-response/)  Thinking must be explicitly controlled because DeepSeek returns reasoning independently from visible content. [DeepSeek Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/)

## Minimal Provider Contract

```text
ProviderConfig (current internal constant)
  provider_id, api_base, auth path

ModelDescriptor (runtime-only)
  provider_id, model_id, display_name
  protocol, capabilities[], discovery_source, runtime_default

Provider runtime adapter (pure/local)
  normalize model list
  validate selected model + intended capability
  build connection request for the selected protocol
  normalize protocol-specific response
  extract usage
```

The current code intentionally does not add a cross-provider marketplace, credential store, Candidate schema change, or persistent provider registry. `LOCAL` remains a runtime state, not a cloud provider.

## Failure Classification

- `credential` — Keychain credential absent or rejected (401/403).
- `transport` — DNS/network/timeout.
- `provider` — upstream HTTP/service failure.
- `model` — model absent from the account listing or provider returns model-not-found.
- `capability` — selected model has no declared contract for the intended task.
- `protocol` — request/response protocol has not been confirmed.
- `unexpected_response` — selected protocol returned malformed or empty visible output.
- `ui` — invalid local client request.

## Verification and Remaining Boundary

Fixture tests cover model-list normalization, Chat and Responses routing, response normalization, empty/malformed output, experimental capability rejection, credential absence, Local readiness, and navigation. No provider inference was made after this audit.

The remaining integration step is exactly **one** approved paid synthetic smoke test for `deepseek-v4-flash` against `POST https://api.deepseek.com/responses`; input and output bounds must be shown and approved immediately before the call. It must not send Resume, Portfolio, JD, CandidateContext, or CareerEvidence.
