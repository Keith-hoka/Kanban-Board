# Code review

Comprehensive review of the Kanban Studio repo as of 2026-06-08. Scope: backend (`backend/app`), frontend (`frontend/src`), Docker/scripts, tests, and config.

Overall this is a clean, well-tested MVP: clear module boundaries, strong test coverage (backend 22 pytest, frontend 24 vitest + 9 Playwright), secrets are gitignored, and the AI integration has thoughtful server-side validation. Most findings below are hardening/maintainability items rather than functional bugs. Severity reflects the stated context (a single-user MVP that runs locally); items marked "before deploy" become higher priority if this is ever hosted.

## Priority action checklist

P1 - should fix (all DONE 2026-06-08)
- [x] A1. Harden the session secret: removed the hardcoded default; `main.py` now uses a random per-process secret when `SESSION_SECRET` is unset and logs a warning. (Security)
- [x] A2. Restrict chat `history` roles to `user`/`assistant` (`ChatMessage.role` is now a `Literal`); invalid roles 422. (Security)
- [x] A3. `ai.message_text` rejects non-string/null content as `AIError`, so a refusal flows to the retry/clean-502 path instead of a 500. (Robustness)
- [x] A4. Added `validate_board_integrity` in `board.py`; both `PUT /api/board` and the AI chat path use it. (Robustness + dedup)

Tests added: null-content -> AIError (`test_ai.py`); chat null-content -> 502 and bad-role -> 422 (`test_chat.py`); PUT rejects missing-reference / key-id mismatch / duplicate placement (`test_board.py`). Backend now 28 pytest, e2e 9 - all green.

P2 - nice to have (all DONE 2026-06-08)
- [x] A5. Cookie `https_only` is now driven by the `COOKIE_SECURE` env var (default off for local HTTP, set true behind HTTPS). (`main.py`)
- [x] A6. The redundant post-AI-update save is suppressed: `BoardContainer` flags the AI-applied board so the resulting `onChange` is not re-saved. Test added in `BoardContainer.test.tsx`.
- [x] A7. Blocking SQLite is off the event loop: `GET`/`PUT /api/board` are sync handlers (FastAPI threadpool); `/api/chat` wraps `db` calls in `run_in_threadpool`.
- [x] A8. The container runs as the non-root `node` user; the data dir is pre-created and chowned so the mounted volume inherits its ownership. Verified: `whoami` -> `node`, DB file owned by uid 1000, writes succeed.

P3 - optional / later (all DONE 2026-06-08)
- [x] A9. Next `output: "standalone"`; the Dockerfile copies only `.next/standalone` + static + public and starts via `node server.js`. Image shrank from ~2.28GB to ~775MB; page, static assets, e2e, and live chat all verified.
- [x] A10. Cross-documented the board shape: linking comments now connect the FE type (`kanban.ts`), the BE Pydantic model (`board.py`), and the AI array variant (`chat.py`). Full code-dedup was deliberately not done - the shapes span two languages, and generating the strict json_schema from Pydantic needs more post-processing (additionalProperties/required) than the explicit schema, so it would add complexity, not remove it.
- [x] A11. AI calls reuse a lifespan-managed httpx client (`ai.set_client`), falling back to a one-off client for direct callers (tests) to avoid cross-event-loop reuse.

---

## Security

