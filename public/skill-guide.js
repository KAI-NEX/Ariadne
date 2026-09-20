"use strict";
(function (root) {
  const dialog = document.getElementById("skill-guide");
  let trigger;
  document.getElementById("skill-guide-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => trigger?.focus({ preventScroll: true }));
  function open(element) {
    trigger = element;
    if (!dialog.open) dialog.showModal();
    root.AriadneSkillInstall.prepare();
  }
  root.AriadneSkillGuide = Object.freeze({ open });
  function openLinkedGuide() {
    if (root.location.hash === "#skill") open(document.getElementById("runtime-selector"));
  }
  root.addEventListener("hashchange", openLinkedGuide);
  openLinkedGuide();
}(globalThis));
