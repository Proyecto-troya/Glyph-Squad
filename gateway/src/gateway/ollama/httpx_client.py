"""httpx adapter for ``OllamaClient`` [R33]. Never sets Authorization; never leaves the IP."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Mapping
from typing import Any

import httpx

from gateway.ollama.client import UpstreamHTTPError, UpstreamResponse, UpstreamUnavailable
from gateway.ollama.ndjson import parse_line

_CONNECTION_ERRORS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.RemoteProtocolError,
    httpx.ReadError,
    httpx.WriteError,
    httpx.PoolTimeout,
)


def _parse_body(raw: bytes) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"error": raw.decode("utf-8", "replace")[:500]}


class HttpxOllamaClient:
    """Reads are unbounded on purpose: long generations are cut by the gateway's own timeout."""

    def __init__(
        self,
        base_url: str,
        connect_timeout_s: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(connect=connect_timeout_s, read=None, write=None, pool=None),
            headers={"Accept": "application/json"},
            trust_env=False,
            transport=transport,
        )

    async def call(
        self, method: str, path: str, body: Mapping[str, Any] | None = None
    ) -> UpstreamResponse:
        try:
            response = await self._client.request(
                method, path, json=dict(body) if body is not None else None
            )
        except _CONNECTION_ERRORS as exc:
            raise UpstreamUnavailable(str(exc) or exc.__class__.__name__) from exc
        return UpstreamResponse(response.status_code, _parse_body(response.content))

    async def stream(
        self, method: str, path: str, body: Mapping[str, Any] | None = None
    ) -> AsyncIterator[dict[str, Any]]:
        try:
            async with self._client.stream(
                method, path, json=dict(body) if body is not None else None
            ) as response:
                if response.status_code != 200:
                    raise UpstreamHTTPError(response.status_code, _parse_body(await response.aread()))
                async for line in response.aiter_lines():
                    obj = parse_line(line)
                    if obj is not None:
                        yield obj
        except _CONNECTION_ERRORS as exc:
            raise UpstreamUnavailable(str(exc) or exc.__class__.__name__) from exc

    async def head(self, path: str) -> int:
        try:
            response = await self._client.head(path)
        except _CONNECTION_ERRORS as exc:
            raise UpstreamUnavailable(str(exc) or exc.__class__.__name__) from exc
        return response.status_code

    async def upload(
        self, path: str, chunks: AsyncIterator[bytes], content_length: int
    ) -> UpstreamResponse:
        headers = {
            "Content-Type": "application/octet-stream",
            "Content-Length": str(content_length),
        }
        try:
            response = await self._client.post(path, content=chunks, headers=headers)
        except _CONNECTION_ERRORS as exc:
            raise UpstreamUnavailable(str(exc) or exc.__class__.__name__) from exc
        return UpstreamResponse(response.status_code, _parse_body(response.content))

    async def aclose(self) -> None:
        await self._client.aclose()
