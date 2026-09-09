import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const attachments=require('../public/conversation-attachments.js');
assert.equal(attachments.CONTRACT,'ariadne-conversation-attachments-v1');
assert.equal(attachments.validateFiles([{name:'CV.docx',size:30000000}]).length,1);
assert.throws(()=>attachments.validateFiles([{name:'CV.docx',size:30000001}]));
assert.throws(()=>attachments.validateFiles(Array.from({length:5},()=>({name:'image.png',size:1}))));
assert.throws(()=>attachments.validateFiles([{name:'macro.docm',size:1}]));
for(const name of ['personal-import','candidate-detail','jd-import','job-detail','personal-understanding','job-overview']) {
 const html=fs.readFileSync(new URL(`../public/${name}.html`,import.meta.url),'utf8');
 assert.equal(html.match(/src="\/conversation-attachments.js"/g)?.length,1);
 assert.ok(html.indexOf('/conversation-attachments.js') < html.indexOf('</body>'));
}
const pages=fs.readFileSync(new URL('../public/v1-pages.js',import.meta.url),'utf8');
assert.match(pages,/\["PDF", "IMAGE", "DOCX"\]\.includes\(source.source_type\)/);
assert.match(pages,/\["PDF", "IMAGE", "DOCX"\]\.includes\(selectedCandidateSources\[0\]\?\.source_type\)/);
for(const domain of ['CANDIDATE','JOB']) assert.ok(pages.includes(`attachments.prepare(request, "${domain}")`));
for(const [file,domain] of [['personal-understanding-domain.js','PERSONAL'],['job-overview-domain.js','JOB_OVERVIEW']]) {
 const text=fs.readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
 assert.ok(text.includes(`attachments.prepare(request, "${domain}")`));
 assert.ok(text.includes('attachments?.finish(request, false, error)'));
}
console.log('shared_attachment_controls_limits_and_all_routes=PASS');
