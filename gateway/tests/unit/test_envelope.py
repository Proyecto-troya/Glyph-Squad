"""Envelope validation: strict, versioned, and id-preserving on failure."""

import json

import pytest

from gateway.protocol.envelope import (
    RequestEnvelope,
    chunk_frame,
    error_frame,
    parse_envelope,
    result_frame,
    sniff_request_id,
)
from gateway.protocol.errors import ErrorCode, GatewayError


def test_valid_request_envelope() -> None:
    env = parse_envelope(json.dumps({"v": 1, "id": "abc", "action": "chat", "payload": {"x": 1}}))
    assert env == RequestEnvelope(v=1, id="abc", action="chat", payload={"x": 1})
    assert not env.is_cancel


def test_cancel_envelope_has_no_payload() -> None:
    env = parse_envelope(json.dumps({"v": 1, "id": "abc", "action": "cancel"}))
    assert env.is_cancel
    assert env.payload is None


@pytest.mark.parametrize(
    "raw",
    [
        {"v": 2, "id": "abc", "action": "chat"},
        {"v": "1", "id": "abc", "action": "chat"},
        {"v": 1, "id": "", "action": "chat"},
        {"v": 1, "id": 12, "action": "chat"},
        {"v": 1, "id": "abc", "action": "Chat"},
        {"v": 1, "id": "abc", "action": "chat", "payload": []},
        {"v": 1, "id": "abc", "action": "chat", "extra": True},
        {"id": "abc", "action": "chat"},
        {"v": 1, "action": "chat"},
    ],
)
def test_invalid_envelopes(raw: dict[str, object]) -> None:
    with pytest.raises(GatewayError) as info:
        parse_envelope(json.dumps(raw))
    assert info.value.code is ErrorCode.INVALID_REQUEST


def test_invalid_envelope_keeps_id_for_the_error_frame() -> None:
    with pytest.raises(GatewayError) as info:
        parse_envelope(json.dumps({"v": 1, "id": "keep-me", "action": "chat", "bogus": 1}))
    assert info.value.details is not None
    assert info.value.details["id"] == "keep-me"
    assert info.value.details["errors"][0]["loc"] == ["bogus"]


@pytest.mark.parametrize("text", ["not json", "[1,2]", "null", '"str"'])
def test_non_object_frames(text: str) -> None:
    with pytest.raises(GatewayError) as info:
        parse_envelope(text)
    assert info.value.code is ErrorCode.INVALID_REQUEST


def test_response_frames() -> None:
    assert chunk_frame("1", {"a": 1}) == {"id": "1", "type": "chunk", "data": {"a": 1}}
    assert result_frame("1", {"a": 1}) == {"id": "1", "type": "result", "data": {"a": 1}}
    err = GatewayError(ErrorCode.TIMEOUT, "slow", {"after_s": 5})
    assert error_frame("1", err) == {
        "id": "1",
        "type": "error",
        "data": {"code": "TIMEOUT", "message": "slow", "details": {"after_s": 5}},
    }
    assert error_frame(None, GatewayError(ErrorCode.UNAUTHORIZED, "no"))["id"] is None


def test_sniff_request_id() -> None:
    assert sniff_request_id('{"v":1,"id":"abc-123","action":"x"}') == "abc-123"
    assert sniff_request_id('{"v": 1, "id" : "spaced"}') == "spaced"
    assert sniff_request_id("[1,2,3]") is None
    assert sniff_request_id('{"v":1,"action":"x","payload":{' + "x" * 5000 + '"id":"late"}') is None
