"""Installer boundaries: relocation, repeat install, data retention, runtime isolation."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("local_package", Path(__file__).resolve().parents[1] / "scripts/local_package.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LocalPackageTests(unittest.TestCase):
    def test_install_versions_preserve_shared_data_and_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle = root / "下载 含空格"
            (bundle / "app/data").mkdir(parents=True)
            (bundle / "release.json").write_text(json.dumps({"release": "one"}))
            home = root / "安装 含空格"
            first = module.install(bundle, home)
            data = first / "app/data/workspaces/original.txt"
            data.write_text("original bytes")
            self.assertEqual(module.install(bundle, home), first)
            (bundle / "release.json").write_text(json.dumps({"release": "two"}))
            second = module.install(bundle, home)
            self.assertNotEqual(first, second)
            self.assertEqual((second / "app/data/workspaces/original.txt").read_text(), "original bytes")
            self.assertTrue(data.exists())
            self.assertFalse((bundle / "app/data/workspaces").exists())
            self.assertFalse((home / "data/runtime/codex-local.json").exists())

    def test_bad_identity_and_incomplete_install_do_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle = root / "bundle"
            bundle.mkdir()
            (bundle / "release.json").write_text('{"release":"../escape"}')
            with self.assertRaises(ValueError):
                module.install(bundle, root / "home")
            (bundle / "release.json").write_text('{"release":"partial"}')
            incomplete = root / "home/releases/partial"
            incomplete.mkdir(parents=True)
            (incomplete / "keep").write_text("keep")
            with self.assertRaises(RuntimeError):
                module.install(bundle, root / "home")
            self.assertEqual((incomplete / "keep").read_text(), "keep")

    def test_runtime_uses_bundle_tools_and_preserves_explicit_login_home(self):
        with patch.dict(os.environ, {"CODEX_HOME": "/explicit/codex", "OPENAI_API_KEY": "synthetic",
                                   "PYTHONPATH": "/untrusted", "ARIADNE_WORKSPACE_ROOT": "/old-workspace"}):
            env = module.environment(Path("/installed"))
        self.assertEqual(env["CODEX_HOME"], "/explicit/codex")
        self.assertEqual(env["ARIADNE_CODEX_BINARY"], "/installed/bin/codex")
        self.assertNotIn("OPENAI_API_KEY", env)
        self.assertNotIn("PYTHONPATH", env)
        self.assertEqual(env["ARIADNE_WORKSPACE_ROOT"], "/installed/app/data/workspaces")
        self.assertNotIn("prefer_codex", env)

    def test_installed_workspace_uses_real_shared_root_without_weakening_storage(self):
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from src.workspace_storage import WorkspaceStorage, WorkspaceError
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bundle = root / "bundle"
            (bundle / "app/data").mkdir(parents=True)
            (bundle / "release.json").write_text('{"release":"workspace-test"}')
            target = module.install(bundle, root / "home")
            with self.assertRaises(WorkspaceError):
                WorkspaceStorage(target / "app/data/workspaces").directory("a" * 32)
            with patch.dict(os.environ, module.environment(target)):
                storage = WorkspaceStorage()
                self.assertEqual(storage.root, (root / "home/data/workspaces").resolve())
                self.assertEqual(storage.status("a" * 32, "job-radar-local-first-v1"), {"initialized": False})


if __name__ == "__main__":
    unittest.main()
