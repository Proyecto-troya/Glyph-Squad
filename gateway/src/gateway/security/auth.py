"""Token presentation on connect.

Non-browser clients send ``X-Gateway-Token``. Browsers cannot set headers, so they
offer the WebSocket subprotocols ``gateway.v1`` and ``gateway.token.<token>``; the
server selects ``gateway.v1`` so the token is never echoed back. Query strings are
not accepted: they would land in access logs.
"""

from __future__ import annotations

import secrets
from collections.abc import Iterable, Mapping

from pydantic import SecretStr

TOKEN_HEADER = "x-gateway-token"  # noqa: S105 (a header name, not a secret)
PROTOCOL_NAME = "gateway.v1"
TOKEN_PROTOCOL_PREFIX = "gateway.token."  # noqa: S105 (a prefix, not a secret)


def split_subprotocols(header_value: str | None) -> list[str]:
    if not header_value:
        return []
    return [part.strip() for part in header_value.split(",") if part.strip()]


def presented_token(headers: Mapping[str, str], subprotocols: Iterable[str]) -> str | None:
    """Header first, then the token subprotocol. Returns None when neither is present."""
    header = headers.get(TOKEN_HEADER)
    if header:
        return header.strip()
    for proto in subprotocols:
        if proto.startswith(TOKEN_PROTOCOL_PREFIX) and len(proto) > len(TOKEN_PROTOCOL_PREFIX):
            return proto[len(TOKEN_PROTOCOL_PREFIX) :]
    return None


def token_matches(presented: str | None, expected: SecretStr) -> bool:
    if not presented:
        return False
    return secrets.compare_digest(presented.encode(), expected.get_secret_value().encode())


def select_subprotocol(subprotocols: Iterable[str]) -> str | None:
    """Echo ``gateway.v1`` when offered; never echo the token protocol."""
    return PROTOCOL_NAME if PROTOCOL_NAME in set(subprotocols) else None
