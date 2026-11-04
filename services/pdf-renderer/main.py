"""
S Learning PDF page renderer.

Your Next.js server calls POST /render/page with a short-lived signed PDF URL and a
page number. This service downloads the PDF (only from allowed hosts), renders that
ONE page to a JPEG and returns it. The browser never talks to this service.

Environment variables (set them on Render, never in code):
  PDF_RENDERER_TOKEN   required  shared secret, same value as in Vercel
  ALLOWED_PDF_HOSTS    required  comma list of storage hosts, e.g. abc.supabase.co
  MAX_PDF_MB           optional  default 200
  ALLOW_INSECURE_HTTP  optional  set to 1 ONLY for local testing
"""
import hashlib
import hmac
import os
import pathlib
import tempfile
import time
from urllib.parse import urlparse

import httpx
import pymupdf
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

TOKEN = os.environ.get("PDF_RENDERER_TOKEN", "")
ALLOWED = [h.strip().lower() for h in os.environ.get("ALLOWED_PDF_HOSTS", "").split(",") if h.strip()]
MAX_BYTES = int(os.environ.get("MAX_PDF_MB", "200")) * 1024 * 1024
ALLOW_HTTP = os.environ.get("ALLOW_INSECURE_HTTP") == "1"
MAX_WIDTH = 1600          # pixels, hard ceiling
CACHE_SECONDS = 600       # private PDFs are deleted from this server after 10 minutes
CACHE_DIR = pathlib.Path(tempfile.gettempdir()) / "pdf-renderer-cache"

app = FastAPI(title="S Learning PDF renderer")


class RenderRequest(BaseModel):
    pdf_url: str
    page: int = Field(ge=1)               # 1-based
    width: int = Field(default=1100, ge=200)
    doc_id: str | None = None             # lets repeat page requests reuse the download


def require_token(authorization: str | None):
    if not TOKEN:
        raise HTTPException(503, "Renderer is not configured")
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(supplied.encode(), TOKEN.encode()):
        raise HTTPException(401, "Unauthorized")


def check_url(url: str):
    u = urlparse(url)
    if u.scheme != "https" and not (ALLOW_HTTP and u.scheme == "http"):
        raise HTTPException(400, "PDF URL must use https")
    host = (u.hostname or "").lower()
    if not ALLOWED or not any(host == h or host.endswith("." + h) for h in ALLOWED):
        raise HTTPException(403, "PDF host is not allowed")
    return u


def clean_cache():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    now = time.time()
    for f in CACHE_DIR.glob("*"):
        try:
            if now - f.stat().st_mtime > CACHE_SECONDS:
                f.unlink()
        except OSError:
            pass


def fetch_pdf(req: RenderRequest) -> pathlib.Path:
    u = check_url(req.pdf_url)
    clean_cache()
    key = hashlib.sha256((req.doc_id or f"{u.netloc}{u.path}").encode()).hexdigest()
    path = CACHE_DIR / f"{key}.pdf"
    if path.exists():
        return path

    tmp = CACHE_DIR / f"{key}.{os.getpid()}.part"
    size = 0
    try:
        with httpx.Client(timeout=30, follow_redirects=False) as c, c.stream("GET", req.pdf_url) as r:
            if r.status_code != 200:
                raise HTTPException(502, "Could not fetch the PDF")
            with open(tmp, "wb") as out:
                for chunk in r.iter_bytes(1024 * 256):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, "PDF is too large")
                    out.write(chunk)
        os.replace(tmp, path)
    except httpx.HTTPError:
        raise HTTPException(502, "Could not fetch the PDF")
    finally:
        tmp.unlink(missing_ok=True)
    return path


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/render/status")
def status(authorization: str | None = Header(default=None)):
    require_token(authorization)
    return {"ok": True, "pymupdf": pymupdf.__version__, "allowed_hosts": len(ALLOWED)}


@app.post("/render/page")
def render_page(req: RenderRequest, authorization: str | None = Header(default=None)):
    require_token(authorization)
    path = fetch_pdf(req)
    try:
        doc = pymupdf.open(path)
    except Exception:
        path.unlink(missing_ok=True)  # drop a bad download so the next try re-fetches
        raise HTTPException(422, "Cannot open this PDF")
    with doc:
        if doc.needs_pass:
            raise HTTPException(422, "PDF is password protected")
        if req.page > len(doc):
            raise HTTPException(400, f"Page out of range (PDF has {len(doc)} pages)")
        page = doc[req.page - 1]
        zoom = min(req.width, MAX_WIDTH) / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        data = pix.tobytes("jpg", jpg_quality=75)
    return Response(content=data, media_type="image/jpeg",
                    headers={"Cache-Control": "private, max-age=3600"})