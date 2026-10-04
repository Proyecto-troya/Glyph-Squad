"""POST /api/sms building blocks: request model, validation rules, fallback, service."""

import json
from typing import Any

import pytest
from pydantic import ValidationError

from gateway.ollama.cache import ModelInfoCache
from gateway.sms.fallback import fallback_sentence
from gateway.sms.models import Counts, SmsRequest
from gateway.sms.service import TEXT_SCHEMA, SmsService, build_chat_body
from gateway.sms.validate import (
    SmsValidationError,
    allowed_numbers,
    required_numbers,
    strip_accents,
    validate_sentence,
)
from tests.fakes import FakeOllamaClient
from tests.helpers import make_settings

CODE = "LP P114 30H ROYA7 CER1 DUDA2 E15+"
GOOD = (
    "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas. Plantas de mas de 15 anos."
)


def req(**overrides: Any) -> SmsRequest:
    data: dict[str, Any] = {
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
        "code": CODE,
    }
    data.update(overrides)
    return SmsRequest.model_validate(data)


def chat_answer(text: str, model: str = "llama3.2:3b") -> dict[str, Any]:
    return {
        "model": model,
        "created_at": "t",
        "done": True,
        "done_reason": "stop",
        "message": {"role": "assistant", "content": json.dumps({"text": text})},
    }


# --- request model ---------------------------------------------------------------


def test_request_model_accepts_the_spec_example() -> None:
    request = req()
    assert request.flag_unsure is False
    assert request.counts.problems() == {"roya": 7, "cercospora": 1, "duda": 2}


@pytest.mark.parametrize(
    ("field", "value", "needle"),
    [
        ("plot", "p114", "plot"),
        ("plot", "P-114", "plot"),
        ("plot", "ABCDEFGHI", "plot"),
        ("code", "P114 30H", "code"),
        ("code", "LP P114\nmore", "code"),
        ("code", "LP X999 30H", "plot"),
        ("over15", "yes", "over15"),
    ],
)
def test_request_model_rejects_bad_fields(field: str, value: Any, needle: str) -> None:
    with pytest.raises(ValidationError) as info:
        req(**{field: value})
    assert needle in str(info.value)


def test_counts_must_sum_and_stay_within_30() -> None:
    with pytest.raises(ValidationError, match="sum"):
        Counts(total=30, sana=20, roya=7, minador=0, cercospora=1, phoma=0, duda=1)
    with pytest.raises(ValidationError):
        Counts(total=31, sana=31, roya=0, minador=0, cercospora=0, phoma=0, duda=0)
    with pytest.raises(ValidationError):
        Counts(total=1, sana=2, roya=-1, minador=0, cercospora=0, phoma=0, duda=0)
    with pytest.raises(ValidationError):
        req(flagUnsure=True, extra=1)


# --- validation ------------------------------------------------------------------


def test_strip_accents() -> None:
    assert strip_accents("más años señales ¿qué?") == "mas anos senales ¿que?"


def test_number_sets() -> None:
    request = req()
    assert allowed_numbers(request) == {114, 30, 20, 7, 0, 1, 2, 15}
    assert required_numbers(request) == {30, 7, 1, 2}
    assert 15 not in allowed_numbers(req(over15=False))


def test_validate_accepts_the_spec_sentence_and_strips_accents() -> None:
    request = req()
    accented = GOOD.replace("mas", "más").replace("anos", "años")
    assert validate_sentence(accented, request, 160) == GOOD
    assert len(request.code) + 1 + len(GOOD) <= 160


@pytest.mark.parametrize(
    ("text", "rule"),
    [
        ("", "empty"),
        ("   ", "empty"),
        (
            "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas.\nSegunda linea",
            "shape",
        ),
        ("LP P114 30H. " + GOOD, "shape"),
        (
            "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas ¿revisar?",
            "characters",
        ),
        ("Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas 😀", "characters"),
        (GOOD + " " + "Revisar la parcela con cuidado y avisar al tecnico " * 2, "length"),
        ("Parcela P114: 8 de 30 hojas con roya, 1 con cercospora, 2 dudosas.", "numbers"),
        ("Parcela P114: 7 de 30 hojas con roya, 2 dudosas.", "numbers"),
        (
            "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas. 3 plantas.",
            "numbers",
        ),
        (
            "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas. Aplicar fungicida.",
            "banned_word",
        ),
        (
            "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas, 2 litros.",
            "banned_word",
        ),
        (
            "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas; precios altos.",
            "banned_word",
        ),
    ],
)
def test_validate_rejects(text: str, rule: str) -> None:
    with pytest.raises(SmsValidationError) as info:
        validate_sentence(text, req(), 160)
    assert info.value.rule == rule


def test_validate_allows_sana_to_be_omitted_and_zero_counts_to_be_absent() -> None:
    request = req(
        counts={
            "total": 30,
            "sana": 30,
            "roya": 0,
            "minador": 0,
            "cercospora": 0,
            "phoma": 0,
            "duda": 0,
        },
        code="LP P114 30H E15+",
    )
    validate_sentence(
        "Parcela P114: 30 hojas sin senales de problemas, mas de 15 anos.", request, 160
    )


