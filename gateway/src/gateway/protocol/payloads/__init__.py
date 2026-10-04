"""Payload models: the request contract for every action.

Built from the vendored ``docs/openapi.yaml`` plus fields that only the guides
document (``thinking`` and ``tool_name`` on chat messages, ``type`` and
``function.index`` on tool calls).
"""

from __future__ import annotations

from pydantic import BaseModel

from gateway.protocol.payloads.chat import ChatPayload
from gateway.protocol.payloads.create import CreatePayload
from gateway.protocol.payloads.embed import EmbedPayload
from gateway.protocol.payloads.generate import GeneratePayload
from gateway.protocol.payloads.lifecycle import LoadPayload, UnloadPayload
from gateway.protocol.payloads.models import (
    BlobExistsPayload,
    BlobUploadPayload,
    CopyPayload,
    DeletePayload,
    ListPayload,
    PingPayload,
    PsPayload,
    PullPayload,
    PushPayload,
    ShowPayload,
    VersionPayload,
)
from gateway.protocol.payloads.systemone import SystemOnePayload

PAYLOAD_MODELS: dict[str, type[BaseModel]] = {
    "generate": GeneratePayload,
    "chat": ChatPayload,
    "load": LoadPayload,
    "unload": UnloadPayload,
    "embed": EmbedPayload,
    "systemone": SystemOnePayload,
    "list": ListPayload,
    "ps": PsPayload,
    "show": ShowPayload,
    "version": VersionPayload,
    "create": CreatePayload,
    "blob_exists": BlobExistsPayload,
    "blob_upload": BlobUploadPayload,
    "copy": CopyPayload,
    "delete": DeletePayload,
    "pull": PullPayload,
    "push": PushPayload,
    "ping": PingPayload,
}

__all__ = [
    "PAYLOAD_MODELS",
    "BlobExistsPayload",
    "BlobUploadPayload",
    "ChatPayload",
    "CopyPayload",
    "CreatePayload",
    "DeletePayload",
    "EmbedPayload",
    "GeneratePayload",
    "ListPayload",
    "LoadPayload",
    "PingPayload",
    "PsPayload",
    "PullPayload",
    "PushPayload",
    "ShowPayload",
    "SystemOnePayload",
    "UnloadPayload",
    "VersionPayload",
]
