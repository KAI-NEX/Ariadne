"""Meaningful negative checks for the VI no-new-drift gate."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from check_vi import scan_source, drift, declarations

def check(source): return scan_source('public/example.css', source)[0]
assert not check('.card { color: var(--vi-ink); background: var(--vi-surface); }')
original = check('.card { color: #123456; }')
assert check('@import url("/tokens.css?v=2"); .card { color: #123456; }') == original, 'import URLs must not become selectors'
assert not drift(original, original)
assert drift(check('.card { color: #123457; }'), original), 'new color must fail'
assert drift(check('.card { color: #123456; } .card { color: #123456; }'), original), 'duplicate debt must fail'
assert drift(check('.other { color: #123456; }'), original), 'moving debt to new selector must fail'
assert not drift({}, original), 'migration must be allowed'
assert check('.card { background: rgba(1,2,3,.2); }')
assert check('.card { color: white; }')
assert check('.card { font-family: Arial, serif; }'), 'new independent font stack must fail'
assert not check('.card { font-family: var(--vi-font-ui); }')
assert check('.card::before { content: "×"; }')
assert list(declarations('mask: url("data:image/svg+xml;a;b"); color: red;')) == [('mask','url("data:image/svg+xml;a;b")'),('color','red')]
assert scan_source('public/example.html', '<button><svg viewBox="0 0 24 24"><path d="M1 2"/></svg></button>')[0]
assert scan_source('public/example.html', '<button style="color: #f00">x</button>')[0]
assert not scan_source('public/example.html', '<p>Candidate × Job：一次讨论</p>')[0], 'prose is not an icon'
assert not scan_source('public/example.html', '<span class="vi-icon" data-icon="close" aria-hidden="true"></span>')[0]
print('VI guard negative checks PASS')
