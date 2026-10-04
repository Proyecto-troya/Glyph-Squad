"""push: POST /api/push [R14][R27]. Needs internet and an ollama.com sign-in; off by default."""

from __future__ import annotations

from typing import Any

from gateway.actions._internet import with_internet_hint
from gateway.actions._streaming import relay
from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.aggregate import StatusAggregator
from gateway.ollama.errors import translate
from gateway.protocol.payloads.common import dump_for_upstream
from gateway.protocol.payloads.models import PushPayload


class PushAction(BaseAction[PushPayload]):
    name = "push"
    payload_model = PushPayload
    streaming = True
    upstream_operations = frozenset({"push"})
    needs_internet = True

    async def run(self, payload: PushPayload, ctx: ActionContext) -> dict[str, Any]:
        body = dump_for_upstream(payload)
        body["stream"] = payload.stream
        try:
            return await relay(ctx, "/api/push", body, StatusAggregator)
        except Exception as exc:
            mapped = translate(exc)
            if mapped is None:
                raise
            raise with_internet_hint(mapped, "push") from exc
