"""ping: client-initiated heartbeat. Never touches Ollama."""

from __future__ import annotations

import time
from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.protocol.payloads.models import PingPayload


class PingAction(BaseAction[PingPayload]):
    name = "ping"
    payload_model = PingPayload

    async def run(self, payload: PingPayload, ctx: ActionContext) -> dict[str, Any]:
        return {"pong": True, "ts": time.time()}
