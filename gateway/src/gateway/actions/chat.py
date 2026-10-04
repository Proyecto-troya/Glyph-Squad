"""chat: POST /api/chat [R4]. Tool calls are relayed, never executed [R22]."""

from __future__ import annotations

from typing import Any

from gateway.actions._models import text_model_checks
from gateway.actions._streaming import relay
from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.aggregate import ChatAggregator
from gateway.protocol.payloads.chat import ChatPayload
from gateway.protocol.payloads.common import dump_for_upstream


class ChatAction(BaseAction[ChatPayload]):
    name = "chat"
    payload_model = ChatPayload
    streaming = True
    upstream_operations = frozenset({"chat"})

    async def run(self, payload: ChatPayload, ctx: ActionContext) -> dict[str, Any]:
        await text_model_checks(ctx, payload.model, payload.think)
        body = dump_for_upstream(payload)
        body["stream"] = payload.stream
        return await relay(ctx, "/api/chat", body, ChatAggregator)
