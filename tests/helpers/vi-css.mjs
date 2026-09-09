// Preserve existing literal-value assertions after extracting shared VI tokens.
// This resolves only vi variables, never the domain's --ink / --paper aliases.
import fs from 'node:fs';
const spec = JSON.parse(fs.readFileSync(new URL('../../public/vi/manifest.json', import.meta.url), 'utf8'));
const tokens = new Map(spec.tokens.map(t => [t.name, t.value]));
export function resolveVICSS(css) {
  return css.replace(/var\((--vi-[\w-]+)\)/g, (_, name) => {
    if (!tokens.has(name)) throw new Error(`Unknown VI token: ${name}`);
    return tokens.get(name);
  });
}
