"use strict";

(function attachLocalCandidateReview(root, factory) {
  const truth = root.AriadneTruthPersistence || (typeof module === "object" && module.exports ? require("./truth-persistence-domain.js") : null);
  const lifecycle = root.AriadneLocalContextLifecycle || (typeof module === "object" && module.exports ? require("./local-context-lifecycle-domain.js") : null);
  const api = factory(truth, lifecycle);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneLocalCandidateReview = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createLocalCandidateReview(Truth, Lifecycle) {
  if (!Truth || !Lifecycle) throw new Error("candidate_review_dependencies_required");
  const id = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const now = () => new Date().toISOString();

  function getAll(database, storeName) {
    return new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("persistence_read_failed"));
    });
  }

  const safeIdPart = (value) => String(value || "item").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
  function contextIdFor(proposal) {
    const itemId = proposal?.payload?.items?.[0]?.item_id;
    return `candidate-context-${safeIdPart(proposal.source_document_ids[0])}-${safeIdPart(itemId)}`;
  }
  function latestRevision(revisions, contextId) {
    return (revisions || []).filter((item) => item.context_id === contextId).sort((a, b) => b.version - a.version)[0] || null;
  }
  function latestConfirmedRevisions(revisions) {
    const latest = new Map();
    (revisions || []).filter((item) => item.context_type === "CANDIDATE" && item.authority === Truth.AUTHORITY.revision).forEach((item) => {
      const current = latest.get(item.context_id);
      if (!current || item.version > current.version) latest.set(item.context_id, item);
    });
    return [...latest.values()];
  }
  function candidateItemKey(contextId, itemId) { return `${contextId}|${itemId}`; }
  function removedItemKeys(lifecycleRecords) {
    return new Set((lifecycleRecords || []).filter((record) => record?.state === "REMOVED" && record?.authority === Truth.AUTHORITY.lifecycle).map((record) => candidateItemKey(record.context_id, record.item_id)));
  }
  function activeConfirmedRevisions(revisions, lifecycleRecords) {
    const removed = removedItemKeys(lifecycleRecords);
    return latestConfirmedRevisions(revisions).map((revision) => ({
      ...revision,
      payload: { ...revision.payload, items: (revision.payload.items || []).filter((item) => !removed.has(candidateItemKey(revision.context_id, item.item_id))) },
    })).filter((revision) => revision.payload.items.length);
  }
  function splitPendingProposal(proposal) {
    const items = proposal?.payload?.items || [];
    if (proposal?.status !== "AWAITING_REVIEW" || items.length <= 1) return [proposal];
    return items.map((item, index) => Truth.validateProposal({
      ...structuredClone(proposal),
      proposal_id: `${proposal.proposal_id}-item-${index + 1}-${safeIdPart(item.item_id)}`,
      payload: { ...structuredClone(proposal.payload), items: [structuredClone(item)], manual_review_required: item.confidence === "low" || Boolean(item.warnings?.length), unstructured_evidence_reason: null },
      grounding_refs: structuredClone(item.grounding_refs || proposal.grounding_refs),
      warnings: [...new Set([...(proposal.warnings || []), ...(item.warnings || [])])],
      uncertainties: structuredClone(item.uncertainties || []),
    }));
  }
  function ensureItemProposalQueue(database, proposals) {
    const targets = (proposals || []).filter((proposal) => proposal.status === "AWAITING_REVIEW" && proposal.payload?.items?.length > 1);
    if (!targets.length) return Promise.resolve(proposals || []);
    const replacements = targets.flatMap(splitPendingProposal);
    const targetIds = new Set(targets.map((proposal) => proposal.proposal_id));
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("context_proposals", "readwrite");
      const store = transaction.objectStore("context_proposals");
      targets.forEach((proposal) => store.put(structuredClone({ ...proposal, status: "SUPERSEDED" })));
      replacements.forEach((proposal) => store.put(structuredClone(proposal)));
      transaction.oncomplete = () => resolve([...(proposals || []).filter((proposal) => !targetIds.has(proposal.proposal_id)), ...replacements]);
      transaction.onerror = () => reject(transaction.error || new Error("candidate_review_queue_migration_failed"));
      transaction.onabort = () => reject(transaction.error || new Error("candidate_review_queue_migration_aborted"));
    });
  }
  function reviewDecision(proposal, decision, acceptedPayload, reviewedAt = now()) {
    if (decision === "CONFIRM" && !proposal.payload.items?.length) throw new Error("empty_manual_proposal_confirm_forbidden");
    return Truth.validateReviewDecision({ contract_id: "ariadne-context-review-decision-v1", review_id: id("review-candidate"), proposal_id: proposal.proposal_id, decision, reviewed_at: reviewedAt, accepted_payload: decision === "REJECT" ? null : acceptedPayload, authority: Truth.AUTHORITY.review });
  }
  function editedPayload(proposal, items) {
    if (!Array.isArray(items) || !items.length || items.some((item) => !String(item.title || "").trim())) throw new Error("edited_candidate_items_required");
    return { ...structuredClone(proposal.payload), items: structuredClone(items), manual_review_required: false, unstructured_evidence_reason: null, user_edits: [{ support_relation: "USER_CONFIRMED", edited_at: now(), paths: items.flatMap((_, index) => [`/items/${index}`]) }] };
  }
  function outcomeFor({ proposal, decision, acceptedPayload, currentRevision }) {
    const review = reviewDecision(proposal, decision, acceptedPayload);
    if (decision === "REJECT") return Truth.applyReviewDecision({ proposal, review_decision: review });
    const contextId = contextIdFor(proposal);
    return Truth.applyReviewDecision({ proposal, review_decision: review, current_revision: currentRevision, expected_version: currentRevision?.version || 0, context_id: contextId, revision_id: `${contextId}-v${(currentRevision?.version || 0) + 1}-${id("revision").slice(-8)}` });
  }
  async function persistDecision(database, proposal, decision, acceptedPayload) {
    const revisions = await getAll(database, "candidate_context_revisions");
    const currentRevision = latestRevision(revisions, contextIdFor(proposal));
    const outcome = outcomeFor({ proposal, decision, acceptedPayload, currentRevision });
    return Truth.persistReviewOutcome(database, outcome);
  }

  function userEditOutcome(currentRevision, itemId, editedItem, reviewedAt = now()) {
    const current = Truth.validateContextRevision(currentRevision);
    if (current.context_type !== "CANDIDATE" || !String(editedItem?.title || "").trim()) throw new Error("candidate_user_edit_invalid");
    const itemIndex = (current.payload.items || []).findIndex((item) => item.item_id === itemId);
    if (itemIndex < 0) throw new Error("candidate_item_not_found");
    const payload = structuredClone(current.payload);
    payload.items[itemIndex] = structuredClone(editedItem);
    payload.user_edits = [...(payload.user_edits || []), { support_relation: "USER_CONFIRMED", edited_at: reviewedAt, paths: [`/items/${itemIndex}`] }];
    const review = Truth.validateReviewDecision({ contract_id: "ariadne-context-review-decision-v1", review_id: id("review-candidate-edit"), proposal_id: current.confirmed_from_proposal_id, decision: "EDIT_AND_CONFIRM", reviewed_at: reviewedAt, accepted_payload: payload, authority: Truth.AUTHORITY.review });
    const revision = Truth.validateContextRevision({ ...current, revision_id: `${current.context_id}-v${current.version + 1}-${id("revision").slice(-8)}`, version: current.version + 1, previous_revision_id: current.revision_id, review_decision_id: review.review_id, created_at: reviewedAt, payload });
    return Object.freeze({ review_decision: review, revision });
  }

  function persistUserEdit(database, currentRevision, itemId, editedItem) {
    const outcome = userEditOutcome(currentRevision, itemId, editedItem);
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["context_review_decisions", "candidate_context_revisions"], "readwrite");
      let contractError = null;
      const request = transaction.objectStore("candidate_context_revisions").getAll();
      request.onsuccess = () => {
        const head = latestRevision(request.result || [], outcome.revision.context_id);
        if (!head || head.revision_id !== currentRevision.revision_id || head.version !== currentRevision.version) {
          contractError = new Error("context_version_conflict");
          transaction.abort();
          return;
        }
        transaction.objectStore("context_review_decisions").add(structuredClone(outcome.review_decision));
        transaction.objectStore("candidate_context_revisions").add(structuredClone(outcome.revision));
      };
      request.onerror = () => { contractError = request.error || new Error("candidate_revision_read_failed"); transaction.abort(); };
      transaction.oncomplete = () => resolve(outcome);
      transaction.onerror = () => reject(contractError || transaction.error || new Error("candidate_user_edit_failed"));
      transaction.onabort = () => reject(contractError || transaction.error || new Error("candidate_user_edit_aborted"));
    });
  }

  function removalRecord(currentRevision, itemId, removedAt = now()) {
    const current = Truth.validateContextRevision(currentRevision);
    if (current.context_type !== "CANDIDATE") throw new Error("candidate_context_removal_type_invalid");
    if (!(current.payload.items || []).some((item) => item.item_id === itemId)) throw new Error("candidate_item_not_found");
    return Truth.validateCandidateContextLifecycle({
      contract_id: "ariadne-candidate-context-lifecycle-v1",
      lifecycle_id: id("candidate-context-removal"),
      context_id: current.context_id,
      item_id: itemId,
      state: "REMOVED",
      removed_from_revision_id: current.revision_id,
      removed_at: removedAt,
      reason: "USER_REMOVED",
      authority: Truth.AUTHORITY.lifecycle,
    });
  }

  function persistRemoval(database, currentRevision, itemId) {
    const removal = removalRecord(currentRevision, itemId);
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["candidate_context_revisions", "candidate_context_lifecycle"], "readwrite");
      let contractError = null;
      let revisions = null;
      let lifecycleRecords = null;
      const abortWith = (error) => { contractError = error; transaction.abort(); };
      const writeWhenReady = () => {
        if (!revisions || !lifecycleRecords) return;
        const head = latestRevision(revisions, removal.context_id);
        if (!head || head.revision_id !== currentRevision.revision_id || head.version !== currentRevision.version) return abortWith(new Error("context_version_conflict"));
        if (removedItemKeys(lifecycleRecords).has(candidateItemKey(removal.context_id, removal.item_id))) return abortWith(new Error("candidate_item_already_removed"));
        transaction.objectStore("candidate_context_lifecycle").add(structuredClone(removal));
      };
      const revisionRequest = transaction.objectStore("candidate_context_revisions").getAll();
      revisionRequest.onsuccess = () => { revisions = revisionRequest.result || []; writeWhenReady(); };
      revisionRequest.onerror = () => abortWith(revisionRequest.error || new Error("candidate_revision_read_failed"));
      const lifecycleRequest = transaction.objectStore("candidate_context_lifecycle").getAll();
      lifecycleRequest.onsuccess = () => { lifecycleRecords = lifecycleRequest.result || []; writeWhenReady(); };
      lifecycleRequest.onerror = () => abortWith(lifecycleRequest.error || new Error("candidate_lifecycle_read_failed"));
      transaction.oncomplete = () => resolve(removal);
      transaction.onerror = () => reject(contractError || transaction.error || new Error("candidate_context_removal_failed"));
      transaction.onabort = () => reject(contractError || transaction.error || new Error("candidate_context_removal_aborted"));
    });
  }

  function sourceImportState(sourceId, records) {
    const sourceExists = (records.source_documents || []).some((source) => source.source_document_id === sourceId);
    if (!sourceExists) return "NEW";
    const proposals = (records.context_proposals || []).filter((proposal) => proposal.proposal_type === "CANDIDATE_CONTEXT" && proposal.source_document_ids?.includes(sourceId));
    const activeFromSource = activeConfirmedRevisions(records.candidate_context_revisions || [], records.candidate_context_lifecycle || []).some((revision) => revision.provenance?.source_document_ids?.includes(sourceId));
    const runs = (records.processing_runs || []).filter((run) => run.source_document_id === sourceId).sort((a, b) => String(b.finished_at || b.started_at || "").localeCompare(String(a.finished_at || a.started_at || "")));
    return Lifecycle.deriveSourceState({
      sourceExists,
      hasPending: proposals.some((proposal) => proposal.status === "AWAITING_REVIEW"),
      hasActive: activeFromSource || proposals.some((proposal) => ["ACCEPTED", "REJECTED"].includes(proposal.status)),
      lastRunStatus: runs[0]?.status || null,
    });
  }

  function legacySourceIdFor(record) {
    return (record?.source_refs || []).map((ref) => ref.source_document_id).find(Boolean)
      || record?.imported_from?.source_document_id
      || null;
  }

  async function removeLegacyContext(storage, storeName, itemId) {
    const record = await storage.get(storeName, itemId);
    if (!record) throw new Error("candidate_item_not_found");
    await storage.remove(storeName, itemId);
    return record;
  }

  async function hardDeleteLegacySource(storage, storeName, sourceId, sourceStoreName = "source_documents") {
    if (!String(sourceId || "").trim()) throw new Error("candidate_source_identity_required");
    const records = await storage.getAll(storeName);
    const related = Lifecycle.recordsForSource(records, sourceId, legacySourceIdFor);
    if (!related.length) throw new Error("candidate_source_not_found");
    await Promise.all(related.map((record) => storage.remove(storeName, record.item_id)));
    await storage.remove(sourceStoreName, sourceId);
    return Object.freeze({ source_document_id: sourceId, removed_item_ids: related.map((record) => record.item_id) });
  }

  function sourceHardDeletePlan(records, sourceId) {
    if (!String(sourceId || "").trim()) throw new Error("candidate_source_identity_required");
    const proposals = (records.context_proposals || []).filter((proposal) => proposal.source_document_ids?.includes(sourceId));
    const proposalIds = new Set(proposals.map((proposal) => proposal.proposal_id));
    const revisions = (records.candidate_context_revisions || []).filter((revision) => revision.provenance?.source_document_ids?.includes(sourceId));
    const revisionIds = new Set(revisions.map((revision) => revision.revision_id));
    const contextIds = new Set(revisions.map((revision) => revision.context_id));
    return Object.freeze({
      source_documents: (records.source_documents || []).filter((source) => source.source_document_id === sourceId).map((source) => source.source_document_id),
      extraction_artifacts: (records.extraction_artifacts || []).filter((artifact) => artifact.source_document_id === sourceId).map((artifact) => artifact.artifact_id),
      processing_runs: (records.processing_runs || []).filter((run) => run.source_document_id === sourceId).map((run) => run.run_id),
      context_proposals: proposals.map((proposal) => proposal.proposal_id),
      context_review_decisions: (records.context_review_decisions || []).filter((review) => proposalIds.has(review.proposal_id)).map((review) => review.review_id),
      candidate_context_revisions: [...revisionIds],
      candidate_context_lifecycle: (records.candidate_context_lifecycle || []).filter((record) => contextIds.has(record.context_id) || revisionIds.has(record.removed_from_revision_id)).map((record) => record.lifecycle_id),
    });
  }

  function persistSourceHardDelete(database, sourceId) {
    const stores = ["source_documents", "extraction_artifacts", "processing_runs", "context_proposals", "context_review_decisions", "candidate_context_revisions", "candidate_context_lifecycle"];
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(stores, "readwrite");
      const records = {};
      let pending = stores.length;
      let contractError = null;
      const abortWith = (error) => { if (contractError) return; contractError = error; transaction.abort(); };
      const deleteWhenReady = () => {
        pending -= 1;
        if (pending) return;
        const plan = sourceHardDeletePlan(records, sourceId);
        if (!plan.source_documents.length) return abortWith(new Error("candidate_source_not_found"));
        Object.entries(plan).forEach(([storeName, keys]) => keys.forEach((key) => transaction.objectStore(storeName).delete(key)));
        transaction.__candidateDeletePlan = plan;
      };
      stores.forEach((storeName) => {
        const request = transaction.objectStore(storeName).getAll();
        request.onsuccess = () => { records[storeName] = request.result || []; deleteWhenReady(); };
        request.onerror = () => abortWith(request.error || new Error("candidate_source_delete_read_failed"));
      });
      transaction.oncomplete = () => resolve(transaction.__candidateDeletePlan);
      transaction.onerror = () => reject(contractError || transaction.error || new Error("candidate_source_delete_failed"));
      transaction.onabort = () => reject(contractError || transaction.error || new Error("candidate_source_delete_aborted"));
    });
  }

  return Object.freeze({ getAll, contextIdFor, latestRevision, latestConfirmedRevisions, candidateItemKey, removedItemKeys, activeConfirmedRevisions, splitPendingProposal, ensureItemProposalQueue, reviewDecision, editedPayload, outcomeFor, persistDecision, userEditOutcome, persistUserEdit, removalRecord, persistRemoval, sourceImportState, legacySourceIdFor, removeLegacyContext, hardDeleteLegacySource, sourceHardDeletePlan, persistSourceHardDelete });
}));
