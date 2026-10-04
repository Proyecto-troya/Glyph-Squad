"""Usage metric field names shared by aggregation and request logging [R38]."""

from __future__ import annotations

from typing import Any

USAGE_KEYS: tuple[str, ...] = (
    "total_duration",
    "load_duration",
    "prompt_eval_count",
    "prompt_eval_cached_count",
    "prompt_eval_duration",
    "eval_count",
    "eval_duration",
)


def usage_from(data: dict[str, Any]) -> dict[str, Any]:
    """Pick the usage metrics out of a response or final chunk. systemone nests them."""
    picked = {key: data[key] for key in USAGE_KEYS if key in data}
    nested = data.get("usage")
    if isinstance(nested, dict):
        picked.update({str(k): v for k, v in nested.items()})
    return picked
