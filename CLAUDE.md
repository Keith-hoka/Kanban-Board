# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

A Project Management MVP web app being built in 10 parts per `docs/PLAN.md`. Read that plan before starting work — each part has substeps to check off and success criteria.

Currently the `frontend/` holds a working, frontend-only Kanban demo with no backend wiring; `docs/PLAN.md` is now a detailed checklist-driven plan (Part 1 done, awaiting/after user approval). The `backend/`, `scripts/`, and Docker pieces are planned but not yet built. When implementing later parts, the demo's in-memory state must be replaced with backend API calls. `frontend/AGENTS.md` describes the existing frontend in detail.

## Target architecture (planned)

- **Serving**: the **Next.js server runs behind FastAPI** in one container. FastAPI owns `/api/*` and proxies all other paths to the Next server (two processes, one container). This was chosen over a static export.
- **Backend**: Python FastAPI, `uv` package manager, `pytest` for tests.
- **Packaging**: single Docker container, run locally. Start/stop scripts for Mac/PC/Linux go in `scripts/`.
- **Database**: local SQLite, created on first run if absent. Schema stores the Kanban as JSON. Sign-in is hardcoded (`user`/`password`) but the DB is modeled for multiple users; one board per user for the MVP.
- **AI**: OpenRouter, model `openai/gpt-oss-120b`, key from `OPENROUTER_API_KEY` in root `.env`. The AI chat sidebar sends the board JSON + conversation and returns Structured Outputs with a user reply and an optional board update that auto-refreshes the UI.

## Frontend architecture

The board is a pure-function state model, deliberately kept simple:

- `src/lib/kanban.ts` — the data model (`BoardData` = `columns: Column[]` + `cards: Record<id, Card>`) plus pure helpers `moveCard`, `createId`, and `initialData` seed. All drag/reorder logic lives in `moveCard` (handles same-column reorder, cross-column move, and drops onto an empty column). This file is framework-agnostic and is the most heavily unit-tested.
- `src/components/KanbanBoard.tsx` — the single source of truth. Owns all board state via `useState(initialData)` and holds every mutation handler (add/delete/move card, rename column). Wraps the columns in dnd-kit's `DndContext`. This is where backend persistence will hook in.
- `KanbanColumn` / `KanbanCard` / `KanbanCardPreview` / `NewCardForm` — presentational; they receive data and callbacks as props and own no board state.

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

## Coding standards (from AGENTS.md)

- Use current, idiomatic library versions and approaches.
- Keep it simple. Do not over-engineer, do not add unnecessary defensive programming, do not add unrequested features. Simplicity over everything.
- Be concise; keep docs minimal. **No emojis, ever.**
- When hitting an issue, find the root cause with evidence before fixing. Do not guess.
- Planning/execution docs live in `docs/`.

## Brand colors

Accent Yellow `#ecad0a` (highlights), Blue Primary `#209dd7` (links/key sections), Purple Secondary `#753991` (submit buttons/important actions), Dark Navy `#032147` (headings), Gray Text `#888888` (labels). Exposed as CSS vars (e.g. `--accent-yellow`, `--primary-blue`, `--navy-dark`) in `globals.css`.
