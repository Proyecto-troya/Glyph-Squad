"""Model routing gates from cached ``/api/show`` and the upstream version [R10][R20][R29]."""

from __future__ import annotations

from gateway.ollama.cache import ShowInfo
from gateway.ollama.version import SYSTEMONE_IMAGES_MIN, SYSTEMONE_MIN, VersionGate
from gateway.protocol.errors import ErrorCode, GatewayError

CLEF_FAMILIES = frozenset({"clef", "clef-flash", "clef_flash"})


def require_text_model(model: str, info: ShowInfo) -> None:
    """Decision models report only ``decision``; they cannot chat or generate."""
    if info.is_decision_only:
        raise GatewayError(
            ErrorCode.INVALID_REQUEST,
            f"'{model}' is a decision model; use the systemone action",
            {"model": model, "capabilities": sorted(info.capabilities)},
        )


def require_decision_model(model: str, info: ShowInfo) -> None:
    if not info.has_decision:
        raise GatewayError(
            ErrorCode.INVALID_REQUEST,
            f"'{model}' is not a decision model; systemone needs one such as nimble",
            {"model": model, "capabilities": sorted(info.capabilities)},
        )


def require_systemone(gate: VersionGate) -> None:
    if not gate.supports_systemone:
        raise GatewayError(
            ErrorCode.UNSUPPORTED_VERSION,
            f"systemone needs Ollama {SYSTEMONE_MIN} or later; upstream is {gate.version}",
            {"upstream_version": str(gate.version), "required": str(SYSTEMONE_MIN)},
        )


def require_systemone_images(gate: VersionGate, model: str, info: ShowInfo) -> None:
    if not gate.supports_systemone_images:
        raise GatewayError(
            ErrorCode.UNSUPPORTED_VERSION,
            f"systemone images need Ollama {SYSTEMONE_IMAGES_MIN} or later; "
            f"upstream is {gate.version}",
            {"upstream_version": str(gate.version), "required": str(SYSTEMONE_IMAGES_MIN)},
        )
    is_clef = (info.family or "").lower() in CLEF_FAMILIES or any(
        f.lower() in CLEF_FAMILIES for f in info.families
    )
    if not (info.has_vision or is_clef):
        raise GatewayError(
            ErrorCode.INVALID_REQUEST,
            f"'{model}' cannot judge images; systemone images need Clef or Clef Flash",
            {"model": model, "capabilities": sorted(info.capabilities)},
        )


def validate_think(model: str, info: ShowInfo, think: bool | str | None) -> None:
    """Accept only values that ``/api/show`` advertises. Ollama would silently fall back."""
    if think is None:
        return
    values = info.thinking_values
    if values is None:
        # No thinking metadata: on/off is a request the model may honour; level names are not.
        if isinstance(think, str):
            raise GatewayError(
                ErrorCode.INVALID_REQUEST,
                f"'{model}' advertises no thinking levels; use true, false or null",
                {"model": model, "think": think},
            )
        return
    if think in values:
        return
    raise GatewayError(
        ErrorCode.INVALID_REQUEST,
        f"think={think!r} is not supported by '{model}'",
        {"model": model, "think": think, "allowed": list(values)},
    )
