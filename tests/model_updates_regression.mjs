import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Settings=require('../public/model-settings.js'), Runtime=require('../public/runtime-capabilities.js');
const Selection=require('../public/runtime-selection-state.js'), Gate=require('../public/runtime-capability-gate.js');
const OLD='deepseek-v4-flash-vision-exp', MODEL='deepseek-flash';
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
globalThis.localStorage=storage;
const old={mode:'model',provider:'deepseek',model:OLD};
storage.setItem(Gate.CURRENT_RUNTIME_STORAGE_KEY,JSON.stringify(old));
storage.setItem(Selection.KEY,JSON.stringify({default:old,overrides:{a:old},revision:'before'}));
storage.setItem(Gate.OPERATION_RUNTIME_STORAGE_KEY,JSON.stringify({job_conversation:old}));
const unchanged=JSON.stringify([...values]);
await assert.rejects(()=>Selection.update({scope:'a',runtime:old,expectedRevision:Selection.version(),isCurrent:()=>false}),/对话状态已变化/);
for(const [op,scope] of [['candidate_conversation','a'],['job_conversation','b'],['personal_understanding','personal_understanding']]){
  const current=Selection.resolve(op,scope);
  assert.equal(current.model,MODEL);
  assert.equal(current.execution_settings.descriptor_revision,'deepseek-v41-20260911');
}
assert.equal(JSON.stringify([...values]),unchanged,'original preferences retained');
const current=Selection.resolve('candidate_conversation','a');
const snapshot=Runtime.createRuntimeSnapshot(current,{modelDescriptor:Gate.modelDescriptorForRuntime(current,'candidate_conversation')});
const frozenOld={...snapshot,model:OLD,execution_settings:Settings.envelope(old)};
assert.equal(Runtime.validateRuntimeSnapshot(frozenOld).model,OLD,'history never renamed');
assert.notEqual(Settings.identity(frozenOld),Settings.identity(snapshot));
assert.equal(Settings.currentModel('codex','gpt-5.6-sol'),'gpt-5.6-sol');
assert.equal(Settings.currentModel('deepseek','invented-model'),'invented-model');

function harness({mode='model',future=false}={}){
  const counters={get:0,post:0,save:0}, elements=[];
  let revision='one',active=false,fail=false,gate=true,scope='personal_understanding';
  const runtime={mode,provider:mode==='local'?null:'deepseek',model:'deepseek-v4-pro'};
  const item={model:future?'deepseek-future':MODEL,label:'DeepSeek V4.1 Flash',revision:future?null:'deepseek-v41-20260911',can_verify:!future};
  const make=tag=>{const el={tag,children:[],hidden:false,append(...els){this.children.push(...els);},setAttribute(){}};elements.push(el);return el;};
  const form={id:'personal-conversation-form',before(){}},events={};
  const context={console,Date,JSON,Error,Map,Object,sessionStorage:storage,
    document:{createElement:make,head:make('head'),getElementById:()=>null,querySelector:q=>q.includes('aria-busy')?(active?form:null):form,addEventListener(){}},
    AriadneModelSettings:Settings,JobRadarRuntimeGate:{operationGate:()=>({allowed:gate}),authorityFrom:()=>({})},
    AriadneRuntimeSelection:{bindings:new Map(),scopeFor:()=>scope,homepage:()=>runtime,resolve:()=>runtime,version:()=>revision,
      update:async()=>{counters.save++;runtime.model=MODEL;revision='next';}},
    fetch:async(_url,options={})=>{
      if(options.method==='POST'){counters.post++;assert.equal(JSON.parse(options.body).confirmed,true);return {ok:!fail,json:async()=>({ok:!fail,model:item.model,revision:item.revision})};}
      counters.get++;return {ok:true,json:async()=>({ok:true,models:[item]})};
    },addEventListener:(name,fn)=>events[name]=fn,setInterval(){}};
  vm.runInNewContext(fs.readFileSync('public/model-updates.js','utf8'),context);
  return {context,counters,item,runtime,elements,events,set:(k,v)=>{if(k==='fail')fail=v;if(k==='active')active=v;if(k==='revision')revision=v;if(k==='scope')scope=v;if(k==='gate')gate=v;},
    get region(){return elements.find(x=>x.className==='v1-model-update');},get action(){return this.region.children[1];}};
}
const flush=()=>new Promise(r=>setImmediate(r));
let h=harness({mode:'local'});await flush();assert.deepEqual(h.counters,{get:0,post:0,save:0});
h=harness({future:true});await flush();assert.equal(h.action.hidden,true);await h.action.onclick();assert.equal(h.counters.post,0);
h=harness();await flush();assert.equal(h.region.hidden,false);assert.equal(h.counters.post,0);
h.set('active',true);await h.action.onclick();assert.equal(h.counters.post,0);
h.set('active',false);h.set('gate',false);await h.action.onclick();assert.equal(h.counters.post,0);
h.set('gate',true);h.set('fail',true);await h.action.onclick();assert.equal(h.counters.post,1);assert.equal(h.counters.save,0);assert.equal(h.runtime.model,'deepseek-v4-pro');
h.runtime.provider='codex';await h.context.AriadneModelUpdates.check(true);await h.action.onclick();assert.equal(h.counters.post,1);assert.equal(h.region.hidden,true);
h.runtime.provider='deepseek';await h.context.AriadneModelUpdates.check(true);
h.set('fail',false);await h.action.onclick();assert.equal(h.counters.post,2);assert.equal(h.counters.save,1);assert.equal(h.runtime.model,MODEL);assert.equal(h.region.hidden,true);
for(const change of ['revision','scope','active']){
  h=harness();await flush();
  let release;
  h.context.fetch=async()=>{await new Promise(r=>release=r);return {ok:true,json:async()=>({ok:true,model:MODEL,revision:h.item.revision})};};
  const pending=h.action.onclick();h.set(change,change==='active'?true:'changed');release();await pending;
  assert.equal(h.counters.save,0,change+' change during validation cannot save');
}
console.log('model_updates_migration_history_local_discovery_one_click_failure_CAS=PASS');
