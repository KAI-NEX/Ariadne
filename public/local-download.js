"use strict";
(async function () {
  const status = document.getElementById("local-download-status");
  try {
    const response = await fetch("/downloads/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("unavailable");
    const release = await response.json();
    if (!/^\/downloads\/Ariadne-Local-macOS-arm64-[0-9-]+\.zip$/.test(release.url)
        || !/^[a-f0-9]{64}$/.test(release.sha256) || !Number.isSafeInteger(release.bytes) || release.bytes <= 0) throw new Error("invalid");
    const artifact = await fetch(release.url, { method: "HEAD", cache: "no-store" });
    if (!artifact.ok || Number(artifact.headers.get("content-length")) !== release.bytes) throw new Error("missing artifact");
    const link = document.getElementById("local-download");
    link.href = release.url;
    link.classList.remove("hidden");
    status.textContent = `macOS 14+ · Apple 芯片 · ${(release.bytes / 1024 / 1024).toFixed(1)} MB · 本地测试版`;
    document.getElementById("local-download-hash").textContent = `SHA-256：${release.sha256}`;
  } catch (_) {
    status.textContent = "此站点尚未发布安装包。请在提供安装包的 Ariadne 站点下载。";
  }
}());
