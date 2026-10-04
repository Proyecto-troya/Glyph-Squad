"""Small payloads: list, ps, version, ping, show, copy, delete, pull, push, blobs."""

from __future__ import annotations

from pydantic import Field, field_validator

from gateway.protocol.payloads.common import ModelName, StrictPayload
from gateway.protocol.payloads.create import DIGEST_PATTERN


class ListPayload(StrictPayload):
    """GET /api/tags takes no fields."""


class PsPayload(StrictPayload):
    """GET /api/ps takes no fields."""


class VersionPayload(StrictPayload):
    """GET /api/version takes no fields."""


class PingPayload(StrictPayload):
    """Client-initiated heartbeat; never touches Ollama."""


class ShowPayload(StrictPayload):
    model: ModelName
    verbose: bool = False


class CopyPayload(StrictPayload):
    source: ModelName
    destination: ModelName


class DeletePayload(StrictPayload):
    model: ModelName


class PullPayload(StrictPayload):
    """Needs internet. Disabled unless ``pull`` is in GATEWAY_ENABLED_ACTIONS."""

    model: ModelName
    insecure: bool = False
    stream: bool = True


class PushPayload(StrictPayload):
    """Needs internet and an ollama.com sign-in. Disabled by default."""

    model: ModelName
    insecure: bool = False
    stream: bool = True


class BlobExistsPayload(StrictPayload):
    digest: str = Field(pattern=DIGEST_PATTERN)


class BlobUploadPayload(StrictPayload):
    """``file`` is a bare file name inside GATEWAY_IMPORT_DIR. No directories, no traversal."""

    file: str = Field(min_length=1, max_length=255)

    @field_validator("file")
    @classmethod
    def _bare_name(cls, value: str) -> str:
        if value in {".", ".."} or "/" in value or "\\" in value or "\x00" in value:
            raise ValueError("file must be a bare file name inside IMPORT_DIR")
        return value
