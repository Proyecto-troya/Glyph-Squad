"""embed: POST /api/embed [R5]. Vectors come back unit-length [R39]."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.common import dump_for_upstream
from gateway.protocol.payloads.embed import EmbedPayload
from gateway.security.cloud_guard import ensure_local_model


class EmbedAction(BaseAction[EmbedPayload]):
    name = "embed"
    payload_model = EmbedPayload
    upstream_operations = frozenset({"embed"})

    async def run(self, payload: EmbedPayload, ctx: ActionContext) -> dict[str, Any]:
        await ensure_local_model(ctx.cache, payload.model)
        return ensure_ok(await ctx.client.call("POST", "/api/embed", dump_for_upstream(payload)))
