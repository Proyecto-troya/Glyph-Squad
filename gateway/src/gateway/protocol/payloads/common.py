"""Shared field types: model names, images, keep_alive, think, options, messages, tools."""

from __future__ import annotations

import base64
import binascii
import re
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StrictBool,
    StrictFloat,
    StrictInt,
    StrictStr,
    StringConstraints,
    model_validator,
)

ModelName = Annotated[str, StringConstraints(min_length=1, pattern=r"\S")]

# Duration string such as "5m", seconds as a number, -1 keeps loaded, 0 unloads.
KeepAlive = StrictStr | StrictInt | StrictFloat

# bool on/off, exact level string from /api/show, or None for the model default.
# Strict types reject numbers such as 1 or 0.5 (Ollama does not support them).
ThinkValue = StrictBool | StrictStr | None

FormatValue = Literal["json"] | dict[str, Any]

_URL_LIKE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")  # data:, http:, file:, c:
_FILE_EXT = re.compile(r"\.(png|jpe?g|webp|gif|bmp|tiff?|heic|svg)$", re.IGNORECASE)


class StrictPayload(BaseModel):
    """Base for every payload: unknown fields are rejected."""

    model_config = ConfigDict(extra="forbid")


def validate_base64_image(value: str) -> str:
    """Accept only inline base64 data. File paths, URLs and data URLs are rejected."""
    stripped = value.strip()
    if not stripped:
        raise ValueError("image must be non-empty base64")
    if _URL_LIKE.match(stripped):
        raise ValueError("images must be base64 strings, not URLs or data URLs")
    # '.', '~' and '\\' never appear in base64, so they mark a file path. A leading '/'
    # is legal base64 (JPEG data starts with "/9j/"), so it is not used as a signal.
    if any(ch in stripped for ch in ".~\\") or _FILE_EXT.search(stripped):
        raise ValueError("images must be base64 strings, not file paths")
    try:
        decoded = base64.b64decode(stripped, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("image is not valid base64") from exc
    if not decoded:
        raise ValueError("image decodes to zero bytes")
    return stripped


def _sniff(decoded: bytes) -> str | None:
    if decoded.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if decoded.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if decoded[:4] == b"RIFF" and decoded[8:12] == b"WEBP":
        return "webp"
    return None


def validate_decision_image(value: str) -> str:
    """System One accepts PNG, JPEG or WebP only."""
    cleaned = validate_base64_image(value)
    if _sniff(base64.b64decode(cleaned, validate=True)) is None:
        raise ValueError("systemone images must be PNG, JPEG or WebP")
    return cleaned


Base64Image = Annotated[str, AfterValidator(validate_base64_image)]
DecisionImage = Annotated[str, AfterValidator(validate_decision_image)]


class ModelOptions(BaseModel):
    """Runtime options. Ollama accepts more keys than the spec lists, so extras pass through."""

    model_config = ConfigDict(extra="allow")

    seed: int | None = None
    temperature: float | None = None
    top_k: int | None = None
    top_p: float | None = None
    min_p: float | None = None
    stop: str | list[str] | None = None
    num_ctx: int | None = None
    num_predict: int | None = None


class ToolCallFunction(StrictPayload):
    index: int | None = None
    name: str = Field(min_length=1)
    description: str | None = None
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolCall(StrictPayload):
    """``type`` and ``function.index`` come from the tool-calling guide, not the spec."""

    type: Literal["function"] = "function"
    function: ToolCallFunction


class ToolFunctionDefinition(StrictPayload):
    name: str = Field(min_length=1)
    description: str | None = None
    parameters: dict[str, Any] | None = None


class ToolDefinition(StrictPayload):
    type: Literal["function"]
    function: ToolFunctionDefinition


Role = Literal["system", "user", "assistant", "tool"]


class ChatMessage(StrictPayload):
    """Spec ChatMessage plus ``thinking`` (assistant) and ``tool_name`` (tool results)."""

    role: Role
    content: str = ""
    images: list[Base64Image] | None = None
    tool_calls: list[ToolCall] | None = None
    thinking: str | None = None
    tool_name: str | None = None

    @model_validator(mode="after")
    def _fields_match_role(self) -> ChatMessage:
        if self.role != "assistant" and (self.tool_calls is not None or self.thinking is not None):
            raise ValueError("tool_calls and thinking are only valid on assistant messages")
        if self.role != "tool" and self.tool_name is not None:
            raise ValueError("tool_name is only valid on tool messages")
        return self


def dump_for_upstream(model: BaseModel) -> dict[str, Any]:
    """Serialize a payload for Ollama: aliases on, unset fields off, nulls off."""
    return model.model_dump(by_alias=True, exclude_unset=True, exclude_none=True)
