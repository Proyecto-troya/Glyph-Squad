"""Composition root: build the app, wire the client, cache, registry and transport."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from gateway import __version__
from gateway.actions.base import ActionContext
from gateway.actions.registry import ActionRegistry, build_default_registry
from gateway.config import Settings
from gateway.ollama.cache import ModelInfoCache
from gateway.ollama.client import OllamaClient
from gateway.ollama.httpx_client import HttpxOllamaClient
from gateway.ollama.version import VersionGate
from gateway.protocol.errors import GatewayError
from gateway.transport.runtime import Emit, GatewayRuntime
from gateway.transport.ws import router as ws_router

log = logging.getLogger("gateway")


def create_app(
    settings: Settings | None = None,
    client: OllamaClient | None = None,
    registry: ActionRegistry | None = None,
) -> FastAPI:
    """``client`` and ``registry`` are injectable for tests; production builds the defaults."""
    settings = settings or Settings()
    registry = registry or build_default_registry()
    owns_client = client is None

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        upstream = client or HttpxOllamaClient(
            settings.ollama_url, settings.upstream_connect_timeout_s
        )
        cache = ModelInfoCache(upstream, settings.cache_ttl_s)

        async def execute(action: str, raw: dict[str, Any], emit: Emit) -> dict[str, Any]:
            ctx = ActionContext(client=upstream, cache=cache, settings=settings, emit=emit)
            return await registry.execute(action, raw, ctx)

        app.state.runtime = GatewayRuntime(settings=settings, execute=execute)
        await _probe_upstream(cache, settings)
        try:
            yield
        finally:
            if owns_client:
                await upstream.aclose()

    app = FastAPI(title="Leaf Plate gateway", version=__version__, lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.include_router(ws_router)
    return app


async def _probe_upstream(cache: ModelInfoCache, settings: Settings) -> None:
    """Log the upstream version and feature gates at startup [R16]. Failure is not fatal."""
    enabled = ", ".join(sorted(settings.enabled_actions))
    log.info("enabled actions: %s", enabled)
    try:
        gate = VersionGate(await cache.version())
    except GatewayError as exc:
        log.warning("Ollama not reachable at startup (%s); will retry per request", exc.message)
        return
    log.info("Ollama %s at %s", gate.version, settings.ollama_url)
    if not gate.supports_systemone:
        log.warning("Ollama %s is below 0.35.0: systemone will answer UNSUPPORTED_VERSION",
                    gate.version)
    elif not gate.supports_systemone_images:
        log.warning("Ollama %s is below 0.35.1: systemone images are unsupported", gate.version)
