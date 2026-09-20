"""Exercise standalone Skill packaging, prerequisites and real loopback lifecycle."""
from __future__ import annotations
import hashlib
import base64
import http.client
import importlib.util
import json
import os
from pathlib import Path
import select
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_skill_bundle import build, safe_copy


class SkillTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Keep QA artifacts; all data and CLI responses in this directory are synthetic.
        cls.directory = Path(tempfile.mkdtemp(prefix="skill-regression-", dir=ROOT / ".cache"))
        cls.result = build(cls.directory / "release")
        with zipfile.ZipFile(cls.result["archive"]) as archive:
            assert archive.testzip() is None
            archive.extractall(cls.directory / "extracted")
        cls.skill = cls.directory / "extracted/ariadne"
        cls.launcher = cls.skill / "scripts/ariadne.py"
        cls.bin = cls.directory / "bin"
        cls.bin.mkdir()
        fake = cls.bin / "codex"
        fake.write_text('#!/bin/sh\ncase "$*" in\n"exec --help") echo "--ignore-user-config --ignore-rules --ephemeral --output-schema --image";;\n"login status") exit 0;;\n*) exit 99;;\nesac\n')
        fake.chmod(0o755)
        for name in ("pdftoppm", "pdfinfo"):
            p = cls.bin / name
            p.write_text('#!/bin/sh\n[ "$1" = "-v" ] || exit 99\n')
            p.chmod(0o755)
        cls.env = {**os.environ, "PATH": str(cls.bin), "ARIADNE_CODEX_BINARY": str(fake), "PYTHONDONTWRITEBYTECODE": "1"}

    def run_cli(self, *args, env=None):
        return subprocess.run([sys.executable, str(self.launcher), *args], cwd=self.directory,
                              env=env or self.env, capture_output=True, text=True, timeout=15)

    def test_standalone_package_and_integrity(self):
        self.assertEqual(hashlib.sha256(Path(self.result["archive"]).read_bytes()).hexdigest(), self.result["sha256"])
        self.assertLess(self.result["bytes"], 1024 * 1024)
        manifest = json.loads((self.skill / "runtime-files.json").read_text())
        self.assertTrue("app.py" in manifest and "src/local_connector.py" in manifest)
        self.assertFalse(any("workspaces" in name or "auth.json" in name or name.endswith(".db") for name in manifest))
        result = self.run_cli("doctor")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(json.loads(result.stdout)["ready"])
        damaged = self.skill / "runtime/public/model-settings-catalog.json"
        previous = damaged.read_bytes()
        try:
            damaged.write_bytes(previous + b" ")
            result = self.run_cli("doctor")
            self.assertEqual(result.returncode, 1)
            self.assertFalse(json.loads(result.stdout)["ready"])
        finally:
            damaged.write_bytes(previous)

    def test_missing_tools_and_auth_fail_before_listening(self):
        result = self.run_cli("connect", env={**self.env, "PATH": "/nonexistent", "ARIADNE_CODEX_BINARY": "/nonexistent/codex"})
        self.assertEqual(result.returncode, 1)
        self.assertFalse(json.loads(result.stdout)["ready"])
        bad = self.bin / "not-logged-in"
        bad.write_text('#!/bin/sh\nexit 1\n'); bad.chmod(0o755)
        result = self.run_cli("doctor", env={**self.env, "ARIADNE_CODEX_BINARY": str(bad)})
        checks = {x["check"]: x["ok"] for x in json.loads(result.stdout)["checks"]}
        self.assertFalse(checks["codex_login"])
        self.assertFalse(checks["codex_protocol"])

    def test_local_ui_storage_restart_and_latest_library_contract(self):
        state = self.directory / "local-data"
        def start(env=None):
            proc = subprocess.Popen([sys.executable, str(self.launcher), "open", "--port", "0", "--data-dir", str(state)],
                cwd=self.directory, env=env or self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            self.assertTrue(select.select([proc.stdout], [], [], 10)[0])
            ready = json.loads(proc.stdout.readline())
            self.assertEqual(ready["status"], "ready", ready)
            self.assertFalse(ready["pairing_required"])
            return proc, ready
        def request(ready, path, payload=None, origin=None):
            from urllib.parse import urlparse
            port = urlparse(ready["url"]).port
            conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
            headers = {"Content-Type": "application/json", "Origin": origin or ready["url"].rstrip("/")}
            conn.request("POST" if payload else "GET", path, json.dumps(payload) if payload else None, headers)
            response = conn.getresponse(); body = response.read(); status = response.status; conn.close()
            return status, body
        payload = {"workspace": "a" * 32, "database": "job-radar-local-first-v1"}
        original = b"synthetic source retained through a Skill restart"
        record = {"source_document_id": "source-synthetic", "filename": "synthetic.txt",
                  "content_hash": "sha256:" + hashlib.sha256(original).hexdigest(),
                  "file_blob": {"$blob": "base64", "data": base64.b64encode(original).decode(), "type": "text/plain"}}
        proc, ready = start()
        try:
            status, body = request(ready, "/")
            self.assertEqual(status, 200); self.assertIn(b'id="runtime-selector"', body)
            for page in ("personal-information.html", "jd.html"):
                status, body = request(ready, "/" + page)
                self.assertEqual(status, 200); self.assertIn(b'id="library-edit-toggle"', body)
                self.assertEqual(body, (ROOT / "public" / page).read_bytes())
            status, body = request(ready, "/api/workspace")
            self.assertIn("job_context_lifecycle", json.loads(body)["databases"][payload["database"]])
            self.assertEqual(request(ready, "/api/workspace", origin="https://evil.invalid")[0], 403)
            commit = {**payload, "action": "commit", "initialize": True, "expected": {"source_documents": None},
                      "transaction_id": "b" * 32, "writes": [{"store": "source_documents", "operation": "add", "value": record}]}
            self.assertEqual(request(ready, "/api/workspace", commit)[0], 200)
            commit.update(initialize=False, expected={"source_documents": "stale"}, transaction_id="c" * 32)
            self.assertEqual(request(ready, "/api/workspace", commit)[0], 409)
        finally:
            proc.terminate(); proc.communicate(timeout=10)
        # Lack of Codex/PDF prerequisites must not prevent opening Local mode.
        proc, ready = start({**self.env, "PATH": "/nonexistent", "ARIADNE_CODEX_BINARY": "/missing/codex"})
        try:
            self.assertFalse(ready["codex_ready"])
            status, body = request(ready, "/api/runtime-options")
            self.assertNotIn("codex", [model["provider_id"] for model in json.loads(body)["models"]])
            status, body = request(ready, "/api/workspace", {**payload, "action": "read", "stores": ["source_documents"]})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)["stores"]["source_documents"], [record])
        finally:
            proc.terminate(); proc.communicate(timeout=10)
        self.assertFalse((self.skill / "runtime/data/workspaces").exists())

    def test_private_files_and_symlinks_refused(self):
        source = self.directory / "source"
        source.write_text("synthetic")
        for name in ("data/workspaces/state.json", "auth.json", "data/jd-001.json"):
            with self.assertRaises(ValueError):
                safe_copy(source, self.directory / "refused", name)
        link = self.directory / "link"
        link.symlink_to(source)
        with self.assertRaises(ValueError):
            safe_copy(link, self.directory / "refused", "app.py")

    def test_lifecycle_pairing_and_port_conflict(self):
        with socket.socket() as listener:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(("127.0.0.1", 8765)); listener.listen()
            result = self.run_cli("connect")
            self.assertEqual(json.loads(result.stdout)["error"], "CONNECTOR_PORT_UNAVAILABLE")
        result = self.run_cli("connect", "--origin", "https://ariadne.kai-nex.com/path")
        self.assertEqual(result.returncode, 1)
        proc = subprocess.Popen([sys.executable, str(self.launcher), "connect", "--origin", "http://127.0.0.1:18920"],
                                cwd=self.directory, env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        def request(path, body=None, token=None, origin="http://127.0.0.1:18920"):
            c = http.client.HTTPConnection("127.0.0.1", 8765, timeout=5)
            headers = {"Origin": origin, "Content-Type": "application/json"}
            if token: headers["X-Ariadne-Connector"] = token
            c.request("POST" if body is not None else "GET", path, json.dumps(body) if body is not None else None, headers)
            r = c.getresponse(); value = json.loads(r.read()); code = r.status; c.close()
            return code, value
        try:
            self.assertTrue(select.select([proc.stdout], [], [], 10)[0], "startup timed out")
            startup = json.loads(proc.stdout.readline())
            self.assertEqual(startup["status"], "awaiting_pairing")
            self.assertEqual(request("/api/runtime-options")[0], 401)
            self.assertEqual(request("/api/connector/pair", {"code": startup["pairing_code"]}, origin="https://evil.invalid")[0], 403)
            status, payload = request("/api/connector/pair", {"code": startup["pairing_code"]})
            self.assertEqual(status, 200)
            token = payload["token"]
            self.assertEqual(request("/api/connector/pair", {"code": startup["pairing_code"]})[0], 400)
            status, options = request("/api/runtime-options", token=token)
            self.assertEqual(status, 200)
            self.assertEqual([x["provider_id"] for x in options["models"]], ["codex"])
            self.assertEqual(request("/api/jobs", token=token)[0], 404)
            self.assertEqual(request("/api/connector/revoke", {}, token=token)[0], 200)
            self.assertEqual(request("/api/runtime-options", token=token)[0], 401)
        finally:
            proc.terminate()
            stdout, stderr = proc.communicate(timeout=10)
        self.assertEqual(proc.returncode, 0, stderr)
        self.assertTrue(json.loads(stdout)["pairing_revoked"])
        with socket.socket() as client:
            self.assertNotEqual(client.connect_ex(("127.0.0.1", 8765)), 0)


if __name__ == "__main__":
    unittest.main()
