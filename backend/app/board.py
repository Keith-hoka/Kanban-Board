from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import db
from app.auth import require_user

router = APIRouter(prefix="/api")


# Mirrors the frontend BoardData shape (frontend/src/lib/kanban.ts); used to
# validate writes. The AI chat path uses an array-of-cards variant - see
# backend/app/chat.py. Keep all three in sync.
class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


def validate_board_integrity(board: BoardData) -> None:
    """Reject a structurally-valid board that is internally inconsistent.

    Pydantic checks types; this checks the relationships the UI relies on, so a
    bad board can never be persisted (and then crash the render). Shared by the
    PUT handler and the AI chat path. Raises ValueError on any problem.
    """
    for key, card in board.cards.items():
        if key != card.id:
            raise ValueError("a card's map key does not match its id")
    referenced = [cid for column in board.columns for cid in column.cardIds]
    if len(referenced) != len(set(referenced)):
        raise ValueError("a card is placed in more than one position")
    if any(cid not in board.cards for cid in referenced):
        raise ValueError("a column references a missing card")


# Sync handlers so FastAPI runs the blocking SQLite calls in its threadpool
# rather than on the event loop.
@router.get("/board")
def read_board(username: str = Depends(require_user)):
    return db.get_board(username)


@router.put("/board")
def write_board(board: BoardData, username: str = Depends(require_user)):
    try:
        validate_board_integrity(board)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    data = board.model_dump()
    db.save_board(username, data)
    return data
