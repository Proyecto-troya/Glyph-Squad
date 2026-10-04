"""generate: POST /api/generate [R3]."""

from __future__ import annotations

from typing import Any

from gateway.actions._models import text_model_checks
from gateway.actions._streaming import relay
from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.aggregate import GenerateAggregator
from gateway.protocol.payloads.common import dump_for_upstream
from gateway.protocol.payloads.generate import GeneratePayload


class GenerateAction(BaseAction[GeneratePayload]):
    name = "generate"
    payload_model = GeneratePayload
    streaming = True
    upstream_operations = frozenset({"generate"})

    async def run(self, payload: GeneratePayload, ctx: ActionContext) -> dict[str, Any]:
        await text_model_checks(ctx, payload.model, payload.think)
        body = dump_for_upstream(payload)
        body["stream"] = payload.stream
        return await relay(ctx, "/api/generate", body, GenerateAggregator)
