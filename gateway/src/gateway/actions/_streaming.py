"""Shared relay for streaming endpoints: forward every chunk, then return one aggregate."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from gateway.actions.base import ActionContext
from gateway.ollama.aggregate import StreamAggregator
from gateway.ollama.errors import ensure_ok


async def relay(
    ctx: ActionContext,
    path: str,
    body: Mapping[str, Any],
    aggregator: Callable[[], StreamAggregator],
) -> dict[str, Any]:
    """``body["stream"]`` decides: False gives one upstream answer, True relays chunks."""
    if not body.get("stream", True):
        return ensure_ok(await ctx.client.call("POST", path, body))
    agg = aggregator()
    stream = ctx.client.stream("POST", path, body)
    try:
        async for chunk in stream:
            await ctx.emit(chunk)
            agg.add(chunk)
    finally:
        # A cancel interrupts the loop; closing the generator closes the upstream response.
        await stream.aclose()
    return agg.result()
