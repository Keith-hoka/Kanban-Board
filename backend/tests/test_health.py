from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_ok():
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unmatched_api_path_is_not_proxied():
    # /api/* is owned by the backend; an unknown api route is a 404, never proxied to Next.
    with TestClient(app) as client:
        response = client.get("/api/does-not-exist")
    assert response.status_code == 404
