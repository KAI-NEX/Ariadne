"use strict";
(function (root) {
  const dialog = document.getElementById("skill-guide");
  let trigger;
  document.getElementById("skill-guide-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => trigger?.focus({ preventScroll: true }));
  root.AriadneSkillGuide = Object.freeze({ open(element) { trigger = element; dialog.showModal(); } });
}(globalThis));
