"""POST /api/embed payload [R5][R39].

Spec gap: the spec types ``keep_alive`` as string only here while generate and
chat accept a number too. Ollama accepts both, so this model does as well.
"""

from __future__ import annotations

from pydantic import Field

from gateway.protocol.payloads.common import KeepAlive, ModelName, ModelOptions, StrictPayload


class EmbedPayload(StrictPayload):
    model: ModelName
    input: str | list[str] = Field(min_length=1)
    truncate: bool | None = None
    dimensions: int | None = Field(default=None, ge=1)
    keep_alive: KeepAlive | None = None
    options: ModelOptions | None = None
