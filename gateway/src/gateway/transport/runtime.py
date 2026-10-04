"""What the transport needs from the composition root."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from gateway.config import Settings
from gateway.security.limits import SizeLimits

Emit = Callable[[dict[str, Any]], Awaitable[None]]
# (action, raw payload, emit) -> result data. Raises GatewayError for every failure.
Executor = Callable[[str, dict[str, Any], Emit], Awaitable[dict[str, Any]]]


@dataclass(frozen=True)
class GatewayRuntime:
    settings: Settings
    execute: Executor

    @property
    def limits(self) -> SizeLimits:
        return SizeLimits(self.settings.max_message_bytes, self.settings.max_image_message_bytes)
