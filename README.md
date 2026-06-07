# Kanban Studio

A single-board Kanban web app with sign in and an AI chat assistant that can create, move, and edit cards. Runs locally in one Docker container.

## Features

- Cookie-based sign in (MVP credentials are hardcoded: `user` / `password`)
- Drag-and-drop board: rename columns, add/edit/move/delete cards
- Persistent storage (SQLite)
- AI chat sidebar that edits the board, with the board refreshing automatically

## Stack

- Frontend: Next.js, React, Tailwind CSS
- Backend: Python FastAPI (serves the API and proxies the Next.js server), managed with `uv`
- Database: SQLite
- AI: OpenRouter (`openai/gpt-oss-120b`)
- Packaging: a single Docker container

## Run

Requires Docker. For the AI features, put an `OPENROUTER_API_KEY` in a `.env` file at the project root.

```bash
./scripts/start.sh      # build and run, then open http://localhost:8000
./scripts/stop.sh
```

On Windows use `scripts/start.ps1` and `scripts/stop.ps1`. Sign in with `user` / `password`.

## Tests

```bash
# backend
cd backend && uv run pytest

# frontend
cd frontend && npm install
npm run test:unit
npm run test:e2e        # end-to-end; start the app first (see E2E_BASE_URL in frontend/AGENTS.md)
```

## Layout

- `frontend/` - Next.js app (see `frontend/AGENTS.md`)
- `backend/` - FastAPI app (see `backend/AGENTS.md`)
- `scripts/` - start/stop scripts and the container entrypoint
- `docs/` - build plan (`PLAN.md`), database design (`DATABASE.md`), AI notes (`AI.md`)
