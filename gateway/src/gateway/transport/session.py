"""One WebSocket connection: concurrent requests by id, cancel, timeout, limits, logging."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any

from gateway.protocol.envelope import (
    RequestEnvelope,
    chunk_frame,
    error_frame,
    parse_envelope,
    result_frame,
    sniff_request_id,
)
from gateway.protocol.errors import ErrorCode, GatewayError
from gateway.protocol.usage import usage_from
from gateway.security.limits import SizeLimits, mentions_images
from gateway.transport.runtime import Executor

Sender = Callable[[dict[str, Any]], Awaitable[None]]

log = logging.getLogger("gateway.request")


class Session:
    def __init__(
        self,
        send: Sender,
        execute: Executor,
        limits: SizeLimits,
        max_concurrent: int,
        timeout_s: float,
        peer: str = "-",
    ) -> None:
        self._send = send
        self._execute = execute
        self._limits = limits
        self._max_concurrent = max_concurrent
        self._timeout = timeout_s
        self._peer = peer
        self._tasks: dict[str, asyncio.Task[None]] = {}

    @property
    def active(self) -> int:
        return len(self._tasks)

    async def handle_text(self, text: str) -> None:
        size = len(text.encode("utf-8"))
        if size > self._limits.hard_cap():
            cap = self._limits.hard_cap()
            await self._send(error_frame(sniff_request_id(text), GatewayError(
                ErrorCode.PAYLOAD_TOO_LARGE,
                f"message is {size} bytes; the hard cap is {cap}",
                {"size": size, "limit": cap},
            )))
            return
        try:
            envelope = parse_envelope(text)
        except GatewayError as exc:
            request_id = (exc.details or {}).get("id") if exc.details else None
            await self._send(error_frame(request_id, exc))
            return
        if envelope.is_cancel:
            self._cancel(envelope.id)
            return
        try:
            self._admit(envelope, size)
        except GatewayError as exc:
            await self._send(error_frame(envelope.id, exc))
            return
        self._tasks[envelope.id] = asyncio.create_task(
            self._run(envelope), name=f"gateway:{envelope.action}:{envelope.id}"
        )

    async def handle_binary(self) -> None:
        await self._send(error_frame(None, GatewayError(
            ErrorCode.INVALID_REQUEST, "binary frames are not supported; send JSON text"
        )))

    async def close(self) -> None:
        for task in list(self._tasks.values()):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)
        self._tasks.clear()

    # -- internals ---------------------------------------------------------------------

    def _cancel(self, request_id: str) -> None:
        task = self._tasks.get(request_id)
        if task is not None:
            # Unknown ids are ignored so every id still ends with exactly one result or error.
            task.cancel()

    def _admit(self, envelope: RequestEnvelope, size: int) -> None:
        self._limits.check(size, mentions_images(envelope.payload))
        if envelope.id in self._tasks:
            raise GatewayError(
                ErrorCode.INVALID_REQUEST, f"request id {envelope.id!r} is already running"
            )
        if len(self._tasks) >= self._max_concurrent:
            raise GatewayError(
                ErrorCode.UPSTREAM_BUSY,
                f"this socket already has {self._max_concurrent} requests running",
                {"max_concurrent": self._max_concurrent},
            )

    async def _run(self, envelope: RequestEnvelope) -> None:
        started = time.monotonic()
        status = "ok"
        usage: dict[str, Any] = {}

        async def emit(chunk: dict[str, Any]) -> None:
            await self._send(chunk_frame(envelope.id, chunk))

        try:
            result = await asyncio.wait_for(
                self._execute(envelope.action, envelope.payload or {}, emit), self._timeout
            )
            usage = usage_from(result)
            await self._send(result_frame(envelope.id, result))
        except asyncio.CancelledError:
            status = ErrorCode.CANCELLED.value
            await self._send_quietly(error_frame(envelope.id, GatewayError(
                ErrorCode.CANCELLED, "request cancelled by the client"
            )))
        except TimeoutError:
            status = ErrorCode.TIMEOUT.value
            await self._send_quietly(error_frame(envelope.id, GatewayError(
                ErrorCode.TIMEOUT,
                f"request exceeded {self._timeout:g}s",
                {"timeout_s": self._timeout},
            )))
        except GatewayError as exc:
            status = exc.code.value
            await self._send_quietly(error_frame(envelope.id, exc))
        except Exception:
            status = ErrorCode.UPSTREAM_ERROR.value
            log.exception("unhandled error in action %s", envelope.action)
            await self._send_quietly(error_frame(envelope.id, GatewayError(
                ErrorCode.UPSTREAM_ERROR, "internal gateway error"
            )))
        finally:
            self._tasks.pop(envelope.id, None)
            duration_ms = round((time.monotonic() - started) * 1000)
            log.info(
                "action=%s id=%s status=%s duration_ms=%d peer=%s usage=%s",
                envelope.action, envelope.id, status, duration_ms, self._peer, usage,
            )

    async def _send_quietly(self, frame: dict[str, Any]) -> None:
        try:
            await self._send(frame)
        except Exception:  # the socket is already gone
            log.debug("could not deliver frame for %s", frame.get("id"))
