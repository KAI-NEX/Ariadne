"""Run the optional web-to-local connector. Stop this process to revoke access."""
import argparse
import os
from pathlib import Path
import sys
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", default="https://web.ariadne.kai-nex.com")
    args = parser.parse_args()
    from src.local_connector import Pairing, connector_handler
    pairing = Pairing(args.origin)
    os.environ["ARIADNE_CODEX_ENABLED"] = "1"
    from app import JobRadarHandler
    server = ThreadingHTTPServer(("127.0.0.1", 8765), connector_handler(JobRadarHandler))
    server.pairing = pairing
    print(f"Ariadne connector: http://127.0.0.1:8765\nAllowed origin: {pairing.origin}\n"
          f"One-use pairing code (5 minutes): {pairing.code}\n"
          "Enter the code on the web workspace's Connect local Codex page. Stop with Ctrl+C to revoke.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        pairing.revoke(); server.server_close()


if __name__ == "__main__":
    main()
