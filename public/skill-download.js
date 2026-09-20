"use strict";
(async function () {
  const status = document.getElementById("skill-download-status");
  try {
    const response = await fetch("/downloads/skill.json", { cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error("unavailable");
    const release = await response.json();
    if (release.url !== "/downloads/Ariadne-Skill.zip" || !/^[a-f0-9]{64}$/.test(release.sha256)
        || !Number.isSafeInteger(release.bytes) || release.bytes <= 0) throw new Error("invalid");
    const archive = await fetch(release.url, { method: "HEAD", cache: "no-store", redirect: "error" });
    if (!archive.ok || Number(archive.headers.get("content-length")) !== release.bytes) throw new Error("missing");
    const link = document.getElementById("skill-download");
    link.href = release.url;
    link.classList.remove("hidden");
    status.textContent = `Skill 源码包 · ${(release.bytes / 1024).toFixed(0)} KB · 自带运行代码，不含账号和资料`;
    const checksum = document.getElementById("skill-download-checksum");
    checksum.href = "/downloads/Ariadne-Skill.zip.sha256";
    checksum.classList.remove("hidden");
  } catch (_) {
    status.textContent = "此站点尚未提供完整 Skill 包。可从项目源码运行，或等待站点发布。";
  }
}());
