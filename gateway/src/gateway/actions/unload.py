"""unload: POST /api/generate with ``keep_alive: 0`` evicts a model [R27]."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.lifecycle import UnloadPayload


class UnloadAction(BaseAction[UnloadPayload]):
    name = "unload"
    payload_model = UnloadPayload
    upstream_operations = frozenset({"generate"})

    async def run(self, payload: UnloadPayload, ctx: ActionContext) -> dict[str, Any]:
        body = {"model": payload.model, "keep_alive": 0, "stream": False}
        return ensure_ok(await ctx.client.call("POST", "/api/generate", body))
