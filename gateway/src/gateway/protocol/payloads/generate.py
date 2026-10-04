"""POST /api/generate payload [R3]."""

from __future__ import annotations

from gateway.protocol.payloads.common import (
    Base64Image,
    FormatValue,
    KeepAlive,
    ModelName,
    ModelOptions,
    StrictPayload,
    ThinkValue,
)


class GeneratePayload(StrictPayload):
    model: ModelName
    prompt: str | None = None
    suffix: str | None = None
    images: list[Base64Image] | None = None
    format: FormatValue | None = None
    system: str | None = None
    stream: bool = True
    think: ThinkValue = None
    raw: bool | None = None
    keep_alive: KeepAlive | None = None
    options: ModelOptions | None = None
    logprobs: bool | None = None
    top_logprobs: int | None = None

    @property
    def has_images(self) -> bool:
        return bool(self.images)
