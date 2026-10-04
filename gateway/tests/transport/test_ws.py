"""Transport behaviour through FastAPI's TestClient WebSocket support."""

import base64
import json
import time
from typing import Any

import pytest
from starlette.websockets import WebSocketDisconnect

from tests.fakes import CHAT_CHUNKS, FakeOllamaClient
from tests.helpers import TOKEN, make_settings
from tests.transport.wsclient import cancel, collect, connect, gateway_client, send

CHAT = {"model": "gemma4", "messages": [{"role": "user", "content": "hi"}]}


def _slow_fake(chunks: int = 20, delay: float = 0.05) -> FakeOllamaClient:
    fake = FakeOllamaClient(chunk_delay_s=delay)
    stream = [
        {"model": "gemma4", "message": {"role": "assistant", "content": f"c{i}"}, "done": False}
        for i in range(chunks)
    ]
    stream.append(
        {
            "model": "gemma4",
            "message": {"role": "assistant", "content": ""},
            "done": True,
            "done_reason": "stop",
            "eval_count": chunks,
        }
    )
    fake.on_stream("POST", "/api/chat", stream)
    return fake


# --- handshake -----------------------------------------------------------------


def test_auth_failure_sends_error_then_closes() -> None:
    with gateway_client() as (client, _):
        for token in (None, "wrong", ""):
            with pytest.raises(WebSocketDisconnect) as info, connect(client, token=token) as ws:
                frame = ws.receive_json()
                assert frame == {
                    "id": None,
                    "type": "error",
                    "data": {"code": "UNAUTHORIZED", "message": "missing or invalid gateway token"},
                }
                ws.receive_json()
            assert info.value.code == 4401


def test_auth_via_subprotocol_selects_gateway_v1() -> None:
    with gateway_client() as (client, _):
        with connect(
            client, token=None, subprotocols=["gateway.v1", f"gateway.token.{TOKEN}"]
        ) as ws:
            assert str(ws.accepted_subprotocol) == "gateway.v1"
            send(ws, "1", "ping", {})
            assert collect(ws, "1")[0]["data"]["pong"] is True
        with (
            pytest.raises(WebSocketDisconnect) as info,
            connect(client, token=None, subprotocols=["gateway.v1", "gateway.token.nope"]) as ws,
        ):
            ws.receive_json()
            ws.receive_json()
        assert info.value.code == 4401


def test_origin_allowlist() -> None:
    settings = make_settings(allowed_origins=frozenset({"https://192.168.1.5:5173"}))
    with gateway_client(settings=settings) as (client, _):
        with connect(client, origin="https://192.168.1.5:5173") as ws:
            send(ws, "1", "ping", {})
            collect(ws, "1")
        with connect(client) as ws:  # non-browser client, no Origin
            send(ws, "1", "ping", {})
            collect(ws, "1")
        with (
            pytest.raises(WebSocketDisconnect) as info,
            connect(client, origin="https://evil.invalid") as ws,
        ):
            assert ws.receive_json()["data"]["code"] == "UNAUTHORIZED"
            ws.receive_json()
        assert info.value.code == 4403


# --- envelope and routing --------------------------------------------------------


def test_envelope_errors_keep_id_when_possible() -> None:
    with gateway_client() as (client, _), connect(client) as ws:
        ws.send_text("{not json")
        frame = ws.receive_json()
        assert frame["id"] is None and frame["data"]["code"] == "INVALID_REQUEST"
        ws.send_json({"v": 1, "id": "keep", "action": "chat", "payload": {}, "bogus": 1})
        frame = ws.receive_json()
        assert frame["id"] == "keep" and frame["data"]["code"] == "INVALID_REQUEST"
        ws.send_json({"v": 2, "id": "v2", "action": "chat"})
        assert ws.receive_json()["id"] == "v2"
        ws.send_bytes(b"\x00")
        frame = ws.receive_json()
        assert frame["id"] is None and "binary" in frame["data"]["message"]


def test_unknown_disabled_and_invalid_payload() -> None:
    settings = make_settings(enabled_actions=frozenset({"ping", "version"}))
    with gateway_client(settings=settings) as (client, _), connect(client) as ws:
        send(ws, "a", "teleport", {})
        assert collect(ws, "a")[0]["data"]["code"] == "UNKNOWN_ACTION"
        send(ws, "b", "chat", CHAT)
        assert collect(ws, "b")[0]["data"]["code"] == "ACTION_DISABLED"
        send(ws, "c", "version", {"extra": 1})
        frame = collect(ws, "c")[0]
        assert frame["data"]["code"] == "INVALID_REQUEST"
        assert frame["data"]["details"]["errors"][0]["loc"] == ["extra"]
        send(ws, "d", "version")  # payload omitted means {}
        assert collect(ws, "d")[0]["data"]["version"] == "0.35.1"


