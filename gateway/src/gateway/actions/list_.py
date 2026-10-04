"""list: GET /api/tags [R8]."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.models import ListPayload


class ListAction(BaseAction[ListPayload]):
    name = "list"
    payload_model = ListPayload
    upstream_operations = frozenset({"list"})

    async def run(self, payload: ListPayload, ctx: ActionContext) -> dict[str, Any]:
        return ensure_ok(await ctx.client.call("GET", "/api/tags"))
