"""blob_upload: POST /api/blobs/{digest} [R2][R26].

GGUF files never cross the WebSocket. The client names a file inside IMPORT_DIR;
the gateway rejects traversal, hashes the file itself and streams it to Ollama.
"""

from __future__ import annotations

import asyncio
import hashlib
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from gateway.actions.base import ActionContext, BaseAction
from gateway.ollama.errors import error_from_response
from gateway.protocol.errors import ErrorCode, GatewayError
from gateway.protocol.payloads.models import BlobUploadPayload

CHUNK = 8 * 1024 * 1024


def resolve_import_file(import_dir: Path | None, name: str) -> Path:
    """Resolve ``name`` inside ``import_dir`` or raise. Symlinks that escape are rejected."""
    if import_dir is None:
        raise GatewayError(
            ErrorCode.ACTION_DISABLED, "blob_upload needs GATEWAY_IMPORT_DIR to be set"
        )
    root = import_dir.resolve()
    candidate = (root / name).resolve()
    if candidate.parent != root:
        raise GatewayError(
            ErrorCode.INVALID_REQUEST, "file must be directly inside IMPORT_DIR", {"file": name}
        )
    if not candidate.is_file():
        raise GatewayError(ErrorCode.INVALID_REQUEST, "file not found in IMPORT_DIR", {"file": name})
    return candidate


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while block := handle.read(CHUNK):
            digest.update(block)
    return f"sha256:{digest.hexdigest()}"


async def read_chunks(path: Path) -> AsyncIterator[bytes]:
    with path.open("rb") as handle:
        while block := await asyncio.to_thread(handle.read, CHUNK):
            yield block


class BlobUploadAction(BaseAction[BlobUploadPayload]):
    name = "blob_upload"
    payload_model = BlobUploadPayload
    upstream_operations = frozenset({"createBlob"})

    async def run(self, payload: BlobUploadPayload, ctx: ActionContext) -> dict[str, Any]:
        path = resolve_import_file(ctx.settings.import_dir, payload.file)
        digest = await asyncio.to_thread(sha256_of, path)
        size = path.stat().st_size
        response = await ctx.client.upload(f"/api/blobs/{digest}", read_chunks(path), size)
        if response.status not in (200, 201):
            raise error_from_response(response)
        return {
            "file": payload.file,
            "digest": digest,
            "size": size,
            "created": response.status == 201,
        }
