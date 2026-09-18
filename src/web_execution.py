"""Bounded, ephemeral request state for the public BYOK service.

The namespace binds a random browser session AND its request credential. Neither
the credential nor career material is written to disk. Expiry never interrupts
an in-flight request. One process is required until a shared registry is added.
"""
from __future__ import annotations

import hashlib
import json
import threading
import time
from contextlib import contextmanager

from src.candidate_model_runtime import CandidateModelExecutionRegistry
from src.candidate_conversation_runtime import CandidateConversationExecutionRegistry


class WebBoundaryError(Exception):
    def __init__(self, code, status=400):
        self.code, self.status = code, status
        super().__init__(code)


class ImportRegistry(CandidateModelExecutionRegistry):
    MAX_OPERATIONS = 128
    MAX_RESULT_BYTES = 1_000_000

    def __init__(self):
        super().__init__()
        self._budget_lock = threading.Lock()
        self._result_bytes = 0
        self._receipts = set()

    def begin(self, operation_id, source_document_id):
        with self._budget_lock:
            if operation_id in self._receipts and operation_id not in self._completed:
                raise WebBoundaryError("WEB_RESULT_EXPIRED_REVIEW_BEFORE_RETRY", 409)
            if operation_id not in self._source_by_operation and len(set(self._source_by_operation) | self._receipts) >= self.MAX_OPERATIONS:
                raise WebBoundaryError("WEB_SESSION_OPERATION_LIMIT", 429)
            return super().begin(operation_id, source_document_id)

    def succeed(self, operation_id, result):
        with self._budget_lock:
            size = len(json.dumps(result).encode())
            self._receipts.add(operation_id)
            if self._result_bytes + size > self.MAX_RESULT_BYTES:
                # Return this result once, but keep a receipt so an automatic
                # replay cannot produce a second paid inference.
                with self._lock:
                    self._active.discard(operation_id)
                    invalid = operation_id in self._invalidated
                    self._invalidated.discard(operation_id)
                return not invalid
            accepted = super().succeed(operation_id, result)
            if accepted:
                self._result_bytes += size
            return accepted


class SessionState:
    def __init__(self, now):
        self.last_used, self.active = now, 0
        self.registries = {
            "CANDIDATE_MODEL_EXECUTIONS": ImportRegistry(),
            "JOB_MODEL_IMPORT_EXECUTIONS": ImportRegistry(),
            "CANDIDATE_CONVERSATION_EXECUTIONS": CandidateConversationExecutionRegistry(),
            "JOB_CONVERSATION_EXECUTIONS": CandidateConversationExecutionRegistry(),
        }
        self.requests = {}
        self.lock = threading.Lock()

    def bind_request(self, path, payload):
        declared = payload.get("operation_identity")
        identity = declared.get("operation_id") if isinstance(declared, dict) else None
        if not isinstance(identity, str) or not identity:
            return
        fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).digest()
        with self.lock:
            key = (path, identity)
            if key in self.requests and self.requests[key] != fingerprint:
                raise WebBoundaryError("WEB_OPERATION_CONTENT_CONFLICT", 409)
            if key not in self.requests and len(self.requests) >= 256:
                raise WebBoundaryError("WEB_SESSION_OPERATION_LIMIT", 429)
            self.requests[key] = fingerprint


class Sessions:
    def __init__(self, *, maximum=32, ttl=1800, clock=time.monotonic):
        self.maximum, self.ttl, self.clock = maximum, ttl, clock
        self.lock = threading.Lock()
        self.states = {}

    @contextmanager
    def acquire(self, session, credential, *, provider="deepseek", control=False):
        namespace = hashlib.sha256((session + "\0" + provider + "\0" + credential).encode()).digest()
        with self.lock:
            now = self.clock()
            self.states = {key: value for key, value in self.states.items()
                           if value.active or now - value.last_used < self.ttl}
            if namespace not in self.states:
                if len(self.states) >= self.maximum:
                    raise WebBoundaryError("WEB_SERVICE_BUSY", 503)
                self.states[namespace] = SessionState(now)
            state = self.states[namespace]
            if state.active >= 2 and not control:
                raise WebBoundaryError("WEB_SESSION_BUSY", 429)
            state.active += 1
        try:
            yield state
        finally:
            with self.lock:
                state.active -= 1
                state.last_used = self.clock()
                retained = any(getattr(registry, field, None) for registry in state.registries.values()
                               for field in ("_active", "_completed", "_receipts", "_cancelled"))
                # Invalid keys, discovery and empty control requests must not
                # occupy every session slot for the full idle lifetime.
                if not state.active and not retained:
                    self.states.pop(namespace, None)
