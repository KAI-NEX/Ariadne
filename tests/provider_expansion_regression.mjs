import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Gate=require('../public/runtime-capability-gate.js');
const Settings=require('../public/model-settings.js');
const Candidate=require('../public/candidate-workspace-conversation-runtime.js');
const Job=require('../public/job-conversation-domain.js');
const JobImport=require('../public/job-model-runtime-domain.js');
const stored=new Map();
globalThis.localStorage={getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,v)};
for(const [provider,model] of [['gemini','gemini-3.7-flash'],['qwen','qwen3.8-max']]) {
  const runtime={mode:'model',provider,model};
  assert.equal(Gate.isModelRuntimeEligible(runtime),true);
  assert.equal(Settings.envelope(runtime).connection_id,`${provider}-browser-v1`);
  for(const operation of ['candidate_image_import','job_image_import','candidate_conversation','job_conversation','personal_understanding','job_overview']) {
    const descriptor=Gate.modelDescriptorForRuntime(runtime,operation);
    assert.equal(descriptor.protocol,'OPENAI_CHAT_COMPLETIONS');
    assert.equal(descriptor.document_delivery,'rendered_pdf_pages');
    assert.ok(descriptor.adapter_version.startsWith(provider+'-'));
    assert.equal(Gate.operationGate(operation,Gate.authorityFrom(runtime,operation)).allowed,true);
  }
  for(const model of ['unverified-vision','deepseek-flash','gemini-2.0-flash','qwen-text']) assert.equal(Gate.isModelRuntimeEligible({...runtime,model}),false);
  stored.set('job-radar-selected-runtime',JSON.stringify(runtime));
  Gate.recordOperationRuntimeSelection(runtime);
  for(const snapshot of [Candidate.createRuntimeSnapshot(),Job.createRuntimeSnapshot(),JobImport.createRuntimeSnapshot()]) {
    assert.equal(snapshot.provider,provider);assert.equal(snapshot.model,model);
    assert.equal(snapshot.credential_ref,`browser-key://${provider}/request`);
    assert.equal(snapshot.execution_settings.connection_id,`${provider}-browser-v1`);
  }
}
console.log('PASS both providers: six capability gates, captured domain identities, own credentials and unknown models denied');
