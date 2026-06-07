import json
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app import ai, db
from app.auth import require_user
from app.board import BoardData, validate_board_integrity

router = APIRouter(prefix="/api")

# The model treats strict json_schema as a hint and otherwise adds prose / code
# fences, so the prompt firmly demands a bare JSON object and we extract
# defensively (see _extract_json).
SYSTEM_PROMPT = (
    "You are an assistant embedded in a single-board Kanban app. "
    "Respond with a SINGLE JSON object and NOTHING else: no text before or after, "
    "no markdown code fences. The object has EXACTLY two keys: "
    '"reply" (a short string message for the user) and '
    '"board_update" (null if nothing changes, otherwise the COMPLETE updated board). '
    "If the user asks to create, edit, move, rename, or delete cards or columns, put the "
    "full new board in board_update; otherwise board_update must be null. "
    "Keep existing ids stable; generate new unique ids for new cards/columns. "
    "In board_update, 'cards' is an ARRAY of {id, title, details}. Every cardId listed in "
    "a column must match exactly one card in that array."
)

# Same board shape as board.py / frontend kanban.ts, but with cards as an ARRAY:
# a Record<id, Card> map cannot be expressed under strict json_schema. The server
# converts the array back to the stored map shape in _ai_to_board. Keep in sync.
_CARD_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "details": {"type": "string"},
    },
    "required": ["id", "title", "details"],
    "additionalProperties": False,
}
_COLUMN_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "cardIds": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["id", "title", "cardIds"],
    "additionalProperties": False,
}
_BOARD_SCHEMA = {
    "type": "object",
    "properties": {
        "columns": {"type": "array", "items": _COLUMN_SCHEMA},
        "cards": {"type": "array", "items": _CARD_SCHEMA},
    },
    "required": ["columns", "cards"],
    "additionalProperties": False,
}
RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "chat_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "reply": {"type": "string"},
                "board_update": {"anyOf": [{"type": "null"}, _BOARD_SCHEMA]},
            },
            "required": ["reply", "board_update"],
            "additionalProperties": False,
        },
    },
}


class ChatMessage(BaseModel):
    # Constrain roles so a client cannot inject system-level instructions.
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


def _board_to_ai(board: dict) -> dict:
    """Stored shape (cards map) -> model shape (cards array)."""
    return {"columns": board["columns"], "cards": list(board["cards"].values())}


def _ai_to_board(update: dict) -> dict:
    """Model shape -> stored shape, validating structure and referential integrity.

    Raises on any problem so a bad update is never persisted.
    """
    cards_list = update["cards"]
    cards = {card["id"]: card for card in cards_list}
    if len(cards) != len(cards_list):
        raise ValueError("duplicate card ids")

    # Pydantic validates field types/shape; the shared check covers integrity.
    board = BoardData(columns=update["columns"], cards=cards)
    validate_board_integrity(board)
    return board.model_dump()


def _extract_json(content: str) -> dict:
    """Parse a JSON object from model content, tolerating code fences and prose."""
    text = content.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


async def _ask_model(messages: list[dict]) -> dict:
    """Call the model and parse the structured reply, retrying once on bad output."""
    for _ in range(2):
        try:
            data = await ai.chat(messages, response_format=RESPONSE_FORMAT)
            parsed = _extract_json(ai.message_text(data))
            if "reply" in parsed and "board_update" in parsed:
                return parsed
        except (ai.AIError, json.JSONDecodeError):
            continue
    raise HTTPException(
        status_code=502,
        detail="The assistant returned an unreadable response. Please try again.",
    )


@router.post("/chat")
async def chat(body: ChatRequest, username: str = Depends(require_user)):
    # Keep the blocking SQLite calls off the event loop (this handler is async
    # because it awaits the AI call).
    board = await run_in_threadpool(db.get_board, username)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": "Current board JSON:\n" + json.dumps(_board_to_ai(board))},
        *[{"role": m.role, "content": m.content} for m in body.history],
        {"role": "user", "content": body.message},
    ]

    parsed = await _ask_model(messages)
    board_updated = False

    if parsed["board_update"] is not None:
        try:
            board = _ai_to_board(parsed["board_update"])
            await run_in_threadpool(db.save_board, username, board)
            board_updated = True
        except (ValueError, KeyError, TypeError):
            # Invalid update: ignore it and keep the existing board intact.
            board_updated = False

    return {"reply": parsed["reply"], "board": board, "boardUpdated": board_updated}
