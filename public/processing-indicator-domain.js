"use strict";

(function attachProcessingIndicator(root, factory) {
  const wave = root.AriadneWavePhysics || (typeof module === "object" && module.exports ? require("./wave-physics-loader.js") : null);
  const api = factory(wave);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneProcessingIndicator = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function createProcessingIndicator(Wave) {
  function ensure(host) {
    if (!host) return null;
    host.classList.add("v1-processing-indicator");
    const conversation = host.classList.contains("v1-conversation-status");
    if (conversation && host.ownerDocument?.head && !host.ownerDocument.querySelector('link[data-conversation-dots]')) {
      const css = host.ownerDocument.createElement("link"); css.rel = "stylesheet"; css.href = "/conversation-dots.css?v=1"; css.dataset.conversationDots = ""; host.ownerDocument.head.append(css);
    }
    host.classList.toggle("v1-wave-wait", conversation);
    if (!host.querySelector("[data-processing-orb]")) {
      const previous = host.textContent.trim();
      host.innerHTML = `<span class="v1-processing-loop" data-processing-orb aria-hidden="true"></span><span class="v1-processing-copy"><strong data-processing-copy></strong><small data-processing-boundary></small></span>`;
      if (conversation) {
        const orb = host.querySelector("[data-processing-orb]");
        orb.className = "v1-conversation-dots";
        orb.innerHTML = "<i></i><i></i><i></i>";
      }
      if (previous) host.querySelector("[data-processing-copy]").textContent = previous;
    }
    return host;
  }

  function apply(target, { active, copy, boundary, state }) {
    const visible = Boolean(active || copy);
    target.classList.toggle("hidden", !visible);
    target.classList.toggle("is-active", Boolean(active));
    target.classList.toggle("is-terminal", !active && Boolean(copy));
    target.dataset.state = state;
    target.setAttribute("role", "status");
    target.setAttribute("aria-live", "polite");
    target.setAttribute("aria-busy", String(Boolean(active)));
    target.querySelector("[data-processing-copy]").textContent = copy;
    const note = target.querySelector("[data-processing-boundary]");
    note.textContent = boundary;
    note.classList.toggle("hidden", !boundary);
  }

  function set(host, { active = true, copy = "", boundary = "", state = active ? "ACTIVE" : "IDLE" } = {}) {
    const scroll = host?.closest?.(".v1-conversation-scroll, .v1-workspace-history");
    const follow = scroll && scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 32;
    const target = ensure(host);
    if (!target) return;
    apply(target, { active: Boolean(active), copy, boundary, state });
    if (target.classList.contains("v1-wave-wait") && !active) Wave?.set(target.querySelector("[data-processing-orb]"), false);
    if (active && follow) scroll.scrollTop = scroll.scrollHeight;
  }

  function clear(host) { set(host, { active: false, copy: "" }); }

  function setButton(button, { active = true, label = "正在等待模型响应" } = {}) {
    if (!button) return;
    if (!button.dataset.idleAriaLabel) button.dataset.idleAriaLabel = button.getAttribute("aria-label") || "发送";
    button.classList.toggle("is-loading", Boolean(active));
    button.setAttribute("aria-busy", String(Boolean(active)));
    button.setAttribute("aria-label", active ? label : button.dataset.idleAriaLabel);
  }

  return Object.freeze({ ensure, set, clear, setButton });
}));
