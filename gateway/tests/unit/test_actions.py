"""Text actions: version/list/ps/show, load/unload, embed, generate, chat, errors."""

from typing import Any

import pytest

from gateway.actions.registry import ActionRegistry, build_default_registry
from gateway.protocol.errors import ErrorCode, GatewayError
from gateway.protocol.payloads import PAYLOAD_MODELS
from tests.fakes import CHAT_CHUNKS, FakeOllamaClient
from tests.helpers import make_ctx, make_settings

SHA = "sha256:" + "a" * 64


@pytest.fixture
def registry() -> ActionRegistry:
    return build_default_registry()


async def _fails(
    registry: ActionRegistry, action: str, payload: dict[str, Any], code: ErrorCode, **kw: Any
) -> GatewayError:
    ctx, _, _ = make_ctx(**kw)
    with pytest.raises(GatewayError) as info:
        await registry.execute(action, payload, ctx)
    assert info.value.code is code, info.value.message
    return info.value


def test_registry_matches_payload_models(registry: ActionRegistry) -> None:
    assert registry.names == frozenset(PAYLOAD_MODELS)
    for handler in registry:
        assert handler.payload_model is PAYLOAD_MODELS[handler.name]


async def test_unknown_disabled_and_invalid(registry: ActionRegistry) -> None:
    await _fails(registry, "nope", {}, ErrorCode.UNKNOWN_ACTION)
    err = await _fails(
        registry,
        "pull",
        {"model": "x"},
        ErrorCode.ACTION_DISABLED,
        settings=make_settings(enabled_actions=frozenset({"chat"})),
    )
    assert "needs internet" in err.message
    err = await _fails(registry, "chat", {"model": "m"}, ErrorCode.INVALID_REQUEST)
    assert err.details is not None and err.details["errors"][0]["loc"] == ["messages"]


