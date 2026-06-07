# Backend

Python FastAPI backend, managed by `uv`. It owns the `/api/*` routes and proxies every other path to the Next.js server, so FastAPI is the single entrypoint to the app.

## Layout

- `app/main.py` - the FastAPI app. Defines `GET /api/health`, wires `SessionMiddleware`, includes the auth and board routers, and ends with a catch-all `proxy_to_next` route forwarding non-`/api` requests to the Next server (`NEXT_INTERNAL_URL`, default `http://127.0.0.1:3000`). Unmatched `/api/*` paths return 404 rather than being proxied. The lifespan runs `db.init_db()` and manages a shared `httpx.AsyncClient`. Route registration order matters: the proxy catch-all must stay last.
- `app/auth.py` - cookie-session auth: `POST /api/login`, `POST /api/logout`, `GET /api/me`, plus the `require_user` dependency (returns the session username or raises 401). MVP credentials are hardcoded (`USERNAME`/`PASSWORD`).
- `app/board.py` - `GET /api/board` and `PUT /api/board` (auth-gated via `require_user`). The `BoardData` Pydantic model validates writes (mirrors the frontend shape; invalid input -> 422).
- `app/db.py` - SQLite access (stdlib `sqlite3`). `init_db()` creates the schema if absent and seeds the default board; `get_board`/`save_board` read/upsert a user's board JSON. Path from `DATABASE_PATH` (default `backend/data/kanban.db`), read at call time. See `docs/DATABASE.md`.
- `app/seed.py` - `DEFAULT_BOARD`, mirroring the frontend `initialData`.
- `app/ai.py` - OpenRouter client (`chat`, `message_text`, `AIError`) for model `openai/gpt-oss-120b`, plus `POST /api/ai/ping` (auth-gated smoke test). Loads `OPENROUTER_API_KEY` from the root `.env`; pins `provider` routing (see `docs/AI.md`).
- `app/chat.py` - `POST /api/chat` (auth-gated). Sends the board + history + message, requests `{reply, board_update}` structured output, validates any `board_update` (shape + referential integrity), persists it, and returns `{reply, board, boardUpdated}`. The model does not strictly honor json_schema, so it uses a firm prompt + tolerant `_extract_json` + retry; invalid updates are ignored so the board is never corrupted. History is client-supplied (stateless backend). See `docs/AI.md`.
- `tests/` - `pytest` (`test_health.py`, `test_auth.py`, `test_board.py`). `conftest.py` has an autouse `temp_db` fixture pointing each test at an isolated SQLite file, and a `client` fixture.
- `pyproject.toml` - dependencies and pytest config (`pythonpath = ["."]` so `app` imports work).

The AI chat route (Parts 8-9) will live under `/api/*` in this app.

## Commands

```bash
uv sync                                              # install deps (creates .venv + uv.lock)
uv run uvicorn app.main:app --reload --port 8000     # run locally (needs Next on :3000 for non-api paths)
uv run pytest                                        # run tests
```

`NEXT_INTERNAL_URL` overrides the proxied Next address. In the container the entrypoint runs Next on `127.0.0.1:3000` and uvicorn on `0.0.0.0:8000`.
