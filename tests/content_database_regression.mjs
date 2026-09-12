import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Database = require("../public/content-database.js"), Content = require("../public/content-document.js");
const contract = require("../data/workspace_storage_v1.json"), Demo = require("../public/v1-demo-domain.js"), Truth = require("../public/truth-persistence-domain.js");
const name = Truth.DB_NAME, schema = contract.databases[name], workspace = crypto.randomUUID().replaceAll("-", "");
assert.deepEqual(schema, Object.fromEntries(Demo.STORES));
for (const spec of Truth.STORE_SPECS) assert.equal(schema[spec.name], spec.keyPath);
for (const store of Content.STORES) assert(schema[store], store);
const root = await fs.mkdtemp(path.resolve(".cache/content-database-regression-"));
const child = spawn("python3", ["-u", "-c", "from app import JobRadarHandler, ThreadingHTTPServer\ns=ThreadingHTTPServer(('127.0.0.1',0),JobRadarHandler)\nprint(s.server_port,flush=True)\ns.serve_forever()"], {
  env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", ARIADNE_CODEX_ENABLED: "0", ARIADNE_WORKSPACE_ROOT: root }, stdio: ["ignore", "pipe", "pipe"],
});
let diagnostics = ""; child.stderr.on("data", chunk => { diagnostics += chunk; });
const originalFetch = globalThis.fetch;
try {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("storage_test_server_timeout")), 10000);
    child.stdout.once("data", chunk => { clearTimeout(timer); resolve(Number(String(chunk).trim())); });
    child.once("error", reject);
  });
  const base = `http://127.0.0.1:${port}`;
  globalThis.fetch = (url, options) => originalFetch(new URL(url, base), options);
  const call = body => fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const init = await call({ action: "commit", workspace, database: name, expected: Object.fromEntries(Object.keys(schema).map(name => [name, null])), writes: [], initialize: true, transaction_id: "a".repeat(32) });
  assert.equal(init.status, 200);
  const db = Database.connection(workspace, name, schema);
  const transact = (stores, callback) => new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite"); callback(tx);
    tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || Error("aborted"));
  });
  const all = store => new Promise((resolve, reject) => {
    const tx = db.transaction(store), r = tx.objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); tx.onerror = tx.onabort = () => reject(tx.error);
  });
  const record = { item_id: "document-1", title: "same title", summary: "\n正文\n ", facts: [{ label: "职责", value: "研究" }], additional_text: "卡片未显示的段落" };
  await transact("demo_candidate_items", tx => tx.objectStore("demo_candidate_items").add(record));
  assert.deepEqual(await all("demo_candidate_items"), [record]);
  const head = JSON.parse(await fs.readFile(path.join(root, workspace, "HEAD.json")));
  const entry = head.databases[name].demo_candidate_items[record.item_id];
  assert(entry.path.endsWith(".md"));
  assert.deepEqual(Content.decode(await fs.readFile(path.join(root, workspace, entry.path), "utf8")), record);
  assert(!JSON.stringify(head).includes(record.additional_text));
  await assert.rejects(transact("demo_ui_state", tx => { const store = tx.objectStore("demo_ui_state"); store.add({ state_id: "rollback" }); store.add({ state_id: "rollback" }); }), /Record exists/);
  assert.deepEqual(await all("demo_ui_state"), []);
  await transact("demo_candidate_items", tx => {
    const store = tx.objectStore("demo_candidate_items"), duplicate = store.add(record);
    duplicate.onerror = event => { assert.equal(duplicate.error.name, "ConstraintError"); event.preventDefault(); event.stopPropagation(); store.put({ ...record, title: "changed" }); };
  });
  assert.equal((await all("demo_candidate_items"))[0].title, "changed");
  const file = new File([new Uint8Array([0, 255, 10])], "附件.pdf", { type: "application/pdf", lastModified: 12345 });
  const serialized = await Database.serialize({ nested: [{ file }] });
  const decoded = Database.deserialize(serialized);
  assert.equal(decoded.nested[0].file.name, file.name); assert.equal(decoded.nested[0].file.lastModified, 12345);
  assert.deepEqual(new Uint8Array(await decoded.nested[0].file.arrayBuffer()), new Uint8Array(await file.arrayBuffer()));
  let stagedCount = 0;
  globalThis.fetch = (url, options) => {
    const body = options?.body && JSON.parse(options.body);
    if (body?.action === "stage_blob") stagedCount++;
    if (body?.action === "commit") assert(!options.body.includes("base64"), "commits contain references, never all original bytes");
    return originalFetch(new URL(url, base), options);
  };
  await transact("source_documents", tx => tx.objectStore("source_documents").put({ source_document_id: "original", file_blob: file, byte_size: file.size }));
  assert.equal(stagedCount, 1, "originals upload separately from the atomic manifest transaction");
  let blobReads = 0;
  globalThis.fetch = (url, options) => {
    if (options?.body && JSON.parse(options.body).action === "blob") blobReads++;
    return originalFetch(new URL(url, base), options);
  };
  assert.deepEqual(await db.getAllMetadata("source_documents"), [{ source_document_id: "original", byte_size: 3 }]);
  assert.equal(blobReads, 0, "listing sources must not transfer original bytes");
  const storedFile = (await all("source_documents"))[0].file_blob;
  assert.equal(blobReads, 1); assert.deepEqual(new Uint8Array(await storedFile.arrayBuffer()), new Uint8Array([0, 255, 10]));
  // Force both transactions to observe the same head, then release commits.
  Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  const pending = [];
  globalThis.fetch = (url, options) => {
    const body = options?.body && JSON.parse(options.body);
    if (body?.action === "commit") return new Promise(resolve => { pending.push(() => resolve(originalFetch(new URL(url, base), options))); if (pending.length === 2) pending.forEach(run => run()); });
    return originalFetch(new URL(url, base), options);
  };
  const race = await Promise.allSettled(["one", "two"].map(title => transact("demo_candidate_items", tx => tx.objectStore("demo_candidate_items").put({ ...record, title }))));
  assert.equal(race.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(race.find(result => result.status === "rejected").reason.code, "WORKSPACE_VERSION_CONFLICT");
  globalThis.fetch = (url, options) => originalFetch(new URL(url, base), options);
  const evil = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://other.example" }, body: JSON.stringify({ action: "status", workspace, database: name }) });
  assert.equal(evil.status, 403);
  db.close(); assert.throws(() => db.transaction("source_documents"), /CLOSED/);
  console.log("PASS content repository: real HTTP/disk, scope, Markdown, native-style errors, rollback, conflicts, nested original files");
} finally {
  globalThis.fetch = originalFetch;
  child.kill("SIGTERM");
  await fs.writeFile(path.join(root, "server.log"), diagnostics);
}
