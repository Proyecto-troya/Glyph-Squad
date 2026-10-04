"""Origin allowlist. Browsers always send Origin; other clients usually send none."""

from __future__ import annotations


def origin_allowed(origin: str | None, allowed: frozenset[str]) -> bool:
    if origin is None:
        return True
    return origin.rstrip("/") in {o.rstrip("/") for o in allowed}
