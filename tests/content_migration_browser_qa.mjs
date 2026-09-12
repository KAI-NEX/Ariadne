// Uses synthetic records in a fresh context and an isolated local server.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createSyntheticWorkspaceRequest } from "./candidate_workspace_conversation_request_fixture.mjs";
const require = createRequire(import.meta.url), { chromium } = require("playwright");
const Truth = require("../public/truth-persistence-domain.js"), Job = require("../public/job-context-domain.js");
const base = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || "")) throw Error("disposable_local_server_required");
const output = path.resolve(process.env.ARIADNE_QA_OUTPUT || ".cache/markdown-migration-20260912/migration-browser");
await fs.mkdir(output, { recursive: true });
const working = (await createSyntheticWorkspaceRequest()).working_model;
const proposal = Truth.validateProposal({ contract_id: "ariadne-context-proposal-v1", proposal_id: working.proposal_ids[0],
  proposal_type: "CANDIDATE_CONTEXT", source_document_ids: [working.source_document_id], processing_run_id: working.processing_run_id,
  runtime_snapshot_id: working.runtime_snapshot_id, status: "AWAITING_REVIEW", created_at: working.created_at,
  payload: { ...working.payload, contract_id: "ariadne-model-candidate-proposal-payload-v1" }, grounding_refs: [{ source_document_id: working.source_document_id, location: "original", excerpt_or_reference: "Synthetic route-only candidate item." }], warnings: [], uncertainties: [], authority: Truth.AUTHORITY.proposal });
const accepted = Truth.applyWorkspaceAcceptance({ working_model: working, proposals: [proposal], expected_revision_version: 0,
  context_id: `candidate-workspace-context-${working.source_document_id}`, acceptance_id: "migration-acceptance", revision_id: "migration-candidate-v1", accepted_at: working.created_at });
const jobPayload = Job.validateJobPayload({ contract_id: Job.PAYLOAD_CONTRACT, title: "合成设计职位", company: "合成公司", location: "上海",
  summary: "负责产品设计。\n保留第二行。", requirements: [{ requirement_id: "migration-requirement", label: "研究", detail: "能开展用户研究", grounding_refs: [], content_origin: "HUMAN_CONFIRMED" }],
  source_document_ids: ["migration-job-source"], source_url: "https://example.test/migration", source_availability: "STRUCTURED_ONLY",
  field_provenance: Object.fromEntries(Job.EDITABLE_FIELDS.map(key => [key, "HUMAN_CONFIRMED"])), uncertainties: ["团队规模未知"] });
const jobRevision = Truth.validateContextRevision({ contract_id: "ariadne-context-revision-v1", context_id: "migration-job", context_type: "JOB",
  revision_id: "migration-job-v1", version: 1, payload: jobPayload, previous_revision_id: null, confirmed_from_proposal_id: "migration-job-proposal",
  review_decision_id: "migration-job-review", created_at: working.created_at, authority: Truth.AUTHORITY.revision,
  provenance: { source_document_ids: ["migration-job-source"], processing_run_id: "migration-job-run", runtime_snapshot_id: "migration-job-runtime" } });