# --- streaming -------------------------------------------------------------------


def test_stream_order_and_single_result() -> None:
    with gateway_client() as (client, _), connect(client) as ws:
        send(ws, "s1", "chat", CHAT)
        frames = collect(ws, "s1")
        assert [f["type"] for f in frames] == ["chunk", "chunk", "chunk", "result"]
        assert [f["data"] for f in frames[:3]] == CHAT_CHUNKS
        result = frames[-1]["data"]
        assert result["message"]["content"] == "Hello"
        assert result["eval_count"] == 2 and result["done_reason"] == "stop"
        send(ws, "s2", "chat", {**CHAT, "stream": False})
        frames = collect(ws, "s2")
        assert [f["type"] for f in frames] == ["result"]


def test_cancel_mid_stream_closes_upstream() -> None:
    with gateway_client(_slow_fake()) as (client, fake), connect(client) as ws:
        send(ws, "c1", "chat", CHAT)
        first = ws.receive_json()
        assert first["type"] == "chunk"
        cancel(ws, "c1")
        frames = collect(ws, "c1")
        assert frames[-1]["type"] == "error"
        assert frames[-1]["data"]["code"] == "CANCELLED"
        assert len(frames) < 20
        # Nothing else arrives for c1: a ping is answered next.
        send(ws, "p", "ping", {})
        assert ws.receive_json()["id"] == "p"
        deadline = time.time() + 2
        while fake.streams_closed_early == 0 and time.time() < deadline:
            time.sleep(0.01)
        assert fake.streams_closed_early == 1


def test_cancel_unknown_id_is_ignored() -> None:
    with gateway_client() as (client, _), connect(client) as ws:
        cancel(ws, "ghost")
        send(ws, "p", "ping", {})
        assert ws.receive_json()["id"] == "p"


def test_concurrent_ids_on_one_socket() -> None:
    with gateway_client(_slow_fake(chunks=5, delay=0.02)) as (client, _), connect(client) as ws:
        send(ws, "a", "chat", CHAT)
        send(ws, "b", "chat", CHAT)
        send(ws, "p", "ping", {})
        seen: dict[str, list[str]] = {"a": [], "b": [], "p": []}
        while any(not v or v[-1] not in {"result", "error"} for v in seen.values()):
            frame = ws.receive_json()
            seen[frame["id"]].append(frame["type"])
        assert seen["p"] == ["result"]
        for rid in ("a", "b"):
            assert seen[rid].count("result") == 1 and seen[rid].count("chunk") == 6
        send(ws, "a", "ping", {})
        assert collect(ws, "a")[0]["type"] == "result"  # id reusable once finished


def test_duplicate_running_id_rejected() -> None:
    with gateway_client(_slow_fake()) as (client, _), connect(client) as ws:
        send(ws, "dup", "chat", CHAT)
        send(ws, "dup", "chat", CHAT)
        frames = collect(ws, "dup")
        errors = [f for f in frames if f["type"] == "error"]
        assert errors and errors[0]["data"]["code"] == "INVALID_REQUEST"
        cancel(ws, "dup")
        collect(ws, "dup")


def test_concurrency_limit_per_socket() -> None:
    settings = make_settings(max_concurrent_per_socket=1)
    with gateway_client(_slow_fake(), settings) as (client, _), connect(client) as ws:
        send(ws, "one", "chat", CHAT)
        send(ws, "two", "chat", CHAT)
        frames = collect(ws, "two")
        assert frames[-1]["data"]["code"] == "UPSTREAM_BUSY"
        cancel(ws, "one")
        collect(ws, "one")


def test_request_timeout() -> None:
    settings = make_settings(request_timeout_s=0.1)
    with gateway_client(_slow_fake(delay=0.08), settings) as (client, fake), connect(client) as ws:
        send(ws, "t", "chat", CHAT)
        frames = collect(ws, "t")
        assert frames[-1]["data"]["code"] == "TIMEOUT"
        deadline = time.time() + 2
        while fake.streams_closed_early == 0 and time.time() < deadline:
            time.sleep(0.01)
        assert fake.streams_closed_early == 1


