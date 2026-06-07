# Frontend

Next.js 16 (App Router) + React 19 + Tailwind CSS 4 single-board Kanban. Currently a self-contained, in-memory demo: there is no backend, no auth, and no persistence yet. State lives in React and resets on reload. Later plan parts (see `docs/PLAN.md`) wrap this in login, wire it to a FastAPI backend, and add an AI sidebar.

## Stack

- **Next.js 16** App Router, **React 19**, **TypeScript** (strict).
- **Tailwind CSS 4** via `@tailwindcss/postcss`; brand tokens are CSS variables in `src/app/globals.css`.
- **dnd-kit** (`@dnd-kit/core`, `/sortable`, `/utilities`) for drag and drop.
- **clsx** for conditional classes.
- **Vitest** + Testing Library (jsdom) for unit tests; **Playwright** (chromium) for e2e.
- Path alias `@/` -> `src/` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Data model and state

`src/lib/kanban.ts` is the framework-agnostic core and the most heavily tested file:

- `BoardData = { columns: Column[]; cards: Record<string, Card> }`. Cards are stored in a flat map; each `Column` holds an ordered `cardIds: string[]`. Card order and column membership are defined entirely by `cardIds`.
- `moveCard(columns, activeId, overId)` is a pure function holding all drag logic: same-column reorder, cross-column move, and dropping onto an empty column (when `overId` is a column id rather than a card id). It returns new column arrays and never mutates.
- `createId(prefix)` generates ids; `initialData` is the seed board (5 columns, 8 cards).

`src/components/KanbanBoard.tsx` holds `board` via `useState` and owns every mutation handler (`handleDragEnd` -> `moveCard`, `handleRenameColumn`, `handleAddCard`, `handleDeleteCard`). It wraps columns in dnd-kit `DndContext` (PointerSensor, `closestCorners`) and renders a `DragOverlay`. It takes `initialBoard` (defaults to `initialData`, so it still works standalone in tests), `onChange` (called on every board change, skipping the initial render), and `onLogout`.

`src/components/BoardContainer.tsx` is the persistence layer between `AuthGate` and `KanbanBoard`: it fetches the board (`getBoard`), shows loading/error states, and on each `onChange` does a **debounced full-board PUT 500ms after the last edit** (`saveBoard`), surfacing a banner if a save fails. This keeps `KanbanBoard` purely in-memory and network-free.

`src/components/ChatSidebar.tsx` is the AI chat widget: holds the conversation, posts to `/api/chat` via `sendChat` (sending prior turns as `history`), shows user/assistant bubbles + a pending state, and calls `onBoardUpdate(board)` when the response has `boardUpdated`. `BoardContainer` renders it alongside the board (`flex-col` mobile / `lg:flex-row`) and, on an AI update, sets the new board and bumps a `key` to remount `KanbanBoard` with it - the auto-refresh.

Auth/data flow: `AuthGate` (calls `getMe`) renders `LoginForm` or `BoardContainer`. The API client is `src/lib/api.ts` (`getMe`/`login`/`logout`/`getBoard`/`saveBoard`/`sendChat`, all `credentials: "include"`).

The other components are presentational and own no board state (only local UI state):

- `KanbanColumn` — a droppable region wrapping a `SortableContext`; renders cards, the column-title input (rename), the empty-state placeholder, and `NewCardForm`.
- `KanbanCard` — a sortable card (drag handle is the whole card) with a remove button.
- `KanbanCardPreview` — static visual used inside `DragOverlay` while dragging.
- `NewCardForm` — local open/closed + draft state; calls `onAdd` and resets. Requires a non-empty title.

`src/app/page.tsx` renders `<KanbanBoard />`; `layout.tsx` sets fonts (Space Grotesk display, Manrope body) and metadata.

## Test layout

- Unit (vitest): `src/**/*.{test,spec}.{ts,tsx}` in jsdom. `src/lib/kanban.test.ts` covers `moveCard`; `src/components/KanbanBoard.test.tsx` covers board interactions. Setup file `src/test/setup.ts` pulls in jest-dom matchers.
- E2E (playwright): `tests/*.spec.ts` (excluded from vitest). `playwright.config.ts` auto-starts `npm run dev` on `127.0.0.1:3000` by default, or targets an already-running app when `E2E_BASE_URL` is set (e.g. the container: `E2E_BASE_URL=http://127.0.0.1:8000 npx playwright test`). Runs with `workers: 1` because all tests share the single persisted board. `tests/helpers.ts` provides `login(page)` and `resetBoard(page)` (PUTs the seed via the API + reloads); board specs call both in `beforeEach` so they start from a known state.
- Components expose `data-testid` hooks: `column-<columnId>` and `card-<cardId>`. Preserve these when refactoring — both unit and e2e tests depend on them.

## Conventions

- Components are named exports (no default exports except Next's required `page`/`layout`).
- Keep board-mutating logic as pure functions in `src/lib` with direct unit tests; keep components thin.
- Style with Tailwind utility classes plus the `var(--token)` brand colors; do not hardcode hex values that duplicate a token.
- No emojis. Match the existing concise style.

## Commands

```bash
npm install
npm run dev                              # dev server
npm run build                            # production build
npm run lint                             # eslint
npm run test:unit                        # all unit tests
npx vitest run src/lib/kanban.test.ts    # one unit file
npm run test:e2e                         # playwright e2e
npm run test:all                         # unit then e2e
```
