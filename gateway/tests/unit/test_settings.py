"""Settings come from env only, reject hostnames, and parse CSV lists."""

import pytest
from pydantic import ValidationError

from gateway.config import DEFAULT_ENABLED_ACTIONS, Settings


def test_defaults_from_minimal_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GATEWAY_TOKEN", "s3cret")
    settings = Settings()
    assert settings.host == "127.0.0.1"
    assert settings.port == 8765
    assert settings.ollama_url == "http://127.0.0.1:11434"
    assert settings.enabled_actions == DEFAULT_ENABLED_ACTIONS
    assert "pull" not in settings.enabled_actions
    assert settings.token.get_secret_value() == "s3cret"
    assert "s3cret" not in repr(settings)
    assert not settings.tls_enabled


def test_token_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GATEWAY_TOKEN", raising=False)
    with pytest.raises(ValidationError):
        Settings()


def test_csv_lists(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GATEWAY_TOKEN", "t")
    monkeypatch.setenv("GATEWAY_ENABLED_ACTIONS", "version, list ,chat")
    monkeypatch.setenv("GATEWAY_ALLOWED_ORIGINS", "https://192.168.1.5:5173,http://192.168.1.5")
    settings = Settings()
    assert settings.enabled_actions == frozenset({"version", "list", "chat"})
    assert settings.allowed_origins == frozenset(
        {"https://192.168.1.5:5173", "http://192.168.1.5"}
    )
    assert settings.is_enabled("chat") and not settings.is_enabled("pull")


@pytest.mark.parametrize(
    ("var", "value"),
    [
        ("GATEWAY_HOST", "my-laptop"),
        ("GATEWAY_OLLAMA_URL", "http://ollama.lan:11434"),
        ("GATEWAY_OLLAMA_URL", "http://localhost:11434"),
        ("GATEWAY_OLLAMA_URL", "ftp://127.0.0.1"),
    ],
)
def test_hostnames_are_rejected(monkeypatch: pytest.MonkeyPatch, var: str, value: str) -> None:
    monkeypatch.setenv("GATEWAY_TOKEN", "t")
    monkeypatch.setenv(var, value)
    with pytest.raises(ValidationError):
        Settings()


def test_ipv6_and_trailing_slash(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GATEWAY_TOKEN", "t")
    monkeypatch.setenv("GATEWAY_HOST", "::1")
    monkeypatch.setenv("GATEWAY_OLLAMA_URL", "http://[::1]:11434/")
    settings = Settings()
    assert settings.ollama_url == "http://[::1]:11434"
