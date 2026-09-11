// Optional browser QA. Use the available Playwright runtime; start an isolated app
// server on 8028 first. A fresh browser context contains synthetic records only.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const output=path.resolve('.cache/job-stage-menu-20260912');await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
    const errors=[],posts=[];
    page.on('pageerror',error=>errors.push(error.message));
    context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
    context.on('request',request=>{if(request.method()==='POST')posts.push(request.url());});
    const base='http://127.0.0.1:8028',jobId='qa-chip-ai-pm',select=`[data-job-stage="${jobId}"]`;
    const choose=async(stage)=>{await page.click(select);await page.click(`[data-stage-option="${stage}"]`);};
    const shot=async(p,name,options={})=>{
      await p.evaluate(()=>Promise.all(document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).map(animation=>animation.finished.catch(()=>{}))));
      await p.screenshot({path:output+'/'+name,...options});
    };
    const record=()=>page.evaluate(async id=>(await AriadneJobApplications.all()).get(id),jobId);
    const source=()=>page.evaluate(()=>JobRadarV1Demo.getAll(JobRadarV1Demo.DEMO_STORES.jobs));
    await page.goto(base+'/jd.html');await page.waitForSelector('[data-job-filter="ACTIVE"]');
    await page.evaluate(async()=>{const D=JobRadarV1Demo;for(const [id,title] of [['qa-chip-ai-pm','AI 产品经理'],['qa-chip-design','体验设计师']])await D.put(D.DEMO_STORES.jobs,{...D.clone(D.JOB_FIXTURE),job_context_id:id,title,company:'合成测试公司',copy_locale:'zh-CN'});});
    const original=await source();await page.reload();await page.waitForSelector(select);
    assert.equal(await page.locator('#job-stage-dialog').count(),0);
    assert.equal(await page.locator('[data-job-filter="NOT_APPLIED"]').count(),0);
    assert.deepEqual(await page.locator('[data-stage-option]').allTextContents(),['未投递','已投递','推进中','已结束']);
    await page.click(select);await shot(page,'menu-desktop.png');
    assert.equal(await page.locator(select).getAttribute('aria-expanded'),'true');
    assert.match(await page.locator(select+' .runtime-chevron').evaluate(node=>getComputedStyle(node).transform),/matrix\(-1, 0, 0, -1/);
    await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.stageOption),'CLOSED');
    await page.keyboard.press('Escape');assert.equal(await page.locator(select).getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator(select).evaluate(node=>node.closest('a')),null);
    const switchStage=async(stage)=>{
      await choose(stage);
      await page.waitForFunction(({id,stage})=>document.querySelector(`[data-job-stage="${id}"]`)?.dataset.stage===stage&&!document.querySelector(`[data-job-stage="${id}"]`).disabled,{id:jobId,stage});
      assert.equal((await record()).stage,stage);
      assert.equal(await page.locator('.v1-detail-overlay:not(.hidden)').count(),0);
    };
    await switchStage('APPLIED');await switchStage('IN_PROGRESS');
    await choose('CLOSED');await page.waitForSelector(select,{state:'hidden'});
    await page.reload();await page.waitForSelector('[data-job-filter="CLOSED"]');assert.equal(await page.locator(select).count(),0);
    await page.click('[data-job-filter="CLOSED"]');await page.waitForSelector(select);assert.equal((await record()).stage,'CLOSED');
    await shot(page,'closed-desktop.png');
    await page.click(`[data-transition-key="job:${jobId}"]`);await page.waitForSelector('.v1-detail-overlay:not(.hidden)');
    const frame=page.frameLocator('.v1-detail-overlay iframe');
    await frame.locator('#job-application-note:not([disabled])').waitFor();
    assert.equal(await frame.locator('#job-application-stage').textContent(),'已结束');
    await frame.locator('#job-application-outcome').selectOption('RESUME_REJECTED');
    await frame.locator('#job-application-note').fill('简历未通过，暂不跟进。');
    await frame.locator('#job-application-form button[type=submit]').click();
    await frame.locator('#job-application-message').filter({hasText:'已保存'}).waitFor();
    assert.equal((await record()).note,'简历未通过，暂不跟进。');
    assert.equal((await record()).outcome,'RESUME_REJECTED');
    assert.equal(await page.locator(`[data-transition-key="job:${jobId}"]`).count(),1,'source card stays mounted while the overlay is open');
    await frame.locator('#job-application-note').fill('不保存这段');await frame.locator('#job-application-cancel').click();
    await page.waitForFunction(()=>document.querySelector('.v1-detail-overlay iframe').contentDocument.getElementById('job-application-note').value==='简历未通过，暂不跟进。');
    await frame.locator('#job-application-form').scrollIntoViewIfNeeded();await shot(page,'notes-desktop.png');
    await page.click('.v1-detail-overlay-close');await page.waitForSelector('.v1-detail-overlay.hidden',{state:'attached'});
    await page.waitForFunction(()=>!document.body.classList.contains('v1-detail-overlay-open'));
    assert.equal(await page.locator('#job-card-grid').textContent().then(text=>text.includes('简历未通过')),false,'notes are not displayed in the library');
    await page.click('[data-job-filter="ALL"]');await page.waitForSelector(select);await switchStage('IN_PROGRESS');
    assert.equal((await record()).note,'简历未通过，暂不跟进。');assert.equal((await record()).outcome,'');
    assert.ok((await record()).history.some(item=>item.outcome==='RESUME_REJECTED'));
    // Simulate a transaction abort in the card path; selected value rolls back.
    await page.evaluate(()=>{window.qaTransaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args){const tx=qaTransaction.apply(this,args);if(this.name===AriadneJobApplications.DB_NAME&&args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};});
    await choose('APPLIED');await page.waitForFunction(()=>document.getElementById('job-page-message').classList.contains('error'));
    await page.evaluate(()=>{IDBDatabase.prototype.transaction=qaTransaction;});
    assert.equal((await record()).stage,'IN_PROGRESS');assert.equal(await page.locator(select).getAttribute('data-stage'),'IN_PROGRESS');
    // Independent detail page: explicit save, concurrent update, failed save and retry.
    const second=await context.newPage();await second.goto(base+`/job-detail.html?job=${jobId}`);await second.waitForSelector('#job-application-note:not([disabled])');
    await second.fill('#job-application-note','保留我的未保存输入');
    await switchStage('APPLIED');
    await second.waitForFunction(()=>document.getElementById('job-application-message').textContent.includes('其他页面'));
    assert.equal(await second.locator('#job-application-note').inputValue(),'保留我的未保存输入');
    await second.click('#job-application-form button[type=submit]');await second.waitForFunction(()=>document.getElementById('job-application-message').classList.contains('error')&&!document.querySelector('#job-application-form button[type=submit]').disabled);
    assert.equal((await record()).stage,'APPLIED');assert.equal((await record()).note,'简历未通过，暂不跟进。');
    await second.click('#job-application-cancel');await second.waitForFunction(()=>document.getElementById('job-application-stage').textContent==='已投递');
    await second.fill('#job-application-note','已确认最新进度');await second.click('#job-application-form button[type=submit]');await second.waitForFunction(()=>document.getElementById('job-application-message').textContent.includes('已保存'));
    await second.reload();await second.waitForSelector('#job-application-note:not([disabled])');assert.equal(await second.locator('#job-application-note').inputValue(),'已确认最新进度');
    assert.deepEqual(await source(),original);assert.equal(await page.evaluate(async()=> (await AriadneJobApplications.all()).has('qa-chip-design')),false);
    await page.reload();await page.waitForSelector(select);await shot(page,'active-desktop.png');
    const alignment=await page.locator(select).evaluate(node=>{const a=node.getBoundingClientRect(),b=node.parentElement.getBoundingClientRect();return {left:a.left-b.left,top:a.top-b.top,width:a.width,gap:getComputedStyle(node).gap};});
    assert.equal(alignment.left,22);assert.equal(alignment.top,24);assert.ok(alignment.width<90);assert.equal(alignment.gap,'8px');
    assert.equal(await page.locator(select).evaluate(node=>getComputedStyle(node).borderRadius),'999px','retain the original card label silhouette');
    await page.setViewportSize({width:390,height:844});await shot(page,'active-mobile.png',{fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.click(select);await shot(page,'menu-mobile.png');await page.keyboard.press('Escape');
    await page.emulateMedia({reducedMotion:'reduce'});await page.click(select);assert.equal(await page.locator(select+' .runtime-chevron').evaluate(node=>getComputedStyle(node).transitionDuration),'0s');await page.keyboard.press('Escape');
    await second.setViewportSize({width:390,height:844});await second.locator('#job-application-form').scrollIntoViewIfNeeded();await shot(second,'notes-mobile.png');
    assert.equal(await second.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
    const result={checks:['animated four-option chip','arrow rotation','keyboard End/Escape','reduced motion','same-page filters','one-step save','no detail opened by stage','closed/reload/filter','embedded notes save/cancel','source card return','reopen preserves notes/history','storage abort rollback','cross-page dirty conflict and retry','standalone detail reload','source records unchanged','desktop/mobile alignment'],alignment,record:await record(),errors,posts};
    await fs.writeFile(output+'/browser-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
