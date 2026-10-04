"""Payload contract tests: think, images, systemone bounds, GGUF+quantize, digests, names."""

import base64

import pytest
from pydantic import BaseModel, ValidationError

from gateway.protocol.payloads import PAYLOAD_MODELS
from gateway.protocol.payloads.chat import ChatPayload
from gateway.protocol.payloads.common import ChatMessage, dump_for_upstream
from gateway.protocol.payloads.create import CreatePayload
from gateway.protocol.payloads.embed import EmbedPayload
from gateway.protocol.payloads.generate import GeneratePayload
from gateway.protocol.payloads.models import BlobExistsPayload, BlobUploadPayload, ListPayload
from gateway.protocol.payloads.systemone import SystemOnePayload

PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16).decode()
JPEG = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 16).decode()
WEBP = base64.b64encode(b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 8).decode()
GIF = base64.b64encode(b"GIF89a" + b"\x00" * 16).decode()
SHA = "sha256:" + "a" * 64


def _fails(model: type[BaseModel], data: dict[str, object], needle: str) -> None:
    with pytest.raises(ValidationError) as info:
        model.model_validate(data)
    assert needle in str(info.value)


# --- think -------------------------------------------------------------------


@pytest.mark.parametrize("think", [True, False, None, "low", "high"])
def test_think_accepts_bool_string_null(think: object) -> None:
    payload = GeneratePayload.model_validate({"model": "m", "prompt": "p", "think": think})
    assert payload.think == think


@pytest.mark.parametrize("think", [1, 0, 0.5, [], {}])
def test_think_rejects_numbers_and_structures(think: object) -> None:
    _fails(GeneratePayload, {"model": "m", "prompt": "p", "think": think}, "think")


def test_think_false_survives_upstream_dump_but_omitted_null_does_not() -> None:
    sent = dump_for_upstream(ChatPayload.model_validate(
        {"model": "m", "messages": [{"role": "user", "content": "hi"}], "think": False}
    ))
    assert sent["think"] is False
    unset = dump_for_upstream(ChatPayload.model_validate(
        {"model": "m", "messages": [{"role": "user", "content": "hi"}]}
    ))
    assert "think" not in unset
    assert "stream" not in unset  # defaults are not forwarded; handlers set stream explicitly


# --- images ------------------------------------------------------------------


@pytest.mark.parametrize(
    "image",
    [
        "data:image/png;base64," + PNG,
        "https://example.invalid/a.png",
        "/tmp/a.png",
        "./a.png",
        "~/a.png",
        "photo.jpg",
        "not base64!!",
        "",
    ],
)
def test_images_reject_paths_urls_and_garbage(image: str) -> None:
    _fails(GeneratePayload, {"model": "m", "prompt": "p", "images": [image]}, "images")


def test_images_accept_plain_base64_of_any_bytes_for_chat_and_generate() -> None:
    GeneratePayload.model_validate({"model": "m", "prompt": "p", "images": [GIF]})
    ChatPayload.model_validate(
        {"model": "m", "messages": [{"role": "user", "content": "x", "images": [GIF]}]}
    )


def test_has_images_flags() -> None:
    assert GeneratePayload.model_validate({"model": "m", "images": [PNG]}).has_images
    assert not GeneratePayload.model_validate({"model": "m"}).has_images
    chat = ChatPayload.model_validate(
        {"model": "m", "messages": [{"role": "user", "content": "x", "images": [PNG]}]}
    )
    assert chat.has_images


# --- chat messages -----------------------------------------------------------


def test_chat_message_guide_fields_thinking_and_tool_name() -> None:
    history = ChatPayload.model_validate(
        {
            "model": "m",
            "messages": [
                {"role": "user", "content": "temp?"},
                {
                    "role": "assistant",
                    "thinking": "I should call the tool",
                    "tool_calls": [
                        {
                            "type": "function",
                            "function": {"index": 0, "name": "get_temperature",
                                         "arguments": {"city": "NY"}},
                        }
                    ],
                },
                {"role": "tool", "tool_name": "get_temperature", "content": "22C"},
            ],
        }
    )
    sent = dump_for_upstream(history)
    assert sent["messages"][1]["thinking"] == "I should call the tool"
    assert sent["messages"][1]["tool_calls"][0]["function"]["index"] == 0
    assert sent["messages"][2]["tool_name"] == "get_temperature"


def test_chat_message_role_rules() -> None:
    _fails(ChatMessage, {"role": "user", "content": "x", "thinking": "t"}, "assistant")
    _fails(ChatMessage, {"role": "assistant", "content": "x", "tool_name": "t"}, "tool")
    _fails(ChatMessage, {"role": "robot", "content": "x"}, "role")
    _fails(ChatMessage, {"role": "user", "content": "x", "foo": 1}, "foo")


def test_chat_requires_at_least_one_message() -> None:
    _fails(ChatPayload, {"model": "m", "messages": []}, "messages")


# --- embed -------------------------------------------------------------------


def test_embed_input_string_or_list_and_numeric_keep_alive() -> None:
    EmbedPayload.model_validate({"model": "m", "input": "x", "keep_alive": -1})
    EmbedPayload.model_validate({"model": "m", "input": ["x", "y"], "keep_alive": "5m"})
    _fails(EmbedPayload, {"model": "m", "input": []}, "input")
    _fails(EmbedPayload, {"model": "m", "input": "x", "dimensions": 0}, "dimensions")


