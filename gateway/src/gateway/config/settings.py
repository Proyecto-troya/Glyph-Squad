"""pydantic-settings model. See ``.env.example`` for every variable [R36]."""

from __future__ import annotations

import ipaddress
from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

MIB = 1024 * 1024

DEFAULT_ENABLED_ACTIONS: frozenset[str] = frozenset(
    {
        "version",
        "list",
        "show",
        "ps",
        "load",
        "unload",
        "generate",
        "chat",
        "embed",
        "systemone",
        "ping",
    }
)

# Opt-in actions. create/blob_* change local model storage; pull/push need internet.
OPT_IN_ACTIONS: frozenset[str] = frozenset(
    {"create", "blob_exists", "blob_upload", "copy", "delete", "pull", "push"}
)


def _split_csv(value: object) -> object:
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return value


def _require_ip_literal(host: str, what: str) -> None:
    try:
        ipaddress.ip_address(host)
    except ValueError as exc:
        raise ValueError(f"{what} must be an IP literal, not a hostname: {host!r}") from exc


class Settings(BaseSettings):
    """Every value comes from the environment. Nothing is read from files."""

    model_config = SettingsConfigDict(env_prefix="GATEWAY_", extra="ignore", frozen=True)

    # Required on connect. Never logged, never hardcoded.
    token: SecretStr

    # Where uvicorn listens. Set a LAN IP to reach the gateway from another device.
    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1, le=65535)

    # The only upstream. IP literal only: the demo runs without DNS.
    ollama_url: str = "http://127.0.0.1:11434"
    upstream_connect_timeout_s: float = Field(default=5.0, gt=0)

    # Browsers send Origin; it must be listed. Non-browser clients send none and pass.
    allowed_origins: Annotated[frozenset[str], NoDecode] = frozenset()

    max_message_bytes: int = Field(default=1 * MIB, ge=1024)
    max_image_message_bytes: int = Field(default=32 * MIB, ge=1024)
    max_concurrent_per_socket: int = Field(default=4, ge=1)
    request_timeout_s: float = Field(default=600.0, gt=0)

    # Protocol-level heartbeat, applied to uvicorn.
    ws_ping_interval_s: float = Field(default=20.0, gt=0)
    ws_ping_timeout_s: float = Field(default=20.0, gt=0)

    import_dir: Path | None = None
    enabled_actions: Annotated[frozenset[str], NoDecode] = DEFAULT_ENABLED_ACTIONS

    ssl_certfile: Path | None = None
    ssl_keyfile: Path | None = None

    log_level: str = "INFO"
    cache_ttl_s: float = Field(default=60.0, ge=0)

    # Use case 2: keep a phrase only when the noul probability is above this.
    backtranslation_threshold: float = Field(default=0.8, ge=0, le=1)

    @field_validator("allowed_origins", "enabled_actions", mode="before")
    @classmethod
    def _csv(cls, value: object) -> object:
        return _split_csv(value)

    @field_validator("host")
    @classmethod
    def _host_is_ip(cls, value: str) -> str:
        _require_ip_literal(value, "GATEWAY_HOST")
        return value

    @field_validator("ollama_url")
    @classmethod
    def _ollama_url_is_ip(cls, value: str) -> str:
        parts = urlsplit(value)
        if parts.scheme not in {"http", "https"} or not parts.hostname:
            raise ValueError("GATEWAY_OLLAMA_URL must look like http://127.0.0.1:11434")
        _require_ip_literal(parts.hostname, "GATEWAY_OLLAMA_URL host")
        return value.rstrip("/")

    @property
    def tls_enabled(self) -> bool:
        return self.ssl_certfile is not None and self.ssl_keyfile is not None

    def is_enabled(self, action: str) -> bool:
        return action in self.enabled_actions
