"""The ``OllamaClient`` interface that handlers depend on, plus upstream exceptions."""

from __future__ import annotations

from collections.abc import AsyncGenerator, AsyncIterator, Mapping
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class UpstreamResponse:
    """One non-streaming upstream answer. ``body`` is parsed JSON, or None when absent."""

    status: int
    body: Any = None

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300

    def error_message(self) -> str | None:
        if isinstance(self.body, dict) and isinstance(self.body.get("error"), str):
            return str(self.body["error"])
        return None

    def as_dict(self) -> dict[str, Any]:
        return dict(self.body) if isinstance(self.body, dict) else {}


class UpstreamUnavailableError(Exception):
    """Ollama could not be reached (refused, reset, DNS-free connect failure)."""


class UpstreamHTTPError(Exception):
    """A streaming call answered with a non-200 status before any chunk."""

    def __init__(self, status: int, body: Any = None) -> None:
        super().__init__(f"upstream status {status}")
        self.response = UpstreamResponse(status, body)


class UpstreamStreamError(Exception):
    """Ollama sent an NDJSON line with an ``error`` field while the status stayed 200 [R18]."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class OllamaClient(Protocol):
    """Thin async HTTP surface. Handlers never see httpx."""

    async def call(
        self, method: str, path: str, body: Mapping[str, Any] | None = None
    ) -> UpstreamResponse:
        """One request, one JSON answer. Never raises for HTTP status."""
        ...

    def stream(
        self, method: str, path: str, body: Mapping[str, Any] | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        """Yield parsed NDJSON objects. Raises ``UpstreamHTTPError`` on a non-200 status,
        ``UpstreamStreamError`` on an error line. Closing the iterator closes the stream."""
        ...

    async def head(self, path: str) -> int:
        """HEAD request; returns the status code only."""
        ...

    async def upload(
        self, path: str, chunks: AsyncIterator[bytes], content_length: int
    ) -> UpstreamResponse:
        """POST an octet-stream body without buffering it in memory."""
        ...

    async def aclose(self) -> None: ...