# --- systemone ---------------------------------------------------------------


def _s1(**extra: object) -> dict[str, object]:
    base: dict[str, object] = {
        "model": "nimble",
        "state": {"es_source": "hola", "es_back": "hola"},
        "questions": {"keep": {"type": "noul", "instructions": "Same meaning?"}},
    }
    base.update(extra)
    return base


def test_systemone_question_types() -> None:
    payload = SystemOnePayload.model_validate(
        _s1(
            questions={
                "label": {"type": "choice", "instructions": "which?",
                          "criteria": {"a": "A", "b": None}},
                "ok": {"type": "noul", "instructions": "ok?",
                       "criteria": {"false": "no", "true": "yes"}},
                "urgency": {"type": "score", "instructions": "how?", "criteria": ["lo", "hi"]},
            }
        )
    )
    sent = dump_for_upstream(payload)
    assert sent["questions"]["ok"]["criteria"] == {"false": "no", "true": "yes"}
    assert sent["questions"]["label"]["criteria"] == {"a": "A", "b": None}


@pytest.mark.parametrize(
    ("questions", "needle"),
    [
        ({}, "questions"),
        ({f"q{i}": {"type": "noul", "instructions": "x"} for i in range(65)}, "questions"),
        ({" ": {"type": "noul", "instructions": "x"}}, "blank"),
        ({"q": {"type": "choice", "instructions": "x", "criteria": {"a": "A"}}}, "criteria"),
        ({"q": {"type": "choice", "instructions": "x",
                "criteria": {str(i): None for i in range(27)}}}, "criteria"),
        ({"q": {"type": "choice", "instructions": "x", "criteria": {" ": "A", "b": "B"}}}, "blank"),
        ({"q": {"type": "score", "instructions": "x", "criteria": ["only"]}}, "criteria"),
        ({"q": {"type": "noul", "instructions": "x", "criteria": {"maybe": "m"}}}, "maybe"),
        ({"q": {"type": "yesno", "instructions": "x"}}, "type"),
    ],
)
def test_systemone_question_bounds(questions: dict[str, object], needle: str) -> None:
    _fails(SystemOnePayload, _s1(questions=questions), needle)


@pytest.mark.parametrize("state", ["", "   "])
def test_systemone_state_must_not_be_blank(state: str) -> None:
    _fails(SystemOnePayload, _s1(state=state), "state")


def test_systemone_images_png_jpeg_webp_only() -> None:
    for ok in (PNG, JPEG, WEBP):
        SystemOnePayload.model_validate(_s1(images=[ok]))
    _fails(SystemOnePayload, _s1(images=[GIF]), "PNG, JPEG or WebP")
    _fails(SystemOnePayload, _s1(images=["data:image/png;base64," + PNG]), "data URL")


# --- create ------------------------------------------------------------------


def test_create_from_alias_round_trips() -> None:
    payload = CreatePayload.model_validate({"model": "mario", "from": "gemma4", "system": "hi"})
    assert dump_for_upstream(payload) == {"model": "mario", "from": "gemma4", "system": "hi"}


def test_create_gguf_rejects_quantize() -> None:
    _fails(
        CreatePayload,
        {"model": "m", "files": {"model.gguf": SHA}, "quantize": "q4_K_M"},
        "does not quantize GGUF",
    )
    _fails(
        CreatePayload,
        {"model": "m", "from": "x", "draft_files": {"draft.GGUF": SHA}, "draft_quantize": "q8_0"},
        "does not quantize GGUF",
    )
    CreatePayload.model_validate({"model": "m", "from": "x", "quantize": "q4_K_M"})


def test_create_split_gguf_one_entry_per_shard() -> None:
    payload = CreatePayload.model_validate(
        {"model": "m", "files": {"model-00001-of-00002.gguf": SHA, "model-00002-of-00002.gguf": SHA}}
    )
    assert payload.files is not None and len(payload.files) == 2


def test_create_needs_from_or_files_and_valid_digests() -> None:
    _fails(CreatePayload, {"model": "m"}, "'from' or 'files'")
    _fails(CreatePayload, {"model": "m", "files": {"a.gguf": "abc"}}, "sha256")


# --- blobs and misc ----------------------------------------------------------


def test_blob_digest_pattern() -> None:
    BlobExistsPayload.model_validate({"digest": SHA})
    _fails(BlobExistsPayload, {"digest": "a" * 64}, "digest")
    _fails(BlobExistsPayload, {"digest": "sha256:" + "A" * 64}, "digest")


@pytest.mark.parametrize("name", ["../x.gguf", "a/b.gguf", "..", ".", "a\\b", "x\x00y"])
def test_blob_upload_rejects_paths(name: str) -> None:
    _fails(BlobUploadPayload, {"file": name}, "file")


def test_blob_upload_accepts_bare_name() -> None:
    assert BlobUploadPayload.model_validate({"file": "model.gguf"}).file == "model.gguf"


def test_empty_payloads_reject_extras() -> None:
    ListPayload.model_validate({})
    _fails(ListPayload, {"model": "x"}, "model")


def test_model_name_must_not_be_blank() -> None:
    _fails(GeneratePayload, {"model": " "}, "model")


def test_every_action_has_a_payload_model_and_forbids_extras() -> None:
    for action, model in PAYLOAD_MODELS.items():
        assert model.model_config.get("extra") == "forbid", action
