import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const D = require('../public/job-journal-domain.js');
const Content = require('../public/content-document.js');
const record = { entry_id: 'entry-a', job_context_id: 'job-a', feedback: 'READ_NO_REPLY', text: '已读两天，未回复；不是拒绝结论。', observed_on: '2026-09-24', created_at: '2026-09-24T09:00:00Z', images: [] };
assert.equal(D.validate(record), record);
assert.deepEqual(Content.unpack(D.STORE, 'entry_id', Content.pack(D.STORE, 'entry_id', record)), record);
for (const change of [{ observed_on: '2026-02-30' }, { feedback: 'INFERRED_REJECTION' }, { text: '' }, { text: 'x'.repeat(6001) }, { images: [{ name: 'x', file: new Blob(['<svg>'], { type: 'image/svg+xml' }) }] }]) {
  assert.throws(() => D.validate({ ...record, ...change }));
}
const png = new File([Buffer.from('89504e470d0a1a0a', 'hex')], 'feedback.png', { type: 'application/octet-stream' });
const images = await D.prepareImages([png]);
assert.equal(images[0].file.type, 'image/png');
assert.equal(images[0].name, 'feedback.png');
assert.equal(D.validate({ ...record, text: '', images }).images.length, 1);
await assert.rejects(D.prepareImages(Array(5).fill(png)));
await assert.rejects(D.prepareImages([new File(['<script>'], 'fake.png', { type: 'image/png' })]));
assert.throws(()=>D.validate({ ...record, images: [{ name: 'large.png', file: new Blob([new Uint8Array(5*1024*1024+1)], {type:'image/png'}) }] }));
const pages = readFileSync(new URL('../public/v1-pages.js', import.meta.url), 'utf8');
assert.match(pages, /if \(canonicalRevision\) byId\("open-candidate-delete"\).classList.add\("hidden"\)/);
assert.match(pages, /if \(activeJobRevision\) byId\("open-job-delete"\).classList.add\("hidden"\)/);
assert.match(readFileSync(new URL('../public/job-application.css', import.meta.url), 'utf8'), /textarea \{ resize: none; \}/);
console.log('Job journal validation, image limits, Markdown preservation and detail parity PASS');
