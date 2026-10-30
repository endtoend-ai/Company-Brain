from fastapi import Header, HTTPException

from graph_rag.config import get_settings
from graph_rag.core.types import UserContext


async def require_internal_user(
    x_ff_internal_token: str | None = Header(default=None),
    x_ff_user_id: str | None = Header(default=None),
    x_ff_username: str | None = Header(default=None),
    x_ff_is_admin: str | None = Header(default=None),
) -> UserContext:
    settings = get_settings()
    if not settings.internal_token:
        raise HTTPException(status_code=500, detail="RAG_INTERNAL_TOKEN is not configured")
    if x_ff_internal_token != settings.internal_token:
        raise HTTPException(status_code=401, detail="invalid internal token")
    if not x_ff_user_id or not x_ff_username:
        raise HTTPException(status_code=401, detail="missing user context headers")
    return UserContext(
        user_id=x_ff_user_id,
        username=x_ff_username,
        is_admin=x_ff_is_admin == "true",
    )
