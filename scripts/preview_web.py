"""Loopback-only preview of the hosted mode, with a browser-owned workspace."""
import argparse
import sys
from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIServer, WSGIRequestHandler, make_server

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web_app import WebApplication


class Server(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    origin = f"http://ariadne.localhost:{args.port}"
    application = WebApplication([origin])
    with make_server("127.0.0.1", args.port, application, Server, QuietHandler) as server:
        print(f"网页版本地预览：{origin}（仅本机可访问；资料独立存于此浏览器地址）", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
