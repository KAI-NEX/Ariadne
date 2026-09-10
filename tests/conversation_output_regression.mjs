import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Output = createRequire(import.meta.url)('../public/conversation-output.js');

const measure = text => [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text)].length;
assert.deepEqual(Output.wrapText('中文 English\n\n👩🏽‍💻a', measure, 4), ['中文 E', 'ngli', 'sh', '', '👩🏽‍💻a']);
assert.throws(() => Output.wrapText(' ', measure, 4));
assert.throws(() => Output.wrapText('a'.repeat(40001), measure, 4));
assert.equal(Output.wrapText('<script>alert(1)</script>', measure, 200)[0], '<script>alert(1)</script>', 'content is text, never parsed as HTML');
assert.throws(() => Output.pdfFromJpegs([]));
assert.throws(() => Output.pdfFromJpegs([{ bytes: new Uint8Array([1]), width: 1, height: 1 }]));
// Structural byte offsets are tested without storing any source/user material.
const pages = Array.from({ length: 3 }, () => ({ bytes: new Uint8Array([255, 216, 255, 217]), width: 1240, height: 1754 }));
const pdf = Output.pdfFromJpegs(pages), text = new TextDecoder().decode(pdf);
assert.ok(text.startsWith('%PDF-1.4'));
assert.match(text, /\/Count 3/);
const start = Number(text.match(/startxref\n(\d+)/)[1]);
assert.equal(new TextDecoder().decode(pdf.slice(start, start + 4)), 'xref');
const offsets = text.slice(text.indexOf('xref\n')).matchAll(/(\d{10}) 00000 n /g);
let index = 1;
for (const match of offsets) {
  const offset = Number(match[1]);
  assert.ok(new TextDecoder().decode(pdf.slice(offset, offset + 12)).startsWith(`${index++} 0 obj`));
}
assert.equal(index, 12);
assert.throws(() => Output.pdfFromJpegs(Array(33).fill(pages[0])));
const document = { kind: 'PDF', title: '项目介绍', body: '合成项目介绍。', nodes: [], edges: [] };
assert.deepEqual(Output.fromResult({ deliverable: document, delivery_version: Output.VERSION }), document);
assert.equal(Output.fromResult({ output: {message:'普通文字'} }), null);
assert.throws(() => Output.fromResult({ deliverable: document, delivery_version: 'unknown' }));
assert.throws(() => Output.validate({ ...document, url: 'file:///private' }));
assert.throws(() => Output.validate({ ...document, body: 'x'.repeat(20001) }));
const diagram = {kind:'DIAGRAM',title:'流程图',body:'两个步骤',nodes:['理解','核对'],edges:[{from:0,to:1,label:'下一步'}]};
assert.deepEqual(Output.validate(diagram), diagram);
assert.throws(() => Output.validate({...diagram,edges:[{from:0,to:2,label:''}]}));
assert.throws(() => Output.validate({...diagram,edges:[{from:true,to:0,label:''}]}));
assert.throws(() => Output.validate({...diagram,edges:[...diagram.edges,...diagram.edges]}));
assert.match(Output.historyText({message:'文件如下',deliverable:document}), /非确认资料/);
assert.equal(Output.historyText({text:'普通文字'}), '普通文字');
assert.equal(Output.documentText({...document,body:'项目介绍\n\n正文'}),'项目介绍\n\n正文');
assert.equal(Output.documentText(document),'项目介绍\n\n合成项目介绍。');
console.log('conversation output: wrapping, Unicode, bounds, inert text, multipage PDF byte offsets PASS');
