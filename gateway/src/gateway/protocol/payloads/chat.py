"""POST /api/chat payload [R4], with guide fields [R20][R22]."""

from __future__ import annotations

from pydantic import Field

from gateway.protocol.payloads.common import (
    ChatMessage,
    FormatValue,
    KeepAlive,
    ModelName,
    ModelOptions,
    StrictPayload,
    ThinkValue,
    ToolDefinition,
)


class ChatPayload(StrictPayload):
    model: ModelName
    messages: list[ChatMessage] = Field(min_length=1)
    tools: list[ToolDefinition] | None = None
    format: FormatValue | None = None
    stream: bool = True
    think: ThinkValue = None
    keep_alive: KeepAlive | None = None
    options: ModelOptions | None = None
    logprobs: bool | None = None
    top_logprobs: int | None = None

    @property
    def has_images(self) -> bool:
        return any(message.images for message in self.messages)
