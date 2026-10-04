"""create: POST /api/create [R11][R26]. Streams status events; invalidates caches after."""

from __future__ import annotations

from typing import Any

from gateway.actions._streaming import relay
from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.aggregate import StatusAggregator
from gateway.protocol.payloads.common import dump_for_upstream
from gateway.protocol.payloads.create import CreatePayload


class CreateAction(BaseAction[CreatePayload]):
    name = "create"
    payload_model = CreatePayload
    streaming = True
    upstream_operations = frozenset({"create"})

    async def run(self, payload: CreatePayload, ctx: ActionContext) -> dict[str, Any]:
        body = dump_for_upstream(payload)
        body["stream"] = payload.stream
        try:
            return await relay(ctx, "/api/create", body, StatusAggregator)
        finally:
            ctx.cache.invalidate()
