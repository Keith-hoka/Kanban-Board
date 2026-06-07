import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_user

# Load the project-root .env for local dev/tests. In the container the key is
# provided via --env-file, so the file is absent and this is a no-op. Existing
# environment variables are never overridden.
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "openai/gpt-oss-120b"

# OpenRouter load-balances across providers; for this model some providers return
# structurally-valid but garbage content under a json_schema. Pin to one that is
# reliable, only routing to providers that support the requested parameters.
# See docs/AI.md.
PROVIDER_PREFERENCE = {
    "require_parameters": True,
    "order": ["DeepInfra"],
    "allow_fallbacks": True,
}


class AIError(Exception):
    """Raised for missing credentials or a failed/unparseable OpenRouter call."""


# A long-lived client registered by the app lifespan so requests reuse one
# connection pool. Direct callers (e.g. tests with no app running) fall back to
# a one-off client, which avoids reusing a client across event loops.
_shared_client: httpx.AsyncClient | None = None


def set_client(client: httpx.AsyncClient | None) -> None:
    global _shared_client
    _shared_client = client


def _api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise AIError("OPENROUTER_API_KEY is not set")
    return key


async def _post(client: httpx.AsyncClient, payload: dict, headers: dict,
                timeout: float) -> dict:
    response = await client.post(
        OPENROUTER_URL, headers=headers, json=payload, timeout=timeout
    )
    if response.status_code != 200:
        raise AIError(f"OpenRouter returned {response.status_code}: {response.text[:300]}")
    return response.json()


async def chat(messages: list[dict], response_format: dict | None = None,
               timeout: float = 60.0) -> dict:
    """Call OpenRouter chat completions and return the raw response JSON."""
    payload: dict = {
        "model": MODEL,
        "messages": messages,
        "provider": PROVIDER_PREFERENCE,
    }
    if response_format is not None:
        payload["response_format"] = response_format

    headers = {"Authorization": f"Bearer {_api_key()}"}
    if _shared_client is not None:
        return await _post(_shared_client, payload, headers, timeout)
    async with httpx.AsyncClient() as client:
        return await _post(client, payload, headers, timeout)


def message_text(data: dict) -> str:
    """Extract the assistant message content from an OpenRouter response."""
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIError("Unexpected AI response shape") from exc
    # content can be null (e.g. a refusal); treat it as an error so callers
    # take the retry / clean-error path instead of crashing on None.
    if not isinstance(content, str):
        raise AIError("AI returned empty content")
    return content


router = APIRouter(prefix="/api/ai")


@router.post("/ping")
async def ping(username: str = Depends(require_user)):
    """Smoke test: confirm the model is reachable with a trivial question."""
    try:
        data = await chat(
            [{"role": "user", "content": "What is 2+2? Reply with just the number."}]
        )
        return {"answer": message_text(data).strip()}
    except AIError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
