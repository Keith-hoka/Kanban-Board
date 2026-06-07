import asyncio
import os

import pytest

from app import ai

_HAS_KEY = bool(os.environ.get("OPENROUTER_API_KEY"))


def test_api_key_missing_raises(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(ai.AIError):
        ai._api_key()


def test_message_text_parses_response():
    data = {"choices": [{"message": {"content": "4"}}]}
    assert ai.message_text(data) == "4"


def test_message_text_rejects_bad_shape():
    with pytest.raises(ai.AIError):
        ai.message_text({"choices": []})


def test_ping_requires_auth(client):
    assert client.post("/api/ai/ping").status_code == 401


@pytest.mark.skipif(not _HAS_KEY, reason="OPENROUTER_API_KEY not set")
def test_live_two_plus_two():
    data = asyncio.run(
        ai.chat([{"role": "user", "content": "What is 2+2? Reply with just the number."}])
    )
    assert "4" in ai.message_text(data)
