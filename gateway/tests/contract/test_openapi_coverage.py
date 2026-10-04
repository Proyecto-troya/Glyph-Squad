"""Every operation in the vendored spec is either registered or explicitly out of scope.

When Ollama adds an endpoint and the spec is re-vendored, this test fails until the
new operation is handled or listed below with a reason.
"""

from pathlib import Path

import yaml

from gateway.actions.registry import build_default_registry

SPEC = Path(__file__).resolve().parents[2] / "docs" / "openapi.yaml"

# operationId -> why the gateway does not expose it.
OUT_OF_SCOPE: dict[str, str] = {
    "webSearch": "ollama.com web search is cloud-only and needs an API key [R23]",
    "webFetch": "ollama.com web fetch is cloud-only and needs an API key [R23]",
    "chatCompletions": "OpenAI-compatible /v1/* is out of scope [R24]",
    "completions": "OpenAI-compatible /v1/* is out of scope [R24]",
    "embeddings": "OpenAI-compatible /v1/* is out of scope [R24]",
    "listModels": "OpenAI-compatible /v1/* is out of scope [R24]",
    "retrieveModel": "OpenAI-compatible /v1/* is out of scope [R24]",
    "messages": "Anthropic-compatible /v1/messages is out of scope [R25]",
    "countTokens": "Anthropic-compatible /v1/messages is out of scope [R25]",
    "embeddingsLegacy": "/api/embeddings is superseded by /api/embed",
}

HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}


def spec_operations() -> dict[str, tuple[str, str]]:
    doc = yaml.safe_load(SPEC.read_text(encoding="utf-8"))
    ops: dict[str, tuple[str, str]] = {}
    for path, methods in doc["paths"].items():
        for method, op in methods.items():
            if method in HTTP_METHODS and isinstance(op, dict):
                ops[op.get("operationId", f"{method} {path}")] = (method.upper(), path)
    return ops


def test_every_spec_operation_is_registered_or_out_of_scope() -> None:
    registered = build_default_registry().upstream_operations
    missing = {
        op: f"{method} {path}"
        for op, (method, path) in spec_operations().items()
        if op not in registered and op not in OUT_OF_SCOPE
    }
    assert not missing, f"unhandled spec operations: {missing}"


def test_registry_does_not_claim_operations_absent_from_spec() -> None:
    registered = build_default_registry().upstream_operations
    unknown = registered - set(spec_operations())
    assert not unknown, f"registry claims operations the spec lacks: {unknown}"


def test_out_of_scope_entries_do_not_overlap_registry() -> None:
    registered = build_default_registry().upstream_operations
    assert not (set(OUT_OF_SCOPE) & registered)


def test_spec_server_is_local_and_security_empty() -> None:
    doc = yaml.safe_load(SPEC.read_text(encoding="utf-8"))
    assert doc["security"] == []
    assert any("11434" in s["url"] for s in doc["servers"])
