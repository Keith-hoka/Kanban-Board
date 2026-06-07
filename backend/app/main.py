import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response
from starlette.middleware.sessions import SessionMiddleware

from app import ai, auth, board, chat, db

# Internal address of the Next.js server that FastAPI proxies to.
NEXT_INTERNAL_URL = os.environ.get("NEXT_INTERNAL_URL", "http://127.0.0.1:3000")

# Secret for signing the session cookie. Override in production via env.
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-insecure-secret-change-me")

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
    yield
    await app.state.next_client.aclose()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",
    https_only=False,
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
