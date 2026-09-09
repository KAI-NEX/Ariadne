import { resolveVICSS } from "./helpers/vi-css.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, "public", file), "utf8");
const css = resolveVICSS(read("styles.css"));
const runtime = read("index.html");
const runtimeBackPages = [read("gemini-connect.html"), read("gemini-api-key-guide.html")];
const v1BackPages = ["personal-information.html", "personal-import.html", "candidate-detail.html", "jd.html", "jd-import.html", "job-detail.html"].map(read);
const legacyForwardPages = [read("local-first.html"), read("local-jobs.html")];

const chevronRight = /M9 5\.5 15\.5 12 9 18\.5/;
const chevronLeft = /M15 5\.5 8\.5 12 15 18\.5/;
assert.match(runtime, chevronRight);
assert.match(runtime, /M5\.5 9 12 15\.5 18\.5 9/);
runtimeBackPages.forEach((page) => assert.match(page, chevronLeft));
legacyForwardPages.forEach((page) => assert.match(page, chevronRight));
assert.match(css, /\.v1-back::before \{[^}]*url\("\/vi\/icons\/chevron-left\.svg"\)[^}]*20px 20px/s);
assert.match(read("vi/icons/chevron-left.svg"), /stroke-width="2\.4"[\s\S]*M15 5\.5 8\.5 12 15 18\.5/);
assert.match(css, /#runtime-action-symbol svg \{[^}]*20px[^}]*stroke-width: 2\.4/s);
assert.match(css, /\.runtime-chevron svg \{[^}]*20px[^}]*stroke-width: 2\.4/s);
assert.match(css, /\.runtime-back-icon svg \{[^}]*stroke-width: 2\.4/s);
assert.match(css, /\.ariadne-nav-chevron svg \{[^}]*stroke-width: 2\.4/s);
assert.ok(v1BackPages.every((page) => /class="v1-back"[^>]*href="[^"]+"[^>]*aria-label="返回/.test(page)));
assert.doesNotMatch([runtime, ...runtimeBackPages, ...legacyForwardPages].join(""), /←|→/);
assert.doesNotMatch(css, /M14\.5 5\.5 8 12l6\.5 6\.5M8\.5 12H20/);

console.log("navigation_icon_contract=pass");
