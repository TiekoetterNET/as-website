#!/usr/bin/env python3
"""Serve the site locally while substituting local copies for CDN assets."""

from __future__ import annotations

import argparse
import io
import mimetypes
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
ASSET_ROOT = Path(__file__).resolve().parent / "assets"
LOCAL_ASSET_PREFIX = "/__dev-assets/"
CDN_ASSET_PREFIX = b"https://tiekoetternet-cdn.tiekoetter.cloud/assets/as/"


class DevelopmentHandler(SimpleHTTPRequestHandler):
    """Serve repository files, hiding dot-paths and rewriting HTML asset URLs."""

    def send_head(self):  # noqa: ANN201 - signature is defined by the base class
        request_path = unquote(urlsplit(self.path).path)
        parts = Path(request_path).parts

        if any(part.startswith(".") for part in parts):
            self.send_error(404)
            return None

        if request_path.startswith(LOCAL_ASSET_PREFIX):
            filename = request_path.removeprefix(LOCAL_ASSET_PREFIX)
            return self._send_file(ASSET_ROOT, filename, rewrite_html=False)

        relative_path = request_path.lstrip("/")
        candidate = REPOSITORY_ROOT / relative_path
        if candidate.is_dir():
            relative_path = str(Path(relative_path) / "index.html")

        if relative_path.endswith(".html"):
            return self._send_file(REPOSITORY_ROOT, relative_path, rewrite_html=True)

        return super().send_head()

    def _send_file(self, root: Path, relative_path: str, *, rewrite_html: bool):
        root = root.resolve()
        path = (root / relative_path).resolve()

        if root not in path.parents or not path.is_file():
            self.send_error(404)
            return None

        data = path.read_bytes()
        if rewrite_html:
            data = data.replace(CDN_ASSET_PREFIX, LOCAL_ASSET_PREFIX.encode())

        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return io.BytesIO(data)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    handler = partial(DevelopmentHandler, directory=str(REPOSITORY_ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Serving AS208694 website at http://127.0.0.1:{args.port}/")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
