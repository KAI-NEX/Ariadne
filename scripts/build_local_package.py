"""Build an allowlisted, self-contained macOS arm64 local distribution."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import plistlib
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def source_files():
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    return [p for p in tracked if p == "app.py" or p.startswith(("src/", "public/"))
            or (p.startswith("data/") and p.endswith((".json", ".sql")))]


def build(args):
    if sys.platform != "darwin":
        raise SystemExit("Build on macOS arm64 with Swift installed.")
    release = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    root = ROOT / ".cache/local-distribution" / release
    app_bundle = root / "Ariadne.app"
    bundle = app_bundle / "Contents/Resources/runtime"
    bundle.mkdir(parents=True)
    (bundle / "bin").mkdir()
    (bundle / "licenses").mkdir()
    shutil.copy2(ROOT / "LICENSE", bundle / "licenses/Ariadne-LICENSE.txt")
    # Standard library only. No developer site-packages, credentials or caches.
    shutil.copytree(args.python, bundle / "python", symlinks=True,
                    ignore=shutil.ignore_patterns("site-packages", "__pycache__", "*.pyc", "include", "pkgconfig", "share"))
    for file in source_files():
        from check_public_release import FORBIDDEN_DIRS, PRIVATE_DATA_DIRS, SECRET_NAMES, SECRET_PATTERN
        source = ROOT / file
        parts = Path(file).parts
        if source.is_symlink() or set(parts) & FORBIDDEN_DIRS or source.name in SECRET_NAMES or (
            parts[0] == "data" and (set(parts[1:]) & PRIVATE_DATA_DIRS or source.name.startswith("jd-"))
        ) or SECRET_PATTERN.search(source.read_bytes()):
            raise RuntimeError("Refusing private or credential-shaped release source: " + file)
        target = bundle / "app" / file
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / file, target)
    # New release UI is not necessarily tracked until the milestone commit.
    for file in ("download.html", "local-download.js", "local-download.css"):
        shutil.copy2(ROOT / "public" / file, bundle / "app/public" / file)
    scripts = bundle / "app/scripts"
    scripts.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / "scripts/run_codex_connector.py", scripts)
    shutil.copy2(ROOT / "scripts/local_package.py", bundle)
    codex = args.codex_dir / "codex-aarch64-apple-darwin"
    shutil.copy2(codex, bundle / "bin/codex")
    (bundle / "bin/codex").chmod(0o755)
    for name in ("LICENSE", "NOTICE"):
        if (args.codex_dir / name).exists():
            shutil.copy2(args.codex_dir / name, bundle / "licenses" / ("Codex-" + name))
    for license_file in (bundle / "python/lib").glob("python*/LICENSE.txt"):
        shutil.copy2(license_file, bundle / "licenses/Python-LICENSE.txt")
    subprocess.run(["swiftc", "-target", "arm64-apple-macos14.0", "-O", str(ROOT / "scripts/portable_pdf.swift"), "-o", str(bundle / "bin/pdftoppm")], check=True)
    for file in (ROOT / "src/extraction").glob("*.swift"):
        subprocess.run(["swiftc", "-target", "arm64-apple-macos14.0", "-O", str(file), "-o", str(bundle / "bin" / file.stem)], check=True)
    (bundle / "bin/swift").write_text('''#!/bin/sh
set -eu
tool="$(basename "$1" .swift)"
shift
case "$tool" in
  ocr_with_vision|extract_pdf_text|extract_pdf_visual_text) exec "$(dirname "$0")/$tool" "$@" ;;
  *) exit 2 ;;
esac
''')
    (bundle / "bin/swift").chmod(0o755)
    manifest = {"release": release, "platform": "macOS arm64", "codex": json.loads((args.codex_dir / "codex-release.json").read_text()),
                "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip(),
                "includes_working_changes": True, "provider_selected": False}
    (bundle / "release.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for name, mode in (("启动 Ariadne.command", "start"), ("登录 Codex.command", "login"), ("连接网页版.command", "connector")):
        command = bundle / name
        command.write_text(f'''#!/bin/bash
set -eu
cd "$(dirname "$0")"
if [ "$(uname -m)" != arm64 ]; then
  printf '%s\\n' '此包适用于 Apple 芯片 Mac；Intel / Windows 暂不支持。'
  read -r -p '按回车关闭' _answer
  exit 1
fi
if ! ./python/bin/python3 -I -B ./local_package.py {mode}; then
  read -r -p '启动未完成，请查看上方原因。按回车关闭' _answer
  exit 1
fi
''')
        command.chmod(0o755)
    shutil.copy2(ROOT / "docs/current/LOCAL_DISTRIBUTION.md", bundle / "使用说明.md")
    # Copy rendering source alongside compiled helpers for provenance.
    shutil.copy2(ROOT / "scripts/portable_pdf.swift", bundle / "portable_pdf.swift")
    executable = app_bundle / "Contents/MacOS/Ariadne"
    executable.parent.mkdir(parents=True)
    subprocess.run(["swiftc", "-target", "arm64-apple-macos14.0", "-O",
                    str(ROOT / "scripts/desktop_macos.swift"), "-o", str(executable)], check=True)
    shutil.copy2(ROOT / "scripts/desktop_macos.swift", bundle / "desktop_macos.swift")
    icon_builder = root / "build-icon"
    subprocess.run(["swiftc", str(ROOT / "scripts/build_desktop_icon.swift"), "-o", str(icon_builder)], check=True)
    iconset = root / "Ariadne.iconset"
    subprocess.run([str(icon_builder), str(ROOT / "public/vi/manifest.json"), str(iconset)], check=True)
    subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o",
                    str(app_bundle / "Contents/Resources/Ariadne.icns")], check=True)
    (app_bundle / "Contents/Info.plist").write_bytes(plistlib.dumps({
        "CFBundleExecutable": "Ariadne", "CFBundleIdentifier": "com.kai-nex.ariadne.local",
        "CFBundleName": "Ariadne", "CFBundleDisplayName": "Ariadne · 衡",
        "CFBundleIconFile": "Ariadne.icns",
        "CFBundlePackageType": "APPL", "CFBundleShortVersionString": "1.0",
        "CFBundleVersion": release.replace("-", "."), "LSMinimumSystemVersion": "14.0",
        "NSHighResolutionCapable": True,
        "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
    }))
    files = {str(p.relative_to(bundle)): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in bundle.rglob("*") if p.is_file() and not p.is_symlink()}
    (bundle / "SHA256SUMS.json").write_text(json.dumps(files, indent=2) + "\n")
    # Ad-hoc signing provides bundle integrity on this machine, not notarization.
    subprocess.run(["codesign", "--force", "--sign", "-", str(app_bundle)], check=True)
    archive = root / f"Ariadne-Local-macOS-arm64-{release}.zip"
    subprocess.run(["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(app_bundle), str(archive)], check=True)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    (root / (archive.name + ".sha256")).write_text(digest + "  " + archive.name + "\n")
    if args.publish_local:
        downloads = ROOT / "public/downloads"
        downloads.mkdir(exist_ok=True)
        shutil.copy2(archive, downloads / archive.name)
        shutil.copy2(root / (archive.name + ".sha256"), downloads)
        # Public metadata contains no machine paths or runtime secrets.
        (downloads / "latest.json").write_text(json.dumps({"url": "/downloads/" + archive.name,
            "sha256": digest, "bytes": archive.stat().st_size, "release": release, "platform": "macOS arm64"}) + "\n")
    print(json.dumps({"bundle": str(bundle), "app": str(app_bundle), "archive": str(archive), "sha256": digest}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--python", type=Path, required=True, help="Relocatable standalone Python root")
    parser.add_argument("--codex-dir", type=Path, required=True, help="Verified official Codex release and licenses")
    parser.add_argument("--publish-local", action="store_true", help="Expose archive from the current local website")
    build(parser.parse_args())
