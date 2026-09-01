"use strict";

(function () {
  const Demo = window.JobRadarV1Demo;
  const page = document.body.dataset.v1Page;
  const isEmbeddedDetail = new URLSearchParams(window.location.search).get("embed") === "1";
  if (isEmbeddedDetail) document.body.classList.add("v1-embedded-detail");
  const delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const typeLabels = { WORK_EXPERIENCE: "工作经历", PROJECT: "项目", EDUCATION: "教育经历", OTHER: "其他" };
  const sourceTypeLabels = { SANITIZED_FIXTURE: "本地测试资料", BROWSER_FILE_METADATA: "浏览器本地文件", PASTED_TEXT_METADATA: "本地粘贴文本" };
  let selectedCandidateSources = [];
  let selectedCandidateType = "Resume";
  let selectedJobSource = null;
  let selectedJobImportType = "Document";
  let activeCandidate = null;
  let activeJob = null;
  let pendingDirectEdit = null;
  let pendingPatch = null;
  let pendingJobPatch = null;

  function selectedRuntime() {
    try { return JSON.parse(window.localStorage.getItem("job-radar-selected-runtime") || "null") || { mode: "local" }; }
    catch (_error) { return { mode: "local" }; }
  }

  function runtimeLabel(runtime) {
    if (runtime.mode !== "ai") return "本地运行";
    const provider = ({ deepseek: "DeepSeek", gemini: "Gemini", qwen: "Qwen", preview: "模型" }[runtime.provider] || runtime.provider || "模型");
    return runtime.model ? `${provider} · ${runtime.model}` : provider;
  }

  function askDuplicateResolution({ kind, count, aiMode }) {
    return new Promise((resolve) => {
      const entityLabel = kind === "candidate" ? "个人材料" : "职位描述";
      const overlay = document.createElement("div");
      overlay.className = "v1-duplicate-overlay";
      overlay.innerHTML = `<div class="v1-duplicate-dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-dialog-title">
        <p class="v1-section-label">重复内容检查</p>
        <h2 id="duplicate-dialog-title">检测到 ${count} 组相似${entityLabel}</h2>
        <p>${aiMode ? "可以使用当前模型生成融合建议；建议仍需人工确认后才会保存。" : "本地模式只合并完全一致或高度相似的结构化字段，不会静默覆盖原记录。"}</p>
        <div class="v1-duplicate-actions">
          <button type="button" class="v1-primary-button" data-duplicate-resolution="merge">${aiMode ? "生成模型融合建议" : "融合重复内容"}</button>
          <button type="button" class="v1-secondary-button" data-duplicate-resolution="keep">保留两份</button>
          <button type="button" class="v1-tertiary-button" data-duplicate-resolution="cancel">取消</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      document.body.classList.add("v1-dialog-open");
      const finish = (resolution) => {
        overlay.classList.add("is-closing");
        window.setTimeout(() => { overlay.remove(); document.body.classList.remove("v1-dialog-open"); resolve(resolution); }, 180);
      };
      overlay.addEventListener("click", (event) => {
        const button = event.target.closest("[data-duplicate-resolution]");
        if (button) finish(button.dataset.duplicateResolution);
        else if (event.target === overlay) finish("cancel");
      });
      overlay.querySelector("[data-duplicate-resolution='merge']")?.focus();
    });
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
          <header><button class="v1-detail-overlay-close" type="button" aria-label="关闭详情"></button><p></p><span aria-hidden="true"></span></header>
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
    const facts = item.facts.slice(0, 4).map((fact) => `<li>${escapeHtml(fact.value)}</li>`).join("");
    return `<a class="v1-candidate-card" data-transition-key="candidate:${escapeHtml(item.item_id)}" href="/candidate-detail.html?item=${encodeURIComponent(item.item_id)}">
      <div class="v1-card-top"><span class="v1-type-chip">${escapeHtml(typeLabels[item.item_type] || item.item_type)}</span><span class="v1-review-chip">待审核</span></div>
      <h3>${escapeHtml(item.title)}</h3><p class="v1-card-subtitle">${escapeHtml(item.subtitle)} · ${escapeHtml(item.time)}</p>
      <p class="v1-card-summary">${escapeHtml(item.summary)}</p><ul>${facts}</ul>
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
    const items = await localizedCandidateRecords(await Demo.getAll(Demo.DEMO_STORES.candidates));
    const grid = byId("candidate-card-grid");
    grid.innerHTML = personalGuideCardMarkup() + items.map(candidateCardMarkup).join("");
    window.requestAnimationFrame(playPendingCardReturn);
  }

  function showCandidateSource(source) {
    const batchSuffix = selectedCandidateSources.length > 1 ? ` · 共 ${selectedCandidateSources.length} 个文件` : "";
    byId("personal-file-preview").classList.remove("hidden");
    byId("personal-file-name").textContent = source.name;
    byId("personal-file-meta").textContent = `${source.type || selectedCandidateType} · ${source.sizeLabel || "本地文件"}${batchSuffix} · 仅本地`;
    byId("personal-file-icon").textContent = (source.extension || selectedCandidateType.slice(0, 3)).toUpperCase();
    byId("start-personal-processing").disabled = false;
  }

  async function processCandidateSource(source) {
    for (const [state, label] of Demo.CANDIDATE_PROCESSING_STATES) {
      byId("personal-processing").dataset.state = state;
      byId("personal-processing-state").textContent = label;
      await delay(260);
    }
    const incoming = Demo.createLocalCandidateFixtures(source);
    const existing = await Demo.getAll(Demo.DEMO_STORES.candidates);
    const duplicates = Demo.findCandidateDuplicates(incoming, existing);
    let items = incoming;
    if (duplicates.length) {
      const aiMode = selectedRuntime().mode === "ai";
      const resolution = await askDuplicateResolution({ kind: "candidate", count: duplicates.length, aiMode });
      if (resolution === "cancel") return { cancelled: true };
      if (resolution === "merge" && aiMode) throw new Error("模型融合需要一次真实模型调用；本轮未获调用批准，因此没有写入或覆盖任何材料。");
      if (resolution === "merge") {
        const byIncoming = new Map(duplicates.map((entry) => [entry.incoming.item_id, entry]));
        items = incoming.map((item) => {
          const duplicate = byIncoming.get(item.item_id);
          return duplicate ? Demo.mergeCandidateRecords(duplicate.existing, item) : item;
        });
      }
    }
    await Demo.persistCandidateImport(items, source);
    return { sourceKey: `candidate:${items[0].item_id}` };
  }

  async function runCandidateProcessing() {
    const button = byId("start-personal-processing");
    button.disabled = true;
    byId("personal-processing").classList.remove("hidden");
    let lastSourceKey = null;
    let lastError = null;
    for (const source of selectedCandidateSources) {
      showCandidateSource(source);
      let result;
      try { result = await processCandidateSource(source); }
      catch (error) {
        lastError = error;
        byId("personal-page-message").textContent = `无法理解材料：${error.message}`;
        byId("personal-page-message").classList.add("error");
        continue;
      }
      if (result.cancelled) {
        button.disabled = false;
        byId("personal-processing").classList.add("hidden");
        return;
      }
      lastSourceKey = result.sourceKey;
    }
    if (lastSourceKey && !completeEmbeddedImport("personal", lastSourceKey)) returnToCardLibrary("/personal-information.html", lastSourceKey);
    if (lastError) throw lastError;
  }

  function initPersonal() {
    renderPersonalLibrary().catch(showPersonalError);
  }

  function initPersonalImport() {
    byId("personal-import-types").addEventListener("click", (event) => {
      const button = event.target.closest("[data-import-type]");
      if (!button) return;
      selectedCandidateType = button.dataset.importType;
      byId("personal-import-types").querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    });
    const acceptCandidateFiles = (files) => {
      const batchKey = `personal-source-${crypto.randomUUID()}`;
      const materialType = selectedCandidateType;
      selectedCandidateSources = Array.from(files || []).map((file, index) => ({
        source_type: "BROWSER_FILE_METADATA", source_key: `${batchKey}-${index + 1}`,
        name: file.name, type: file.type || "unknown", size: file.size, sizeLabel: formatBytes(file.size), extension: file.name.split(".").pop() || "FILE",
        import_type: materialType, prompt_profile: Demo.candidatePromptProfile(materialType),
      }));
      if (selectedCandidateSources[0]) showCandidateSource(selectedCandidateSources[0]);
    };
    byId("personal-file-input").addEventListener("change", (event) => {
      acceptCandidateFiles(event.target.files);
    });
    const dropzone = byId("personal-dropzone");
    const preventDrop = (event) => { event.preventDefault(); event.stopPropagation(); };
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => {
      preventDrop(event);
      dropzone.classList.add("is-dragover");
    }));
    dropzone.addEventListener("dragleave", (event) => {
      preventDrop(event);
      if (!event.relatedTarget || !dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", (event) => {
      preventDrop(event);
      dropzone.classList.remove("is-dragover");
      acceptCandidateFiles(event.dataTransfer?.files);
    });
    byId("replace-personal-file").addEventListener("click", () => byId("personal-file-input").click());
    byId("start-personal-processing").addEventListener("click", () => runCandidateProcessing().catch(showPersonalError));
  }

  function showPersonalError(error) {
    byId("personal-page-message").textContent = `无法理解材料：${error.message}`;
    byId("personal-page-message").classList.add("error");
    if (byId("start-personal-processing")) byId("start-personal-processing").disabled = false;
    byId("personal-processing")?.classList.add("hidden");
  }

  function renderCandidate(item) {
    activeCandidate = item;
    byId("candidate-type").textContent = typeLabels[item.item_type] || item.item_type;
    byId("candidate-review-state").textContent = "待审核 · 演示";
    byId("candidate-title").textContent = item.title;
    byId("candidate-subtitle").textContent = item.subtitle || "";
    byId("candidate-time").textContent = item.time || "";
    byId("candidate-summary").textContent = item.summary;
    byId("candidate-facts").innerHTML = item.facts.map((fact, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><p><b>${escapeHtml(fact.label)}</b>${escapeHtml(fact.value)}</p></div>`).join("");
    byId("candidate-ownership").textContent = item.ownership || "未记录";
    byId("candidate-source").textContent = `${item.source_refs[0]?.location || "示例材料"} · ${item.source_refs[0]?.excerpt_or_reference || "来源未记录"}`;
  }

  function messageMarkup(message) {
    const role = message.role === "USER" ? "user" : "assistant";
    const roleLabel = role === "user" ? "你" : "AI";
    const content = role === "assistant" ? String(message.content)
      .replaceAll("当前 Job Context 的", "当前职位上下文的")
      .replaceAll("当前 Candidate Context 的", "当前个人上下文的")
      .replaceAll("Job Context", "职位上下文")
      .replaceAll("Candidate Context", "个人上下文")
      .replaceAll("Human-in-the-loop", "人工参与")
      .replaceAll("local-first", "本地优先")
      .replaceAll("evidence-grounded", "有证据依据")
      .replaceAll("fixture", "测试样例")
      .replaceAll("patch review", "修改审核") : message.content;
    return `<p class="v1-conversation-message ${role}"><span class="sr-only">${roleLabel}：</span>${escapeHtml(content)}</p>`;
  }

  function setDetailRuntimeMode(record, paneId, editButtonId, runtimeBadgeId) {
    const selected = selectedRuntime();
    const previewModelMode = new URLSearchParams(window.location.search).get("preview-source") === "ai";
    const runtime = previewModelMode ? { mode: "ai", provider: "preview", model: "设计预览" } : selected;
    const modelMode = runtime.mode === "ai";
    document.body.dataset.detailRuntime = modelMode ? "ai" : "local";
    document.body.dataset.recordRecognition = Demo.isAIRecognizedRecord(record) ? "ai" : "local";
    document.body.classList.toggle("v1-ai-capable", modelMode);
    byId(paneId)?.classList.toggle("hidden", !modelMode);
    byId(editButtonId)?.classList.toggle("hidden", modelMode);
    if (byId(runtimeBadgeId)) byId(runtimeBadgeId).textContent = runtimeLabel(runtime);
    return modelMode;
  }

  function renderConversation(targetId, conversation, emptyCopy) {
    const target = byId(targetId);
    target.innerHTML = conversation?.messages?.length
      ? conversation.messages.map(messageMarkup).join("")
      : `<p class="v1-conversation-empty">${escapeHtml(emptyCopy)}</p>`;
    target.scrollTop = target.scrollHeight;
  }

  function showCandidatePatch(patch) {
    pendingPatch = patch;
    byId("candidate-patch-before").textContent = patch.before_snapshot.summary;
    byId("candidate-patch-after").textContent = patch.after_preview.summary;
    byId("candidate-patch-reason").textContent = patch.reason;
    byId("candidate-patch-proposal").classList.remove("hidden");
  }

  async function initCandidateConversation(item) {
    const scopeId = item.item_id;
    const emptyCopy = "模型识别结果已保留。你可以询问当前材料，或要求生成单独审核的修改建议。";
    renderConversation("candidate-conversation-messages", await Demo.get(Demo.DEMO_STORES.conversations, Demo.createConversation("CANDIDATE_ITEM", scopeId).conversation_id), emptyCopy);
    byId("candidate-conversation-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = byId("candidate-conversation-input");
      const content = input.value.trim();
      if (!content) return;
      input.value = "";
      await Demo.appendDemoMessage("CANDIDATE_ITEM", scopeId, "USER", content);
      const asksForChange = /修改|更正|纠正|不准确|不对|收紧|改成/.test(content);
      const assistantCopy = asksForChange
        ? "我已把修改整理成独立的待审核建议。只有你确认后，当前材料才会更新。"
        : `根据当前已识别材料：${activeCandidate.summary} 对话内容不会直接改写已确认事实。`;
      const conversation = await Demo.appendDemoMessage("CANDIDATE_ITEM", scopeId, "ASSISTANT", assistantCopy);
      renderConversation("candidate-conversation-messages", conversation, emptyCopy);
      if (asksForChange) showCandidatePatch(Demo.candidatePatchFor(activeCandidate));
    });
    byId("accept-candidate-patch").addEventListener("click", async () => {
      if (!pendingPatch) return;
      activeCandidate = Demo.applyDemoPatch(activeCandidate, pendingPatch);
      await Demo.put(Demo.DEMO_STORES.candidates, activeCandidate);
      renderCandidate(activeCandidate);
      pendingPatch = null;
      byId("candidate-patch-proposal").classList.add("hidden");
      byId("candidate-detail-message").textContent = "AI 修改建议已由你确认并保存。";
    });
    byId("reject-candidate-patch").addEventListener("click", () => {
      pendingPatch = null;
      byId("candidate-patch-proposal").classList.add("hidden");
      byId("candidate-detail-message").textContent = "AI 修改建议已拒绝，材料内容保持不变。";
    });
  }

  async function initCandidateDetail() {
    const itemId = new URLSearchParams(window.location.search).get("item") || Demo.CANDIDATE_FIXTURES[0].item_id;
    const storedCandidate = await Demo.get(Demo.DEMO_STORES.candidates, itemId);
    const storedRecords = await localizedCandidateRecords(storedCandidate ? [storedCandidate] : []);
    const stored = storedRecords[0] || null;
    const fallback = Demo.CANDIDATE_FIXTURES.find((item) => item.item_id === itemId);
    if (!stored && !fallback) throw new Error("candidate_item_not_found");
    let candidate = stored || Demo.clone(fallback);
    if (new URLSearchParams(window.location.search).get("preview-source") === "ai") candidate = { ...candidate, ai_recognized: true, imported_from: { ...(candidate.imported_from || {}), network_sent: true, provider_id: "gemini", model_id: "gemini-3.7-flash" } };
    renderCandidate(candidate);
    const modelMode = setDetailRuntimeMode(candidate, "candidate-ai-pane", "open-direct-edit", "candidate-ai-runtime");
    if (modelMode) await initCandidateConversation(candidate);
    const setDirectEditOpen = (open, focusTarget = true) => {
      const form = byId("candidate-edit-form");
      form.classList.toggle("hidden", !open);
      byId("open-direct-edit").setAttribute("aria-expanded", String(open));
      if (open && focusTarget) window.requestAnimationFrame(() => {
        form.scrollIntoView({ behavior: "smooth", block: "center" });
        byId("candidate-edit-summary").focus({ preventScroll: true });
      });
    };
    byId("open-direct-edit").addEventListener("click", () => {
      const opening = byId("candidate-edit-form").classList.contains("hidden");
      if (!opening) { setDirectEditOpen(false, false); return; }
      byId("candidate-edit-summary").value = activeCandidate.summary;
      byId("candidate-edit-facts").value = activeCandidate.facts.map((fact) => fact.value).join("\n");
      byId("direct-edit-preview").classList.add("hidden");
      setDirectEditOpen(true);
    });
    byId("cancel-direct-edit").addEventListener("click", () => setDirectEditOpen(false, false));
    byId("preview-direct-edit").addEventListener("click", () => {
      const values = byId("candidate-edit-facts").value.split("\n").map((value) => value.trim()).filter(Boolean);
      pendingDirectEdit = { summary: byId("candidate-edit-summary").value.trim(), facts: values.map((value, index) => ({ fact_id: activeCandidate.facts[index]?.fact_id || `direct-fact-${index + 1}`, label: activeCandidate.facts[index]?.label || "补充", value })) };
      if (!pendingDirectEdit.summary || !pendingDirectEdit.facts.length) return;
      byId("direct-before").textContent = `${activeCandidate.summary} · ${activeCandidate.facts.length} 条事实`;
      byId("direct-after").textContent = `${pendingDirectEdit.summary} · ${pendingDirectEdit.facts.length} 条事实`;
      setDirectEditOpen(false, false);
      byId("direct-edit-preview").classList.remove("hidden");
      byId("direct-edit-preview").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    byId("back-to-direct-edit").addEventListener("click", () => { byId("direct-edit-preview").classList.add("hidden"); setDirectEditOpen(true); });
    byId("confirm-direct-edit").addEventListener("click", async () => {
      if (!pendingDirectEdit) return;
      activeCandidate = { ...activeCandidate, ...pendingDirectEdit, item_version: (Number(activeCandidate.item_version) || 1) + 1, updated_at: new Date().toISOString() };
      await Demo.put(Demo.DEMO_STORES.candidates, activeCandidate);
      renderCandidate(activeCandidate);
      byId("direct-edit-preview").classList.add("hidden");
      byId("open-direct-edit").setAttribute("aria-expanded", "false");
      byId("candidate-detail-message").textContent = "直接编辑已确认并保存到本地演示数据仓库；正式候选人事实未被修改。";
    });

  }

  function jobCardMarkup(job) {
    return `<a class="v1-candidate-card job" data-transition-key="job:${escapeHtml(job.job_context_id)}" href="/job-detail.html?job=${encodeURIComponent(job.job_context_id)}"><div class="v1-card-top"><span class="v1-type-chip">职位</span><span class="v1-review-chip">待审核</span></div><h3>${escapeHtml(job.title)}</h3><p class="v1-card-subtitle">${escapeHtml(job.company)} · ${escapeHtml(job.location)}</p><p class="v1-card-summary">${escapeHtml(job.summary)}</p><ul>${job.requirements.slice(0, 3).map((item) => `<li>${escapeHtml(item.label)}</li>`).join("")}</ul></a>`;
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
    const jobs = await localizedJobRecords(await Demo.getAll(Demo.DEMO_STORES.jobs));
    const grid = byId("job-card-grid");
    grid.innerHTML = jobGuideCardMarkup() + jobs.map(jobCardMarkup).join("");
    window.requestAnimationFrame(playPendingCardReturn);
  }

  function showJobSource(source) {
    selectedJobSource = source;
    byId("job-file-preview").classList.remove("hidden");
    byId("job-file-name").textContent = source.name;
    byId("job-file-meta").textContent = `${source.type || selectedJobImportType} · ${source.sizeLabel || "本地文本"}`;
    byId("job-file-icon").textContent = (source.extension || selectedJobImportType).slice(0, 4).toUpperCase();
    byId("start-job-processing").disabled = false;
  }

  function installFileDropzone(dropzoneId, onFile) {
    const dropzone = byId(dropzoneId);
    if (!dropzone) return;
    const prevent = (event) => { event.preventDefault(); event.stopPropagation(); };
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => {
      prevent(event);
      dropzone.classList.add("is-dragover");
    }));
    dropzone.addEventListener("dragleave", (event) => {
      prevent(event);
      if (!event.relatedTarget || !dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", (event) => {
      prevent(event);
      dropzone.classList.remove("is-dragover");
      const file = event.dataTransfer?.files?.[0];
      if (file) onFile(file);
    });
  }

  function resetJobSource() {
    selectedJobSource = null;
    byId("job-file-preview").classList.add("hidden");
    byId("start-job-processing").disabled = true;
    byId("job-page-message").textContent = "";
    byId("job-page-message").classList.remove("error");
  }

  function configureJobImportType(type) {
    selectedJobImportType = type;
    byId("job-import-types").querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.dataset.jobImportType === type)));
    byId("job-paste-section").classList.toggle("hidden", type !== "Paste");
    byId("job-file-section").classList.toggle("hidden", type === "Paste");
    if (type !== "Paste") byId("job-file-input").accept = ".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    resetJobSource();
  }

  function acceptJobFile(file) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = selectedJobImportType === "Document" && ["pdf", "png", "jpg", "jpeg", "docx"].includes(extension);
    if (!allowed) {
      resetJobSource();
      showJobError(new Error("请选择 PDF、PNG、JPG、JPEG 或 DOCX 文件。"));
      return;
    }
    showJobSource({ source_type: "BROWSER_FILE_METADATA", name: file.name, type: file.type || "unknown", size: file.size, sizeLabel: formatBytes(file.size), extension: extension || "FILE" });
  }

  async function runJobProcessing() {
    const button = byId("start-job-processing");
    button.disabled = true;
    byId("job-processing").classList.remove("hidden");
    for (const [state, label] of Demo.JOB_PROCESSING_STATES) {
      byId("job-processing").dataset.state = state;
      byId("job-processing-state").textContent = label;
      await delay(260);
    }
    const source = { ...selectedJobSource, import_type: selectedJobImportType, source_url: byId("job-link-input")?.value.trim() || null };
    const incoming = Demo.createLocalJobFixture(source);
    const existing = await Demo.getAll(Demo.DEMO_STORES.jobs);
    const duplicates = Demo.findJobDuplicates([incoming], existing);
    let job = incoming;
    if (duplicates.length) {
      const aiMode = selectedRuntime().mode === "ai";
      const resolution = await askDuplicateResolution({ kind: "job", count: duplicates.length, aiMode });
      if (resolution === "cancel") { button.disabled = false; byId("job-processing").classList.add("hidden"); return; }
      if (resolution === "merge" && aiMode) throw new Error("模型融合需要一次真实模型调用；本轮未获调用批准，因此没有写入或覆盖任何职位。");
      if (resolution === "merge") job = Demo.mergeJobRecords(duplicates[0].existing, incoming);
    }
    await Demo.persistJobImport(job, source);
    const sourceKey = `job:${job.job_context_id}`;
    if (!completeEmbeddedImport("jd", sourceKey)) returnToCardLibrary("/jd.html", sourceKey);
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
    byId("job-paste-input").addEventListener("input", (event) => {
      if (event.target.value.trim()) showJobSource({ source_type: "PASTED_TEXT_METADATA", name: "粘贴的职位描述.txt", type: "text/plain", sizeLabel: `${event.target.value.trim().length} 字符`, extension: "TXT" });
      else resetJobSource();
    });
    byId("job-file-input").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      acceptJobFile(file);
    });
    installFileDropzone("job-dropzone", acceptJobFile);
    byId("replace-job-file").addEventListener("click", () => selectedJobImportType === "Paste" ? byId("job-paste-input").focus() : byId("job-file-input").click());
    byId("start-job-processing").addEventListener("click", () => runJobProcessing().catch(showJobError));
    configureJobImportType("Document");
  }

  function showJobError(error) {
    byId("job-page-message").textContent = `无法理解职位：${error.message}`;
    byId("job-page-message").classList.add("error");
    if (byId("start-job-processing")) byId("start-job-processing").disabled = false;
    byId("job-processing")?.classList.add("hidden");
  }

  async function initJobDetail() {
    const jobId = new URLSearchParams(window.location.search).get("job") || Demo.JOB_FIXTURE.job_context_id;
    const storedJob = await Demo.get(Demo.DEMO_STORES.jobs, jobId);
    let job = (await localizedJobRecords(storedJob ? [storedJob] : []))[0] || (jobId === Demo.JOB_FIXTURE.job_context_id ? Demo.clone(Demo.JOB_FIXTURE) : null);
    if (!job) throw new Error("job_context_not_found");
    if (new URLSearchParams(window.location.search).get("preview-source") === "ai") job = { ...job, ai_recognized: true, imported_from: { ...(job.imported_from || {}), network_sent: true, provider_id: "gemini", model_id: "gemini-3.7-flash" } };
    activeJob = job;
    byId("job-title").textContent = job.title;
    byId("job-company").textContent = job.company;
    byId("job-location").textContent = job.location;
    byId("job-summary").textContent = job.summary;
    byId("job-source").textContent = `${sourceTypeLabels[job.source.source_type] || job.source.source_type} · ${job.source.display_name}`;
    byId("job-requirements").innerHTML = job.requirements.map((requirement, index) => `<div><span>${String(index + 1).padStart(2, "0")}</span><p><b>${escapeHtml(requirement.label)}</b>${escapeHtml(requirement.detail)}</p></div>`).join("");
    if (setDetailRuntimeMode(job, "job-ai-pane", null, "job-ai-runtime")) await initJobConversation(job);
  }

  async function initJobConversation(job) {
    const scopeId = job.job_context_id;
    const emptyCopy = "模型识别结果已保留。你可以询问当前职位；系统不会推断候选人匹配度。";
    renderConversation("job-conversation-messages", await Demo.get(Demo.DEMO_STORES.conversations, Demo.createConversation("JOB", scopeId).conversation_id), emptyCopy);
    byId("job-conversation-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = byId("job-conversation-input");
      const content = input.value.trim();
      if (!content) return;
      input.value = "";
      await Demo.appendDemoMessage("JOB", scopeId, "USER", content);
      const asksForChange = /修改|更正|纠正|不准确|不对|收紧|改成/.test(content);
      const keyRequirements = job.requirements.slice(0, 3).map((item) => item.label).join("、");
      const assistantCopy = asksForChange
        ? "我已把修改整理成独立的待审核建议。只有你确认后，当前职位卡片才会更新。"
        : `当前职位最核心的要求包括：${keyRequirements}。这只是对职位文本的解释，不代表候选人匹配判断。`;
      const conversation = await Demo.appendDemoMessage("JOB", scopeId, "ASSISTANT", assistantCopy);
      renderConversation("job-conversation-messages", conversation, emptyCopy);
      if (asksForChange) {
        pendingJobPatch = Demo.jobPatchFor(activeJob);
        byId("job-patch-before").textContent = pendingJobPatch.before_snapshot.summary;
        byId("job-patch-after").textContent = pendingJobPatch.after_preview.summary;
        byId("job-patch-reason").textContent = pendingJobPatch.reason;
        byId("job-patch-proposal").classList.remove("hidden");
      }
    });
    byId("accept-job-patch").addEventListener("click", async () => {
      if (!pendingJobPatch) return;
      activeJob = Demo.applyDemoJobPatch(activeJob, pendingJobPatch);
      await Demo.put(Demo.DEMO_STORES.jobs, activeJob);
      byId("job-summary").textContent = activeJob.summary;
      pendingJobPatch = null;
      byId("job-patch-proposal").classList.add("hidden");
      byId("job-detail-message").textContent = "AI 修改建议已由你确认并保存。";
    });
    byId("reject-job-patch").addEventListener("click", () => {
      pendingJobPatch = null;
      byId("job-patch-proposal").classList.add("hidden");
      byId("job-detail-message").textContent = "AI 修改建议已拒绝，职位内容保持不变。";
    });
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
  const initializers = { workspace: initWorkspace, personal: initPersonal, "personal-import": initPersonalImport, "candidate-detail": initCandidateDetail, jd: initJobLibrary, "job-import": initJobImport, "job-detail": initJobDetail };
  async function initializePage() {
    await Demo.consolidateExistingDuplicatesOnce();
    await initializers[page]?.();
  }
  Promise.resolve(initializePage()).catch((error) => {
    const message = document.querySelector(".v1-inline-message");
    if (message) { message.textContent = `页面初始化失败：${error.message}`; message.classList.add("error"); }
  });
})();
