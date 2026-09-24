"""Ariadne-owned Codex login directory; never inspect or copy credentials."""
import os
from pathlib import Path
import subprocess
import sys


def directory():
    base = Path.home() / ("Library/Application Support" if sys.platform == "darwin" else ".local/share")
    return base / "Ariadne Codex"


def environment(create=False):
    target = directory()
    if target.is_symlink():
        raise ValueError("CODEX_ACCOUNT_SYMLINK_REFUSED")
    if create:
        target.mkdir(mode=0o700, parents=True, exist_ok=True)
    env = {k: v for k, v in os.environ.items() if not k.startswith(("CODEX_", "OPENAI_", "MCP_"))}
    # Standard Codex subprocess configuration, not the host task's directory.
    env["CODEX_HOME"] = str(target)
    return env


def login(binary):
    return subprocess.call([binary, "login"], env=environment(create=True))
