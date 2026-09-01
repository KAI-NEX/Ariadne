import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "public", "floating-window.js"), "utf8");
const module = { exports: {} };
new Function("module", "exports", source)(module, module.exports);
const FloatingWindow = module.exports;

assert.deepEqual(FloatingWindow.moveRect({ left: 100, top: 100, width: 500, height: 400 }, 80, -140, { width: 1200, height: 800 }, 10), {
  left: 180, top: 10, width: 500, height: 400,
});
assert.deepEqual(FloatingWindow.moveRect({ left: 100, top: 100, width: 500, height: 400 }, 900, 900, { width: 1200, height: 800 }, 10), {
  left: 690, top: 390, width: 500, height: 400,
});
assert.deepEqual(FloatingWindow.resizeRect({ left: 100, top: 100, width: 500, height: 400 }, -60, -70, "nw", { width: 1200, height: 800 }, 420, 320, 10), {
  left: 40, top: 30, width: 560, height: 470,
});
assert.deepEqual(FloatingWindow.resizeRect({ left: 100, top: 100, width: 500, height: 400 }, -300, -300, "se", { width: 1200, height: 800 }, 420, 320, 10), {
  left: 100, top: 100, width: 420, height: 320,
});
assert.match(source, /\["n", "e", "s", "w", "ne", "nw", "se", "sw"\]/);
assert.match(source, /floating-window-interaction-shield/);
assert.match(source, /button, a, input, textarea, select/);
console.log("floating_window_contract=pass");
