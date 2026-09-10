import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Selection=require('../public/runtime-selection-state.js');
const Settings=require('../public/model-settings.js');
const Gate=require('../public/runtime-capability-gate.js');
require('../public/runtime-capabilities.js');
const UI=require('../public/conversation-ui-domain.js');
const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
globalThis.localStorage=storage;globalThis.sessionStorage=storage;
const sol={mode:'model',provider:'codex',model:'gpt-5.6-sol'};
storage.setItem(Gate.CURRENT_RUNTIME_STORAGE_KEY,JSON.stringify(sol));
let dialogs=0;globalThis.confirm=()=>{dialogs++;return true;};
function checkbox() {
  return {checked:false,disabled:false,validationMessage:'',focusCount:0,reports:0,
    addEventListener(name,fn){this[name]=fn;},setCustomValidity(s){this.validationMessage=s;},
    focus(){this.focusCount++;},reportValidity(){this.reports++;},
    choose(value){this.checked=value;this.change();}};
}
for(const operation of ['personal_understanding','job_overview']) {
  const box=checkbox();Selection.bindTransferConsent(operation,box);
  const snapshot=Selection.resolve(operation,operation);
  // A previous generic approval cannot override an unchecked page checkbox.
  storage.setItem(`ariadne-model-consent:${operation}`,JSON.stringify([Settings.identity(snapshot),snapshot.execution_settings.selection_revision]));
  assert.equal(UI.requireTransferConsent(box),false);
  assert.match(box.validationMessage,/勾选底部/);assert.equal(box.focusCount,1);assert.equal(box.reports,1);
  await assert.rejects(Selection.beforeDispatch(snapshot,operation),/RUNTIME_CONSENT_REQUIRED/);
  box.choose(true);assert.equal(box.validationMessage,'');assert.equal(UI.requireTransferConsent(box),true);
  box.disabled=true; // Busy disables editing the checkbox, not its captured consent.
  await Selection.beforeDispatch(snapshot,operation);await Selection.beforeDispatch(snapshot,operation);
  assert.equal(dialogs,0,'checked consent skips duplicate dialogs, including batch calls');
  box.choose(false);await assert.rejects(Selection.beforeDispatch(snapshot,operation),/RUNTIME_CONSENT_REQUIRED/);
  box.choose(true);
  const next={...sol,execution_settings:Settings.envelope(sol,{reasoning_effort:'low'})};
  await Selection.update({scope:operation,runtime:next,expectedRevision:Selection.version()});
  await assert.rejects(Selection.beforeDispatch(snapshot,operation),/RUNTIME_SELECTION_CHANGED/);
  const changed=Selection.resolve(operation,operation);
  await assert.rejects(Selection.beforeDispatch(changed,operation),/RUNTIME_CONSENT_REQUIRED/);
  box.choose(true);await Selection.beforeDispatch(changed,operation);assert.equal(dialogs,0);
}
// Other conversation surfaces without a transfer checkbox keep their disclosure.
await Selection.beforeDispatch(Selection.resolve('candidate_conversation','candidate-test'),'candidate_conversation');
assert.equal(dialogs,1);
storage.setItem(Gate.CURRENT_RUNTIME_STORAGE_KEY,JSON.stringify({mode:'local'}));
assert.throws(()=>Selection.assertCurrent({...sol,execution_settings:Settings.envelope(sol,{},'old','personal_understanding')},'personal_understanding'));
console.log('checkbox feedback, explicit scope/model consent, no duplicate dialog, revocation, batches, stale model and fallback PASS');
