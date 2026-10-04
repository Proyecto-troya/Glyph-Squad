"""show: POST /api/show [R10]."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.models import ShowPayload


class ShowAction(BaseAction[ShowPayload]):
    name = "show"
    payload_model = ShowPayload
    upstream_operations = frozenset({"show"})

    async def run(self, payload: ShowPayload, ctx: ActionContext) -> dict[str, Any]:
        body = {"model": payload.model, "verbose": payload.verbose}
        return ensure_ok(await ctx.client.call("POST", "/api/show", body))
