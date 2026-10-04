"""load / unload: POST /api/generate with only ``model`` and ``keep_alive`` [R3][R27]."""

from __future__ import annotations

from gateway.protocol.payloads.common import KeepAlive, ModelName, StrictPayload


class LoadPayload(StrictPayload):
    """``keep_alive: -1`` keeps the model loaded until unloaded. Omitted uses the server default."""

    model: ModelName
    keep_alive: KeepAlive | None = None


class UnloadPayload(StrictPayload):
    """The handler always sends ``keep_alive: 0``."""

    model: ModelName
