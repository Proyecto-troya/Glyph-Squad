"""Fold a stream of chunks into one ``result`` shaped like the non-streaming response [R17][R38]."""

from __future__ import annotations

from typing import Any, Protocol

USAGE_KEYS: tuple[str, ...] = (
    "total_duration",
    "load_duration",
    "prompt_eval_count",
    "prompt_eval_cached_count",
    "prompt_eval_duration",
    "eval_count",
    "eval_duration",
)


class StreamAggregator(Protocol):
    def add(self, chunk: dict[str, Any]) -> None: ...
    def result(self) -> dict[str, Any]: ...


def usage_from(chunk: dict[str, Any]) -> dict[str, Any]:
    return {key: chunk[key] for key in USAGE_KEYS if key in chunk}


class _TextAggregator:
    """Shared bookkeeping: header fields from the first chunk, usage from the ``done`` chunk."""

    def __init__(self) -> None:
        self.model: str | None = None
        self.created_at: str | None = None
        self.done_reason: str | None = None
        self.usage: dict[str, Any] = {}
        self.logprobs: list[Any] = []
        self.chunks = 0

    def _header(self, chunk: dict[str, Any]) -> None:
        self.chunks += 1
        self.model = self.model or chunk.get("model")
        self.created_at = chunk.get("created_at", self.created_at)
        if chunk.get("logprobs"):
            self.logprobs.extend(chunk["logprobs"])
        if chunk.get("done"):
            self.done_reason = chunk.get("done_reason")
            self.usage = usage_from(chunk)

    def _tail(self, out: dict[str, Any]) -> dict[str, Any]:
        out["done"] = True
        if self.done_reason is not None:
            out["done_reason"] = self.done_reason
        out.update(self.usage)
        if self.logprobs:
            out["logprobs"] = self.logprobs
        return out


class GenerateAggregator(_TextAggregator):
    def __init__(self) -> None:
        super().__init__()
        self._response: list[str] = []
        self._thinking: list[str] = []

    def add(self, chunk: dict[str, Any]) -> None:
        self._header(chunk)
        if chunk.get("response"):
            self._response.append(str(chunk["response"]))
        if chunk.get("thinking"):
            self._thinking.append(str(chunk["thinking"]))

    def result(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "model": self.model,
            "created_at": self.created_at,
            "response": "".join(self._response),
        }
        if self._thinking:
            out["thinking"] = "".join(self._thinking)
        return self._tail(out)


class ChatAggregator(_TextAggregator):
    def __init__(self) -> None:
        super().__init__()
        self._content: list[str] = []
        self._thinking: list[str] = []
        self._tool_calls: list[dict[str, Any]] = []
        self._images: list[str] = []

    def add(self, chunk: dict[str, Any]) -> None:
        self._header(chunk)
        message = chunk.get("message") or {}
        if message.get("content"):
            self._content.append(str(message["content"]))
        if message.get("thinking"):
            self._thinking.append(str(message["thinking"]))
        if message.get("tool_calls"):
            self._tool_calls.extend(message["tool_calls"])
        if message.get("images"):
            self._images.extend(message["images"])

    def result(self) -> dict[str, Any]:
        message: dict[str, Any] = {"role": "assistant", "content": "".join(self._content)}
        if self._thinking:
            message["thinking"] = "".join(self._thinking)
        if self._tool_calls:
            message["tool_calls"] = self._tool_calls
        if self._images:
            message["images"] = self._images
        out: dict[str, Any] = {
            "model": self.model,
            "created_at": self.created_at,
            "message": message,
        }
        return self._tail(out)


class StatusAggregator:
    """For create, pull and push: keep the last status event and count the rest."""

    def __init__(self) -> None:
        self.last: dict[str, Any] = {}
        self.events = 0

    def add(self, chunk: dict[str, Any]) -> None:
        self.events += 1
        self.last = chunk

    def result(self) -> dict[str, Any]:
        out: dict[str, Any] = dict(self.last)
        out["events"] = self.events
        return out
