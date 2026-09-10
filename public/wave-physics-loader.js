"use strict";
(function attachWavePhysics(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneWavePhysics = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createWavePhysics() {
  const controllers = new WeakMap();
  let cachedFrames;
  function frames() {
    if (cachedFrames) return cachedFrames;
    const bars = Array.from({ length: 15 }, () => []), ball = [];
    for (let k = 0; k < 201; k++) {
      const t = k / 200, fraction = t < .5 ? t / .5 : (1 - t) / .5;
      const index = fraction * 14;
      const phase = fraction === 0 || fraction === 1 ? 0 : (fraction * 4) % 1;
      const bounce = 4 * phase * (1 - phase), contact = Math.max(0, 1 - bounce * 2);
      const y = 16 + 48 - contact * 20 + bounce * 60;
      ball.push({ offset: t, transform: `translate(${index * 20}px, ${-y}px) scale(${1 + contact * .25}, ${1 - contact * .3})` });
      for (let i = 0; i < 15; i++) {
        const distance = Math.abs(i - index);
        const wave = distance < 3 ? Math.cos(distance / 3 * Math.PI / 2) : 0;
        const indent = distance < 1.5 ? Math.cos(distance / 1.5 * Math.PI / 2) * contact * 20 : 0;
        bars[i].push({ offset: t, height: `${Math.max(4, 16 + wave * 48 - indent)}px`,
          backgroundColor: `color-mix(in srgb, var(--wave-rest), var(--wave-crest) ${wave * 100}%)` });
      }
    }
    cachedFrames = { bars, ball };
    return cachedFrames;
  }

  function set(host, active) {
    if (!host) return;
    if (!active) { controllers.get(host)?.dispose(); controllers.delete(host); return; }
    if (controllers.has(host)) return;
    if (!host.querySelector(".v1-wave-stage")) {
      host.innerHTML = `<span class="v1-wave-stage">${Array.from({ length: 15 }, () => '<span class="v1-wave-bar"></span>').join("")}<span class="v1-wave-ball"></span></span>`;
    }
    const doc = host.ownerDocument, view = doc.defaultView;
    const media = view.matchMedia("(prefers-reduced-motion: reduce)");
    const nodes = [...host.querySelectorAll(".v1-wave-bar"), host.querySelector(".v1-wave-ball")];
    const data = frames(), keyframes = [...data.bars, data.ball];
    nodes.forEach((node, i) => {
      const { offset, ...pose } = keyframes[i][0];
      Object.assign(node.style, pose);
    });
    let animations = [], inView = true, observer;
    function cancel() { animations.forEach(animation => animation.cancel()); animations = []; }
    function sync() {
      if (media.matches || !nodes[0].animate) { cancel(); return; }
      const visible = !doc.hidden && inView;
      if (!visible) { animations.forEach(animation => animation.pause()); return; }
      if (!animations.length) {
        animations = nodes.map((node, i) => node.animate(keyframes[i], { duration: 4000, iterations: Infinity, easing: "linear" }));
        const start = doc.timeline.currentTime;
        animations.forEach(animation => { animation.startTime = start; });
      } else animations.forEach(animation => { if (animation.playState === "paused") animation.play(); });
    }
    function dispose() {
      cancel(); observer?.disconnect();
      media.removeEventListener("change", sync);
      doc.removeEventListener("visibilitychange", sync);
      view.removeEventListener("pagehide", pagehide);
      view.removeEventListener("pageshow", sync);
    }
    function pagehide(event) {
      if (event.persisted) animations.forEach(animation => animation.pause());
      else { dispose(); controllers.delete(host); }
    }
    media.addEventListener("change", sync);
    doc.addEventListener("visibilitychange", sync);
    view.addEventListener("pagehide", pagehide);
    view.addEventListener("pageshow", sync);
    if (view.IntersectionObserver) {
      observer = new view.IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); });
      observer.observe(host);
    }
    controllers.set(host, { dispose });
    sync();
  }
  return Object.freeze({ frames, set });
}));
