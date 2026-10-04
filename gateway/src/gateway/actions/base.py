"""Handler contract. Handlers see Ollama through ``ActionContext``; never the WebSocket."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, ClassVar, Generic, TypeVar

from pydantic import BaseModel

from gateway.config import Settings
from gateway.ollama.cache import ModelInfoCache
from gateway.ollama.client import OllamaClient
from gateway.ollama.version import VersionGate

Emit = Callable[[dict[str, Any]], Awaitable[None]]

P = TypeVar("P", bound=BaseModel)


@dataclass
class ActionContext:
    """Everything a handler may touch. ``emit`` forwards one stream chunk to the client."""

    client: OllamaClient
    cache: ModelInfoCache
    settings: Settings
    emit: Emit

    async def version_gate(self) -> VersionGate:
        return VersionGate(await self.cache.version())


class BaseAction(Generic[P]):
    """Subclasses set the class attributes and implement ``run``."""

    name: ClassVar[str]
    payload_model: type[P]
    streaming: ClassVar[bool] = False
    # operationIds from docs/openapi.yaml this action covers (contract test).
    upstream_operations: ClassVar[frozenset[str]] = frozenset()
    needs_internet: ClassVar[bool] = False

    async def run(self, payload: P, ctx: ActionContext) -> dict[str, Any]:
        raise NotImplementedError

    def parse(self, raw: dict[str, Any]) -> P:
        return self.payload_model.model_validate(raw)
