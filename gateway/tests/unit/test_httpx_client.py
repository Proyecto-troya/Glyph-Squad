"""The httpx adapter against a MockTransport: JSON calls, NDJSON streams, errors, uploads."""

import json
from collections.abc import AsyncIterator

import httpx
import pytest

from gateway.ollama.client import UpstreamHTTPError, UpstreamStreamError, UpstreamUnavailableError
from gateway.ollama.httpx_client import HttpxOllamaClient

BASE = "http://127.0.0.1:11434"


def _client(handler: httpx.MockTransport) -> HttpxOllamaClient:
    return HttpxOllamaClient(BASE, connect_timeout_s=1, transport=handler)


async def test_call_json_and_delete_with_body() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"ok": True})

    client = _client(httpx.MockTransport(handle))
    resp = await client.call("DELETE", "/api/delete", {"model": "x"})
    assert resp.status == 200 and resp.body == {"ok": True}
    assert seen[0].method == "DELETE"
    assert json.loads(seen[0].content) == {"model": "x"}
    assert "authorization" not in {k.lower() for k in seen[0].headers}
    await client.aclose()


async def test_call_non_json_body_becomes_error_text() -> None:
    client = _client(httpx.MockTransport(lambda r: httpx.Response(500, text="boom")))
    resp = await client.call("GET", "/api/tags")
    assert resp.status == 500 and resp.error_message() == "boom"


async def test_stream_yields_objects_and_detects_error_line() -> None:
    body = b'{"response":"a","done":false}\n\n{"response":"b","done":false}\n{"error":"bad"}\n'
    client = _client(httpx.MockTransport(lambda r: httpx.Response(200, content=body)))
    seen = []
    with pytest.raises(UpstreamStreamError, match="bad"):
        async for chunk in client.stream("POST", "/api/generate", {"model": "m"}):
            seen.append(chunk["response"])
    assert seen == ["a", "b"]


async def test_stream_non_200_raises_before_first_chunk() -> None:
    client = _client(
        httpx.MockTransport(lambda r: httpx.Response(404, json={"error": "model not found"}))
    )
    with pytest.raises(UpstreamHTTPError) as info:
        async for _ in client.stream("POST", "/api/chat", {"model": "m"}):
            pytest.fail("no chunks expected")
    assert info.value.response.status == 404
    assert info.value.response.error_message() == "model not found"


async def test_connect_errors_become_unavailable() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    client = _client(httpx.MockTransport(refuse))
    with pytest.raises(UpstreamUnavailableError):
        await client.call("GET", "/api/version")
    with pytest.raises(UpstreamUnavailableError):
        async for _ in client.stream("POST", "/api/chat", {}):
            pass
    with pytest.raises(UpstreamUnavailableError):
        await client.head("/api/blobs/sha256:00")


async def test_head_and_upload() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.method == "HEAD":
            return httpx.Response(404)
        return httpx.Response(201)

    client = _client(httpx.MockTransport(handle))
    assert await client.head("/api/blobs/sha256:ab") == 404

    async def chunks() -> AsyncIterator[bytes]:
        yield b"abc"
        yield b"def"

    resp = await client.upload("/api/blobs/sha256:ab", chunks(), 6)
    assert resp.status == 201
    assert seen[1].headers["content-type"] == "application/octet-stream"
    assert seen[1].headers["content-length"] == "6"
    assert seen[1].content == b"abcdef"
