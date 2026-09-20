import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const transport = fs.readFileSync('public/product-transport.js','utf8');
function client(kind, origin='http://127.0.0.1:18880/') {
  const saved=new Map(),session=new Map(),calls=[];
  const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)});
  const context=vm.createContext({URL,Headers,Blob,crypto:webcrypto,Date,Error,Event,
    location:new URL(origin),localStorage:storage(saved),sessionStorage:storage(session),
    AriadneProductConfig:{kind,storage:kind==='skill'?'filesystem':'browser',providers:kind==='skill'?['codex']:['deepseek','gemini','qwen'],runtime:{mode:'model',provider:'codex',model:'gpt-5.6-sol'}},
    document:{documentElement:{dataset:{}},addEventListener(){}},
    fetch:async (url,options={})=>{calls.push({url:String(url),options});return new Response(JSON.stringify({mode:'web',byok:['deepseek','gemini','qwen']}));},
  });
  vm.runInContext(fs.readFileSync('public/product-shell.js','utf8'),context);
  vm.runInContext(transport,context);
  return {context,saved,session,calls,fetch:context.AriadneTransport.fetch};
}
const request=provider=>({method:'POST',body:JSON.stringify({runtime_snapshot:{mode:'model',provider}})});
for(const kind of ['web','skill']) {
  const c=client(kind);
  c.session.set('ariadne-local-connector-session-v1',JSON.stringify({token:'old-token',expires:Date.now()+999999}));
  await c.fetch('/api/runtime-options');
  assert.equal(c.calls[0].url,'/api/runtime-options');
  assert.equal(new Headers(c.calls[0].options.headers).get('X-Ariadne-Connector'),null);
  assert.equal(c.context.AriadneTransport.pair,undefined);
  for(const provider of ['deepseek','gemini','qwen']) {
    c.saved.set('job-radar-provider-api-key:'+provider,'synthetic-'+provider);
    if(kind==='skill') {
      const count=c.calls.length;
      await assert.rejects(c.fetch('/api/personal-understanding-turn',request(provider)),/SKILL_AGENT_ONLY/);
      assert.equal(c.calls.length,count);
    } else {
      await c.fetch('/api/personal-understanding-turn',request(provider));
      const sent=c.calls.at(-1),headers=new Headers(sent.options.headers);
      assert.equal(sent.url,'/api/personal-understanding-turn');
      assert.equal(headers.get('X-Ariadne-Provider-Key'),'synthetic-'+provider);
      assert.match(headers.get('X-Ariadne-Web-Session'),/^[a-f0-9]{64}$/,'Web on loopback is still Web');
    }
  }
  if(kind==='web') await assert.rejects(c.fetch('/api/personal-understanding-turn',request('codex')),/WEB_RUNTIME_NOT_ALLOWED/);
  else {
    await c.fetch('/api/personal-understanding-turn',request('codex'));
    assert.equal(c.calls.at(-1).url,'/api/personal-understanding-turn');
    assert.equal(new Headers(c.calls.at(-1).options.headers).get('X-Ariadne-Provider-Key'),null);
  }
  // A previously saved API or Local selection cannot switch a Skill to BYOK.
  c.saved.set('job-radar-selected-runtime',JSON.stringify({mode:'model',provider:'deepseek',model:'deepseek-flash'}));
  c.context.AriadneModelSettingsCatalog=JSON.parse(fs.readFileSync('public/model-settings-catalog.json','utf8'));
  for(const name of ['model-settings','runtime-selection-state']) vm.runInContext(fs.readFileSync('public/'+name+'.js','utf8'),c.context);
  const resolved=c.context.AriadneRuntimeSelection.resolve('candidate_conversation');
  assert.equal(resolved.provider,kind==='skill'?'codex':'deepseek');
  assert.equal(JSON.parse(c.saved.get('job-radar-selected-runtime')).provider,'deepseek','old preference retained, not overwritten');
  c.saved.set('job-radar-selected-runtime',JSON.stringify({mode:'model',provider:'codex',model:'gpt-5.6-sol'}));
  if(kind==='web') assert.equal(c.context.AriadneRuntimeSelection.resolve('candidate_conversation').mode,'local');
}
console.log('PASS product boundary: stale pairing ignored, same-origin routing, BYOK/Agent isolation, explicit mode on loopback, runtime identity and stored preference preservation');
