# AI integration

How the backend talks to the LLM, and the decisions behind it. Implemented in `backend/app/ai.py`.

## Setup

- Provider: **OpenRouter**, OpenAI-compatible chat-completions endpoint (`https://openrouter.ai/api/v1/chat/completions`), called with `httpx`.
- Model: `openai/gpt-oss-120b`.
- Auth: `OPENROUTER_API_KEY` from the project-root `.env`. Loaded via `python-dotenv` for local dev/tests; supplied to the container through `--env-file` in `start.sh`. A missing key raises `AIError` (the `/api/ai/ping` endpoint surfaces it as 503).

## Connectivity (Part 8)

Verified with a live call: `chat([...2+2...])` returns "4". Smoke endpoint `POST /api/ai/ping` (auth-gated) returns `{"answer": "4"}`.

## Structured outputs - findings

The model **does support** OpenRouter structured outputs (`response_format` with a strict `json_schema`). Probed live with flat and nested schemas: the returned content always parsed as JSON and conformed to the schema (keys/types/shape correct).

**Caveat discovered:** OpenRouter load-balances across upstream providers (DeepInfra, SiliconFlow, Novita, ...). All honored the schema *structure*, but one run via SiliconFlow returned structurally-valid **garbage values** (column titles like `''` and `'}]['`). The schema is enforced; content quality is not, and it varies by provider.

## Decision

1. **Use native structured outputs** (strict `json_schema`) - no JSON-mode fallback needed.
2. **Pin provider routing** to avoid the garbage-content case. `ai.PROVIDER_PREFERENCE` sends `provider: {require_parameters: true, order: ["DeepInfra"], allow_fallbacks: true}` on every call - only providers that support the requested parameters, preferring DeepInfra, which was stable across repeated runs (4/4 correct). `allow_fallbacks` keeps the app working if DeepInfra is unavailable.
3. **Still validate server-side in Part 9.** Because content quality is not guaranteed, any `board_update` from the model must be validated against the `BoardData` shape (Pydantic) before it is persisted, and rejected/ignored if invalid. Pinning reduces the risk; validation is the backstop.

## Chat over the board (Part 9)

Endpoint `POST /api/chat` (`app/chat.py`, auth-gated). It prepends the system prompt + current board JSON, appends the client-sent history and new message, and requests `{ reply, board_update }` via the structured `RESPONSE_FORMAT`.

**Schema shape.** Strict `json_schema` cannot express a dynamic-key map, so the stored `cards` map (`Record<id, Card>`) is exchanged with the model as a `cards` **array**; the server converts back via `_ai_to_board`. `board_update` is `BoardData | null` (`anyOf` null).

**Second finding (Part 9): strict mode is only a hint here.** For action requests over the full board, the model often wrapped the JSON in ```` ```json ```` fences or prepended prose (only ~1/3 of calls were clean JSON), and sometimes split the reply into prose with `board_update`-only JSON. Strict `json_schema` is not actually enforced by the provider for this model. Mitigations, in order:
1. A firm system prompt: "respond with a SINGLE JSON object and NOTHING else... EXACTLY two keys". This alone brought compliance to 6/6 in testing.
2. Tolerant parsing (`_extract_json`): strips code fences and slices the outer `{...}`.
3. One retry if the parsed object lacks `reply`/`board_update`; otherwise a clean 502.
4. **Server-side validation is the real backstop.** `_ai_to_board` checks types (Pydantic `BoardData`) *and* referential integrity (unique card ids, no duplicate placements, every `cardId` resolves to a card). Any failure -> the update is ignored and the stored board is left untouched; the reply is still returned. This is why a bad model response can never corrupt the board.

**Conversation history** is kept **client-side**: the frontend sends `history` (prior user/assistant messages) with each request; the backend is stateless between calls and does not store the conversation. Only the board is persisted.
