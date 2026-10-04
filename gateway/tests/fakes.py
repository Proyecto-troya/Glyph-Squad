"""Programmable in-memory ``OllamaClient`` used by unit, transport and example tests."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator, AsyncIterator, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

from gateway.ollama.client import (
    UpstreamHTTPError,
    UpstreamResponse,
    UpstreamStreamError,
    UpstreamUnavailableError,
)

Key = tuple[str, str]
Responder = Callable[[dict[str, Any] | None], UpstreamResponse]


@dataclass
class RecordedCall:
    method: str
    path: str
    body: dict[str, Any] | None


LOCAL_MODELS: list[dict[str, Any]] = [
    {
        "name": "gemma4:latest",
        "model": "gemma4:latest",
        "size": 1,
        "digest": "d1",
        "details": {"family": "gemma4", "families": ["gemma4"]},
    },
    {
        "name": "qwen3:latest",
        "model": "qwen3:latest",
        "size": 1,
        "digest": "d2",
        "details": {"family": "qwen3", "families": ["qwen3"]},
    },
    {
        "name": "nimble:latest",
        "model": "nimble:latest",
        "size": 1,
        "digest": "d3",
        "details": {"family": "nimble", "families": ["nimble"]},
    },
    {
        "name": "clef-flash:latest",
        "model": "clef-flash:latest",
        "size": 1,
        "digest": "d4",
        "details": {"family": "clef", "families": ["clef"]},
    },
    {
        "name": "embeddinggemma:latest",
        "model": "embeddinggemma:latest",
        "size": 1,
        "digest": "d5",
        "details": {"family": "gemma3", "families": ["gemma3"]},
    },
    {
        "name": "gpt-oss:120b-cloud",
        "model": "gpt-oss:120b-cloud",
        "size": 0,
        "digest": "d6",
        "remote_model": "gpt-oss:120b",
        "remote_host": "https://ollama.com:443",
        "details": {"family": "gptoss", "families": ["gptoss"]},
    },
]

SHOW: dict[str, dict[str, Any]] = {
    "gemma4:latest": {
        "capabilities": ["completion", "vision", "thinking"],
        "thinking": {"values": [False, True], "default": True},
        "details": {"family": "gemma4", "families": ["gemma4"]},
    },
    "qwen3:latest": {
        "capabilities": ["completion", "tools", "thinking"],
        "thinking": {"values": ["low", "medium", "high"], "default": "medium"},
        "details": {"family": "qwen3", "families": ["qwen3"]},
    },
    "nimble:latest": {
        "capabilities": ["decision"],
        "details": {"family": "nimble", "families": ["nimble"]},
    },
    "clef-flash:latest": {
        "capabilities": ["decision", "vision"],
        "details": {"family": "clef", "families": ["clef"]},
    },
    "embeddinggemma:latest": {
        "capabilities": ["embedding"],
        "details": {"family": "gemma3", "families": ["gemma3"]},
    },
    "gpt-oss:120b-cloud": {
        "capabilities": ["completion", "tools", "thinking"],
        "thinking": {"values": ["low", "medium", "high"], "default": "medium"},
        "details": {"family": "gptoss", "families": ["gptoss"]},
    },
}

CHAT_CHUNKS: list[dict[str, Any]] = [
    {
        "model": "gemma4",
        "created_at": "t0",
        "message": {"role": "assistant", "content": "Hel"},
        "done": False,
    },
    {
        "model": "gemma4",
        "created_at": "t1",
        "message": {"role": "assistant", "content": "lo"},
        "done": False,
    },
    {
        "model": "gemma4",
        "created_at": "t2",
        "message": {"role": "assistant", "content": ""},
        "done": True,
        "done_reason": "stop",
        "total_duration": 300,
        "load_duration": 100,
        "prompt_eval_count": 5,
        "prompt_eval_duration": 50,
        "eval_count": 2,
        "eval_duration": 20,
    },
]


def _norm(model: str) -> str:
    return model if ":" in model else f"{model}:latest"


@dataclass
class FakeOllamaClient:
    """Default answers cover the demo models; tests override with ``on`` / ``on_stream``."""

    version: str = "0.35.1"
    unavailable: bool = False
    chunk_delay_s: float = 0.0
    head_statuses: dict[str, int] = field(default_factory=dict)
    upload_status: int = 201
    calls: list[RecordedCall] = field(default_factory=list)
    uploads: list[tuple[str, bytes, int]] = field(default_factory=list)
    streams_opened: int = 0
    streams_closed_early: int = 0
    _responses: dict[Key, Responder] = field(default_factory=dict)
    _streams: dict[Key, Callable[[dict[str, Any] | None], list[dict[str, Any]]]] = field(
        default_factory=dict
    )
    _stream_failures: dict[Key, UpstreamHTTPError] = field(default_factory=dict)
    closed: bool = False

    # -- programming -----------------------------------------------------------------

    def on(self, method: str, path: str, status: int = 200, body: Any = None) -> None:
        self._responses[(method, path)] = lambda _b: UpstreamResponse(status, body)

    def on_fn(self, method: str, path: str, fn: Responder) -> None:
        self._responses[(method, path)] = fn

    def on_stream(self, method: str, path: str, chunks: list[dict[str, Any]]) -> None:
        self._streams[(method, path)] = lambda _b: list(chunks)

    def on_stream_fn(
        self, method: str, path: str, fn: Callable[[dict[str, Any] | None], list[dict[str, Any]]]
    ) -> None:
        self._streams[(method, path)] = fn

    def fail_stream(self, method: str, path: str, status: int, body: Any = None) -> None:
        self._stream_failures[(method, path)] = UpstreamHTTPError(status, body)

    # -- defaults --------------------------------------------------------------------

    def _default(self, method: str, path: str, body: dict[str, Any] | None) -> UpstreamResponse:
        if (method, path) == ("GET", "/api/version"):
            return UpstreamResponse(200, {"version": self.version})
        if (method, path) == ("GET", "/api/tags"):
            return UpstreamResponse(200, {"models": LOCAL_MODELS})
        if (method, path) == ("GET", "/api/ps"):
            return UpstreamResponse(200, {"models": []})
        if (method, path) == ("POST", "/api/show"):
            name = _norm(str((body or {}).get("model", "")))
            if name in SHOW:
                return UpstreamResponse(200, SHOW[name])
            return UpstreamResponse(404, {"error": f"model '{name}' not found"})
        if (method, path) == ("POST", "/api/generate"):
            return UpstreamResponse(
                200,
                {
                    "model": (body or {}).get("model"),
                    "response": "",
                    "done": True,
                    "done_reason": "load" if (body or {}).get("keep_alive", 1) != 0 else "unload",
                },
            )
        if (method, path) == ("POST", "/api/chat"):
            return UpstreamResponse(
                200,
                {
                    "model": (body or {}).get("model"),
                    "created_at": "t",
                    "message": {"role": "assistant", "content": "Hello"},
                    "done": True,
                    "done_reason": "stop",
                    "eval_count": 2,
                },
            )
        if (method, path) == ("POST", "/api/embed"):
            n = (
                len((body or {}).get("input", []))
                if isinstance((body or {}).get("input"), list)
                else 1
            )
            return UpstreamResponse(
                200,
                {
                    "model": (body or {}).get("model"),
                    "embeddings": [[1.0, 0.0]] * n,
                    "prompt_eval_count": 3,
                },
            )
        if (method, path) == ("POST", "/v1/systemone"):
            answers = {
                name: {"type": "noul", "noul": 0.93}
                for name in ((body or {}).get("questions") or {})
            }
            return UpstreamResponse(
                200,
                {
                    "model": (body or {}).get("model"),
                    "answers": answers,
                    "usage": {"input_tokens": 10, "output_tokens": 1},
                },
            )
        if (method, path) in {("POST", "/api/copy"), ("DELETE", "/api/delete")}:
            return UpstreamResponse(200, None)
        if path in {"/api/pull", "/api/push", "/api/create"}:
            return UpstreamResponse(200, {"status": "success"})
        return UpstreamResponse(404, {"error": f"no fake for {method} {path}"})

    def _default_stream(
        self, method: str, path: str, body: dict[str, Any] | None
    ) -> list[dict[str, Any]]:
        if path == "/api/chat":
            return list(CHAT_CHUNKS)
        if path == "/api/generate":
            return [
                {"model": "gemma4", "created_at": "t0", "response": "Hel", "done": False},
                {"model": "gemma4", "created_at": "t1", "response": "lo", "done": False},
                {
                    "model": "gemma4",
                    "created_at": "t2",
                    "response": "",
                    "done": True,
                    "done_reason": "stop",
                    "eval_count": 2,
                    "prompt_eval_count": 5,
                },
            ]
        return [{"status": "pulling manifest"}, {"status": "success"}]

    # -- OllamaClient ----------------------------------------------------------------

    async def call(
        self, method: str, path: str, body: Mapping[str, Any] | None = None
    ) -> UpstreamResponse:
        if self.unavailable:
            raise UpstreamUnavailableError("connection refused")
        data = dict(body) if body is not None else None
        self.calls.append(RecordedCall(method, path, data))
        responder = self._responses.get((method, path))
        return responder(data) if responder else self._default(method, path, data)

    async def stream(
        self, method: str, path: str, body: Mapping[str, Any] | None = None
    ) -> AsyncGenerator[dict[str, Any], None]:
        if self.unavailable:
            raise UpstreamUnavailableError("connection refused")
        data = dict(body) if body is not None else None
        self.calls.append(RecordedCall(method, path, data))
        self.streams_opened += 1
        failure = self._stream_failures.get((method, path))
        if failure:
            raise failure
        maker = self._streams.get((method, path))
        chunks = maker(data) if maker else self._default_stream(method, path, data)
        finished = False
        try:
            for chunk in chunks:
                if self.chunk_delay_s:
                    await asyncio.sleep(self.chunk_delay_s)
                if chunk.get("error"):
                    # Mirrors ndjson.parse_line: an error line ends the stream.
                    raise UpstreamStreamError(str(chunk["error"]))
                yield chunk
            finished = True
        finally:
            if not finished:
                self.streams_closed_early += 1

    async def head(self, path: str) -> int:
        if self.unavailable:
            raise UpstreamUnavailableError("connection refused")
        self.calls.append(RecordedCall("HEAD", path, None))
        return self.head_statuses.get(path, 404)

    async def upload(
        self, path: str, chunks: AsyncIterator[bytes], content_length: int
    ) -> UpstreamResponse:
        if self.unavailable:
            raise UpstreamUnavailableError("connection refused")
        data = b"".join([c async for c in chunks])
        self.uploads.append((path, data, content_length))
        self.calls.append(RecordedCall("POST", path, None))
        return UpstreamResponse(self.upload_status, None)

    async def aclose(self) -> None:
        self.closed = True

    # -- assertions ------------------------------------------------------------------

    def last_body(self, path: str) -> dict[str, Any]:
        for call in reversed(self.calls):
            if call.path == path:
                assert call.body is not None, f"call to {path} had no body"
                return call.body
        raise AssertionError(f"no call to {path}; calls={self.calls}")
