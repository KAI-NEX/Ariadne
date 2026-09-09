"use strict";
(function attach(root, factory) {
  const dep = (name, file) => root[name] || (typeof module === "object" ? require(file) : null);
  const api = factory(dep("AriadneJobOverviewContract", "../data/job_overview_contract_v1.json"), dep("AriadneTruthPersistence", "./truth-persistence-domain.js"),
    dep("AriadneJobContext", "./job-context-domain.js"), dep("AriadnePersonalContext", "./personal-context-domain.js"),
    dep("AriadneRuntimeExecution", "./runtime-capabilities.js"), dep("JobRadarRuntimeGate", "./runtime-capability-gate.js"));
  if (typeof module === "object" && module.exports) module.exports = api; else root.AriadneJobOverview = api;
}(globalThis, function create(Contract, Truth, Job, Context, Runtime, Gate) {
  const STORES = ["job_overview_fragments", "job_overview_snapshots", "job_overview_turns"];
  const INPUT_STORES = ["job_context_revisions", "context_proposals", "context_review_decisions", "source_documents"];
  const id = (prefix) => `${prefix}-${crypto.randomUUID()}`, now = () => new Date().toISOString();
  const clone = (value) => structuredClone(value);
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  async function fingerprint(value) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical(value)))))].map((x) => x.toString(16).padStart(2, "0")).join(""); }
  function text(value, max = 2400) { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("JOB_OVERVIEW_TEXT_INVALID"); return value.trim(); }
  function getAll(db, name) { return db.objectStoreNames.contains(name) ? Job.getAll(db, name) : Promise.resolve([]); }
  function write(db, name, record, replace = false) {
    if (!STORES.includes(name) || (replace && name !== "job_overview_turns")) throw new Error("JOB_OVERVIEW_WRITE_SCOPE_INVALID");
    return new Promise((resolve, reject) => { const tx = db.transaction(name, "readwrite"); tx.objectStore(name)[replace ? "put" : "add"](clone(record)); tx.oncomplete = () => resolve(record); tx.onerror = tx.onabort = () => reject(tx.error || new Error("JOB_OVERVIEW_WRITE_FAILED")); });
  }
  function semantic(payload, authority, sourceIds, sources) {
    const value = Job.validateJobPayload(payload);
    return { title: value.title, company: value.company, location: value.location, summary: value.summary,
      requirements: value.requirements.map((entry) => ({ label: entry.label, detail: entry.detail })),
      uncertainties: value.uncertainties.map((entry) => ({ field: typeof entry === "object" ? entry.field || null : null, reason: typeof entry === "string" ? entry : entry.reason || entry.question || entry.message || "待核对" })), authority,
      source_availability: sourceIds.length && sourceIds.every((sourceId) => sources.some((entry) => entry.source_document_id === sourceId)) ? "SOURCE_SAVED" : "SOURCE_UNAVAILABLE" };
  }
  async function buildSnapshot(input) {
    const sources = input.source_documents || [], revisions = Job.latestRevisions(input.job_context_revisions || []), records = [];
    for (const revision of revisions) {
      const checked = Truth.validateContextRevision(revision);
      records.push({ identity: `job:${checked.context_id}`, context_id: checked.context_id, version: checked.version, revision_id: checked.revision_id,
        semantic: semantic(checked.payload, "CONFIRMED", checked.provenance.source_document_ids, sources) });
    }
    const decided = new Set((input.context_review_decisions || []).filter((entry) => entry.authority === Truth.AUTHORITY.review).map((entry) => entry.proposal_id));
    const accepted = new Set(revisions.map((entry) => entry.confirmed_from_proposal_id)), pending = new Map();
    for (const entry of input.context_proposals || []) {
      if (entry.proposal_type !== "JOB_CONTEXT" || entry.authority !== Truth.AUTHORITY.proposal || entry.status !== "AWAITING_REVIEW" || decided.has(entry.proposal_id) || accepted.has(entry.proposal_id)) continue;
      const checked = Truth.validateProposal(entry);
      // A newer attempt for an exact ordered source bundle supersedes an older
      // pending attempt. Different documents or Jobs are never merged by title.
      const key = JSON.stringify(checked.source_document_ids), prior = pending.get(key);
      if (!prior || `${checked.created_at}:${checked.proposal_id}` > `${prior.created_at}:${prior.proposal_id}`) pending.set(key, checked);
    }
    for (const entry of pending.values()) records.push({ identity: `working-job:${entry.proposal_id}`, proposal_id: entry.proposal_id, source_id: entry.source_document_ids[0], version: 0,
      semantic: semantic(entry.payload, "WORKING_UNCONFIRMED", entry.source_document_ids, sources) });
    records.sort((a, b) => a.identity.localeCompare(b.identity));
    for (let index = 0; index < records.length; index++) { records[index].ref = `job-${index + 1}`; records[index].semantic_hash = await fingerprint(records[index].semantic); }
    return { records, fingerprint: await fingerprint(records.map(({ ref, ...entry }) => entry)), confirmed_count: revisions.length, working_count: pending.size };
  }
  async function snapshotFromDatabase(db) {
    const values = await Promise.all(INPUT_STORES.map((name) => getAll(db, name)));
    const snapshot = await buildSnapshot(Object.fromEntries(INPUT_STORES.map((name, index) => [name, values[index]])));
    snapshot.overview = (await getAll(db, "job_overview_snapshots")).filter((entry) => entry.authority === "NON_AUTHORITATIVE_JOB_OVERVIEW" && entry.fingerprint === snapshot.fingerprint && entry.prompt_version === Contract.prompt_version).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
    return snapshot;
  }
  function signature() { return Object.fromEntries(["contract_id", "request_contract", "result_contract", "operation", "adapter_version", "prompt_version", "request_config_version"].map((key) => [key, Contract[key]])); }
  function runtimeSnapshot(storage = globalThis.localStorage) {
    const gate = Gate.requireOperation("job_overview", Gate.operationAuthority("job_overview", storage));
    const descriptor = Gate.modelDescriptorForRuntime(gate.authority.runtime, "job_overview");
    return Runtime.createRuntimeSnapshot(gate.authority.runtime, { modelDescriptor: descriptor, snapshotId: id("runtime-job-overview"), capturedAt: now(),
      credentialRef: Gate.credentialFor(gate.authority.runtime), adapterVersion: descriptor.adapter_version, promptVersion: Contract.prompt_version,
      schemaVersion: Contract.contract_id, actionSchemaVersion: Contract.contract_id, requestConfigVersion: Contract.request_config_version,
      operation: Contract.operation, capabilityBasis: "adapter_verified", deliveryMethod: "compiled_context_text" });
  }
  function requestFor(phase, context, humanMessage, runtime, consent) {
    if (!consent || runtime?.mode !== "model" || !Gate.isModelRuntimeEligible({ mode: runtime.mode, provider: runtime.provider, model: runtime.model })) throw new Error("JOB_OVERVIEW_CONSENT_REQUIRED");
    if (!Contract.phases.includes(phase) || Context.bytes(context) > Contract.limits.context_bytes) throw new Error("JOB_OVERVIEW_CONTEXT_LIMIT");
    return { contract_id: Contract.request_contract, request_id: id("job-overview-request"), phase, context: clone(context), human_message: humanMessage, runtime_snapshot: runtime,
      consent: { confirmed: true, purpose: "JOB_OVERVIEW", provider: runtime.provider, model: runtime.model } };
  }
  async function callRuntime(request) {
    const check = await (globalThis.AriadneConnector || globalThis).fetch("/api/job-overview-signature", { cache: "no-store" }), checked = await check.json();
    if (!check.ok || !same(checked.runtime_signature, signature())) throw new Error("RUNTIME_CONTRACT_VERSION_MISMATCH");
    const response = await (globalThis.AriadneConnector || globalThis).fetch("/api/job-overview-turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "JOB_OVERVIEW_FAILED"); return result;
  }
  function validateResult(result, request) {
    if (result?.contract_id !== Contract.result_contract || result.request_id !== request.request_id || result.phase !== request.phase || result.runtime_snapshot_id !== request.runtime_snapshot.snapshot_id
      || result.provider !== request.runtime_snapshot.provider || result.model !== request.runtime_snapshot.model || result.authority !== "NON_AUTHORITATIVE_JOB_OVERVIEW" || result.network_call_made !== true || result.persistence !== "not_written") throw new Error("JOB_OVERVIEW_RESULT_INVALID");
    const output = result.output, refs = new Set(request.context.evidence.map((entry) => entry.ref));
    if (request.phase === "DISTILL") {
      if (!Array.isArray(output?.summaries) || output.summaries.length !== refs.size || new Set(output.summaries.map((entry) => entry.ref)).size !== refs.size) throw new Error("JOB_OVERVIEW_COVERAGE_INCOMPLETE");
      output.summaries.forEach((entry) => { if (!refs.has(entry.ref)) throw new Error("JOB_OVERVIEW_GROUNDING_INVALID"); text(entry.summary, 600); });
    } else {
      for (const insight of request.context.previous?.insights || []) insight.evidence_refs.forEach((ref) => refs.add(ref));
      text(output?.summary);
      if (!Array.isArray(output.insights) || output.insights.length > 8 || !Array.isArray(output.uncertainties) || output.uncertainties.length > 8) throw new Error("JOB_OVERVIEW_OUTPUT_INVALID");
      output.insights.forEach((entry) => { text(entry.text, 600); if (!Array.isArray(entry.evidence_refs) || !entry.evidence_refs.length || entry.evidence_refs.length > 8 || entry.evidence_refs.some((ref) => !refs.has(ref))) throw new Error("JOB_OVERVIEW_GROUNDING_INVALID"); });
      output.uncertainties.forEach((entry) => text(entry, 400));
    }
    return output;
  }
  function batches(entries, budget = 14000, maximum = 10) {
    const groups = []; let group = [], size = 0;
    for (const entry of entries) { const cost = Context.bytes(entry); if (group.length && (size + cost > budget || group.length >= maximum)) { groups.push(group); group = []; size = 0; } group.push(entry); size += cost; }
    if (group.length) groups.push(group); return groups;
  }
  async function refresh(db, { runtime_snapshot, consent, call = callRuntime, onProgress = () => {} }) {
    const snapshot = await snapshotFromDatabase(db);
    if (snapshot.overview || !snapshot.records.length) return { snapshot, calls: 0, usage: {}, cached: true };
    const fragments = [];
    for (const record of snapshot.records) {
      const parts = Context.splitText(JSON.stringify(record.semantic), Contract.limits.fragment_bytes);
      for (let index = 0; index < parts.length; index++) fragments.push({ fragment_id: await fingerprint({ identity: record.identity, hash: record.semantic_hash, index, prompt: Contract.prompt_version }), identity: record.identity, title: record.semantic.title, text: parts[index], part: index + 1, total_parts: parts.length });
    }
    const cache = new Map((await getAll(db, "job_overview_fragments")).filter((entry) => entry.authority === "NON_AUTHORITATIVE_JOB_DIGEST" && entry.prompt_version === Contract.prompt_version).map((entry) => [entry.fragment_id, entry]));
    const missing = fragments.filter((entry) => !cache.has(entry.fragment_id)), usage = {}; let calls = 0;
    const run = async (phase, context) => { const request = requestFor(phase, { scope: Contract.scope, ...context }, "", runtime_snapshot, consent); const result = await call(request), output = validateResult(result, request); calls++; for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"]) usage[key] = (usage[key] || 0) + (result.usage?.[key] || 0); return output; };
    const groups = batches(missing);
    for (let index = 0; index < groups.length; index++) {
      onProgress(`正在理解新增或变化的职位（${index + 1}/${groups.length}）…`);
      const group = groups[index], output = await run("DISTILL", { evidence: group.map((entry, at) => ({ ref: `fragment-${at + 1}`, title: entry.title, text: entry.text, part: entry.part, total_parts: entry.total_parts })) });
      for (let at = 0; at < group.length; at++) {
        const record = { fragment_id: group[at].fragment_id, summary: output.summaries.find((entry) => entry.ref === `fragment-${at + 1}`).summary, prompt_version: Contract.prompt_version, authority: "NON_AUTHORITATIVE_JOB_DIGEST", created_at: now() };
        try { await write(db, "job_overview_fragments", record); } catch (error) { if (error.name !== "ConstraintError") throw error; } cache.set(record.fragment_id, record);
      }
    }
    const digests = fragments.map((entry, index) => ({ ref: `digest-${index + 1}`, title: entry.title, summary: cache.get(entry.fragment_id).summary }));
    let previous = null; const groupsToSynthesize = batches(digests, 10000, 30);
    for (let index = 0; index < groupsToSynthesize.length; index++) { onProgress(`正在汇总全部职位（${index + 1}/${groupsToSynthesize.length}）…`); previous = await run("SYNTHESIZE", { evidence: groupsToSynthesize[index], previous, traversal: { part: index + 1, total_parts: groupsToSynthesize.length } }); }
    const fresh = await snapshotFromDatabase(db); if (fresh.fingerprint !== snapshot.fingerprint) throw new Error("JOB_OVERVIEW_CONTEXT_CHANGED");
    const overview = { overview_id: id("job-overview"), fingerprint: snapshot.fingerprint, prompt_version: Contract.prompt_version, authority: "NON_AUTHORITATIVE_JOB_OVERVIEW", created_at: now(), summary: previous.summary,
      insights: previous.insights.map((entry) => ({ text: entry.text, identities: [...new Set(entry.evidence_refs.map((ref) => fragments[digests.findIndex((item) => item.ref === ref)].identity))] })),
      uncertainties: previous.uncertainties, covered_jobs: snapshot.records.length, refreshed_fragments: missing.length, reused_fragments: fragments.length - missing.length, calls, usage };
    await write(db, "job_overview_snapshots", overview); return { snapshot: { ...fresh, overview }, calls, usage, cached: false };
  }
  function discussionContext(snapshot, message, turns) {
    const terms = Context.terms(message), ranked = snapshot.records.map((record) => ({ ...record, score: terms.reduce((n, term) => n + (JSON.stringify(record.semantic).toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
    const evidence = []; let bytes = 0, truncated = 0;
    for (const record of ranked) {
      let value = { ref: record.ref, ...record.semantic }, limited = false;
      if (Context.bytes(value) > 6000) { limited = true; value = { ...value, summary: value.summary?.slice(0, 1200) || null, requirements: value.requirements.slice(0, 12).map((entry) => ({ label: entry.label.slice(0, 100), detail: entry.detail.slice(0, 300) })), uncertainties: value.uncertainties.slice(0, 6) }; }
      const cost = Context.bytes(value); if (evidence.length >= 60 || bytes + cost > Contract.limits.evidence_bytes) continue; evidence.push(value); bytes += cost; if (limited) truncated++;
    }
    const context = { scope: Contract.scope, evidence, overview: snapshot.overview ? { authority: snapshot.overview.authority, summary: snapshot.overview.summary, uncertainties: snapshot.overview.uncertainties, covered_jobs: snapshot.overview.covered_jobs } : null,
      coverage: { total_jobs: snapshot.records.length, included_jobs: evidence.length, omitted_jobs: snapshot.records.length - evidence.length, truncated_jobs: truncated, strategy: "LEXICAL_WITH_BOUNDED_DETAIL", evidence_bytes: bytes },
      history: Context.boundedHistory(turns.filter((entry) => entry.fingerprint === snapshot.fingerprint).map((entry) => ({ ...entry, output: entry.output ? { message: [entry.output.message, ...(entry.output.insights || []).map((item) => item.text), ...(entry.output.uncertainties || [])].join("\n") } : null })), 4000) };
    if (Context.bytes(context) > Contract.limits.context_bytes) throw new Error("JOB_OVERVIEW_CONTEXT_LIMIT"); return context;
  }
  async function discuss(db, { human_message, ...options }) {
    const message = text(human_message, Contract.limits.human_message), turn = { turn_id: id("job-overview-turn"), created_at: now(), human_message: message, status: "SENDING", output: null };
    await write(db, "job_overview_turns", turn);
    try {
      const refreshed = await refresh(db, options), snapshot = refreshed.snapshot;
      const turns = (await getAll(db, "job_overview_turns")).sort((a, b) => a.created_at.localeCompare(b.created_at)), context = discussionContext(snapshot, message, turns);
      options.onProgress?.("正在结合全部职位概况回应…");
      const request = requestFor("DISCUSS", context, message, options.runtime_snapshot, options.consent), result = await (options.call || callRuntime)(request), output = validateResult(result, request);
      if ((await snapshotFromDatabase(db)).fingerprint !== snapshot.fingerprint) throw new Error("JOB_OVERVIEW_CONTEXT_CHANGED");
      const insights = output.insights.map((entry) => ({ text: entry.text, identities: entry.evidence_refs.map((ref) => snapshot.records.find((record) => record.ref === ref).identity) }));
      const completed = { ...turn, status: "SUCCEEDED", fingerprint: snapshot.fingerprint, output: { message: output.summary, insights, uncertainties: output.uncertainties }, context_coverage: context.coverage, context_bytes: Context.bytes(context), calls: refreshed.calls + 1, usage: result.usage || {}, refresh_usage: refreshed.usage };
      await write(db, "job_overview_turns", completed, true); return completed;
    } catch (error) { await write(db, "job_overview_turns", { ...turn, status: "FAILED", error_code: String(error.message).slice(0, 100) }, true); throw error; }
  }
  return Object.freeze({ Contract, STORES, INPUT_STORES, same, fingerprint, text, getAll, write, buildSnapshot, snapshotFromDatabase, signature, runtimeSnapshot, requestFor, callRuntime, validateResult, batches, refresh, discussionContext, discuss });
}));
