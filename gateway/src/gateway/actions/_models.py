"""Model checks shared by chat, generate, embed, load and systemone."""

from __future__ import annotations

from gateway.actions.base import ActionContext
from gateway.ollama.cache import ShowInfo
from gateway.security.cloud_guard import ensure_local_model
from gateway.security.routing import require_text_model, validate_think


async def text_model_checks(ctx: ActionContext, model: str, think: bool | str | None) -> ShowInfo:
    """Cloud guard, decision-model rejection and ``think`` validation for chat/generate."""
    await ensure_local_model(ctx.cache, model)
    info = await ctx.cache.show(model)
    require_text_model(model, info)
    validate_think(model, info, think)
    return info
