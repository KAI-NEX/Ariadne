import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../public/runtime-selection-state.js');
const Settings = require('../public/model-settings.js');
require('../public/runtime-capability-gate.js');
require('../public/runtime-capabilities.js');
const data = new Map(); globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.AriadneConversationEntry = {};
let confirmations = 0; globalThis.confirm = () => { confirmations++; return true; };
const runtime = { mode: 'model', provider: 'codex', model: 'gpt-5.6-sol' };
data.set('job-radar-selected-runtime', JSON.stringify(runtime));
for (const operation of ['personal_understanding', 'job_overview', 'candidate_conversation', 'job_conversation']) {
  if (operation.endsWith('_conversation')) S.bind('test', operation, 'conversation-a');
  const before = S.entryConsent(operation); assert.equal(before.accepted, false);
  await assert.rejects(S.beforeDispatch(before.runtime, operation), /RUNTIME_CONSENT_REQUIRED/);
  S.acceptEntryConsent(operation, before.token);
  assert.equal(S.entryConsent(operation).accepted, true);
  await S.beforeDispatch(before.runtime, operation);
  const effort = before.runtime.execution_settings.effective_settings.reasoning_effort === 'high' ? 'low' : 'high';
  const next = { ...runtime, execution_settings: Settings.envelope(runtime, { reasoning_effort: effort }) };
  await S.update({ scope: before.scope, runtime: next, expectedRevision: S.version() });
  assert.equal(S.entryConsent(operation).accepted, false);
  assert.throws(() => S.acceptEntryConsent(operation, before.token), /RUNTIME_SELECTION_CHANGED/);
  if (operation.endsWith('_conversation')) {
    const token = S.entryConsent(operation).token;
    S.bind('test', operation, 'conversation-b');
    assert.throws(() => S.acceptEntryConsent(operation, token), /RUNTIME_SELECTION_CHANGED/);
  }
  S.bind('test', operation, null);
}
assert.equal(confirmations, 0, 'entry consent never invokes a second generic dialog');
console.log('Entry consent PASS: explicit acceptance, exact model/effort/scope, stale/rebound scope refusal, no double dialog');
