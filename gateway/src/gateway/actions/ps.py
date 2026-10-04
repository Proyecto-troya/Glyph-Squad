"""ps: GET /api/ps [R9]. Shows context_length, size_vram and expires_at per loaded model."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.protocol.payloads.models import PsPayload


class PsAction(BaseAction[PsPayload]):
    name = "ps"
    payload_model = PsPayload
    upstream_operations = frozenset({"ps"})

    async def run(self, payload: PsPayload, ctx: ActionContext) -> dict[str, Any]:
        return ensure_ok(await ctx.client.call("GET", "/api/ps"))
