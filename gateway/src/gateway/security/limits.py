"""Message-size limits. Requests that carry images get a separate, larger cap."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from gateway.protocol.errors import ErrorCode, GatewayError


def mentions_images(payload: Any) -> bool:
    """Cheap structural check on the raw payload, before full validation."""
    if not isinstance(payload, dict):
        return False
    if payload.get("images"):
        return True
    messages = payload.get("messages")
    if isinstance(messages, list):
        return any(isinstance(m, dict) and m.get("images") for m in messages)
    return False


@dataclass(frozen=True)
class SizeLimits:
    max_message_bytes: int
    max_image_message_bytes: int

    def hard_cap(self) -> int:
        return max(self.max_message_bytes, self.max_image_message_bytes)

    def check(self, size: int, has_images: bool) -> None:
        limit = self.max_image_message_bytes if has_images else self.max_message_bytes
        if size > limit:
            kind = "image request" if has_images else "message"
            raise GatewayError(
                ErrorCode.PAYLOAD_TOO_LARGE,
                f"{kind} is {size} bytes; the limit is {limit}",
                {"size": size, "limit": limit, "has_images": has_images},
            )
