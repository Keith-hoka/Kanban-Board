import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    # Point every test at an isolated SQLite file so runs never touch real data.
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "kanban.db"))


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
