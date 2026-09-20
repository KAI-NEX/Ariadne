import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
const source = fs.readFileSync(new URL('../public/skill-install.js', import.meta.url), 'utf8');
const release = { url: '/downloads/Ariadne-Skill.zip', sha256: 'a'.repeat(64), bytes: 1000 };
async function render(data = release, bytes = 1000, clipboardFails = false, body = new Uint8Array(1000), downloadOK = true) {
  let copied;
  let requests = 0;
  const nodes = Object.fromEntries(['skill-install-copy', 'skill-install-status', 'skill-install-prompt', 'skill-install-details'].map(id => [id, {
    disabled: true, hidden: true, value: '', textContent: '',
    addEventListener(type, fn) { this[type] = fn; },
    focus() { this.focused = true; }, select() { this.selected = true; },
  }]));
  const context = vm.createContext({
    crypto: webcrypto,
    document: { getElementById: id => nodes[id] },
    navigator: { clipboard: { async writeText(text) { if (clipboardFails) throw Error('denied'); copied = text; } } },
    fetch: async (url, options) => { requests++; return url.endsWith('.json') ? { ok: data !== null, json: async () => data }
      : options.method === 'HEAD' ? { ok: true, headers: { get: () => bytes === null ? null : String(bytes) } }
      : { ok: downloadOK, arrayBuffer: async () => body.buffer }; },
  });
  vm.runInContext(source, context);
  assert.equal(requests, 0, 'homepage must not load installer metadata or archive until guide opens');
  await Promise.all([context.AriadneSkillInstall.prepare(), context.AriadneSkillInstall.prepare()]);
  const count = requests;
  if (!nodes['skill-install-copy'].disabled) {
    await context.AriadneSkillInstall.prepare();
    assert.equal(requests, count, 'reopening a ready guide reuses the checked version');
    assert.equal(requests, bytes === null ? 3 : 2, 'concurrent prepare calls share one check');
  }
  return { nodes, context, copied: () => copied };
}
const body = new Uint8Array(1000).fill(42);
const verified = {...release, sha256: createHash('sha256').update(body).digest('hex')};
assert.equal((await render(verified, null, false, body)).nodes['skill-install-copy'].disabled, false);
for (const [metadata, content, ok] of [[release, body, true], [verified, new Uint8Array(999), true], [verified, body, false]]) {
  assert.equal((await render(metadata, null, false, content, ok)).nodes['skill-install-copy'].disabled, true);
}
const ready = await render();
assert.equal(ready.nodes['skill-install-copy'].disabled, false);
await ready.nodes['skill-install-copy'].click();
assert.match(ready.copied(), /https:\/\/ariadne\.kai-nex\.com\/downloads\/Ariadne-Skill\.zip/);
assert.ok(ready.copied().includes(release.sha256));
assert.match(ready.nodes['skill-install-status'].textContent, /粘贴到 Codex/);
assert.doesNotMatch(ready.nodes['skill-install-status'].textContent, /安装成功|已安装/);
const failedCopy = await render(release, 1000, true);
await failedCopy.nodes['skill-install-copy'].click();
assert.equal(failedCopy.nodes['skill-install-details'].open, true);
assert.equal(failedCopy.nodes['skill-install-prompt'].selected, true);
assert.match(failedCopy.nodes['skill-install-status'].textContent, /未能自动复制/);
for (const [data, size] of [[null, 1000], [release, 999], [{...release, url:'https://evil.invalid/x'},1000], [{...release,sha256:'bad'},1000]]) {
  const result = await render(data, size);
  assert.equal(result.nodes['skill-install-copy'].disabled, true);
  assert.equal(result.nodes['skill-install-details'].hidden, true);
  assert.equal(result.copied(), undefined);
}
console.log('Skill install: artifact validation, missing HEAD length with size/hash checks, copy success, clipboard fallback, unavailable package PASS');

const githubURL = 'https://github.com/KAI-NEX/Ariadne/releases/download/skill-20260920/Ariadne-Skill.zip';
const github = await render({...release, github_url:githubURL});
await github.nodes['skill-install-copy'].click();
assert.ok(github.copied().includes(githubURL));
for(const github_url of ['https://evil.invalid/Ariadne-Skill.zip', githubURL+'?redirect=evil', githubURL.replace('KAI-NEX','someone'), githubURL.replace('skill-20260920','latest')]) {
  assert.equal((await render({...release, github_url})).nodes['skill-install-copy'].disabled, true);
}
console.log('Skill install: lazy shared preparation and pinned GitHub release allowlist PASS');
