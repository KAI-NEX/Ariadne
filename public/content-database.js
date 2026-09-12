(function (root, factory) {
  const content = root.AriadneContentDocument || (typeof module === "object" && module.exports ? require("./content-document.js") : null);
  const contract = root.AriadneWorkspaceStorageContract || (typeof module === "object" && module.exports ? require("../data/workspace_storage_v1.json") : null);
  const api = factory(content, contract);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneContentDatabase = api;
}(globalThis, function (Content, Contract) {
  "use strict";
  const WORKSPACE_KEY = "ariadne-content-workspace-v1";
  const connections = new Map();
  let contractPromise;
  const clone = value => value === undefined ? undefined : structuredClone(value);
  const local = () => ["127.0.0.1", "localhost"].includes(globalThis.location?.hostname);
  const canonical = value => JSON.stringify(value, (_key, item) => item && !Array.isArray(item) && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

  function errorCopy(error) {
    const code = String(error?.code || error?.message || error || "");
    if (!code.startsWith("WORKSPACE_")) return null;
    return code === "WORKSPACE_VERSION_CONFLICT" ? "内容已在其他页面更新，请刷新后再保存。"
      : ["WORKSPACE_FILE_CHANGED", "WORKSPACE_SOURCE_HASH_MISMATCH"].includes(code) ? "文件内容与保存记录不一致，请保留原文件并核对；本次没有覆盖它。"
      : code === "WORKSPACE_FILE_MISSING" ? "工作区中的文件暂时找不到，请恢复原文件后重试。"
      : code.startsWith("WORKSPACE_MIGRATION") ? "工作区迁移未完成，旧记录仍保留，请重试或检查迁移记录。"
      : "无法完成工作区读写，请检查本机服务和磁盘空间，重连后刷新核对。";
  }

  function storageError(code) {
    return Object.assign(new Error(errorCopy(code) || errorCopy("WORKSPACE_STORAGE_UNAVAILABLE")), { code });
  }

  function workspaceId() {
    let value = localStorage.getItem(WORKSPACE_KEY);
    if (!value) { value = crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(WORKSPACE_KEY, value); }
    if (!/^[a-f0-9]{32}$/.test(value)) throw Error("WORKSPACE_ID_INVALID");
    return value;
  }

  async function request(payload) {
    if (payload?.action === "commit") payload = { ...payload, transaction_id: crypto.randomUUID().replaceAll("-", "") };
    const options = payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : { cache: "no-store" };
    let response, result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { response = await fetch("/api/workspace", options); result = await response.json(); break; }
      catch (error) {
        // A lost response may follow a successful save. Retry exactly the same
        // transaction ID; server receipts prevent a duplicate Human Save.
        if (attempt || payload?.action !== "commit") throw storageError("WORKSPACE_STORAGE_UNAVAILABLE");
      }
    }
    if (!response.ok) throw storageError(result.error || "WORKSPACE_STORAGE_UNAVAILABLE");
    return result;
  }

  async function serialize(item, workspace = null, filename = null) {
      if (item instanceof Blob) {
        const bytes = new Uint8Array(await item.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
        const value = { $blob: "base64", data: btoa(binary), type: item.type,
          ...(typeof item.name === "string" ? { name: item.name, lastModified: item.lastModified ?? 0 } : {}) };
        return workspace ? request({ action: "stage_blob", workspace, database: "job-radar-local-first-v1", value, filename }) : value;
      }
      if (Array.isArray(item)) return Promise.all(item.map(value => serialize(value, workspace)));
      if (item && typeof item === "object") return Object.fromEntries(await Promise.all(Object.entries(item).map(async ([key, value]) => [key, await serialize(value, workspace, item.filename || item.name || null)])));
      return item;
  }

  function deserialize(item) {
    if (item?.$blob === "base64") {
      const bytes = Uint8Array.from(atob(item.data), character => character.charCodeAt(0));
      return typeof item.name === "string" ? new File([bytes], item.name, { type: item.type, lastModified: item.lastModified }) : new Blob([bytes], { type: item.type });
    }
    if (Array.isArray(item)) return item.map(deserialize);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, deserialize(value)]));
    return item;
  }

  async function hydrate(item, workspace, database) {
    if (item instanceof Blob) return item;
    if (item?.$blob === "file") return deserialize(await request({ action: "blob", workspace, database, entry: item }));
    if (Array.isArray(item)) return Promise.all(item.map(value => hydrate(value, workspace, database)));
    if (item && typeof item === "object") return Object.fromEntries(await Promise.all(Object.entries(item).map(async ([key, value]) => [key, await hydrate(value, workspace, database)])));
    return item;
  }

  function metadata(item) {
    if (item instanceof Blob || item?.$blob === "file") return undefined;
    if (Array.isArray(item)) return item.map(metadata);
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).filter(([, value]) => !(value instanceof Blob) && value?.$blob !== "file").map(([key, value]) => [key, metadata(value)]));
    return item;
  }

  function locked(name, callback) {
    return globalThis.navigator?.locks ? navigator.locks.request(name, callback) : callback();
  }

  function openNative(database) {
    const schema = Contract?.databases?.[database];
    if (!schema) return Promise.reject(Error("WORKSPACE_CONTRACT_INVALID"));
    const open = version => new Promise((resolve, reject) => {
      const request = version ? indexedDB.open(database, version) : indexedDB.open(database);
      request.onupgradeneeded = () => {
        for (const [name, keyPath] of Object.entries(schema)) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath });
      };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(request.error); request.onblocked = () => reject(Error("WORKSPACE_MIGRATION_BLOCKED"));
    });
    return open().then(db => {
      if (Object.keys(schema).every(name => db.objectStoreNames.contains(name))) return db;
      const version = db.version + 1; db.close(); return open(version);
    });
  }

  function legacySnapshot(database) {
    const names = Array.from(database.objectStoreNames);
    if (!names.length) return Promise.resolve({});
    return new Promise((resolve, reject) => {
      const snapshot = {}, transaction = database.transaction(names, "readonly");
      for (const name of names) {
        const read = transaction.objectStore(name).getAll();
        read.onsuccess = () => { snapshot[name] = read.result; };
      }
      transaction.oncomplete = () => resolve(snapshot);
      transaction.onerror = transaction.onabort = () => reject(transaction.error || Error("WORKSPACE_MIGRATION_READ_FAILED"));
    });
  }

  async function migrate(workspace, database, schema, nativeOpen) {
    const status = await request({ action: "status", workspace, database });
    if (status.initialized) return;
    const original = await nativeOpen();
    let snapshot;
    try { snapshot = await legacySnapshot(original); } finally { original.close(); }
    if (Object.keys(snapshot).some(name => !Object.hasOwn(schema, name) && snapshot[name].length)) throw Error("WORKSPACE_MIGRATION_UNKNOWN_STORE");
    const writes = [], counts = {};
    for (const [store, keyPath] of Object.entries(schema)) {
      const records = snapshot[store] || [];
      counts[store] = records.length;
      for (const record of records) {
        const packed = Content.pack(store, keyPath, record);
        if (canonical(Content.unpack(store, keyPath, packed)) !== canonical(record)) throw Error("WORKSPACE_MIGRATION_ROUNDTRIP_FAILED");
        writes.push({ store, operation: "add", value: await serialize(packed, workspace) });
      }
    }
    await request({ action: "commit", workspace, database, expected: Object.fromEntries(Object.keys(schema).map(name => [name, null])), writes, initialize: true });
    // Browser records remain untouched as a dated migration backup. Subsequent
    // reads and writes use only the document library, never a dual-write sync.
    localStorage.setItem(`${WORKSPACE_KEY}:migration:${database}`, JSON.stringify({ migrated_at: new Date().toISOString(), counts }));
  }

  // A deliberately small transaction interface used by the existing domain
  // repositories: get/getAll/add/put/delete, callbacks and abort. It is not an
  // IndexedDB implementation (no cursors, indexes, schema changes or key ranges).
  // Domain version checks run against one snapshot; the server commits its
  // complete write set only if every read store still has that version.
  function connection(workspace, database, schema) {
    let closed = false;
    const lockName = `${WORKSPACE_KEY}:${workspace}:${database}`;
    const names = Object.keys(schema);
    const objectStoreNames = Object.assign([...names], { contains: name => Object.hasOwn(schema, name) });
    const databaseConnection = {
      name: database, objectStoreNames, storage: "MARKDOWN_FILES", close() { closed = true; },
      getAllMetadata(name) {
        return new Promise((resolve, reject) => {
          const tx = databaseConnection.transaction(name), read = tx.objectStore(name).getAllMetadata();
          read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error);
          tx.onerror = tx.onabort = () => reject(tx.error || Error("WORKSPACE_READ_FAILED"));
        });
      },
      transaction(selected, mode = "readonly") {
        if (closed) throw Error("WORKSPACE_CONNECTION_CLOSED");
        const stores = typeof selected === "string" ? [selected] : [...selected];
        if (!stores.length || stores.some(name => !Object.hasOwn(schema, name)) || !["readonly", "readwrite"].includes(mode)) throw Error("WORKSPACE_TRANSACTION_INVALID");
        const queue = [], writes = [];
        let state = "pending", failure = null, snapshot;
        const tx = {
          oncomplete: null, onerror: null, onabort: null,
          get error() { return failure; },
          abort() {
            if (["committing", "complete"].includes(state)) throw new DOMException("Save has already started", "InvalidStateError");
            state = "aborted";
          },
          objectStore(name) {
            if (!stores.includes(name)) throw Error("WORKSPACE_TRANSACTION_SCOPE_INVALID");
            function enqueue(operation, input) {
              if (!["pending", "running"].includes(state)) throw Error("WORKSPACE_TRANSACTION_INACTIVE");
              if (["add", "put", "delete", "clear"].includes(operation) && mode !== "readwrite") throw new DOMException("Read only", "ReadOnlyError");
              const req = { result: undefined, error: null, onsuccess: null, onerror: null };
              queue.push({ name, operation, input: clone(input), req });
              return req;
            }
            return { keyPath: schema[name], get: key => enqueue("get", key), getAll: () => enqueue("getAll"), getAllMetadata: () => enqueue("getAllMetadata"),
              add: value => enqueue("add", value), put: value => enqueue("put", value), delete: key => enqueue("delete", key), clear: () => enqueue("clear") };
          },
        };
        const fail = error => {
          failure = error; state = "aborted";
          tx.onerror?.({ target: tx }); tx.onabort?.({ target: tx });
        };
        // Defer so callers can install callbacks and enqueue their first reads.
        setTimeout(() => locked(lockName, async () => {
          try {
            if (state === "aborted") { tx.onabort?.({ target: tx }); return; }
            const read = await request({ action: "read", workspace, database, stores, metadata_only: true });
            if (!read.initialized) throw Error("WORKSPACE_NOT_INITIALIZED");
            snapshot = Object.fromEntries(stores.map(name => [name, new Map(read.stores[name].map(value => {
              const record = Content.unpack(name, schema[name], deserialize(value));
              return [record[schema[name]], record];
            }))]));
            if (state === "aborted") { tx.onabort?.({ target: tx }); return; }
            state = "running";
            while (queue.length && state !== "aborted") {
              const { name, operation, input, req } = queue.shift(), records = snapshot[name];
              try {
                if (operation === "get") req.result = await hydrate(clone(records.get(input)), workspace, database);
                else if (operation === "getAll") req.result = await hydrate([...records.keys()].sort().map(key => clone(records.get(key))), workspace, database);
                else if (operation === "getAllMetadata") req.result = [...records.keys()].sort().map(key => metadata(clone(records.get(key))));
                else if (operation === "clear") {
                  for (const key of records.keys()) writes.push({ store: name, operation: "delete", key });
                  records.clear();
                }
                else {
                  const key = operation === "delete" ? input : input?.[schema[name]];
                  if (typeof key !== "string" || !key) throw Error("WORKSPACE_RECORD_ID_INVALID");
                  if (operation === "add" && records.has(key)) throw new DOMException("Record exists", "ConstraintError");
                  if (operation === "delete") records.delete(key); else records.set(key, clone(input));
                  writes.push({ store: name, operation, ...(operation === "delete" ? { key } : { value: Content.pack(name, schema[name], input) }) });
                  req.result = operation === "delete" ? undefined : key;
                }
              } catch (error) {
                req.error = error;
                let prevented = false;
                req.onerror?.({ target: req, preventDefault() { prevented = true; }, stopPropagation() {} });
                if (!prevented) throw error;
                continue;
              }
              req.onsuccess?.({ target: req });
            }
            if (state === "aborted") { tx.onabort?.({ target: tx }); return; }
            const outbound = [];
            for (const write of writes) outbound.push(write.value ? { ...write, value: await serialize(write.value, workspace) } : write);
            if (state === "aborted") { tx.onabort?.({ target: tx }); return; }
            if (writes.length) {
              state = "committing";
              await request({ action: "commit", workspace, database, expected: read.versions, writes: outbound });
            }
            state = "complete"; tx.oncomplete?.({ target: tx });
          } catch (error) { fail(error); }
        }).catch(fail), 0);
        return tx;
      },
    };
    return databaseConnection;
  }

  async function open(database, nativeOpen = () => openNative(database)) {
    if (!local()) return globalThis.AriadneContentBrowserStorage.open(database, nativeOpen);
    const workspace = workspaceId(), key = `${workspace}:${database}`;
    if (!connections.has(key)) connections.set(key, (async () => {
      const contract = await (contractPromise ||= request());
      if (contract.contract_id !== "ariadne-workspace-storage-v1" || !contract.databases[database]) throw Error("WORKSPACE_CONTRACT_INVALID");
      const schema = contract.databases[database];
      await locked(`${WORKSPACE_KEY}:${workspace}:${database}`, () => migrate(workspace, database, schema, nativeOpen));
      return schema;
    })().catch(error => { connections.delete(key); throw error; }));
    return connection(workspace, database, await connections.get(key));
  }

  return Object.freeze({ open, connection, serialize, deserialize, errorCopy, WORKSPACE_KEY });
}));
