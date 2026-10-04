"""Model-management actions: systemone, create, blobs, copy, delete, pull, push, ping."""

import hashlib
import os
from pathlib import Path
from typing import Any

import pytest

from gateway.actions.registry import ActionRegistry, build_default_registry
from gateway.protocol.errors import ErrorCode, GatewayError
from tests.fakes import FakeOllamaClient
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


S1 = {
    "model": "nimble",
    "state": {"es_source": "a", "es_back": "a"},
    "questions": {"keep": {"type": "noul", "instructions": "same?"}},
}
PNG = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5E"
    "rkJggg=="
)


async def test_systemone_version_gates(registry: ActionRegistry) -> None:
    await _fails(
        registry,
        "systemone",
        S1,
        ErrorCode.UNSUPPORTED_VERSION,
        fake=FakeOllamaClient(version="0.34.4"),
    )
    ctx, fake, _ = make_ctx(FakeOllamaClient(version="0.35.0"))
    result = await registry.execute("systemone", S1, ctx)
    assert result["answers"]["keep"]["noul"] == 0.93
    assert fake.last_body("/v1/systemone") == S1
    with_images = {**S1, "model": "clef-flash", "images": [PNG]}
    await _fails(
        registry,
        "systemone",
        with_images,
        ErrorCode.UNSUPPORTED_VERSION,
        fake=FakeOllamaClient(version="0.35.0"),
    )
    ctx, fake, _ = make_ctx(FakeOllamaClient(version="0.35.1"))
    await registry.execute("systemone", with_images, ctx)
    assert fake.last_body("/v1/systemone")["images"] == [PNG]


async def test_systemone_model_gates(registry: ActionRegistry) -> None:
    await _fails(registry, "systemone", {**S1, "model": "gemma4"}, ErrorCode.INVALID_REQUEST)
    await _fails(
        registry, "systemone", {**S1, "model": "nimble", "images": [PNG]}, ErrorCode.INVALID_REQUEST
    )
    await _fails(
        registry, "systemone", {**S1, "model": "gpt-oss:120b-cloud"}, ErrorCode.CLOUD_MODEL_BLOCKED
    )


async def test_create_streams_status_and_invalidates_cache(registry: ActionRegistry) -> None:
    ctx, fake, emitted = make_ctx()
    await ctx.cache.tags()
    result = await registry.execute("create", {"model": "mine", "files": {"m.gguf": SHA}}, ctx)
    assert fake.last_body("/api/create") == {
        "model": "mine",
        "files": {"m.gguf": SHA},
        "stream": True,
    }
    assert emitted.chunks[-1] == {"status": "success"}
    assert result == {"status": "success", "events": 2}
    await ctx.cache.tags()
    assert sum(1 for c in fake.calls if c.path == "/api/tags") == 2
    await _fails(
        registry,
        "create",
        {"model": "m", "files": {"m.gguf": SHA}, "quantize": "q4"},
        ErrorCode.INVALID_REQUEST,
    )


async def test_blob_exists(registry: ActionRegistry) -> None:
    fake = FakeOllamaClient(head_statuses={f"/api/blobs/{SHA}": 200})
    ctx, _, _ = make_ctx(fake)
    assert await registry.execute("blob_exists", {"digest": SHA}, ctx) == {
        "digest": SHA,
        "exists": True,
    }
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
    await _fails(
        registry,
        "blob_upload",
        {"file": "model.gguf"},
        ErrorCode.INVALID_REQUEST,
        fake=fake,
        settings=settings,
    )


async def test_blob_upload_rejects_traversal_and_missing(
    registry: ActionRegistry, tmp_path: Path
) -> None:
    import_dir = tmp_path / "imports"
    import_dir.mkdir()
    (tmp_path / "secret.gguf").write_bytes(b"x")
    (import_dir / "escape.gguf").symlink_to(tmp_path / "secret.gguf")
    settings = make_settings(import_dir=import_dir)
    for name in ("../secret.gguf", "/etc/passwd", "sub/x.gguf", ".."):
        await _fails(
            registry, "blob_upload", {"file": name}, ErrorCode.INVALID_REQUEST, settings=settings
        )
    await _fails(
        registry,
        "blob_upload",
        {"file": "escape.gguf"},
        ErrorCode.INVALID_REQUEST,
        settings=settings,
    )
    await _fails(
        registry,
        "blob_upload",
        {"file": "missing.gguf"},
        ErrorCode.INVALID_REQUEST,
        settings=settings,
    )
    await _fails(
        registry,
        "blob_upload",
        {"file": "x.gguf"},
        ErrorCode.ACTION_DISABLED,
        settings=make_settings(import_dir=None),
    )


async def test_copy_and_delete(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    await ctx.cache.show("gemma4")
    assert await registry.execute("copy", {"source": "gemma4", "destination": "g2"}, ctx) == {
        "status": "success",
        "source": "gemma4",
        "destination": "g2",
    }
    assert fake.last_body("/api/copy") == {"source": "gemma4", "destination": "g2"}
    assert await registry.execute("delete", {"model": "gemma4"}, ctx) == {
        "status": "success",
        "model": "gemma4",
    }
    delete_call = next(c for c in fake.calls if c.path == "/api/delete")
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
    result = await registry.execute(
        "push", {"model": "me/m", "stream": False, "insecure": True}, ctx
    )
    assert fake.last_body("/api/push") == {"model": "me/m", "stream": False, "insecure": True}
    offline = FakeOllamaClient(unavailable=True)
    err = await _fails(
        registry, "pull", {"model": "x"}, ErrorCode.UPSTREAM_UNAVAILABLE, fake=offline
    )
    assert "needs internet" in err.message
    broken = FakeOllamaClient()
    broken.fail_stream("POST", "/api/push", 500, {"error": "dial tcp: no route to host"})
    err = await _fails(registry, "push", {"model": "x"}, ErrorCode.UPSTREAM_ERROR, fake=broken)
    assert "needs internet" in err.message


async def test_ping(registry: ActionRegistry) -> None:
    ctx, fake, _ = make_ctx()
    result = await registry.execute("ping", {}, ctx)
    assert result["pong"] is True and fake.calls == []
