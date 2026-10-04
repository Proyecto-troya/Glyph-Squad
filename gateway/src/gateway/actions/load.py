"""load: POST /api/generate with no prompt keeps a model resident [R3][R27]."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.lifecycle import LoadPayload
from gateway.security.cloud_guard import ensure_local_model


class LoadAction(BaseAction[LoadPayload]):
    name = "load"
    payload_model = LoadPayload
    upstream_operations = frozenset({"generate"})

    async def run(self, payload: LoadPayload, ctx: ActionContext) -> dict[str, Any]:
        await ensure_local_model(ctx.cache, payload.model)
        body: dict[str, Any] = {"model": payload.model, "stream": False}
        if payload.keep_alive is not None:
            body["keep_alive"] = payload.keep_alive
        return ensure_ok(await ctx.client.call("POST", "/api/generate", body))
