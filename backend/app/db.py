import json
import os
import sqlite3
from pathlib import Path

from app.auth import USERNAME
from app.seed import DEFAULT_BOARD

_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "kanban.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def _db_path() -> Path:
    # Read at call time so tests and the container can override via env.
    return Path(os.environ.get("DATABASE_PATH", str(_DEFAULT_DB_PATH)))


def connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _ensure_user(conn: sqlite3.Connection, username: str) -> int:
    conn.execute(
        "INSERT INTO users (username) VALUES (?) ON CONFLICT(username) DO NOTHING",
        (username,),
    )
    return conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()["id"]


def _seed_board_if_missing(conn: sqlite3.Connection, user_id: int) -> None:
    existing = conn.execute(
        "SELECT 1 FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if existing is None:
        conn.execute(
            "INSERT INTO boards (user_id, data) VALUES (?, ?)",
            (user_id, json.dumps(DEFAULT_BOARD)),
        )


def init_db() -> None:
    """Create the schema if absent and seed the default user's board. Idempotent."""
    conn = connect()
    try:
        conn.executescript(_SCHEMA)
        user_id = _ensure_user(conn, USERNAME)
        _seed_board_if_missing(conn, user_id)
        conn.commit()
    finally:
        conn.close()


def get_board(username: str) -> dict:
    conn = connect()
    try:
        user_id = _ensure_user(conn, username)
        _seed_board_if_missing(conn, user_id)
        conn.commit()
        row = conn.execute(
            "SELECT data FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        return json.loads(row["data"])
    finally:
        conn.close()


def save_board(username: str, data: dict) -> None:
    conn = connect()
    try:
        user_id = _ensure_user(conn, username)
        conn.execute(
            """
            INSERT INTO boards (user_id, data, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
                data = excluded.data,
                updated_at = datetime('now')
            """,
            (user_id, json.dumps(data)),
        )
        conn.commit()
    finally:
        conn.close()
