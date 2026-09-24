import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/conversation-entry-consent.js', import.meta.url), 'utf8');
function fixture(id = 'personal-conversation-form', reduced = false) {
  const animations = [], events = {}, elements = new Map();
  class Element {
    constructor() {
      this.children = []; this.dataset = {}; this.hidden = false; this.inert = false;
      this.handlers = {}; this.textContent = ''; const classes = new Set();
      this.classList = { toggle: (name, force) => force ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
    }
    append(...children) { this.children.push(...children); }
    prepend(child) { this.children.unshift(child); }
    setAttribute() {}
    addEventListener(name, callback) { this.handlers[name] = callback; }
    querySelectorAll() { return []; }
    querySelector() { return input; }
    focus() { focused = true; }
    animate(frames, options) {
      let resolve, reject;
      const animation = { frames, options, finished: new Promise((yes, no) => { resolve = yes; reject = no; }), finish: () => resolve(), cancel: () => reject(Error('cancelled')) };
      animations.push(animation); return animation;
    }
  }
  let focused = false, accepts = 0, rejectConsent = false;
  const pane = new Element(), form = new Element(), input = new Element(), history = new Element(), reserved = new Element();
  reserved.inert = true; pane.append(history, form, reserved); pane.dataset.entryConfirmation = 'visit';
  form.id = id; form.closest = () => pane; elements.set(id, form);
  let state = { scope: 'scope-a', fingerprint: 'fp-a', token: 'a', accepted: false, runtime: { provider: 'codex', model: 'model' } };
  const root = { document: { documentElement: { lang: 'zh' }, body: {}, head: new Element(), createElement: () => new Element(), getElementById: id => elements.get(id) },
    AriadneRuntimeSelection: { entryConsent: () => state, acceptEntryConsent: (_operation, token) => { accepts++; if (rejectConsent || token !== state.token) throw Error('changed'); state.accepted = true; } },
    matchMedia: () => ({ matches: reduced }), getComputedStyle: () => ({ getPropertyValue: name => ({ '--vi-motion-close': '480ms', '--vi-motion-open': '540ms', '--vi-ease-standard': 'ease', '--vi-ease-reveal': 'ease' })[name] }),
    requestAnimationFrame: () => {}, addEventListener: (name, callback) => { events[name] = callback; }, MutationObserver: class { observe() {} } };
  vm.runInNewContext(source, root);
  return { root, pane, form, history, reserved, animations, events, gate: pane.children[0],
    click: () => pane.children[0].children[3].handlers.click(),
    state: () => ({ focused, accepts, locked: root.AriadneConversationEntry.requiresConfirmation(id === 'job-overview-form' ? 'job_overview' : id === 'personal-conversation-form' ? 'personal_understanding' : id.startsWith('candidate') ? 'candidate_conversation' : 'job_conversation') }),
    change: () => { state = { ...state, token: 'b', accepted: false }; root.AriadneConversationEntry.refresh(); },
    reject: () => { rejectConsent = true; } };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
for (const id of ['personal-conversation-form', 'job-overview-form', 'candidate-workspace-composer', 'candidate-conversation-form', 'job-workspace-composer', 'job-conversation-form']) {
  const f = fixture(id), pending = f.click(); f.click();
  assert.equal(f.state().accepts, 1); assert.equal(f.state().locked, true); assert.equal(f.gate.hidden, false);
  assert.equal(f.history.classList.contains('v1-entry-obscured'), true);
  f.root.AriadneConversationEntry.refresh(); assert.equal(f.animations.length, 1);
  f.animations[0].finish(); await tick();
  assert.equal(f.gate.hidden, true); assert.equal(f.history.classList.contains('v1-entry-obscured'), false);
  assert.equal(f.form.inert, true); assert.equal(f.state().locked, true); assert.equal(f.state().focused, false);
  assert.equal(f.animations[1].options.duration, 540);
  f.animations[1].finish(); await pending;
  assert.deepEqual(f.state(), { accepts: 1, locked: false, focused: true });
  assert.equal(f.form.inert, false); assert.equal(f.reserved.inert, true); assert.equal(f.pane.dataset.entryTransition, undefined);
}
for (const phase of ['leaving', 'entering']) {
  const f = fixture(), pending = f.click();
  if (phase === 'entering') { f.animations[0].finish(); await tick(); }
  f.change(); await pending;
  assert.equal(f.state().locked, true); assert.equal(f.gate.hidden, false); assert.equal(f.state().focused, false);
  assert.equal(f.pane.dataset.entryTransition, undefined); assert.equal(f.gate.children[3].disabled, false);
}
{
  const f = fixture('personal-conversation-form', true); await f.click();
  assert.equal(f.animations.length, 0); assert.equal(f.state().focused, true); assert.equal(f.state().locked, false);
}
{
  const f = fixture(); f.reject(); await f.click();
  assert.equal(f.state().locked, true); assert.equal(f.animations.length, 0); assert.equal(f.gate.children[3].disabled, false);
}
{
  const f = fixture(), pending = f.click(); f.events.pagehide(); await pending;
  assert.equal(f.state().locked, true); assert.equal(f.state().focused, false);
  f.events.pageshow({ persisted: true }); assert.equal(f.gate.hidden, false);
}
console.log('Entry motion PASS: six forms, whole-pane phases, duplicate click, input guard, scope change in both phases, reduced motion, failed consent, lifecycle cleanup');
