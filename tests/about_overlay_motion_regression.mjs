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
assert.match(overlay, /content\.style\.width = `\$\{content\.offsetWidth\}px`/);
assert.match(overlay, /aboutFadeAnimation = surface\.animate\([\s\S]*?opacity: 0[\s\S]*?duration: aboutCloseDuration/);
assert.match(overlay, /if \(aboutWorkspace\) \{\s*overlay\.classList\.add\("is-content-ready"\);\s*\} else frame.src/);
assert.match(overlay, /frame.onload = aboutWorkspace \? null/);
assert.match(overlay, /transform: aboutTransform\(destinationRect, sourceRect\)/);
assert.match(overlay, /transform: currentTransform/);
assert.match(overlay, /const paintedScale = surface.getBoundingClientRect\(\).width \/ surface.offsetWidth/);
assert.match(overlay, /duration: 540/); // Other detail windows retain their timing.
assert.match(overlay, /duration: 480/);
const manifest = JSON.parse(fs.readFileSync(new URL("../public/vi/manifest.json", import.meta.url), "utf8"));
const tokens = manifest.tokens;
assert.equal(tokens.find((token) => token.name === "--vi-motion-about-open").value, "900ms");
assert.equal(tokens.find((token) => token.name === "--vi-motion-about-close").value, "800ms");
assert.match(overlay, /aboutReturnWordmark\?\.remove\(\)/);
assert.match(overlay, /content\.style\.width = ""/);
assert.match(overlay, /aboutKeyboardInteraction = event\.detail === 0/);
assert.match(overlay, /aboutKeyboardInteraction = true/);
assert.match(overlay, /finishedSource\.classList\.toggle\("is-pointer-return", !aboutKeyboardInteraction\)/);
assert.match(css, /\[data-about-trigger\]\.is-pointer-return:focus-visible \{ outline: none; \}/);
assert.match(css, /\.is-about \.v1-detail-overlay-preview \{ display: none; \}/);
assert.match(css, /\.is-about \.v1-detail-overlay-content \{ opacity: 1; transition: none; \}/);
assert.doesNotMatch(css, /\[data-about-trigger\]:focus-visible \{ outline: none/);
console.log("About return motion: source typography, frozen content, fading surface, cleanup and modality-scoped focus PASS");
