"""User-operated official login for Ariadne's isolated App Server account."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.codex_account import login
from src.codex_runtime import codex_binary
if __name__ == "__main__":
    raise SystemExit(login(codex_binary()))
