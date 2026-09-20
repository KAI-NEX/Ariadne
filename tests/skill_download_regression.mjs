import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/skill-download.js', import.meta.url), 'utf8');
async function render(metadata, size, ok = true) {
  const nodes = Object.fromEntries(['skill-download', 'skill-download-status', 'skill-download-checksum'].map(id => [id, {
    href: '', textContent: '', hidden: true, classList: { remove() { nodes[id].hidden = false; } },
  }]));
  await vm.runInNewContext(source, {
    document: { getElementById: id => nodes[id] },
    fetch: async url => url.endsWith('.json') ? { ok: metadata !== null, json: async () => metadata }
      : { ok, headers: { get: () => String(size) } },
  });
  return nodes;
}
const release = { url: '/downloads/Ariadne-Skill.zip', sha256: 'a'.repeat(64), bytes: 1000 };
assert.equal((await render(release, 1000))['skill-download'].hidden, false);
for (const [data, size, ok] of [[null, 1000, true], [release, 999, true], [release, 1000, false],
  [{ ...release, url: 'https://evil.invalid/skill.zip' }, 1000, true], [{ ...release, sha256: 'bad' }, 1000, true]]) {
  const nodes = await render(data, size, ok);
  assert.equal(nodes['skill-download'].hidden, true);
  assert.equal(nodes['skill-download-checksum'].hidden, true);
}
console.log('Skill download availability, exact artifact size and same-origin boundary PASS');
