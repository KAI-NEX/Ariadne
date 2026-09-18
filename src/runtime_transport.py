"""Request-local platform transport; the local Python server keeps urllib."""
from contextvars import ContextVar

PROVIDER_HTTP_OPEN = ContextVar("ariadne_provider_http_open", default=None)
