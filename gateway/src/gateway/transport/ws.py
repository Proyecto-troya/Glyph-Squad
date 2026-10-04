"""The ``/ws`` route [R31]: handshake checks, then a receive loop feeding a ``Session``."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from gateway.protocol.envelope import error_frame
from gateway.protocol.errors import ErrorCode, GatewayError
from gateway.security.auth import (
    presented_token,
    select_subprotocol,
    split_subprotocols,
    token_matches,
)
from gateway.security.origin import origin_allowed
from gateway.transport.runtime import GatewayRuntime
from gateway.transport.session import Session

CLOSE_UNAUTHORIZED = 4401
CLOSE_ORIGIN = 4403

log = logging.getLogger("gateway.ws")
router = APIRouter()


def runtime_of(websocket: WebSocket) -> GatewayRuntime:
    runtime = websocket.app.state.runtime
    assert isinstance(runtime, GatewayRuntime)
    return runtime


async def _reject(websocket: WebSocket, subprotocol: str | None, code: int, reason: str) -> None:
    await websocket.accept(subprotocol=subprotocol)
    await websocket.send_text(json.dumps(
        error_frame(None, GatewayError(ErrorCode.UNAUTHORIZED, reason))
    ))
    await websocket.close(code=code)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    runtime = runtime_of(websocket)
    settings = runtime.settings
    headers = websocket.headers
    subprotocols = split_subprotocols(headers.get("sec-websocket-protocol"))
    chosen = select_subprotocol(subprotocols)
    peer = websocket.client.host if websocket.client else "-"

    if not origin_allowed(headers.get("origin"), settings.allowed_origins):
        log.warning("origin rejected peer=%s", peer)
        await _reject(websocket, chosen, CLOSE_ORIGIN, "origin not allowed")
        return
    if not token_matches(presented_token(headers, subprotocols), settings.token):
        log.warning("auth failed peer=%s", peer)
        await _reject(websocket, chosen, CLOSE_UNAUTHORIZED, "missing or invalid gateway token")
        return

    await websocket.accept(subprotocol=chosen)
    send_lock = asyncio.Lock()

    async def send(frame: dict[str, Any]) -> None:
        async with send_lock:
            await websocket.send_text(json.dumps(frame, separators=(",", ":")))

    session = Session(
        send=send,
        execute=runtime.execute,
        limits=runtime.limits,
        max_concurrent=settings.max_concurrent_per_socket,
        timeout_s=settings.request_timeout_s,
        peer=peer,
    )
    log.info("connected peer=%s", peer)
    try:
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
            if message.get("text") is not None:
                await session.handle_text(message["text"])
            else:
                await session.handle_binary()
    except WebSocketDisconnect:
        pass
    finally:
        await session.close()
        log.info("disconnected peer=%s", peer)
