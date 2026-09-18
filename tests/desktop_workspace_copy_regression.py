"""Exact originals, immutable source, conflict and corruption boundaries."""
import base64
from pathlib import Path
from tempfile import TemporaryDirectory
from scripts.copy_local_workspace import copy_workspace, inventory
from src.workspace_storage import WorkspaceStorage

with TemporaryDirectory() as tmp:
    root = Path(tmp)
    storage = WorkspaceStorage(root / 'source')
    workspace = 'a' * 32
    storage.commit(workspace, 'job-radar-local-first-v1', {'source_documents': None}, [{
        'store': 'source_documents', 'operation': 'add', 'value': {
            'source_document_id': 'one', 'filename': 'qa.bin',
            'file_blob': {'$blob': 'base64', 'data': base64.b64encode(b'untouched\x00\xff').decode()}}}], initialize=True)
    original = inventory(root / 'source' / workspace)
    copy_workspace(root / 'source', root / 'home', workspace)
    assert inventory(root / 'home/data/workspaces' / workspace) == original == inventory(root / 'source' / workspace)
    try:
        copy_workspace(root / 'source', root / 'home', workspace)
        raise AssertionError('overwrite')
    except FileExistsError:
        pass
    blob = next((root / 'source' / workspace / 'originals').rglob('qa.bin'))
    blob.write_bytes(b'corrupt')
    try:
        copy_workspace(root / 'source', root / 'broken', workspace)
        raise AssertionError('corrupt accepted')
    except ValueError:
        pass
    assert not (root / 'broken/desktop-workspace.json').exists()
    try:
        copy_workspace(root / 'source', root / 'invalid', '../outside')
        raise AssertionError('invalid identity')
    except ValueError:
        pass
print('PASS exact copy, originals, source retained, destination conflict, corruption, identity')
