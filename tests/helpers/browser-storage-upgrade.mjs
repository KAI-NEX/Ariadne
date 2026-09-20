// Run inside an isolated browser page with the content storage scripts loaded.
export async function checkBrowserStorageUpgrade() {
  const name = `qa-library-upgrade-${crypto.randomUUID()}`;
  const contract = globalThis.AriadneWorkspaceStorageContract;
  const schema = { job_context_revisions: "revision_id", job_context_lifecycle: "lifecycle_id" };
  globalThis.AriadneWorkspaceStorageContract = { ...contract, databases: { ...contract.databases, [name]: schema } };
  const record = { revision_id: "history-1", title: "合成旧版本", payload: { summary: "原有正文保留" } };
  const packed = AriadneContentDocument.pack("job_context_revisions", "revision_id", record);
  const connect = (dbName, initialize) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => initialize(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = (db, names, action) => new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite"); action(tx);
    tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || Error("aborted"));
  });
  const read = (db, store, key) => new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  const check = (condition, message) => { if (!condition) throw Error(message); };
  let db;
  try {
    // Simulate a pre-existing, already migrated webpage library, without the new store.
    db = await connect(`ariadne-markdown::${name}`, database => {
      database.createObjectStore("job_context_revisions", { keyPath: "revision_id" });
      database.createObjectStore("__workspace", { keyPath: "id" });
    });
    await transaction(db, ["job_context_revisions", "__workspace"], tx => {
      tx.objectStore("job_context_revisions").add(packed);
      tx.objectStore("__workspace").add({ id: "migration", migrated_at: "2026-09-19T00:00:00Z" });
    });
    db.close();
    const nativeOpen = () => connect(name, database => database.createObjectStore("job_context_revisions", { keyPath: "revision_id" }));
    db = await AriadneContentBrowserStorage.open(name, nativeOpen);
    check(db.objectStoreNames.contains("job_context_lifecycle"), "new store missing after upgrade");
    check(JSON.stringify(await read(db, "job_context_revisions", record.revision_id)) === JSON.stringify(record), "history changed during upgrade");
    const lifecycle = { lifecycle_id: "removal-1", context_id: "job-1", state: "REMOVED" };
    await transaction(db, ["job_context_lifecycle"], tx => tx.objectStore("job_context_lifecycle").add(lifecycle));
    db.close();
    db = await AriadneContentBrowserStorage.open(name, nativeOpen);
    check((await read(db, "job_context_lifecycle", "removal-1")).state === "REMOVED", "removal lost after reopen");
    const aborted = await new Promise(resolve => {
      const tx = db.transaction("job_context_lifecycle", "readwrite"), store = tx.objectStore("job_context_lifecycle");
      store.add({ lifecycle_id: "rollback" }); store.add({ lifecycle_id: "rollback" });
      tx.oncomplete = () => resolve(false); tx.onabort = () => resolve(true);
    });
    check(aborted && !(await read(db, "job_context_lifecycle", "rollback")), "failed write was not rolled back");
    db.close();
    db = await connect(`ariadne-markdown::${name}`, () => {});
    check(db.version === 2, "existing browser library did not upgrade");
    check(JSON.stringify(await read(db, "job_context_revisions", record.revision_id)) === JSON.stringify(packed), "original packed history changed");
    check((await read(db, "__workspace", "migration")).migrated_at === "2026-09-19T00:00:00Z", "old library was migrated again");
    return { browserSchemaUpgrade: "pass", historyPreserved: true, removalReopened: true, failedWriteRolledBack: true };
  } finally { db?.close(); globalThis.AriadneWorkspaceStorageContract = contract; }
}
