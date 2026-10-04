"""Every example runs against the fake Ollama through the real WebSocket transport."""

import json
from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from examples._client import GatewayClient, GatewayClientError
from examples.back_translation_check import check_back_translation, decide
from examples.bulk_drafts import bulk_drafts, think_false_allowed
from examples.demo_warmup import cool_down, warm_up
from examples.ops_panel import ops_snapshot
from examples.similarity_signal import dot, similarity
from examples.translation_draft import DRAFT_SCHEMA, draft_translation

from tests.fakes import FakeOllamaClient
from tests.transport.wsclient import connect, gateway_client

DRAFT = {
    "model": "gemma4",
    "created_at": "t",
    "done": True,
    "done_reason": "stop",
    "prompt_eval_count": 40,
    "eval_count": 12,
    "message": {
        "role": "assistant",
        "content": json.dumps({"quz": "Raphinkuna qilluyan", "notes": "plain"}),
    },
}


@contextmanager
def example_client(
    fake: FakeOllamaClient | None = None,
) -> Iterator[tuple[GatewayClient, FakeOllamaClient]]:
    with gateway_client(fake) as (client, fake_client), connect(client) as ws:
        yield GatewayClient(ws), fake_client


def test_translation_draft_uses_schema_and_temperature_zero() -> None:
    fake = FakeOllamaClient()
    fake.on("POST", "/api/chat", 200, DRAFT)
    with example_client(fake) as (client, fake_client):
        draft = draft_translation(client, "gemma4", "Las hojas se ponen amarillas")
    assert draft.quz == "Raphinkuna qilluyan" and draft.notes == "plain"
    assert draft.usage == {"prompt_eval_count": 40, "eval_count": 12}
    sent = fake_client.last_body("/api/chat")
    assert sent["stream"] is False
    assert sent["format"] == DRAFT_SCHEMA
    assert sent["options"] == {"temperature": 0}
    assert json.dumps(DRAFT_SCHEMA) in sent["messages"][1]["content"]
    assert json.dumps(DRAFT_SCHEMA) in sent["messages"][0]["content"]


def test_back_translation_check_threshold_and_review_band() -> None:
    with example_client() as (client, fake):
        check = check_back_translation(client, "nimble", "hola", "hola", threshold=0.8)
    assert check.probability == 0.93 and check.keep and not check.needs_review
    sent = fake.last_body("/v1/systemone")
    assert sent["state"] == {"es_source": "hola", "es_back": "hola"}
    assert sent["questions"]["keeps_meaning"]["type"] == "noul"
    assert "meaning of the source" in sent["questions"]["keeps_meaning"]["instructions"]
    assert decide(0.85, 0.8) == (True, True)
    assert decide(0.75, 0.8) == (False, True)
    assert decide(0.5, 0.8) == (False, False)
    assert decide(0.99, 0.8) == (True, False)


def test_back_translation_check_requires_decision_model_and_version() -> None:
    with example_client() as (client, _):
        with pytest.raises(GatewayClientError) as info:
            check_back_translation(client, "gemma4", "a", "b", 0.8)
        assert info.value.code == "INVALID_REQUEST"
    with example_client(FakeOllamaClient(version="0.34.4")) as (client, _):
        with pytest.raises(GatewayClientError) as info:
            check_back_translation(client, "nimble", "a", "b", 0.8)
        assert info.value.code == "UNSUPPORTED_VERSION"


def test_similarity_signal_dot_product() -> None:
    fake = FakeOllamaClient()
    fake.on(
        "POST",
        "/api/embed",
        200,
        {"model": "embeddinggemma", "embeddings": [[0.6, 0.8], [0.8, 0.6]]},
    )
    with example_client(fake) as (client, fake_client):
        score = similarity(client, "embeddinggemma", "a", "b")
    assert score == pytest.approx(0.96)
    assert fake_client.last_body("/api/embed") == {"model": "embeddinggemma", "input": ["a", "b"]}
    assert dot([1.0, 0.0], [1.0, 0.0]) == 1.0
    with pytest.raises(ValueError, match="lengths"):
        dot([1.0], [1.0, 2.0])


def test_bulk_drafts_sets_think_false_only_when_allowed() -> None:
    fake = FakeOllamaClient()
    fake.on("POST", "/api/chat", 200, DRAFT)
    with example_client(fake) as (client, fake_client):
        assert think_false_allowed(client, "gemma4")  # values [false, true]
        assert not think_false_allowed(client, "qwen3")  # values are level names only
        drafts = bulk_drafts(client, "gemma4", ["a", "b"])
        assert len(drafts) == 2
        assert fake_client.last_body("/api/chat")["think"] is False
        bulk_drafts(client, "qwen3", ["c"])
        assert "think" not in fake_client.last_body("/api/chat")


def test_demo_warmup_and_cooldown() -> None:
    with example_client() as (client, fake):
        warm_up(client, "gemma4")
        assert fake.last_body("/api/generate") == {
            "model": "gemma4",
            "stream": False,
            "keep_alive": -1,
        }
        cool_down(client, "gemma4")
        assert fake.last_body("/api/generate") == {
            "model": "gemma4",
            "stream": False,
            "keep_alive": 0,
        }


def test_ops_panel() -> None:
    fake = FakeOllamaClient()
    fake.on(
        "GET",
        "/api/ps",
        200,
        {
            "models": [
                {
                    "model": "gemma4:e2b",
                    "context_length": 8192,
                    "size_vram": 123,
                    "expires_at": "never",
                }
            ]
        },
    )
    with example_client(fake) as (client, _):
        snapshot = ops_snapshot(client)
    assert snapshot["version"] == "0.35.1" and snapshot["gates"]["systemone"] is True
    assert snapshot["running"] == [
        {"model": "gemma4:e2b", "context_length": 8192, "size_vram": 123, "expires_at": "never"}
    ]
    cloud = [m for m in snapshot["installed"] if m["remote"]]
    assert cloud and cloud[0]["name"] == "gpt-oss:120b-cloud"


def test_client_handles_interleaved_ids_and_cancel() -> None:
    fake = FakeOllamaClient(chunk_delay_s=0.02)
    with example_client(fake) as (client, _):
        slow = client.start(
            "chat", {"model": "gemma4", "messages": [{"role": "user", "content": "x"}]}
        )
        quick = client.start("ping", {})
        assert client.wait(quick)["pong"] is True
        chunks: list[str] = []
        result = client.wait(slow, on_chunk=lambda c: chunks.append(c["message"]["content"]))
        assert "".join(chunks) == result["message"]["content"] == "Hello"
        cancelled = client.start(
            "chat", {"model": "gemma4", "messages": [{"role": "user", "content": "x"}]}
        )
        client.cancel(cancelled)
        with pytest.raises(GatewayClientError) as info:
            client.wait(cancelled)
        assert info.value.code == "CANCELLED"
