from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app import db
from app.auth import require_user

router = APIRouter(prefix="/api")


# Mirrors the frontend BoardData shape; used to validate writes.
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


@router.get("/board")
async def read_board(username: str = Depends(require_user)):
    return db.get_board(username)


@router.put("/board")
async def write_board(board: BoardData, username: str = Depends(require_user)):
    data = board.model_dump()
    db.save_board(username, data)
    return data
