"""Against the real local Ollama. Run: pytest -m integration."""

import json
from typing import Any

import pytest

from tests.transport.wsclient import cancel, collect, connect, send

pytestmark = pytest.mark.integration


def test_version_and_gates(live_app: Any, ollama_version: str) -> None:
    with connect(live_app) as ws:
        send(ws, "v", "version", {})
        result = collect(ws, "v")[0]["data"]
    assert result["version"] == ollama_version
    assert set(result["gates"]) == {"systemone", "systemone_images"}


def test_list_and_ps(live_app: Any, installed_models: dict[str, dict[str, Any]]) -> None:
    with connect(live_app) as ws:
        send(ws, "l", "list", {})
        listed = collect(ws, "l")[0]["data"]
        send(ws, "p", "ps", {})
        ps = collect(ws, "p")[0]["data"]
    assert {m["name"] for m in listed["models"]} == set(installed_models)
    assert "models" in ps


def test_chat_stream_aggregate_and_cancel(live_app: Any, chat_model: str) -> None:
    payload = {
        "model": chat_model,
        "think": False,
        "messages": [{"role": "user", "content": "Count from 1 to 30, one per line."}],
        "options": {"temperature": 0, "num_predict": 40},
    }
    with connect(live_app) as ws:
        send(ws, "c", "chat", payload)
        frames = collect(ws, "c")
        chunks = [f for f in frames if f["type"] == "chunk"]
        result = frames[-1]
        assert result["type"] == "result", result
        joined = "".join(c["data"]["message"]["content"] for c in chunks)
        assert result["data"]["message"]["content"] == joined
        assert result["data"]["done"] is True and "eval_count" in result["data"]

        send(ws, "x", "chat", {**payload, "options": {"temperature": 0, "num_predict": 400}})
        first = ws.receive_json()
        assert first["id"] == "x" and first["type"] == "chunk"
        cancel(ws, "x")
        tail = collect(ws, "x")
        assert tail[-1]["type"] == "error" and tail[-1]["data"]["code"] == "CANCELLED"


def test_structured_output_translation_shape(live_app: Any, chat_model: str) -> None:
    from examples.translation_draft import build_payload

    with connect(live_app) as ws:
        send(ws, "t", "chat", build_payload(chat_model, "Las hojas tienen manchas marrones."))
        result = collect(ws, "t")[-1]["data"]
    content = json.loads(result["message"]["content"])
    assert set(content) >= {"quz", "notes"}


def test_embed_unit_vectors(live_app: Any, embed_model: str) -> None:
    with connect(live_app) as ws:
        send(ws, "e", "embed", {"model": embed_model, "input": ["hoja", "hoja"]})
        result = collect(ws, "e")[0]["data"]
    a, b = result["embeddings"]
    assert sum(x * y for x, y in zip(a, b, strict=True)) == pytest.approx(1.0, abs=1e-3)


def test_cloud_model_is_blocked(live_app: Any) -> None:
    with connect(live_app) as ws:
        send(
            ws,
            "cl",
            "chat",
            {"model": "gpt-oss:120b-cloud", "messages": [{"role": "user", "content": "hi"}]},
        )
        frame = collect(ws, "cl")[0]
    # Blocked by the gateway when the tag is present, or by Ollama's 403 (cloud disabled).
    assert frame["type"] == "error"
    assert frame["data"]["code"] == "CLOUD_MODEL_BLOCKED", frame


def test_decision_model_rejected_for_chat(live_app: Any, decision_model: str) -> None:
    with connect(live_app) as ws:
        send(
            ws,
            "d",
            "chat",
            {"model": decision_model, "messages": [{"role": "user", "content": "hi"}]},
        )
        frame = collect(ws, "d")[0]
    assert frame["data"]["code"] == "INVALID_REQUEST"


def test_systemone_choice_returns_probabilities(
    live_app: Any, decision_model: str, ollama_version: str
) -> None:
    payload = {
        "model": decision_model,
        "state": "The leaves have brown spots with yellow halos.",
        "questions": {
            "label": {
                "type": "choice",
                "instructions": "Which best describes the leaf?",
                "criteria": {"healthy": "No damage", "diseased": "Signs of disease"},
            },
            "sure": {"type": "noul", "instructions": "Is the plant clearly diseased?"},
        },
    }
    with connect(live_app) as ws:
        send(ws, "s", "systemone", payload)
        frame = collect(ws, "s")[0]
    if frame["type"] == "error":
        assert frame["data"]["code"] == "UNSUPPORTED_VERSION", frame
        pytest.skip(f"Ollama {ollama_version} is below 0.35.0")
    answers = frame["data"]["answers"]
    probs = answers["label"]["probabilities"]
    assert set(probs) == {"healthy", "diseased"}
    assert sum(probs.values()) == pytest.approx(1.0, abs=1e-3)
    assert 0.0 <= answers["sure"]["noul"] <= 1.0


def test_warmup_and_unload(live_app: Any, chat_model: str) -> None:
    with connect(live_app) as ws:
        send(ws, "w", "load", {"model": chat_model, "keep_alive": -1})
        assert collect(ws, "w")[0]["type"] == "result"
        send(ws, "p", "ps", {})
        running = {m["name"] for m in collect(ws, "p")[0]["data"]["models"]}
        assert chat_model in running
        send(ws, "u", "unload", {"model": chat_model})
        assert collect(ws, "u")[0]["type"] == "result"
