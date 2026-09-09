"""Run offline regression suites without model access or private seed requirements."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def main():
    node = shutil.which('node')
    if not node:
        print('Node.js is required for the JavaScript regressions.', file=sys.stderr)
        return 2
    env = {key: value for key, value in os.environ.items() if not key.startswith(('OPENAI_', 'GEMINI_', 'DEEPSEEK_', 'QWEN_'))}
    env.update(PYTHONPATH=str(ROOT), ARIADNE_CODEX_ENABLED='0', PYTHONDONTWRITEBYTECODE='1')
    output = ROOT / '.cache' / 'regressions'; output.mkdir(parents=True, exist_ok=True)
    results = []
    files = sorted(list((ROOT / 'tests').glob('*regression.py')) + list((ROOT / 'tests').glob('*regression.mjs')))
    for path in files:
        try:
            result = subprocess.run([node if path.suffix == '.mjs' else sys.executable, str(path)],
                cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
            (output / (path.name + '.log')).write_bytes(result.stdout)
            code = result.returncode
        except subprocess.TimeoutExpired:
            code = 124
        results.append({'test': path.name, 'exit_code': code})
        if code:
            print('FAIL:', path.name, flush=True)
    (output / 'summary.json').write_text(json.dumps(results, indent=2))
    passed = sum(item['exit_code'] == 0 for item in results)
    print(f'{passed}/{len(results)} regression suites passed; local logs: .cache/regressions/')
    return 0 if passed == len(results) else 1

if __name__ == '__main__':
    raise SystemExit(main())
