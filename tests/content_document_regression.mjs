import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Content = require("../public/content-document.js");
const Demo = require("../public/v1-demo-domain.js");

const records = [
  ...Demo.CANDIDATE_FIXTURES, Demo.JOB_FIXTURE,
  { revision_id: "same-title-1", version: 2, previous_revision_id: "v1", authority: "HUMAN_CONFIRMED",
    payload: { title: "\n 原件 ` ``` ````` \r\n", summary: "首行\n\n尾行\n", facts: [
      { fact_id: "f1", label: "", value: " ", other_unknown_field: "keep this too" },
    ], uncertainties: ["未知，不等于缺少能力", ""], nested: { text: "## heading\n---\n__proto__" } },
    provenance: { source_document_ids: ["s2", "s1"], location: "第 2 页" }, unknown: { number: 0, flag: false, empty: [], nil: null } },
  { revision_id: "memory", text: "我想从事设计工作", state: "RETRACTED", history: [{ text: "原自述" }] },
];
for (const record of records) {
  const markdown = Content.encode(record);
  assert.deepEqual(Content.decode(markdown), record);
  assert.match(markdown, /^---\n/);
  const metadata = JSON.parse(markdown.slice(4, markdown.indexOf("\n---\n", 4)));
  if (record.payload?.summary) assert.equal(metadata.record.payload.summary, null, "semantic text must not also live in metadata");
  assert.throws(() => Content.decode(markdown + "unmapped paragraph"), /UNMAPPED/);
}
const original = records[records.length - 2];
const packed = Content.pack("candidate_context_revisions", "revision_id", original);
assert.deepEqual(Object.keys(packed), ["revision_id", "content_format", "markdown"]);
assert.deepEqual(Content.unpack("candidate_context_revisions", "revision_id", packed), original);
assert.throws(() => Content.unpack("candidate_context_revisions", "revision_id", { ...packed, revision_id: "different" }), /ID_MISMATCH/);
assert.equal(Content.pack("runtime_snapshots", "snapshot_id", original), original);
const edited = packed.markdown.replace("首行", "人工卡片修改");
assert.equal(Content.decode(edited).payload.summary, "人工卡片修改\n\n尾行\n");
assert.deepEqual(Content.decode(edited).provenance, original.provenance);
assert.throws(() => Content.decode(edited.replace("## payload / summary", "## unbound")), /SECTION_INVALID/);
const hostile = '---\n' + JSON.stringify({format:Content.FORMAT,record:{},fields:[["__proto__","text"]],fence:"```"}) + '\n---\n';
assert.throws(() => Content.decode(hostile), /PATH_INVALID/);
assert.equal({}.text, undefined);
console.log("PASS content documents: lossless prose, identity, unknown fields, origin order, strict edits");
