import os

from fastapi.testclient import TestClient

from app.main import app


def _login(client):
    res = client.post(
        "/api/login", json={"username": "user", "password": "password"}
    )
    assert res.status_code == 200


def test_board_requires_auth(client):
    assert client.get("/api/board").status_code == 401
    assert (
        client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401
    )


def test_get_returns_seeded_board(client):
    _login(client)
    res = client.get("/api/board")
    assert res.status_code == 200
    board = res.json()
    assert len(board["columns"]) == 5
    assert "card-1" in board["cards"]


def test_put_then_get_roundtrips(client):
    _login(client)
    new_board = {
        "columns": [{"id": "c1", "title": "Todo", "cardIds": ["x"]}],
        "cards": {"x": {"id": "x", "title": "Task", "details": "Do it"}},
    }
    put = client.put("/api/board", json=new_board)
    assert put.status_code == 200
    assert put.json() == new_board
    assert client.get("/api/board").json() == new_board


def test_malformed_put_rejected(client):
    _login(client)
    # columns must be a list of column objects, not a string.
    assert client.put("/api/board", json={"columns": "nope", "cards": {}}).status_code == 422
    # card missing required "details".
    bad_card = {
        "columns": [],
        "cards": {"x": {"id": "x", "title": "Task"}},
    }
    assert client.put("/api/board", json=bad_card).status_code == 422


def test_persists_across_restart():
    # The autouse temp_db fixture fixes DATABASE_PATH for this test; two separate
    # TestClient lifespans simulate a restart against the same database file.
    assert os.environ.get("DATABASE_PATH")
    new_board = {
        "columns": [{"id": "c1", "title": "Todo", "cardIds": []}],
        "cards": {},
    }
    with TestClient(app) as first:
        _login(first)
        assert first.put("/api/board", json=new_board).status_code == 200
    with TestClient(app) as second:
        _login(second)
        assert second.get("/api/board").json() == new_board
