import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const Applications=require('../public/job-application-domain.js');
const initial=Applications.initial('canonical-job-stable-1');
assert.equal(initial.stage,'NOT_APPLIED');
let state=initial;
for(const stage of ['APPLIED','IN_PROGRESS','CLOSED']) state=Applications.next(state,{stage,outcome:stage==='CLOSED'?'RESUME_REJECTED':'',note:'用户填写'},state.revision);
assert.equal(state.history.length,3);
assert.equal(state.outcome,'RESUME_REJECTED');
assert.equal(Applications.matches(state,'ACTIVE'),false);
assert.equal(Applications.matches(state,'CLOSED'),true);
assert.equal(Applications.matches(state,'ALL'),true);
assert.equal(initial.revision,0,'updates do not mutate original records');
assert.throws(()=>Applications.next(state,{stage:'APPLIED',outcome:'',note:''},1),/其他页面/);
for(const change of [{stage:'UNKNOWN',outcome:'',note:''},{stage:'APPLIED',outcome:'RESUME_REJECTED',note:''},{stage:'CLOSED',outcome:'invented',note:''},{stage:'CLOSED',outcome:'',note:'字'.repeat(301)}]) assert.throws(()=>Applications.next(state,change,state.revision));
const reopened=Applications.next(state,{stage:'IN_PROGRESS',outcome:'',note:''},state.revision);
assert.equal(reopened.outcome,'');
assert.equal(reopened.history[2].outcome,'RESUME_REJECTED','reopening preserves past result');
assert.equal(reopened.job_context_id,initial.job_context_id);
assert.equal(Applications.matches(reopened,'ACTIVE'),true);
assert.equal(Applications.initial('second-job').revision,0);
assert.throws(()=>Applications.validate({...state,stage:'corrupt'}),/无法读取/);
const ordered=Applications.orderJobs(
  [{job_context_id:'active-a'},{job_context_id:'closed-a'},{job_context_id:'active-b'},{job_context_id:'closed-b'}],
  new Map([
    ['closed-a',Applications.next(Applications.initial('closed-a'),{stage:'CLOSED',outcome:'',note:''},0)],
    ['closed-b',Applications.next(Applications.initial('closed-b'),{stage:'CLOSED',outcome:'',note:''},0)],
  ]),
);
assert.deepEqual(ordered.map(job=>job.job_context_id),['active-a','active-b','closed-a','closed-b'],'closed jobs move to the end without disturbing order within either group');
assert.deepEqual(Applications.sourceLink({source_url:'https://jobs.example.com/opening/42?from=card'}),{href:'https://jobs.example.com/opening/42?from=card',visible:'jobs.example.com/opening/42?from=card'});
assert.equal(Applications.sourceLink({imported_from:{source_url:'https://legacy.example.com/job'}}).visible,'legacy.example.com/job');
for(const source_url of ['', 'javascript:alert(1)', 'file:///private/job', 'not a url']) assert.equal(Applications.sourceLink({source_url}),null);
const library=readFileSync(new URL('../public/jd.html',import.meta.url),'utf8');
const detail=readFileSync(new URL('../public/job-detail.html',import.meta.url),'utf8');
const pages=readFileSync(new URL('../public/v1-pages.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');
const applicationStyles=readFileSync(new URL('../public/job-application.css',import.meta.url),'utf8');
assert.doesNotMatch(library,/job-stage-dialog|job-stage-note/,'no separate stage dialog or notes editor in the library');
assert.doesNotMatch(library,/job-stage-filters|job-stage-empty/,'the library no longer exposes stage filters');
assert.match(detail,/id="job-application-notes"/);
assert.match(detail,/job-application-domain\.js/);
assert.doesNotMatch(pages,/jobStageFilter|data-job-filter/);
assert.match(pages,/JobApplications\.orderJobs\(jobs, applications\)/);
assert.match(pages,/const stageSelect = JobApplications \? `<button type="button" class="runtime-selector v1-job-stage-select"/,'interactive dropdown remains separate from the card link');
assert.match(pages,/JobApplications\?\.sourceLink\(job\)/,'validated source link is used by the card renderer');
assert.match(pages,/class="v1-job-source-link"[^>]*target="_blank" rel="noopener noreferrer"/,'source link opens independently and safely');
assert.match(applicationStyles,/\.v1-job-source-link \{[^}]*text-overflow|\.v1-job-source-link small \{[^}]*text-overflow/s,'long links are visually truncated');
assert.match(library,/job-stage-menu\.js/);
assert.match(styles,/\.v1-library-shell > \.v1-card-grid \{ margin-top: clamp\(20px, 3\.5vh, 36px\); \}/,'both libraries use the compact title-to-grid spacing');
assert.match(pages,/Number\(select\.dataset\.revision\)/,'one-click save still checks the observed revision');
const notesOnly=Applications.next(state,{stage:state.stage,outcome:'INTERVIEW_REJECTED',note:'更新反馈'},state.revision);
assert.equal(notesOnly.stage,state.stage);
assert.equal(notesOnly.history.at(-2).outcome,'RESUME_REJECTED');
console.log('job_application_transitions_history_closed_last_validation_conflicts=PASS');
