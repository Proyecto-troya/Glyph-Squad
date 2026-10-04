"""Integration suite: a real Ollama at 127.0.0.1:11434, skipped when unreachable."""

import os
from collections.abc import Iterator
from typing import Any

import httpx
import pytest

from gateway.config import Settings
from gateway.main import create_app
from tests.helpers import ALL_ACTIONS, make_settings

OLLAMA_URL = os.environ.get("GATEWAY_OLLAMA_URL", "http://127.0.0.1:11434")


def _probe() -> dict[str, Any] | None:
    try:
        response = httpx.get(f"{OLLAMA_URL}/api/version", timeout=2.0)
    except httpx.HTTPError:
        return None
    return dict(response.json()) if response.status_code == 200 else None


@pytest.fixture(scope="session")
def ollama_version() -> str:
    probe = _probe()
    if probe is None:
        pytest.skip(f"no Ollama at {OLLAMA_URL}")
    return str(probe["version"])


@pytest.fixture(scope="session")
def installed_models(ollama_version: str) -> dict[str, dict[str, Any]]:
    tags = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=5.0).json()
    return {m["name"]: m for m in tags.get("models", [])}


def _capabilities(name: str) -> list[str]:
    shown = httpx.post(f"{OLLAMA_URL}/api/show", json={"model": name}, timeout=10.0).json()
    return [str(c) for c in shown.get("capabilities", [])]


@pytest.fixture(scope="session")
def chat_model(installed_models: dict[str, dict[str, Any]]) -> str:
    for name in installed_models:
        caps = _capabilities(name)
        if "completion" in caps and "decision" not in caps:
            return name
    pytest.skip("no local chat model installed")


@pytest.fixture(scope="session")
def embed_model(installed_models: dict[str, dict[str, Any]]) -> str:
    for name in installed_models:
        if "embedding" in _capabilities(name):
            return name
    pytest.skip("no local embedding model installed")


@pytest.fixture(scope="session")
def decision_model(installed_models: dict[str, dict[str, Any]]) -> str:
    for name in installed_models:
        if "decision" in _capabilities(name):
            return name
    pytest.skip("no decision model (such as nimble) installed")


@pytest.fixture
def integration_settings() -> Settings:
    return make_settings(
        ollama_url=OLLAMA_URL, enabled_actions=ALL_ACTIONS, request_timeout_s=600.0
    )


@pytest.fixture
def live_app(integration_settings: Settings) -> Iterator[Any]:
    from fastapi.testclient import TestClient

    with TestClient(create_app(integration_settings)) as client:
        yield client
