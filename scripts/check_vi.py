"""VI inventory + no-new-drift gate. Reads static source only, never user/runtime data.

Normal: python3 scripts/check_vi.py
Inventory: python3 scripts/check_vi.py --inventory .cache/vi-inventory.json
The checked-in legacy allowance is reviewed manually; this command never refreshes it.
"""
from pathlib import Path
from collections import Counter, defaultdict
import argparse, hashlib, json, re, sys
from build_vi import ROOT, outputs
BASELINE = ROOT / 'docs/current/vi/legacy-baseline.json'
COLORS = re.compile(r'#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)|\b(?:white|black|red|blue|green|gray|grey|orange|purple|pink|yellow)\b')
VISUAL = re.compile(r'^(?:color|background.*|border.*|font.*|line-height|letter-spacing|text-align|padding.*|margin.*|gap|.*gap|grid.*|.*width|.*height|box-shadow|opacity|mask.*|-webkit-mask.*|transform.*|transition.*|animation.*|z-index|corner-shape)$')
GLYPHS = '←→↑↓↗↘↙↖×✕✖✓✔＋'
def compact(text): return re.sub(r'\s+', ' ', text).strip()
def declarations(body):
    chunks = []; start = 0; depth = 0; quote = None; escaped = False
    for pos, ch in enumerate(body):
        if escaped: escaped = False; continue
        if ch == '\\': escaped = True; continue
        if quote:
            if ch == quote: quote = None
        elif ch in '\"\'': quote = ch
        elif ch == '(': depth += 1
        elif ch == ')': depth -= 1
        elif ch == ';' and depth == 0: chunks.append(body[start:pos]); start = pos + 1
    chunks.append(body[start:])
    for chunk in chunks:
        if ':' in chunk:
            name, value = chunk.split(':', 1)
            yield compact(name), compact(value)
def scan_source(file, source):
    debt = Counter(); inventory = defaultdict(Counter)
    source = re.sub(r'/\*[\s\S]*?\*/', '', source)
    # Inventory CSS files and inline <style> blocks, not arbitrary JS object literals.
    css = source if file.endswith('.css') else '\n'.join(re.findall(r'<style[^>]*>([\s\S]*?)</style>', source))
    css = re.sub(r'@import\s+url\([^)]*\)\s*;', '', css)
    for rule in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        selector = compact(rule.group(1))
        for prop, value in declarations(rule.group(2)):
            if VISUAL.match(prop): inventory[prop][value] += 1
            if prop == 'font-family' and value not in {'inherit', 'initial', 'unset'} and not value.startswith('var(--vi-'):
                debt[f'{file} | font-family | {selector} | {value}'] += 1
            if COLORS.search(value): debt[f'{file} | css | {selector} | {prop}: {value}'] += 1
            if 'data:image/svg' in value: debt[f'{file} | embedded-icon | {selector} | {prop}: {value}'] += 1
            if prop == 'content' and re.search('[' + GLYPHS + '+−]', value): debt[f'{file} | glyph | {selector} | {value}'] += 1
    for match in re.finditer(r'<svg\b[\s\S]*?</svg>', source):
        fragment = compact(match.group())
        digest = hashlib.sha256(fragment.encode()).hexdigest()[:16]
        debt[f'{file} | inline-svg | {digest}'] += 1
    # Only static markup glyphs, never math/prose like Candidate × Job or source material.
    for match in re.finditer(r'>(\s*[' + GLYPHS + r']\s*)<', source):
        debt[f'{file} | markup-glyph | {match.group(1).strip()}'] += 1
    for match in re.finditer(r'\bstyle\s*=\s*([\"\'])(.*?)\1', source, re.S):
        if COLORS.search(match.group(2)): debt[f'{file} | inline-color | {compact(match.group(2))}'] += 1
    return debt, {key: dict(value) for key, value in sorted(inventory.items())}
def scan():
    debt = Counter(); inventory = {}; errors = []
    spec = json.loads((ROOT / 'public/vi/manifest.json').read_text())
    if len({t['name'] for t in spec['tokens']}) != len(spec['tokens']): errors.append('Duplicate VI token names')
    if len({i['name'] for i in spec['icons']}) != len(spec['icons']): errors.append('Duplicate VI icon names')
    known = {t['name'] for t in spec['tokens']} | {'--vi-icon-image'}
    for path in sorted((ROOT / 'public').rglob('*')):
        if path.suffix not in {'.css', '.html', '.js', '.svg'}: continue
        file = path.relative_to(ROOT).as_posix(); source = path.read_text()
        # Generated artifacts are verified byte-for-byte instead.
        if file in outputs(): continue
        found, visual = scan_source(file, source); debt.update(found)
        inventory[file] = visual
        for token in re.findall(r'var\((--vi-[\w-]+)', source):
            if token not in known: errors.append(f'{file}: unknown {token}')
        for asset in re.findall(r'/vi/icons/([\w-]+\.svg)', source):
            if not (ROOT / 'public/vi/icons' / asset).exists(): errors.append(f'{file}: missing {asset}')
        for name in re.findall(r'data-icon="([\w-]+)"', source):
            if name not in {i['name'] for i in spec['icons']}: errors.append(f'{file}: unknown icon {name}')
    return debt, inventory, errors
def drift(debt, allowed): return [f'{key} (+{count - allowed.get(key, 0)})' for key, count in debt.items() if count > allowed.get(key, 0)]
def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--inventory'); args = parser.parse_args()
    debt, inventory, errors = scan()
    for file, expected in outputs().items():
        path = ROOT / file
        if not path.exists() or path.read_text() != expected: errors.append(f'{file}: generated output drift')
    allowed = json.loads(BASELINE.read_text())['allowances']
    errors += drift(debt, allowed)
    if args.inventory:
        path = Path(args.inventory); path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({'scope':'All public CSS / HTML / JS / SVG static source; no runtime data', 'files':inventory, 'legacyOccurrences':dict(debt)}, ensure_ascii=False, indent=2)+'\n')
    if errors:
        print('VI check FAIL:\n'+'\n'.join(errors)); return 1
    print(f'VI check PASS: {len(inventory)} static files; {len(outputs())} generated resources; {sum(debt.values())} grandfathered occurrences (no new drift).')
    return 0
if __name__ == '__main__': sys.exit(main())
