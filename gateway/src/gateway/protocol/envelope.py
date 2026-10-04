"""Request envelope and response frames.

Request:  ``{"v": 1, "id": "<uuid>", "action": "chat", "payload": {...}}``
Cancel:   ``{"v": 1, "id": "<uuid>", "action": "cancel"}``
Response: ``{"id": "<uuid>", "type": "chunk" | "result" | "error", "data": {...}}``
"""

from __future__ import annotations

import json
import re
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from gateway.protocol.errors import ErrorCode, GatewayError

PROTOCOL_VERSION = 1
CANCEL_ACTION = "cancel"
ACTION_PATTERN = r"^[a-z][a-z0-9_]{0,63}$"


class RequestEnvelope(BaseModel):
    """Strict envelope. Unknown keys are rejected; types are not coerced."""

    model_config = ConfigDict(extra="forbid", strict=True)

    v: Literal[1]
    id: str = Field(min_length=1, max_length=128)
    action: str = Field(pattern=ACTION_PATTERN)
    payload: dict[str, Any] | None = None

    @property
    def is_cancel(self) -> bool:
        return self.action == CANCEL_ACTION


class ResponseType(StrEnum):
    CHUNK = "chunk"
    RESULT = "result"
    ERROR = "error"


class ResponseEnvelope(BaseModel):
    """Shape of every frame the gateway sends. Exported as JSON Schema for clients."""

    model_config = ConfigDict(extra="forbid")

    id: str | None
    type: ResponseType
    data: dict[str, Any]


def chunk_frame(request_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"id": request_id, "type": ResponseType.CHUNK.value, "data": data}


def result_frame(request_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"id": request_id, "type": ResponseType.RESULT.value, "data": data}


def error_frame(request_id: str | None, error: GatewayError) -> dict[str, Any]:
    return {"id": request_id, "type": ResponseType.ERROR.value, "data": error.to_data()}


def extract_request_id(raw: Any) -> str | None:
    """Best-effort id for error frames when the envelope itself is invalid."""
    if isinstance(raw, dict):
        candidate = raw.get("id")
        if isinstance(candidate, str) and 0 < len(candidate) <= 128:
            return candidate
    return None


_ID_RE = re.compile(r'"id"\s*:\s*"([^"\\]{1,128})"')


def sniff_request_id(text: str, limit: int = 4096) -> str | None:
    """Pull an id out of a frame too large to parse, so the error can still carry it."""
    match = _ID_RE.search(text[:limit])
    return match.group(1) if match else None


def parse_envelope(text: str) -> RequestEnvelope:
    """Parse one text frame. Raises ``GatewayError(INVALID_REQUEST)`` with the id if known."""
    try:
        raw: Any = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GatewayError(ErrorCode.INVALID_REQUEST, f"malformed JSON: {exc.msg}") from exc
    if not isinstance(raw, dict):
        raise GatewayError(ErrorCode.INVALID_REQUEST, "envelope must be a JSON object")
    try:
        return RequestEnvelope.model_validate(raw)
    except ValidationError as exc:
        raise GatewayError(
            ErrorCode.INVALID_REQUEST,
            "invalid envelope",
            {"id": extract_request_id(raw), "errors": _compact_errors(exc)},
        ) from exc


def _compact_errors(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {"loc": [str(part) for part in err["loc"]], "msg": err["msg"], "type": err["type"]}
        for err in exc.errors(include_url=False, include_context=False, include_input=False)
    ]
