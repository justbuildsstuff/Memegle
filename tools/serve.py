"""Tiny dev server with correct MIME types (Windows' python -m http.server serves .js as text/plain).

    python tools/serve.py [port]
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(ROOT)

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({
    ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
    ".svg": "image/svg+xml", ".css": "text/css", ".html": "text/html", ".webp": "image/webp",
})

if __name__ == "__main__":
    print(f"Memegle dev server: http://localhost:{PORT}/")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
