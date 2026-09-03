"use strict";

(async function seedSyntheticCandidateConversationBrowserState() {
  const Truth = globalThis.AriadneTruthPersistence;
  const Raw = globalThis.AriadneRawSourceStorage;
  const Local = globalThis.AriadneLocalCandidateExtraction;
  const CandidateModel = globalThis.AriadneCandidateModelRuntime;
  if (!Truth || !Raw || !Local || !CandidateModel) throw new Error("synthetic_seed_dependencies_missing");
  const database = await Truth.openDatabase();
  try {
    const readRecord = (storeName, key) => new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("synthetic_seed_read_failed"));
    });
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x53])], "synthetic-browser-semantic-v2-resume.pdf", {
      type: "application/pdf",
      lastModified: 1788422400000,
    });
    const prepared = await Local.prepareSource(file, "batch-synthetic-browser-semantic-v2", "Resume");
    const source = Local.sourceDocumentFor(prepared, "2026-09-03T09:00:00Z");
    await Raw.persistDurableSource(database, source, file);
    const run = CandidateModel.processingRunFor(
      prepared,
      "runtime-snapshot-synthetic-browser-semantic-v2-source",
      "SUCCEEDED",
      "2026-09-03T09:00:01Z",
      { run_id: "run-synthetic-browser-semantic-v2" },
    );
    if (!await readRecord("processing_runs", run.run_id)) await Truth.persistRecord(database, "processing_runs", run);
    const payload = {
      contract_id: "ariadne-candidate-working-payload-v1",
      material_type: "resume",
      items: [{
        item_id: "item-edu-001",
        item_type: "EDUCATION",
        item_subtype: "education",
        title: "Royal College of Art RCA",
        subtitle: "Synthetic Programme",
        time: "2026",
        summary: "Synthetic browser-only education item.",
        ownership: null,
        facts: [],
        grounding_refs: [],
        uncertainties: [],
        review_status: "NEEDS_REVIEW",
        item_version: 1,
        content_origin: "MODEL_PROPOSAL"
      }],
    };
    const canonical = (value) => Array.isArray(value)
      ? `[${value.map(canonical).join(",")}]`
      : value && typeof value === "object"
        ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
        : JSON.stringify(value);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(payload)));
    const fingerprint = `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    const working = Truth.validateCandidateWorkingModel({
      contract_id: "ariadne-candidate-working-model-v1",
      working_model_id: "synthetic-browser-semantic-v2-working-v1",
      source_document_id: source.source_document_id,
      processing_run_id: run.run_id,
      runtime_snapshot_id: run.runtime_snapshot_id,
      proposal_ids: ["proposal-synthetic-browser-semantic-v2"],
      version: 1,
      previous_working_model_id: null,
      fingerprint,
      created_at: "2026-09-03T09:00:02Z",
      payload,
      authority: Truth.AUTHORITY.working,
    });
    if (!await readRecord("candidate_working_models", working.working_model_id)) await Truth.persistCandidateWorkingModel(database, working);
    document.body.dataset.syntheticSeed = "ready";
    document.body.dataset.syntheticSourceId = source.source_document_id;
  } finally {
    database.close();
  }
}()).catch((error) => {
  document.body.dataset.syntheticSeed = `failed:${String(error?.message || error).slice(0, 120)}`;
});
