"""Check Git-tracked release content only; never read local credentials or runtime data."""
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_DIRS = {'.codex', '.cache', '.auth', 'node_modules', '__pycache__', 'private_fixtures', 'browser-profile'}
PRIVATE_DATA_DIRS = {'runtime', 'uploads', 'local_ocr_uploads', 'resumes', 'portfolios', 'candidate_documents', 'candidate_context_exports', 'personal_exports', 'source_documents', 'career_sources', 'raw', 'jd_corpus', 'indexeddb_exports', 'localstorage_exports', 'session_exports', 'runtime_exports', 'conversation_exports'}
SECRET_NAMES = {'auth.json', 'credentials.json', 'secrets.json', 'token.json', 'tokens.json', 'access_token.json', 'api_key.txt', 'apikey.txt'}
SECRET_PATTERN = re.compile(rb'(?:sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9_]{25,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
SYNTHETIC_FILES = {'tests/runtime_execution_contract_regression.py', 'tests/runtime_execution_contract_regression.mjs'}
SYNTHETIC_VALUES = {('sk-proj-' + 'exampleplaceholder123456').encode(), ('AIza' + '012345678901234567890123456789').encode()}

def main():
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    findings = []
    for name in filter(None, files):
        path = PurePosixPath(name)
        forbidden = bool(set(path.parts) & FORBIDDEN_DIRS) or path.name in SECRET_NAMES
        forbidden |= path.name == '.env' or (path.name.startswith('.env.') and path.name != '.env.example')
        forbidden |= path.suffix.lower() in {'.db', '.sqlite', '.sqlite3', '.key', '.pem', '.p12', '.pfx', '.har'}
        forbidden |= path.parts[0] == 'data' and (bool(set(path.parts[1:]) & PRIVATE_DATA_DIRS) or path.name.startswith('jd-'))
        if forbidden:
            findings.append({'file': name, 'reason': 'private_path'})
            continue
        local = ROOT / name
        if local.is_symlink():
            findings.append({'file': name, 'reason': 'symlink_not_allowed_in_release'})
            continue
        raw = local.read_bytes()
        for match in SECRET_PATTERN.finditer(raw):
            if name in SYNTHETIC_FILES and match.group() in SYNTHETIC_VALUES:
                continue
            findings.append({'file': name, 'line': raw[:match.start()].count(b'\n') + 1, 'reason': 'credential_pattern'})
    print(json.dumps({'tracked_files': len([name for name in files if name]), 'findings': findings, 'note': 'Values are never printed. Also run Gitleaks on the full Git history.'}, indent=2))
    return 1 if findings else 0

if __name__ == '__main__':
    raise SystemExit(main())
