"use strict";

(function attach(root, factory) {
  const api = factory(root.AriadneTruthPersistence || (typeof module === "object" ? require("./truth-persistence-domain.js") : null),
    () => root.AriadneJobCandidateContext || (typeof module === "object" ? require("./job-candidate-context-domain.js") : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadnePersonalMemory = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function create(Truth, candidateContext) {
  const REVISION_AUTHORITY = "HUMAN_CONFIRMED_PERSONAL_MEMORY";
  const STORES = ["personal_memory_revisions", "personal_memory_proposals", "personal_memory_decisions", "personal_understanding_fragments", "personal_understanding_snapshots", "personal_conversation_turns"];
  const EVIDENCE_STORES = ["candidate_context_revisions", "candidate_context_lifecycle", "candidate_working_models", "candidate_workspace_acceptances", "career_entities", "career_evidence", "source_documents"];
  const id = (prefix) => `${prefix}-${globalThis.crypto.randomUUID()}`;
  const now = () => new Date().toISOString();
  const clone = (value) => structuredClone(value);
  const text = (value, max = 1200) => {
    if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("personal_memory_text_invalid");
    return value.trim();
  };
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  function evidenceSemantic(value) {
    const result = clone(value);
    for (const key of ["candidate_ref", "authority", "source_availability", "related_candidate_refs"]) delete result[key];
    return result;
  }
  function latest(records) {
    const heads = new Map();
    for (const record of records || []) {
      if (record.authority !== REVISION_AUTHORITY) continue;
      const prior = heads.get(record.memory_id);
      if (!prior || record.version > prior.version) heads.set(record.memory_id, record);
    }
    return [...heads.values()];
  }
  function active(records, evidence = null) {
    const identities = evidence && new Set(evidence.map((entry) => entry.identity));
    return latest(records).filter((record) => record.status === "ACTIVE"
      && (!identities || !record.related_identities?.length || record.related_identities.every((identity) => identities.has(identity)))
      && (!evidence || (record.evidence_bindings || []).every((binding) => {
        const current = evidence.find((entry) => entry.identity === binding.identity);
        return current && same(current.lineage, binding.lineage) && same(evidenceSemantic(current.semantic), binding.semantic);
      })));
  }
  function validateRevision(record) {
    if (!record || record.contract_id !== "ariadne-personal-memory-revision-v1" || record.authority !== REVISION_AUTHORITY
      || !["ACTIVE", "RETRACTED"].includes(record.status) || !["FACT", "PREFERENCE", "GOAL", "CORRECTION"].includes(record.kind)
      || !Number.isInteger(record.version) || record.version < 1 || !Array.isArray(record.related_identities)) throw new Error("personal_memory_revision_invalid");
    for (const field of ["memory_id", "revision_id", "decision_id", "created_at"]) text(record[field], 300);
    text(record.text);
    return clone(record);
  }
  function getAll(database, name) {
    if (!database.objectStoreNames.contains(name)) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const request = database.transaction(name, "readonly").objectStore(name).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("personal_memory_read_failed"));
    });
  }
  function write(database, name, record, { replace = false } = {}) {
    if (!STORES.includes(name)) throw new Error("personal_memory_store_invalid");
    if (replace && name !== "personal_conversation_turns") throw new Error("personal_memory_history_immutable");
    return new Promise((resolve, reject) => {
      const tx = database.transaction(name, "readwrite");
      tx.objectStore(name)[replace ? "put" : "add"](clone(record));
      tx.oncomplete = () => resolve(record);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("personal_memory_write_failed"));
    });
  }
  function createProposal(raw, { human_message, origin, memories = [], evidence = [] }) {
    if (!raw || !["ADD", "REPLACE", "RETRACT"].includes(raw.operation) || !["FACT", "PREFERENCE", "GOAL", "CORRECTION"].includes(raw.kind)) throw new Error("personal_memory_proposal_invalid");
    const quote = text(raw.human_quote, 1200);
    if (!human_message.includes(quote)) throw new Error("personal_memory_quote_not_in_user_message");
    const target = raw.target_memory_ref ? memories.find((entry) => entry.ref === raw.target_memory_ref) : null;
    if ((raw.operation === "ADD" && raw.target_memory_ref) || (raw.operation !== "ADD" && !target)) throw new Error("personal_memory_target_invalid");
    if (!Array.isArray(raw.related_refs) || raw.related_refs.length > 8) throw new Error("personal_memory_evidence_invalid");
    const bindings = raw.related_refs.length ? raw.related_refs.map((ref) => {
      const entry = evidence.find((item) => item.ref === ref);
      if (!entry) throw new Error("personal_memory_evidence_invalid");
      return { identity: entry.identity, semantic: evidenceSemantic(entry.semantic), lineage: clone(entry.lineage) };
    }) : clone(target?.evidence_bindings || []);
    return Object.freeze({
      contract_id: "ariadne-personal-memory-proposal-v1", proposal_id: id("personal-proposal"),
      authority: "NON_AUTHORITATIVE_PROPOSAL", created_at: now(),
      operation: raw.operation, kind: raw.kind, text: text(raw.text), reason: text(raw.reason, 800), human_quote: quote,
      human_message: text(human_message, 6000), origin: clone(origin),
      target_memory_id: target?.memory_id || null, expected_version: target?.version || 0,
      before_text: target?.text || null, evidence_bindings: bindings,
      related_identities: bindings.length ? bindings.map((entry) => entry.identity) : [...(target?.related_identities || [])],
    });
  }
  async function decide(database, proposalId, decision, editedText = null) {
    if (!["SAVE", "REJECT"].includes(decision)) throw new Error("personal_memory_decision_invalid");
    const stores = [...new Set([...EVIDENCE_STORES.filter((name) => database.objectStoreNames.contains(name)), "personal_memory_revisions", "personal_memory_proposals", "personal_memory_decisions"])];
    return new Promise((resolve, reject) => {
      const tx = database.transaction(stores, "readwrite");
      const records = {};
      let pending = stores.length, result, failure;
      const fail = (error) => { failure = error; tx.abort(); };
      const apply = () => {
        try {
          const proposal = records.personal_memory_proposals.find((entry) => entry.proposal_id === proposalId);
          if (!proposal || proposal.authority !== "NON_AUTHORITATIVE_PROPOSAL" || !proposal.human_message.includes(proposal.human_quote)) throw new Error("personal_memory_proposal_invalid");
          if (records.personal_memory_decisions.some((entry) => entry.proposal_id === proposalId)) throw new Error("personal_memory_already_decided");
          const current = latest(records.personal_memory_revisions).find((entry) => entry.memory_id === proposal.target_memory_id);
          const decisionRecord = { decision_id: id("personal-decision"), proposal_id: proposalId, decision, created_at: now(), authority: "AUTHORITATIVE_USER_DECISION" };
          let revision = null;
          if (decision === "SAVE") {
            if ((current?.version || 0) !== proposal.expected_version || (current && current.status !== "ACTIVE")) throw new Error("personal_memory_version_conflict");
            const Context = candidateContext();
            const available = [...Context.confirmedRecords({ ...records, personal_memory_revisions: [] }), ...Context.workingRecords(records)];
            for (const binding of proposal.operation === "RETRACT" ? [] : proposal.evidence_bindings) {
              const entry = available.find((item) => item.identity === binding.identity);
              if (!entry || !same(entry.semantic, binding.semantic) || !same(entry.lineage, binding.lineage)) throw new Error("personal_memory_evidence_changed");
            }
            if (proposal.operation !== "RETRACT" && (proposal.related_identities || []).some((identity) => !available.some((entry) => entry.identity === identity))) throw new Error("personal_memory_evidence_changed");
            if (proposal.operation === "ADD" && active(records.personal_memory_revisions, available).some((entry) => entry.kind === proposal.kind
              && entry.text === text(editedText ?? proposal.text) && same([...entry.related_identities].sort(), [...proposal.related_identities].sort()))) throw new Error("personal_memory_already_saved");
            revision = validateRevision({
              contract_id: "ariadne-personal-memory-revision-v1", revision_id: id("personal-revision"),
              memory_id: current?.memory_id || id("personal-memory"), version: (current?.version || 0) + 1,
              previous_revision_id: current?.revision_id || null, decision_id: decisionRecord.decision_id,
              status: proposal.operation === "RETRACT" ? "RETRACTED" : "ACTIVE", kind: proposal.kind,
              text: text(editedText ?? proposal.text), related_identities: clone(proposal.related_identities || []),
              evidence_bindings: clone(proposal.evidence_bindings || []),
              origin: clone(proposal.origin), human_quote: proposal.human_quote, created_at: decisionRecord.created_at, authority: REVISION_AUTHORITY,
            });
            tx.objectStore("personal_memory_revisions").add(clone(revision));
          }
          tx.objectStore("personal_memory_decisions").add(decisionRecord);
          result = { decision: decisionRecord, revision };
        } catch (error) { fail(error); }
      };
      stores.forEach((name) => {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => { records[name] = request.result || []; if (--pending === 0) apply(); };
        request.onerror = () => fail(request.error || new Error("personal_memory_read_failed"));
      });
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(failure || tx.error || new Error("personal_memory_save_failed"));
    });
  }
  return Object.freeze({ REVISION_AUTHORITY, STORES, EVIDENCE_STORES, id, now, text, canonical, same, latest, active, validateRevision, getAll, write, createProposal, decide });
}));
