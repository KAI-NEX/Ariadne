(function (root) {
  "use strict";
  function bind({ grid, onSelect }) {
    const menu = document.createElement("div");
    menu.id = "job-stage-options";
    menu.className = "runtime-menu v1-job-stage-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "选择投递状态");
    menu.setAttribute("aria-hidden", "true");
    menu.inert = true;
    let trigger = null;
    const options = Object.entries(root.AriadneJobApplications.STAGES).map(([value, label], index) => {
      const option = document.createElement("button");
      option.type = "button"; option.className = "runtime-menu-item runtime-existing-model";
      option.setAttribute("role", "option"); option.dataset.stageOption = value;
      option.textContent = label; option.tabIndex = -1;
      option.style.setProperty("--runtime-menu-index", index);
      menu.append(option); return option;
    });
    document.body.append(menu);
    const close = (restoreFocus = false) => {
      const previous = trigger; trigger = null;
      previous?.setAttribute("aria-expanded", "false");
      menu.classList.remove("is-open"); menu.setAttribute("aria-hidden", "true"); menu.inert = true;
      if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true });
    };
    const open = button => {
      if (button.disabled) return;
      close(); trigger = button;
      button.setAttribute("aria-expanded", "true");
      options.forEach(option => option.setAttribute("aria-selected", String(option.dataset.stageOption === button.dataset.stage)));
      const rect = button.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - menu.offsetWidth - 8))}px`;
      // Prefer downward expansion; scroll the menu itself if near the viewport edge.
      menu.style.top = `${Math.min(rect.bottom + 4, innerHeight - 52)}px`;
      menu.style.maxHeight = `${Math.max(44, innerHeight - Math.min(rect.bottom + 4, innerHeight - 52) - 8)}px`;
      menu.inert = false; menu.setAttribute("aria-hidden", "false"); menu.classList.add("is-open");
      (options.find(option => option.getAttribute("aria-selected") === "true") || options[0]).focus({ preventScroll: true });
    };
    grid.addEventListener("click", event => {
      const button = event.target.closest("[data-job-stage]");
      if (!button) return;
      event.preventDefault();
      if (trigger === button) close(true); else open(button);
    });
    grid.addEventListener("keydown", event => {
      const button = event.target.closest("[data-job-stage]");
      if (button && ["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); open(button); }
    });
    menu.addEventListener("keydown", event => {
      if (event.key === "Escape" || event.key === "Tab") {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
        close(true); return;
      }
      const index = options.indexOf(document.activeElement);
      const target = { ArrowDown: (index + 1) % options.length, ArrowUp: (index + options.length - 1) % options.length, Home: 0, End: options.length - 1 }[event.key];
      if (target !== undefined) { event.preventDefault(); options[target].focus({ preventScroll: true }); }
    });
    menu.addEventListener("click", event => {
      const option = event.target.closest("[data-stage-option]"), button = trigger;
      if (!option || !button) return;
      close(true); onSelect(button, option.dataset.stageOption);
    });
    document.addEventListener("pointerdown", event => { if (trigger && !menu.contains(event.target) && !trigger.contains(event.target)) close(); });
    window.addEventListener("resize", () => close());
    window.addEventListener("scroll", event => { if (!menu.contains(event.target)) close(); }, true);
    window.addEventListener("pagehide", () => close());
    return Object.freeze({ close });
  }
  root.AriadneJobStageMenu = Object.freeze({ bind });
}(window));
