(function (root, factory) {
  const contract = root.AriadneWorkspaceStorageContract || (typeof module === "object" && module.exports ? require("../data/workspace_storage_v1.json") : null);
  const api = factory(contract);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneContentDocument = api;
}(globalThis, function (Contract) {
  "use strict";

  const FORMAT = "ariadne-markdown-v1";
  // These stores contain documents. Execution, identity and user-interface state
  // remain structured records; changing their format would add no useful prose.
  const STORES = Object.freeze([...Contract.markdown_stores]);
  // New prose fields automatically become document text. Only transport,
  // identity and lifecycle strings stay in metadata, including arrays of IDs.
  const METADATA_FIELD = /(?:^|_)(?:id|ids|ref|refs|identity|identities|hash|fingerprint|version|type|status|state|authority|origin|contract|format|url|uri|at)$|^(?:provider|model|protocol|adapter|operation|intent|kind|role|scope|decision|phase|confidence|content_format|schema_version)$/;
  const copy = value => JSON.parse(JSON.stringify(value));
  const pathTitle = path => path.map(part => typeof part === "number" ? `[${part + 1}]` : part).join(" / ");

  function encode(record) {
    const metadata = copy(record), fields = [], values = [];
    function visit(value, path, prose = false) {
      if (typeof value === "string" && prose) {
        fields.push(path); values.push(value); return null;
      }
      if (Array.isArray(value)) return value.map((item, index) => visit(item, [...path, index], prose));
      if (value && typeof value === "object") {
        for (const key of Object.keys(value)) value[key] = visit(value[key], [...path, key], !METADATA_FIELD.test(key));
      }
      return value;
    }
    visit(metadata, []);
    let longest = 2;
    for (const value of values) for (const match of value.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
    const fence = "`".repeat(longest + 1);
    const header = { format: FORMAT, record: metadata, fields, fence };
    return `---\n${JSON.stringify(header)}\n---\n` + values.map((value, index) =>
      `\n## ${pathTitle(fields[index])}\n\n${fence}text\n${value}\n${fence}\n`).join("");
  }

  function decode(markdown) {
    if (typeof markdown !== "string" || !markdown.startsWith("---\n")) throw Error("CONTENT_MARKDOWN_INVALID");
    const end = markdown.indexOf("\n---\n", 4);
    if (end < 0) throw Error("CONTENT_MARKDOWN_HEADER_INVALID");
    const header = JSON.parse(markdown.slice(4, end));
    if (header.format !== FORMAT || !header.record || Array.isArray(header.record)
      || !Array.isArray(header.fields) || !/^`{3,}$/.test(header.fence)) throw Error("CONTENT_MARKDOWN_HEADER_INVALID");
    let remaining = markdown.slice(end + 5);
    const record = header.record, seen = new Set();
    for (const path of header.fields) {
      if (!Array.isArray(path) || !path.length || path.some(key =>
        !(typeof key === "string" || Number.isSafeInteger(key) && key >= 0)
        || ["__proto__", "prototype", "constructor"].includes(key))) throw Error("CONTENT_MARKDOWN_PATH_INVALID");
      const identity = JSON.stringify(path);
      if (seen.has(identity)) throw Error("CONTENT_MARKDOWN_PATH_DUPLICATE");
      seen.add(identity);
      const prefix = `\n## ${pathTitle(path)}\n\n${header.fence}text\n`, suffix = `\n${header.fence}\n`;
      if (!remaining.startsWith(prefix)) throw Error("CONTENT_MARKDOWN_SECTION_INVALID");
      const boundary = remaining.indexOf(suffix, prefix.length);
      if (boundary < 0) throw Error("CONTENT_MARKDOWN_SECTION_INVALID");
      let target = record;
      for (const key of path.slice(0, -1)) {
        if (!target || !Object.hasOwn(target, key)) throw Error("CONTENT_MARKDOWN_PATH_INVALID");
        target = target[key];
      }
      const key = path[path.length - 1];
      if (!target || !Object.hasOwn(target, key) || target[key] !== null) throw Error("CONTENT_MARKDOWN_PATH_INVALID");
      target[key] = remaining.slice(prefix.length, boundary);
      remaining = remaining.slice(boundary + suffix.length);
    }
    if (remaining !== "") throw Error("CONTENT_MARKDOWN_UNMAPPED_TEXT");
    return record;
  }

  function pack(store, keyPath, record) {
    if (!STORES.includes(store)) return record;
    if (!record || typeof record[keyPath] !== "string") throw Error("CONTENT_DOCUMENT_ID_REQUIRED");
    return { [keyPath]: record[keyPath], content_format: FORMAT, markdown: encode(record) };
  }

  function unpack(store, keyPath, value) {
    if (value === undefined || !STORES.includes(store) || value?.content_format !== FORMAT) return value;
    const record = decode(value.markdown);
    if (record[keyPath] !== value[keyPath]) throw Error("CONTENT_DOCUMENT_ID_MISMATCH");
    return record;
  }

  return Object.freeze({ FORMAT, STORES, encode, decode, pack, unpack });
}));
