"""version: GET /api/version [R16]. Also reports the gateway's feature gates."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import ensure_ok
from gateway.ollama.version import Version, VersionGate
from gateway.protocol.payloads.models import VersionPayload


class VersionAction(BaseAction[VersionPayload]):
    name = "version"
    payload_model = VersionPayload
    upstream_operations = frozenset({"version"})

    async def run(self, payload: VersionPayload, ctx: ActionContext) -> dict[str, Any]:
        body = ensure_ok(await ctx.client.call("GET", "/api/version"))
        raw = body.get("version")
        if isinstance(raw, str):
            gate = VersionGate(Version.parse(raw))
            body["gates"] = {
                "systemone": gate.supports_systemone,
                "systemone_images": gate.supports_systemone_images,
            }
        return body
