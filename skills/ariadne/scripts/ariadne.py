"""Portable Skill entry point; no downloads, account/config edits or model calls."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
from http.server import ThreadingHTTPServer

SKILL = Path(__file__).resolve().parents[1]


def runtime_root():
    packaged = SKILL / "runtime"
    if packaged.is_dir():
        manifest = json.loads((SKILL / "runtime-files.json").read_text())
        for name, digest in manifest.items():
            path = packaged / name
            if (path.is_symlink() or not path.resolve().is_relative_to(packaged.resolve())
                    or hashlib.sha256(path.read_bytes()).hexdigest() != digest):
                raise ValueError("SKILL_RUNTIME_INTEGRITY_FAILED")
        return packaged
    repository = SKILL.parent.parent
    if (repository / "app.py").is_file() and (repository / "src/local_connector.py").is_file():
        return repository
    raise ValueError("SKILL_RUNTIME_MISSING: install the complete Ariadne Skill ZIP")


def executable(name, override=None):
    if override:
        return shutil.which(override)
    found = shutil.which(name)
    if not found and name == "codex" and sys.platform == "darwin":
        # Known desktop installations; account/config files are never inspected.
        for app in ("Codex", "ChatGPT"):
            candidate = Path(f"/Applications/{app}.app/Contents/Resources/codex")
            if candidate.is_file() and os.access(candidate, os.X_OK):
                return str(candidate)
    return found


def clean_environment():
    return {key: value for key, value in os.environ.items()
            if not key.startswith(("CODEX_", "OPENAI_", "MCP_")) or key == "CODEX_HOME"}


def probe(command):
    try:
        return subprocess.run(command, capture_output=True, text=True, timeout=15,
                              env=clean_environment())
    except (OSError, subprocess.SubprocessError):
        return None


def doctor():
    checks = []
    def record(name, ok, action):
        checks.append({"check": name, "ok": bool(ok), "action": "" if ok else action})
    record("python", sys.version_info >= (3, 9), "Use Python 3.9 or newer.")
    record("platform", os.name == "posix", "Native Windows is not qualified; use the web API-key path.")
    try:
        runtime = runtime_root()
        sys.path.insert(0, str(runtime))
        import app  # noqa: F401 - prove the distributed runtime imports intact
        record("runtime", True, "")
    except (OSError, ValueError, ImportError, SyntaxError):
        record("runtime", False, "Install the complete Skill ZIP, including runtime and its manifest.")
    codex = executable("codex", os.environ.get("ARIADNE_CODEX_BINARY"))
    record("codex", codex, "Install a compatible Codex CLI for this computer, or make it available on PATH.")
    if codex:
        help_result = probe([codex, "exec", "--help"])
        flags = ("--ignore-user-config", "--ignore-rules", "--ephemeral", "--output-schema", "--image")
        record("codex_protocol", help_result is not None and help_result.returncode == 0
               and all(flag in help_result.stdout for flag in flags),
               "This Codex CLI lacks the isolated multimodal protocol required by Ariadne; use a compatible version.")
        login = probe([codex, "login", "status"])
        record("codex_login", login is not None and login.returncode == 0,
               "Run codex login and complete login yourself, then retry. Do not share credentials.")
    for tool in ("pdftoppm", "pdfinfo"):
        binary = executable(tool)
        result = probe([binary, "-v"]) if binary else None
        record(tool, result is not None and result.returncode == 0,
               "Install Poppler for your OS/CPU and expose pdftoppm and pdfinfo on PATH.")
    return {"ready": all(check["ok"] for check in checks), "checks": checks,
            "model_call_made": False, "model_capability_certified": False}


def connect(origin):
    result = doctor()
    if not result["ready"]:
        print(json.dumps(result, ensure_ascii=False), flush=True)
        return 1
    from src.local_connector import Pairing, connector_handler
    from app import JobRadarHandler
    pairing = Pairing(origin)
    # Explicit process-local opt-in. No persisted runtime or Agent settings change.
    os.environ["ARIADNE_CODEX_ENABLED"] = "1"
    os.environ["ARIADNE_CODEX_BINARY"] = executable("codex", os.environ.get("ARIADNE_CODEX_BINARY"))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 8765), connector_handler(JobRadarHandler))
    except OSError:
        print(json.dumps({"error": "CONNECTOR_PORT_UNAVAILABLE", "port": 8765,
                          "action": "Stop your existing connector yourself; no process was replaced."}))
        return 1
    server.pairing = pairing
    def stop(_signum, _frame):
        raise KeyboardInterrupt
    previous = {sig: signal.signal(sig, stop) for sig in (signal.SIGINT, signal.SIGTERM)}
    print(json.dumps({"status": "awaiting_pairing", "url": origin + "/codex-connect.html",
                      "pairing_code": pairing.code, "pairing_expires_in": 300,
                      "connector": "http://127.0.0.1:8765", "model_call_made": False}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pairing.revoke()
        server.server_close()
        for sig, handler in previous.items():
            signal.signal(sig, handler)
        print(json.dumps({"status": "stopped", "pairing_revoked": True}), flush=True)
    return 0


def open_local(port=8766, data_dir=None):
    """Serve the complete existing UI and keep user data outside the Skill install."""
    result = doctor()
    required = {"python", "platform", "runtime"}
    if any(not check["ok"] for check in result["checks"] if check["check"] in required):
        print(json.dumps(result, ensure_ascii=False), flush=True)
        return 1
    import app
    state = Path(data_dir) if data_dir else Path.home() / (
        "Library/Application Support/Ariadne Skill" if sys.platform == "darwin" else ".local/share/ariadne-skill")
    if state.is_symlink():
        raise ValueError("SKILL_DATA_SYMLINK_REFUSED")

    from src.product_application import skill_handler
    class Handler(skill_handler(app.JobRadarHandler)):
        def log_message(self, *args):
            pass

    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    except OSError:
        print(json.dumps({"error": "SKILL_PORT_UNAVAILABLE", "port": port,
                          "action": "Use your already-running Skill terminal or stop it yourself; no process was replaced."}))
        return 1
    try:
        state.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.environ["ARIADNE_WORKSPACE_ROOT"] = str(state.resolve() / "workspaces")
        os.environ["ARIADNE_CODEX_ENABLED"] = "1" if result["ready"] else "0"
        codex = executable("codex", os.environ.get("ARIADNE_CODEX_BINARY"))
        if codex:
            os.environ["ARIADNE_CODEX_BINARY"] = codex
        app.DATABASE_PATH = state / "legacy.db"
        app.OCR_UPLOAD_PATH = state / "local_ocr_uploads"
        app.RAW_CAPTURE_PATH = state / "raw"
        app.initialize_database(seed=False)
        def stop(_signum, _frame):
            raise KeyboardInterrupt
        previous = {sig: signal.signal(sig, stop) for sig in (signal.SIGINT, signal.SIGTERM)}
        print(json.dumps({"status": "ready", "mode": "local-ui",
            "url": f"http://127.0.0.1:{server.server_port}/",
            "origin": f"http://127.0.0.1:{server.server_port}", "pairing_required": False,
            "codex_ready": result["ready"], "checks": result["checks"],
            "data_directory": str(state), "model_call_made": False}), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            for sig, handler in previous.items():
                signal.signal(sig, handler)
    finally:
        server.server_close()
    print(json.dumps({"status": "stopped", "data_retained": True}), flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("doctor", "open", "window", "desktop", "connect"))
    parser.add_argument("--origin", default="https://ariadne.kai-nex.com")
    parser.add_argument("--port", type=int, default=8766, help="Local UI port; changing it creates a different browser origin.")
    parser.add_argument("--data-dir", type=Path, help="Explicit local UI data directory; defaults outside the Skill install.")
    args = parser.parse_args()
    if args.action == "doctor":
        result = doctor()
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result["ready"] else 1
    try:
        if args.action in {"window", "desktop"}:
            from skill_window import open_window, supervise
            if not 1024 <= args.port <= 65535:
                raise ValueError("SKILL_PORT_INVALID")
            state = args.data_dir or Path.home() / "Library/Application Support/Ariadne Skill"
            if args.action == "window":
                return open_window(runtime_root(), args.port, state)
            return supervise(runtime_root(), args.port, state)
        if args.action == "open":
            if not 0 <= args.port <= 65535:
                raise ValueError("SKILL_PORT_INVALID")
            return open_local(args.port, args.data_dir)
        print(json.dumps({"error": "WEB_PAIRING_RETIRED", "action": "Use window for local Codex, or use your API key on the website."}))
        return 1
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        if args.action in {"window", "desktop"}:
            print(json.dumps({"error": "NATIVE_WINDOW_SETUP_FAILED", "action": str(error)}))
        else:
            print(json.dumps({"error": "CONNECTOR_SETUP_FAILED", "action": "Check the exact HTTPS origin and Skill installation."}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
