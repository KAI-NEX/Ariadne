"use strict";

(function () {
  const Demo = window.JobRadarV1Demo;
  const RuntimeGate = window.JobRadarRuntimeGate;
  const RuntimeExecution = window.AriadneRuntimeExecution;
  const Truth = window.AriadneTruthPersistence;
  const RawSource = window.AriadneRawSourceStorage;
  const LocalContextLifecycle = window.AriadneLocalContextLifecycle;
  const LocalCandidate = window.AriadneLocalCandidateExtraction;
  const LocalCandidateProposal = window.AriadneLocalCandidateProposal;
  const LocalCandidateReview = window.AriadneLocalCandidateReview;
  const LocalJobLifecycle = window.AriadneLocalJobLifecycle;
  const page = document.body.dataset.v1Page;
  const isEmbeddedDetail = new URLSearchParams(window.location.search).get("embed") === "1";
  if (isEmbeddedDetail) document.body.classList.add("v1-embedded-detail");
  const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const typeLabels = { WORK_EXPERIENCE: "工作经历", PROJECT: "项目", EDUCATION: "教育经历", OTHER: "其他" };
  const subtypeLabels = { work_experience: "工作经历", project: "项目经历", education: "教育经历", custom_section: "其他经历", skill_group: "核心能力", award: "获奖经历", language: "语言能力" };
  const materialTypeLabels = { resume: "简历", portfolio: "作品集", project_description: "项目说明", other: "其他材料" };
  const factLabels = { rawDate: "日期", achievements: "成果", responsibilities: "职责", summary: "摘要", location: "地点", area: "专业", score: "成绩", result: "结果", awarder: "颁发方", keywords: "核心能力", section: "分类", category: "分类", organization: "组织", role: "角色", context: "背景", outputs: "产出", outcomes: "结果" };
  const sourceTypeLabels = { SANITIZED_FIXTURE: "本地测试资料", BROWSER_FILE_METADATA: "浏览器本地文件", PASTED_TEXT_METADATA: "本地粘贴文本" };
  let selectedCandidateSources = [];
  let selectedCandidateType = "Resume";
  let selectedJobSource = null;
  let selectedJobSources = [];
  let selectedJobImportType = "Document";
  let activeCandidate = null;
  let activeJob = null;
  let pendingDirectEdit = null;
  let candidateProcessingInProgress = false;
  let candidateBatchAbortController = null;
  let candidateExecutionState = "READY";
  let candidateSelectionVersion = 0;
  let candidateReviewSessionTotal = 0;
  let candidateReviewSessionResolved = 0;
  let candidateReviewSourceIds = [];
  let jobProcessingInProgress = false;
  let jobBatchAbortController = null;
  let jobExecutionState = "READY";
  let jobSelectionVersion = 0;
  let jobReviewSessionTotal = 0;
  let jobReviewSessionResolved = 0;

  function currentOperationGate(operation) {
    try { return RuntimeGate.operationGate(operation); }
    catch (_error) {
      return Object.freeze({
        allowed: false,
        operation,
        capability: "invalid_current_runtime",
        state: "unsupported",
        authority: Object.freeze({ runtime: Object.freeze({ mode: "invalid", provider: null, model: null }), capabilities: Object.freeze({}) }),
      });
    }
  }

  function runtimeLabel(runtime) {
    if (runtime.mode !== "model") return "本地运行";
    const provider = ({ deepseek: "DeepSeek", gemini: "Gemini", qwen: "Qwen" }[runtime.provider] || runtime.provider || "模型");
    return runtime.model ? `${provider} · ${runtime.model}` : provider;
  }

  function candidateTypeLabel(item) { return subtypeLabels[item?.item_subtype] || typeLabels[item?.item_type] || "其他经历"; }
  function candidateFactLabel(value) { return factLabels[value] || (/[\u3400-\u9fff]/.test(String(value || "")) ? value : "补充信息"); }
  function personalErrorCopy(error) {
    const code = String(error?.code || error?.message || error || "");
    const messages = {
      candidate_source_identity_required: "无法确认这张卡片对应的原始文件。",
      candidate_source_not_found: "原始文件已不存在，无需再次删除。",
      candidate_item_not_found: "这张卡片已不存在。",
      candidate_item_already_removed: "这张卡片已被移除。",
      context_version_conflict: "卡片已在其他操作中更新，请重新打开后再试。",
      unsupported_document_type: "暂不支持这种文件格式。",
      invalid_document_size: "文件大小不符合本地导入要求。",
      document_read_failed: "无法读取这个本地文件。",
      document_size_limit_exceeded: "当前本地导入仅支持不超过 8 MB 的文档；请压缩后重试。",
      image_size_limit_exceeded: "当前本地导入仅支持不超过 5 MB 的图片；请压缩后重试。",
      raw_source_reference_missing: "原始文件的本地引用不存在；操作已停止。",
      raw_source_reference_invalid: "原始文件的本地引用无效；操作已停止。",
      raw_source_reference_unsupported: "原始文件的本地引用无法由当前版本解析；操作已停止。",
      raw_source_reference_mismatch: "原始文件的本地引用与来源身份不一致；操作已停止。",
      raw_source_document_missing: "原始来源记录不存在；操作已停止。",
      raw_source_document_not_canonical: "原始来源记录不是正式 SourceDocument；操作已停止。",
      raw_source_payload_missing: "本地保存的原始文件不存在；操作已停止。",
      raw_source_payload_invalid: "本地保存的原始文件无法读取；操作已停止。",
      raw_source_payload_envelope_invalid: "本地保存的原始文件记录无效；操作已停止。",
      raw_source_integrity_mismatch: "原始文件完整性校验失败；操作已停止。",
      raw_source_resolver_unavailable: "原始文件解析能力不可用；操作已停止。",
      raw_source_storage_unavailable: "浏览器本地来源存储不可用；操作已停止。",
      raw_source_read_failed: "浏览器未能读取原始文件；操作已停止。",
      raw_source_persistence_failed: "原始文件未能完整保存；没有记录为可持久恢复的来源。",
      source_document_legacy_collision: "来源身份与旧版记录冲突；未覆盖任何已有资料。",
      source_document_canonical_collision: "来源身份与已有正式记录冲突；未覆盖任何已有资料。",
    };
    return messages[code] || "操作未完成，请重试。";
  }

  function unavailableCopy(gate, subject) {
    if (gate.authority.runtime.mode === "model") {
      return `当前所选模型的${subject}能力尚未真实接通；操作已停用，不会生成模型样例，也不会静默改用本地结果。`;
    }
    return "当前运行方式无效；操作已安全停用，请重新选择运行方式。";
  }

  function setRuntimeGateMessage(elementId, message) {
    const element = byId(elementId);
    if (!element) return;
    if (message) {
      element.textContent = message;
      element.classList.add("error");
      element.dataset.runtimeGateMessage = "true";
    } else if (element.dataset.runtimeGateMessage === "true") {
      element.textContent = "";
      element.classList.remove("error");
      delete element.dataset.runtimeGateMessage;
    }
  }

  function refreshCandidateImportGate() {
    const gate = currentOperationGate("candidate_import");
    const button = byId("start-personal-processing");
    if (!button) return gate;
    const local = gate.authority.runtime.mode === "local";
    document.body.dataset.candidateImportRuntime = local ? "local" : "model-unavailable";
    button.textContent = !local ? "模型导入尚不可用" : candidateExecutionState === "COMPLETED_SOURCE" ? "确认" : candidateExecutionState === "COMPLETE" ? "本地提取已完成" : candidateExecutionState === "PROCESSING" ? "正在本地提取" : "开始本地提取";
    button.disabled = candidateProcessingInProgress || candidateExecutionState === "COMPLETE" || candidateExecutionState === "COMPLETED_SOURCE" || !selectedCandidateSources.length || !gate.allowed;
    byId("personal-file-input").disabled = !local || candidateProcessingInProgress;
    byId("personal-dropzone").disabled = !local || candidateProcessingInProgress;
    byId("personal-dropzone").setAttribute("aria-disabled", String(!local || candidateProcessingInProgress));
    byId("personal-import-types").querySelectorAll("button").forEach((item) => { item.disabled = !local || candidateProcessingInProgress; });
    setRuntimeGateMessage("personal-page-message", gate.allowed ? "" : unavailableCopy(gate, "个人材料语义结构化"));
    return gate;
  }

  function refreshJobImportGate() {
    const gate = currentOperationGate("job_import");
    const button = byId("start-job-processing");
    if (!button) return gate;
    button.textContent = gate.authority.runtime.mode !== "local" ? "模型导入尚不可用" : jobExecutionState === "COMPLETE" ? "等待审核完成" : jobProcessingInProgress ? "正在本地整理" : "开始本地演示整理";
    const local = gate.authority.runtime.mode === "local";
    button.disabled = jobProcessingInProgress || jobExecutionState === "COMPLETE" || !selectedJobSource || !gate.allowed;
    byId("job-file-input").disabled = !local || jobProcessingInProgress;
    byId("job-dropzone").disabled = !local || jobProcessingInProgress;
    byId("job-dropzone").setAttribute("aria-disabled", String(!local || jobProcessingInProgress));
    setRuntimeGateMessage("job-page-message", gate.allowed ? "" : unavailableCopy(gate, "职位语义结构化"));
    return gate;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "本地文件";
    if (bytes < 1024) return `${bytes} B`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  function sheet(open, id) {
    const element = byId(id);
    element.classList.toggle("hidden", !open);
    document.body.classList.toggle("v1-sheet-open", open);
    if (open) element.querySelector("button, input, textarea")?.focus();
  }

  function installMenuBehavior() {
    document.addEventListener("click", (event) => {
      document.querySelectorAll(".v1-menu[open]").forEach((menu) => {
        if (!menu.contains(event.target)) menu.removeAttribute("open");
      });
    });
  }

  function installMiniSidebar() {
    if (isEmbeddedDetail) return;
    const activeSection = page === "candidate-detail" || page === "personal-import" ? "personal" : page === "job-detail" || page === "job-import" ? "jd" : page;
    const items = [
      { id: "runtime", label: "运行方式", href: "/index.html", width: 84, base: 8 },
      { id: "workspace", label: "工作空间", href: "/workspace.html", width: 106, base: 8 },
      { id: "personal", label: "个人资料", href: "/personal-information.html", width: 104, base: 8 },
      { id: "jd", label: "职位描述", href: "/jd.html", width: 84, base: 8 },
    ];
    const markup = `<nav class="v1-mini-sidebar" aria-label="快捷导航">
      <div class="v1-mini-rail">
        ${items.map((item) => `<a class="v1-mini-item" data-mini-label="${item.label}" data-mini-width="${item.width}" data-mini-base="${item.base}" href="${item.href}" aria-label="${item.label}"${activeSection === item.id ? ' aria-current="page"' : ""}><span aria-hidden="true"></span></a>`).join("")}
        <div class="v1-mini-tooltip" aria-hidden="true"><span></span></div>
      </div>
    </nav>`;
    document.body.insertAdjacentHTML("afterbegin", markup);
    const sidebar = document.querySelector(".v1-mini-sidebar");
    const rail = sidebar.querySelector(".v1-mini-rail");
    const tooltip = sidebar.querySelector(".v1-mini-tooltip");
    const tooltipText = tooltip.querySelector("span");
    const navItems = [...sidebar.querySelectorAll(".v1-mini-item")];
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const influenceRadius = 13;
    let activeItem = null;
    let animationFrame = null;
    const states = navItems.map((item) => {
      const baseWidth = Number(item.dataset.miniBase);
      const restWidth = item.getAttribute("aria-current") === "page" ? baseWidth + 10 : baseWidth;
      const restOpacity = item.getAttribute("aria-current") === "page" ? 0.96 : 0.2;
      return {
        baseWidth, restWidth, width: restWidth, widthVelocity: 0, targetWidth: restWidth,
        opacity: restOpacity, opacityVelocity: 0, targetOpacity: restOpacity,
        scaleY: 0.76, scaleVelocity: 0, targetScaleY: 0.76,
      };
    });

    function showFor(item) {
      if (activeItem === item && tooltip.dataset.visible === "true") return;
      activeItem = item;
      rail.style.setProperty("--mini-tip-y", `${item.offsetTop + item.offsetHeight / 2}px`);
      rail.style.setProperty("--mini-tip-width", `${item.dataset.miniWidth}px`);
      tooltipText.textContent = item.dataset.miniLabel;
      tooltip.dataset.visible = "true";
      navItems.forEach((entry) => entry.classList.toggle("is-nearest", entry === item));
      tooltipText.getAnimations?.().forEach((animation) => animation.cancel());
      tooltipText.animate?.([
        { opacity: 0.12, filter: "blur(7px)", transform: "translateX(-5px)" },
        { opacity: 1, filter: "blur(0)", transform: "translateX(0)" },
      ], { duration: 220, easing: "cubic-bezier(.2,.82,.2,1)", fill: "both" });
    }

    function hideLabel() {
      activeItem = null;
      tooltip.dataset.visible = "false";
      navItems.forEach((entry) => entry.classList.remove("is-nearest"));
    }

    function spring(state, valueKey, velocityKey, targetKey) {
      if (prefersReducedMotion) {
        state[valueKey] = state[targetKey];
        state[velocityKey] = 0;
        return false;
      }
      state[velocityKey] = (state[velocityKey] + (state[targetKey] - state[valueKey]) * 0.17) * 0.72;
      state[valueKey] += state[velocityKey];
      const moving = Math.abs(state[velocityKey]) > 0.002 || Math.abs(state[targetKey] - state[valueKey]) > 0.002;
      if (!moving) state[valueKey] = state[targetKey];
      return moving;
    }

    function renderSpringFrame() {
      let moving = false;
      states.forEach((state, index) => {
        moving = spring(state, "width", "widthVelocity", "targetWidth") || moving;
        moving = spring(state, "opacity", "opacityVelocity", "targetOpacity") || moving;
        moving = spring(state, "scaleY", "scaleVelocity", "targetScaleY") || moving;
        const dash = navItems[index].querySelector("span");
        dash.style.width = `${state.width.toFixed(3)}px`;
        dash.style.opacity = state.opacity.toFixed(3);
        dash.style.transform = `scaleY(${state.scaleY.toFixed(3)})`;
      });
      animationFrame = moving ? window.requestAnimationFrame(renderSpringFrame) : null;
    }

    function startSpring() {
      if (animationFrame == null) animationFrame = window.requestAnimationFrame(renderSpringFrame);
    }

    function updateDistanceField(localY) {
      rail.classList.add("is-expanded");
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      navItems.forEach((item, index) => {
        const distance = Math.abs(localY - (item.offsetTop + item.offsetHeight / 2));
        if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index; }
        const influence = Math.exp(-0.5 * (distance / influenceRadius) ** 2);
        states[index].targetWidth = states[index].restWidth + (38 - states[index].restWidth) * influence;
        states[index].targetOpacity = Math.max(item.getAttribute("aria-current") === "page" ? 0.96 : 0.2, 0.2 + 0.8 * influence);
        states[index].targetScaleY = 0.76 + 0.32 * influence;
      });
      if (nearestIndex >= 0) showFor(navItems[nearestIndex]);
      startSpring();
    }

    function resetDistanceField() {
      rail.classList.remove("is-expanded");
      states.forEach((state, index) => {
        state.targetWidth = state.restWidth;
        state.targetOpacity = navItems[index].getAttribute("aria-current") === "page" ? 0.96 : 0.2;
        state.targetScaleY = 0.76;
      });
      hideLabel();
      startSpring();
    }

    function navigateFromMiniLabel(event, item) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = item.href;
      if (!destination || item.getAttribute("aria-current") === "page") { event.preventDefault(); return; }
      event.preventDefault();
      if (prefersReducedMotion) { window.location.assign(destination); return; }
      showFor(item);
      document.body.classList.add("v1-route-leaving");
      window.setTimeout(() => window.location.assign(destination), 320);
    }

    navItems.forEach((item) => {
      const state = states[navItems.indexOf(item)];
      const dash = item.querySelector("span");
      dash.style.width = `${state.width}px`;
      dash.style.opacity = state.opacity;
      dash.style.transform = `scaleY(${state.scaleY})`;
      item.addEventListener("focus", () => updateDistanceField(item.offsetTop + item.offsetHeight / 2));
      item.addEventListener("blur", resetDistanceField);
      item.addEventListener("click", (event) => navigateFromMiniLabel(event, item));
    });
    rail.addEventListener("pointerenter", () => rail.classList.add("is-expanded"));
    rail.addEventListener("pointermove", (event) => updateDistanceField(event.clientY - rail.getBoundingClientRect().top));
    rail.addEventListener("pointerleave", resetDistanceField);
  }

  const CARD_ROUTE_KEY = "job-radar-v1-card-route";
  const safeSession = {
    get() { try { return JSON.parse(sessionStorage.getItem(CARD_ROUTE_KEY) || "null"); } catch (_error) { return null; } },
    set(value) { try { sessionStorage.setItem(CARD_ROUTE_KEY, JSON.stringify(value)); } catch (_error) { /* Motion remains optional. */ } },
    remove() { try { sessionStorage.removeItem(CARD_ROUTE_KEY); } catch (_error) { /* Motion remains optional. */ } },
  };
  const routeKey = (url) => {
    const params = new URLSearchParams(url.search);
    params.delete("v");
    const search = params.toString();
    return `${url.pathname}${search ? `?${search}` : ""}`;
  };
  const currentRoute = () => routeKey(new URL(window.location.href));
  const routeFor = (href) => routeKey(new URL(href, window.location.href));
  const transitionSourceSelector = ".v1-candidate-card, .v1-add-guide-card";
  const pageFadeSourceSelector = ".v1-object-folder, .v1-back[href='/workspace.html']";
  const pagePaperColor = () => getComputedStyle(document.body).getPropertyValue("--paper").trim() || "#f7f7f9";

  function installDetailCardOverlay() {
    if (isEmbeddedDetail || (page !== "personal" && page !== "jd")) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="v1-detail-overlay hidden" aria-hidden="true">
      <button class="v1-detail-overlay-backdrop v1-sheet-backdrop" type="button" aria-label="关闭详情"></button>
      <section class="v1-detail-overlay-surface" role="dialog" aria-modal="true" aria-label="资料详情" tabindex="-1">
        <div class="v1-detail-overlay-preview" aria-hidden="true"></div>
        <div class="v1-detail-overlay-content">
          <header><button class="v1-detail-overlay-close" type="button" aria-label="关闭详情"></button><p></p><button class="v1-detail-overlay-edit" type="button" aria-label="编辑当前内容">编辑</button></header>
          <iframe title="本地资料详情"></iframe>
        </div>
      </section>
    </div>`);
    const overlay = document.querySelector(".v1-detail-overlay");
    const backdrop = overlay.querySelector(".v1-detail-overlay-backdrop");
    const surface = overlay.querySelector(".v1-detail-overlay-surface");
    const preview = overlay.querySelector(".v1-detail-overlay-preview");
    const content = overlay.querySelector(".v1-detail-overlay-content");
    const title = content.querySelector("header p");
    const closeButton = overlay.querySelector(".v1-detail-overlay-close");
    const editButton = overlay.querySelector(".v1-detail-overlay-edit");
    const frame = overlay.querySelector("iframe");
    const surfaceControls = window.JobRadarFloatingWindow?.mount(surface, {
      dragHandle: content.querySelector("header"),
      minWidth: 520,
      minHeight: 400,
      margin: 10,
    });
    let sourceCard = null;
    let surfaceAnimation = null;
    let closing = false;
    let revealTimer = null;
    let afterClose = null;

    function targetRect() {
      const compact = window.innerWidth < 760;
      const width = window.innerWidth * (compact ? 0.94 : 0.8);
      const height = window.innerHeight * (compact ? 0.9 : 0.8);
      return { left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2, width, height };
    }

    function rectFrame(rect, radius) {
      return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: radius };
    }

    function openOverlay(card) {
      if (sourceCard || closing) return;
      surfaceControls?.reset();
      sourceCard = card;
      const isImport = card.matches(".v1-add-guide-card");
      editButton.classList.toggle("hidden", isImport);
      editButton.disabled = isImport;
      const sourceRect = card.getBoundingClientRect();
      const destinationRect = targetRect();
      const sourceRadius = getComputedStyle(card).borderRadius;
      const clone = card.cloneNode(true);
      clone.removeAttribute("href");
      clone.removeAttribute("data-transition-key");
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      if (isImport) {
        card.classList.add("v1-transition-light");
        clone.classList.add("v1-transition-light");
      }
      preview.replaceChildren(clone);
      title.textContent = card.querySelector("h3, b")?.textContent || "资料详情";
      overlay.dataset.overlayKind = isImport ? "import" : "detail";
      surface.setAttribute("aria-label", isImport ? title.textContent : "资料详情");
      frame.title = isImport ? title.textContent : "资料详情";
      overlay.classList.remove("hidden", "is-content-ready", "is-closing");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("v1-detail-overlay-open");
      Object.assign(surface.style, rectFrame(destinationRect, "28px"));
      sourceCard.style.visibility = "hidden";
      const detailUrl = new URL(card.href, window.location.href);
      detailUrl.searchParams.set("embed", "1");
      detailUrl.searchParams.delete("v");
      frame.onload = () => {
        window.clearTimeout(revealTimer);
        revealTimer = window.setTimeout(() => {
          if (!closing && sourceCard) overlay.classList.add("is-content-ready");
        }, 260);
      };
      frame.src = detailUrl.href;
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease", fill: "both" });
      surfaceAnimation = surface.animate([
        rectFrame(sourceRect, sourceRadius),
        rectFrame(destinationRect, "28px"),
      ], { duration: 540, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
      surfaceAnimation.finished.then(() => {
        if (!closing) { surfaceAnimation.cancel(); surfaceAnimation = null; surface.focus({ preventScroll: true }); }
      }).catch(() => {});
    }

    function finishClose() {
      const finishedSource = sourceCard;
      const completion = afterClose;
      surfaceAnimation?.cancel();
      backdrop.getAnimations().forEach((animation) => animation.cancel());
      frame.onload = null;
      frame.src = "about:blank";
      preview.replaceChildren();
      overlay.classList.add("hidden");
      overlay.classList.remove("is-content-ready", "is-closing");
      delete overlay.dataset.overlayKind;
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("v1-detail-overlay-open");
      surfaceControls?.reset();
      if (finishedSource) {
        finishedSource.style.visibility = "";
        finishedSource.focus({ preventScroll: true });
        if (finishedSource.matches(".v1-add-guide-card")) window.requestAnimationFrame(() => finishedSource.classList.remove("v1-transition-light"));
      }
      sourceCard = null;
      surfaceAnimation = null;
      closing = false;
      afterClose = null;
      if (completion) Promise.resolve(completion()).catch((error) => console.error("Unable to refresh imported cards", error));
    }

    function closeOverlay() {
      if (!sourceCard || closing) return;
      closing = true;
      window.clearTimeout(revealTimer);
      overlay.classList.add("is-closing");
      const currentRect = surface.getBoundingClientRect();
      const destinationRect = sourceCard.getBoundingClientRect();
      const destinationRadius = getComputedStyle(sourceCard).borderRadius;
      surfaceAnimation?.cancel();
      backdrop.getAnimations().forEach((animation) => animation.cancel());
      backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, easing: "ease", fill: "both" });
      surfaceAnimation = surface.animate([
        rectFrame(currentRect, "28px"),
        rectFrame(destinationRect, destinationRadius),
      ], { duration: 480, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
      surfaceAnimation.finished.then(finishClose).catch(finishClose);
    }

    document.addEventListener("click", (event) => {
      const card = event.target.closest(".v1-candidate-card, .v1-add-guide-card");
      if (!card || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      safeSession.remove();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.location.assign(card.href); return; }
      openOverlay(card);
    });
    closeButton.addEventListener("click", closeOverlay);
    editButton.addEventListener("click", () => frame.contentWindow?.postMessage({ type: "job-radar-v1-open-detail-edit" }, window.location.origin));
    backdrop.addEventListener("click", closeOverlay);
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeOverlay(); });
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow || event.data?.type !== "job-radar-v1-import-complete") return;
      const { library, sourceKey } = event.data;
      if ((library === "personal" && page !== "personal") || (library === "jd" && page !== "jd")) return;
      afterClose = async () => {
        if (library === "personal") await renderPersonalLibrary();
        else await renderJobLibrary();
        document.querySelector(`[data-transition-key="${CSS.escape(sourceKey)}"]`)?.focus({ preventScroll: true });
      };
      closeOverlay();
    });
  }

  function createCardTransitionLayer(source, startRect, startFullscreen = false) {
    const layer = source.cloneNode(true);
    layer.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    layer.removeAttribute("href");
    layer.classList.add("v1-card-transition-layer");
    if (source.matches(".v1-add-guide-card, .v1-object-folder.dark")) layer.classList.add("v1-transition-light");
    layer.style.backgroundColor = startFullscreen ? pagePaperColor() : "#fff";
    Object.assign(layer.style, startFullscreen ? {
      left: "0px", top: "0px", width: `${window.innerWidth}px`, height: `${window.innerHeight}px`, borderRadius: "0px",
    } : {
      left: `${startRect.left}px`, top: `${startRect.top}px`, width: `${startRect.width}px`, height: `${startRect.height}px`, borderRadius: getComputedStyle(source).borderRadius,
    });
    document.body.append(layer);
    return layer;
  }

  function animateCardToPage(source, destination) {
    const rect = source.getBoundingClientRect();
    const layer = createCardTransitionLayer(source, rect);
    const paperColor = pagePaperColor();
    document.body.classList.add("v1-card-route-out");
    const animation = layer.animate([
      { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: getComputedStyle(source).borderRadius, backgroundColor: "#fff", opacity: 1 },
      { left: "0px", top: "0px", width: `${window.innerWidth}px`, height: `${window.innerHeight}px`, borderRadius: "0px", backgroundColor: paperColor, opacity: 1 },
    ], { duration: 460, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
    window.setTimeout(() => {
      if (layer.isConnected) layer.classList.add("v1-transition-surface");
    }, 300);
    animation.finished.then(() => {
      layer.classList.add("is-holding");
      window.setTimeout(() => window.location.assign(destination), 34);
    }).catch(() => window.location.assign(destination));
  }

  function installCardPageTransitions() {
    document.addEventListener("click", (event) => {
      const fadeSource = event.target.closest(pageFadeSourceSelector);
      if (fadeSource && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
        const fadeDestination = fadeSource.getAttribute("href");
        if (fadeDestination) {
          event.preventDefault();
          safeSession.remove();
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.location.assign(fadeDestination); return; }
          document.body.classList.add("v1-route-leaving");
          window.setTimeout(() => window.location.assign(fadeDestination), 320);
          return;
        }
      }
      const source = event.target.closest(transitionSourceSelector);
      if (!source || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = source.getAttribute("href");
      if (!destination) return;
      event.preventDefault();
      const route = { origin: currentRoute(), destination: routeFor(destination), sourceKey: source.dataset.transitionKey || "", returning: false };
      safeSession.set(route);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.location.assign(destination); return; }
      animateCardToPage(source, destination);
    });

    document.querySelectorAll(".v1-back[href]").forEach((back) => back.addEventListener("click", (event) => {
      const route = safeSession.get();
      if (!route || route.destination !== currentRoute() || route.origin !== routeFor(back.href)) return;
      event.preventDefault();
      route.returning = true;
      safeSession.set(route);
      document.body.classList.add("v1-card-return-cover");
      window.setTimeout(() => window.location.assign(back.href), 180);
    }));

    const route = safeSession.get();
    if (route?.destination === currentRoute() && !route.returning) {
      document.body.classList.add("v1-card-route-in");
      const cover = document.createElement("div");
      cover.className = "v1-card-arrival-cover";
      document.body.append(cover);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        document.body.classList.add("is-visible");
        cover.classList.add("is-clearing");
      }));
      window.setTimeout(() => cover.remove(), 340);
    }
  }

  function playPendingCardReturn() {
    const route = safeSession.get();
    if (!route?.returning || route.origin !== currentRoute()) return;
    const target = [...document.querySelectorAll(transitionSourceSelector)].find((item) => item.dataset.transitionKey === route.sourceKey);
    if (!target) { safeSession.remove(); return; }
    const returnsToDarkSurface = target.matches(".v1-add-guide-card, .v1-object-folder.dark");
    if (returnsToDarkSurface) target.classList.add("v1-transition-light");
    const rect = target.getBoundingClientRect();
    const layer = createCardTransitionLayer(target, rect, true);
    const paperColor = pagePaperColor();
    layer.classList.add("v1-transition-surface");
    document.body.classList.add("v1-card-route-returning");
    layer.animate([
      { left: "0px", top: "0px", width: `${window.innerWidth}px`, height: `${window.innerHeight}px`, borderRadius: "0px", backgroundColor: paperColor, opacity: 1 },
      { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, borderRadius: getComputedStyle(target).borderRadius, backgroundColor: "#fff", opacity: .98 },
    ], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
    window.setTimeout(() => {
      layer.remove();
      document.body.classList.remove("v1-card-route-returning");
      safeSession.remove();
      if (returnsToDarkSurface) window.requestAnimationFrame(() => target.classList.remove("v1-transition-light"));
    }, 430);
  }

  function returnToCardLibrary(destination, sourceKey) {
    const route = safeSession.get() || {};
    safeSession.set({ ...route, origin: routeFor(destination), destination: currentRoute(), sourceKey, returning: true });
    document.body.classList.add("v1-card-return-cover");
    window.setTimeout(() => window.location.assign(destination), 180);
  }

  function completeEmbeddedImport(library, sourceKey) {
    if (!isEmbeddedDetail || window.parent === window) return false;
    window.parent.postMessage({ type: "job-radar-v1-import-complete", library, sourceKey }, window.location.origin);
    return true;
  }

  async function initWorkspace() {
    const [candidates, jobs] = await Promise.all([Demo.getAll(Demo.DEMO_STORES.candidates), Demo.getAll(Demo.DEMO_STORES.jobs)]);
    byId("workspace-personal-count").textContent = candidates.length ? `${candidates.length} 个待审核对象` : "尚未添加";
    byId("workspace-job-count").textContent = jobs.length ? `${jobs.length} 个职位对象` : "尚未添加";
    window.requestAnimationFrame(playPendingCardReturn);
  }

  function candidateCardMarkup(item) {
    const facts = (item.facts || []).slice(0, 4).map((fact) => `<li>${escapeHtml(fact.value)}</li>`).join("");
    const canonical = item.data_class === "CANONICAL_CONFIRMED";
    const href = canonical ? `/candidate-detail.html?context=${encodeURIComponent(item.context_id)}&item=${encodeURIComponent(item.item_id)}` : `/candidate-detail.html?item=${encodeURIComponent(item.item_id)}`;
    const stateBadge = canonical ? "" : '<span class="v1-review-chip">待审核 · 演示</span>';
    return `<a class="v1-candidate-card" data-transition-key="candidate:${escapeHtml(item.item_id)}" href="${href}">
      <div class="v1-card-top"><span class="v1-type-chip">${escapeHtml(candidateTypeLabel(item))}</span>${stateBadge}</div>
      <h3>${escapeHtml(item.title)}</h3><p class="v1-card-subtitle">${escapeHtml(item.subtitle)} · ${escapeHtml(item.time)}</p>
      <p class="v1-card-summary">${escapeHtml(item.summary || "")}</p><ul>${facts}</ul>
    </a>`;
  }

  function personalGuideCardMarkup() {
    return `<a class="v1-add-guide-card personal" data-transition-key="personal-guide" href="/personal-import.html"><span class="v1-add-guide-icon" aria-hidden="true">＋</span><span><b>添加个人材料</b></span><p class="v1-guide-copy"><span>点击进入导入页面，建立待审核的职业对象。</span><span aria-hidden="true">文件仅在当前浏览器中处理</span></p></a>`;
  }

  async function localizedCandidateRecords(records) {
    const localizedById = new Map(Demo.CANDIDATE_FIXTURES.map((item) => [item.item_id, item]));
    return Promise.all(records.map(async (record) => {
      const localized = localizedById.get(record.item_id);
      if (!localized || (record.copy_locale === "zh-CN" && record.title === localized.title)) return record;
      const migrated = {
        ...Demo.clone(record),
        copy_locale: "zh-CN",
        title: localized.title,
        subtitle: localized.subtitle,
        source_refs: Demo.clone(localized.source_refs),
        updated_at: new Date().toISOString(),
      };
      await Demo.put(Demo.DEMO_STORES.candidates, migrated);
      return migrated;
    }));
  }

  async function renderPersonalLibrary() {
    const legacy = await localizedCandidateRecords(await Demo.getAll(Demo.DEMO_STORES.candidates));
    let canonical = [];
    if (Truth && LocalCandidateReview) {
      const database = await Truth.openDatabase();
      const [revisionRecords, lifecycleRecords] = await Promise.all([
        LocalCandidateReview.getAll(database, "candidate_context_revisions"),
        LocalCandidateReview.getAll(database, "candidate_context_lifecycle"),
      ]);
      database.close();
      const revisions = LocalCandidateReview.activeConfirmedRevisions(revisionRecords, lifecycleRecords);
      canonical = revisions.flatMap((revision) => (revision.payload.items || []).map((item) => ({ ...item, context_id: revision.context_id, revision_id: revision.revision_id, data_class: "CANONICAL_CONFIRMED", review_status: "CONFIRMED", source_refs: item.grounding_refs || [] })));
    }
    const items = [...canonical, ...legacy];
    const grid = byId("candidate-card-grid");
    grid.innerHTML = personalGuideCardMarkup() + items.map(candidateCardMarkup).join("");
    window.requestAnimationFrame(playPendingCardReturn);
  }

  function proposalItemEditor(item, index, fallbackRefs) {
    const evidence = (item.grounding_refs || fallbackRefs || [])[0];
    return `<section class="v1-review-item" data-review-item="${index}"><div class="v1-review-source"><p class="v1-section-label">原文</p><p class="v1-review-evidence">${escapeHtml(evidence?.excerpt_or_reference || "无可用结构化摘录")}</p><small>${escapeHtml(evidence?.location || "来源位置待人工核对")}</small></div><div class="v1-review-result"><p class="v1-section-label">提取结果</p><label>标题<input data-field="title" value="${escapeHtml(item.title || "")}"></label><label>组织 / 副标题<input data-field="subtitle" value="${escapeHtml(item.subtitle || "")}"></label><label>日期<input data-field="time" value="${escapeHtml(item.time || "")}"></label><label>摘要<textarea data-field="summary">${escapeHtml(item.summary || "")}</textarea></label><label>事实（每行一条）<textarea data-field="facts">${escapeHtml((item.facts || []).map((fact) => fact.value).join("\n"))}</textarea></label></div></section>`;
  }

  function humanReviewNotices(codes) {
    const messages = (codes || []).map((code) => {
      if (String(code).startsWith("selective_ocr_pages")) return "部分页面经过本地 OCR，请对照原文核对。";
      if (code === "missing_date") return "日期信息不完整，可留空或人工补充。";
      if (code === "ambiguous_company_or_title") return "组织与职位边界不明确，请人工核对。";
      if (code === "no_highlights_detected") return "未识别到明确的经历要点。";
      if (String(code).startsWith("self_reported_")) return "该内容来自材料自述，确认前请核对。";
      return "部分字段需要人工核对。";
    });
    return [...new Set(messages)];
  }

  function proposalReviewMarkup(proposal, position, total) {
    const items = proposal.payload.items?.length ? proposal.payload.items : [{ item_id: `user-item-${proposal.proposal_id}`, item_type: "OTHER", title: "", subtitle: null, time: null, facts: [], grounding_refs: proposal.grounding_refs, warnings: [], uncertainties: [], review_status: "NEEDS_REVIEW" }];
    const warnings = [...(proposal.warnings || []), ...items.flatMap((item) => item.warnings || [])];
    const notices = humanReviewNotices(warnings);
    const materialLabel = materialTypeLabels[proposal.payload.candidate_material_type] || "个人材料";
    return `<article class="v1-review-card" data-proposal-id="${escapeHtml(proposal.proposal_id)}"><p class="v1-review-progress">第 ${position} / ${total} 条</p><h3>${escapeHtml(candidateTypeLabel(items[0]))} · ${escapeHtml(materialLabel)}</h3><p class="v1-review-note">来源：${escapeHtml(proposal.source_label || "本地文件")}${proposal.payload.manual_review_required ? " · 需要人工核对" : ""}</p>${notices.length ? `<p class="v1-review-warning">${escapeHtml(notices.join(" "))}</p>` : ""}${items.map((item, index) => proposalItemEditor(item, index, proposal.grounding_refs)).join("")}<p class="v1-review-note">确认会保存当前字段；如字段经过修改，系统会在内部记录为用户编辑。原始提案始终保留。</p><div class="v1-button-row"><button type="button" class="v1-primary-button" data-review-action="confirm">确认</button><button type="button" class="v1-tertiary-button" data-review-action="reject">拒绝</button></div></article>`;
  }

  async function renderAwaitingCandidateReviews({ advance = false, reset = false, sourceIds } = {}) {
    if (!LocalCandidateReview || !byId("candidate-review-surface")) return;
    if (sourceIds !== undefined) candidateReviewSourceIds = [...new Set(sourceIds || [])];
    const database = await Truth.openDatabase();
    let proposals;
    try {
      const sources = await LocalCandidateReview.getAll(database, "source_documents");
      const sourceById = new Map(sources.map((source) => [source.source_document_id, source]));
      let proposalRecords = await LocalCandidateReview.getAll(database, "context_proposals");
      proposalRecords = await LocalCandidateReview.ensureItemProposalQueue(database, proposalRecords);
      proposals = proposalRecords.filter((proposal) => candidateReviewSourceIds.length && proposal.proposal_type === "CANDIDATE_CONTEXT" && proposal.status === "AWAITING_REVIEW" && proposal.payload?.contract_id === "ariadne-local-candidate-proposal-payload-v1" && proposal.source_document_ids?.some((sourceId) => candidateReviewSourceIds.includes(sourceId))).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.proposal_id.localeCompare(b.proposal_id)).map((proposal) => ({ ...proposal, source_label: sourceById.get(proposal.source_document_ids[0])?.filename || null }));
      const proposalSourceIds = [...new Set(proposals.flatMap((proposal) => proposal.source_document_ids || []))];
      if (proposalSourceIds.length && !RawSource) throw new Error("raw_source_resolver_unavailable");
      for (const sourceId of proposalSourceIds) await RawSource.resolveRawSource(database, sourceId);
    } finally { database.close(); }
    if (reset || !candidateReviewSessionTotal) { candidateReviewSessionTotal = proposals.length; candidateReviewSessionResolved = 0; }
    else if (advance) candidateReviewSessionResolved += 1;
    if (proposals.length > candidateReviewSessionTotal - candidateReviewSessionResolved) candidateReviewSessionTotal = candidateReviewSessionResolved + proposals.length;
    byId("candidate-review-surface").classList.toggle("hidden", !proposals.length);
    byId("candidate-review-surface").dataset.rawSourceIntegrity = proposals.length ? "verified" : "not-applicable";
    byId("candidate-review-list").innerHTML = proposals.length ? proposalReviewMarkup(proposals[0], Math.min(candidateReviewSessionResolved + 1, candidateReviewSessionTotal), candidateReviewSessionTotal) : "";
    if (!proposals.length) { candidateReviewSessionTotal = 0; candidateReviewSessionResolved = 0; }
    return proposals;
  }

  function editedItemsFromCard(card, proposal) {
    return [...card.querySelectorAll("[data-review-item]")].map((section, index) => {
      const original = proposal.payload.items[index] || { item_id: `user-item-${crypto.randomUUID()}`, item_type: "OTHER", grounding_refs: proposal.grounding_refs, warnings: [], uncertainties: [] };
      const value = (field) => section.querySelector(`[data-field="${field}"]`).value.trim();
      const factValues = value("facts").split("\n").map((text) => text.trim()).filter(Boolean);
      const unchanged = value("title") === String(original.title || "") && (value("subtitle") || null) === (original.subtitle || null) && (value("time") || null) === (original.time || null) && (value("summary") || null) === (original.summary || null) && JSON.stringify(factValues) === JSON.stringify((original.facts || []).map((fact) => fact.value));
      if (unchanged) return structuredClone(original);
      return { ...original, title: value("title"), subtitle: value("subtitle") || null, time: value("time") || null, summary: value("summary") || null, facts: factValues.map((text, factIndex) => ({ fact_id: original.facts?.[factIndex]?.fact_id || `${original.item_id}-user-fact-${factIndex + 1}`, label: original.facts?.[factIndex]?.label || "用户补充", value: text })), review_status: "NEEDS_REVIEW", content_origin: "USER_CONFIRMED" };
    });
  }

  async function reviewCandidateProposal(proposalId, action, card) {
    const buttons = [...card.querySelectorAll("[data-review-action]")];
    buttons.forEach((button) => { button.disabled = true; });
    const activeButton = card.querySelector(`[data-review-action="${action}"]`);
    if (activeButton) activeButton.textContent = action === "reject" ? "正在拒绝…" : "正在确认…";
    const database = await Truth.openDatabase();
    try {
      const proposal = (await LocalCandidateReview.getAll(database, "context_proposals")).find((item) => item.proposal_id === proposalId);
      if (!proposal) throw new Error("candidate_proposal_not_found");
      const editedItems = action === "reject" ? null : editedItemsFromCard(card, proposal);
      const decision = action === "reject" ? "REJECT" : JSON.stringify(editedItems) === JSON.stringify(proposal.payload.items) ? "CONFIRM" : "EDIT_AND_CONFIRM";
      const acceptedPayload = decision === "CONFIRM" ? proposal.payload : decision === "EDIT_AND_CONFIRM" ? LocalCandidateReview.editedPayload(proposal, editedItems) : null;
      const outcome = await LocalCandidateReview.persistDecision(database, proposal, decision, acceptedPayload);
      const remaining = await renderAwaitingCandidateReviews({ advance: true });
      byId("personal-page-message").textContent = remaining.length ? "当前内容已处理，继续审核下一条。" : outcome.revision ? "全部内容已审核并保存为候选信息。" : "全部待审核内容已处理。";
      const confirmedItemId = outcome.revision?.payload?.items?.[0]?.item_id;
      if (!remaining.length) completeEmbeddedImport("personal", confirmedItemId ? `candidate:${confirmedItemId}` : "personal-guide");
    } catch (error) {
      buttons.forEach((button) => { button.disabled = false; });
      if (activeButton) activeButton.textContent = action === "reject" ? "拒绝" : "确认";
      throw error;
    } finally { database.close(); }
  }

  function showCandidateSource(source) {
    const batchSuffix = selectedCandidateSources.length > 1 ? ` · 共 ${selectedCandidateSources.length} 个文件` : "";
    const file = source.file || source;
    byId("personal-file-preview").classList.remove("hidden");
    const selectedNames = selectedCandidateSources.map((item) => item.file?.name || item.name).filter(Boolean);
    byId("personal-file-name").textContent = selectedNames.length > 1 ? selectedNames.join("、") : file.name || source.name;
    byId("personal-file-meta").textContent = `${file.type || source.mime_type || selectedCandidateType} · ${source.sizeLabel || formatBytes(file.size) || "本地文件"}${batchSuffix} · 仅本地`;
    byId("personal-file-icon").textContent = (source.extension || file.name?.split(".").pop() || selectedCandidateType.slice(0, 3)).toUpperCase();
    refreshCandidateImportGate();
  }

  function setCandidateExtractionState(state, label) {
    byId("personal-processing").dataset.state = state;
    byId("personal-processing-state").textContent = label;
  }

  function setCompletedSourceSheet(open) {
    sheet(open, "completed-source-sheet");
  }

  function resetInvalidCandidateSelection() {
    selectedCandidateSources = [];
    candidateExecutionState = "READY";
    byId("personal-file-input").value = "";
    byId("personal-file-preview").classList.add("hidden");
    byId("personal-page-message").textContent = "";
    byId("personal-page-message").classList.remove("error");
    byId("personal-processing")?.classList.add("hidden");
    refreshCandidateImportGate();
  }

  async function localOcrEnvironmentCapability() {
    const response = await fetch("/api/local-ocr-capability", { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !["supported", "unsupported", "unverified"].includes(payload.local_ocr)) {
      throw new Error(payload.error || "local_ocr_capability_unavailable");
    }
    return payload.local_ocr;
  }

  async function extractCandidateSource(source, snapshot, signal) {
    const documentDataUrl = await LocalCandidate.readAsDataURL(source.file, source.mime_type);
    const image = source.source_type === "IMAGE";
    const response = await fetch(image ? "/api/local-candidate-image-ocr" : "/api/local-candidate-extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        filename: source.file.name,
        media_type: source.mime_type,
        source_document_id: source.source_document_id,
        runtime_snapshot: snapshot,
        ...(image ? { image_data_url: documentDataUrl } : { document_data_url: documentDataUrl }),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "candidate_local_extraction_failed");
    if (result.model_call_made !== false || result.runtime_snapshot_id !== snapshot.snapshot_id || result.content_hash !== source.content_hash) {
      throw new Error("candidate_local_extraction_contract_failed");
    }
    return result;
  }

  async function processCandidateSource(source, snapshot, database, signal) {
    const sourceDocument = LocalCandidate.sourceDocumentFor(source);
    let durableSource;
    try {
      durableSource = await LocalCandidate.persistCanonicalSource(database, sourceDocument, source.file);
    } catch (error) {
      return { sourceId: source.source_document_id, failed: true, error: String(error?.code || error?.message || "raw_source_persistence_failed").slice(0, 180) };
    }
    const sourceForExtraction = { ...source, file: durableSource.file };
    const startedAt = new Date().toISOString();
    let run = LocalCandidate.processingRunFor(source, snapshot.snapshot_id, "PENDING", startedAt);
    await Truth.persistRecord(database, "processing_runs", run);
    run = LocalCandidate.processingRunFor(source, snapshot.snapshot_id, "RUNNING", startedAt, { run_id: run.run_id, started_at: startedAt });
    await Truth.persistRecord(database, "processing_runs", run);
    try {
      setCandidateExtractionState("EXTRACTING", `正在本地读取并提取：${source.file.name}`);
      const result = await extractCandidateSource(sourceForExtraction, snapshot, signal);
      const artifact = LocalCandidate.artifactFor(source, run, result);
      await Truth.persistRecord(database, "extraction_artifacts", artifact);
      run = LocalCandidate.processingRunFor(source, snapshot.snapshot_id, "SUCCEEDED", startedAt, {
        run_id: run.run_id,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        output_artifact_ids: [artifact.artifact_id],
      });
      await Truth.persistRecord(database, "processing_runs", run);
      return { sourceId: source.source_document_id, succeeded: true, artifact };
    } catch (error) {
      if (error?.name === "AbortError") {
        const cancelled = Truth.cancelProcessingRun(run, new Date().toISOString());
        await Truth.persistRecord(database, "processing_runs", cancelled);
        return { sourceId: source.source_document_id, cancelled: true };
      }
      const errorCode = String(error?.message || "candidate_local_extraction_failed").slice(0, 180);
      const failed = LocalCandidate.processingRunFor(source, snapshot.snapshot_id, "FAILED", startedAt, {
        run_id: run.run_id,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error_code: errorCode,
      });
      await Truth.persistRecord(database, "processing_runs", failed);
      return { sourceId: source.source_document_id, failed: true, error: errorCode };
    }
  }

  async function processCandidateProposal(source, artifact, snapshot, database, signal) {
    const startedAt = new Date().toISOString();
    let run = LocalCandidateProposal.processingRunFor(source, snapshot.snapshot_id, "PENDING", startedAt);
    await Truth.persistRecord(database, "processing_runs", run);
    run = LocalCandidateProposal.processingRunFor(source, snapshot.snapshot_id, "RUNNING", startedAt, { run_id: run.run_id, started_at: startedAt });
    await Truth.persistRecord(database, "processing_runs", run);
    try {
      setCandidateExtractionState("STRUCTURING", `正在按本地确定规则整理：${source.file.name}`);
      const response = await fetch("/api/local-candidate-structure", { method: "POST", headers: { "Content-Type": "application/json" }, signal, body: JSON.stringify({ source_document_id: source.source_document_id, runtime_snapshot: snapshot, candidate_material_type: artifact.payload.candidate_material_type, pages: artifact.payload.pages }) });
      const result = await response.json();
      if (!response.ok || result.model_call_made !== false || result.runtime_snapshot_id !== snapshot.snapshot_id) throw new Error(result.error || "candidate_local_structuring_failed");
      const proposals = LocalCandidateProposal.proposalsFor({ source, artifact, structuringRun: run, result });
      for (const proposal of proposals) await Truth.persistRecord(database, "context_proposals", proposal);
      run = LocalCandidateProposal.processingRunFor(source, snapshot.snapshot_id, "SUCCEEDED", startedAt, { run_id: run.run_id, started_at: startedAt, finished_at: new Date().toISOString(), proposal_ids: proposals.map((proposal) => proposal.proposal_id) });
      await Truth.persistRecord(database, "processing_runs", run);
      return { succeeded: true, proposals, manual: proposals.some((proposal) => proposal.payload.manual_review_required) };
    } catch (error) {
      if (error?.name === "AbortError") {
        await Truth.persistRecord(database, "processing_runs", Truth.cancelProcessingRun(run, new Date().toISOString()));
        return { cancelled: true };
      }
      const failed = LocalCandidateProposal.processingRunFor(source, snapshot.snapshot_id, "FAILED", startedAt, { run_id: run.run_id, started_at: startedAt, finished_at: new Date().toISOString(), error_code: String(error?.message || "candidate_local_structuring_failed").slice(0, 180) });
      await Truth.persistRecord(database, "processing_runs", failed);
      return { failed: true, error: failed.error_code };
    }
  }

  async function runCandidateProcessing() {
    const button = byId("start-personal-processing");
    const gate = refreshCandidateImportGate();
    if (!gate.allowed || gate.authority.runtime.mode !== "local") throw new Error(`runtime_capability_${gate.state}`);
    if (!RuntimeExecution || !Truth || !LocalCandidate || !LocalCandidateProposal) throw new Error("local_candidate_extraction_dependencies_unavailable");
    const sources = selectedCandidateSources.filter((source) => ["NEW", "RETRY"].includes(source.import_state));
    if (!sources.length) {
      await renderAwaitingCandidateReviews({ reset: true, sourceIds: selectedCandidateSources.filter((source) => source.import_state === "PENDING_REVIEW").map((source) => source.source_document_id) });
      return;
    }
    candidateProcessingInProgress = true;
    candidateExecutionState = "PROCESSING";
    candidateBatchAbortController = new AbortController();
    button.disabled = true;
    byId("replace-personal-file").textContent = "取消本次提取";
    byId("personal-processing").classList.remove("hidden");
    setCandidateExtractionState("PREPARING", "正在验证本地执行环境");
    const batchId = sources[0].batch_id;
    const batchCreatedAt = new Date().toISOString();
    let database = null;
    try {
      const localOcr = await localOcrEnvironmentCapability();
      const snapshot = RuntimeExecution.createRuntimeSnapshot(
        { mode: "local" },
        { environmentCapabilities: { local_ocr: localOcr } },
      );
      database = await Truth.openDatabase();
      await Truth.persistRecord(database, "runtime_snapshots", snapshot);
      await Truth.persistRecord(database, "processing_batches", LocalCandidate.batchFor(sources, "PENDING", batchCreatedAt));
      await Truth.persistRecord(database, "processing_batches", LocalCandidate.batchFor(sources, "RUNNING", batchCreatedAt, { batch_id: batchId, created_at: batchCreatedAt }));
      const completed = [];
      const failures = [];
      let proposalCount = 0;
      let manualReviewCount = 0;
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        if (candidateBatchAbortController.signal.aborted) {
          const cancelled = LocalCandidate.batchFor(sources, "CANCELLED", batchCreatedAt, {
            batch_id: batchId,
            created_at: batchCreatedAt,
            cancelled_at: new Date().toISOString(),
            completed_source_ids: completed,
            cancelled_source_id: source.source_document_id,
            not_started_source_ids: sources.slice(index + 1).map((item) => item.source_document_id),
          });
          await Truth.persistRecord(database, "processing_batches", cancelled);
          setCandidateExtractionState("CANCELLED", "已取消本次本地提取；未处理剩余文件");
          byId("personal-page-message").textContent = "本次导入已取消。此前已完成的本地提取记录保留；未形成已确认候选信息。";
          return;
        }
        showCandidateSource(source);
        const result = await processCandidateSource(source, snapshot, database, candidateBatchAbortController.signal);
        if (result.cancelled) {
          const cancelled = LocalCandidate.batchFor(sources, "CANCELLED", batchCreatedAt, {
            batch_id: batchId,
            created_at: batchCreatedAt,
            cancelled_at: new Date().toISOString(),
            completed_source_ids: completed,
            cancelled_source_id: source.source_document_id,
            not_started_source_ids: sources.slice(index + 1).map((item) => item.source_document_id),
          });
          await Truth.persistRecord(database, "processing_batches", cancelled);
          setCandidateExtractionState("CANCELLED", "已取消本次本地提取；未处理剩余文件");
          byId("personal-page-message").textContent = "本次导入已取消。此前已完成的本地提取记录保留；未形成已确认候选信息。";
          return;
        }
        if (result.succeeded) {
          const proposalResult = await processCandidateProposal(source, result.artifact, snapshot, database, candidateBatchAbortController.signal);
          if (proposalResult.cancelled) {
            const cancelled = LocalCandidate.batchFor(sources, "CANCELLED", batchCreatedAt, { batch_id: batchId, created_at: batchCreatedAt, cancelled_at: new Date().toISOString(), completed_source_ids: completed, cancelled_source_id: source.source_document_id, not_started_source_ids: sources.slice(index + 1).map((item) => item.source_document_id) });
            await Truth.persistRecord(database, "processing_batches", cancelled);
            setCandidateExtractionState("CANCELLED", "已取消本次本地整理；未处理剩余文件");
            return;
          }
          if (proposalResult.failed) failures.push(proposalResult);
          else { completed.push(result.sourceId); proposalCount += proposalResult.proposals.length; if (proposalResult.manual) manualReviewCount += proposalResult.proposals.filter((proposal) => proposal.payload.manual_review_required).length; }
        }
        if (result.failed) failures.push(result);
      }
      const finalStatus = failures.length ? "FAILED" : "COMPLETED";
      await Truth.persistRecord(database, "processing_batches", LocalCandidate.batchFor(sources, finalStatus, batchCreatedAt, {
        batch_id: batchId,
        completed_source_ids: completed,
        created_at: batchCreatedAt,
        finished_at: new Date().toISOString(),
      }));
      setCandidateExtractionState("READY_FOR_REVIEW", failures.length ? "本地提取完成，但部分文件失败" : "本地提取已完成");
      byId("personal-page-message").textContent = failures.length
        ? `已有文件完成本地提取，但 ${failures.length} 个文件未能完成整理。${personalErrorCopy({ code: failures[0]?.error })} 尚未形成正式候选信息，未调用服务商或模型。`
        : `已根据本地确定规则生成 ${proposalCount} 条候选信息提案（${manualReviewCount} 条需人工处理）；均待人工审核，尚未形成正式候选信息，未调用服务商或模型。`;
      byId("personal-page-message").classList.toggle("error", failures.length > 0);
      await renderAwaitingCandidateReviews({ reset: true, sourceIds: sources.map((source) => source.source_document_id) });
    } finally {
      database?.close?.();
      candidateBatchAbortController = null;
      candidateProcessingInProgress = false;
      if (candidateExecutionState === "PROCESSING") candidateExecutionState = "COMPLETE";
      byId("replace-personal-file").textContent = "替换";
      refreshCandidateImportGate();
    }
  }

  function initPersonal() {
    renderPersonalLibrary().catch(showPersonalError);
  }

  function initPersonalImport() {
    renderAwaitingCandidateReviews({ sourceIds: [] }).catch(showPersonalError);
    byId("candidate-review-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-action]");
      if (!button) return;
      const card = button.closest("[data-proposal-id]");
      reviewCandidateProposal(card.dataset.proposalId, button.dataset.reviewAction, card).catch(showPersonalError);
    });
    const handleCandidateFiles = (files) => {
      const selectionVersion = candidateSelectionVersion + 1;
      acceptCandidateFiles(files).catch((error) => showPersonalError(error, selectionVersion));
    };
    byId("personal-import-types").addEventListener("click", (event) => {
      const button = event.target.closest("[data-import-type]");
      if (!button) return;
      selectedCandidateType = button.dataset.importType;
      byId("personal-import-types").querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      if (selectedCandidateSources.length) handleCandidateFiles(selectedCandidateSources.map((source) => source.file));
    });
    const acceptCandidateFiles = async (files) => {
      const selectionVersion = ++candidateSelectionVersion;
      setCompletedSourceSheet(false);
      byId("personal-page-message").textContent = "";
      byId("personal-page-message").classList.remove("error");
      const batchId = `batch-candidate-extraction-${crypto.randomUUID()}`;
      candidateExecutionState = "READY";
      const prepared = await Promise.all(Array.from(files || []).map((file) => LocalCandidate.prepareSource(file, batchId, selectedCandidateType)));
      const unique = [...new Map(prepared.map((source) => [source.source_document_id, source])).values()];
      const database = await Truth.openDatabase();
      let records;
      try {
        const [sourceDocuments, proposals, runs, revisions, lifecycle] = await Promise.all([
          LocalCandidateReview.getAll(database, "source_documents"),
          LocalCandidateReview.getAll(database, "context_proposals"),
          LocalCandidateReview.getAll(database, "processing_runs"),
          LocalCandidateReview.getAll(database, "candidate_context_revisions"),
          LocalCandidateReview.getAll(database, "candidate_context_lifecycle"),
        ]);
        records = { source_documents: sourceDocuments, context_proposals: proposals, processing_runs: runs, candidate_context_revisions: revisions, candidate_context_lifecycle: lifecycle };
        const existingStates = unique.map((source) => ({ source, import_state: LocalCandidateReview.sourceImportState(source.source_document_id, records) }));
        for (const item of existingStates.filter((entry) => ["PENDING_REVIEW", "ACTIVE", "COMPLETED"].includes(entry.import_state))) {
          await LocalCandidate.persistCanonicalSource(database, LocalCandidate.sourceDocumentFor(item.source), item.source.file);
        }
      } finally { database.close(); }
      if (selectionVersion !== candidateSelectionVersion) return;
      selectedCandidateSources = unique.map((source) => ({ ...source, import_state: LocalCandidateReview.sourceImportState(source.source_document_id, records) }));
      if (selectedCandidateSources[0]) showCandidateSource(selectedCandidateSources[0]);
      const pending = selectedCandidateSources.filter((source) => source.import_state === "PENDING_REVIEW");
      const active = selectedCandidateSources.filter((source) => source.import_state === "ACTIVE");
      const completedSources = selectedCandidateSources.filter((source) => source.import_state === "COMPLETED");
      const actionable = selectedCandidateSources.filter((source) => ["NEW", "RETRY"].includes(source.import_state));
      if (pending.length) await renderAwaitingCandidateReviews({ reset: true, sourceIds: pending.map((source) => source.source_document_id) });
      else await renderAwaitingCandidateReviews({ reset: true, sourceIds: [] });
      candidateExecutionState = actionable.length ? "READY" : completedSources.length && !active.length && !pending.length ? "COMPLETED_SOURCE" : "COMPLETE";
      if (pending.length && !actionable.length) byId("personal-page-message").textContent = "该文件已有待审核内容，已恢复审核队列。";
      else if (completedSources.length && !actionable.length && !active.length) byId("personal-page-message").textContent = "该 PDF 已被读取。点击确认返回个人资料。";
      else if (active.length && !actionable.length) byId("personal-page-message").textContent = "该文件已导入，无需重复处理。";
      else if (active.length || pending.length || completedSources.length) byId("personal-page-message").textContent = `已跳过 ${active.length + pending.length + completedSources.length} 个已导入或待审核文件；其余文件可以继续本地提取。`;
      else byId("personal-page-message").textContent = "";
      setCompletedSourceSheet(candidateExecutionState === "COMPLETED_SOURCE");
      refreshCandidateImportGate();
    };
    installFileDropzone("personal-dropzone", "personal-file-input", handleCandidateFiles);
    byId("replace-personal-file").addEventListener("click", () => {
      if (candidateProcessingInProgress) {
        candidateBatchAbortController?.abort();
        setCandidateExtractionState("CANCELLING", "正在取消本次本地提取");
        return;
      }
      byId("personal-file-input").value = "";
      byId("personal-file-input").click();
    });
    byId("start-personal-processing").addEventListener("click", () => runCandidateProcessing().catch(showPersonalError));
    byId("confirm-completed-source").addEventListener("click", () => {
      setCompletedSourceSheet(false);
      if (!completeEmbeddedImport("personal", "personal-guide")) window.location.assign("/personal-information.html");
    });
    byId("document-size-limit-dialog").addEventListener("cancel", (event) => event.preventDefault());
    byId("confirm-document-size-limit").addEventListener("click", () => {
      byId("document-size-limit-dialog").close();
      resetInvalidCandidateSelection();
    });
    refreshCandidateImportGate();
  }

  function showPersonalError(error, selectionVersion = candidateSelectionVersion) {
    if (selectionVersion !== candidateSelectionVersion) return;
    candidateProcessingInProgress = false;
    if (candidateExecutionState === "PROCESSING") candidateExecutionState = "COMPLETE";
    if (String(error?.code || error?.message || error || "") === "document_size_limit_exceeded") {
      byId("personal-page-message").textContent = "";
      byId("personal-page-message").classList.remove("error");
      byId("personal-processing")?.classList.add("hidden");
      refreshCandidateImportGate();
      const dialog = byId("document-size-limit-dialog");
      if (!dialog.open) dialog.showModal();
      return;
    }
    byId("personal-page-message").textContent = `无法整理材料：${personalErrorCopy(error)}`;
    byId("personal-page-message").classList.add("error");
    refreshCandidateImportGate();
    byId("personal-processing")?.classList.add("hidden");
  }

  const detailPanelTimers = new WeakMap();
  function firstVisibleEditableControl(form) {
    return [...form.querySelectorAll("input, textarea, select, button")].find((control) => {
      if (control.disabled || control.hidden || control.type === "hidden") return false;
      const style = window.getComputedStyle(control);
      return control.offsetParent !== null && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  function createDetailPanelController(triggerId, stages) {
    let current = "closed";
    const show = (stage, { focusFirst = false } = {}) => {
      current = stage;
      Object.entries(stages).forEach(([name, panelId]) => {
        const panel = byId(panelId);
        const active = name === stage;
        window.clearTimeout(detailPanelTimers.get(panel));
        panel.setAttribute("aria-hidden", String(!active));
        if (active) {
          panel.classList.remove("hidden");
          window.requestAnimationFrame(() => {
            panel.classList.add("is-active");
            if (focusFirst) {
              panel.scrollIntoView({ behavior: "smooth", block: "center" });
              firstVisibleEditableControl(panel)?.focus({ preventScroll: true });
            }
          });
        } else {
          panel.classList.remove("is-active");
          const timer = window.setTimeout(() => panel.classList.add("hidden"), 210);
          detailPanelTimers.set(panel, timer);
        }
      });
      byId(triggerId).setAttribute("aria-expanded", String(stage !== "closed"));
    };
    return Object.freeze({ show, current: () => current });
  }

  function createDeletePopover(popoverId) {
    const popover = byId(popoverId);
    const menu = popover.querySelector(".v1-delete-popover-menu");
    let opener = null;
    let closeTimer = null;
    const close = ({ restoreFocus = false } = {}) => {
      window.clearTimeout(closeTimer);
      popover.classList.remove("is-open");
      popover.setAttribute("aria-hidden", "true");
      closeTimer = window.setTimeout(() => popover.classList.add("hidden"), 180);
      if (restoreFocus) opener?.focus({ preventScroll: true });
    };
    const position = () => {
      const rect = opener.getBoundingClientRect();
      const viewportPadding = 12;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const left = Math.max(viewportPadding, Math.min(rect.right - width, window.innerWidth - width - viewportPadding));
      const top = rect.top - height - 10 >= viewportPadding ? rect.top - height - 10 : Math.min(rect.bottom + 10, window.innerHeight - height - viewportPadding);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    };
    const open = (trigger) => {
      opener = trigger;
      window.clearTimeout(closeTimer);
      popover.classList.remove("hidden");
      popover.setAttribute("aria-hidden", "false");
      position();
      window.requestAnimationFrame(() => popover.classList.add("is-open"));
    };
    popover.querySelectorAll("[data-delete-popover-cancel]").forEach((button) => button.addEventListener("click", () => close({ restoreFocus: true })));
    window.addEventListener("resize", () => { if (!popover.classList.contains("hidden")) position(); });
    return Object.freeze({ open, close });
  }

  function installFileDropzone(dropzoneId, inputId, onFiles) {
    const dropzone = byId(dropzoneId);
    const input = byId(inputId);
    if (!dropzone || !input) return;
    const openChooser = () => {
      if (input.disabled) return;
      input.value = "";
      input.click();
    };
    dropzone.addEventListener("click", openChooser);
    input.addEventListener("change", (event) => onFiles(event.target.files));
    const prevent = (event) => { event.preventDefault(); event.stopPropagation(); };
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => {
      prevent(event);
      if (!input.disabled) dropzone.classList.add("is-dragover");
    }));
    dropzone.addEventListener("dragleave", (event) => {
      prevent(event);
      if (!event.relatedTarget || !dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", (event) => {
      prevent(event);
      dropzone.classList.remove("is-dragover");
      if (!input.disabled) onFiles(event.dataTransfer?.files);
    });
  }

  function renderCandidate(item) {
    activeCandidate = item;
    byId("candidate-type").textContent = candidateTypeLabel(item);
    const reviewState = byId("candidate-review-state");
    const canonical = item.data_class === "CANONICAL_CONFIRMED";
    reviewState.classList.toggle("hidden", canonical);
    reviewState.textContent = canonical ? "" : "待审核 · 演示";
    byId("candidate-title").textContent = item.title;
    byId("candidate-subtitle").textContent = item.subtitle || "";
    byId("candidate-time").textContent = item.time || "";
    byId("candidate-summary").textContent = item.summary;
    byId("candidate-facts").innerHTML = item.facts.map((fact, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><p><b>${escapeHtml(candidateFactLabel(fact.label))}</b>${escapeHtml(fact.value)}</p></div>`).join("");
    byId("candidate-ownership").textContent = item.ownership || "未记录";
    byId("candidate-source").textContent = `${item.source_refs?.[0]?.location || "来源待核对"} · ${item.source_refs?.[0]?.excerpt_or_reference || "来源未记录"}`;
  }

  function setDetailRuntimeMode(record, paneId, editButtonId, runtimeBadgeId) {
    const gate = currentOperationGate("ai_conversation");
    const runtime = gate.authority.runtime;
    const conversationAllowed = runtime.mode === "model" && gate.allowed;
    document.body.dataset.detailRuntime = runtime.mode;
    document.body.dataset.recordRecognition = Demo.isAIRecognizedRecord(record) ? "ai" : "local";
    document.body.classList.toggle("v1-ai-capable", conversationAllowed);
    const pane = byId(paneId);
    pane?.classList.toggle("hidden", !conversationAllowed);
    pane?.setAttribute("aria-hidden", String(!conversationAllowed));
    pane?.querySelectorAll("input, textarea, button").forEach((control) => { control.disabled = !conversationAllowed; });
    byId(editButtonId)?.classList.toggle("hidden", conversationAllowed);
    if (byId(runtimeBadgeId)) byId(runtimeBadgeId).textContent = runtimeLabel(runtime);
    setRuntimeGateMessage(record.item_id ? "candidate-detail-message" : "job-detail-message", runtime.mode === "model" && !conversationAllowed ? unavailableCopy(gate, "对话") : "");
    return conversationAllowed;
  }

  async function initCandidateDetail() {
    const contextId = new URLSearchParams(window.location.search).get("context");
    const itemId = new URLSearchParams(window.location.search).get("item") || Demo.CANDIDATE_FIXTURES[0].item_id;
    let canonicalRevision = null;
    let candidate = null;
    if (contextId && Truth && LocalCandidateReview) {
      const database = await Truth.openDatabase();
      const [revisionRecords, lifecycleRecords] = await Promise.all([
        LocalCandidateReview.getAll(database, "candidate_context_revisions"),
        LocalCandidateReview.getAll(database, "candidate_context_lifecycle"),
      ]);
      database.close();
      canonicalRevision = LocalCandidateReview.latestRevision(revisionRecords, contextId);
      const item = canonicalRevision?.payload?.items?.find((candidateItem) => candidateItem.item_id === itemId);
      if (!item) throw new Error("candidate_item_not_found");
      if (LocalCandidateReview.removedItemKeys(lifecycleRecords).has(LocalCandidateReview.candidateItemKey(contextId, itemId))) throw new Error("candidate_item_removed");
      candidate = { ...item, data_class: "CANONICAL_CONFIRMED", context_id: contextId, source_refs: item.grounding_refs || [] };
    } else {
      const storedCandidate = await Demo.get(Demo.DEMO_STORES.candidates, itemId);
      const storedRecords = await localizedCandidateRecords(storedCandidate ? [storedCandidate] : []);
      const stored = storedRecords[0] || null;
      const fallback = Demo.CANDIDATE_FIXTURES.find((item) => item.item_id === itemId);
      if (!stored && !fallback) throw new Error("candidate_item_not_found");
      candidate = stored || Demo.clone(fallback);
    }
    renderCandidate(candidate);
    setDetailRuntimeMode(candidate, "candidate-ai-pane", "open-direct-edit", "candidate-ai-runtime");
    const sourceIdFor = (record, revision) => {
      const allowed = new Set(revision?.provenance?.source_document_ids || []);
      const grounded = (record.source_refs || record.grounding_refs || []).map((ref) => ref.source_document_id).find((sourceId) => sourceId && (!allowed.size || allowed.has(sourceId)));
      return grounded || revision?.provenance?.source_document_ids?.[0] || null;
    };
    const panels = createDetailPanelController("open-direct-edit", { edit: "candidate-edit-form" });
    const deletePopover = createDeletePopover("candidate-delete-popover");
    const setDirectEditOpen = (open, focusTarget = true) => {
      panels.show(open ? "edit" : "closed", { focusFirst: open && focusTarget });
    };
    byId("open-direct-edit").addEventListener("click", () => {
      const opening = panels.current() === "closed";
      if (!opening) { setDirectEditOpen(false, false); return; }
      byId("candidate-edit-title").value = activeCandidate.title || "";
      byId("candidate-edit-subtitle").value = activeCandidate.subtitle || "";
      byId("candidate-edit-time").value = activeCandidate.time || "";
      byId("candidate-edit-summary").value = activeCandidate.summary || "";
      byId("candidate-edit-facts").value = activeCandidate.facts.map((fact) => fact.value).join("\n");
      byId("direct-edit-preview").classList.add("hidden");
      setDirectEditOpen(true);
    });
    window.addEventListener("message", (event) => {
      if (event.origin === window.location.origin && event.data?.type === "job-radar-v1-open-detail-edit") byId("open-direct-edit").click();
    });
    byId("cancel-direct-edit").addEventListener("click", () => setDirectEditOpen(false, false));
    byId("open-candidate-delete").addEventListener("click", (event) => deletePopover.open(event.currentTarget));
    document.querySelectorAll("[data-candidate-delete-scope]").forEach((button) => button.addEventListener("click", async () => {
      const scope = button.dataset.candidateDeleteScope;
      const scopeButtons = [...document.querySelectorAll("[data-candidate-delete-scope]")];
      scopeButtons.forEach((control) => { control.disabled = true; });
      const sourceId = sourceIdFor(activeCandidate, canonicalRevision);
      try {
        if (canonicalRevision) {
          const database = await Truth.openDatabase();
          try {
            if (scope === "source") await LocalCandidateReview.persistSourceHardDelete(database, sourceId);
            else await LocalCandidateReview.persistRemoval(database, canonicalRevision, itemId);
          } finally { database.close(); }
        } else if (scope === "source") {
          await LocalCandidateReview.hardDeleteLegacySource(Demo, Demo.DEMO_STORES.candidates, sourceId);
        } else {
          await LocalCandidateReview.removeLegacyContext(Demo, Demo.DEMO_STORES.candidates, itemId);
        }
        const message = scope === "source" ? "已移除此文件导入的所有内容；现在可以重新导入同一文件。" : "已从个人资料中移除这张卡片；原始文件与提取记录仍然保留。";
        deletePopover.close();
        byId("candidate-detail-message").textContent = message;
        byId("candidate-detail-message").classList.remove("error");
        if (!completeEmbeddedImport("personal", `candidate:${itemId}`)) returnToCardLibrary("/personal-information.html", "personal-guide");
      } catch (error) {
        scopeButtons.forEach((control) => { control.disabled = false; });
        byId("candidate-detail-message").textContent = `无法删除：${personalErrorCopy(error)}`;
        byId("candidate-detail-message").classList.add("error");
      }
    }));
    byId("preview-direct-edit").addEventListener("click", () => {
      const values = byId("candidate-edit-facts").value.split("\n").map((value) => value.trim()).filter(Boolean);
      pendingDirectEdit = { title: byId("candidate-edit-title").value.trim(), subtitle: byId("candidate-edit-subtitle").value.trim() || null, time: byId("candidate-edit-time").value.trim() || null, summary: byId("candidate-edit-summary").value.trim() || null, facts: values.map((value, index) => ({ fact_id: activeCandidate.facts[index]?.fact_id || `direct-fact-${index + 1}`, label: activeCandidate.facts[index]?.label || "用户补充", value })) };
      if (!pendingDirectEdit.title) return;
      byId("direct-before").textContent = `${activeCandidate.title} · ${activeCandidate.facts.length} 条事实`;
      byId("direct-after").textContent = `${pendingDirectEdit.title} · ${pendingDirectEdit.facts.length} 条事实`;
      setDirectEditOpen(false, false);
      byId("direct-edit-preview").classList.remove("hidden");
      byId("direct-edit-preview").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    byId("back-to-direct-edit").addEventListener("click", () => { byId("direct-edit-preview").classList.add("hidden"); setDirectEditOpen(true); });
    byId("confirm-direct-edit").addEventListener("click", async () => {
      if (!pendingDirectEdit) return;
      const button = byId("confirm-direct-edit");
      button.disabled = true;
      try {
        if (canonicalRevision) {
          const originalItem = canonicalRevision.payload.items.find((item) => item.item_id === itemId);
          const editedItem = { ...originalItem, ...pendingDirectEdit, content_origin: "USER_CONFIRMED", review_status: "CONFIRMED" };
          const database = await Truth.openDatabase();
          try {
            const outcome = await LocalCandidateReview.persistUserEdit(database, canonicalRevision, itemId, editedItem);
            canonicalRevision = outcome.revision;
            const confirmedItem = canonicalRevision.payload.items.find((item) => item.item_id === itemId);
            activeCandidate = { ...confirmedItem, data_class: "CANONICAL_CONFIRMED", context_id: contextId, source_refs: confirmedItem.grounding_refs || [] };
            byId("candidate-detail-message").textContent = `修改已保存为第 ${canonicalRevision.version} 个确认版本；上一版本仍保留。`;
          } finally { database.close(); }
        } else {
          activeCandidate = { ...activeCandidate, ...pendingDirectEdit, item_version: (Number(activeCandidate.item_version) || 1) + 1, updated_at: new Date().toISOString() };
          await Demo.put(Demo.DEMO_STORES.candidates, activeCandidate);
          byId("candidate-detail-message").textContent = "修改只保存到本地演示记录；未晋升为已确认候选信息。";
        }
        renderCandidate(activeCandidate);
        byId("direct-edit-preview").classList.add("hidden");
        panels.show("closed");
        pendingDirectEdit = null;
      } finally {
        button.disabled = false;
      }
    });

  }

  function jobCardMarkup(job) {
    const canonical = job.data_class === "CANONICAL_CONFIRMED";
    const stateBadge = canonical ? "" : '<span class="v1-review-chip">演示数据</span>';
    return `<a class="v1-candidate-card job" data-transition-key="job:${escapeHtml(job.job_context_id)}" href="/job-detail.html?job=${encodeURIComponent(job.job_context_id)}"><div class="v1-card-top"><span class="v1-type-chip">职位描述</span>${stateBadge}</div><h3>${escapeHtml(job.title)}</h3><p class="v1-card-subtitle">${escapeHtml(job.company)} · ${escapeHtml(job.location)}</p><p class="v1-card-summary">${escapeHtml(job.summary)}</p><ul>${job.requirements.slice(0, 3).map((item) => `<li>${escapeHtml(item.label)}</li>`).join("")}</ul></a>`;
  }

  function jobGuideCardMarkup() {
    return `<a class="v1-add-guide-card job" data-transition-key="job-guide" href="/jd-import.html"><span class="v1-add-guide-icon" aria-hidden="true">＋</span><span><b>添加职位描述</b></span><p class="v1-guide-copy"><span>点击进入导入页面，建立期望职位卡片。</span><span aria-hidden="true">文件仅在当前浏览器中处理</span></p></a>`;
  }

  async function localizedJobRecords(records) {
    return Promise.all(records.map(async (record) => {
      if (record.job_context_id !== Demo.JOB_FIXTURE.job_context_id || record.copy_locale === "zh-CN") return record;
      const migrated = { ...Demo.clone(Demo.JOB_FIXTURE), imported_from: Demo.clone(record.imported_from || {}), ai_recognized: record.ai_recognized || false, updated_at: new Date().toISOString() };
      await Demo.put(Demo.DEMO_STORES.jobs, migrated);
      return migrated;
    }));
  }

  async function renderJobLibrary() {
    const records = await localizedJobRecords(await Demo.getAll(Demo.DEMO_STORES.jobs));
    const jobs = LocalJobLifecycle ? LocalJobLifecycle.libraryJobs(records) : records;
    const grid = byId("job-card-grid");
    grid.innerHTML = jobGuideCardMarkup() + jobs.map(jobCardMarkup).join("");
    window.requestAnimationFrame(playPendingCardReturn);
  }

  function showJobSource(source) {
    selectedJobSource = source;
    const batchSuffix = selectedJobSources.length > 1 ? ` · 共 ${selectedJobSources.length} 个文件` : "";
    const selectedNames = selectedJobSources.map((item) => item.name).filter(Boolean);
    byId("job-file-preview").classList.remove("hidden");
    byId("job-file-name").textContent = selectedNames.length > 1 ? selectedNames.join("、") : source.name;
    byId("job-file-meta").textContent = `${source.type || selectedJobImportType} · ${source.sizeLabel || "本地文本"}${batchSuffix} · 仅本地`;
    byId("job-file-icon").textContent = (source.extension || selectedJobImportType).slice(0, 4).toUpperCase();
    refreshJobImportGate();
  }

  function resetJobSource() {
    jobSelectionVersion += 1;
    selectedJobSource = null;
    selectedJobSources = [];
    byId("job-file-preview").classList.add("hidden");
    byId("job-page-message").textContent = "";
    byId("job-page-message").classList.remove("error");
    jobExecutionState = "READY";
    refreshJobImportGate();
  }

  function configureJobImportType(type) {
    selectedJobImportType = type;
    byId("job-import-types").querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.jobImportType === type)));
    byId("job-paste-section").classList.toggle("hidden", type !== "Paste");
    byId("job-file-section").classList.toggle("hidden", type === "Paste");
    if (type !== "Paste") byId("job-file-input").accept = ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    resetJobSource();
  }

  async function acceptJobFiles(files) {
    const batchKey = `job-batch-${crypto.randomUUID()}`;
    const sourceUrl = byId("job-link-input")?.value.trim() || null;
    const settled = await Promise.allSettled(Array.from(files || []).map((file) => LocalContextLifecycle.prepareFileSource(file, { batchId: batchKey, namespace: "job", allowedExtensions: ["pdf", "png", "jpg", "jpeg", "docx"] })));
    const prepared = settled.filter((result) => result.status === "fulfilled").map((result) => ({ ...result.value, sizeLabel: formatBytes(result.value.size), import_type: "Document", source_url: sourceUrl }));
    const jobs = await Demo.getAll(Demo.DEMO_STORES.jobs);
    selectedJobSources = LocalContextLifecycle.uniqueSources(prepared).map((source) => ({ ...source, import_state: LocalJobLifecycle.sourceImportState(source.source_document_id, jobs) }));
    jobExecutionState = selectedJobSources.some((source) => ["NEW", "RETRY"].includes(source.import_state)) ? "READY" : "COMPLETE";
    if (selectedJobSources[0]) showJobSource(selectedJobSources[0]);
    else resetJobSource();
    const duplicateCount = prepared.length - selectedJobSources.length;
    const rejectedCount = settled.filter((result) => result.status === "rejected").length;
    const activeCount = selectedJobSources.filter((source) => source.import_state === "ACTIVE").length;
    const pendingCount = selectedJobSources.filter((source) => source.import_state === "PENDING_REVIEW").length;
    const messages = [];
    if (selectedJobSources.length) messages.push(`已识别 ${selectedJobSources.length} 个独立来源。`);
    if (duplicateCount) messages.push(`${duplicateCount} 个完全相同的文件已合并处理。`);
    if (activeCount) messages.push(`${activeCount} 个来源已导入，不会重复生成。`);
    if (pendingCount) messages.push(`${pendingCount} 个来源将恢复现有待审核草稿。`);
    if (rejectedCount) messages.push(`${rejectedCount} 个不支持的文件已跳过。`);
    byId("job-page-message").textContent = messages.join(" ");
    byId("job-page-message").classList.toggle("error", !selectedJobSources.length);
    await renderAwaitingJobReviews({ reset: true });
    refreshJobImportGate();
  }

  async function processJobSource(source, batchAuthority, signal) {
    if (batchAuthority.runtime.mode !== "local") throw new Error("model_job_import_not_connected");
    for (const [state, label] of Demo.JOB_PROCESSING_STATES) {
      if (signal.aborted) return { cancelled: true };
      byId("job-processing").dataset.state = state;
      byId("job-processing-state").textContent = label;
      await delay(260);
    }
    if (signal.aborted) return { cancelled: true };
    const incoming = Demo.createLocalJobFixture(source);
    return LocalJobLifecycle.persistPendingImport(Demo, incoming, source);
  }

  async function runJobProcessing() {
    const button = byId("start-job-processing");
    const gate = refreshJobImportGate();
    if (!gate.allowed) throw new Error(`runtime_capability_${gate.state}`);
    const batchAuthority = gate.authority;
    jobProcessingInProgress = true;
    jobBatchAbortController = new AbortController();
    button.disabled = true;
    byId("replace-job-file").textContent = "取消本次整理";
    byId("job-processing").classList.remove("hidden");
    const sources = (selectedJobImportType === "Paste" ? [selectedJobSource] : selectedJobSources).filter((source) => ["NEW", "RETRY"].includes(source.import_state || "NEW"));
    let lastError = null;
    try {
      for (const source of sources) {
        if (jobBatchAbortController.signal.aborted) {
          jobExecutionState = "COMPLETE";
          byId("job-page-message").textContent = "本次职位整理已取消；此前已保存的草稿保留，剩余文件没有处理。";
          byId("job-page-message").classList.remove("error");
          return;
        }
        showJobSource(source);
        try {
          const result = await processJobSource(source, batchAuthority, jobBatchAbortController.signal);
          if (result.cancelled) {
            jobExecutionState = "COMPLETE";
            byId("job-page-message").textContent = "本次职位整理已取消；当前来源未形成成功结果，剩余文件没有处理，此前已保存的草稿保留。";
            byId("job-page-message").classList.remove("error");
            return;
          }
        }
        catch (error) {
          lastError = error;
          byId("job-page-message").textContent = `无法整理 ${source.name}：${error.message}；其他独立来源将继续处理。`;
          byId("job-page-message").classList.add("error");
        }
      }
      const pending = await renderAwaitingJobReviews({ reset: true });
      jobExecutionState = pending.length ? "COMPLETE" : "READY";
      if (pending.length) {
        byId("job-page-message").textContent = `已建立 ${pending.length} 条待审核职位演示草稿，请逐条确认或拒绝。`;
        byId("job-page-message").classList.remove("error");
      }
      if (lastError && !pending.length) throw lastError;
    } finally {
      jobBatchAbortController = null;
      jobProcessingInProgress = false;
      byId("replace-job-file").textContent = "替换";
      byId("job-processing").classList.add("hidden");
      refreshJobImportGate();
    }
  }

  function jobReviewMarkup(job, position, total) {
    const source = job.imported_from || {};
    return `<article class="v1-review-card" data-job-id="${escapeHtml(job.job_context_id)}"><p class="v1-review-progress">第 ${position} / ${total} 条</p><h3>职位描述 · 演示草稿</h3><p class="v1-review-note">来源：${escapeHtml(source.name || "本地来源")} · 仅用于验证生命周期，不代表真实 JD 语义理解</p><section class="v1-review-item"><div class="v1-review-source"><p class="v1-section-label">来源</p><p class="v1-review-evidence">${escapeHtml(source.name || "本地粘贴文本")}</p><small>${escapeHtml(source.content_hash || source.source_document_id || "来源身份待核对")}</small></div><div class="v1-review-result"><p class="v1-section-label">演示整理结果</p><label>职位名称<input data-job-field="title" value="${escapeHtml(job.title || "")}"></label><label>公司<input data-job-field="company" value="${escapeHtml(job.company || "")}"></label><label>地点<input data-job-field="location" value="${escapeHtml(job.location || "")}"></label><label>摘要<textarea data-job-field="summary">${escapeHtml(job.summary || "")}</textarea></label></div></section><div class="v1-button-row"><button type="button" class="v1-primary-button" data-job-review-action="confirm">确认</button><button type="button" class="v1-tertiary-button" data-job-review-action="reject">拒绝</button></div></article>`;
  }

  async function renderAwaitingJobReviews({ advance = false, reset = false } = {}) {
    if (!LocalJobLifecycle || !byId("job-review-surface")) return [];
    const pending = LocalJobLifecycle.pendingJobs(await Demo.getAll(Demo.DEMO_STORES.jobs)).sort((a, b) => String(a.updated_at || "").localeCompare(String(b.updated_at || "")) || a.job_context_id.localeCompare(b.job_context_id));
    if (reset || !jobReviewSessionTotal) { jobReviewSessionTotal = pending.length; jobReviewSessionResolved = 0; }
    else if (advance) jobReviewSessionResolved += 1;
    if (pending.length > jobReviewSessionTotal - jobReviewSessionResolved) jobReviewSessionTotal = jobReviewSessionResolved + pending.length;
    byId("job-review-surface").classList.toggle("hidden", !pending.length);
    byId("job-review-list").innerHTML = pending.length ? jobReviewMarkup(pending[0], Math.min(jobReviewSessionResolved + 1, jobReviewSessionTotal), jobReviewSessionTotal) : "";
    if (!pending.length) { jobReviewSessionTotal = 0; jobReviewSessionResolved = 0; }
    return pending;
  }

  async function reviewJobDraft(jobId, action, card) {
    const buttons = [...card.querySelectorAll("[data-job-review-action]")];
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const job = await Demo.get(Demo.DEMO_STORES.jobs, jobId);
      if (!job || job.review_status !== "NEEDS_REVIEW") throw new Error("job_review_draft_not_found");
      let confirmed = null;
      if (action === "reject") await LocalJobLifecycle.reject(Demo, Demo.DEMO_STORES.jobs, jobId);
      else {
        const value = (field) => card.querySelector(`[data-job-field="${field}"]`).value.trim();
        if (!value("title")) throw new Error("job_title_required");
        confirmed = await LocalJobLifecycle.confirm(Demo, Demo.DEMO_STORES.jobs, job, { ...job, title: value("title"), company: value("company"), location: value("location"), summary: value("summary") });
      }
      const remaining = await renderAwaitingJobReviews({ advance: true });
      byId("job-page-message").textContent = remaining.length ? "当前草稿已处理，继续审核下一条。" : "全部职位草稿已审核；演示数据已按你的选择更新。";
      byId("job-page-message").classList.remove("error");
      if (!remaining.length) {
        const sourceKey = confirmed ? `job:${confirmed.job_context_id}` : "job-guide";
        if (!completeEmbeddedImport("jd", sourceKey)) returnToCardLibrary("/jd.html", sourceKey);
      }
    } catch (error) {
      buttons.forEach((button) => { button.disabled = false; });
      throw error;
    }
  }

  function initJobLibrary() {
    renderJobLibrary().catch(showJobError);
  }

  function initJobImport() {
    byId("job-import-types").addEventListener("click", (event) => {
      const button = event.target.closest("[data-job-import-type]");
      if (!button) return;
      configureJobImportType(button.dataset.jobImportType);
    });
    byId("job-paste-input").addEventListener("input", async (event) => {
      const text = event.target.value.trim();
      if (!text) { resetJobSource(); return; }
      const selectionVersion = ++jobSelectionVersion;
      const source = await LocalContextLifecycle.prepareTextSource(text, { batchId: `job-batch-${crypto.randomUUID()}`, namespace: "job" });
      const jobs = await Demo.getAll(Demo.DEMO_STORES.jobs);
      if (selectionVersion !== jobSelectionVersion || event.target.value.trim() !== text) return;
      selectedJobSources = [];
      selectedJobSource = { ...source, sizeLabel: `${text.length} 字符`, import_type: "Paste", source_url: byId("job-link-input")?.value.trim() || null, import_state: LocalJobLifecycle.sourceImportState(source.source_document_id, jobs) };
      jobExecutionState = ["NEW", "RETRY"].includes(selectedJobSource.import_state) ? "READY" : "COMPLETE";
      showJobSource(selectedJobSource);
      await renderAwaitingJobReviews({ reset: true });
    });
    installFileDropzone("job-dropzone", "job-file-input", (files) => acceptJobFiles(files).catch(showJobError));
    byId("replace-job-file").addEventListener("click", () => {
      if (jobProcessingInProgress) {
        jobBatchAbortController?.abort();
        byId("job-processing-state").textContent = "正在取消本次职位整理";
        return;
      }
      if (selectedJobImportType === "Paste") byId("job-paste-input").focus();
      else byId("job-file-input").click();
    });
    byId("start-job-processing").addEventListener("click", () => runJobProcessing().catch(showJobError));
    byId("job-review-list").addEventListener("click", (event) => {
      const button = event.target.closest("[data-job-review-action]");
      const card = event.target.closest("[data-job-id]");
      if (!button || !card) return;
      reviewJobDraft(card.dataset.jobId, button.dataset.jobReviewAction, card).catch(showJobError);
    });
    configureJobImportType("Document");
    renderAwaitingJobReviews({ reset: true }).catch(showJobError);
  }

  function showJobError(error) {
    jobProcessingInProgress = false;
    byId("job-page-message").textContent = `无法整理职位：${error.message}`;
    byId("job-page-message").classList.add("error");
    refreshJobImportGate();
    byId("job-processing")?.classList.add("hidden");
  }

  async function initJobDetail() {
    const jobId = new URLSearchParams(window.location.search).get("job") || Demo.JOB_FIXTURE.job_context_id;
    const storedJob = await Demo.get(Demo.DEMO_STORES.jobs, jobId);
    const job = (await localizedJobRecords(storedJob ? [storedJob] : []))[0] || (jobId === Demo.JOB_FIXTURE.job_context_id ? Demo.clone(Demo.JOB_FIXTURE) : null);
    if (!job) throw new Error("job_context_not_found");
    const renderJob = (record) => {
      activeJob = record;
      const canonical = record.data_class === "CANONICAL_CONFIRMED";
      byId("job-review-state").classList.toggle("hidden", canonical);
      byId("job-review-state").textContent = canonical ? "" : "演示数据";
      byId("job-title").textContent = record.title;
      byId("job-company").textContent = record.company;
      byId("job-location").textContent = record.location;
      byId("job-summary").textContent = record.summary;
      const imported = record.imported_from || {};
      byId("job-source").textContent = imported.name ? `${sourceTypeLabels[imported.source_type] || "本地来源"} · ${imported.name}` : `${sourceTypeLabels[record.source?.source_type] || record.source?.source_type || "演示来源"} · ${record.source?.display_name || "来源未记录"}`;
      byId("job-requirements").innerHTML = (record.requirements || []).map((requirement, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><p><b>${escapeHtml(requirement.label)}</b>${escapeHtml(requirement.detail)}</p></div>`).join("");
    };
    renderJob(job);
    setDetailRuntimeMode(job, "job-ai-pane", "open-job-edit", "job-ai-runtime");
    const panels = createDetailPanelController("open-job-edit", { edit: "job-edit-form" });
    const deletePopover = createDeletePopover("job-delete-popover");
    let pendingJobEdit = null;
    const openEdit = (focusFirst = true) => {
      byId("job-edit-title").value = activeJob.title || "";
      byId("job-edit-company").value = activeJob.company || "";
      byId("job-edit-location").value = activeJob.location || "";
      byId("job-edit-summary").value = activeJob.summary || "";
      byId("job-edit-requirements").value = (activeJob.requirements || []).map((item) => `${item.label}：${item.detail}`).join("\n");
      panels.show("edit", { focusFirst });
    };
    byId("open-job-edit").addEventListener("click", () => panels.current() === "closed" ? openEdit() : panels.show("closed"));
    window.addEventListener("message", (event) => {
      if (event.origin === window.location.origin && event.data?.type === "job-radar-v1-open-detail-edit") byId("open-job-edit").click();
    });
    byId("cancel-job-edit").addEventListener("click", () => panels.show("closed"));
    byId("open-job-delete").addEventListener("click", (event) => deletePopover.open(event.currentTarget));
    byId("preview-job-edit").addEventListener("click", () => {
      const title = byId("job-edit-title").value.trim();
      if (!title) return;
      const requirements = byId("job-edit-requirements").value.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => {
        const [label, ...detail] = line.split(/[：:]/);
        return { requirement_id: activeJob.requirements?.[index]?.requirement_id || `job-user-requirement-${index + 1}`, label: label.trim() || "要求", detail: detail.join("：").trim() || label.trim() };
      });
      pendingJobEdit = { title, company: byId("job-edit-company").value.trim(), location: byId("job-edit-location").value.trim(), summary: byId("job-edit-summary").value.trim(), requirements };
      byId("job-edit-before").textContent = `${activeJob.title} · ${activeJob.requirements?.length || 0} 条要求`;
      byId("job-edit-after").textContent = `${pendingJobEdit.title} · ${pendingJobEdit.requirements.length} 条要求`;
      panels.show("closed");
      byId("job-edit-preview").classList.remove("hidden");
      byId("job-edit-preview").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    byId("back-to-job-edit").addEventListener("click", () => { byId("job-edit-preview").classList.add("hidden"); openEdit(); });
    byId("confirm-job-edit").addEventListener("click", async () => {
      if (!pendingJobEdit) return;
      const button = byId("confirm-job-edit");
      button.disabled = true;
      try {
        activeJob = { ...activeJob, ...pendingJobEdit, item_version: (Number(activeJob.item_version) || 1) + 1, updated_at: new Date().toISOString() };
        await Demo.put(Demo.DEMO_STORES.jobs, activeJob);
        renderJob(activeJob);
        byId("job-edit-preview").classList.add("hidden");
        byId("job-detail-message").textContent = "修改已保存到当前本地职位记录。";
        pendingJobEdit = null;
      } finally { button.disabled = false; }
    });
    document.querySelectorAll("[data-job-delete-scope]").forEach((button) => button.addEventListener("click", async () => {
      const controls = [...document.querySelectorAll("[data-job-delete-scope]")];
      controls.forEach((control) => { control.disabled = true; });
      try {
        if (button.dataset.jobDeleteScope === "source") await LocalJobLifecycle.hardDeleteSource(Demo, Demo.DEMO_STORES.jobs, LocalJobLifecycle.sourceIdFor(activeJob));
        else await LocalJobLifecycle.removeCard(Demo, Demo.DEMO_STORES.jobs, activeJob.job_context_id);
        deletePopover.close();
        byId("job-detail-message").textContent = button.dataset.jobDeleteScope === "source" ? "已移除此来源导入的所有职位内容；同批其他来源不受影响。" : "已移除当前职位卡片；来源身份保持不变。";
        if (!completeEmbeddedImport("jd", `job:${activeJob.job_context_id}`)) returnToCardLibrary("/jd.html", "job-guide");
      } catch (error) {
        controls.forEach((control) => { control.disabled = false; });
        byId("job-detail-message").textContent = `无法删除：${error.message}`;
        byId("job-detail-message").classList.add("error");
      }
    }));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll(".v1-bottom-sheet:not(.hidden)").forEach((element) => sheet(false, element.id));
    document.querySelectorAll(".v1-menu[open]").forEach((menu) => menu.removeAttribute("open"));
  });

  installMiniSidebar();
  installMenuBehavior();
  installDetailCardOverlay();
  installCardPageTransitions();
  RuntimeGate.subscribe(() => {
    if (page === "personal-import") refreshCandidateImportGate();
    if (page === "job-import") refreshJobImportGate();
    if (page === "candidate-detail" && activeCandidate) setDetailRuntimeMode(activeCandidate, "candidate-ai-pane", "open-direct-edit", "candidate-ai-runtime");
    if (page === "job-detail" && activeJob) setDetailRuntimeMode(activeJob, "job-ai-pane", "open-job-edit", "job-ai-runtime");
  });
  const initializers = { workspace: initWorkspace, personal: initPersonal, "personal-import": initPersonalImport, "candidate-detail": initCandidateDetail, jd: initJobLibrary, "job-import": initJobImport, "job-detail": initJobDetail };
  async function initializePage() {
    await initializers[page]?.();
  }
  Promise.resolve(initializePage()).catch((error) => {
    const message = document.querySelector(".v1-inline-message");
    if (message) { message.textContent = `页面初始化失败：${error.message}`; message.classList.add("error"); }
  });
})();
