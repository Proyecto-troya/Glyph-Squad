"""Gateway error codes and the exception that carries them to the client."""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    """Every error code a client can receive. The README documents each one."""

    INVALID_REQUEST = "INVALID_REQUEST"
    UNKNOWN_ACTION = "UNKNOWN_ACTION"
    ACTION_DISABLED = "ACTION_DISABLED"
    UNAUTHORIZED = "UNAUTHORIZED"
    PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE"
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    CLOUD_MODEL_BLOCKED = "CLOUD_MODEL_BLOCKED"
    UNSUPPORTED_VERSION = "UNSUPPORTED_VERSION"
    UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE"
    UPSTREAM_BUSY = "UPSTREAM_BUSY"
    UPSTREAM_ERROR = "UPSTREAM_ERROR"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"


class GatewayError(Exception):
    """An error that ends a request with an ``error`` frame."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details

    def to_data(self) -> dict[str, Any]:
        data: dict[str, Any] = {"code": self.code.value, "message": self.message}
        if self.details:
            data["details"] = self.details
        return data
