"""Native macOS window with an owned, pipe-supervised Skill service."""
import hashlib
import json
import fcntl
import os
from pathlib import Path
import platform
import plistlib
import shutil
import signal
import subprocess
import sys
import tempfile
import threading


def open_window(runtime, port, state):
    if sys.platform != "darwin" or int(platform.mac_ver()[0].split('.')[0]) < 14:
        raise ValueError("Native window requires macOS 14 or newer")
    compiler = shutil.which("swiftc")
    state = state.expanduser().resolve()
    source = runtime / "scripts/desktop_macos.swift"
    launch = {"python": sys.executable, "launcher": str(Path(__file__).with_name("ariadne.py")),
              "home": str(state), "port": str(port)}
    # Only tool/account-directory paths, never credentials or the full environment.
    for key in ("PATH", "CODEX_HOME", "ARIADNE_CODEX_BINARY"):
        if key in os.environ:
            launch[key] = os.environ[key]
    icons = [runtime / "assets/desktop-icon/compiled" / name for name in ("Ariadne.icns", "Assets.car")]
    # Each revision gets a new cache directory. Old builds and all data remain.
    revision = hashlib.sha256(source.read_bytes() + Path(__file__).read_bytes()
                              + b"".join(icon.read_bytes() for icon in icons)
                              + platform.machine().encode() + json.dumps(launch, sort_keys=True).encode()).hexdigest()[:16]
    cache = state / "native" / revision
    app = cache / "Ariadne Skill.app"
    binary = app / "Contents/MacOS/Ariadne"
    cache.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (cache / "build.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if not binary.exists():
            if not compiler or subprocess.run(["/usr/bin/xcode-select", "-p"], capture_output=True).returncode:
                raise ValueError("Install Apple Command Line Tools before opening the native window")
            cache.mkdir(parents=True, exist_ok=True, mode=0o700)
            # Parallel first launches compile to separate retained staging directories.
            stage = Path(tempfile.mkdtemp(prefix="build-", dir=cache)) / "Ariadne Skill.app"
            executable = stage / "Contents/MacOS/Ariadne"
            executable.parent.mkdir(parents=True)
            resources = stage / "Contents/Resources"
            resources.mkdir()
            (resources / "skill-launch.json").write_text(json.dumps(launch))
            subprocess.run([compiler, "-D", "SKILL_WINDOW", "-target",
                            platform.machine() + "-apple-macos14.0", str(source), "-o", str(executable)], check=True)
            for icon in icons:
                shutil.copyfile(icon, resources / icon.name)
            (stage / "Contents/Info.plist").write_bytes(plistlib.dumps({
                "CFBundleExecutable": "Ariadne", "CFBundleIdentifier": "com.kai-nex.ariadne.skill",
                "CFBundleName": "Ariadne Skill", "CFBundleDisplayName": "Ariadne · 衡",
                "CFBundlePackageType": "APPL", "CFBundleVersion": "1",
                "CFBundleIconFile": "Ariadne.icns", "CFBundleIconName": "Ariadne",
                "LSMinimumSystemVersion": "14.0", "NSHighResolutionCapable": True,
                "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
            }))
            subprocess.run(["/usr/bin/codesign", "--force", "--sign", "-", str(stage)], check=True,
                           stdout=subprocess.DEVNULL)
            if not app.exists():
                shutil.copytree(stage, app)
    # Launch through macOS so the window is registered as its own application.
    # The native process owns the service pipe; closing/crashing it ends the service.
    print(json.dumps({"status": "opening_window", "application": str(app), "port": port}), flush=True)
    return subprocess.call(["/usr/bin/open", "-W", "-n", str(app), "--args", sys.executable,
                            str(Path(__file__).with_name("ariadne.py")), str(state), str(port)])



def supervise(runtime, port, state):
    sys.path.insert(0, str(runtime / "scripts"))
    from local_package import stop_owned_server
    stopped = threading.Event()

    def watch_parent():
        while os.read(sys.stdin.fileno(), 1):
            pass
        stopped.set()

    threading.Thread(target=watch_parent, daemon=True).start()
    for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(signum, lambda *_: stopped.set())
    if stopped.is_set():
        return 0
    child = subprocess.Popen([sys.executable, "-B", str(Path(__file__).with_name("ariadne.py")),
                              "open", "--port", str(port), "--data-dir", str(state)],
                             stdin=subprocess.DEVNULL, start_new_session=True)
    try:
        while not stopped.wait(.1):
            if child.poll() is not None:
                return child.returncode or 1
    finally:
        stop_owned_server(child)
    return 0
