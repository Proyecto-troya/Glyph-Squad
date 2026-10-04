"""Every action's request and response mapping, through the registry's execution path."""

import hashlib
import os
from pathlib import Path
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
    err = await _fails(registry, "pull", {"model": "x"}, ErrorCode.ACTION_DISABLED,
                       settings=make_settings(enabled_actions=frozenset({"chat"})))
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
    assert fake.last_body("/api/generate") == {"model": "gemma4", "stream": False,
                                               "keep_alive": -1}
    await registry.execute("load", {"model": "gemma4"}, ctx)
    assert fake.last_body("/api/generate") == {"model": "gemma4", "stream": False}
    result = await registry.execute("unload", {"model": "gemma4"}, ctx)
    assert fake.last_body("/api/generate") == {"model": "gemma4", "keep_alive": 0,
                                               "stream": False}
    assert result["done"] is True
    await _fails(registry, "load", {"model": "gpt-oss:120b-cloud"}, ErrorCode.CLOUD_MODEL_BLOCKED)


async def test_embed(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    result = await registry.execute(
        "embed", {"model": "embeddinggemma", "input": ["a", "b"], "keep_alive": "5m"}, ctx
    )
    assert len(result["embeddings"]) == 2
    assert fake.last_body("/api/embed") == {"model": "embeddinggemma", "input": ["a", "b"],
                                            "keep_alive": "5m"}
    await _fails(registry, "embed", {"model": "gpt-oss:120b-cloud", "input": "x"},
                 ErrorCode.CLOUD_MODEL_BLOCKED)


async def test_generate_non_streaming_passes_stream_false(registry: ActionRegistry) -> None:
    ctx, fake, emitted = make_ctx()
    result = await registry.execute(
        "generate", {"model": "gemma4", "prompt": "hi", "stream": False, "think": False,
                     "options": {"temperature": 0, "num_ctx": 4096}}, ctx
    )
    body = fake.last_body("/api/generate")
    assert body == {"model": "gemma4", "prompt": "hi", "stream": False, "think": False,
                    "options": {"temperature": 0, "num_ctx": 4096}}
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
    call = {"type": "function", "function": {"index": 0, "name": "get_temperature",
                                             "arguments": {"city": "Cusco"}}}
    fake.on_stream("POST", "/api/chat", [
        {"model": "qwen3", "message": {"role": "assistant", "thinking": "need tool"},
         "done": False},
        {"model": "qwen3", "message": {"role": "assistant", "content": "", "tool_calls": [call]},
         "done": False},
        {"model": "qwen3", "message": {"role": "assistant", "content": ""}, "done": True,
         "done_reason": "stop", "eval_count": 4},
    ])
    ctx, _, emitted = make_ctx(fake)
    first = await registry.execute(
        "chat",
        {"model": "qwen3", "think": "high",
         "messages": [{"role": "user", "content": "temp?"}],
         "tools": [{"type": "function", "function": {"name": "get_temperature",
                                                     "parameters": {"type": "object"}}}]},
        ctx,
    )
    assert first["message"]["tool_calls"] == [call]
    assert first["message"]["thinking"] == "need tool"
    assert len(emitted.chunks) == 3
    # The client runs the tool and sends everything back; the gateway never executes it.
    fake.on("POST", "/api/chat", 200, {"model": "qwen3", "message": {"role": "assistant",
            "content": "12C"}, "done": True, "done_reason": "stop"})
    second = await registry.execute(
        "chat",
        {"model": "qwen3", "stream": False, "messages": [
            {"role": "user", "content": "temp?"},
            {"role": "assistant", "thinking": first["message"]["thinking"], "content": "",
             "tool_calls": first["message"]["tool_calls"]},
            {"role": "tool", "tool_name": "get_temperature", "content": "12C"},
        ]},
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
    await _fails(registry, "chat", {"model": "gpt-oss:120b-cloud", "messages": msgs},
                 ErrorCode.CLOUD_MODEL_BLOCKED)
    await _fails(registry, "chat", {"model": "missing", "messages": msgs},
                 ErrorCode.MODEL_NOT_FOUND)
    err = await _fails(registry, "chat", {"model": "qwen3", "messages": msgs, "think": "ultra"},
                       ErrorCode.INVALID_REQUEST)
    assert err.details is not None and err.details["allowed"] == ["low", "medium", "high"]
    await _fails(registry, "chat", {"model": "qwen3", "messages": msgs, "think": True},
                 ErrorCode.INVALID_REQUEST)
    await _fails(registry, "chat", {"model": "gemma4", "messages": msgs, "think": 1},
                 ErrorCode.INVALID_REQUEST)


async def test_mid_stream_error_line(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient()
    fake.on_stream("POST", "/api/generate", [
        {"model": "g", "response": "Yes", "done": False},
        {"error": "an error was encountered while running the model"},
        {"model": "g", "response": "never", "done": True},
    ])
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
    err = await _fails(registry, "chat", {"model": "gemma4", "messages": msgs},
                       ErrorCode.UPSTREAM_BUSY, fake=fake)
    assert "OLLAMA_MAX_QUEUE" in err.message
    fake.on("POST", "/api/embed", 413, {"error": "too big"})
    await _fails(registry, "embed", {"model": "gemma4", "input": "x"},
                 ErrorCode.PAYLOAD_TOO_LARGE, fake=fake)
    fake.on("POST", "/api/embed", 429, {"error": "slow down"})
    await _fails(registry, "embed", {"model": "gemma4", "input": "x"},
                 ErrorCode.UPSTREAM_BUSY, fake=fake)
    fake.on("POST", "/api/embed", 502, {"error": "cloud unreachable"})
    await _fails(registry, "embed", {"model": "gemma4", "input": "x"},
                 ErrorCode.CLOUD_MODEL_BLOCKED, fake=fake)


async def test_upstream_down(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient(unavailable=True)
    await _fails(registry, "list", {}, ErrorCode.UPSTREAM_UNAVAILABLE, fake=fake)
    await _fails(registry, "chat", {"model": "g", "messages": [{"role": "user", "content": "x"}]},
                 ErrorCode.UPSTREAM_UNAVAILABLE, fake=fake)


S1 = {"model": "nimble", "state": {"es_source": "a", "es_back": "a"},
      "questions": {"keep": {"type": "noul", "instructions": "same?"}}}
PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="


async def test_systemone_version_gates(registry: ActionRegistry) -> None:
    await _fails(registry, "systemone", S1, ErrorCode.UNSUPPORTED_VERSION,
                 fake=FakeOllamaClient(version="0.34.4"))
    ctx, fake, _ = make_ctx(FakeOllamaClient(version="0.35.0"))
    result = await registry.execute("systemone", S1, ctx)
    assert result["answers"]["keep"]["noul"] == 0.93
    assert fake.last_body("/v1/systemone") == S1
    with_images = {**S1, "model": "clef-flash", "images": [PNG]}
    await _fails(registry, "systemone", with_images, ErrorCode.UNSUPPORTED_VERSION,
                 fake=FakeOllamaClient(version="0.35.0"))
    ctx, fake, _ = make_ctx(FakeOllamaClient(version="0.35.1"))
    await registry.execute("systemone", with_images, ctx)
    assert fake.last_body("/v1/systemone")["images"] == [PNG]


async def test_systemone_model_gates(registry: ActionRegistry) -> None:
    await _fails(registry, "systemone", {**S1, "model": "gemma4"}, ErrorCode.INVALID_REQUEST)
    await _fails(registry, "systemone", {**S1, "model": "nimble", "images": [PNG]},
                 ErrorCode.INVALID_REQUEST)
    await _fails(registry, "systemone", {**S1, "model": "gpt-oss:120b-cloud"},
                 ErrorCode.CLOUD_MODEL_BLOCKED)


async def test_create_streams_status_and_invalidates_cache(registry: ActionRegistry) -> None:
    ctx, fake, emitted = make_ctx()
    await ctx.cache.tags()
    result = await registry.execute("create", {"model": "mine", "files": {"m.gguf": SHA}}, ctx)
    assert fake.last_body("/api/create") == {"model": "mine", "files": {"m.gguf": SHA},
                                             "stream": True}
    assert emitted.chunks[-1] == {"status": "success"}
    assert result == {"status": "success", "events": 2}
    await ctx.cache.tags()
    assert sum(1 for c in fake.calls if c.path == "/api/tags") == 2
    await _fails(registry, "create", {"model": "m", "files": {"m.gguf": SHA}, "quantize": "q4"},
                 ErrorCode.INVALID_REQUEST)


async def test_blob_exists(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient(head_statuses={f"/api/blobs/{SHA}": 200})
    ctx, _, _ = make_ctx(fake)
    assert await registry.execute("blob_exists", {"digest": SHA}, ctx) == {"digest": SHA,
                                                                            "exists": True}
    other = "sha256:" + "b" * 64
    assert (await registry.execute("blob_exists", {"digest": other}, ctx))["exists"] is False
    fake.head_statuses[f"/api/blobs/{other}"] = 500
    await _fails(registry, "blob_exists", {"digest": other}, ErrorCode.UPSTREAM_ERROR, fake=fake)


async def test_blob_upload(registry: ActionRegistry, tmp_path: Path) -> None:
    import_dir = tmp_path / "imports"
    import_dir.mkdir()
    data = os.urandom(1024)
    (import_dir / "model.gguf").write_bytes(data)
    expected = "sha256:" + hashlib.sha256(data).hexdigest()
    settings = make_settings(import_dir=import_dir)
    ctx, fake, _ = make_ctx(settings=settings)
    result = await registry.execute("blob_upload", {"file": "model.gguf"}, ctx)
    assert result == {"file": "model.gguf", "digest": expected, "size": 1024, "created": True}
    assert fake.uploads[0] == (f"/api/blobs/{expected}", data, 1024)
    fake.upload_status = 200
    assert (await registry.execute("blob_upload", {"file": "model.gguf"}, ctx))["created"] is False
    fake.upload_status = 400
    await _fails(registry, "blob_upload", {"file": "model.gguf"}, ErrorCode.INVALID_REQUEST,
                 fake=fake, settings=settings)


async def test_blob_upload_rejects_traversal_and_missing(
    registry: ActionRegistry, tmp_path: Path
) -> None:
    import_dir = tmp_path / "imports"
    import_dir.mkdir()
    (tmp_path / "secret.gguf").write_bytes(b"x")
    (import_dir / "escape.gguf").symlink_to(tmp_path / "secret.gguf")
    settings = make_settings(import_dir=import_dir)
    for name in ("../secret.gguf", "/etc/passwd", "sub/x.gguf", ".."):
        await _fails(registry, "blob_upload", {"file": name}, ErrorCode.INVALID_REQUEST,
                     settings=settings)
    await _fails(registry, "blob_upload", {"file": "escape.gguf"}, ErrorCode.INVALID_REQUEST,
                 settings=settings)
    await _fails(registry, "blob_upload", {"file": "missing.gguf"}, ErrorCode.INVALID_REQUEST,
                 settings=settings)
    await _fails(registry, "blob_upload", {"file": "x.gguf"}, ErrorCode.ACTION_DISABLED,
                 settings=make_settings(import_dir=None))


async def test_copy_and_delete(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    await ctx.cache.show("gemma4")
    assert await registry.execute("copy", {"source": "gemma4", "destination": "g2"}, ctx) == {
        "status": "success", "source": "gemma4", "destination": "g2"}
    assert fake.last_body("/api/copy") == {"source": "gemma4", "destination": "g2"}
    assert await registry.execute("delete", {"model": "gemma4"}, ctx) == {"status": "success",
                                                                          "model": "gemma4"}
    delete_call = [c for c in fake.calls if c.path == "/api/delete"][0]
    assert delete_call.method == "DELETE" and delete_call.body == {"model": "gemma4"}
    await ctx.cache.show("gemma4")
    assert sum(1 for c in fake.calls if c.path == "/api/show") == 2
    fake.on("DELETE", "/api/delete", 404, {"error": "model not found"})
    await _fails(registry, "delete", {"model": "zzz"}, ErrorCode.MODEL_NOT_FOUND, fake=fake)


async def test_pull_and_push_when_enabled(registry: ActionRegistry) -> None:
    ctx, fake, emitted = make_ctx()
    result = await registry.execute("pull", {"model": "gemma4:e2b"}, ctx)
    assert result["status"] == "success" and emitted.chunks[0] == {"status": "pulling manifest"}
    assert fake.last_body("/api/pull") == {"model": "gemma4:e2b", "stream": True}
    result = await registry.execute("push", {"model": "me/m", "stream": False, "insecure": True}, ctx)
    assert fake.last_body("/api/push") == {"model": "me/m", "stream": False, "insecure": True}
    offline = FakeOllamaClient(unavailable=True)
    err = await _fails(registry, "pull", {"model": "x"}, ErrorCode.UPSTREAM_UNAVAILABLE,
                       fake=offline)
    assert "needs internet" in err.message
    broken = FakeOllamaClient()
    broken.fail_stream("POST", "/api/push", 500, {"error": "dial tcp: no route to host"})
    err = await _fails(registry, "push", {"model": "x"}, ErrorCode.UPSTREAM_ERROR, fake=broken)
    assert "needs internet" in err.message


async def test_ping(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    result = await registry.execute("ping", {}, ctx)
    assert result["pong"] is True and fake.calls == []