const seed = { context_proposals: [proposal], candidate_working_models: [working], candidate_workspace_acceptances: [accepted.workspace_acceptance],
  candidate_context_revisions: [accepted.revision], job_context_revisions: [jobRevision],
  personal_memory_revisions: [{ revision_id: "migration-memory", contract_id: "ariadne-personal-memory-revision-v1", memory_id: "migration-memory", version: 1, status: "ACTIVE", kind: "PREFERENCE", related_identities: [], decision_id: "migration-memory-decision",
    text: "合成偏好：希望保留设计工作", authority: "HUMAN_CONFIRMED_PERSONAL_MEMORY", created_at: working.created_at }],
};
// Memory and model semantic schemas are tested separately; this record is used
// only to test that unknown historical fields survive storage without coercion.
const browser = await chromium.launch({ channel: "chrome", headless: true });
const evidence = { checks: [], errors: [], modelRequests: [] };
let activePage;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  activePage = page;
  context.on("page", p => p.on("pageerror", error => evidence.errors.push(error.message)));
  page.on("pageerror", error => evidence.errors.push(error.message));
  let failCommit = false, corruptClaim = false;
  await context.route("**/api/workspace", route => {
    if (route.request().method() !== "POST" || route.request().postDataJSON()?.action !== "commit") return route.continue();
    if (failCommit) return route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"WORKSPACE_STORAGE_UNAVAILABLE"}' });
    if (corruptClaim) {
      const payload = route.request().postDataJSON();
      const write = payload.writes.find(row => row.value?.source_document_id === "legacy-learning-source");
      if (write) write.value.content_hash = "0".repeat(64);
      return route.continue({ postData: JSON.stringify(payload) });
    }
    return route.continue();
  });
  context.on("request", request => { if (request.method() === "POST" && /(?:conversation-turn|understanding-turn|overview-turn|model-structure)$/.test(new URL(request.url()).pathname)) evidence.modelRequests.push(request.url()); });
  await page.goto(base + "/index.html");
  for (const script of ["v1-demo-domain.js", "truth-persistence-domain.js", "raw-source-storage-domain.js"]) await page.addScriptTag({ url: base + "/" + script });
  await page.evaluate(async ({ seed, sourceId }) => {
    localStorage.setItem("job-radar-selected-runtime", JSON.stringify({ mode: "local" }));
    const db = await JobRadarV1Demo.openDatabase();
    try {
      for (const [name, records] of Object.entries(seed)) await new Promise((resolve, reject) => {
        const tx = db.transaction(name, "readwrite"); for (const record of records) tx.objectStore(name).add(record);
        tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error);
      });
      const file = new File(["  Original synthetic material\n\n "], "合成经历.md", { type: "text/markdown", lastModified: 1234 });
      const source = { contract_id: "ariadne-source-document-v1", source_document_id: sourceId, source_type: "MARKDOWN", filename: file.name,
        label: null, mime_type: file.type, content_hash: await AriadneRawSourceStorage.sha256Blob(file), created_at: "2026-09-03T08:00:00Z",
        material_type: "CANDIDATE", local_reference: AriadneRawSourceStorage.localReferenceFor(sourceId), batch_id: null, provenance: {}, authority: AriadneTruthPersistence.AUTHORITY.source };
      await AriadneRawSourceStorage.persistDurableSource(db, source, file);
      const legacy = { source_document_id: "legacy-learning-source", original_filename: file.name,
        content_hash: source.content_hash.slice(7), byte_size: file.size, document_type: "resume", media_type: file.type,
        file_blob: file, extraction_method: "utf8_text_v0", extracted_pages: [], model_call_made: false,
        unknown_note: "  Historical wording\n\n " };
      await new Promise((resolve, reject) => { const tx = db.transaction("source_documents", "readwrite"); tx.objectStore("source_documents").add(legacy); tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error); });
    } finally { db.close(); }
  }, { seed, sourceId: working.source_document_id });
  const read = names => page.evaluate(async names => {
    const db = await AriadneTruthPersistence.openDatabase();
    try { return await Promise.all(names.map(name => new Promise((resolve, reject) => { const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }))); }
    finally { db.close(); }
  }, names);
  // Failed migration keeps the original browser records and never activates disk.
  failCommit = true;
  await page.goto(base + "/personal-information.html");
  await page.waitForFunction(() => document.body.textContent.includes("无法") || document.body.textContent.includes("WORKSPACE_STORAGE_UNAVAILABLE"));
  const backupCount = await page.evaluate(() => new Promise((resolve, reject) => { const r = indexedDB.open("job-radar-local-first-v1", 17); r.onsuccess = () => { const db = r.result, q = db.transaction("candidate_context_revisions").objectStore("candidate_context_revisions").getAll(); q.onsuccess = () => { resolve(q.result.length); db.close(); }; }; r.onerror = () => reject(r.error); }));
  assert.equal(backupCount, 1);
  failCommit = false; corruptClaim = true;
  for (const pathname of ["/personal-information.html", "/jd.html", "/workspace.html"]) {
    await page.goto(base + pathname);
    await page.waitForFunction(() => document.body.textContent.includes("文件内容与保存记录不一致"));
    assert.equal(await page.locator("body").innerText().then(text => text.includes("操作未完成，请重试")), false);
    if (pathname === "/workspace.html") {
      assert.equal(await page.locator("#workspace-personal-count").innerText(), "暂时无法读取");
      assert.equal(await page.locator("#workspace-job-count").innerText(), "暂时无法读取");
      await page.screenshot({ path: path.join(output, "workspace-integrity-error.png"), fullPage: true });
    }
  }
  const notActivated = await page.evaluate(async () => (await (await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", workspace: localStorage.getItem(AriadneContentDatabase.WORKSPACE_KEY), database: "job-radar-local-first-v1" }) })).json()).initialized);
  assert.equal(notActivated, false, "real digest mismatch must not activate partial migration");
  evidence.checks.push("true hash mismatch blocks atomically; personal, Job and home expose the storage cause, never fake empty data");
  corruptClaim = false; await page.goto(base + "/personal-information.html");
  await page.waitForSelector('[data-transition-key="candidate:item-edu-001"]');
  const migrated = await read(Object.keys(seed));
  for (let i = 0; i < migrated.length; i++) assert.deepEqual(migrated[i], seed[Object.keys(seed)[i]]);
  evidence.checks.push("failed migration leaves browser backup; retry copies every field, ID and authority unchanged");
  evidence.workspace = await page.evaluate(() => localStorage.getItem(AriadneContentDatabase.WORKSPACE_KEY));
  const restored = await page.evaluate(async source => { const db = await AriadneTruthPersistence.openDatabase(); try { const raw = await AriadneRawSourceStorage.resolveRawSource(db, source); return { text: await raw.file.text(), name: raw.file.name, hash: raw.source_document.content_hash }; } finally { db.close(); } }, working.source_document_id);
  assert.equal(restored.text, "  Original synthetic material\n\n "); assert.equal(restored.name, "合成经历.md");
  evidence.checks.push("durable original restores exact bytes, filename and hash from disk");
  const legacyCopy = await page.evaluate(async () => {
    const load = db => new Promise((resolve, reject) => { const r = db.transaction("source_documents").objectStore("source_documents").get("legacy-learning-source"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const db = await AriadneTruthPersistence.openDatabase();
    const native = await new Promise((resolve, reject) => { const r = indexedDB.open("job-radar-local-first-v1"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try {
      const serialize = async row => ({ ...row, file_blob: { bytes: Array.from(new Uint8Array(await row.file_blob.arrayBuffer())), name: row.file_blob.name, type: row.file_blob.type, lastModified: row.file_blob.lastModified } });
      return [await serialize(await load(db)), await serialize(await load(native))];
    } finally { db.close(); native.close(); }
  });
  assert.deepEqual(legacyCopy[0], legacyCopy[1]);
  assert.match(legacyCopy[0].content_hash, /^[a-f0-9]{64}$/);
  evidence.checks.push("bare-hash learning source and prefixed canonical source migrate together; original bytes, hash spelling, unknown fields and browser backup unchanged");
  await page.goto(base + `/candidate-detail.html?context=${accepted.revision.context_id}&item=${working.payload.items[0].item_id}`);
  await page.waitForFunction(() => document.querySelector("#candidate-title").textContent === "Royal College of Art RCA");
  await page.click("#open-direct-edit"); await page.fill("#candidate-edit-title", "已保存的合成经历");
  await page.click("#preview-direct-edit");
  assert.equal((await read(["candidate_context_revisions"]))[0].length, 1, "preview must not confirm");
  await page.click("#confirm-direct-edit");
  await page.waitForFunction(() => document.querySelector("#candidate-detail-message").textContent.includes("已保存"));
  await page.reload(); await page.waitForFunction(() => document.querySelector("#candidate-title").textContent === "已保存的合成经历");
  const revisions = (await read(["candidate_context_revisions"]))[0];
  assert.equal(revisions.length, 2); assert.deepEqual(revisions.find(record => record.revision_id === accepted.revision.revision_id), accepted.revision);
  await page.screenshot({ path: path.join(output, "candidate-saved.png"), fullPage: true });
  evidence.checks.push("Candidate Working, preview, explicit Save, new immutable revision and reload use Markdown");
  await page.goto(base + "/job-detail.html?job=migration-job");
  await page.waitForFunction(() => document.querySelector("#job-title").textContent === "合成设计职位");
  await page.click("#open-job-edit"); await page.fill("#job-edit-title", "已保存的合成职位");
  await page.click("#preview-job-edit");
  assert.equal((await read(["job_context_revisions"]))[0].length, 1);
  await page.click("#confirm-job-edit");
  await page.waitForFunction(() => document.querySelector("#job-title").textContent === "已保存的合成职位");
  await page.reload(); await page.waitForFunction(() => document.querySelector("#job-title").textContent === "已保存的合成职位");
  assert.deepEqual((await read(["job_context_revisions"]))[0].find(record => record.version === 1), jobRevision);
  assert.deepEqual((await read(["job_context_revisions"]))[0].find(record => record.version === 2).payload.uncertainties, jobRevision.payload.uncertainties, "saving a field preserves unresolved source unknowns");
  evidence.checks.push("Job edit/preview/Save and old version survive reload with independent Candidate scope");
  // A transaction's first write must not leak when the second operation fails.
  const aborted = await page.evaluate(async () => {
    const db = await AriadneTruthPersistence.openDatabase();
    try { return await new Promise(resolve => { const tx = db.transaction("demo_ui_state", "readwrite"), store = tx.objectStore("demo_ui_state"); store.add({ state_id: "rollback" }); store.add({ state_id: "rollback" }); tx.onabort = () => resolve(true); tx.oncomplete = () => resolve(false); }); }
    finally { db.close(); }
  });
  assert(aborted); assert(!(await read(["demo_ui_state"]))[0].some(record => record.state_id === "rollback"));
  evidence.checks.push("multi-write abort is atomic");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(output, "job-mobile.png"), fullPage: true });
  await page.goto(base + "/workspace.html");
  await page.waitForFunction(() => document.querySelector("#workspace-personal-count").textContent === "1 张资料卡片");
  assert.equal(await page.locator("#workspace-job-count").innerText(), "1 个职位对象");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(output, "workspace-mobile.png"), fullPage: true });
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#workspace-personal-count").textContent === "1 张资料卡片");
  assert.equal(await page.locator("#workspace-job-count").innerText(), "1 个职位对象");
  evidence.checks.push("home uses the same library queries; confirmed cards count once after edit history and reload");
  assert.deepEqual(evidence.modelRequests, []);
  assert.deepEqual(evidence.errors, []);
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(await activePage?.locator("body").innerText());
  console.error(JSON.stringify(evidence));
  await fs.writeFile(path.join(output, `failure-${Date.now()}.html`), await activePage.content());
  throw error;
} finally { await browser.close(); }
