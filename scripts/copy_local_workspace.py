"""Explicit, verified one-time copy of a local library into the desktop App home.

Stop both writers before switching services. This never merges or overwrites an
existing destination, copies credentials, or changes the source library.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.workspace_storage import WorkspaceStorage, CONTRACT


def inventory(directory):
    result = {}
    for path in sorted(directory.rglob("*")):
        if path.is_symlink():
            raise ValueError("Workspace symlinks are not supported")
        if path.is_file() and path.name != ".lock":
            result[str(path.relative_to(directory))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def copy_workspace(source_root, home, workspace):
    source = WorkspaceStorage(source_root)
    directory = source.directory(workspace)
    if not (directory / "HEAD.json").is_file():
        raise ValueError("Source workspace is not initialized")
    target_root = home / "data/workspaces"
    target = WorkspaceStorage(target_root).directory(workspace)
    mapping = home / "desktop-workspace.json"
    if target.exists() or mapping.exists():
        raise FileExistsError("Destination library or desktop mapping already exists; nothing overwritten")
    target_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = target_root / (".import-" + uuid.uuid4().hex)
    # Same interprocess lock as normal commits: HEAD and all immutable files agree.
    with source._locked(workspace):
        head = source._head(directory)
        for database, stores in head["databases"].items():
            for store, records in stores.items():
                for key, entry in records.items():
                    source._load_record(directory, entry, CONTRACT["databases"][database][store], key)
        before = inventory(directory)
        shutil.copytree(directory, temporary, ignore=shutil.ignore_patterns(".lock"))
        if inventory(temporary) != before or inventory(directory) != before:
            raise ValueError("Copy verification failed; original and temporary copy retained")
        if target.exists():
            raise FileExistsError("Destination appeared during copy")
        os.rename(temporary, target)
        with mapping.open("x") as output:
            json.dump({"workspace": workspace, "origin": "http://127.0.0.1:8000"}, output)
            output.write("\n")
        mapping.chmod(0o600)
    return {"files": len(before), "original_files": sum(p.startswith("originals/") for p in before),
            "records": {db: {name: len(rows) for name, rows in stores.items()} for db, stores in head["databases"].items()},
            "verified_sha256": True}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--home", type=Path, required=True)
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()
    print(json.dumps(copy_workspace(args.source_root, args.home, args.workspace), indent=2))