async def test_version_list_ps_show(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    version = await registry.execute("version", {}, ctx)
    assert version == {"version": "0.35.1", "gates": {"systemone": True, "systemone_images": True}}
    listed = await registry.execute("list", {}, ctx)
    assert any(m["name"] == "gemma4:latest" for m in listed["models"])
    assert await registry.execute("ps", {}, ctx) == {"models": []}
    shown = await registry.execute("show", {"model": "gemma4", "verbose": True}, ctx)
    assert "capabilities" in shown
    assert fake.last_body("/api/show") == {"model": "gemma4", "verbose": True}


async def test_load_and_unload(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    await registry.execute("load", {"model": "gemma4", "keep_alive": -1}, ctx)
    assert fake.last_body("/api/generate") == {"model": "gemma4", "stream": False, "keep_alive": -1}
    await registry.execute("load", {"model": "gemma4"}, ctx)
    assert fake.last_body("/api/generate") == {"model": "gemma4", "stream": False}
    result = await registry.execute("unload", {"model": "gemma4"}, ctx)
    assert fake.last_body("/api/generate") == {"model": "gemma4", "keep_alive": 0, "stream": False}
    assert result["done"] is True
    await _fails(registry, "load", {"model": "gpt-oss:120b-cloud"}, ErrorCode.CLOUD_MODEL_BLOCKED)


async def test_embed(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    result = await registry.execute(
        "embed", {"model": "embeddinggemma", "input": ["a", "b"], "keep_alive": "5m"}, ctx
    )
    assert len(result["embeddings"]) == 2
    assert fake.last_body("/api/embed") == {
        "model": "embeddinggemma",
        "input": ["a", "b"],
        "keep_alive": "5m",
    }
    await _fails(
        registry,
        "embed",
        {"model": "gpt-oss:120b-cloud", "input": "x"},
        ErrorCode.CLOUD_MODEL_BLOCKED,
    )


async def test_generate_non_streaming_passes_stream_false(registry: ActionRegistry) -> None:
    ctx, fake, emitted = make_ctx()
    result = await registry.execute(
        "generate",
        {
            "model": "gemma4",
            "prompt": "hi",
            "stream": False,
            "think": False,
            "options": {"temperature": 0, "num_ctx": 4096},
        },
        ctx,
    )
    body = fake.last_body("/api/generate")
    assert body == {
        "model": "gemma4",
        "prompt": "hi",
        "stream": False,
        "think": False,
        "options": {"temperature": 0, "num_ctx": 4096},
    }
    assert result["done"] is True
    assert emitted.chunks == []


async def test_generate_streaming_forwards_and_aggregates(registry: ActionRegistry) -> None:
    ctx, fake, emitted = make_ctx()
    result = await registry.execute("generate", {"model": "gemma4", "prompt": "hi"}, ctx)
    assert fake.last_body("/api/generate")["stream"] is True
    assert [c.get("response") for c in emitted.chunks] == ["Hel", "lo", ""]
    assert result["response"] == "Hello"
    assert result["done_reason"] == "stop" and result["eval_count"] == 2


async def test_chat_streaming_result_matches_chunks(registry: ActionRegistry) -> None:
    ctx, _, emitted = make_ctx()
    result = await registry.execute(
        "chat", {"model": "gemma4", "messages": [{"role": "user", "content": "hi"}]}, ctx
    )
    assert emitted.chunks == CHAT_CHUNKS
    joined = "".join(c["message"]["content"] for c in emitted.chunks)
    assert result["message"]["content"] == joined == "Hello"
    assert result["total_duration"] == 300 and result["eval_count"] == 2


async def test_chat_tool_loop_round_trip(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient()
    call = {
        "type": "function",
        "function": {"index": 0, "name": "get_temperature", "arguments": {"city": "Cusco"}},
    }
    fake.on_stream(
        "POST",
        "/api/chat",
        [
            {
                "model": "qwen3",
                "message": {"role": "assistant", "thinking": "need tool"},
                "done": False,
            },
            {
                "model": "qwen3",
                "message": {"role": "assistant", "content": "", "tool_calls": [call]},
                "done": False,
            },
            {
                "model": "qwen3",
                "message": {"role": "assistant", "content": ""},
                "done": True,
                "done_reason": "stop",
                "eval_count": 4,
            },
        ],
    )
    ctx, _, emitted = make_ctx(fake)
    first = await registry.execute(
        "chat",
        {
            "model": "qwen3",
            "think": "high",
            "messages": [{"role": "user", "content": "temp?"}],
            "tools": [
                {
                    "type": "function",
                    "function": {"name": "get_temperature", "parameters": {"type": "object"}},
                }
            ],
        },
        ctx,
    )
    assert first["message"]["tool_calls"] == [call]
    assert first["message"]["thinking"] == "need tool"
    assert len(emitted.chunks) == 3
    # The client runs the tool and sends everything back; the gateway never executes it.
    fake.on(
        "POST",
        "/api/chat",
        200,
        {
            "model": "qwen3",
            "message": {"role": "assistant", "content": "12C"},
            "done": True,
            "done_reason": "stop",
        },
    )
    second = await registry.execute(
        "chat",
        {
            "model": "qwen3",
            "stream": False,
            "messages": [
                {"role": "user", "content": "temp?"},
                {
                    "role": "assistant",
                    "thinking": first["message"]["thinking"],
                    "content": "",
                    "tool_calls": first["message"]["tool_calls"],
                },
                {"role": "tool", "tool_name": "get_temperature", "content": "12C"},
            ],
        },
        ctx,
    )
    assert second["message"]["content"] == "12C"
    sent = fake.last_body("/api/chat")
    assert sent["messages"][1]["thinking"] == "need tool"
    assert sent["messages"][1]["tool_calls"][0]["function"]["index"] == 0
    assert sent["messages"][2]["tool_name"] == "get_temperature"
    assert sent["stream"] is False


async def test_chat_model_gates(registry: ActionRegistry) -> None:
    msgs = [{"role": "user", "content": "hi"}]
    await _fails(registry, "chat", {"model": "nimble", "messages": msgs}, ErrorCode.INVALID_REQUEST)
    await _fails(
        registry,
        "chat",
        {"model": "gpt-oss:120b-cloud", "messages": msgs},
        ErrorCode.CLOUD_MODEL_BLOCKED,
    )
    await _fails(
        registry, "chat", {"model": "missing", "messages": msgs}, ErrorCode.MODEL_NOT_FOUND
    )
    err = await _fails(
        registry,
        "chat",
        {"model": "qwen3", "messages": msgs, "think": "ultra"},
        ErrorCode.INVALID_REQUEST,
    )
    assert err.details is not None and err.details["allowed"] == ["low", "medium", "high"]
    await _fails(
        registry,
        "chat",
        {"model": "qwen3", "messages": msgs, "think": True},
        ErrorCode.INVALID_REQUEST,
    )
    await _fails(
        registry,
        "chat",
        {"model": "gemma4", "messages": msgs, "think": 1},
        ErrorCode.INVALID_REQUEST,
    )


async def test_mid_stream_error_line(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient()
    fake.on_stream(
        "POST",
        "/api/generate",
        [
            {"model": "g", "response": "Yes", "done": False},
            {"error": "an error was encountered while running the model"},
            {"model": "g", "response": "never", "done": True},
        ],
    )
    ctx, _, emitted = make_ctx(fake)
    with pytest.raises(GatewayError) as info:
        await registry.execute("generate", {"model": "gemma4", "prompt": "p"}, ctx)
    assert info.value.code is ErrorCode.UPSTREAM_ERROR
    assert info.value.details == {"mid_stream": True}
    assert [c["response"] for c in emitted.chunks] == ["Yes"]


async def test_http_error_mapping_through_actions(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient()
    fake.fail_stream("POST", "/api/chat", 503, {"error": "server busy"})
    msgs = [{"role": "user", "content": "hi"}]
    err = await _fails(
        registry, "chat", {"model": "gemma4", "messages": msgs}, ErrorCode.UPSTREAM_BUSY, fake=fake
    )
    assert "OLLAMA_MAX_QUEUE" in err.message
    fake.on("POST", "/api/embed", 413, {"error": "too big"})
    await _fails(
        registry, "embed", {"model": "gemma4", "input": "x"}, ErrorCode.PAYLOAD_TOO_LARGE, fake=fake
    )
    fake.on("POST", "/api/embed", 429, {"error": "slow down"})
    await _fails(
        registry, "embed", {"model": "gemma4", "input": "x"}, ErrorCode.UPSTREAM_BUSY, fake=fake
    )
    fake.on("POST", "/api/embed", 502, {"error": "cloud unreachable"})
    await _fails(
        registry,
        "embed",
        {"model": "gemma4", "input": "x"},
        ErrorCode.CLOUD_MODEL_BLOCKED,
        fake=fake,
    )


async def test_upstream_down(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient(unavailable=True)
    await _fails(registry, "list", {}, ErrorCode.UPSTREAM_UNAVAILABLE, fake=fake)
    await _fails(
        registry,
        "chat",
        {"model": "g", "messages": [{"role": "user", "content": "x"}]},
        ErrorCode.UPSTREAM_UNAVAILABLE,
        fake=fake,
    )
