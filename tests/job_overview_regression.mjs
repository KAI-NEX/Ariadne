import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const Truth = require("../public/truth-persistence-domain.js");
const Job = require("../public/job-context-domain.js");
const Domain = require("../public/job-overview-domain.js");
const Personal = require("../public/personal-understanding-domain.js");
const Candidate = require("../public/job-candidate-context-domain.js");
const runtime = Domain.runtimeSnapshot({getItem:key=>key === "job-radar-selected-runtime" ? JSON.stringify({mode:"model",provider:"deepseek",model:"deepseek-v4-flash-vision-exp"}) : null});
function databaseFor(input = {}) {
  const specs = new Map([...Truth.STORE_SPECS, { name: "career_entities", keyPath: "entity_id" }, { name: "career_evidence", keyPath: "evidence_id" }].map((entry) => [entry.name, entry.keyPath]));
  const data = new Map([...specs].map(([name]) => [name, new Map((input[name] || []).map((entry) => [entry[specs.get(name)], structuredClone(entry)]))]));
  return {
    data, objectStoreNames: { contains: (name) => data.has(name) },
    transaction(names, mode = "readonly") {
      const stores = Array.isArray(names) ? names : [names];
      const pending = new Map(stores.map((name) => [name, new Map(data.get(name))]));
      let count = 0, timer, aborted = false;
      const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { if (aborted || count) return; if (mode === "readwrite") pending.forEach((records, name) => data.set(name, records)); tx.oncomplete?.(); }, 0); };
      const tx = {
        abort() { aborted = true; clearTimeout(timer); queueMicrotask(() => tx.onabort?.()); },
        objectStore(name) {
          return {
            getAll() { const request = {}; count++; queueMicrotask(() => { request.result = [...pending.get(name).values()].map((entry) => structuredClone(entry)); request.onsuccess?.(); count--; schedule(); }); return request; },
            add(entry) { if (pending.get(name).has(entry[specs.get(name)])) { tx.error = Object.assign(new Error("duplicate"), { name: "ConstraintError" }); tx.abort(); return; } pending.get(name).set(entry[specs.get(name)], structuredClone(entry)); schedule(); },
            put(entry) { pending.get(name).set(entry[specs.get(name)], structuredClone(entry)); schedule(); },
          };
        },
      };
      return tx;
    },
  };
}

