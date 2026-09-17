"""One process preserves in-memory cancellation/idempotency boundaries."""
import os

bind = "0.0.0.0:" + os.environ.get("PORT", "8080")
workers = 1
worker_class = "gthread"
threads = 8
timeout = 300
graceful_timeout = 300
keepalive = 5
limit_request_line = 4094
limit_request_fields = 40
limit_request_field_size = 4094
accesslog = None
errorlog = "-"
loglevel = "warning"
capture_output = False
forwarded_allow_ips = ""
