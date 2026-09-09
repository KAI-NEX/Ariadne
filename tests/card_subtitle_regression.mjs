import assert from "node:assert/strict";
import fs from "node:fs";

const pages = fs.readFileSync(new URL("../public/v1-pages.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
const definition = pages.match(/function cardSubtitleText\(\.\.\.values\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(definition, "shared subtitle formatter exists");
const subtitle = Function(`return (${definition});`)();
assert.equal(subtitle(undefined, null), "");
assert.equal(subtitle("", "  "), "");
assert.equal(subtitle(" 项目经历 ", ""), "项目经历");
assert.equal(subtitle(null, "2026/01"), "2026/01");
assert.equal(subtitle("公司", "上海"), "公司 上海");
assert.equal(subtitle("<script>", "&"), "<script> &");
assert.match(pages, /escapeHtml\(cardSubtitleText\(item\.subtitle, item\.time\)\)/);
assert.match(pages, /escapeHtml\(cardSubtitleText\(job\.company, job\.location\)\)/);
assert.match(styles, /\.v1-card-subtitle \{[^}]*min-height: 1lh/);
console.log("card subtitle: blank/single/both values, escaping boundary and blank line preservation PASS");
