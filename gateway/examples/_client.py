"""Minimal gateway client shared by the examples.

Runtime: ``websockets.sync.client`` over a ``WsTransport``. Tests inject Starlette's
``WebSocketTestSession`` instead, so every example runs against the fake Ollama.
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any, Protocol

from websockets.sync.client import ClientConnection
from websockets.sync.client import connect as ws_connect

DEFAULT_URL = "ws://127.0.0.1:8765/ws"
MAX_FRAME = 64 * 1024 * 1024

OnChunk = Callable[[dict[str, Any]], None]


class WsTransport(Protocol):
    def send_text(self, data: str) -> None: ...
    def receive_text(self) -> str: ...


class GatewayClientError(Exception):
    def __init__(self, request_id: str | None, data: dict[str, Any]) -> None:
        super().__init__(f"{data.get('code')}: {data.get('message')}")
        self.request_id = request_id
        self.code = str(data.get("code"))
        self.message = str(data.get("message"))
        self.details = data.get("details")


class WebsocketsTransport:
    def __init__(self, connection: ClientConnection) -> None:
        self._conn = connection

    def send_text(self, data: str) -> None:
        self._conn.send(data)

    def receive_text(self) -> str:
        frame = self._conn.recv()
        return frame if isinstance(frame, str) else frame.decode("utf-8")


class GatewayClient:
    """Requests are matched by id, so several can be in flight on one socket."""

    def __init__(self, transport: WsTransport) -> None:
        self._t = transport
        self._pending: dict[str, list[dict[str, Any]]] = {}

    def start(self, action: str, payload: dict[str, Any] | None = None) -> str:
        request_id = str(uuid.uuid4())
        frame: dict[str, Any] = {"v": 1, "id": request_id, "action": action}
        if payload is not None:
            frame["payload"] = payload
        self._t.send_text(json.dumps(frame))
        return request_id

    def cancel(self, request_id: str) -> None:
        self._t.send_text(json.dumps({"v": 1, "id": request_id, "action": "cancel"}))

    def wait(self, request_id: str, on_chunk: OnChunk | None = None) -> dict[str, Any]:
        """Block until this id's ``result``; raise ``GatewayClientError`` on ``error``."""
        while True:
            frame = self._next_frame_for(request_id)
            kind = frame["type"]
            if kind == "chunk":
                if on_chunk is not None:
                    on_chunk(frame["data"])
                continue
            if kind == "result":
                return dict(frame["data"])
            raise GatewayClientError(request_id, frame["data"])

    def request(
        self, action: str, payload: dict[str, Any] | None = None, on_chunk: OnChunk | None = None
    ) -> dict[str, Any]:
        return self.wait(self.start(action, payload), on_chunk)

    def _next_frame_for(self, request_id: str) -> dict[str, Any]:
        queued = self._pending.get(request_id)
        if queued:
            return queued.pop(0)
        while True:
            frame: dict[str, Any] = json.loads(self._t.receive_text())
            frame_id = frame.get("id")
            if frame_id == request_id:
                return frame
            if frame_id is None:
                raise GatewayClientError(None, frame["data"])
            self._pending.setdefault(str(frame_id), []).append(frame)


@contextmanager
def connect(url: str, token: str) -> Iterator[GatewayClient]:
    with ws_connect(
        url, additional_headers={"X-Gateway-Token": token}, max_size=MAX_FRAME
    ) as connection:
        yield GatewayClient(WebsocketsTransport(connection))


def env_url() -> str:
    return os.environ.get("GATEWAY_URL", DEFAULT_URL)


def env_token() -> str:
    token = os.environ.get("GATEWAY_TOKEN")
    if not token:
        raise SystemExit("set GATEWAY_TOKEN to the gateway's token")
    return token
