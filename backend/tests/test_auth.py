from fastapi.testclient import TestClient

from app.main import app


def test_login_success_then_me():
    with TestClient(app) as client:
        login = client.post(
            "/api/login", json={"username": "user", "password": "password"}
        )
        assert login.status_code == 200
        assert login.json() == {"user": "user"}

        me = client.get("/api/me")
        assert me.status_code == 200
        assert me.json() == {"user": "user"}


def test_login_failure():
    with TestClient(app) as client:
        login = client.post(
            "/api/login", json={"username": "user", "password": "wrong"}
        )
        assert login.status_code == 401
        # No session was established.
        assert client.get("/api/me").status_code == 401


def test_me_requires_session():
    with TestClient(app) as client:
        assert client.get("/api/me").status_code == 401


def test_logout_clears_session():
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        assert client.get("/api/me").status_code == 200

        logout = client.post("/api/logout")
        assert logout.status_code == 200
        assert client.get("/api/me").status_code == 401
