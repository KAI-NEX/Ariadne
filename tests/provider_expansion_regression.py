"""Gemini/Qwen: real domain contracts through fixed HTTP transport, synthetic replies."""
import contextlib
import copy
import io
import json
from pathlib import Path
import runpy
import sys
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import app
from src import byok_providers as providers
from src.model_settings import envelope
from src.runtime_binding import adapter_for
from src.candidate_model_runtime import runtime_fingerprint, candidate_model_operation_id
from src.job_model_runtime import job_model_operation_id
from src.web_execution import Sessions
from web_app import WebApplication

with contextlib.redirect_stdout(io.StringIO()):
    web_fixture = runpy.run_path(str(ROOT / 'tests/web_runtime_regression.py'))
invoke = web_fixture['invoke']
ORIGIN = web_fixture['ORIGIN']
KEY = web_fixture['KEY']


def load(file):
    with contextlib.redirect_stdout(io.StringIO()):
        return runpy.run_path(str(ROOT / 'tests' / file))


SPECS = [
    ('candidate_model_runtime_regression.py', 'request', 'candidate-model-structure'),
    ('job_model_import_regression.py', 'request', 'job-model-structure'),
    ('candidate_conversation_runtime_regression.py', 'request_for', 'candidate-conversation-turn'),
    ('job_conversation_runtime_regression.py', 'request', 'job-conversation-turn'),
    ('personal_understanding_runtime_regression.py', 'request', 'personal-understanding-turn'),
    ('job_overview_runtime_regression.py', 'request', 'job-overview-turn'),
]
FIXTURES = [load(file) for file, _, _ in SPECS]


def request_for(fixture, name, provider):
    value = copy.deepcopy(fixture[name]() if callable(fixture[name]) else fixture[name])
    snapshot = value['runtime_snapshot']
    model = providers.PROVIDERS[provider]['model']
    snapshot.update(provider=provider, model=model, protocol='OPENAI_CHAT_COMPLETIONS',
                    credential_ref=f'browser-key://{provider}/request',
                    adapter_version=adapter_for(provider, snapshot['adapter_version']), execution_settings=envelope(provider, model))
    if 'consent' in value and 'provider' in value['consent']:
        value['consent'].update(provider=provider, model=model)
    identity = value.get('operation_identity')
    if identity:
        fp = runtime_fingerprint(snapshot)
        identity['runtime_fingerprint'] = fp
        operation = candidate_model_operation_id if identity['operation_type'] == 'CANDIDATE_MODEL_STRUCTURING' else job_model_operation_id
        identity['operation_id'] = operation(identity['source_document_id'], fp, identity['consent_id'])
        value['processing_run_id'] = 'run-' + identity['operation_id']
    return value


