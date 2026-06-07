from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

# Hardcoded MVP credentials. The session still identifies the user by name so the
# DB (modeled for multiple users) and later per-user routes have a real subject.
USERNAME = "user"
PASSWORD = "password"

router = APIRouter(prefix="/api")


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    if body.username != USERNAME or body.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["user"] = body.username
    return {"user": body.username}


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me")
async def me(request: Request):
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": user}


def require_user(request: Request) -> str:
    """Dependency: return the logged-in username or raise 401."""
    user = request.session.get("user")
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
