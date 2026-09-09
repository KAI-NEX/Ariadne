"use strict";

(() => {
  const canvas = document.querySelector("#runtime-ascii-waves");
  if (!(canvas instanceof HTMLCanvasElement) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;

  // User-confirmed 2026-09-09 baseline, verified against the current browser.
  // Future adjustments and Restore Preset start from these values.
  const LOCKED_BACKGROUND_SETTINGS = Object.freeze({
    opacity: .77,
    fontSize: 6.8,
    density: 1.1,
    speed: 2.8,
    direction: 65,
    twist: 2,
    tension: .4,
    maxCells: 70000,
    maxPixelRatio: 2
  });
  const IS_DEVELOPMENT_HOST = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const DEV_SETTINGS_KEY = "job-radar.ascii-dev-tuner.v3";
  const LEGACY_SETTINGS_KEYS = ["job-radar.ascii-dev-tuner.v2", "job-radar.ascii-tuner.v1"];
  let backgroundSettings = { ...LOCKED_BACKGROUND_SETTINGS };
  const glyphs = "cyslap";
  const pointer = { x: -1000, y: -1000, energy: 0, vx: 0, vy: 0 };
  const pointerTarget = { x: -1000, y: -1000, energy: 0, vx: 0, vy: 0, initialized: false };
  let fontSize = backgroundSettings.fontSize;
  let characterDensity = backgroundSettings.density;
  let motionSpeed = backgroundSettings.speed;
  let directionAngle = backgroundSettings.direction * Math.PI / 180;
  let waveTwist = backgroundSettings.twist;
  let tensionScale = .72 + backgroundSettings.tension * .56;
  let warpAmplitude = 49 / (.86 + backgroundSettings.tension * .34);
  let cellWidth = 8.16;
  let cellHeight = 9.52;
  let width = 0;
  let height = 0;
  let halfWidth = 0;
  let halfHeight = 0;
  let frame = 0;
  let lastPaint = 0;
  let lastMotionTimestamp = 0;
  let flowClock = 0;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizedSettings(source) {
    const input = source && typeof source === "object" ? source : {};
    return {
      ...LOCKED_BACKGROUND_SETTINGS,
      opacity: clamp(Number.isFinite(Number(input.opacity)) ? Number(input.opacity) : LOCKED_BACKGROUND_SETTINGS.opacity, 0, 1),
      fontSize: clamp(Number.isFinite(Number(input.fontSize)) ? Number(input.fontSize) : LOCKED_BACKGROUND_SETTINGS.fontSize, 3, 12),
      density: clamp(Number.isFinite(Number(input.density)) ? Number(input.density) : LOCKED_BACKGROUND_SETTINGS.density, .5, 1.5),
      speed: clamp(Number.isFinite(Number(input.speed)) ? Number(input.speed) : LOCKED_BACKGROUND_SETTINGS.speed, 1, 10),
      direction: clamp(Number.isFinite(Number(input.direction)) ? Number(input.direction) : LOCKED_BACKGROUND_SETTINGS.direction, -180, 180),
      twist: clamp(Number.isFinite(Number(input.twist)) ? Number(input.twist) : LOCKED_BACKGROUND_SETTINGS.twist, 0, 2),
      tension: clamp(Number.isFinite(Number(input.tension)) ? Number(input.tension) : LOCKED_BACKGROUND_SETTINGS.tension, .1, 2)
    };
  }

  function syncDerivedSettings() {
    fontSize = backgroundSettings.fontSize;
    characterDensity = backgroundSettings.density;
    motionSpeed = backgroundSettings.speed;
    directionAngle = backgroundSettings.direction * Math.PI / 180;
    waveTwist = backgroundSettings.twist;
    tensionScale = .72 + backgroundSettings.tension * .56;
    warpAmplitude = 49 / (.86 + backgroundSettings.tension * .34);
  }

  function loadDevelopmentSettings() {
    if (!IS_DEVELOPMENT_HOST) return;
    try {
      const current = window.localStorage.getItem(DEV_SETTINGS_KEY);
      if (current) backgroundSettings = normalizedSettings(JSON.parse(current));
      else {
        const legacy = LEGACY_SETTINGS_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
        backgroundSettings = legacy ? normalizedSettings({ ...JSON.parse(legacy), twist: 2 }) : { ...LOCKED_BACKGROUND_SETTINGS };
        window.localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(backgroundSettings));
      }
    } catch (_error) { backgroundSettings = { ...LOCKED_BACKGROUND_SETTINGS }; }
    syncDerivedSettings();
  }

  function resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, backgroundSettings.maxPixelRatio);
    width = window.innerWidth;
    height = window.innerHeight;
    halfWidth = width * .5;
    halfHeight = height * .5;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const rawCellWidth = Math.max(2.6, fontSize * 1.2 / characterDensity);
    const rawCellHeight = Math.max(3.2, fontSize * 1.4 / characterDensity);
    const estimatedCells = Math.max(1, Math.ceil(width / rawCellWidth) * Math.ceil(height / rawCellHeight));
    const overloadScale = estimatedCells > backgroundSettings.maxCells
      ? Math.sqrt(estimatedCells / backgroundSettings.maxCells)
      : 1;
    cellWidth = rawCellWidth * overloadScale;
    cellHeight = rawCellHeight * overloadScale;
    context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    context.textBaseline = "top";
    canvas.style.opacity = String(backgroundSettings.opacity);
    canvas.dataset.preset = IS_DEVELOPMENT_HOST ? "job-radar-dev-override-v3" : "job-radar-locked-v2";
    canvas.dataset.opacity = backgroundSettings.opacity.toFixed(2);
    canvas.dataset.fontSize = fontSize.toFixed(1);
    canvas.dataset.density = characterDensity.toFixed(2);
    canvas.dataset.flowSpeed = motionSpeed.toFixed(1);
    canvas.dataset.flowDirection = backgroundSettings.direction.toFixed(0);
    canvas.dataset.waveTwist = waveTwist.toFixed(2);
    canvas.dataset.waveTension = backgroundSettings.tension.toFixed(1);
    canvas.dataset.cellCount = String(Math.ceil(width / cellWidth) * Math.ceil(height / cellHeight));
  }

  function schedule() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(paint);
  }

  function paint(timestamp) {
    frame = 0;
    if (document.hidden) return;
    const frameInterval = pointerTarget.energy > .01 || pointer.energy > .01 ? 32 : 48;
    if (timestamp - lastPaint < frameInterval) { schedule(); return; }
    lastPaint = timestamp;
    const elapsed = lastMotionTimestamp ? Math.min(.08, (timestamp - lastMotionTimestamp) / 1000) : 0;
    lastMotionTimestamp = timestamp;
    flowClock += elapsed * motionSpeed;
    const motionTime = flowClock;
    pointer.energy += (pointerTarget.energy - pointer.energy) * .82;
    pointer.vx += (pointerTarget.vx - pointer.vx) * .64;
    pointer.vy += (pointerTarget.vy - pointer.vy) * .64;
    pointerTarget.energy *= .8;
    pointerTarget.vx *= .82;
    pointerTarget.vy *= .82;
    if (pointer.energy < .004) pointer.energy = 0;
    const pointerActive = pointer.energy > 0;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#1f2129";
    let lastOpacity = -1;

    // Draw several cells beyond every viewport edge so a corner-local pointer
    // displacement cannot expose an unpainted strip around the canvas.
    const overscanX = cellWidth * 4;
    const overscanY = cellHeight * 4;
    for (let y = -overscanY; y < height + overscanY; y += cellHeight) {
      for (let x = -overscanX; x < width + overscanX; x += cellWidth) {
        let flowX = x;
        let flowY = y;
        let drawX = x;
        let drawY = y;
        if (pointerActive) {
          const pointerX = x - pointer.x;
          const pointerY = y - pointer.y;
          const distanceSquared = pointerX * pointerX + pointerY * pointerY;
          const influence = Math.exp(-distanceSquared / 19000) * pointer.energy;
          const localWake = influence * (
            Math.sin(pointerX * .047 + pointerY * .023 - motionTime * 2.55) * 52
            + Math.cos(pointerY * .041 - pointerX * .019 + motionTime * 2.18) * 24
          );
          const push = influence * 184;
          const offsetX = -pointer.vx * push - pointer.vy * localWake;
          const offsetY = -pointer.vy * push + pointer.vx * localWake;
          flowX += offsetX;
          flowY += offsetY;
          drawX += Math.tanh(offsetX / 28) * cellWidth * 1.6;
          drawY += Math.tanh(offsetY / 28) * cellHeight * 1.45;
        }

        const centeredX = flowX - halfWidth;
        const centeredY = flowY - halfHeight;
        const localTwist = waveTwist * (
          Math.sin((flowX + flowY) * .0032 + motionTime * .11) * .72
          + Math.cos(flowY * .0044 - flowX * .0017 - motionTime * .08) * .38
        );
        const flowAngle = directionAngle + localTwist;
        const cosine = Math.cos(flowAngle);
        const sine = Math.sin(flowAngle);
        const rotatedX = centeredX * cosine - centeredY * sine + halfWidth;
        const rotatedY = centeredX * sine + centeredY * cosine + halfHeight;
        const riverWarp = Math.sin(rotatedY * .009 * tensionScale - motionTime * .42) * warpAmplitude
          + Math.cos(rotatedY * .004 * tensionScale + motionTime * .25) * warpAmplitude * .44;
        const streamOne = Math.sin((rotatedX + riverWarp) * .036 * tensionScale + motionTime * .35);
        const streamTwo = Math.sin((rotatedX * .61 - rotatedY * .48 + Math.sin(rotatedY * .014 * tensionScale - motionTime * .18) * 26) * .044 * tensionScale - motionTime * .27);
        const streamThree = Math.sin((rotatedX * .34 + rotatedY * .72 + Math.cos(rotatedX * .009 * tensionScale + motionTime * .12) * 24) * .052 * tensionScale + motionTime * .21);
        const fineDetail = Math.sin(rotatedX * .11 * tensionScale + rotatedY * .067 * tensionScale + motionTime * .48) * .09
          + Math.cos(rotatedY * .093 * tensionScale - rotatedX * .041 * tensionScale - motionTime * .36) * .06;
        const shade = streamOne * .28 + streamTwo * .24 + streamThree * .22
          + Math.sin((rotatedX - rotatedY * .21) * .018 * tensionScale + motionTime * .3) * .26;
        const density = Math.max(.03, Math.min(.98, .52 + shade * .35 + fineDetail));
        const glyph = glyphs[Math.min(glyphs.length - 1, Math.floor(density * glyphs.length))];
        const localContrast = (density - .5) * .1;
        const opacity = Math.round(Math.max(.04, Math.min(.95, .2 + density * .43 + localContrast)) * 20) / 20;
        if (opacity !== lastOpacity) { context.globalAlpha = opacity; lastOpacity = opacity; }
        context.fillText(glyph, drawX, drawY);
      }
    }
    context.globalAlpha = 1;
    schedule();
  }

  function installDeveloperTuner() {
    if (!IS_DEVELOPMENT_HOST) return;
    const controls = [
      { key: "opacity", label: "背景可见度", min: 0, max: 1, step: .01, format: (value) => `${Math.round(value * 100)}%` },
      { key: "fontSize", label: "字体大小", min: 3, max: 12, step: .1, format: (value) => `${value.toFixed(1)}px` },
      { key: "density", label: "字符密度", min: .5, max: 1.5, step: .05, format: (value) => `${Math.round(value * 100)}%` },
      { key: "speed", label: "流动速度", min: 1, max: 10, step: .1, format: (value) => `${value.toFixed(1)}×` },
      { key: "direction", label: "流动方向", min: -180, max: 180, step: 5, format: (value) => `${Math.round(value)}°` },
      { key: "twist", label: "扭曲 Twist", min: 0, max: 2, step: .05, format: (value) => value.toFixed(2) },
      { key: "tension", label: "张力 Tension", min: .1, max: 2, step: .1, format: (value) => value.toFixed(1) }
    ];
    const root = document.createElement("div");
    root.className = "ascii-tuner ascii-tuner-development";
    const toggle = document.createElement("button");
    toggle.className = "ascii-tuner-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "调整背景");
    toggle.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h5m4 0h7M4 17h9m4 0h3M9 4v6m4 4v6" /></svg>';
    const panel = document.createElement("section");
    panel.className = "ascii-tuner-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("aria-label", "开发背景调整");
    panel.innerHTML = '<header><div><h2>背景调整</h2><span>仅本地开发</span></div><button class="ascii-tuner-reset" type="button">恢复预设</button></header><div class="ascii-tuner-controls"></div><p>Twist 等参数保存在当前浏览器，刷新后继续使用。</p>';
    const controlsRoot = panel.querySelector(".ascii-tuner-controls");

    function apply(partial, persist = true) {
      backgroundSettings = normalizedSettings({ ...backgroundSettings, ...partial });
      syncDerivedSettings();
      resize();
      if (persist) {
        try { window.localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(backgroundSettings)); } catch (_error) { /* Local development storage may be unavailable. */ }
      }
    }

    const controlBindings = controls.map((definition) => {
      const wrapper = document.createElement("div");
      wrapper.className = "ascii-tuner-control";
      const label = document.createElement("label");
      const name = document.createElement("span");
      const output = document.createElement("output");
      const input = document.createElement("input");
      const inputId = `ascii-dev-${definition.key}`;
      name.textContent = definition.label;
      input.id = inputId;
      input.type = "range";
      input.min = String(definition.min);
      input.max = String(definition.max);
      input.step = String(definition.step);
      input.value = String(backgroundSettings[definition.key]);
      label.htmlFor = inputId;
      label.append(name, output);
      wrapper.append(label, input);
      controlsRoot.append(wrapper);
      output.textContent = definition.format(backgroundSettings[definition.key]);
      input.addEventListener("input", () => {
        const value = Number(input.value);
        output.textContent = definition.format(value);
        apply({ [definition.key]: value });
      });
      return { definition, input, output };
    });

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", String(!open));
      toggle.setAttribute("aria-expanded", String(open));
    }

    panel.querySelector(".ascii-tuner-reset").addEventListener("click", () => {
      apply(LOCKED_BACKGROUND_SETTINGS);
      controlBindings.forEach(({ definition, input, output }) => {
        input.value = String(backgroundSettings[definition.key]);
        output.textContent = definition.format(backgroundSettings[definition.key]);
      });
    });
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("pointerdown", (event) => {
      if (toggle.getAttribute("aria-expanded") === "true" && !root.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") setOpen(false); });
    root.append(toggle, panel);
    document.body.append(root);
  }

  window.addEventListener("pointermove", (event) => {
    if (!pointerTarget.initialized) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointerTarget.x = event.clientX;
      pointerTarget.y = event.clientY;
      pointerTarget.initialized = true;
      pointer.energy = .7;
      pointerTarget.energy = .85;
      return;
    }
    const movement = Math.hypot(event.clientX - pointerTarget.x, event.clientY - pointerTarget.y);
    if (movement > .1) {
      pointerTarget.vx = (event.clientX - pointerTarget.x) / movement;
      pointerTarget.vy = (event.clientY - pointerTarget.y) / movement;
      pointer.vx = pointerTarget.vx;
      pointer.vy = pointerTarget.vy;
    }
    pointerTarget.x = event.clientX;
    pointerTarget.y = event.clientY;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const eventEnergy = Math.min(1, Math.max(.35, movement / 4));
    pointerTarget.energy = Math.max(pointerTarget.energy, eventEnergy);
    pointer.energy = Math.max(pointer.energy, eventEnergy * .9);
  }, { passive: true });
  window.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) { pointerTarget.energy = 0; pointerTarget.vx = 0; pointerTarget.vy = 0; }
  }, { passive: true });
  window.addEventListener("blur", () => {
    pointerTarget.energy = 0;
    pointerTarget.vx = 0;
    pointerTarget.vy = 0;
  });
  window.addEventListener("job-radar-runtime-leave", () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    canvas.dataset.renderState = "paused-for-navigation";
  });
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      canvas.dataset.renderState = "paused";
    } else {
      lastPaint = 0;
      lastMotionTimestamp = 0;
      canvas.dataset.renderState = "running";
      schedule();
    }
  });
  window.addEventListener("pagehide", () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }, { once: true });

  loadDevelopmentSettings();
  resize();
  installDeveloperTuner();
  canvas.dataset.renderState = "running";
  schedule();
})();
