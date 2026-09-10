import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
const Wave = createRequire(import.meta.url)('../public/wave-physics-loader.js');
const frames = Wave.frames();
assert.equal(Wave.frames(), frames, 'precompute the reference trajectory only once');
assert.equal(frames.bars.length, 15);
for (const track of [...frames.bars, frames.ball]) {
  assert.equal(track.length, 201);
  assert.deepEqual({ ...track[0], offset: 1 }, track.at(-1), 'seamless four-second loop');
  assert.ok(track.every((frame, i) => frame.offset === i / 200));
}
assert.equal(frames.bars[0][0].height, '44px');
assert.equal(frames.bars[14][100].height, '44px');
assert.equal(frames.bars[14][0].height, '16px');
assert.equal(frames.ball[0].transform, 'translate(0px, -44px) scale(1.25, 0.7)');
assert.equal(frames.ball[100].transform, 'translate(280px, -44px) scale(1.25, 0.7)');
for (const track of frames.bars) for (const frame of track) assert.ok(parseFloat(frame.height) >= 4 && parseFloat(frame.height) <= 64);

function events(extra = {}) {
  const listeners = new Map();
  return { ...extra, listeners, addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); }, dispatch(type, event = {}) { listeners.get(type)?.(event); } };
}
let created = 0, cancelled = 0, observer;
const media = events({ matches: false });
const doc = events({ hidden: false, timeline: { currentTime: 1234 } });
const view = events({ matchMedia: () => media, IntersectionObserver: class {
  constructor(callback) { this.callback = callback; observer = this; }
  observe() {}
  disconnect() { this.disconnected = true; }
} });
doc.defaultView = view;
const nodes = Array.from({ length: 16 }, () => ({ style: {}, animate(track, timing) {
  assert.equal(track.length, 201); assert.equal(timing.duration, 4000); assert.equal(timing.iterations, Infinity);
  created++;
  return { playState: 'running', startTime: null, cancel() { cancelled++; this.playState = 'idle'; }, pause() { this.playState = 'paused'; }, play() { this.playState = 'running'; } };
} }));
const host = { ownerDocument: doc, querySelector: selector => selector === '.v1-wave-stage' ? {} : nodes[15], querySelectorAll: () => nodes.slice(0, 15) };
Wave.set(host, true); assert.equal(created, 16);
Wave.set(host, true); assert.equal(created, 16, 'progress copy updates must not restart the motion');
observer.callback([{ isIntersecting: false }]); observer.callback([{ isIntersecting: true }]); assert.equal(created, 16, 'offscreen pause resumes the same timeline');
media.matches = true; media.dispatch('change'); assert.equal(cancelled, 16);
media.matches = false; media.dispatch('change'); assert.equal(created, 32);
view.dispatch('pagehide', { persisted: true }); view.dispatch('pageshow'); assert.equal(created, 32, 'cache restore resumes without multiplying animations');
Wave.set(host, false); assert.equal(cancelled, 32); assert.equal(doc.listeners.size, 0); assert.equal(media.listeners.size, 0); assert.equal(view.listeners.size, 0); assert.equal(observer.disconnected, true);
media.matches = true; Wave.set(host, true); assert.equal(created, 32, 'reduced motion mounts a static pose'); Wave.set(host, false);
const processing = fs.readFileSync(new URL('../public/processing-indicator-domain.js', import.meta.url), 'utf8');
assert.match(processing, /classList\.contains\("v1-conversation-status"\)/);
console.log('Wave physics: reference geometry, smooth loop, memoization, progress continuity, reduced motion, offscreen/cache pause and disposal PASS');