def response_for(index, fixture, model):
    if index == 0:
        result = fixture['response']()
    elif index == 1:
        result = fixture['provider_response']()
    elif index == 2:
        result = {'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(fixture['semantic_action']('EXPLAIN'))}}]}
    elif index == 3:
        result = fixture['provider_response'](fixture['semantic']())
    else:
        name = 'deliver_personal_understanding' if index == 4 else fixture['TOOL']
        result = {'choices': [{'finish_reason': 'tool_calls', 'message': {'tool_calls': [
            {'function': {'name': name, 'arguments': json.dumps(fixture['output'])}}]}}]}
    return {**result, 'model': model}


class Response:
    status = 200
    def __init__(self, value): self.raw = json.dumps(value).encode()
    def read(self, limit): return self.raw[:limit]
    def __enter__(self): return self
    def __exit__(self, *args): pass


class ProvidersTest(unittest.TestCase):
    def test_six_domain_http_roundtrips_each_provider(self):
        for provider, config in providers.PROVIDERS.items():
            for index, ((_, name, route), fixture) in enumerate(zip(SPECS, FIXTURES)):
                with self.subTest(provider=provider, route=route):
                    value = request_for(fixture, name, provider)
                    original = copy.deepcopy(value)
                    seen = []
                    def transport(request, timeout):
                        payload = json.loads(request.data)
                        self.assertEqual(request.full_url, config['endpoint'])
                        self.assertEqual(request.get_header('Authorization'), 'Bearer ' + KEY)
                        self.assertEqual(payload['model'], config['model'])
                        self.assertNotIn('thinking', payload)
                        self.assertNotIn(KEY, request.data.decode())
                        if provider == 'gemini':
                            self.assertEqual(payload['reasoning_effort'], 'low')
                        else:
                            self.assertIs(payload['enable_thinking'], False)
                        if index == 0:
                            images = [part for part in payload['messages'][0]['content'] if part['type'] == 'image_url']
                            self.assertEqual(len(images), 3, 'all PDF pages delivered')
                        if index >= 4:
                            self.assertEqual(len(payload['tools']), 1)
                            self.assertEqual(payload['tool_choice']['type'], 'function')
                        seen.append(payload)
                        return Response(response_for(index, fixture, config['model']))
                    with patch.object(providers.HTTP, 'open', transport), \
                         patch.object(app, 'read_deepseek_key', side_effect=AssertionError('ambient fallback')), \
                         patch.object(app, 'render_complete_pdf_pages', return_value=[('1', b'page-one'), ('2', b'page-two'), ('3', b'page-three')]):
                        status, _, result = invoke(WebApplication([ORIGIN]), '/api/' + route, value, HTTP_X_ARIADNE_PROVIDER=provider)
                    self.assertEqual(status, 200, result)
                    self.assertEqual(len(seen), 1)
                    self.assertEqual(value, original, 'requests and source facts remain unchanged')
                    self.assertNotIn(KEY, json.dumps(result))

    def test_binding_failures_never_dispatch(self):
        for provider in providers.PROVIDERS:
            value = request_for(FIXTURES[0], 'request', provider)
            for field, invalid in [('model', 'unknown'), ('credential_ref', 'browser-key://deepseek/request'),
                                   ('protocol', 'ACCOUNT_EXPERIMENTAL'), ('adapter_version', 'unverified')]:
                body = copy.deepcopy(value); body['runtime_snapshot'][field] = invalid
                with patch.object(providers.HTTP, 'open', side_effect=AssertionError('invalid request dispatched')):
                    self.assertIn(invoke(WebApplication([ORIGIN]), '/api/candidate-model-structure', body,
                                         HTTP_X_ARIADNE_PROVIDER=provider)[0], (400, 422))
            with patch.object(providers.HTTP, 'open', side_effect=AssertionError('wrong provider key dispatched')):
                self.assertEqual(invoke(WebApplication([ORIGIN]), '/api/candidate-model-structure', value,
                                        HTTP_X_ARIADNE_PROVIDER='deepseek')[0], 422)

    def test_complete_visual_connection_check_and_failure(self):
        for provider, config in providers.PROVIDERS.items():
            good = {'model': config['model'], 'choices': [{'finish_reason': 'stop', 'message': {
                'content': json.dumps({'pages': ['ARIADNE PAGE ONE', 'ARIADNE PAGE TWO']})}}]}
            bad = copy.deepcopy(good); bad['choices'][0]['message']['content'] = '{"pages":["ARIADNE PAGE ONE"]}'
            for result, status in [(good, 200), (bad, 422)]:
                calls = []
                def transport(request, timeout):
                    calls.append(request)
                    payload = json.loads(request.data)
                    self.assertEqual(len([p for p in payload['messages'][0]['content'] if p['type'] == 'image_url']), 2)
                    self.assertEqual(payload['response_format'], {'type': 'json_object'})
                    return Response(result)
                with patch.object(providers.HTTP, 'open', transport), \
                     patch.object(app, 'render_complete_pdf_pages', return_value=[('1', b'one'), ('2', b'two')]):
                    actual, _, response = invoke(WebApplication([ORIGIN]), f'/api/runtime-providers/{provider}/connection-check',
                                                 {'api_key': KEY, 'confirmed': True}, HTTP_X_ARIADNE_PROVIDER=provider)
                self.assertEqual(actual, status, response)
                self.assertEqual(len(calls), 1)
                self.assertNotIn(KEY, json.dumps(response))
            with patch.object(providers.HTTP, 'open', side_effect=AssertionError('unconfirmed send')):
                self.assertEqual(invoke(WebApplication([ORIGIN]), f'/api/runtime-providers/{provider}/connection-check',
                                        {'api_key': KEY, 'confirmed': False})[0], 400)

    def test_provider_namespaces_credentials_redirect_and_response_limits(self):
        sessions = Sessions()
        with sessions.acquire('one-session', KEY, provider='gemini') as first:
            first.registries['CANDIDATE_MODEL_EXECUTIONS'].begin('shared-id', 'source')
            with sessions.acquire('one-session', KEY, provider='qwen') as second:
                self.assertIsNot(first, second)
                self.assertEqual(second.registries['CANDIDATE_MODEL_EXECUTIONS'].begin('shared-id', 'source')[0], 'CLAIMED')
        credential = providers.RequestCredential('gemini', KEY)
        self.assertNotIn(KEY, repr(credential))
        with self.assertRaises(ValueError):
            providers.provider_payload(credential, {'model': 'qwen3.8-max'})
        with patch.object(providers.HTTP, 'open', return_value=Response({'large': 'x' * 200})):
            with self.assertRaisesRegex(ValueError, 'TOO_LARGE'):
                providers.call_provider(credential, {'model': 'gemini-3.7-flash'}, response_limit=100)
        with self.assertRaises(HTTPError):
            providers.NoRedirect().redirect_request(type('Request', (), {'full_url': 'https://official.example'})(),
                                                     None, 302, '', {}, 'https://unrelated.example')


if __name__ == '__main__':
    unittest.main()
