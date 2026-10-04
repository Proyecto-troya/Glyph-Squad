"""NDJSON parsing, stream aggregation, error mapping, version gates and the info cache."""

from typing import Any

import pytest

from gateway.ollama.aggregate import ChatAggregator, GenerateAggregator, StatusAggregator
from gateway.ollama.cache import ModelInfoCache, ShowInfo, normalize_name
from gateway.ollama.client import (
    UpstreamHTTPError,
    UpstreamResponse,
    UpstreamStreamError,
    UpstreamUnavailable,
)
from gateway.ollama.errors import code_for_status, ensure_ok, error_from_response, translate
from gateway.ollama.ndjson import parse_line
from gateway.ollama.version import Version, VersionGate
from gateway.protocol.errors import ErrorCode, GatewayError
from tests.fakes import CHAT_CHUNKS, FakeOllamaClient

# --- ndjson ------------------------------------------------------------------


def test_parse_line_skips_blank_and_parses_objects() -> None:
    assert parse_line("") is None
    assert parse_line("   \n") is None
    assert parse_line('{"response":"x","done":false}') == {"response": "x", "done": False}


def test_parse_line_error_field_raises_mid_stream_error() -> None:
    with pytest.raises(UpstreamStreamError) as info:
        parse_line('{"error":"an error was encountered while running the model"}')
    assert "running the model" in info.value.message


@pytest.mark.parametrize("line", ["not json", "[1]", '"s"'])
def test_parse_line_rejects_non_objects(line: str) -> None:
    with pytest.raises(UpstreamStreamError):
        parse_line(line)


# --- aggregation -------------------------------------------------------------


def test_chat_aggregate_matches_concatenated_chunks_with_usage() -> None:
    agg = ChatAggregator()
    for chunk in CHAT_CHUNKS:
        agg.add(chunk)
    result = agg.result()
    assert result["message"] == {"role": "assistant", "content": "Hello"}
    assert result["done"] is True
    assert result["done_reason"] == "stop"
    assert result["model"] == "gemma4"
    assert result["created_at"] == "t2"
    assert result["eval_count"] == 2 and result["total_duration"] == 300
    assert result["prompt_eval_count"] == 5


def test_chat_aggregate_collects_thinking_and_tool_calls() -> None:
    call_a = {"type": "function", "function": {"index": 0, "name": "a", "arguments": {}}}
    call_b = {"type": "function", "function": {"index": 1, "name": "b", "arguments": {"x": 1}}}
    chunks: list[dict[str, Any]] = [
        {"model": "q", "message": {"role": "assistant", "thinking": "let me "}, "done": False},
        {"model": "q", "message": {"role": "assistant", "thinking": "think"}, "done": False},
        {"model": "q", "message": {"role": "assistant", "content": "", "tool_calls": [call_a]},
         "done": False},
        {"model": "q", "message": {"role": "assistant", "content": "", "tool_calls": [call_b]},
         "done": False},
        {"model": "q", "message": {"role": "assistant", "content": ""}, "done": True,
         "done_reason": "stop", "eval_count": 9},
    ]
    agg = ChatAggregator()
    for chunk in chunks:
        agg.add(chunk)
    result = agg.result()
    assert result["message"]["thinking"] == "let me think"
    assert result["message"]["tool_calls"] == [call_a, call_b]
    assert result["message"]["content"] == ""
    assert result["eval_count"] == 9


def test_generate_aggregate() -> None:
    agg = GenerateAggregator()
    agg.add({"model": "g", "response": "Th", "thinking": "hmm", "done": False})
    agg.add({"model": "g", "response": "at", "done": True, "done_reason": "stop",
             "eval_count": 2, "eval_duration": 10})
    assert agg.result() == {
        "model": "g", "created_at": None, "response": "That", "thinking": "hmm",
        "done": True, "done_reason": "stop", "eval_count": 2, "eval_duration": 10,
    }


def test_status_aggregate() -> None:
    agg = StatusAggregator()
    agg.add({"status": "pulling manifest"})
    agg.add({"status": "success"})
    assert agg.result() == {"status": "success", "events": 2}


# --- error mapping -----------------------------------------------------------


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, ErrorCode.INVALID_REQUEST),
        (404, ErrorCode.MODEL_NOT_FOUND),
        (413, ErrorCode.PAYLOAD_TOO_LARGE),
        (429, ErrorCode.UPSTREAM_BUSY),
        (500, ErrorCode.UPSTREAM_ERROR),
        (502, ErrorCode.CLOUD_MODEL_BLOCKED),
        (503, ErrorCode.UPSTREAM_BUSY),
        (418, ErrorCode.INVALID_REQUEST),
        (504, ErrorCode.UPSTREAM_ERROR),
    ],
)
def test_status_mapping(status: int, code: ErrorCode) -> None:
    assert code_for_status(status) is code
    err = error_from_response(UpstreamResponse(status, {"error": "boom"}))
    assert err.code is code
    assert "boom" in err.message
    assert err.details == {"upstream_status": status}


