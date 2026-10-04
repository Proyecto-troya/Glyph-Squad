"""Shared builders for unit and transport tests."""

from __future__ import annotations

from typing import Any

from pydantic import SecretStr

from gateway.actions.base import ActionContext
from gateway.config import Settings
from gateway.ollama.cache import ModelInfoCache
from tests.fakes import FakeOllamaClient

ALL_ACTIONS = frozenset(
    {
        "version",
        "list",
        "show",
        "ps",
        "load",
        "unload",
        "generate",
        "chat",
        "embed",
        "systemone",
        "create",
        "blob_exists",
        "blob_upload",
        "copy",
        "delete",
        "pull",
        "push",
        "ping",
    }
)

TOKEN = "test-token"


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {"token": SecretStr(TOKEN), "enabled_actions": ALL_ACTIONS}
    values.update(overrides)
    return Settings(**values)


class Emitted:
    def __init__(self) -> None:
        self.chunks: list[dict[str, Any]] = []

    async def __call__(self, chunk: dict[str, Any]) -> None:
        self.chunks.append(chunk)


def make_ctx(
    fake: FakeOllamaClient | None = None, settings: Settings | None = None
) -> tuple[ActionContext, FakeOllamaClient, Emitted]:
    fake = fake or FakeOllamaClient()
    settings = settings or make_settings()
    emitted = Emitted()
    cache = ModelInfoCache(fake, ttl_s=settings.cache_ttl_s)
    return ActionContext(client=fake, cache=cache, settings=settings, emit=emitted), fake, emitted
