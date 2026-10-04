"""Second layer against cloud models: inspect ``/api/tags`` for remote markers [R8][R2].

The first layer is ``OLLAMA_NO_CLOUD=1`` on the Ollama server. Name suffixes are
not used: both ``:cloud`` and ``-cloud`` exist and neither is authoritative.
"""

from __future__ import annotations

from gateway.ollama.cache import ModelInfoCache
from gateway.protocol.errors import ErrorCode, GatewayError


async def ensure_local_model(cache: ModelInfoCache, model: str) -> None:
    tag = await cache.find_tag(model)
    if tag is not None and tag.is_remote:
        raise GatewayError(
            ErrorCode.CLOUD_MODEL_BLOCKED,
            f"'{model}' is a cloud model; only local models are allowed",
            {"model": model, "remote_model": tag.remote_model, "remote_host": tag.remote_host},
        )
