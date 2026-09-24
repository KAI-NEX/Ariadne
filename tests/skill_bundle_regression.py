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
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from build_skill_bundle import build, safe_copy
from src.workspace_storage import WorkspaceStorage


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
        fake.write_text('#!/bin/sh\ncase "$*" in\n"app-server --help") echo "--stdio generate-json-schema";;\n"login status") case "$CODEX_HOME" in *"Ariadne Codex") exit 0;; *) exit 1;; esac;;\n*) exit 99;;\nesac\n')
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
        self.assertLess(self.result["bytes"], 4 * 1024 * 1024)  # Includes native icon appearances (~2 MB).
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

    def test_pairing_retired_without_dependencies_or_listener(self):
        result = self.run_cli("connect", env={**self.env, "PATH": "/nonexistent", "ARIADNE_CODEX_BINARY": "/nonexistent/codex"})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["error"], "WEB_PAIRING_RETIRED")

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
            self.assertEqual(status, 302)
            status, body = request(ready, "/workspace.html")
            self.assertEqual(status, 200); self.assertIn(b'data-v1-page="workspace"', body)
            self.assertNotIn(b'id="runtime-selector"', body)
            status, body = request(ready, "/product-config.js")
            self.assertIn(b'"kind": "skill"', body)
            self.assertIn(b'"storage": "filesystem"', body)
            self.assertEqual(request(ready, "/api/runtime-providers/deepseek/connection-check", {"api_key": "synthetic"})[0], 403)
            self.assertEqual(request(ready, "/api/personal-understanding-turn", {"runtime_snapshot": {"provider": "deepseek"}})[0], 422)
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
            self.assertEqual(request(ready, "/api/personal-understanding-turn", {"runtime_snapshot": {"provider": "codex", "model": "gpt-5.6-sol"}})[0], 503)
            status, body = request(ready, "/api/runtime-options")
            self.assertNotIn("codex", [model["provider_id"] for model in json.loads(body)["models"]])
            status, body = request(ready, "/api/workspace", {**payload, "action": "read", "stores": ["source_documents"]})
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)["stores"]["source_documents"], [record])
        finally:
            proc.terminate(); proc.communicate(timeout=10)
        self.assertFalse((self.skill / "runtime/data/workspaces").exists())

    def test_explicit_workspace_import_binds_skill_without_overwrite(self):
        source_root = self.directory / "import-source"
        state = self.directory / "import-state"
        workspace = "d" * 32
        original = b"synthetic browser original\x00\xff"
        record = {
            "source_document_id": "source-browser-synthetic", "filename": "resume.pdf",
            "content_hash": "sha256:" + hashlib.sha256(original).hexdigest(),
            "file_blob": {"$blob": "base64", "data": base64.b64encode(original).decode(), "type": "application/pdf"},
        }
        WorkspaceStorage(source_root).commit(
            workspace, "job-radar-local-first-v1", {"source_documents": None},
            [{"store": "source_documents", "operation": "add", "value": record}], initialize=True,
        )
        retained = state / "workspaces" / ("e" * 32)
        retained.mkdir(parents=True)
        (retained / "unrelated.txt").write_text("retained")
        result = self.run_cli("import-workspace", "--source-root", str(source_root),
                              "--workspace", workspace, "--data-dir", str(state))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        receipt = json.loads(result.stdout)
        self.assertEqual(receipt["status"], "imported")
        self.assertTrue(receipt["verified_sha256"])
        self.assertEqual((retained / "unrelated.txt").read_text(), "retained")
        mapping = json.loads((state / "desktop-workspace.json").read_text())
        self.assertEqual(mapping, {
            "contract_id": "ariadne-desktop-workspace-binding-v1", "workspace": workspace,
            "origin": "http://127.0.0.1:8766", "binding": "explicit",
        })
        source_files = {str(path.relative_to(source_root / workspace)): hashlib.sha256(path.read_bytes()).hexdigest()
                        for path in (source_root / workspace).rglob("*") if path.is_file() and path.name != ".lock"}
        target_files = {str(path.relative_to(state / "workspaces" / workspace)): hashlib.sha256(path.read_bytes()).hexdigest()
                        for path in (state / "workspaces" / workspace).rglob("*") if path.is_file() and path.name != ".lock"}
        self.assertEqual(target_files, source_files)
        repeated = self.run_cli("import-workspace", "--source-root", str(source_root),
                                "--workspace", workspace, "--data-dir", str(state))
        self.assertEqual(repeated.returncode, 0)
        self.assertEqual(json.loads(repeated.stdout)["status"], "already_imported")
        swift = (self.skill / "runtime/scripts/desktop_macos.swift").read_text()
        self.assertIn('home.appendingPathComponent("workspaces")', swift)
        self.assertIn('settings?["binding"] == "explicit"', swift)
        self.assertIn('width: 1392, height: 944', swift)
        self.assertIn('width: 1080, height: 720', swift)

        corrupt_workspace = "f" * 32
        WorkspaceStorage(source_root).commit(
            corrupt_workspace, "job-radar-local-first-v1", {"source_documents": None},
            [{"store": "source_documents", "operation": "add", "value": {**record, "source_document_id": "corrupt-source"}}],
            initialize=True,
        )
        blob = next((source_root / corrupt_workspace / "originals").rglob("resume.pdf"))
        blob.write_bytes(b"corrupt")
        broken_state = self.directory / "broken-import-state"
        rejected = self.run_cli("import-workspace", "--source-root", str(source_root),
                                "--workspace", corrupt_workspace, "--data-dir", str(broken_state))
        self.assertEqual(rejected.returncode, 1)
        self.assertEqual(json.loads(rejected.stdout)["error"], "WORKSPACE_IMPORT_FAILED")
        self.assertFalse((broken_state / "desktop-workspace.json").exists())

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

    def test_native_parent_pipe_and_signal_stop_owned_service(self):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        state = self.directory / "native-data"
        state.mkdir()
        sentinel = state / "retained-original.txt"
        sentinel.write_text("synthetic original")
        command = [sys.executable, str(self.launcher), "desktop", "--port", str(port), "--data-dir", str(state)]
        for stop in ("pipe", "signal"):
            proc = subprocess.Popen(command, env=self.env, stdin=subprocess.PIPE,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                self.assertTrue(select.select([proc.stdout], [], [], 10)[0])
                ready = json.loads(proc.stdout.readline())
                self.assertEqual(ready["origin"], f"http://127.0.0.1:{port}")
                # A second window fails without stopping the existing listener.
                conflict = subprocess.Popen(command, env=self.env, stdin=subprocess.PIPE,
                                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                try:
                    self.assertEqual(conflict.wait(timeout=10), 1)
                finally:
                    conflict.communicate(timeout=5)
                with socket.create_connection(("127.0.0.1", port), timeout=2):
                    pass
                if stop == "pipe":
                    proc.stdin.close(); proc.stdin = None
                else:
                    proc.terminate()
                proc.communicate(timeout=10)
                self.assertEqual(proc.returncode, 0)
                with socket.socket() as sock:
                    self.assertNotEqual(sock.connect_ex(("127.0.0.1", port)), 0)
                self.assertEqual(sentinel.read_text(), "synthetic original")
            finally:
                if proc.poll() is None:
                    proc.terminate(); proc.communicate(timeout=10)

    def test_native_missing_compiler_does_not_open_browser(self):
        result = self.run_cli("window", "--data-dir", str(self.directory / "no-native-tools"))
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stdout)["error"], "NATIVE_WINDOW_SETUP_FAILED")

    def test_retired_connect_does_not_touch_existing_port(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0)); listener.listen()
            result = self.run_cli("connect")
            self.assertEqual(json.loads(result.stdout)["error"], "WEB_PAIRING_RETIRED")
            self.assertEqual(result.returncode, 1)


if __name__ == "__main__":
    unittest.main()
