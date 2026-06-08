# Code Review — frontend

Date: 2026-06-09
Scope: `frontend/src/**` current state (working tree clean, no pending diff). Reviewed the data model, board components, chat sidebar, API client, and auth flow.

Method: high-effort, recall-biased review. Candidates from multiple finder passes were verified line-by-line against the source; false positives were dropped (see note at the end).

Status: all six findings below were fixed on 2026-06-09. Resolution notes are inline. Verified with `npm run lint`, `npm run build`, and `npm run test:unit` (32/32 passing, including added coverage for `normalizeBoard`, `logout` failure, and the flush-before-send ordering). The Playwright e2e suite was not run — it requires the full FastAPI + Next stack.

---

## Findings

Ranked most severe first.

### 1. (High) An unvalidated board from the backend or AI crashes the entire board render

- `frontend/src/components/KanbanBoard.tsx:241` — `cards={column.cardIds.map((cardId) => board.cards[cardId])}`
- `frontend/src/lib/api.ts:39,67` — `getBoard` / `sendChat` return `res.json()` with no shape check
- `frontend/src/components/BoardContainer.tsx:34,71` — `setBoard(data)` straight from the API

If any `column.cardIds` entry has no matching key in `board.cards`, the `.map` produces `undefined`. That `undefined` flows into `KanbanColumn` → `KanbanCard`, where `key={card.id}` / `card.title` dereferences `undefined` and throws, blanking the whole app.

Locally this invariant always holds (the mutation handlers keep `cardIds` and `cards` in sync). But the board also arrives from two untrusted sources:
- the backend on load (`getBoard`), and
- the AI on every chat edit (`sendChat` → `res.board`).

An AI Structured Output or a backend bug that emits a `cardId` not present in `cards` (or a card object missing `id`/`title`) takes down the board with no recovery. Nothing between the network and `setBoard` validates the structure.

Suggested fix: validate the board shape once at the trust boundary (in `api.ts`, after `res.json()`) — drop `cardIds` with no matching card and discard cards missing required fields — so a malformed payload degrades gracefully instead of crashing. This is the right altitude: one guard at the boundary rather than null-checks scattered through the render path.

**Resolved:** added `normalizeBoard` to `lib/kanban.ts` (drops any `cardId` with no matching card; tolerates a missing `columns`/`cards`/`cardIds`), applied in `api.ts` `getBoard` and `sendChat` so both untrusted sources are sanitized before reaching state.

### 2. (Medium-High) AI board response silently overwrites concurrent local edits

- `frontend/src/components/ChatSidebar.tsx:43-44` — `if (res.boardUpdated) onBoardUpdate(res.board)`
- `frontend/src/components/BoardContainer.tsx:50-72` — debounced save (500ms) + `skipNextSave`

Local edits are persisted on a 500ms debounce. The chat call does not send the current board — the AI operates on the server's copy. So this sequence loses data:

1. User drags a card (local state updates; a save is scheduled for +500ms).
2. Before that save fires, the user sends a chat that edits the board.
3. The backend reads its still-stale board, applies the AI edit, and returns it.
4. `onBoardUpdate(res.board)` replaces state with the AI board — the drag is gone — and `skipNextSave` suppresses re-saving it, so the loss is permanent.

The window is small but realistic (any edit within ~0.5s of a chat send, or while a save is in flight). For an MVP this may be acceptable, but it should at least be a known limitation. A cleaner fix is to flush the pending save before issuing a chat request, or have the chat request carry the latest board.

**Resolved:** `BoardContainer` now tracks the latest unsaved board in a ref and exposes a `flush` that saves it immediately (cancelling the debounce). `ChatSidebar` takes an `onBeforeSend` prop and awaits it before `sendChat`, so the server has the user's latest board before the AI reads it. (Remaining limitation: an edit made while a chat is already in flight is still not merged — out of scope for the MVP.)

### 3. (Low-Medium) `logout()` ignores the response status

