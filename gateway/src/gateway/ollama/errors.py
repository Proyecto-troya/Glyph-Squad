"""Map upstream failures to gateway error codes [R18][R6][R27]."""

from __future__ import annotations

from typing import Any

from gateway.ollama.client import (
    UpstreamHTTPError,
    UpstreamResponse,
    UpstreamStreamError,
    UpstreamUnavailable,
)
from gateway.protocol.errors import ErrorCode, GatewayError

STATUS_TO_CODE: dict[int, ErrorCode] = {
    400: ErrorCode.INVALID_REQUEST,
    404: ErrorCode.MODEL_NOT_FOUND,
    413: ErrorCode.PAYLOAD_TOO_LARGE,
    429: ErrorCode.UPSTREAM_BUSY,
    500: ErrorCode.UPSTREAM_ERROR,
    502: ErrorCode.CLOUD_MODEL_BLOCKED,
    503: ErrorCode.UPSTREAM_BUSY,
}


def code_for_status(status: int) -> ErrorCode:
    if status in STATUS_TO_CODE:
        return STATUS_TO_CODE[status]
    if 400 <= status < 500:
        return ErrorCode.INVALID_REQUEST
    return ErrorCode.UPSTREAM_ERROR


def error_from_response(response: UpstreamResponse) -> GatewayError:
    code = code_for_status(response.status)
    message = response.error_message() or f"upstream returned HTTP {response.status}"
    if response.status == 503:
        message = f"{message} (Ollama queue full; see OLLAMA_MAX_QUEUE)"
    return GatewayError(code, message, {"upstream_status": response.status})


def ensure_ok(response: UpstreamResponse) -> dict[str, Any]:
    """Return the JSON body of a 2xx response or raise the mapped ``GatewayError``."""
    if not response.ok:
        raise error_from_response(response)
    return response.as_dict()


def translate(exc: BaseException) -> GatewayError | None:
    """Convert a known upstream exception into a ``GatewayError``; None for anything else."""
    if isinstance(exc, GatewayError):
        return exc
    if isinstance(exc, UpstreamHTTPError):
        return error_from_response(exc.response)
    if isinstance(exc, UpstreamStreamError):
        return GatewayError(ErrorCode.UPSTREAM_ERROR, exc.message, {"mid_stream": True})
    if isinstance(exc, UpstreamUnavailable):
        return GatewayError(ErrorCode.UPSTREAM_UNAVAILABLE, f"Ollama is unreachable: {exc}")
    return None
