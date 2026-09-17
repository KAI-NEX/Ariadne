"""Own-key requests: no ambient fallback, credential persistence or cross-request leaks."""
import http.client
from http import HTTPStatus
import json
from pathlib import Path
import sys
import threading
from email.message import Message
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app
from src.provider_runtime import ProviderRuntimeError
from src.runtime_binding import BROWSER_CREDENTIAL, DEEPSEEK_CREDENTIAL, resolve_runtime_credential, valid_binding
from src.model_settings import envelope

class Handler(app.JobRadarHandler):
    def log_message(self, *args):
        pass

class Response:
    def __init__(self, data): self.data = data
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return json.dumps(self.data).encode()

seen = []
def provider(request, timeout):
    seen.append(request.headers.get('Authorization'))
    if request.full_url == app.DEEPSEEK_MODELS_ENDPOINT:
        return Response({'data': [{'id': 'deepseek-flash'}]})
    body = json.loads(request.data)
    assert body['messages'][0]['content'][1]['image_url']['url'].startswith('data:image/jpeg;base64,')
    return Response({'choices': [{'message': {'content': 'JOB RADAR TEST'}}]})

# A BYOK snapshot cannot be mistaken for an unknown protocol/adapter.
settings = envelope('deepseek', 'deepseek-flash', {})
snapshot = SimpleNamespace(provider='deepseek', model='deepseek-flash', protocol='OPENAI_CHAT_COMPLETIONS',
    credential_ref=BROWSER_CREDENTIAL, adapter_version='deepseek-candidate-multimodal-v1', execution_settings=settings)
assert valid_binding(snapshot, 'deepseek-candidate-multimodal-v1')
snapshot.credential_ref = 'browser-key://other/request'
assert not valid_binding(snapshot, 'deepseek-candidate-multimodal-v1')

with patch.object(app, 'read_deepseek_key', side_effect=AssertionError('ambient key read')), \
     patch.object(app, 'store_deepseek_key', side_effect=AssertionError('credential persistence')), \
     patch.object(app, 'urlopen', provider):
    server = app.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True); worker.start()
    port = server.server_port
    def request(body, origin=None):
        conn = http.client.HTTPConnection('127.0.0.1', port, timeout=5)
        headers = {'Content-Type': 'application/json', 'Origin': origin or f'http://127.0.0.1:{port}'}
        conn.request('POST', '/api/runtime-providers/deepseek/connection-check', json.dumps(body), headers)
        response = conn.getresponse(); status = response.status; result = json.loads(response.read()); conn.close()
        return status, result
    try:
        for body in ({}, {'api_key': 'synthetic-user-key-one'}, {'api_key': 'short', 'confirmed': True}, [],
                     {'api_key': 'synthetic\nkey-value', 'confirmed': True}):
            assert request(body)[0] == 400
        assert not seen
        assert request({'api_key': 'synthetic-user-key-one', 'confirmed': True}, 'https://other.example')[0] == 403
        assert not seen
        for key in ['synthetic-user-key-one', 'synthetic-user-key-two']:
            status, result = request({'api_key': key, 'confirmed': True})
            assert status == 200 and result['verified_model_id'] == 'deepseek-flash'
            assert result['diagnostics']['credential'] == 'request_only'
            assert result['diagnostics']['career_data_sent'] is False
            assert key not in json.dumps(result)
        assert seen == ['Bearer synthetic-user-key-one'] * 2 + ['Bearer synthetic-user-key-two'] * 2
    finally:
        server.shutdown(); server.server_close(); worker.join()

# Independent handlers resolve only their declared source. Missing BYOK never
# falls back to the machine's key, including a key removed after consent.
for supplied in ['synthetic-user-key-one', 'synthetic-user-key-two', None, '', 'short', 'space in synthetic key']:
    handler = object.__new__(Handler); handler.headers = Message()
    if supplied is not None: handler.headers['X-Ariadne-Provider-Key'] = supplied
    with patch.object(app, 'read_deepseek_key', side_effect=AssertionError('ambient fallback')):
        try:
            value = resolve_runtime_credential(BROWSER_CREDENTIAL, DEEPSEEK_CREDENTIAL, handler.runtime_api_key)
            assert value == supplied and supplied in ['synthetic-user-key-one', 'synthetic-user-key-two']
        except ProviderRuntimeError:
            assert supplied not in ['synthetic-user-key-one', 'synthetic-user-key-two']
        if supplied is not None:
            assert handler.runtime_api_key() is None
handler.headers = Message()
with patch.object(app, 'read_deepseek_key', return_value='synthetic-machine-key'):
    assert handler.runtime_api_key() == 'synthetic-machine-key'
print('PASS BYOK: confirmed synthetic check, own credentials, source binding, no persistence/fallback/leaks')

# The new source handle must survive all six real domain validators and reach
# the Provider boundary with this request's key (no live Provider is contacted).
import contextlib, copy, io, runpy
from src.candidate_model_runtime import execute_candidate_model_request, runtime_fingerprint, candidate_model_operation_id
from src.job_model_runtime import execute_job_model_request, job_model_operation_id
from src.candidate_conversation_runtime import execute_candidate_conversation_request
from src.job_conversation_runtime import execute_job_conversation_request
from src.personal_understanding_runtime import execute as personal_execute
from src.job_overview_runtime import execute as overview_execute
class Captured(Exception): pass
specs = [
    ('candidate_model_runtime_regression.py', 'request', execute_candidate_model_request),
    ('job_model_import_regression.py', 'request', execute_job_model_request),
    ('candidate_conversation_runtime_regression.py', 'request_for', execute_candidate_conversation_request),
    ('job_conversation_runtime_regression.py', 'request', execute_job_conversation_request),
    ('personal_understanding_runtime_regression.py', 'request', personal_execute),
    ('job_overview_runtime_regression.py', 'request', overview_execute),
]
for file, name, execute in specs:
    with contextlib.redirect_stdout(io.StringIO()): fixture = runpy.run_path(str(Path(__file__).parent / file))
    request = copy.deepcopy(fixture[name]() if callable(fixture[name]) else fixture[name])
    request['runtime_snapshot']['credential_ref'] = BROWSER_CREDENTIAL
    identity = request.get('operation_identity')
    if identity:
        fp = runtime_fingerprint(request['runtime_snapshot']); identity['runtime_fingerprint'] = fp
        operation = candidate_model_operation_id if identity['operation_type'] == 'CANDIDATE_MODEL_STRUCTURING' else job_model_operation_id
        identity['operation_id'] = operation(identity['source_document_id'], fp, identity['consent_id'])
        request['processing_run_id'] = 'run-' + identity['operation_id']
    handler = object.__new__(Handler); handler.headers = Message()
    handler.headers['X-Ariadne-Provider-Key'] = 'synthetic-six-domain-key'
    def capture(credential, payload):
        assert credential == 'synthetic-six-domain-key' and payload['model'] == 'deepseek-flash'
        raise Captured()
    with patch.object(app, 'read_deepseek_key', side_effect=AssertionError('ambient domain credential')):
        try:
            if execute is execute_candidate_model_request:
                execute(request, handler.runtime_api_key, lambda _: [('1', b'synthetic-image')], capture)
            else: execute(request, handler.runtime_api_key, capture)
        except Captured: pass
        else: raise AssertionError((file, 'Provider boundary not reached'))
print('PASS BYOK six real domain validators and own-key Provider boundaries; live calls = 0')
