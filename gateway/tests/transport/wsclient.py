"""Helpers for TestClient-based WebSocket tests [R32]."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from fastapi.testclient import TestClient
from starlette.testclient import WebSocketTestSession

from gateway.config import Settings
from gateway.main import create_app
from tests.fakes import FakeOllamaClient
from tests.helpers import TOKEN, make_settings


@contextmanager
def gateway_client(
    fake: FakeOllamaClient | None = None, settings: Settings | None = None
) -> Iterator[tuple[TestClient, FakeOllamaClient]]:
    fake = fake or FakeOllamaClient()
    app = create_app(settings or make_settings(), client=fake)
    with TestClient(app) as client:
        yield client, fake


@contextmanager
def connect(
    client: TestClient,
    token: str | None = TOKEN,
    origin: str | None = None,
    subprotocols: list[str] | None = None,
) -> Iterator[WebSocketTestSession]:
    headers: dict[str, str] = {}
    if token is not None:
        headers["x-gateway-token"] = token
    if origin is not None:
        headers["origin"] = origin
    with client.websocket_connect("/ws", headers=headers, subprotocols=subprotocols) as ws:
        yield ws


def send(ws: WebSocketTestSession, request_id: str, action: str, payload: Any = None) -> None:
    frame: dict[str, Any] = {"v": 1, "id": request_id, "action": action}
    if payload is not None:
        frame["payload"] = payload
    ws.send_json(frame)


def cancel(ws: WebSocketTestSession, request_id: str) -> None:
    ws.send_json({"v": 1, "id": request_id, "action": "cancel"})


def collect(ws: WebSocketTestSession, request_id: str) -> list[dict[str, Any]]:
    """Read frames for one id until its terminal result or error."""
    frames: list[dict[str, Any]] = []
    while True:
        frame = ws.receive_json()
        if frame["id"] != request_id:
            continue
        frames.append(frame)
        if frame["type"] in {"result", "error"}:
            return frames
