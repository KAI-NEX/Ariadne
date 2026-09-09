import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const Gate=require('../public/runtime-capability-gate.js');
const runtime={mode:'model',provider:'codex',model:'gpt-5.6-sol'};
assert.equal(Gate.isModelRuntimeEligible(runtime),true);
for (const operation of ['candidate_image_import','job_image_import','candidate_conversation','job_conversation','personal_understanding','job_overview']) {
 const descriptor=Gate.modelDescriptorForRuntime(runtime,operation);
 assert.equal(descriptor.protocol,'CODEX_EXEC_JSONL');assert.match(descriptor.adapter_version,/^codex-/);
 assert.equal(descriptor.document_delivery,'rendered_pdf_pages');assert.equal(Gate.operationGate(operation,Gate.authorityFrom(runtime,operation)).allowed,true);
}
assert.equal(Gate.isModelRuntimeEligible({...runtime,model:'gpt-unknown'}),false);
assert.equal(Gate.isModelRuntimeEligible({mode:'model',provider:'deepseek',model:'deepseek-v4-pro'}),false);
const stored=new Map();const storage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
globalThis.localStorage=storage;stored.set('job-radar-selected-runtime',JSON.stringify(runtime));Gate.recordOperationRuntimeSelection(runtime);
const Candidate=require('../public/candidate-workspace-conversation-runtime.js');
const Job=require('../public/job-conversation-domain.js');
const JobImport=require('../public/job-model-runtime-domain.js');
for(const snapshot of [Candidate.createRuntimeSnapshot(),Job.createRuntimeSnapshot(),JobImport.createRuntimeSnapshot()]) {
 assert.equal(snapshot.provider,'codex');assert.equal(snapshot.model,runtime.model);assert.equal(snapshot.credential_ref,'local-codex://authenticated-session');assert.match(snapshot.adapter_version,/^codex-/);
}
let calls=[];let failure=false;
const nativeFetch=async (url,options={})=>{
 calls.push({url:String(url),options});if(failure)throw new TypeError('network unavailable');
 return new Response(JSON.stringify(String(url).endsWith('/pair')?{token:'synthetic-token',expires_in:28800}:{models:[]}),{status:200});
};
const context=vm.createContext({fetch:nativeFetch,sessionStorage:storage,location:{href:'https://web.example.test/',origin:'https://web.example.test'},URL,Headers,Response,AbortSignal,Date,Error});
vm.runInContext(fs.readFileSync(new URL('../public/local-connector.js',import.meta.url),'utf8'),context);
const connector=context.AriadneConnector;
await connector.fetch('/api/runtime-options');assert.equal(calls.at(-1).url,'/api/runtime-options');
await assert.rejects(()=>connector.fetch('/api/personal-understanding-turn',{method:'POST',body:JSON.stringify({runtime_snapshot:runtime})}),/CONNECTOR_PAIRING_REQUIRED/);
await connector.pair('synthetic-code');assert.equal(connector.connected(),true);
await connector.fetch('/api/personal-understanding-turn',{method:'POST',body:'synthetic'});assert.equal(calls.at(-1).url,'http://127.0.0.1:8765/api/personal-understanding-turn');assert.equal(calls.at(-1).options.headers.get('X-Ariadne-Connector'),'synthetic-token');assert.equal(calls.at(-1).options.credentials,'omit');assert.equal(calls.at(-1).options.redirect,'error');
await connector.fetch('https://external.example.test/');assert.equal(calls.at(-1).options.headers,undefined);
failure=true;const count=calls.length;await assert.rejects(()=>connector.fetch('/api/job-conversation-turn'),/CONNECTOR_UNREACHABLE/);assert.equal(calls.length,count+1);assert.match(calls.at(-1).url,/127\.0\.0\.1:8765/);
const state=JSON.parse(storage.getItem('ariadne-local-connector-session-v1'));state.expires=1;storage.setItem('ariadne-local-connector-session-v1',JSON.stringify(state));const previous=calls.length;
await assert.rejects(()=>connector.fetch('/api/runtime-options'),/CONNECTOR_PAIRING_REQUIRED/);assert.equal(calls.length,previous);
await connector.disconnect().catch(()=>{});assert.equal(connector.connected(),false);
for (const name of fs.readdirSync(new URL('../public/',import.meta.url)).filter(n=>n.endsWith('.html'))) {
 const html=fs.readFileSync(new URL('../public/'+name,import.meta.url),'utf8');if(html.includes('/runtime-capability-gate.js'))assert.match(html,/local-connector\.js/,name);
}
const pages=fs.readFileSync(new URL('../public/v1-pages.js',import.meta.url),'utf8');assert.match(pages,/candidate-model-consent-model"\)\.textContent = gate\.authority\.runtime\.model/);assert.match(pages,/job-model-consent-model"\)\.textContent = gate\.authority\.runtime\.model/);
console.log(JSON.stringify({six_operation_descriptors:'pass',captured_codex_snapshots:'pass',bridge_routing_and_no_fallback:'pass',consent_identity:'pass'}));
