"""NDJSON line parsing with mid-stream error detection [R17][R18]."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from gateway.ollama.client import UpstreamStreamError


def parse_line(line: str) -> dict[str, Any] | None:
    """Parse one NDJSON line. Blank lines give None. An ``error`` line raises."""
    text = line.strip()
    if not text:
        return None
    try:
        obj: Any = json.loads(text)
    except json.JSONDecodeError as exc:
        raise UpstreamStreamError(f"upstream sent a non-JSON line: {exc.msg}") from exc
    if not isinstance(obj, dict):
        raise UpstreamStreamError("upstream sent a non-object NDJSON line")
    error = obj.get("error")
    if error:
        raise UpstreamStreamError(str(error))
    return obj


async def iter_objects(lines: AsyncIterator[str]) -> AsyncIterator[dict[str, Any]]:
    async for line in lines:
        obj = parse_line(line)
        if obj is not None:
            yield obj
