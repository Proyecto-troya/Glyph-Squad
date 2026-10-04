"""Cached ``/api/version``, ``/api/show`` and ``/api/tags`` lookups [R8][R10][R16]."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from gateway.ollama.client import OllamaClient
from gateway.ollama.errors import ensure_ok
from gateway.ollama.version import Version
from gateway.protocol.errors import ErrorCode, GatewayError


@dataclass(frozen=True)
class ShowInfo:
    capabilities: frozenset[str]
    thinking_values: tuple[bool | str, ...] | None
    thinking_default: bool | str | None
    family: str | None
    families: tuple[str, ...]

    @property
    def is_decision_only(self) -> bool:
        return bool(self.capabilities) and self.capabilities <= {"decision"}

    @property
    def has_decision(self) -> bool:
        return "decision" in self.capabilities

    @property
    def has_vision(self) -> bool:
        return "vision" in self.capabilities

    @classmethod
    def from_show(cls, body: dict[str, Any]) -> ShowInfo:
        thinking = body.get("thinking")
        values: tuple[bool | str, ...] | None = None
        default: bool | str | None = None
        if isinstance(thinking, dict):
            raw_values = thinking.get("values")
            if isinstance(raw_values, list):
                values = tuple(v for v in raw_values if isinstance(v, bool | str))
            raw_default = thinking.get("default")
            if isinstance(raw_default, bool | str):
                default = raw_default
        details = body.get("details") or {}
        families = details.get("families") or []
        return cls(
            capabilities=frozenset(str(c) for c in body.get("capabilities") or []),
            thinking_values=values,
            thinking_default=default,
            family=details.get("family"),
            families=tuple(str(f) for f in families),
        )


@dataclass(frozen=True)
class TagInfo:
    name: str
    remote_model: str | None
    remote_host: str | None

    @property
    def is_remote(self) -> bool:
        return bool(self.remote_model) or bool(self.remote_host)


def normalize_name(model: str) -> str:
    """``gemma4`` and ``gemma4:latest`` are the same model."""
    return model if ":" in model.rsplit("/", 1)[-1] else f"{model}:latest"


class ModelInfoCache:
    """TTL cache in front of the client. One instance per app."""

    def __init__(
        self,
        client: OllamaClient,
        ttl_s: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._ttl = ttl_s
        self._clock = clock
        self._show: dict[str, tuple[float, ShowInfo]] = {}
        self._tags: tuple[float, dict[str, TagInfo]] | None = None
        self._version: Version | None = None

    def _fresh(self, stamp: float) -> bool:
        return self._clock() - stamp < self._ttl

    async def version(self) -> Version:
        if self._version is None:
            body = ensure_ok(await self._client.call("GET", "/api/version"))
            raw = body.get("version")
            if not isinstance(raw, str):
                raise GatewayError(ErrorCode.UPSTREAM_ERROR, "upstream version is missing")
            self._version = Version.parse(raw)
        return self._version

    async def show(self, model: str) -> ShowInfo:
        key = normalize_name(model)
        cached = self._show.get(key)
        if cached and self._fresh(cached[0]):
            return cached[1]
        body = ensure_ok(await self._client.call("POST", "/api/show", {"model": model}))
        info = ShowInfo.from_show(body)
        self._show[key] = (self._clock(), info)
        return info

    async def tags(self) -> dict[str, TagInfo]:
        if self._tags and self._fresh(self._tags[0]):
            return self._tags[1]
        body = ensure_ok(await self._client.call("GET", "/api/tags"))
        table: dict[str, TagInfo] = {}
        for entry in body.get("models") or []:
            name = str(entry.get("name") or entry.get("model") or "")
            if not name:
                continue
            table[normalize_name(name)] = TagInfo(
                name=name,
                remote_model=entry.get("remote_model") or None,
                remote_host=entry.get("remote_host") or None,
            )
        self._tags = (self._clock(), table)
        return table

    async def find_tag(self, model: str) -> TagInfo | None:
        return (await self.tags()).get(normalize_name(model))

    def invalidate(self, model: str | None = None) -> None:
        """Drop cached model data after create/copy/delete/pull."""
        self._tags = None
        if model is None:
            self._show.clear()
        else:
            self._show.pop(normalize_name(model), None)