def test_503_mentions_queue() -> None:
    assert "OLLAMA_MAX_QUEUE" in error_from_response(UpstreamResponse(503, None)).message


def test_ensure_ok_returns_body_or_raises() -> None:
    assert ensure_ok(UpstreamResponse(200, {"a": 1})) == {"a": 1}
    assert ensure_ok(UpstreamResponse(201, None)) == {}
    with pytest.raises(GatewayError) as info:
        ensure_ok(UpstreamResponse(404, {"error": "nope"}))
    assert info.value.code is ErrorCode.MODEL_NOT_FOUND


def test_translate_exceptions() -> None:
    assert translate(UpstreamHTTPError(503, None)).code is ErrorCode.UPSTREAM_BUSY  # type: ignore[union-attr]
    mid = translate(UpstreamStreamError("bad"))
    assert mid is not None and mid.code is ErrorCode.UPSTREAM_ERROR and mid.details == {
        "mid_stream": True
    }
    down = translate(UpstreamUnavailable("refused"))
    assert down is not None and down.code is ErrorCode.UPSTREAM_UNAVAILABLE
    same = GatewayError(ErrorCode.TIMEOUT, "t")
    assert translate(same) is same
    assert translate(RuntimeError("x")) is None


# --- version -----------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("0.35.1", Version(0, 35, 1)),
        ("v0.34.4", Version(0, 34, 4)),
        ("0.35.1-rc0", Version(0, 35, 1)),
        ("0.40", Version(0, 40, 0)),
        ("0.17.7-abc123", Version(0, 17, 7)),
    ],
)
def test_version_parse(text: str, expected: Version) -> None:
    assert Version.parse(text) == expected


def test_version_parse_rejects_garbage() -> None:
    with pytest.raises(ValueError, match="unrecognised"):
        Version.parse("latest")


@pytest.mark.parametrize(
    ("text", "systemone", "images"),
    [
        ("0.34.4", False, False),
        ("0.34.9", False, False),
        ("0.35.0", True, False),
        ("0.35.1", True, True),
        ("0.36.0", True, True),
    ],
)
def test_version_gates(text: str, systemone: bool, images: bool) -> None:
    gate = VersionGate(Version.parse(text))
    assert gate.supports_systemone is systemone
    assert gate.supports_systemone_images is images


# --- cache -------------------------------------------------------------------


def test_normalize_name() -> None:
    assert normalize_name("gemma4") == "gemma4:latest"
    assert normalize_name("gemma4:latest") == "gemma4:latest"
    assert normalize_name("user/model") == "user/model:latest"
    assert normalize_name("user/model:q4") == "user/model:q4"


def test_show_info_parsing() -> None:
    info = ShowInfo.from_show({
        "capabilities": ["decision"],
        "details": {"family": "nimble", "families": ["nimble"]},
    })
    assert info.is_decision_only and info.has_decision and not info.has_vision
    assert info.thinking_values is None
    thinking = ShowInfo.from_show({
        "capabilities": ["completion", "thinking"],
        "thinking": {"values": [False, True, "high"], "default": True},
    })
    assert thinking.thinking_values == (False, True, "high")
    assert thinking.thinking_default is True
    assert not thinking.is_decision_only
    assert not ShowInfo.from_show({}).is_decision_only


async def test_cache_ttl_and_invalidate() -> None:
    fake = FakeOllamaClient()
    now = [0.0]
    cache = ModelInfoCache(fake, ttl_s=10, clock=lambda: now[0])
    info = await cache.show("gemma4")
    assert info.has_vision
    await cache.show("gemma4:latest")
    assert sum(1 for c in fake.calls if c.path == "/api/show") == 1
    now[0] = 11.0
    await cache.show("gemma4")
    assert sum(1 for c in fake.calls if c.path == "/api/show") == 2
    tags = await cache.tags()
    assert tags["gpt-oss:120b-cloud"].is_remote
    assert not tags["gemma4:latest"].is_remote
    assert await cache.find_tag("gemma4") is not None
    assert await cache.find_tag("missing") is None
    assert sum(1 for c in fake.calls if c.path == "/api/tags") == 1
    cache.invalidate("gemma4")
    await cache.tags()
    await cache.show("gemma4")
    assert sum(1 for c in fake.calls if c.path == "/api/tags") == 2
    assert sum(1 for c in fake.calls if c.path == "/api/show") == 3


async def test_cache_version_once() -> None:
    fake = FakeOllamaClient(version="0.35.1")
    cache = ModelInfoCache(fake, ttl_s=0)
    assert await cache.version() == Version(0, 35, 1)
    assert await cache.version() == Version(0, 35, 1)
    assert sum(1 for c in fake.calls if c.path == "/api/version") == 1


async def test_cache_show_404_maps_to_model_not_found() -> None:
    cache = ModelInfoCache(FakeOllamaClient(), ttl_s=1)
    with pytest.raises(GatewayError) as info:
        await cache.show("missing")
    assert info.value.code is ErrorCode.MODEL_NOT_FOUND
