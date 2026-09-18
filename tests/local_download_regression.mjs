import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/local-download.js', import.meta.url), 'utf8');
async function render(metadata, artifactOK = true) {
  const nodes = Object.fromEntries(['local-download', 'local-download-status', 'local-download-hash'].map(id => [id, {
    textContent: '', href: '', hidden: true, classList: { remove() { nodes[id].hidden = false; } },
  }]));
  const requests = [];
  await vm.runInNewContext(source, {
    document: { getElementById: id => nodes[id] },
    fetch: async (url, options) => {
      requests.push([url, options]);
      return url.endsWith('.json')
        ? { ok: metadata !== null, json: async () => metadata }
        : { ok: artifactOK, headers: { get: () => String(metadata.bytes) } };
    },
  });
  return { nodes, requests };
}
const release = { url: '/downloads/Ariadne-Local-macOS-arm64-20260917-123456.zip', sha256: 'a'.repeat(64), bytes: 1024 };
const valid = await render(release);
assert.equal(valid.nodes['local-download'].href, release.url);
assert.equal(valid.nodes['local-download'].hidden, false);
assert.equal(valid.requests[1][1].method, 'HEAD');
const remote = await render({...release, url: 'https://github.com/KAI-NEX/Ariadne/releases/download/v0.1/' + release.url.split('/').pop()});
assert.equal(remote.nodes['local-download'].hidden, false);
assert.equal(remote.requests.length, 1, 'GitHub release does not require a CORS-blocked HEAD request');
const lookalike = await render({...release, url: 'https://github.com.evil.invalid/KAI-NEX/Ariadne/releases/download/v0.1/' + release.url.split('/').pop()});
assert.equal(lookalike.nodes['local-download'].hidden, true);
for (const [data, exists] of [[null, true], [release, false], [{ ...release, url: 'https://untrusted.invalid/payload.zip' }, true]]) {
  const result = await render(data, exists);
  assert.equal(result.nodes['local-download'].hidden, true);
  assert.match(result.nodes['local-download-status'].textContent, /尚未发布/);
}
console.log('Download metadata, artifact presence, and unsafe URL rejection PASS');