# --- fallback --------------------------------------------------------------------


def test_fallback_matches_the_spec_shape_and_passes_validation() -> None:
    request = req()
    text = fallback_sentence(request, 160)
    assert text == GOOD
    assert validate_sentence(text, request, 160) == text


@pytest.mark.parametrize(
    ("counts", "over15", "unsure", "code"),
    [
        (
            {
                "total": 30,
                "sana": 30,
                "roya": 0,
                "minador": 0,
                "cercospora": 0,
                "phoma": 0,
                "duda": 0,
            },
            False,
            False,
            "LP P1 30H",
        ),
        (
            {
                "total": 30,
                "sana": 0,
                "roya": 10,
                "minador": 5,
                "cercospora": 5,
                "phoma": 5,
                "duda": 5,
            },
            True,
            True,
            "LP ABCDEFGH 30H ROYA10 MIN5 CER5 PHO5 DUDA5 E15+",
        ),
        (
            {
                "total": 1,
                "sana": 0,
                "roya": 0,
                "minador": 0,
                "cercospora": 0,
                "phoma": 0,
                "duda": 1,
            },
            False,
            True,
            "LP Z9 1H DUDA1",
        ),
        (
            {
                "total": 12,
                "sana": 3,
                "roya": 2,
                "minador": 2,
                "cercospora": 2,
                "phoma": 2,
                "duda": 1,
            },
            True,
            False,
            "LP Q7 12H ROYA2 MIN2 CER2 PHO2 DUDA1 E15+",
        ),
    ],
)
def test_fallback_always_fits_and_validates(
    counts: dict[str, int], over15: bool, unsure: bool, code: str
) -> None:
    plot = code.split()[1]
    request = req(plot=plot, counts=counts, over15=over15, flagUnsure=unsure, code=code)
    for max_chars in (160, 140, len(code) + 1 + 70):
        text = fallback_sentence(request, max_chars)
        assert validate_sentence(text, request, max_chars) == text
        assert len(code) + 1 + len(text) <= max_chars


# --- service ---------------------------------------------------------------------


def service(fake: FakeOllamaClient, **overrides: Any) -> SmsService:
    settings = make_settings(**overrides)
    return SmsService(fake, ModelInfoCache(fake, settings.cache_ttl_s), settings)


async def test_service_uses_the_llm_sentence_and_sends_the_spec_parameters() -> None:
    fake = FakeOllamaClient()
    fake.on("POST", "/api/chat", 200, chat_answer(GOOD.replace("mas", "más")))
    response = await service(fake).compose(req())
    assert response.source == "llm" and response.reason is None
    assert response.text == GOOD
    sent = fake.last_body("/api/chat")
    assert sent["model"] == "llama3.2:3b" and sent["stream"] is False
    assert sent["format"] == TEXT_SCHEMA
    assert sent["options"] == {"temperature": 0, "seed": 7, "num_predict": 80}
    assert sent["keep_alive"] == "30m"
    assert sent["messages"][0]["role"] == "system"
    assert "P114" in sent["messages"][1]["content"] and CODE in sent["messages"][1]["content"]
    for rule in ("senales de", "dosis", "diagnostico"):
        assert rule in sent["messages"][0]["content"]


async def test_service_falls_back_on_bad_sentence_bad_json_and_cloud_model() -> None:
    fake = FakeOllamaClient()
    fake.on("POST", "/api/chat", 200, chat_answer(GOOD + " Aplicar fungicida."))
    response = await service(fake).compose(req())
    assert response.source == "fallback" and response.reason == "validation:banned_word"
    assert response.text == GOOD
    fake.on(
        "POST",
        "/api/chat",
        200,
        {**chat_answer(GOOD), "message": {"role": "assistant", "content": "not json"}},
    )
    assert (await service(fake).compose(req())).reason == "validation:json"
    cloud = await service(fake, sms_model="gpt-oss:120b-cloud").compose(req())
    assert cloud.reason == "upstream:CLOUD_MODEL_BLOCKED"


async def test_service_falls_back_on_timeout_upstream_down_and_http_errors() -> None:
    slow = FakeOllamaClient(call_delay_s=0.3)
    slow.on("POST", "/api/chat", 200, chat_answer(GOOD))
    response = await service(slow, sms_timeout_s=0.05).compose(req())
    assert response.source == "fallback" and response.reason == "timeout"
    down = FakeOllamaClient(unavailable=True)
    assert (await service(down).compose(req())).reason == "upstream:UPSTREAM_UNAVAILABLE"
    missing = FakeOllamaClient()
    missing.on("POST", "/api/chat", 404, {"error": "model 'llama3.2:3b' not found"})
    assert (await service(missing).compose(req())).reason == "upstream:MODEL_NOT_FOUND"


def test_build_chat_body_has_no_names_or_phone_numbers() -> None:
    body = build_chat_body(req(), make_settings())
    payload = json.dumps(body)
    assert "phone" not in payload.lower() and "nombre" not in payload.lower()
