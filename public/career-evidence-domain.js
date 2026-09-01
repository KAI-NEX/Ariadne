(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CareerEvidenceDomain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ENTITY_CONTRACT_ID = "job-radar-career-entity-v1";
  const EVIDENCE_CONTRACT_ID = "job-radar-career-evidence-v1";
  const PROFILE_FORMAT = "job-radar-career-profile-v1";
  const CAREER_INTELLIGENCE_CONTRACT_ID = "job-radar-career-intelligence-v0";
  const INTELLIGENCE_STATUSES = ["needs_review", "confirmed", "rejected"];
  const CAPABILITY_STATES = ["PROVEN", "EMERGING", "TOOL_ASSISTED", "UNDERSTOOD", "UNVERIFIED", "MISSING_EVIDENCE"];

  function timestamp(now) {
    return (now || new Date()).toISOString();
  }

  function nonEmpty(value, field) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`invalid_${field}`);
    return value.trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  function createCareerEntities(sourceDocument, extractionRun, proposals, now) {
    const sourceId = nonEmpty(sourceDocument?.source_document_id, "source_document_id");
    if (!Array.isArray(proposals)) throw new Error("candidate_entities_required");
    const createdAt = timestamp(now);
    return proposals.map((proposal, index) => {
      const entityId = nonEmpty(proposal.entity_id, "entity_id");
      const entityType = nonEmpty(proposal.entity_type, "entity_type");
      if (!proposal.data || typeof proposal.data !== "object" || Array.isArray(proposal.data)) throw new Error("invalid_entity_data");
      return {
        ...clone(proposal),
        entity_id: entityId,
        contract_id: ENTITY_CONTRACT_ID,
        entity_type: entityType,
        order: Number.isInteger(proposal.order) ? proposal.order : index,
        source_document_ids: [...new Set([...(proposal.source_document_ids || []), sourceId])],
        extraction: {
          ...(proposal.extraction || {}),
          run_id: extractionRun?.extraction_run_id || proposal.extraction?.run_id || null,
        },
        review_status: "needs_review",
        created_at: createdAt,
        updated_at: createdAt,
        reviewed_at: null,
        review_note: null,
      };
    });
  }

  function reviewEntity(entity, action, editedData, reviewNote, now) {
    if (!entity || entity.review_status !== "needs_review") throw new Error("entity_not_reviewable");
    if (!["approve", "reject"].includes(action)) throw new Error("invalid_review_action");
    if (action === "approve" && (!editedData || typeof editedData !== "object" || Array.isArray(editedData))) throw new Error("invalid_entity_data");
    const reviewedAt = timestamp(now);
    const beforeData = clone(entity.data);
    const afterData = action === "reject" ? beforeData : clone(editedData);
    const actualAction = action === "approve" && stableJson(beforeData) !== stableJson(afterData) ? "edit_and_approve" : action;
    const note = typeof reviewNote === "string" && reviewNote.trim() ? reviewNote.trim() : null;
    const reviewed = {
      ...entity,
      data: afterData,
      review_status: action === "reject" ? "rejected" : "confirmed",
      updated_at: reviewedAt,
      reviewed_at: reviewedAt,
      review_note: note,
    };
    return {
      entity: reviewed,
      decision: {
        decision_id: `entity-decision-${entity.entity_id}-${reviewedAt}`,
        entity_id: entity.entity_id,
        action: actualAction,
        before_data: beforeData,
        after_data: afterData,
        review_note: note,
        reviewed_at: reviewedAt,
        actor: "human_user",
      },
    };
  }

  function reopenEntity(entity, reviewNote, now) {
    if (!entity || entity.review_status !== "confirmed") throw new Error("entity_not_confirmed");
    const reopenedAt = timestamp(now);
    const note = typeof reviewNote === "string" && reviewNote.trim() ? reviewNote.trim() : "reopened_for_edit";
    return {
      entity: { ...entity, review_status: "needs_review", updated_at: reopenedAt, reviewed_at: null, review_note: note },
      decision: {
        decision_id: `entity-decision-${entity.entity_id}-${reopenedAt}`,
        entity_id: entity.entity_id,
        action: "reopen",
        before_data: clone(entity.data),
        after_data: clone(entity.data),
        review_note: note,
        reviewed_at: reopenedAt,
        actor: "human_user",
      },
    };
  }

  function confirmedEntities(records) {
    return (records || []).filter((record) => record.contract_id === ENTITY_CONTRACT_ID && record.review_status === "confirmed");
  }

  function anchorsFor(entity, paths) {
    const anchors = [];
    const seen = new Set();
    for (const path of paths) {
      for (const anchor of entity.field_provenance?.[path] || []) {
        if (!seen.has(anchor.anchor_id)) {
          seen.add(anchor.anchor_id);
          anchors.push(clone(anchor));
        }
      }
    }
    return anchors;
  }

  function evidenceRecord(entity, suffix, claim, paths, now) {
    const anchors = anchorsFor(entity, paths);
    return {
      evidence_id: `${entity.entity_id}-evidence-${suffix}`,
      contract_id: EVIDENCE_CONTRACT_ID,
      claim,
      evidence_type: entity.entity_type === "project" ? "project" : entity.entity_type === "work_experience" ? "experience" : "capability",
      capability_category: entity.entity_type,
      source_entity_id: entity.entity_id,
      source_document_ids: [...(entity.source_document_ids || [])],
      source_field_paths: paths,
      source_anchors: anchors,
      source_location: [...new Set(anchors.map((anchor) => anchor.source_location))].join("; ") || "entity-level provenance",
      source_excerpt_or_reference: anchors.map((anchor) => anchor.source_excerpt).join(" ") || claim,
      verification_status: "confirmed",
      confidence: entity.extraction?.confidence || "unknown",
      limitations: [...(entity.limitations || [])],
      derivation_method: "confirmed_entity_direct_projection",
      derivation_version: "v1",
      source_entity_updated_at: entity.updated_at,
      created_at: timestamp(now),
      updated_at: timestamp(now),
    };
  }

  function deriveCareerEvidence(records, now) {
    const evidence = [];
    const meaningful = (value) => typeof value === "string" && value.trim().length >= 6 && !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(value);
    for (const entity of confirmedEntities(records)) {
      const data = entity.data || {};
      if (entity.entity_type === "work_experience") {
        const context = [data.position, data.name].filter(Boolean).join(" · ");
        const groups = [
          ["responsibility", "responsibilities", data.responsibilities || []],
          ["achievement", "achievements", data.achievements || []],
          ["highlight", "unclassified_highlights", data.unclassified_highlights || []],
        ];
        groups.forEach(([suffix, field, items]) => items.filter(meaningful).forEach((item, index) => evidence.push(evidenceRecord(entity, `${suffix}-${index + 1}`, `${context}：${item}`, ["/position", "/name", `/${field}/${index}`], now))));
      } else if (entity.entity_type === "project") {
        const groups = [
          ["responsibility", "responsibilities", data.responsibilities || []],
          ["process", "process", data.process || []],
          ["output", "outputs", data.outputs || []],
          ["outcome", "outcomes", data.outcomes || []],
          ["highlight", "unclassified_highlights", data.unclassified_highlights || []],
        ];
        let derived = 0;
        groups.forEach(([suffix, field, items]) => items.filter(meaningful).forEach((item, index) => {
          evidence.push(evidenceRecord(entity, `${suffix}-${index + 1}`, `${data.name}：${item}`, ["/name", `/${field}/${index}`], now));
          derived += 1;
        }));
        if (!derived && meaningful(data.context)) evidence.push(evidenceRecord(entity, "context", `${data.name}：${data.context}`, ["/name", "/context"], now));
      } else if (entity.entity_type === "education") {
        const claim = [data.institution, [data.area, data.studyType].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
        if (claim) evidence.push(evidenceRecord(entity, "education", claim, ["/institution", "/area", "/studyType", "/rawDate"], now));
      } else if (entity.entity_type === "skill_group") {
        const keywords = Array.isArray(data.keywords) ? data.keywords.filter(Boolean) : [];
        if (data.name && keywords.length) evidence.push(evidenceRecord(entity, "skills", `${data.name}：${keywords.join("、")}`, ["/name", "/keywords"], now));
      } else if (entity.entity_type === "language" && data.language) {
        evidence.push(evidenceRecord(entity, "language", `语言：${data.language}${data.fluency ? `（${data.fluency}）` : ""}`, ["/language", "/fluency"], now));
      }
    }
    return evidence;
  }

  function entitySetHash(records) {
    return confirmedEntities(records).map((entity) => `${entity.entity_id}:${entity.updated_at}`).sort().join("|");
  }

  function cleanObject(value) {
    if (Array.isArray(value)) return value.map(cleanObject).filter((item) => item !== "" && item != null);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item != null).map(([key, item]) => [key, cleanObject(item)]));
  }

  function buildCareerProfile(records, sourceDocuments, now) {
    const confirmed = confirmedEntities(records);
    const basicsEntity = confirmed.find((entity) => entity.entity_type === "basics");
    const evidence = deriveCareerEvidence(confirmed, now);
    const profile = {
      profile_id: "career-profile-local-v1",
      profile_version: "1.0",
      format: PROFILE_FORMAT,
      generated_at: timestamp(now),
      review_status: confirmed.length ? "derived_from_confirmed_entities" : "empty",
      source_entity_set_hash: entitySetHash(confirmed),
      basics: cleanObject(basicsEntity?.data || {}),
      work: confirmed.filter((entity) => entity.entity_type === "work_experience").sort((a, b) => a.order - b.order).map((entity) => cleanObject({
        name: entity.data.name,
        location: entity.data.location,
        position: entity.data.position,
        url: entity.data.url,
        startDate: entity.data.startDate,
        endDate: entity.data.endDate,
        summary: entity.data.summary,
        highlights: [...(entity.data.responsibilities || []), ...(entity.data.achievements || []), ...(entity.data.unclassified_highlights || [])],
        x_job_radar: { entity_id: entity.entity_id, rawDate: entity.data.rawDate, datePrecision: entity.data.datePrecision, current: entity.data.current, responsibilities: entity.data.responsibilities || [], achievements: entity.data.achievements || [], unclassified_highlights: entity.data.unclassified_highlights || [] },
      })),
      education: confirmed.filter((entity) => entity.entity_type === "education").sort((a, b) => a.order - b.order).map((entity) => cleanObject({
        institution: entity.data.institution,
        area: entity.data.area,
        studyType: entity.data.studyType,
        startDate: entity.data.startDate,
        endDate: entity.data.endDate,
        score: entity.data.score,
        courses: entity.data.courses || [],
        x_job_radar: { entity_id: entity.entity_id, rawDate: entity.data.rawDate, location: entity.data.location, highlights: entity.data.highlights || [] },
      })),
      skills: confirmed.filter((entity) => entity.entity_type === "skill_group").sort((a, b) => a.order - b.order).map((entity) => cleanObject(entity.data)),
      projects: confirmed.filter((entity) => entity.entity_type === "project").sort((a, b) => a.order - b.order).map((entity) => cleanObject({
        name: entity.data.name,
        description: entity.data.context,
        highlights: [...(entity.data.responsibilities || []), ...(entity.data.process || []), ...(entity.data.outputs || []), ...(entity.data.outcomes || []), ...(entity.data.unclassified_highlights || [])],
        keywords: [...(entity.data.skills || []), ...(entity.data.tools || []), ...(entity.data.keywords || [])],
        startDate: entity.data.startDate,
        endDate: entity.data.endDate,
        roles: entity.data.role ? [entity.data.role] : [],
        entity: entity.data.organization,
        type: entity.data.project_kind,
        x_job_radar: { entity_id: entity.entity_id, entity_origin: entity.entity_origin || "resume", rawDate: entity.data.rawDate, ownership_scope: entity.data.ownership_scope, problem: entity.data.problem, audience: entity.data.audience, ai_assistance: entity.data.ai_assistance, boundaries: entity.data.boundaries || [], source_pages: entity.data.source_pages || [], source_assets: entity.data.source_assets || [] },
      })),
      languages: confirmed.filter((entity) => entity.entity_type === "language").sort((a, b) => a.order - b.order).map((entity) => cleanObject(entity.data)),
      awards: confirmed.filter((entity) => entity.entity_type === "award").sort((a, b) => a.order - b.order).map((entity) => cleanObject(entity.data)),
      x_job_radar: {
        confirmed_entity_ids: confirmed.map((entity) => entity.entity_id),
        derived_evidence_ids: evidence.map((item) => item.evidence_id),
        known_limitations: [...new Set(confirmed.flatMap((entity) => entity.limitations || []))],
        source_document_ids: [...new Set(confirmed.flatMap((entity) => entity.source_document_ids || []))],
        source_documents: (sourceDocuments || []).map(({ file_blob, extracted_pages, ...metadata }) => metadata),
      },
    };
    return profile;
  }

  function buildEntityExport(records, sourceDocuments, extractionRuns, now) {
    return {
      format: "job-radar-career-entities-v1",
      contract_id: ENTITY_CONTRACT_ID,
      exported_at: timestamp(now),
      entities: (records || []).filter((record) => record.contract_id === ENTITY_CONTRACT_ID),
      extraction_runs: extractionRuns || [],
      source_documents: (sourceDocuments || []).map(({ file_blob, extracted_pages, ...metadata }) => metadata),
    };
  }

  function buildEvidenceExport(records, sourceDocuments, now) {
    const evidence = deriveCareerEvidence(records, now);
    return {
      format: "job-radar-career-evidence-export-v1",
      contract_id: EVIDENCE_CONTRACT_ID,
      exported_at: timestamp(now),
      evidence,
      source_documents: (sourceDocuments || []).filter((source) => evidence.some((item) => item.source_document_ids.includes(source.source_document_id))).map(({ file_blob, extracted_pages, ...metadata }) => metadata),
    };
  }

  function intelligenceId(kind, value) {
    return `career-intelligence-${kind}-${String(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "unknown"}`;
  }

  function evidenceProvenance(evidence) {
    return (evidence || []).map((item) => ({
      evidence_id: item.evidence_id,
      source_document_ids: item.source_document_ids || [],
      source_location: item.source_location || "unknown",
    }));
  }

  function hasText(items, pattern) { return (items || []).some((item) => pattern.test(String(item.claim || ""))); }

  function proposeCareerIntelligence(evidence, jobs, now) {
    const generatedAt = timestamp(now);
    const confirmedEvidence = (evidence || []).filter((item) => item.contract_id === EVIDENCE_CONTRACT_ID && item.verification_status === "confirmed");
    const validJobs = (jobs || []).filter((job) => job && job.job_id && job.title);
    const capabilities = [];
    const capabilityRules = [
      ["用户研究与洞察整理", /访谈|research|interview|研究/i],
      ["产品/服务设计", /设计|design|prototype|原型/i],
      ["项目交付与协作", /项目|project|协作|coordinate/i],
    ];
    capabilityRules.forEach(([capability, pattern]) => {
      const supporting = confirmedEvidence.filter((item) => pattern.test(String(item.claim || "")));
      if (supporting.length) capabilities.push({
        record_id: intelligenceId("capability", capability), kind: "capability_boundary", capability, state: "PROVEN",
        supporting_evidence_ids: supporting.map((item) => item.evidence_id), provenance: evidenceProvenance(supporting),
        reasoning: `已确认 CareerEvidence 中有 ${supporting.length} 条直接提及该能力相关活动。`,
        limitations: ["证据来自用户确认的职业材料，不等同于第三方独立认证。"], review_status: "needs_review", generated_at: generatedAt,
      });
    });
    capabilities.push({
      record_id: intelligenceId("capability", "独立软件工程实现"), kind: "capability_boundary", capability: "独立软件工程实现", state: "UNVERIFIED",
      supporting_evidence_ids: [], provenance: [], reasoning: "当前 CareerEvidence 不足以证明独立实现能力；项目代码或 AI-assisted implementation 不会自动升级此判断。",
      limitations: ["UNVERIFIED 表示尚未验证，不表示缺乏该能力。"], review_status: "needs_review", generated_at: generatedAt,
    });
    const interests = validJobs.map((job) => ({
      record_id: intelligenceId("interest", job.job_id), kind: "interest_signal", source_job_id: job.job_id, source_title: job.title,
      source_provenance: { source_path: job.source_path || "unknown", external_source_name: job.external_source_name || "unknown", captured_date: job.captured_date || null },
      observed_at: job.captured_date || null, signal: `导入并保留了「${job.title}」职位记录。`,
      interpretation: "一次职位导入仅表示观察到的探索信号，不是已确认偏好或职业目标。", review_status: "needs_review", generated_at: generatedAt,
    }));
    const aiProductJobs = validJobs.filter((job) => /AI.*产品|产品.*AI|AI数字化/i.test(job.title));
    const agentJobs = validJobs.filter((job) => /Agent|智能体/i.test(`${job.title} ${(job.requirements || []).join(" ")}`));
    const directions = [];
    if (aiProductJobs.length) directions.push({
      record_id: intelligenceId("direction", "AI产品与AI系统产品"), kind: "career_direction_hypothesis", hypothesis: "AI 产品 / AI Systems Product 探索方向", status: "PENDING_USER_CONFIRMATION",
      supporting_signal_ids: aiProductJobs.map((job) => intelligenceId("interest", job.job_id)), supporting_capability_ids: capabilities.filter((item) => item.state === "PROVEN").map((item) => item.record_id),
      capability_alignment: "已有被确认的设计、研究或项目证据可能构成相邻能力；AI 产品独立交付能力仍需逐项验证。",
      current_evidence_gaps: ["独立产品交付结果", "AI/LLM 产品真实工作产出", "用户对该方向的明确确认"], contradictions: [],
      uncertainty: "JD 集中出现只说明被观察到的探索，不能替代职业目标。", rationale: `${aiProductJobs.length} 份已保存 JD 的职位标题包含 AI 产品相关表述。`, review_status: "needs_review", generated_at: generatedAt,
    });
    if (agentJobs.length) directions.push({
      record_id: intelligenceId("direction", "Agent与工作流产品"), kind: "career_direction_hypothesis", hypothesis: "Agent / AI workflow 产品探索方向", status: "PENDING_USER_CONFIRMATION",
      supporting_signal_ids: agentJobs.map((job) => intelligenceId("interest", job.job_id)), supporting_capability_ids: [],
      capability_alignment: "JD 中出现的 Agent、workflow、tool calling 是岗位要求，不是用户能力证据。", current_evidence_gaps: ["用户是否真想长期从事该方向", "真实 Agent/workflow 设计与验证证据"], contradictions: [],
      uncertainty: "岗位收集行为可能是探索而非偏好。", rationale: `${agentJobs.length} 份已保存 JD 提及 Agent 或相关工作流。`, review_status: "needs_review", generated_at: generatedAt,
    });
    const questions = [
      { record_id: intelligenceId("question", "AI产品探索意图"), kind: "open_question", question: "这些集中出现的 AI 产品职位，对你而言是长期发展方向、当前探索，还是仅觉得工作内容有意思？", options: ["长期方向", "当前探索", "内容有意思", "其他"], changes_model: "回答会校准 InterestSignal 与 CareerDirectionHypothesis，不会修改 Capability Evidence。", review_status: "needs_review", generated_at: generatedAt },
      { record_id: intelligenceId("question", "AI协作实现边界"), kind: "open_question", question: "你希望如何界定 AI 协作完成的 Ariadne 工作：哪些判断和验收是你亲自拥有的，哪些实现仍应标为 Tool-assisted？", options: ["我补充说明", "全部暂列 Tool-assisted"], changes_model: "回答会校准能力 ownership 边界，避免把 AI 实现误写成独立工程能力。", review_status: "needs_review", generated_at: generatedAt },
    ];
    return { contract_id: CAREER_INTELLIGENCE_CONTRACT_ID, generated_at: generatedAt, capabilities, interests, directions: directions.slice(0, 4), questions, inputs: { confirmed_evidence_ids: confirmedEvidence.map((item) => item.evidence_id), job_ids: validJobs.map((job) => job.job_id) } };
  }

  function markdownEscape(value) {
    return String(value || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  }

  function buildCareerProfileMarkdown(profile) {
    const lines = ["# CAREER PROFILE", "", `- Profile version: \`${profile.profile_version}\``, `- Generated at: \`${profile.generated_at}\``, `- Confirmed entities: ${profile.x_job_radar.confirmed_entity_ids.length}`, "- Boundary: derived from user-confirmed Career Entities; source documents and provenance remain authoritative.", ""];
    if (profile.basics?.name) lines.push("## Basics", "", `- ${markdownEscape(profile.basics.name)}${profile.basics.label ? ` · ${markdownEscape(profile.basics.label)}` : ""}`, profile.basics.summary ? `- ${markdownEscape(profile.basics.summary)}` : "", "");
    if (profile.work.length) {
      lines.push("## Work", "");
      profile.work.forEach((work) => {
        lines.push(`### ${markdownEscape(work.position || "Role")} · ${markdownEscape(work.name || "Organization")}`, "", `- Date: ${markdownEscape(work.rawDate || "unknown")}${work.location ? ` · ${markdownEscape(work.location)}` : ""}`);
        (work.highlights || []).forEach((item) => lines.push(`- ${markdownEscape(item)}`));
        lines.push("");
      });
    }
    if (profile.projects.length) {
      lines.push("## Projects", "");
      profile.projects.forEach((project) => {
        lines.push(`### ${markdownEscape(project.name)}`, "", project.description ? markdownEscape(project.description) : "");
        (project.highlights || []).forEach((item) => lines.push(`- ${markdownEscape(item)}`));
        lines.push("");
      });
    }
    if (profile.education.length) {
      lines.push("## Education", "");
      profile.education.forEach((item) => lines.push(`- ${markdownEscape(item.institution)} · ${markdownEscape([item.area, item.studyType].filter(Boolean).join(" "))} · ${markdownEscape(item.rawDate || "unknown")}`));
      lines.push("");
    }
    if (profile.skills.length) {
      lines.push("## Skills", "");
      profile.skills.forEach((item) => lines.push(`- ${markdownEscape(item.name)}: ${markdownEscape((item.keywords || []).join(", "))}`));
      lines.push("");
    }
    return lines.filter((line) => line !== undefined).join("\n");
  }

  return {
    ENTITY_CONTRACT_ID,
    EVIDENCE_CONTRACT_ID,
    PROFILE_FORMAT,
    buildCareerProfile,
    buildCareerProfileMarkdown,
    buildEntityExport,
    buildEvidenceExport,
    CAREER_INTELLIGENCE_CONTRACT_ID,
    INTELLIGENCE_STATUSES,
    CAPABILITY_STATES,
    proposeCareerIntelligence,
    confirmedEntities,
    createCareerEntities,
    deriveCareerEvidence,
    entitySetHash,
    reopenEntity,
    reviewEntity,
  };
});
