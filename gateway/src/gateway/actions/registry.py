"""Action registry and the single execution path used by the transport."""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import Any

from pydantic import ValidationError

from gateway.actions.base import ActionContext, BaseAction
from gateway.actions.blob_exists import BlobExistsAction
from gateway.actions.blob_upload import BlobUploadAction
from gateway.actions.chat import ChatAction
from gateway.actions.copy import CopyAction
from gateway.actions.create import CreateAction
from gateway.actions.delete import DeleteAction
from gateway.actions.embed import EmbedAction
from gateway.actions.generate import GenerateAction
from gateway.actions.list_ import ListAction
from gateway.actions.load import LoadAction
from gateway.actions.ping import PingAction
from gateway.actions.ps import PsAction
from gateway.actions.pull import PullAction
from gateway.actions.push import PushAction
from gateway.actions.show import ShowAction
from gateway.actions.systemone import SystemOneAction
from gateway.actions.unload import UnloadAction
from gateway.actions.version import VersionAction
from gateway.ollama.errors import translate
from gateway.protocol.errors import ErrorCode, GatewayError


class ActionRegistry:
    def __init__(self, handlers: Iterable[BaseAction[Any]]) -> None:
        self._handlers: dict[str, BaseAction[Any]] = {}
        for handler in handlers:
            if handler.name in self._handlers:
                raise ValueError(f"duplicate action {handler.name!r}")
            self._handlers[handler.name] = handler

    def __iter__(self) -> Iterator[BaseAction[Any]]:
        return iter(self._handlers.values())

    def __contains__(self, name: str) -> bool:
        return name in self._handlers

    @property
    def names(self) -> frozenset[str]:
        return frozenset(self._handlers)

    def get(self, name: str) -> BaseAction[Any] | None:
        return self._handlers.get(name)

    @property
    def upstream_operations(self) -> frozenset[str]:
        ops: set[str] = set()
        for handler in self._handlers.values():
            ops |= handler.upstream_operations
        return frozenset(ops)

    async def execute(self, name: str, raw: dict[str, Any], ctx: ActionContext) -> dict[str, Any]:
        """Resolve, gate, validate and run. Every failure is a ``GatewayError``."""
        handler = self._handlers.get(name)
        if handler is None:
            raise GatewayError(ErrorCode.UNKNOWN_ACTION, f"unknown action {name!r}")
        if not ctx.settings.is_enabled(name):
            raise GatewayError(ErrorCode.ACTION_DISABLED, _disabled_message(handler))
        try:
            payload = handler.parse(raw)
        except ValidationError as exc:
            raise GatewayError(
                ErrorCode.INVALID_REQUEST,
                f"invalid payload for {name!r}",
                {"errors": _compact(exc)},
            ) from exc
        try:
            return await handler.run(payload, ctx)
        except Exception as exc:
            mapped = translate(exc)
            if mapped is None:
                raise
            raise mapped from exc


def _disabled_message(handler: BaseAction[Any]) -> str:
    reason = " (needs internet)" if handler.needs_internet else ""
    return (
        f"action {handler.name!r} is disabled{reason}; "
        "add it to GATEWAY_ENABLED_ACTIONS to enable it"
    )


def _compact(exc: ValidationError) -> list[dict[str, Any]]:
    return [
        {"loc": [str(part) for part in err["loc"]], "msg": err["msg"], "type": err["type"]}
        for err in exc.errors(include_url=False, include_context=False, include_input=False)
    ]


def build_default_registry() -> ActionRegistry:
    """Adding an action is one new module plus one line here."""
    return ActionRegistry(
        [
            VersionAction(),
            ListAction(),
            ShowAction(),
            PsAction(),
            LoadAction(),
            UnloadAction(),
            GenerateAction(),
            ChatAction(),
            EmbedAction(),
            SystemOneAction(),
            CreateAction(),
            BlobExistsAction(),
            BlobUploadAction(),
            CopyAction(),
            DeleteAction(),
            PullAction(),
            PushAction(),
            PingAction(),
        ]
    )
