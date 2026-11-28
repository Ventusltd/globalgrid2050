"""Serve the accepted PipelineNews shell with its candidate renderer on localhost."""
import argparse
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import urlopen

from install import patch

ROOT = Path(__file__).resolve().parent
ORIGIN = "https://globalgrid2050.com"
EDITION = "/uk_renewables_pipeline/202611232245/"
RENDERER = EDITION + "scripts/plugins/projects-v9-8.js"
HELPER = "/automation/pipeline_legal_evidence/link.mjs"


class Preview(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/":
            self.send_response(302)
            self.send_header("Location", EDITION + "?technology=all&q=9873")
            self.end_headers()
            return
        if path == HELPER:
            self.send_bytes((ROOT / "link.mjs").read_bytes(), "application/javascript")
            return
        if not path.startswith(("/uk_renewables_pipeline/", "/automation/", "/dist/")) or ".." in path or "%" in path:
            self.send_error(404)
            return
        try:
            checkout = os.getenv("PIPELINE_CHECKOUT")
            local = Path(checkout) / path.lstrip("/") if checkout else None
            if local and local.is_dir():
                local = local / "index.html"
            if local and local.is_file():
                body = local.read_bytes()
                mime = mimetypes.guess_type(local.name)[0] or "application/octet-stream"
            else:
                with urlopen(ORIGIN + path, timeout=40) as response:
                    body = response.read(20_000_001)
                    if len(body) > 20_000_000:
                        raise ValueError("Upstream resource too large")
                    mime = response.headers.get_content_type()
            if path == RENDERER:
                body = patch(body.decode("utf-8")).encode("utf-8")
            self.send_bytes(body, mime)
        except HTTPError as exc:
            self.send_error(exc.code)
        except (URLError, TimeoutError, ValueError) as exc:
            self.send_error(502, str(exc))
        except (BrokenPipeError, ConnectionResetError):
            pass

    def send_bytes(self, body, mime):
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    with ThreadingHTTPServer(("127.0.0.1", args.port), Preview) as server:
        print(f"Open http://127.0.0.1:{args.port}/", flush=True)
        server.serve_forever()
