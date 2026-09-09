import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

globalThis.crypto ||= webcrypto;
const require = createRequire(import.meta.url);
const Candidate = require("../public/local-candidate-extraction-domain.js");
const Job = require("../public/local-job-extraction-domain.js");
const bytes = new Uint8Array(30_000_000);
for (const domain of [Candidate, Job]) {
  for (const extension of Object.keys(domain.MIME_BY_EXTENSION)) {
    const file = new File([bytes], `boundary.${extension}`, { type: domain.MIME_BY_EXTENSION[extension] });
    const source = await domain.prepareSource(file, "batch-upload-limit", domain === Candidate ? "Resume" : {});
    assert.equal(source.file.size, 30_000_000);
    assert.match(source.content_hash, /^sha256:[a-f0-9]{64}$/);
    for (const size of [30_000_001, 0]) {
      await assert.rejects(domain.prepareSource({ name: file.name, size }, "batch-upload-limit", domain === Candidate ? "Resume" : {}),
        size === 0 ? /invalid_document_size/ : /size_limit_exceeded/);
    }
  }
}
console.log("upload_size_30mb_all_supported_formats=pass");
