(function (root) {
  "use strict";
  const ready = new Map();
  const Content = root.AriadneContentDocument;

  async function openSchemaDatabase(name, schema, version) {
    const db = await new Promise((resolve, reject) => {
      const request = version ? indexedDB.open(`ariadne-markdown::${name}`, version) : indexedDB.open(`ariadne-markdown::${name}`);
      request.onupgradeneeded = () => {
        for (const [store, keyPath] of Object.entries(schema)) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath });
        }
        if (!request.result.objectStoreNames.contains("__workspace")) request.result.createObjectStore("__workspace", { keyPath: "id" });
      };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error("WORKSPACE_MIGRATION_BLOCKED"));
    });
    if (Object.keys(schema).every(store => db.objectStoreNames.contains(store))) return db;
    const nextVersion = db.version + 1;
    db.close();
    return openSchemaDatabase(name, schema, nextVersion);
  }

  async function initialize(name, nativeOpen) {
    const original = await nativeOpen();
    const schema = root.AriadneWorkspaceStorageContract?.databases?.[name], snapshot = {};
    if (!schema) { original.close(); throw Error("WORKSPACE_CONTRACT_INVALID"); }
    try {
      const names = Array.from(original.objectStoreNames);
      if (names.length) await new Promise((resolve, reject) => {
        const tx = original.transaction(names);
        for (const storeName of names) {
          const store = tx.objectStore(storeName), request = store.getAll();
          if (schema[storeName] !== store.keyPath) { tx.abort(); reject(Error("WORKSPACE_MIGRATION_SCHEMA_MISMATCH")); return; }
          request.onsuccess = () => { snapshot[storeName] = request.result; };
        }
        tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(tx.error || Error("WORKSPACE_MIGRATION_READ_FAILED"));
      });

    } finally { original.close(); }
    const db = await openSchemaDatabase(name, schema);
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction([...Object.keys(schema), "__workspace"], "readwrite");
        let failure;
        const metadata = tx.objectStore("__workspace"), status = metadata.get("migration");
        status.onsuccess = () => {
          if (status.result) return;
          try {
            for (const [store, records] of Object.entries(snapshot)) for (const record of records) {
              const packed = Content.pack(store, schema[store], record);
              if (Content.STORES.includes(store) && JSON.stringify(Content.unpack(store, schema[store], packed)) !== JSON.stringify(record)) throw Error("WORKSPACE_MIGRATION_ROUNDTRIP_FAILED");
              tx.objectStore(store).add(packed);
            }
            metadata.add({ id: "migration", migrated_at: new Date().toISOString(), counts: Object.fromEntries(Object.entries(snapshot).map(([key, records]) => [key, records.length])) });
          } catch (error) { failure = error; tx.abort(); }
        };
        tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(failure || tx.error || Error("WORKSPACE_MIGRATION_FAILED"));
      });
    } finally { db.close(); }
  }

  function wrap(database) {
    return { name: database.name, storage: "MARKDOWN_BROWSER", objectStoreNames: database.objectStoreNames,
      close: () => database.close(),
      transaction(names, mode) {
        const tx = database.transaction(names, mode);
        let conversionError;
        return new Proxy(tx, {
          get(target, key) {
            if (key === "error") return conversionError || target.error;
            if (key !== "objectStore") return typeof target[key] === "function" ? target[key].bind(target) : target[key];
            return name => {
              const store = target.objectStore(name);
              return new Proxy(store, { get(source, method) {
                if (!["get", "getAll", "put", "add"].includes(method)) return typeof source[method] === "function" ? source[method].bind(source) : source[method];
                return value => {
                  const writing = ["put", "add"].includes(method);
                  const raw = source[method](writing ? Content.pack(name, source.keyPath, value) : value);
                  const request = { result: undefined, error: null, onsuccess: null, onerror: null };
                  raw.onsuccess = () => {
                    try {
                      const decode = item => Content.unpack(name, source.keyPath, item);
                      request.result = writing ? raw.result : method === "getAll" ? raw.result.map(decode) : decode(raw.result);
                    } catch (error) {
                      conversionError = request.error = error;
                      request.onerror?.({ target: request }); tx.abort(); return;
                    }
                    request.onsuccess?.({ target: request });
                  };
                  raw.onerror = event => { request.error = raw.error; request.onerror?.(event); };
                  return request;
                };
              }});
            };
          },
          set(target, key, value) { target[key] = value; return true; },
        });
      },
    };
  }

  async function open(name, nativeOpen) {
    if (!ready.has(name)) {
      const run = () => initialize(name, nativeOpen);
      ready.set(name, (navigator.locks ? navigator.locks.request(`ariadne-markdown:${name}`, run) : run()).catch(error => { ready.delete(name); throw error; }));
    }
    await ready.get(name);
    const database = await openSchemaDatabase(name, root.AriadneWorkspaceStorageContract.databases[name]);
    return wrap(database);
  }
  root.AriadneContentBrowserStorage = Object.freeze({ open });
}(globalThis));
