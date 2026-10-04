"""blob_exists: HEAD /api/blobs/{digest} [R2]. 200 and 404 are both answers, not errors."""

from __future__ import annotations

from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.client import UpstreamResponse
from gateway.ollama.errors import error_from_response
from gateway.protocol.payloads.models import BlobExistsPayload


class BlobExistsAction(BaseAction[BlobExistsPayload]):
    name = "blob_exists"
    payload_model = BlobExistsPayload
    upstream_operations = frozenset({"headBlob"})

    async def run(self, payload: BlobExistsPayload, ctx: ActionContext) -> dict[str, Any]:
        status = await ctx.client.head(f"/api/blobs/{payload.digest}")
        if status == 200:
            return {"digest": payload.digest, "exists": True}
        if status == 404:
            return {"digest": payload.digest, "exists": False}
        raise error_from_response(UpstreamResponse(status, None))
