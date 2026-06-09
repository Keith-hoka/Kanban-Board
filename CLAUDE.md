# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

A completed Project Management MVP: a single-board Kanban web app with hardcoded sign-in and an AI chat sidebar that can edit the board, running locally in one Docker container. All 10 parts of `docs/PLAN.md` are done. The frontend is fully wired to a FastAPI backend over `/api/*` — the original in-memory demo state has been replaced by real API calls. Read `docs/PLAN.md` and the per-area `AGENTS.md` files (root, `frontend/`, `backend/`, `scripts/`) before changing things.

## Architecture

- **Serving**: the **Next.js server runs behind FastAPI** in one container. FastAPI owns `/api/*`; the `proxy_to_next` catch-all in `backend/app/main.py` forwards every other path to the Next server (default `http://127.0.0.1:3000`) and must stay registered last. Two processes, one container.
- **Backend**: Python FastAPI, `uv` package manager, `pytest`. Module-by-module layout is documented in `backend/AGENTS.md`: `auth.py` (cookie-session login, hardcoded `user`/`password`, `require_user` dep), `board.py` (`GET`/`PUT /api/board`, Pydantic validation), `db.py` (stdlib `sqlite3`), `ai.py` + `chat.py` (OpenRouter).
- **Packaging**: single Docker container, run locally. `scripts/start.*` and `scripts/stop.*` cover Mac/Linux (`.sh`) and Windows (`.ps1`); `scripts/docker-entrypoint.sh` runs Next in the background and uvicorn in the foreground.
- **Database**: SQLite, created and seeded on first run if absent. One JSON-blob row per user holds the whole board (not normalized); the DB is modeled for multiple users though the MVP has one. Path from `DATABASE_PATH` (default `backend/data/kanban.db`). See `docs/DATABASE.md`.
- **AI**: OpenRouter, model `openai/gpt-oss-120b`, key from `OPENROUTER_API_KEY` in root `.env`. `POST /api/chat` sends the board + history + message and requests a structured `{reply, board_update}`. The model does not strictly honor `json_schema`, so the backend uses a firm prompt + tolerant JSON extraction + retry, and validates any `board_update` (shape + referential integrity), ignoring invalid ones so the board is never corrupted. See `docs/AI.md`.

## Frontend architecture

The board is a pure-function state model, deliberately kept simple:

- `src/lib/kanban.ts` — the data model (`BoardData` = `columns: Column[]` + `cards: Record<id, Card>`) plus pure helpers `moveCard`, `normalizeBoard`, `createId`, and the `initialData` seed. All drag/reorder logic lives in `moveCard` (same-column reorder, cross-column move, drop onto an empty column). The shape mirrors the backend `BoardData` in `backend/app/board.py` (and the AI variant in `chat.py`) — keep them in sync. Framework-agnostic and the most heavily unit-tested file.
- `src/lib/api.ts` — fetch client for `/api/*` (`getMe`/`login`/`logout`, `getBoard`/`saveBoard`, `sendChat`); runs boards from the server and the AI through `normalizeBoard` before use.
- `src/components/AuthGate.tsx` — top-level gate: checks `/api/me`, then renders `LoginForm` or `BoardContainer`.
- `src/components/BoardContainer.tsx` — loads the board and owns persistence: a debounced full-board `PUT` (500ms after the last edit), a flush before each chat send, and applying AI board updates without re-saving (the server already persisted them).
- `src/components/KanbanBoard.tsx` — the board UI plus every mutation handler (add/delete/move card, rename column, add/delete column) and dnd-kit's `DndContext`. Receives `initialBoard`/`onChange` from `BoardContainer`; it syncs an externally-replaced board (e.g. an AI edit) via an effect rather than remounting, so the chat sidebar's state survives a refresh.
- `KanbanColumn` / `KanbanCard` / `KanbanCardPreview` / `CardContent` / `NewCardForm` / `ChatSidebar` — presentational; they receive data and callbacks as props and own no board state.

Path alias `@/` maps to `frontend/src/`.

## Commands

Run from `frontend/`:

```bash
npm install
npm run dev              # Next dev server
npm run build            # production build
npm run lint             # eslint

npm run test:unit                       # vitest, all unit tests
npx vitest run src/lib/kanban.test.ts   # a single unit test file
npm run test:unit:watch                 # vitest watch mode
npm run test:e2e                        # playwright (auto-starts dev server on :3000)
npm run test:all                        # unit then e2e
```

Vitest covers `src/**/*.{test,spec}.{ts,tsx}` (jsdom); Playwright specs live in `frontend/tests/` and are excluded from vitest.

Run from `backend/`:

```bash
uv sync                                            # install deps (.venv + uv.lock)
uv run uvicorn app.main:app --reload --port 8000   # run locally (needs Next on :3000 for non-api paths)
uv run pytest                                      # run tests
```

Run from the repo root to build and run the whole app in Docker:

```bash
scripts/start.sh         # build + run the container (start.ps1 on Windows)
scripts/stop.sh          # stop and remove it (stop.ps1 on Windows)
```

## Coding standards (from AGENTS.md)

- Use current, idiomatic library versions and approaches.
- Keep it simple. Do not over-engineer, do not add unnecessary defensive programming, do not add unrequested features. Simplicity over everything.
- Be concise; keep docs minimal. **No emojis, ever.**
- When hitting an issue, find the root cause with evidence before fixing. Do not guess.
- Planning/execution docs live in `docs/`.

## Brand colors

Accent Yellow `#ecad0a` (highlights), Blue Primary `#209dd7` (links/key sections), Purple Secondary `#753991` (submit buttons/important actions), Dark Navy `#032147` (headings), Gray Text `#888888` (labels). Exposed as CSS vars (e.g. `--accent-yellow`, `--primary-blue`, `--navy-dark`) in `globals.css`.