def test_mid_stream_error_and_upstream_down() -> None:
    fake = FakeOllamaClient()
    fake.on_stream("POST", "/api/chat", [CHAT_CHUNKS[0], {"error": "model crashed"}])
    with gateway_client(fake) as (client, _), connect(client) as ws:
        send(ws, "m", "chat", CHAT)
        frames = collect(ws, "m")
        assert [f["type"] for f in frames] == ["chunk", "error"]
        assert frames[-1]["data"]["code"] == "UPSTREAM_ERROR"
        fake.unavailable = True
        send(ws, "d", "list", {})
        assert collect(ws, "d")[0]["data"]["code"] == "UPSTREAM_UNAVAILABLE"


def test_cloud_model_rejected_over_ws() -> None:
    with gateway_client() as (client, _), connect(client) as ws:
        send(ws, "c", "chat", {**CHAT, "model": "gpt-oss:120b-cloud"})
        assert collect(ws, "c")[0]["data"]["code"] == "CLOUD_MODEL_BLOCKED"


# --- size limits -------------------------------------------------------------------


def test_oversize_message_and_image_limit() -> None:
    settings = make_settings(max_message_bytes=2048, max_image_message_bytes=8192)
    with gateway_client(settings=settings) as (client, _), connect(client) as ws:
        big_text = "x" * 3000
        send(ws, "big", "generate", {"model": "gemma4", "prompt": big_text})
        frame = collect(ws, "big")[0]
        assert frame["data"]["code"] == "PAYLOAD_TOO_LARGE" and frame["id"] == "big"
        image = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 2200).decode()
        send(
            ws,
            "img",
            "generate",
            {"model": "gemma4", "prompt": "p", "images": [image], "stream": False},
        )
        assert collect(ws, "img")[0]["type"] == "result"
        huge = base64.b64encode(b"\x00" * 7000).decode()
        send(ws, "huge", "generate", {"model": "gemma4", "prompt": "p", "images": [huge]})
        frame = collect(ws, "huge")[0]
        assert frame["data"]["code"] == "PAYLOAD_TOO_LARGE"
        assert frame["data"]["details"]["limit"] == 8192
        # Above the hard cap the frame is not parsed, but the id is still sniffed out.
        ws.send_text(
            json.dumps({"v": 1, "id": "cap", "action": "ping", "payload": {"x": "y" * 9000}})
        )
        frame = ws.receive_json()
        assert frame["id"] == "cap" and frame["data"]["code"] == "PAYLOAD_TOO_LARGE"
        ws.send_text("[" + "1," * 5000 + "1]")
        frame = ws.receive_json()
        assert frame["id"] is None and frame["data"]["code"] == "PAYLOAD_TOO_LARGE"


# --- tool loop -------------------------------------------------------------------


def test_tool_loop_round_trip_over_ws() -> None:
    fake = FakeOllamaClient()
    call: dict[str, Any] = {
        "type": "function",
        "function": {"index": 0, "name": "lookup", "arguments": {"q": "x"}},
    }
    fake.on_stream(
        "POST",
        "/api/chat",
        [
            {
                "model": "qwen3",
                "message": {"role": "assistant", "thinking": "use tool"},
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
            },
        ],
    )
    with gateway_client(fake) as (client, _), connect(client) as ws:
        send(
            ws,
            "r1",
            "chat",
            {"model": "qwen3", "think": "low", "messages": [{"role": "user", "content": "q"}]},
        )
        result = collect(ws, "r1")[-1]["data"]
        assert result["message"]["tool_calls"] == [call]
        assert result["message"]["thinking"] == "use tool"
        fake.on(
            "POST",
            "/api/chat",
            200,
            {"model": "qwen3", "message": {"role": "assistant", "content": "done"}, "done": True},
        )
        send(
            ws,
            "r2",
            "chat",
            {
                "model": "qwen3",
                "stream": False,
                "messages": [
                    {"role": "user", "content": "q"},
                    {
                        "role": "assistant",
                        "content": "",
                        "thinking": result["message"]["thinking"],
                        "tool_calls": result["message"]["tool_calls"],
                    },
                    {"role": "tool", "tool_name": "lookup", "content": "42"},
                ],
            },
        )
        assert collect(ws, "r2")[0]["data"]["message"]["content"] == "done"
        sent = fake.last_body("/api/chat")
        assert sent["messages"][2]["tool_name"] == "lookup"
        assert sent["messages"][1]["thinking"] == "use tool"
