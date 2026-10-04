"""copy: POST /api/copy [R12]."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.models import CopyPayload


class CopyAction(BaseAction[CopyPayload]):
    name = "copy"
    payload_model = CopyPayload
    upstream_operations = frozenset({"copy"})

    async def run(self, payload: CopyPayload, ctx: ActionContext) -> dict[str, Any]:
        body = {"source": payload.source, "destination": payload.destination}
        ensure_ok(await ctx.client.call("POST", "/api/copy", body))
        ctx.cache.invalidate()
        return {"status": "success", **body}
