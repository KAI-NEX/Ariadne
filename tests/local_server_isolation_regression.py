"""Real HTTP boundary checks; synthetic files and zero credential/provider access."""
import http.client
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
from http.server import ThreadingHTTPServer
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app

class Handler(app.JobRadarHandler):
    def log_message(self, *args):
        pass

    def runtime_check(self):
        self.send_json(200, {"synthetic": True, "network_call_made": False})

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    public = root / 'public'; public.mkdir()
    (public / 'index.html').write_text('synthetic public UI')
    (public / 'empty').mkdir()
    secret = root / 'private.txt'; secret.write_text('synthetic private material')
    (public / 'outside.txt').symlink_to(secret)
    with patch.object(app, 'PUBLIC_PATH', public), patch.object(app, 'read_deepseek_key', side_effect=AssertionError('credential read')), patch.object(app, 'call_ariadne_model', side_effect=AssertionError('provider call')):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True); worker.start()
        port = server.server_port
        def request(method, path, headers=None):
            connection = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse(); status = response.status; body = response.read(); connection.close()
            assert b'synthetic private material' not in body
            return status
        try:
            for enabled in ['0', '1']:
                with patch.dict(os.environ, {'ARIADNE_CODEX_ENABLED': enabled}):
                    assert request('GET', '/') == 200
                    assert request('HEAD', '/') == 200
                    assert request('POST', '/api/runtime-check', {'Origin': f'http://127.0.0.1:{port}'}) == 200
                    for method, path in [('GET', '/api/runtime-options'), ('HEAD', '/'), ('POST', '/api/runtime-check')]:
                        assert request(method, path, {'Host': f'evil.example:{port}'}) == 403
                        assert request(method, path, {'Origin': 'https://evil.example'}) == 403
                        assert request(method, path, {'Origin': 'null'}) == 403
                    assert request('GET', '/api/runtime-options', {'Sec-Fetch-Site': 'cross-site'}) == 403
                    assert request('GET', '/outside.txt') == 404
                    assert request('HEAD', '/outside.txt') == 404
                    assert request('GET', '/empty/') == 404
                    assert request('GET', '/../private.txt') == 404
        finally:
            server.shutdown(); server.server_close(); worker.join()
print(json.dumps({'all_modes_origin_host': 'pass', 'cross_site_api': 'pass', 'symlink_directory_traversal': 'pass', 'credential_reads': 0, 'provider_calls': 0}))
