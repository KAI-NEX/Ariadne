"use strict";

(async function seedSyntheticCandidateConversationBrowserState() {
  const Truth = globalThis.AriadneTruthPersistence;
  const Raw = globalThis.AriadneRawSourceStorage;
  const Local = globalThis.AriadneLocalCandidateExtraction;
  if (!Truth || !Raw || !Local) throw new Error("synthetic_seed_dependencies_missing");
  localStorage.setItem("job-radar-selected-runtime", JSON.stringify({ mode: "model", provider: "deepseek", model: "deepseek-flash" }));
  const database = await Truth.openDatabase();
  try {
    const readRecord = (storeName, key) => new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("synthetic_seed_read_failed"));
    });
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x42, 0x31])], "synthetic-browser-slice-b1-resume.pdf", {
      type: "application/pdf",
      lastModified: 1788422400000,
    });
    const prepared = await Local.prepareSource(file, "batch-synthetic-browser-slice-b1", "Resume");
    const source = Local.sourceDocumentFor(prepared, "2026-09-03T09:00:00Z");
    await Raw.persistDurableSource(database, source, file);
    const run = Local.processingRunFor(
      prepared,
      "runtime-snapshot-synthetic-browser-slice-b1-source",
      "SUCCEEDED",
      "2026-09-03T09:00:01Z",
      { run_id: "run-synthetic-browser-slice-b1" },
    );
    if (!await readRecord("processing_runs", run.run_id)) await Truth.persistRecord(database, "processing_runs", run);
    const payload = {
      contract_id: "ariadne-candidate-working-payload-v1",
      material_type: "resume",
      items: [
        {
          item_id: "item-work-001",
          item_type: "WORK_EXPERIENCE",
          item_subtype: "work_experience",
          title: "Synthetic Product Assistant",
          subtitle: "Fictional Lantern Studio",
          time: "2025 年 1 月至 3 月",
          summary: "Clearly synthetic browser-only work experience.",
          ownership: null,
          facts: [
            { fact_id: "fact-role-001", label: "角色", value: "项目协作者" },
            { fact_id: "fact-work-arrangement-001", label: "工作性质", value: "长期兼职" }
          ],
          grounding_refs: [],
          uncertainties: [],
          review_status: "ACCEPTED",
          item_version: 1,
          content_origin: "USER_SELECTED"
        },
        {
          item_id: "item-work-escape-target",
          item_type: "WORK_EXPERIENCE",
          item_subtype: "work_experience",
          title: "Synthetic Other Role",
          subtitle: "Synthetic Other Studio",
          time: "2024",
          summary: "Second synthetic item used only for focus-boundary testing.",
          ownership: null,
          facts: [{ fact_id: "fact-work-arrangement-002", label: "工作性质", value: "项目制" }],
          grounding_refs: [],
          uncertainties: [],
          review_status: "ACCEPTED",
          item_version: 1,
          content_origin: "USER_SELECTED"
        },
        {
          item_id: "item-project-duplicate-fields",
          item_type: "PROJECT",
          item_subtype: "project",
          title: "Synthetic RCA Project",
          subtitle: "Design Research",
          time: "2025",
          summary: "Clearly synthetic browser-only project.",
          ownership: null,
          facts: [
            { fact_id: "synthetic-a", label: "unknown-a", value: "2025" },
            { fact_id: "synthetic-b", label: "unknown-b", value: "HTML + JavaScript" },
            { fact_id: "synthetic-real-supplemental", label: "Supplemental Information", value: "Synthetic note" },
            { fact_id: "synthetic-location", label: "Location", value: "London" }
          ],
          grounding_refs: [],
          uncertainties: [],
          review_status: "ACCEPTED",
          item_version: 1,
          content_origin: "USER_SELECTED"
        }
      ],
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
      working_model_id: "synthetic-browser-slice-b1-working-v1",
      source_document_id: source.source_document_id,
      processing_run_id: run.run_id,
      runtime_snapshot_id: run.runtime_snapshot_id,
      proposal_ids: ["proposal-synthetic-browser-slice-b1"],
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
