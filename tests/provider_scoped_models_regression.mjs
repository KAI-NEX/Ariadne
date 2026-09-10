import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const Settings=require('../public/model-settings.js'), Selection=require('../public/runtime-selection-state.js');
const Runtime=require('../public/runtime-capabilities.js'), Gate=require('../public/runtime-capability-gate.js');
const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
globalThis.localStorage=storage;
const sol={mode:'model',provider:'codex',model:'gpt-5.6-sol'}, ds={mode:'model',provider:'deepseek',model:'deepseek-v4-flash-vision-exp'};
const selectHome=r=>storage.setItem(Gate.CURRENT_RUNTIME_STORAGE_KEY,JSON.stringify(r));
const chosen=r=>({...r,execution_settings:Settings.envelope(r)});
const listed=[sol,ds].map(r=>({provider_id:r.provider,model_id:r.model}));
selectHome(sol);
storage.setItem(Selection.KEY,JSON.stringify({default:{...sol,revision:'old'},overrides:{chat:{...ds,revision:'old-ds'}},revision:'old'}));
storage.setItem(Gate.OPERATION_RUNTIME_STORAGE_KEY,JSON.stringify({personal_understanding:ds}));
const before=JSON.stringify([...data]);
assert.equal(Selection.resolve('personal_understanding','chat').provider,'codex');
assert.equal(Selection.hasOverride('chat'),false);
assert.equal(JSON.stringify([...data]),before,'read does not erase historical preferences');
for(const makeDefault of [false,true]) await assert.rejects(Selection.update({scope:'chat',runtime:chosen(ds),expectedRevision:Selection.version(),makeDefault}),/首页/);
assert.equal(JSON.stringify([...data]),before,'rejected cross-provider change writes nothing');
const snapshot=Selection.resolve('personal_understanding','chat');
for(const operation of ['candidate_conversation','job_conversation','personal_understanding','job_overview'])
  assert.deepEqual(Selection.eligibleModels(listed,operation).map(x=>x.provider_id),['codex']);
selectHome(ds);
assert.equal(Selection.resolve('personal_understanding','chat').provider,'deepseek');
assert.throws(()=>Selection.assertCurrent(snapshot,'personal_understanding'),/SELECTION_CHANGED/);
assert.deepEqual(Selection.eligibleModels(listed,'personal_understanding').map(x=>x.provider_id),['deepseek']);
selectHome({mode:'local'});assert.deepEqual(Selection.eligibleModels(listed,'personal_understanding'),[]);
await assert.rejects(Selection.update({scope:'chat',runtime:chosen(sol),expectedRevision:Selection.version()}),/首页/);

// Synthetic catalog/authority only: every qualified model under a Provider can
// appear. Neither discovery alone nor a settings descriptor grants admission.
selectHome(sol);
const descriptors=['synthetic-vision-a','synthetic-vision-b','synthetic-text-only'].map(model=>({...Settings.catalog.models[0],model}));
Settings.catalog.models.push(...descriptors);
const oldGate=globalThis.JobRadarRuntimeGate;
globalThis.JobRadarRuntimeGate={...Gate,authorityFrom:r=>r,operationGate:(operation,r)=>({allowed:operation==='personal_understanding'&&r.model!=='synthetic-text-only'}),isModelRuntimeEligible:r=>r.model!=='synthetic-text-only'};
try {
  const discovered=[...listed,...descriptors.map(d=>({provider_id:d.provider,model_id:d.model})),{provider_id:'codex',model_id:'unregistered-model'}];
  assert.deepEqual(Selection.eligibleModels(discovered,'personal_understanding').map(x=>x.model_id),[sol.model,'synthetic-vision-a','synthetic-vision-b']);
  assert.equal(Selection.eligibleModels([...discovered,...discovered],'personal_understanding').length,3);
  assert.equal(Selection.eligibleModels(discovered,'job_overview').length,0);
  const alternative={...sol,model:'synthetic-vision-b'};
  await Selection.update({scope:'second-model',runtime:chosen(alternative),expectedRevision:Selection.version()});
  assert.equal(Selection.resolve('personal_understanding','second-model').model,alternative.model);
} finally {Settings.catalog.models.splice(-descriptors.length);globalThis.JobRadarRuntimeGate=oldGate;}
const Add=require('../public/add-model-sheet.js');
for(const provider of ['qwen','gemini']) {
  assert.ok(Add.providerFor(provider)?.apiKeyUrl.startsWith('https://'));
  assert.ok(fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8').includes(`data-provider-id="${provider}"`));
  assert.equal(Selection.eligibleModels([{provider_id:provider,model_id:'unverified'}],'personal_understanding').length,0);
}
console.log('provider scope, old overrides, dispatch, Local, multi-model admission, API entry retention PASS');
