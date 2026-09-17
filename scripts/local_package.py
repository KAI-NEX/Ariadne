"""Relocatable local distribution installer/launcher; never bundles user state."""
from __future__ import annotations

import argparse
import fcntl
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import urllib.request


def install(bundle, home):
    manifest = json.loads((bundle / "release.json").read_text())
    release = manifest["release"]
    if not release or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._" for c in release):
        raise ValueError("Invalid release identity")
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (home / "install.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        target = home / "releases" / release
        if not (target / ".installed").exists():
            if target.exists():
                raise RuntimeError("上次安装未完成，原文件已保留。请使用新下载的安装包重试。")
            shutil.copytree(bundle, target, symlinks=True)
            state = home / "data"
            state.mkdir(exist_ok=True, mode=0o700)
            for name in ("workspaces", "runtime", "raw", "local_ocr_uploads"):
                (state / name).mkdir(exist_ok=True, mode=0o700)
                (target / "app/data" / name).symlink_to(state / name, target_is_directory=True)
            (target / "app/data/job_radar.db").symlink_to(state / "job_radar.db")
            (target / ".installed").write_text(release)
        return target


def environment(target):
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(("CODEX_", "OPENAI_", "MCP_", "PYTHON", "ARIADNE_"))}
    # Existing Codex login stays in its normal home. Nothing reads/copies tokens.
    env.update(PATH=f"{target / 'bin'}:/usr/bin:/bin:/usr/sbin:/sbin",
               PYTHONDONTWRITEBYTECODE="1", PYTHONNOUSERSITE="1",
               ARIADNE_CODEX_BINARY=str(target / "bin/codex"), ARIADNE_CODEX_ENABLED="1")
    if os.environ.get("CODEX_HOME"):
        env["CODEX_HOME"] = os.environ["CODEX_HOME"]
    return env


def serve(target, port, open_browser):
    release = json.loads((target / "release.json").read_text())["release"]
    origin = f"http://127.0.0.1:{port}"
    try:
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", port))
    except OSError:
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(origin + "/api/local-package", timeout=2) as response:
                state = json.load(response)
            if state != {"product": "ariadne-local", "release": release}:
                raise ValueError("different service")
        except Exception as exc:
            raise RuntimeError(f"端口 {port} 已被其他服务或另一版本占用。请先停止原服务，再启动此版本。不会自动停止进程或更换资料地址。") from exc
        if open_browser:
            subprocess.run(["/usr/bin/open", origin], check=True)
        print("Ariadne 已经运行，已复用原服务。", flush=True)
        return

    sys.path.insert(0, str(target / "app"))
    import app
    from http.server import ThreadingHTTPServer

    class Handler(app.JobRadarHandler):
        def do_GET(self):
            if self.path == "/api/local-package":
                if self.local_request_allowed():
                    self.send_json(200, {"product": "ariadne-local", "release": release})
                return
            super().do_GET()

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    app.initialize_database()
    print(f"Ariadne 已启动：{origin}\n先选择自己的 Codex、API 模型或本地运行，点击继续进入工作空间。\n关闭此终端或按 Ctrl+C 停止服务；资料保留。", flush=True)
    if open_browser:
        subprocess.Popen(["/usr/bin/open", origin])
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("start", "login", "connector", "serve"))
    parser.add_argument("--home", type=Path, default=Path.home() / "Library/Application Support/Ariadne Local")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)
    bundle = Path(__file__).resolve().parent
    if args.mode == "serve":
        serve(bundle, args.port, not args.no_open)
        return
    target = install(bundle, args.home.expanduser().resolve())
    env = environment(target)
    if args.mode == "login":
        print("即将打开 Codex 官方 ChatGPT 登录。已有登录不会被打包或上传给 Ariadne。", flush=True)
        os.execve(target / "bin/codex", [str(target / "bin/codex"), "login"], env)
    python = target / "python/bin/python3"
    if args.mode == "connector":
        print("仅在使用公开网页版时需要配对。本地运行不需要此步骤。")
        origin = input("输入网页来源（回车使用 https://ariadne.kai-nex.com）：").strip() or "https://ariadne.kai-nex.com"
        command = [str(python), "-B", str(target / "app/scripts/run_codex_connector.py"), "--origin", origin]
    else:
        command = [str(python), "-B", str(target / "local_package.py"), "serve", "--port", str(args.port)]
        if args.no_open:
            command.append("--no-open")
    os.chdir(target / "app")
    os.execve(python, command, env)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Ariadne 启动失败：{error}", file=sys.stderr)
        sys.exit(1)
