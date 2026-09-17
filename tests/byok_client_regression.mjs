import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script = fs.readFileSync('public/local-connector.js', 'utf8');
function client(origin = 'http://127.0.0.1:8000') {
  const calls = [], saved = new Map(), session = new Map();
  const context = { URL, Headers, AbortSignal, Date,
    location: new URL(origin),
    localStorage: { getItem: key => saved.get(key) ?? null },
    sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
    fetch: async (input, options = {}) => { calls.push({ input: String(input), options }); return { status: 200, ok: true }; },
  };
  vm.runInNewContext(script, context);
  return { fetch: context.AriadneConnector.fetch, calls, saved, session };
}
const body = provider => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runtime_snapshot: { mode: 'model', provider } }) });
const c = client(); c.saved.set('job-radar-provider-api-key:deepseek', 'synthetic-browser-key');
for (const route of ['candidate-model-structure', 'job-model-structure', 'candidate-conversation-turn', 'job-conversation-turn', 'personal-understanding-turn', 'job-overview-turn']) {
  await c.fetch('/api/' + route, body('deepseek'));
  const request = c.calls.at(-1);
  assert.equal(new Headers(request.options.headers).get('X-Ariadne-Provider-Key'), 'synthetic-browser-key');
  assert.equal(request.options.redirect, 'error');
  assert(!request.options.body.includes('synthetic-browser-key'));
}
for (const [path, options] of [['/api/candidate-model-structure', body('codex')], ['/api/runtime-options', {}], ['/api/workspace', body('deepseek')], ['https://other.example/api/personal-understanding-turn', body('deepseek')]]) {
  await c.fetch(path, options);
  assert.equal(new Headers(c.calls.at(-1).options.headers).get('X-Ariadne-Provider-Key'), null);
}
c.saved.clear(); await c.fetch('/api/personal-understanding-turn', body('deepseek'));
assert.equal(new Headers(c.calls.at(-1).options.headers).get('X-Ariadne-Provider-Key'), null);
const web = client('https://web.example'); web.saved.set('job-radar-provider-api-key:deepseek', 'synthetic-browser-key');
await assert.rejects(web.fetch('/api/personal-understanding-turn', body('deepseek')), /WEB_API_RUNTIME_UNAVAILABLE/);
await assert.rejects(web.fetch('/api/personal-understanding-turn', body('codex')), /CONNECTOR_PAIRING_REQUIRED/);
assert.equal(web.calls.length, 0);
c.session.set('ariadne-local-connector-session-v1', JSON.stringify({ token: 'synthetic-pair-token', expires: Date.now() + 10000 }));
c.saved.set('job-radar-provider-api-key:deepseek', 'synthetic-browser-key');
await c.fetch('/api/personal-understanding-turn', body('codex'));
assert.equal(new Headers(c.calls.at(-1).options.headers).get('X-Ariadne-Provider-Key'), null);
assert.equal(new Headers(c.calls.at(-1).options.headers).get('X-Ariadne-Connector'), 'synthetic-pair-token');
console.log('PASS BYOK client: six operations, local-only credentials, Codex separation, no external credential forwarding');
