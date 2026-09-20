import assert from "node:assert/strict";
import { checkBrowserStorageUpgrade } from "./helpers/browser-storage-upgrade.mjs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.argv[2];
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || "")) throw Error("disposable_local_server_required");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext(), page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  async function load() {
    await page.goto(base + "/index.html");
    for (const script of ["workspace-storage-contract.js", "v1-demo-domain.js", "content-document.js", "content-browser-storage.js"]) await page.addScriptTag({ url: base + "/" + script });
  }
  await load();
  const first = await page.evaluate(async () => {
    const D = JobRadarV1Demo;
    const record = { item_id: "browser-card", title: "浏览器中的内容", summary: "\n原正文\n ", extra_text: "卡片外的内容" };
    await D.put("demo_candidate_items", record);
    const db = await AriadneContentBrowserStorage.open(D.DB_NAME, D.openDatabase);
    const get = () => new Promise((resolve, reject) => { const r = db.transaction("demo_candidate_items").objectStore("demo_candidate_items").get("browser-card"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const migrated = await get();
    await new Promise((resolve, reject) => { const tx = db.transaction("demo_candidate_items", "readwrite"); tx.objectStore("demo_candidate_items").put({ ...record, title: "网页端已保存" }); tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error); });
    const changed = await get(), backup = await D.get("demo_candidate_items", "browser-card");
    const mode = db.storage; db.close();
    const packed = await new Promise((resolve, reject) => { const r = indexedDB.open(`ariadne-markdown::${D.DB_NAME}`, 1); r.onsuccess = () => { const db = r.result, q = db.transaction("demo_candidate_items").objectStore("demo_candidate_items").get("browser-card"); q.onsuccess = () => { resolve(q.result); db.close(); }; }; r.onerror = () => reject(r.error); });
    return { record, migrated, changed, backup, mode, packed };
  });
  assert.deepEqual(first.migrated, first.record); assert.deepEqual(first.backup, first.record);
  assert.equal(first.mode, "MARKDOWN_BROWSER"); assert.equal(first.changed.title, "网页端已保存");
  assert.deepEqual(Object.keys(first.packed), ["item_id", "content_format", "markdown"]);
  assert(first.packed.markdown.includes("卡片外的内容"));
  await load();
  const reloaded = await page.evaluate(async () => {
    const db = await AriadneContentBrowserStorage.open(JobRadarV1Demo.DB_NAME, JobRadarV1Demo.openDatabase);
    const record = await new Promise((resolve, reject) => { const r = db.transaction("demo_candidate_items").objectStore("demo_candidate_items").get("browser-card"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const rolledBack = await new Promise(resolve => { const tx = db.transaction("demo_candidate_items", "readwrite"), store = tx.objectStore("demo_candidate_items"); store.add({ item_id: "rollback", title: "never visible" }); store.add({ item_id: "rollback", title: "duplicate" }); tx.onabort = () => resolve(true); tx.oncomplete = () => resolve(false); });
    const absent = await new Promise((resolve, reject) => { const r = db.transaction("demo_candidate_items").objectStore("demo_candidate_items").get("rollback"); r.onsuccess = () => resolve(r.result === undefined); r.onerror = () => reject(r.error); });
    db.close(); return { record, rolledBack, absent };
  });
  assert.deepEqual(reloaded.record, first.changed); assert(reloaded.rolledBack && reloaded.absent);
  console.log(await page.evaluate(checkBrowserStorageUpgrade));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks: ["native IndexedDB Markdown migration", "one body", "untouched original backup", "unknown prose", "write and reload", "native transaction rollback"], errors }));
} finally { await browser.close(); }
