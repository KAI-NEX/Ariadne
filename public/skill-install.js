"use strict";
(async function () {
  const button = document.getElementById("skill-install-copy");
  const status = document.getElementById("skill-install-status");
  const prompt = document.getElementById("skill-install-prompt");
  const details = document.getElementById("skill-install-details");
  try {
    const response = await fetch("/downloads/skill.json", { cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error("unavailable");
    const release = await response.json();
    if (release.url !== "/downloads/Ariadne-Skill.zip" || !/^[a-f0-9]{64}$/.test(release.sha256)
        || !Number.isSafeInteger(release.bytes) || release.bytes <= 0) throw new Error("invalid");
    const archive = await fetch(release.url, { method: "HEAD", cache: "no-store", redirect: "error" });
    if (!archive.ok) throw new Error("missing");
    const length = archive.headers.get("content-length");
    if (length !== null) {
      if (Number(length) !== release.bytes) throw new Error("size mismatch");
    } else {
      // Some static hosts omit Content-Length on HEAD responses.
      const download = await fetch(release.url, { cache: "no-store", redirect: "error" });
      if (!download.ok) throw new Error("missing");
      const bytes = await download.arrayBuffer();
      if (bytes.byteLength !== release.bytes) throw new Error("size mismatch");
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
      if (hash !== release.sha256) throw new Error("hash mismatch");
    }
    prompt.value = `请安装并打开 Ariadne Skill。安装包：https://ariadne.kai-nex.com${release.url}；SHA-256：${release.sha256}。请获取完整包并核对 SHA-256，检查解压路径和内容，再把完整 ariadne 文件夹安装到当前 Codex 支持的用户技能目录。已有同名 Skill 时先备份，不删除原资料。检查 macOS 14+、Python 3.9+、Apple 命令行开发工具，以及使用 Codex 分析所需的兼容 CLI、本人登录和 Poppler；缺少依赖时说明需要补齐的项目。安装好后使用 $ariadne 打开独立 Mac 窗口，不使用 Codex 内置浏览器。关闭最后窗口应停止本次服务，保留已保存资料。`;
    details.hidden = false;
    button.disabled = false;
    status.textContent = "复制指令后，粘贴到 Codex 并发送，即可开始安装。";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(prompt.value);
        status.textContent = "安装指令已复制。请粘贴到 Codex 并发送，安装将由 Codex 执行。";
      } catch (_) {
        details.open = true;
        prompt.focus();
        prompt.select();
        status.textContent = "未能自动复制。请复制已选中的安装指令，再粘贴到 Codex 并发送。";
      }
    });
  } catch (_) {
    status.textContent = "安装包暂不可用，请稍后刷新。网页版仍可使用。";
  }
}());
