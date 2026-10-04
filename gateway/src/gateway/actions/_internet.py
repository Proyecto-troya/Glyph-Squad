"""Clearer errors for the two actions that leave the laptop."""

from __future__ import annotations

from gateway.protocol.errors import ErrorCode, GatewayError

_NETWORK_CODES = {ErrorCode.UPSTREAM_ERROR, ErrorCode.UPSTREAM_UNAVAILABLE}


def with_internet_hint(error: GatewayError, action: str) -> GatewayError:
    if error.code in _NETWORK_CODES:
        hint = f"{action} needs internet access; the demo laptop is offline by design"
        return GatewayError(error.code, f"{error.message} ({hint})", error.details)
    return error
