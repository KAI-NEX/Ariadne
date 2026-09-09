"use strict";

(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadnePersonalContext = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function create() {
  const bytes = (value) => new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).length;
  function terms(value) {
    const text = String(value || "").toLowerCase();
    const result = text.match(/[a-z0-9]{2,}/g) || [];
    for (const run of text.match(/[\p{Script=Han}]+/gu) || []) {
      for (let index = 0; index < run.length - 1; index++) result.push(run.slice(index, index + 2));
    }
    return [...new Set(result)];
  }
  function records(snapshot) {
    return ["confirmed", "working"].flatMap((layer) => (snapshot.provider_view[layer] || []).map((semantic, index) => ({
      ...snapshot[`${layer}_manifest`][index], ref: semantic.candidate_ref, semantic, layer,
    })));
  }
  function limited(record) {
    const item = structuredClone(record);
    for (const key of ["title", "subtitle", "time", "summary", "ownership"]) if (typeof item[key] === "string") item[key] = item[key].slice(0, key === "summary" ? 1800 : 1200);
    item.facts = (item.facts || []).slice(0, 20).map((fact) => ({ label: String(fact.label || "").slice(0, 100), value: String(fact.value || "").slice(0, 500) }));
    item.uncertainties = (item.uncertainties || []).slice(0, 8).map((entry) => ({ question: String(entry.question || "").slice(0, 500), affects: String(entry.affects || "").slice(0, 100), status: entry.status }));
    return item;
  }
  function select(snapshot, query, budget = 24000) {
    const all = records(snapshot), tokens = terms(query), seenSources = new Set();
    // This is a bounded retrieval heuristic, not semantic understanding. The
    // model receives explicit coverage and must not infer absent capability.
    const ranked = all.map((entry) => {
      const body = JSON.stringify(entry.semantic).toLowerCase();
      return { ...entry, score: tokens.reduce((sum, token) => sum + (body.includes(token) ? 1 : 0), 0)
        + (entry.semantic.item_type === "PERSONAL_MEMORY" ? 6 : 0) };
    }).sort((a, b) => b.score - a.score || a.identity.localeCompare(b.identity));
    const ordered = [], remainder = [];
    for (const entry of ranked) {
      const source = entry.source_ids?.[0] || entry.identity;
      if (!seenSources.has(source) || entry.semantic.item_type === "PERSONAL_MEMORY") { ordered.push(entry); seenSources.add(source); }
      else remainder.push(entry);
    }
    ordered.push(...remainder);
    const selected = new Map(), truncated = new Set();
    let used = 0;
    for (const entry of ordered) {
      const group = [entry, ...(entry.semantic.related_candidate_refs || []).map((ref) => all.find((item) => item.ref === ref)).filter(Boolean)];
      const additions = group.filter((item) => !selected.has(item.ref)).map((item) => {
        const semantic = bytes(item.semantic) > 6000 ? limited(item.semantic) : structuredClone(item.semantic);
        return { ...item, semantic, was_truncated: bytes(semantic) !== bytes(item.semantic) };
      });
      const cost = additions.reduce((sum, item) => sum + bytes(item.semantic) + 1, 0);
      if (used + cost > budget) continue;
      additions.forEach((item) => { selected.set(item.ref, item); if (item.was_truncated) truncated.add(item.ref); });
      used += cost;
    }
    const view = { confirmed: [], working: [], policy: snapshot.provider_view.policy };
    const manifests = { confirmed_manifest: [], working_manifest: [] };
    // Preserve original order/references for Job validation and grounding.
    for (const entry of all) if (selected.has(entry.ref)) {
      view[entry.layer].push(selected.get(entry.ref).semantic);
      manifests[`${entry.layer}_manifest`].push(snapshot[`${entry.layer}_manifest`].find((item) => item.identity === entry.identity));
    }
    const entries = [...view.confirmed, ...view.working];
    return {
      ...snapshot, ...manifests, provider_view: view,
      structural_counts: { candidate_snapshot_present: true, confirmed_count: view.confirmed.length, working_count: view.working.length,
        project_count: entries.filter((item) => String(item.item_type || item.item_subtype).toUpperCase() === "PROJECT").length,
        evidence_count: entries.filter((item) => item.facts?.length || String(item.summary || "").trim()).length },
      context_coverage: { strategy: "LEXICAL_DIVERSITY_WITH_CONFIRMED_MEMORY", total_records: all.length, included_records: entries.length,
        omitted_records: all.length - entries.length, truncated_records: truncated.size, evidence_bytes: used, budget_bytes: budget,
        complete: all.length === entries.length && !truncated.size },
    };
  }
  function boundedHistory(turns, budget = 6000) {
    const kept = []; let used = 0;
    for (const turn of [...turns].reverse()) {
      if (!turn.human_message || !turn.output?.message || turn.status !== "SUCCEEDED") continue;
      const item = { human: turn.human_message, assistant: turn.output.message };
      if (kept.length === 4 || used + bytes(item) > budget) break;
      kept.unshift(item); used += bytes(item);
    }
    return kept;
  }
  function splitText(value, budget = 6000) {
    const chunks = []; let part = "", size = 0;
    for (const character of String(value)) {
      const cost = bytes(character);
      if (size + cost > budget) { chunks.push(part); part = ""; size = 0; }
      part += character; size += cost;
    }
    if (part) chunks.push(part);
    return chunks;
  }
  return Object.freeze({ bytes, terms, records, limited, select, boundedHistory, splitText });
}));
