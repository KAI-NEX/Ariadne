// Isolated browser data only; endpoint responses below are explicit test doubles.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ARIADNE_PLAYWRIGHT_PACKAGE || 'playwright');
const base=process.env.ARIADNE_QA_URL || 'http://127.0.0.1:8022';
const out=`.cache/model-selection-20260910/browser-${Date.now()}`;fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const errors=[],posts=[];let dialogs=0;
context.on('page',page=>{page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{dialogs++;await dialog.accept();});});
const page=await context.newPage();
const trigger=p=>p.locator('.v1-model-trigger');
async function open(p){await trigger(p).click();await p.locator('[data-model-choice] option').first().waitFor({state:'attached'});}
async function choose(p,effort,action='apply'){await open(p);await p.locator('[data-parameter="reasoning_effort"]').selectOption(effort);await p.locator(`[data-model-${action}]`).click();await p.waitForFunction(()=>!document.querySelector('.v1-model-panel').matches(':popover-open'));}
try {
  await page.goto(base+'/personal-understanding.html');
  await page.evaluate(()=>localStorage.setItem('job-radar-selected-runtime',JSON.stringify({mode:'model',provider:'codex',model:'gpt-5.6-sol'})));
  await page.reload();await trigger(page).filter({hasText:'Sol · 中'}).waitFor();
  await choose(page,'low');assert.equal(await trigger(page).textContent(),'Sol · 低');
  await page.reload();assert.equal(await trigger(page).textContent(),'Sol · 低');
  const other=await context.newPage();await other.goto(base+'/job-overview.html');
  assert.equal(await trigger(other).textContent(),'Sol · 中');
  const same=await context.newPage();await same.goto(base+'/personal-understanding.html');assert.equal(await trigger(same).textContent(),'Sol · 低');
  await open(page);await choose(other,'high','default');
  await page.locator('[data-model-apply]').click();await page.locator('[data-model-error]').filter({hasText:'另一页面'}).waitFor();
  assert.equal(await trigger(page).textContent(),'Sol · 低');
  await page.locator('[data-model-close]').click();
  await open(page);await page.locator('[data-model-inherit]').click();await trigger(page).filter({hasText:'Sol · 高'}).waitFor();
  await choose(page,'low');await same.waitForFunction(()=>document.querySelector('.v1-model-trigger').textContent==='Sol · 低');
  await open(page);await page.locator('[data-model-choice]').selectOption('deepseek/deepseek-v4-flash-vision-exp');
  assert.equal(await page.locator('[data-model-parameters] select').count(),0);
  await page.locator('[data-model-close]').click();
  await page.locator('textarea').fill('Synthetic settings QA input');
  await page.locator('input[type=file]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic attachment only')});
  await page.locator('.v1-attachment-consent input').check();
  await choose(page,'medium');assert.equal(await page.locator('.v1-attachment-consent input').isChecked(),false);
  assert.equal(await page.locator('textarea').inputValue(),'Synthetic settings QA input');assert.equal(await page.locator('.v1-attachment-name').textContent(),'synthetic.txt');
  await page.locator('.v1-attachment-consent input').check();
  await page.locator('#personal-model-consent').check();
  await page.route('**/api/personal-understanding-turn',async route=>{posts.push(route.request().postDataJSON());await route.fulfill({status:502,json:{error:'SYNTHETIC_PROVIDER_FAILURE'}});});
  await page.locator('button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('form').getAttribute('aria-busy')==='false');
  assert.equal(posts.length,1);assert.equal(posts[0].runtime_snapshot.execution_settings.effective_settings.reasoning_effort,'medium');
  assert.equal(posts[0].attachments.files.length,1);assert.ok(dialogs>0);
  assert.equal(await page.locator('textarea').inputValue(),'Synthetic settings QA input');assert.equal(await page.locator('.v1-attachment-name').textContent(),'synthetic.txt');
  // An old frozen request must not reach the network after a setting change.
  await choose(page,'low');
  const changed=await page.evaluate(async old=>{try{await AriadneConnector.fetch('/api/personal-understanding-turn',{method:'POST',body:JSON.stringify(old)});return 'sent';}catch(error){return error.code||error.message;}},posts[0]);
  assert.equal(changed,'RUNTIME_SELECTION_CHANGED');assert.equal(posts.length,1);
  // During preparation the menu is disabled, not only during the HTTP request.
  await page.evaluate(()=>AriadneConversationUI.setExecutionState({form:document.querySelector('form'),active:true}));
  await trigger(page).waitFor({state:'visible'});assert.equal(await trigger(page).isDisabled(),true);
  await page.evaluate(()=>AriadneConversationUI.setExecutionState({form:document.querySelector('form'),active:false}));
  await page.locator('.v1-attachment-remove').click();
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});await open(page);
    const geometry=await page.evaluate(()=>{const p=document.querySelector('.v1-model-panel').getBoundingClientRect(),t=document.querySelector('.v1-model-trigger').getBoundingClientRect();return {left:p.left,right:p.right,top:p.top,bottom:p.bottom,viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,triggerHeight:t.height,bg:getComputedStyle(document.querySelector('.v1-model-trigger')).backgroundColor};});
    assert.ok(geometry.left>=0&&geometry.right<=width&&geometry.top>=0&&geometry.bottom<=900,JSON.stringify(geometry));assert.equal(geometry.overflow,false);assert.equal(geometry.bg,'rgba(0, 0, 0, 0)');
    await page.screenshot({path:`${out}/personal-${width}.png`,fullPage:true});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('.v1-model-trigger').getAttribute('aria-expanded')==='false');
  }
  // All six physical composers use the same control. Empty/demo domain data is not rewritten.
  for(const path of ['personal-import.html','candidate-detail.html','jd-import.html','job-detail.html','personal-understanding.html','job-overview.html']){
    const p=await context.newPage();await p.goto(base+'/'+path);await p.locator('.v1-model-trigger').waitFor({state:'attached'});
    assert.equal(await p.locator('.v1-model-trigger').count(),1,path);await p.close();
  }
  // A real synthetic Candidate source restores its stable shared conversation scope.
  const candidate=await context.newPage();await candidate.goto(base+'/personal-import.html');
  await candidate.evaluate(async()=>{const db=await JobRadarV1Demo.openDatabase();db.close();});
  await candidate.addScriptTag({path:'tests/candidate_conversation_browser_seed.js'});
  await candidate.waitForFunction(()=>document.body.dataset.syntheticSeed==='ready');
  const sid='source-candidate-2be6d6da68890275650734a5882d0cd7ce1260e01af210c29f3aad5f620194bf';
  await candidate.evaluate(async sid=>{
    localStorage.setItem("job-radar-selected-runtime",JSON.stringify({mode:"model",provider:"codex",model:"gpt-5.6-sol"}));
    const T=AriadneTruthPersistence,db=await T.openDatabase();
    const list=await new Promise(r=>{const q=db.transaction('candidate_working_models').objectStore('candidate_working_models').getAll();q.onsuccess=()=>r(q.result);});
    const w=list.find(item=>item.source_document_id===sid);
    await T.persistRecord(db,'context_proposals',{contract_id:'ariadne-context-proposal-v1',proposal_id:w.proposal_ids[0],proposal_type:'CANDIDATE_CONTEXT',source_document_ids:[sid],processing_run_id:w.processing_run_id,runtime_snapshot_id:w.runtime_snapshot_id,created_at:w.created_at,payload:{contract_id:'ariadne-model-candidate-proposal-payload-v1',items:w.payload.items},grounding_refs:[{source_document_id:sid,location:'p. 1',excerpt_or_reference:'Synthetic only'}],warnings:[],uncertainties:[],status:'AWAITING_REVIEW',authority:T.AUTHORITY.proposal});db.close();
  },sid);
  await candidate.reload();await candidate.locator('#saved-candidate-source-trigger').click();await candidate.locator(`[data-saved-candidate-source="${sid}"]`).click();await candidate.locator('#start-personal-processing').filter({hasText:'查看工作区'}).click();
  await trigger(candidate).waitFor({state:'visible'});await choose(candidate,'low');
  const scoped=await candidate.evaluate(()=>AriadneCandidateWorkspaceConversationRuntime.createRuntimeSnapshot());
  assert.ok(scoped.execution_settings.scope);assert.equal(scoped.execution_settings.effective_settings.reasoning_effort,'low');
  await candidate.screenshot({path:`${out}/candidate-workspace.png`,fullPage:true});
  const home=await context.newPage();await home.goto(base+'/index.html');await home.waitForFunction(()=>document.getElementById('runtime-selected').textContent.includes('GPT Sol'));
  await home.screenshot({path:`${out}/home.png`,fullPage:true});
  // A machine's initial hint must not overwrite an explicit in-app default.
  await open(page);await page.locator('[data-model-choice]').selectOption('deepseek/deepseek-v4-flash-vision-exp');await page.locator('[data-model-default]').click();
  const hint=await context.newPage();await hint.route('**/api/runtime-options',async route=>{const response=await route.fetch(),data=await response.json();data.local_preference={id:'local-codex-v1',provider:'codex',model:'gpt-5.6-sol'};await route.fulfill({json:data});});
  await hint.goto(base+'/index.html');await hint.waitForFunction(()=>document.getElementById('runtime-selected').textContent.includes('DeepSeek Vision'));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({six_composers:true,scoped_refresh:true,multi_tab_conflict:true,default_isolation:true,unsupported_effort_hidden:true,consent_invalidated:true,failed_input_and_attachments_preserved:true,stale_request_zero_post:true,actual_scoped_candidate:true,desktop_mobile_keyboard:true,errors,provider_calls:0},null,2));
  console.log(out);
}finally{await browser.close();}
