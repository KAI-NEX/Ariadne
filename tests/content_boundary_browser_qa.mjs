// Disposable synthetic workspace: auxiliary databases and historical pages.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || '')) throw Error('disposable_local_server_required');
const output = path.resolve(process.env.ARIADNE_QA_OUTPUT || '.cache/markdown-migration-20260912/final/boundaries');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const context=await browser.newContext(),page=await context.newPage(),errors=[],modelRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST' && !r.url().endsWith('/api/workspace'))modelRequests.push(r.url());});
 await page.goto(base+'/index.html');
 await page.evaluate(async()=>{
  const put=async(name,store,keyPath,value)=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);q.onupgradeneeded=()=>q.result.createObjectStore(store,{keyPath});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).add(value);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();};
  await put('ariadne-job-applications-v1','applications','job_context_id',{job_context_id:'historical-stage',stage:'APPLIED',outcome:'',note:'旧备注完整保留',revision:1,updated_at:'2026-09-12T00:00:00Z',history:[]});
  await put('ariadne-conversation-attachments-v1','turns','request_id',{request_id:'historical-attachment',domain:'PERSONAL',authority:'SOURCE_INPUT_ONLY',files:[{file:new File(['  旧附件\n'],'原始附件.md',{type:'text/markdown',lastModified:123})}]});
 });
 await page.goto(base+'/personal-understanding.html');
 await page.waitForFunction(()=>window.AriadneContentDatabase && document.querySelector('#personal-conversation-form input[type=file]'));
 const old=await page.evaluate(async()=>{
  const all=async(name,store)=>{const db=await AriadneContentDatabase.open(name);try{return await new Promise((resolve,reject)=>{const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}finally{db.close();}};
  const attachments=await all('ariadne-conversation-attachments-v1','turns');const file=attachments[0].files[0].file;
  return {applications:await all('ariadne-job-applications-v1','applications'),file:{name:file.name,lastModified:file.lastModified,text:await file.text()}};
 });
 assert.equal(old.applications[0].note,'旧备注完整保留');assert.deepEqual(old.file,{name:'原始附件.md',lastModified:123,text:'  旧附件\n'});
 // Exercise real attachment controls/consent/persistence with an explicit
 // synthetic runtime. No model connection or model qualification is claimed.
 await page.evaluate(()=>{window.__qaRuntime={mode:'model',provider:'codex',model:'gpt-5.6-sol'};window.JobRadarRuntimeGate={authority:()=>({runtime:window.__qaRuntime})};});
 await page.locator('#personal-conversation-form input[type=file]').setInputFiles({name:'新附件.md',mimeType:'text/markdown',buffer:Buffer.from('  本轮新附件\n')});
 const consentError=await page.evaluate(()=>AriadneConversationAttachments.prepare({request_id:'new-attachment',runtime_snapshot:window.__qaRuntime},'PERSONAL').then(()=>null,e=>e.message));
 assert.equal(consentError,'attachment_consent_required');
 await page.locator('#personal-conversation-form .v1-attachment-consent input').check();
 const prepared=await page.evaluate(async()=>{const request={request_id:'new-attachment',runtime_snapshot:window.__qaRuntime};const prepared=await AriadneConversationAttachments.prepare(request,'PERSONAL');AriadneConversationAttachments.stage(request,'MODEL_REQUEST');AriadneConversationAttachments.dispatch(request);const dispatched={cards:document.querySelectorAll('#personal-conversation-form [data-attachment-list] li').length,status:document.querySelector('#personal-conversation-form .v1-attachment-status').textContent};AriadneConversationAttachments.finish(request,false);const db=await AriadneContentDatabase.open('ariadne-conversation-attachments-v1');try{const saved=await new Promise((resolve,reject)=>{const q=db.transaction('turns').objectStore('turns').get(request.request_id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});return {domain:saved.domain,authority:saved.authority,text:await saved.files[0].file.text(),files:prepared.attachments.files.length,consent:prepared.attachments.consent.confirmed,dispatched};}finally{db.close();}});
 assert.deepEqual(prepared,{domain:'PERSONAL',authority:'SOURCE_INPUT_ONLY',text:'  本轮新附件\n',files:1,consent:true,dispatched:{cards:0,status:'本轮已发送 1 个附件给 Codex；正在等待模型理解与回复…'}});
 assert.equal(await page.locator('#personal-conversation-form [data-attachment-list] li').count(),1,'failed turn retains selected attachment');
 assert.equal(await page.locator('#personal-conversation-form .v1-attachment-consent input').isChecked(),false,'restored attachment requires fresh transfer confirmation');
 const pages=[];
 for(const url of ['local-first.html','local-jobs.html','career-evidence.html','career-profile.html']){
  await page.goto(base+'/'+url);await page.waitForFunction(()=>window.AriadneContentDatabase);
  await page.evaluate(()=>{window.AriadneProduct ||= {kind:'skill',storage:'filesystem'};});
  const info=await page.evaluate(async()=>{const db=await AriadneContentDatabase.open('job-radar-local-first-v1');const storage=db.storage;db.close();return {storage,title:document.title};});assert.equal(info.storage,'MARKDOWN_FILES');pages.push({url,...info});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(modelRequests,[]);
 const report={checks:['historical application and nested attachment migration','real attachment controls, immediate dispatch receipt, durable file, failed turn restoration','four historical pages use shared Markdown boundary'],pages,errors,modelRequests};
 await fs.writeFile(path.join(output,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();
}finally{await browser.close();}