- `frontend/src/lib/api.ts:35-37` — `await fetch("/api/logout", ...)` with no `res.ok` check
- `frontend/src/components/AuthGate.tsx:19-22` — sets `anon` unconditionally after the await

Every other API helper checks `res.ok`; `logout` does not. If the request fails server-side, the UI still flips to the login screen while the session cookie remains valid — a reload calls `getMe`, succeeds, and logs the user back in. Minor for hardcoded auth, but it is an inconsistent silent-failure path. Check `res.ok` like the other helpers.

**Resolved:** `logout` now throws on a non-ok response, and `AuthGate.handleLogout` wraps it so a failed logout leaves the user signed in rather than showing a logged-out UI over a live session.

---

## Cleanup (lower priority)

### 4. Redundant `useMemo` for `cardsById`

- `frontend/src/components/KanbanBoard.tsx:73` — `const cardsById = useMemo(() => board.cards, [board.cards]);`

This returns `board.cards` keyed on `board.cards` — identical to just referencing `board.cards`, with added noise. `cardsById` is used only at line 163 (`activeCardId ? cardsById[activeCardId] : null`). Drop the memo and inline `board.cards[activeCardId]`.

**Resolved:** removed the memo and the now-unused `useMemo` import; `activeCard` reads `board.cards[activeCardId]` directly.

### 5. Index as React key for chat messages

- `frontend/src/components/ChatSidebar.tsx:74-76` — `messages.map((message, index) => <div key={index} ...>)`

The list is append-only today, so this works; it is a latent foot-gun if messages ever get prepended, filtered, or carry local state. Low impact — fix only if message handling grows.

**Resolved:** messages now carry a stable `id` (via `createId("msg")`) used as the React key; the wire `ChatTurn` shape sent as history is unchanged.

### 6. Duplicated card markup (optional)

- `frontend/src/components/KanbanCard.tsx:43-50` and `frontend/src/components/KanbanCardPreview.tsx:9-16`

The title/details block (`h4` + conditional `p`) is duplicated across the card and its drag preview. The containers differ intentionally (the preview has no delete button or drag handlers and a heavier shadow). Extracting the inner block would centralize one styling change, but it is two lines — given the project's "do not over-engineer" rule, leaving it is reasonable unless the card content grows.

**Resolved:** extracted a shared `CardContent` component (`components/CardContent.tsx`) used by both `KanbanCard` (with `titlePadding` for the delete-button gutter) and `KanbanCardPreview`.

---

## What was checked and found OK

- `moveCard` (`lib/kanban.ts:87-165`): same-column reorder, cross-column move, and drop-on-empty-column all handled correctly. The reorder splice (`128-130`) is the standard `arrayMove` algorithm and is not off-by-one.
- Board mutation handlers (`KanbanBoard.tsx`): add/delete card and delete column all keep `cardIds` and the `cards` record in sync; deleting a column removes its cards too, so no orphans are created locally.
- API error handling: `getMe`, `login`, `getBoard`, `saveBoard`, `sendChat` all check `res.ok`, and every caller wraps the call in a `.catch` (so a malformed-JSON rejection surfaces as a handled error state, not an unhandled rejection).
- `LoginForm` does not reset `submitting` on success, but the component unmounts on success (`AuthGate` flips to `authed`), so there is no stuck-button bug.
- The `onChangeRef` + `isInitialRender` + `initialBoard`-sync effects in `KanbanBoard` correctly avoid spurious saves and re-mounts.
- Test coverage exists for the model, board, chat, auth, and API client (unit + Playwright e2e).

## Dropped false positives

The off-by-one in `moveCard`, the `res.json()` "unhandled rejection", the `LoginForm` frozen-submitting state, and the `activeCard` `undefined`-vs-`null` type concern were all raised by finders but refuted against the code (correct algorithm / handled by callers / handled by unmount / falsy either way with no observable effect).