function proposal(index, title = `Synthetic Job ${index}`, requirement = "研究与评估") {
  return Job.proposalFor({ source: {source_document_id:`source-job-${index}`}, artifact: {payload:{extracted_text:`${title}\n合成测试公司\n上海\n任职要求\n- ${requirement}`}}, structuring_run:{run_id:`run-job-${index}`,runtime_snapshot_id:"runtime-job-fixture"} });
}
function revision(index, title, requirement) {return Job.reviewOutcome({proposal:proposal(index,title,requirement),decision:"CONFIRM"}).revision;}
const a=revision(1,"用户研究产品经理","负责用户访谈和需求定义；允许远程协作"), b=revision(2,"AI 评估工程师","负责评估指标和测试框架；深圳现场办公"), pending=proposal(3,"设计研究员","负责研究计划；工作地点待确认");
const input={job_context_revisions:[a,b],context_proposals:[pending],source_documents:[1,2,3].map(i=>({source_document_id:`source-job-${i}`}))};
const snapshot=await Domain.buildSnapshot(input);
if(process.argv.includes("--request")){console.log(JSON.stringify(Domain.requestFor("DISCUSS",Domain.discussionContext(snapshot,"这些职位有什么差异？",[]),"这些职位有什么差异？",runtime,true)));process.exit(0);}
if(process.argv.includes("--seed")){console.log(JSON.stringify(input));process.exit(0);}
assert.equal(snapshot.records.length,3); assert.equal(snapshot.working_count,1);
assert.equal((await Domain.buildSnapshot({...input, candidate_context_revisions:[{private:"Candidate must stay out"}],personal_memory_revisions:[{text:"private memory"}],demo_job_contexts:[{title:"demo must stay out"}]})).fingerprint,snapshot.fingerprint);
assert.deepEqual(Domain.INPUT_STORES,["job_context_revisions","context_proposals","context_review_decisions","source_documents"]);
assert.throws(()=>Domain.runtimeSnapshot({getItem:()=>JSON.stringify({mode:"local"})}),/runtime_capability/);
assert.throws(()=>Domain.requestFor("DISCUSS",{},"x",runtime,false),/CONSENT_REQUIRED/);
const next={...a,revision_id:"job-revision-new",version:2,previous_revision_id:a.revision_id,payload:{...a.payload,title:"更新后的研究岗位"}};
const newer=await Domain.buildSnapshot({...input,job_context_revisions:[a,next,b]});assert.equal(newer.records.length,3);assert(newer.records.some(x=>x.semantic.title==="更新后的研究岗位"));assert.notEqual(newer.fingerprint,snapshot.fingerprint);
const rejected=await Domain.buildSnapshot({...input,context_review_decisions:[{proposal_id:pending.proposal_id,authority:Truth.AUTHORITY.review,decision:"REJECT"}]});assert.equal(rejected.records.length,2);
const fakeDecision=await Domain.buildSnapshot({...input,context_review_decisions:[{proposal_id:pending.proposal_id,authority:"MODEL",decision:"REJECT"}]});assert.equal(fakeDecision.records.length,3);
const oldPending={...pending,proposal_id:"old-pending",created_at:"2020-01-01T00:00:00Z"};assert.equal((await Domain.buildSnapshot({...input,context_proposals:[oldPending,pending]})).working_count,1);
const accepted=Job.reviewOutcome({proposal:pending,decision:"CONFIRM"}).revision;assert.equal((await Domain.buildSnapshot({...input,job_context_revisions:[a,b,accepted]})).working_count,0);
const personalSnapshot=await Candidate.buildSnapshot({...input,personal_memory_revisions:[]});assert.equal(personalSnapshot.provider_view.confirmed.length,0,"personal context cannot acquire Job information");
const db=databaseFor(input), writesBefore=JSON.stringify([...db.data.get("job_context_revisions").values()]); const calls=[];
async function stub(request){calls.push(request); const output=request.phase==="DISTILL" ? {summaries:request.context.evidence.map(x=>({ref:x.ref,summary:`模型替身摘要：${x.title}`}))} : {summary:"模型替身：不同岗位侧重不同。",insights:request.context.evidence.length?[{text:"模型替身有来源的说明",evidence_refs:[request.context.evidence[0].ref]}]:[],uncertainties:[]};return {contract_id:Domain.Contract.result_contract,request_id:request.request_id,phase:request.phase,runtime_snapshot_id:request.runtime_snapshot.snapshot_id,provider:runtime.provider,model:runtime.model,output,network_call_made:true,persistence:"not_written",authority:"NON_AUTHORITATIVE_JOB_OVERVIEW",usage:{prompt_tokens:10}};}
const options={runtime_snapshot:runtime,consent:true,call:stub};
assert.equal((await Domain.refresh(db,options)).calls,2);
assert.equal((await Domain.refresh(db,options)).calls,0);
const first=await Domain.discuss(db,{...options,human_message:"共同要求是什么？"});assert.equal(first.calls,1);assert.equal(first.context_coverage.included_jobs,3);
assert(Domain.discussionContext((await Domain.snapshotFromDatabase(db)),"继续说说",[first]).history[0].assistant.includes("模型替身有来源的说明"), "follow-up history includes grounded findings");
assert(calls.every(x=>!JSON.stringify(x.context).includes("Candidate must stay out")));
assert.equal(JSON.stringify([...db.data.get("job_context_revisions").values()]),writesBefore,"overview cannot edit job facts");
assert.throws(()=>Domain.write(db,"personal_memory_revisions",{}),/WRITE_SCOPE/);
db.data.get("job_context_revisions").set(next.revision_id,next);
assert.equal((await Domain.snapshotFromDatabase(db)).overview,null);
const refreshed=await Domain.refresh(db,options);assert.equal(refreshed.snapshot.overview.refreshed_fragments,1);assert.equal(refreshed.snapshot.overview.reused_fragments,2);
assert.equal(Domain.discussionContext(refreshed.snapshot,"跟进",[first]).history.length,0);
db.data.get("context_proposals").set(pending.proposal_id,{...pending,status:"REJECTED"});assert.equal((await Domain.snapshotFromDatabase(db)).overview,null);assert.equal((await Domain.snapshotFromDatabase(db)).records.length,2);
const empty=await Domain.buildSnapshot({});assert.equal(Domain.discussionContext(empty,"概况",[]).evidence.length,0);
const huge=await Domain.buildSnapshot({job_context_revisions:Array.from({length:85},(_,i)=>({...a,context_id:`job-many-${i}`,revision_id:`job-many-revision-${i}`,payload:{...a.payload,title:`Long job ${i}`,summary:"职位要求细节".repeat(1000)}}))});
const bounded=Domain.discussionContext(huge,"职位要求",[]);assert(bounded.coverage.omitted_jobs>0);assert(bounded.coverage.truncated_jobs>0);assert(new TextEncoder().encode(JSON.stringify(bounded)).length<48000);
const tiny = { ...snapshot, records: Array.from({length:80},(_,i)=>({ ...snapshot.records[0],ref:`job-${i+1}`,semantic:{title:"x",company:null,location:null,summary:null,requirements:[],uncertainties:[],authority:"CONFIRMED",source_availability:"SOURCE_SAVED"} })) };
assert.equal(Domain.discussionContext(tiny,"概况",[]).evidence.length,60,"detail selection also obeys the Provider record limit");
const staleDb=databaseFor(input);await assert.rejects(Domain.discuss(staleDb,{...options,human_message:"差异",call:async request=>{const result=await stub(request);if(request.phase==="DISCUSS")staleDb.data.get("job_context_revisions").set(next.revision_id,next);return result;}}),/CONTEXT_CHANGED/);
assert([...staleDb.data.get("job_overview_turns").values()].every(x=>x.status==="FAILED"));
const invalid=Domain.requestFor("SYNTHESIZE",{scope:Domain.Contract.scope,evidence:[{ref:"digest-1",title:"x",summary:"x"}],previous:null,traversal:{part:1,total_parts:1}},"",runtime,true);
const bad=await stub(invalid);bad.output.insights[0].evidence_refs=["unknown"];assert.throws(()=>Domain.validateResult(bad,invalid),/GROUNDING_INVALID/);
assert(readFileSync(new URL('../public/personal-understanding.html',import.meta.url),'utf8').includes('围绕过去的项目、你的职责与做事方式'));
assert(readFileSync(new URL('../public/jd.html',import.meta.url),'utf8').includes('了解职位概况'));
assert.equal(Personal.Contract.prompt_version,"ariadne-personal-understanding-prompt-v5");
const delivered={kind:"PDF",title:"职位介绍文件",body:"合成职位概要。",nodes:[],edges:[]};
const beforeDelivery=JSON.stringify([...db.data.get("job_context_revisions").values()]);
const fileTurn=await Domain.discuss(db,{...options,human_message:"制作介绍文件",call:async request=>({...await stub(request),...(request.phase==="DISCUSS"?{deliverable:delivered,delivery_version:"ariadne-conversation-delivery-v1"}:{})})});
assert.deepEqual(fileTurn.output.deliverable,delivered);
assert.deepEqual(db.data.get("job_overview_turns").get(fileTurn.turn_id).output.deliverable,delivered);
assert.equal(JSON.stringify([...db.data.get("job_context_revisions").values()]),beforeDelivery);
console.log(JSON.stringify({job_only_scope:"pass",versions_and_review:"pass",incremental_cache:"pass",read_only_and_failure:"pass",bounded_context:"pass",provider_calls:0}));
