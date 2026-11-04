"""Private HTTP service that renders and caches individual PDF pages."""

import hashlib
import hmac
import json
import os
import threading
import urllib.request
from urllib.error import HTTPError
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

import pymupdf

MAX_PDF_BYTES = 50 * 1024 * 1024
MAX_PAGE_CACHE_BYTES = 128 * 1024 * 1024
RENDER_ZOOM = 1.5
TOKEN = os.environ.get("PDF_RENDERER_TOKEN", "")
HOST = os.environ.get("PDF_RENDERER_HOST", "127.0.0.1")
PORT = int(os.environ.get("PDF_RENDERER_PORT", "8787"))
SUPABASE_HOST = urlsplit(os.environ.get("SUPABASE_URL", "")).hostname
LOCK = threading.RLock()
PDF_CACHE = OrderedDict()
PDF_CACHE_BYTES = 0
PAGE_CACHE = OrderedDict()
PAGE_CACHE_BYTES = 0


def source_key(url):
    parsed = urlsplit(url)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.hostname != SUPABASE_HOST
        or not parsed.path.startswith("/storage/v1/object/sign/private-files/")
        or not parsed.query
        or parsed.username
        or parsed.password
    ):
        raise ValueError("PDF URL must be a signed private-files URL from the configured Supabase project.")
    return hashlib.sha256(f"{parsed.netloc}{parsed.path}".encode()).hexdigest()


class SameHostRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        source_key(new_url)
        return super().redirect_request(request, file_pointer, code, message, headers, new_url)


def load_pdf(url, key):
    global PDF_CACHE_BYTES
    with LOCK:
        cached = PDF_CACHE.get(key)
        if cached is not None:
            PDF_CACHE.move_to_end(key)
            return cached

    request = urllib.request.Request(url, headers={"Accept": "application/pdf"})
    opener = urllib.request.build_opener(SameHostRedirect())
    with opener.open(request, timeout=60) as response:
        data = response.read(MAX_PDF_BYTES + 1)
    if not data or len(data) > MAX_PDF_BYTES or not data.startswith(b"%PDF-"):
        raise ValueError("PDF is empty, oversized, or invalid.")

    with LOCK:
        existing = PDF_CACHE.pop(key, None)
        if existing:
            PDF_CACHE_BYTES -= len(existing)
        while PDF_CACHE and PDF_CACHE_BYTES + len(data) > MAX_PDF_BYTES:
            _, evicted = PDF_CACHE.popitem(last=False)
            PDF_CACHE_BYTES -= len(evicted)
        PDF_CACHE[key] = data
        PDF_CACHE_BYTES += len(data)
    return data


def render_page(url, page_number):
    global PAGE_CACHE_BYTES
    key = source_key(url)
    cache_key = (key, page_number)
    with LOCK:
        image = PAGE_CACHE.get(cache_key)
        if image is not None:
            PAGE_CACHE.move_to_end(cache_key)
            return image

    pdf_data = load_pdf(url, key)
    with pymupdf.open(stream=pdf_data, filetype="pdf") as document:
        if document.needs_pass:
            raise ValueError("Password-protected PDFs cannot be previewed.")
        if page_number < 1 or page_number > len(document):
            raise IndexError("Requested page does not exist.")
        pixmap = document[page_number - 1].get_pixmap(
            matrix=pymupdf.Matrix(RENDER_ZOOM, RENDER_ZOOM),
            alpha=False,
        )
        image = pixmap.tobytes("png")

    with LOCK:
        existing = PAGE_CACHE.pop(cache_key, None)
        if existing:
            PAGE_CACHE_BYTES -= len(existing)
        while PAGE_CACHE and PAGE_CACHE_BYTES + len(image) > MAX_PAGE_CACHE_BYTES:
            _, evicted = PAGE_CACHE.popitem(last=False)
            PAGE_CACHE_BYTES -= len(evicted)
        if len(image) <= MAX_PAGE_CACHE_BYTES:
            PAGE_CACHE[cache_key] = image
            PAGE_CACHE_BYTES += len(image)
    return image


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/render":
            self.send_error(404)
            return
        supplied = self.headers.get("Authorization", "")
        if not TOKEN or not hmac.compare_digest(supplied, f"Bearer {TOKEN}"):
            self.send_error(401)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 16 * 1024:
                raise ValueError("Invalid request size.")
            payload = json.loads(self.rfile.read(length))
            pdf_url = payload.get("url")
            page_number = payload.get("page")
            if not isinstance(pdf_url, str) or not isinstance(page_number, int) or isinstance(page_number, bool):
                raise ValueError("A signed PDF URL and page number are required.")
            image = render_page(pdf_url, page_number)
        except IndexError as error:
            self.send_error(404, str(error))
            return
        except Exception as error:
            message = str(error) or "PDF page could not be rendered."
            encoded = json.dumps({"error": message}).encode()
            self.send_response(422)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(encoded)
            return

        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(image)))
        self.send_header("Cache-Control", "private, max-age=300")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(image)

    def log_message(self, fmt, *args):
        print(f"PDF renderer: {fmt % args}")


def main():
    if len(TOKEN) < 32:
        raise SystemExit("Set PDF_RENDERER_TOKEN to a random secret of at least 32 characters.")
    if not SUPABASE_HOST:
        raise SystemExit("Set SUPABASE_URL to the Supabase project URL.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"PDF page renderer listening on {HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
