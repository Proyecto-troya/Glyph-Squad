"""delete: DELETE /api/delete with a JSON body [R15][R33]."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.models import DeletePayload


class DeleteAction(BaseAction[DeletePayload]):
    name = "delete"
    payload_model = DeletePayload
    upstream_operations = frozenset({"delete"})

    async def run(self, payload: DeletePayload, ctx: ActionContext) -> dict[str, Any]:
        ensure_ok(await ctx.client.call("DELETE", "/api/delete", {"model": payload.model}))
        ctx.cache.invalidate(payload.model)
        return {"status": "success", "model": payload.model}
