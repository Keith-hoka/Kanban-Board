import logging
import os
import secrets
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response
from starlette.middleware.sessions import SessionMiddleware

from app import ai, auth, board, chat, db

# Internal address of the Next.js server that FastAPI proxies to.
NEXT_INTERNAL_URL = os.environ.get("NEXT_INTERNAL_URL", "http://127.0.0.1:3000")

# Secret for signing the session cookie. Never ship a hardcoded default: if the
# env var is unset, use a random per-process secret. Logins then do not survive a
# restart, which is fine for the MVP; set SESSION_SECRET in .env to persist them.
SESSION_SECRET = os.environ.get("SESSION_SECRET")
if not SESSION_SECRET:
    SESSION_SECRET = secrets.token_hex(32)
    logging.getLogger("uvicorn.error").warning(
        "SESSION_SECRET not set; using a random secret. Sessions will reset on "
        "restart. Set SESSION_SECRET in .env to persist logins."
    )

# Mark the session cookie Secure when served over HTTPS. Default off for local HTTP.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")

# Hop-by-hop headers that must not be forwarded when proxying.
_EXCLUDED_RESPONSE_HEADERS = {
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    app.state.next_client = httpx.AsyncClient(base_url=NEXT_INTERNAL_URL, timeout=30.0)
    ai_client = httpx.AsyncClient(timeout=60.0)
    ai.set_client(ai_client)
    yield
    ai.set_client(None)
    await ai_client.aclose()
    await app.state.next_client.aclose()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",
    https_only=COOKIE_SECURE,
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(board.router)
app.include_router(ai.router)
app.include_router(chat.router)


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy_to_next(path: str, request: Request):
    # The backend owns /api/*; anything unmatched there is a real 404, not a page.
    if path == "api" or path.startswith("api/"):
        return Response(status_code=404)

    client: httpx.AsyncClient = request.app.state.next_client
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}

    upstream = await client.request(
        request.method,
        "/" + path,
        params=request.query_params,
        headers=headers,
        content=await request.body(),
    )

    response_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in _EXCLUDED_RESPONSE_HEADERS
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
    )
