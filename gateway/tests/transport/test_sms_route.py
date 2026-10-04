"""``POST /api/sms`` through FastAPI's TestClient: auth, validation, CORS, disabled."""

import json
from typing import Any

from fastapi.testclient import TestClient

from gateway.main import create_app
from tests.fakes import FakeOllamaClient
from tests.helpers import TOKEN, make_settings

BODY: dict[str, Any] = {
    "plot": "P114",
    "counts": {
        "total": 30,
        "sana": 20,
        "roya": 7,
        "minador": 0,
        "cercospora": 1,
        "phoma": 0,
        "duda": 2,
    },
    "over15": True,
    "flagUnsure": False,
    "code": "LP P114 30H ROYA7 CER1 DUDA2 E15+",
}
GOOD = (
    "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas. Plantas de mas de 15 anos."
)
HEADERS = {"X-Gateway-Token": TOKEN}


def _fake(text: str = GOOD) -> FakeOllamaClient:
    fake = FakeOllamaClient()
    fake.on(
        "POST",
        "/api/chat",
        200,
        {
            "model": "llama3.2:3b",
            "done": True,
            "message": {"role": "assistant", "content": json.dumps({"text": text})},
        },
    )
    return fake


def test_post_sms_returns_llm_sentence() -> None:
    with TestClient(create_app(make_settings(), client=_fake())) as client:
        response = client.post("/api/sms", json=BODY, headers=HEADERS)
    assert response.status_code == 200
    assert response.json() == {"text": GOOD, "source": "llm", "reason": None}


def test_post_sms_falls_back_when_model_is_down() -> None:
    with TestClient(create_app(make_settings(), client=FakeOllamaClient(unavailable=True))) as c:
        response = c.post("/api/sms", json=BODY, headers=HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "fallback" and data["text"] == GOOD
    assert data["reason"] == "upstream:UPSTREAM_UNAVAILABLE"


def test_post_sms_needs_no_token_by_default_like_the_app_client() -> None:
    """PLAN.md's service has no auth and app/src/adapters/smsService.ts sends no header."""
    with TestClient(create_app(make_settings(), client=_fake())) as client:
        response = client.post("/api/sms", json=BODY, headers={"Content-Type": "application/json"})
    assert response.status_code == 200 and response.json()["source"] == "llm"


def test_post_sms_token_can_be_required() -> None:
    settings = make_settings(sms_require_token=True)
    with TestClient(create_app(settings, client=_fake())) as client:
        assert client.post("/api/sms", json=BODY, headers=HEADERS).status_code == 200
        assert client.post("/api/sms", json=BODY).status_code == 401
        assert (
            client.post("/api/sms", json=BODY, headers={"X-Gateway-Token": "nope"}).status_code
            == 401
        )
        # Auth runs before body validation, so strangers learn nothing from 422 details.
        assert (
            client.post("/api/sms", json={}, headers={"X-Gateway-Token": "nope"}).status_code == 401
        )
        assert client.post("/api/sms", json={}).status_code == 401


def test_post_sms_validates_the_body() -> None:
    with TestClient(create_app(make_settings(), client=_fake())) as client:
        bad = {**BODY, "counts": {**BODY["counts"], "sana": 19}}
        response = client.post("/api/sms", json=bad, headers=HEADERS)
        assert response.status_code == 422
        assert "sum" in response.text
        assert (
            client.post("/api/sms", json={**BODY, "plot": "p114"}, headers=HEADERS).status_code
            == 422
        )


def test_cors_preflight_for_the_phone_origin() -> None:
    origin = "https://192.168.1.20:5173"
    settings = make_settings(allowed_origins=frozenset({origin}))
    with TestClient(create_app(settings, client=_fake())) as client:
        preflight = client.options(
            "/api/sms",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "x-gateway-token,content-type",
            },
        )
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == origin
        denied = client.options(
            "/api/sms",
            headers={
                "Origin": "https://192.168.1.99:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" not in denied.headers


def test_sms_endpoint_can_be_disabled() -> None:
    with TestClient(create_app(make_settings(sms_enabled=False), client=_fake())) as client:
        assert client.post("/api/sms", json=BODY, headers=HEADERS).status_code == 404
