"use strict";

(function attachFloatingWindow(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.JobRadarFloatingWindow = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createFloatingWindow() {
  const directions = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  function moveRect(start, deltaX, deltaY, bounds, margin = 8) {
    return {
      left: clamp(start.left + deltaX, margin, Math.max(margin, bounds.width - start.width - margin)),
      top: clamp(start.top + deltaY, margin, Math.max(margin, bounds.height - start.height - margin)),
      width: start.width,
      height: start.height,
    };
  }

  function resizeRect(start, deltaX, deltaY, direction, bounds, minWidth = 420, minHeight = 320, margin = 8) {
    const effectiveMinWidth = Math.min(minWidth, Math.max(1, bounds.width - margin * 2));
    const effectiveMinHeight = Math.min(minHeight, Math.max(1, bounds.height - margin * 2));
    let left = start.left;
    let top = start.top;
    let right = start.left + start.width;
    let bottom = start.top + start.height;
    if (direction.includes("w")) left = clamp(start.left + deltaX, margin, right - effectiveMinWidth);
    if (direction.includes("e")) right = clamp(right + deltaX, left + effectiveMinWidth, bounds.width - margin);
    if (direction.includes("n")) top = clamp(start.top + deltaY, margin, bottom - effectiveMinHeight);
    if (direction.includes("s")) bottom = clamp(bottom + deltaY, top + effectiveMinHeight, bounds.height - margin);
    return { left, top, width: right - left, height: bottom - top };
  }

  function mount(element, options = {}) {
    if (!element || typeof document === "undefined") return Object.freeze({ reset() {} });
    const dragHandle = options.dragHandle || element;
    const minWidth = options.minWidth || 420;
    const minHeight = options.minHeight || 320;
    const margin = options.margin ?? 8;
    let active = null;
    let shield = null;

    dragHandle.classList.add("floating-window-drag-handle");
    directions.forEach((direction) => {
      if (element.querySelector(`.floating-resize-handle[data-direction="${direction}"]`)) return;
      const handle = document.createElement("span");
      handle.className = "floating-resize-handle";
      handle.dataset.direction = direction;
      handle.setAttribute("aria-hidden", "true");
      element.append(handle);
    });

    function viewportBounds() {
      return { width: window.innerWidth, height: window.visualViewport?.height || window.innerHeight };
    }

    function applyRect(rect) {
      Object.assign(element.style, {
        left: `${Math.round(rect.left)}px`,
        top: `${Math.round(rect.top)}px`,
        width: `${Math.round(rect.width)}px`,
        height: `${Math.round(rect.height)}px`,
        transform: "none",
      });
    }

    function begin(event, mode, direction = "") {
      if (event.button !== 0 || active) return;
      if (mode === "move" && event.target.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      element.getAnimations?.().forEach((animation) => animation.cancel());
      const rect = element.getBoundingClientRect();
      const start = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      applyRect(start);
      element.classList.add("floating-window-positioned", "is-floating-interaction");
      document.body.classList.add("floating-window-interacting");
      shield = document.createElement("div");
      shield.className = "floating-window-interaction-shield";
      shield.setAttribute("aria-hidden", "true");
      document.body.append(shield);
      active = { pointerId: event.pointerId, mode, direction, startX: event.clientX, startY: event.clientY, start };
      options.onStart?.(mode);
    }

    function update(event) {
      if (!active || (event.pointerId != null && active.pointerId != null && event.pointerId !== active.pointerId)) return;
      const deltaX = event.clientX - active.startX;
      const deltaY = event.clientY - active.startY;
      const next = active.mode === "move"
        ? moveRect(active.start, deltaX, deltaY, viewportBounds(), margin)
        : resizeRect(active.start, deltaX, deltaY, active.direction, viewportBounds(), minWidth, minHeight, margin);
      applyRect(next);
    }

    function end(event) {
      if (!active || (event?.pointerId != null && active.pointerId != null && event.pointerId !== active.pointerId)) return;
      active = null;
      shield?.remove();
      shield = null;
      element.classList.remove("is-floating-interaction");
      document.body.classList.remove("floating-window-interacting");
      options.onEnd?.();
    }

    function reset() {
      end();
      element.classList.remove("floating-window-positioned");
      ["left", "top", "width", "height", "transform"].forEach((property) => element.style.removeProperty(property));
    }

    dragHandle.addEventListener("pointerdown", (event) => begin(event, "move"));
    element.querySelectorAll(".floating-resize-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (event) => begin(event, "resize", handle.dataset.direction));
    });
    window.addEventListener("pointermove", update, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("resize", () => {
      if (!element.classList.contains("floating-window-positioned")) return;
      const rect = element.getBoundingClientRect();
      applyRect(moveRect({ left: rect.left, top: rect.top, width: Math.min(rect.width, viewportBounds().width - margin * 2), height: Math.min(rect.height, viewportBounds().height - margin * 2) }, 0, 0, viewportBounds(), margin));
    });
    return Object.freeze({ reset });
  }

  return Object.freeze({ moveRect, resizeRect, mount });
}));