### S1 (P1) Default session secret is insecure
`backend/app/main.py:14` - `SESSION_SECRET` falls back to `"dev-insecure-secret-change-me"`. If the app ever runs without the env var set (including the current container, since `.env` need not contain it), session cookies are signed with a public constant and can be forged, defeating auth.
Action: read the secret with no default; if unset, generate a random per-process secret (sessions don't survive restart, which is fine for MVP) or refuse to start when a `PRODUCTION`/`ENV` flag is set. Document `SESSION_SECRET` in `.env` alongside `OPENROUTER_API_KEY`.

### S2 (P1) Chat history roles are unconstrained
`backend/app/chat.py:78-80` - `ChatMessage.role` is a free `str`, and `chat()` forwards each history item straight into the model messages (`chat.py:147`). A crafted client can send `{"role": "system", "content": "..."}` to steer the model. Single-user MVP limits the blast radius (you can only manipulate your own board), but it is an easy hole to close.
Action: type `role` as `Literal["user", "assistant"]` (Pydantic will 422 anything else), or coerce unknown roles to `"user"`.

### S3 (P2, before deploy) Cookie is not marked Secure
`backend/app/main.py:34-39` - `https_only=False` is correct for local HTTP, but over HTTPS the session cookie should carry `Secure`. `same_site="lax"` is reasonable.
Action: drive `https_only` from an env flag (e.g. `COOKIE_SECURE`), defaulting false locally and true in production.

### S4 (P2, before deploy) Container runs as root
`Dockerfile` - the runtime stage never switches users, so the app (and the proxied Next process) run as root.
Action: create and `USER` a non-root account in the runtime image; ensure `/app/backend/data` (the volume mount) is writable by it.

### S5 (P3) No rate limiting on the AI endpoint
`/api/chat` and `/api/ai/ping` call a paid API with no throttling. With one hardcoded local user this is low risk, but worth noting before any multi-user or hosted use.

### Positive
- `.env` is gitignored and untracked (verified); no secrets in the 75 tracked files.
- Auth is cookie-session based with an `httponly` signed cookie and a clean `require_user` dependency.
- The proxy correctly strips hop-by-hop headers (`main.py:17-22`), avoiding the classic gzip double-decode bug.

---

## Correctness & robustness

### R1 (P1) Null AI content causes an unhandled 500
`backend/app/ai.py:60-65` - `message_text` returns `data["choices"][0]["message"]["content"]`, which can be JSON `null` (e.g. a refusal). `chat.py:130` then calls `_extract_json(None)` -> `None.strip()` -> `AttributeError`, which `_ask_model`'s `except (AIError, JSONDecodeError)` does not catch, surfacing a raw 500. `ai.py:78` (`message_text(data).strip()`) has the same exposure in `ping`.
Action: in `message_text`, treat a non-string/`None` content as `AIError("empty AI content")`; that makes it flow through the existing retry/502 path.

### R2 (P1) `PUT /api/board` accepts referentially-broken boards
`backend/app/board.py:33-37` validates types via Pydantic but not integrity, whereas `/api/chat` enforces unique card ids, no duplicate placements, and that every `cardId` resolves to a card (`chat.py:99-107`). A `PUT` whose column references a missing card passes validation, persists, and then crashes the board render (`KanbanColumn` maps `cardIds` to `board.cards[cardId]`, yielding `undefined` -> `KanbanCard` dereferences `card.id`). The real frontend never sends this, but the API permits self-inflicted corruption.
Action: extract the integrity checks from `_ai_to_board` into one `validate_board(columns, cards)` helper and call it from both the `PUT` handler and chat. Closes the gap and removes duplicated intent.

### R3 (P2) Redundant save after an AI update
`frontend/.../KanbanBoard.tsx:51-53` syncs an externally-replaced board into state; that state change triggers the notify effect (`:41-47`) -> `onChange` -> `BoardContainer.handleChange` (`BoardContainer.tsx:48-57`) -> a debounced `saveBoard`. So every AI edit re-PUTs the board the server just persisted. Harmless but an extra write + request each time.
Action: when applying an external board, set a ref to skip the next `onChange` notification (or have `BoardContainer` pass the AI board through a path that doesn't loop back to save).

### R4 (P2) Blocking DB calls inside async endpoints
`board.py` and `chat.py` call the synchronous `db.*` functions directly from `async def` handlers, blocking the event loop during SQLite I/O. Negligible for a local single-user app, but it will not scale and is a latent foot-gun.
Action (later): make the DB-touching endpoints plain `def` (FastAPI runs them in a threadpool) or wrap calls in `starlette.concurrency.run_in_threadpool`.

### R5 (P3) Proxy buffers responses and lacks WebSocket support
`main.py:65-82` reads the full upstream body into memory and only proxies HTTP methods. Fine for the Next production server (static pages, no HMR socket), just a documented limitation rather than streaming.

---

## Architecture & maintainability

### M1 (P3) The board shape is defined in four places
The same structure lives as the TS `BoardData` (`frontend/src/lib/kanban.ts`), the Pydantic `BoardData` (`backend/app/board.py`), and the hand-written JSON schema with cards-as-array (`backend/app/chat.py:31-59`); the seed board is duplicated as `DEFAULT_BOARD` (`backend/app/seed.py`) and `initialData` (frontend). Cross-language duplication is somewhat inherent, but four copies invites drift.
Action: at minimum add cross-reference comments (some already exist). Optionally generate the chat JSON schema from the Pydantic model, and treat one side's seed as canonical in docs.

### M2 (P3) New httpx client per AI call
`ai.py:52` opens a fresh `httpx.AsyncClient` for every request while the app already manages a shared client for the proxy (`main.py:28`). Minor overhead; a shared, lifespan-managed AI client would be tidier.

### Positive
- Clean separation: `auth` / `board` / `db` / `seed` / `ai` / `chat` each own one concern; the proxy catch-all is correctly registered last so `/api/*` routes win.
- `KanbanBoard` stays in-memory and network-free; `BoardContainer` owns fetch/save; the `sidebar` slot keeps the chat below the header without coupling it to the board's lifecycle.
- The AI hardening (firm prompt + tolerant `_extract_json` + retry + server-side validation) is the right layered defense for a provider that does not enforce `strict` json_schema; well documented in `docs/AI.md`.

---

## Frontend specifics

### F1 (P3) Chat error leaves a dangling user message
`ChatSidebar` keeps the user's message in the list on failure with no assistant reply and no retry affordance. Acceptable; a small "retry" or inline error-on-message would be nicer.

### F2 (P3) Save vs AI-update write ordering
The 500ms debounced save and an AI update can both write the board. With one user this is effectively serial and low risk; worth a note if concurrency grows.

### Positive
- Good accessibility: `aria-label`s on inputs, `role="alert"` for errors, `data-testid` hooks preserved for tests.
- Sensible state model; `moveCard` is a well-tested pure function.

---

## DevOps

### D1 (P3) Docker image is larger than necessary
`Dockerfile` copies the entire built `frontend` (including dev `node_modules`) into the runtime image.
Action: set Next `output: "standalone"` and copy only `.next/standalone`, `.next/static`, and `public` - typically a large size reduction.

### Positive
- `start.sh`/`stop.sh` are idempotent (remove existing container) and mount a named volume so the SQLite DB survives restarts; the bash-3.2 empty-array guard is handled.
- Multi-stage build; `uv sync --frozen` against a committed lockfile.

---

## Testing

- Strong coverage overall: backend 22 (incl. guarded live AI calls that skip without a key), frontend 24 unit + 9 Playwright (pinned to one worker because the board is shared state).
- Gap (ties to R2): no test asserts `PUT /api/board` rejects a referentially-broken board - because it currently accepts one. Add once A4 lands.
- The chat e2e stubs `/api/chat` for determinism; the live path is covered by a guarded backend test. Good split.

---

## Suggested sequencing

1. A3 (null content) and A2 (history roles) - small, pure backend, no API change.
2. A4 (shared board validator) - refactor `_ai_to_board`, wire into `PUT`, add a rejection test.
3. A1 / A5 / A8 - the security/deploy hardening, ideally before this leaves localhost.
4. A6 (redundant save) and A7 (threadpool) - polish.
5. A9 / A10 / A11 - optional cleanups.
