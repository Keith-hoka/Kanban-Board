# Database design

SQLite database for the Kanban MVP. Per the confirmed decisions in `docs/PLAN.md`: one board per user, stored as a JSON blob, with the schema modeled for multiple users even though MVP auth is hardcoded to one. Created automatically if absent.

## Engine and access

- **SQLite** via the Python stdlib `sqlite3` (no ORM - the board is a single JSON document, so there is nothing to normalize or query into).
- One short-lived connection per request. `PRAGMA foreign_keys = ON` per connection.
- JSON is stored as `TEXT` (serialized with `json.dumps`, parsed with `json.loads`). SQLite has no separate JSON type; we never query inside the blob, so `TEXT` is sufficient.

## File location and creation

- Default path: `backend/data/kanban.db`, overridable via the `DATABASE_PATH` env var.
- On startup the backend ensures the parent directory exists, connects (which creates the file if missing), runs `CREATE TABLE IF NOT EXISTS ...`, then seeds (below). This is idempotent and safe to run every boot.
- **Container persistence:** inside the `--rm` container the file is ephemeral. To survive `start.sh`/`stop.sh` cycles, Part 6/7 will mount a host volume at `backend/data` (or a named volume) and point `DATABASE_PATH` at it. Flagged here because Part 6's success criterion requires data to persist across restarts.

## Schema

```sql
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data       TEXT NOT NULL,                                -- BoardData as JSON
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- `users` is keyed by `username` (unique). MVP inserts exactly one row, `user`, but the table supports many. No password column: MVP credentials are hardcoded in the backend (see `app/auth.py`), so storing them would be dead data; a future real-auth part would add `password_hash` here.
- `boards.user_id` is `UNIQUE`, which enforces the one-board-per-user rule at the schema level. The whole board lives in `data`.

## Board JSON shape

`boards.data` holds exactly the frontend `BoardData` shape (`frontend/src/lib/kanban.ts`) so the same JSON flows end to end with no translation:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "..." }
  }
}
```

- `columns`: ordered array; each column has `id`, `title` (renameable), and an ordered `cardIds`.
- `cards`: map of card `id` -> `{ id, title, details }`. Card order and column membership are defined solely by `cardIds`.
- The backend validates this shape on write (Part 6) before persisting.

## Seeding

On startup, after table creation:

1. Ensure the `user` row exists (`INSERT ... ON CONFLICT(username) DO NOTHING`).
2. If that user has no `boards` row, insert one whose `data` is the default board - the same 5-column / 8-card seed as the frontend `initialData` in `frontend/src/lib/kanban.ts`. The seed JSON will live in the backend so it is self-contained.

Result: a fresh database always comes up with the demo board already populated for the hardcoded user.

## Out of scope for MVP

- Migrations/versioning (only `CREATE TABLE IF NOT EXISTS`).
- Multiple boards per user, sharing, real password storage.
