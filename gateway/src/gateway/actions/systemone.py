"""systemone: POST /v1/systemone [R6][R7]. Ollama 0.35.0+; images need 0.35.1 and Clef."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.common import dump_for_upstream
from gateway.protocol.payloads.systemone import SystemOnePayload
from gateway.security.cloud_guard import ensure_local_model
from gateway.security.routing import (
    require_decision_model,
    require_systemone,
    require_systemone_images,
)


class SystemOneAction(BaseAction[SystemOnePayload]):
    name = "systemone"
    payload_model = SystemOnePayload
    upstream_operations = frozenset({"systemone"})

    async def run(self, payload: SystemOnePayload, ctx: ActionContext) -> dict[str, Any]:
        gate = await ctx.version_gate()
        require_systemone(gate)
        await ensure_local_model(ctx.cache, payload.model)
        info = await ctx.cache.show(payload.model)
        require_decision_model(payload.model, info)
        if payload.has_images:
            require_systemone_images(gate, payload.model, info)
        return ensure_ok(await ctx.client.call("POST", "/v1/systemone", dump_for_upstream(payload)))
