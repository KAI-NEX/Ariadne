import assert from "node:assert/strict";
import fs from "node:fs";

const pages = fs.readFileSync(new URL("../public/v1-pages.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/workspace-about.css", import.meta.url), "utf8");
const overlay = pages.slice(pages.indexOf("function installDetailCardOverlay()"), pages.indexOf("function createCardTransitionLayer("));
assert.match(overlay, /if \(aboutWorkspace\) prepareAboutReturn\(\)/);
assert.match(overlay, /const endStyle = getComputedStyle\(sourceCard\)/);
for (const property of ["fontSize", "fontWeight", "letterSpacing", "lineHeight"]) {
  assert.ok(overlay.includes(`style.${property}`), `return motion uses actual ${property}`);
}
assert.match(overlay, /content\.style\.width = `\$\{content\.getBoundingClientRect\(\)\.width\}px`/);
assert.match(overlay, /aboutFadeAnimation = surface\.animate\([\s\S]*?opacity: 0[\s\S]*?duration: 160/);
assert.match(overlay, /aboutReturnWordmark\?\.remove\(\)/);
assert.match(overlay, /content\.style\.width = ""/);
assert.match(overlay, /aboutKeyboardInteraction = event\.detail === 0/);
assert.match(overlay, /aboutKeyboardInteraction = true/);
assert.match(overlay, /finishedSource\.classList\.toggle\("is-pointer-return", !aboutKeyboardInteraction\)/);
assert.match(css, /\[data-about-trigger\]\.is-pointer-return:focus-visible \{ outline: none; \}/);
assert.match(css, /\.is-about\.is-closing \.v1-detail-overlay-preview \{ visibility: hidden; \}/);
assert.doesNotMatch(css, /\[data-about-trigger\]:focus-visible \{ outline: none/);
console.log("About return motion: source typography, frozen content, fading surface, cleanup and modality-scoped focus PASS");
