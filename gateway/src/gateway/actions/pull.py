"""pull: POST /api/pull [R13]. Needs internet, so it is off unless enabled through env."""

from __future__ import annotations

from typing import Any

from gateway.actions._internet import with_internet_hint
from gateway.actions._streaming import relay
from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.aggregate import StatusAggregator
from gateway.ollama.errors import translate
from gateway.protocol.payloads.common import dump_for_upstream
from gateway.protocol.payloads.models import PullPayload


class PullAction(BaseAction[PullPayload]):
    name = "pull"
    payload_model = PullPayload
    streaming = True
    upstream_operations = frozenset({"pull"})
    needs_internet = True

    async def run(self, payload: PullPayload, ctx: ActionContext) -> dict[str, Any]:
        body = dump_for_upstream(payload)
        body["stream"] = payload.stream
        try:
            return await relay(ctx, "/api/pull", body, StatusAggregator)
        except Exception as exc:
            mapped = translate(exc)
            if mapped is None:
                raise
            raise with_internet_hint(mapped, "pull") from exc
        finally:
            ctx.cache.invalidate()
