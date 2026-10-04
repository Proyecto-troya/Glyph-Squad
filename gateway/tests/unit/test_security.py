"""Auth token presentation, origin allowlist, size limits, cloud guard, routing gates."""

import pytest
from pydantic import SecretStr

from gateway.ollama.cache import ModelInfoCache, ShowInfo
from gateway.ollama.version import Version, VersionGate
from gateway.protocol.errors import ErrorCode, GatewayError
from gateway.security.auth import (
    presented_token,
    select_subprotocol,
    split_subprotocols,
    token_matches,
)
from gateway.security.cloud_guard import ensure_local_model
from gateway.security.limits import SizeLimits, mentions_images
from gateway.security.origin import origin_allowed
from gateway.security.routing import (
    require_decision_model,
    require_systemone,
    require_systemone_images,
    require_text_model,
    validate_think,
)
from tests.fakes import FakeOllamaClient

SECRET = SecretStr("s3cret")


def test_token_from_header_or_subprotocol() -> None:
    assert presented_token({"x-gateway-token": " s3cret "}, []) == "s3cret"
    assert presented_token({}, ["gateway.v1", "gateway.token.s3cret"]) == "s3cret"
    assert presented_token({"x-gateway-token": "a"}, ["gateway.token.b"]) == "a"
    assert presented_token({}, ["gateway.v1", "gateway.token."]) is None
    assert presented_token({}, []) is None


def test_token_matches_is_strict() -> None:
    assert token_matches("s3cret", SECRET)
    assert not token_matches("s3cre", SECRET)
    assert not token_matches("", SECRET)
    assert not token_matches(None, SECRET)


def test_subprotocol_selection_never_echoes_token() -> None:
    assert select_subprotocol(["gateway.v1", "gateway.token.x"]) == "gateway.v1"
    assert select_subprotocol(["gateway.token.x"]) is None
    assert split_subprotocols("gateway.v1, gateway.token.x") == ["gateway.v1", "gateway.token.x"]
    assert split_subprotocols(None) == []


def test_origin_allowlist() -> None:
    allowed = frozenset({"https://192.168.1.5:5173"})
    assert origin_allowed(None, allowed)
    assert origin_allowed("https://192.168.1.5:5173", allowed)
    assert origin_allowed("https://192.168.1.5:5173/", allowed)
    assert not origin_allowed("https://192.168.1.6:5173", allowed)
    assert not origin_allowed("https://192.168.1.5:5173", frozenset())


def test_size_limits() -> None:
    limits = SizeLimits(max_message_bytes=100, max_image_message_bytes=1000)
    limits.check(100, has_images=False)
    limits.check(1000, has_images=True)
    with pytest.raises(GatewayError) as info:
        limits.check(101, has_images=False)
    assert info.value.code is ErrorCode.PAYLOAD_TOO_LARGE
    assert info.value.details == {"size": 101, "limit": 100, "has_images": False}
    with pytest.raises(GatewayError):
        limits.check(1001, has_images=True)
    assert limits.hard_cap() == 1000


def test_mentions_images() -> None:
    assert mentions_images({"images": ["x"]})
    assert mentions_images({"messages": [{"role": "user", "images": ["x"]}]})
    assert not mentions_images({"messages": [{"role": "user", "content": "x"}]})
    assert not mentions_images({"images": []})
    assert not mentions_images("nope")


async def test_cloud_guard() -> None:
    cache = ModelInfoCache(FakeOllamaClient(), ttl_s=10)
    await ensure_local_model(cache, "gemma4")
    await ensure_local_model(cache, "not-pulled-yet")
    with pytest.raises(GatewayError) as info:
        await ensure_local_model(cache, "gpt-oss:120b-cloud")
    assert info.value.code is ErrorCode.CLOUD_MODEL_BLOCKED
    assert info.value.details is not None
    assert info.value.details["remote_model"] == "gpt-oss:120b"


DECISION = ShowInfo.from_show({"capabilities": ["decision"], "details": {"family": "nimble"}})
CLEF = ShowInfo.from_show({"capabilities": ["decision", "vision"], "details": {"family": "clef"}})
TEXT = ShowInfo.from_show(
    {
        "capabilities": ["completion", "thinking"],
        "thinking": {"values": [False, True], "default": True},
    }
)
LEVELS = ShowInfo.from_show(
    {
        "capabilities": ["completion", "thinking"],
        "thinking": {"values": ["low", "medium", "high"], "default": "medium"},
    }
)
NO_THINK = ShowInfo.from_show(
    {"capabilities": ["completion"], "thinking": {"values": [False], "default": False}}
)
NO_META = ShowInfo.from_show({"capabilities": ["completion"]})


def test_routing_text_vs_decision() -> None:
    require_text_model("gemma4", TEXT)
    require_decision_model("nimble", DECISION)
    with pytest.raises(GatewayError, match="decision model"):
        require_text_model("nimble", DECISION)
    with pytest.raises(GatewayError, match="not a decision model"):
        require_decision_model("gemma4", TEXT)


@pytest.mark.parametrize("version", ["0.34.4", "0.34.9", "0.17.7"])
def test_systemone_gate_below_minimum(version: str) -> None:
    with pytest.raises(GatewayError) as info:
        require_systemone(VersionGate(Version.parse(version)))
    assert info.value.code is ErrorCode.UNSUPPORTED_VERSION


def test_systemone_gates_at_0_35_0_and_0_35_1() -> None:
    v350 = VersionGate(Version(0, 35, 0))
    v351 = VersionGate(Version(0, 35, 1))
    require_systemone(v350)
    require_systemone(v351)
    with pytest.raises(GatewayError) as info:
        require_systemone_images(v350, "clef-flash", CLEF)
    assert info.value.code is ErrorCode.UNSUPPORTED_VERSION
    require_systemone_images(v351, "clef-flash", CLEF)
    with pytest.raises(GatewayError, match="Clef"):
        require_systemone_images(v351, "nimble", DECISION)


def test_validate_think() -> None:
    validate_think("m", TEXT, None)
    validate_think("m", TEXT, True)
    validate_think("m", TEXT, False)
    validate_think("m", LEVELS, "high")
    validate_think("m", NO_THINK, False)
    validate_think("m", NO_META, True)
    with pytest.raises(GatewayError, match="not supported"):
        validate_think("m", LEVELS, "ultra")
    with pytest.raises(GatewayError, match="not supported"):
        validate_think("m", LEVELS, True)
    with pytest.raises(GatewayError, match="not supported"):
        validate_think("m", NO_THINK, True)
    with pytest.raises(GatewayError, match="not supported"):
        validate_think("m", TEXT, "high")
    with pytest.raises(GatewayError, match="no thinking levels"):
        validate_think("m", NO_META, "high")
