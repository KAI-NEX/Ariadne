"use strict";
// The Pages exporter includes this file only in the public preview build.
document.addEventListener("DOMContentLoaded", () => {
  if (window.top !== window) return; // The parent page already labels embedded sheets.
  const message = document.createElement("p");
  message.className = "cloudflare-preview-notice";
  message.append("网页预览 · 自带 API Key · 资料保存在当前浏览器。 ");
  const download = document.createElement("a");
  download.href = "/download.html";
  download.textContent = "下载本地版";
  message.append(download);
  const heading = document.querySelector(".v1-topbar");
  if (heading) heading.after(message);
  else (document.querySelector("main") || document.body).prepend(message);
});
