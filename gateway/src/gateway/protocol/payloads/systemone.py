"""POST /v1/systemone payload [R6][R7]. Requires Ollama 0.35.0; images need 0.35.1."""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal

from pydantic import Field, StringConstraints, field_validator

from gateway.protocol.payloads.common import (
    DecisionImage,
    KeepAlive,
    ModelName,
    StrictPayload,
)

_NON_BLANK = re.compile(r"\S")

NonBlank = Annotated[str, StringConstraints(pattern=r"\S")]

# A non-blank string, or an object or array that Ollama serializes as JSON text.
SystemOneContent = NonBlank | dict[str, Any] | list[Any]


def _check_keys_non_blank(keys: Any, what: str) -> None:
    for key in keys:
        if not _NON_BLANK.search(key):
            raise ValueError(f"{what} keys must not be blank")


class ChoiceQuestion(StrictPayload):
    type: Literal["choice"]
    instructions: SystemOneContent
    criteria: dict[str, str | None] = Field(min_length=2, max_length=26)

    @field_validator("criteria")
    @classmethod
    def _keys(cls, value: dict[str, str | None]) -> dict[str, str | None]:
        _check_keys_non_blank(value, "criteria")
        return value


class NoulCriteria(StrictPayload):
    false_: str | None = Field(default=None, alias="false")
    true_: str | None = Field(default=None, alias="true")


class NoulQuestion(StrictPayload):
    type: Literal["noul"]
    instructions: SystemOneContent
    criteria: NoulCriteria | None = None


class ScoreQuestion(StrictPayload):
    type: Literal["score"]
    instructions: SystemOneContent
    criteria: list[str] = Field(min_length=2, max_length=26)


Question = Annotated[ChoiceQuestion | NoulQuestion | ScoreQuestion, Field(discriminator="type")]


class SystemOnePayload(StrictPayload):
    model: ModelName
    state: SystemOneContent
    images: list[DecisionImage] | None = None
    questions: dict[str, Question] = Field(min_length=1, max_length=64)
    keep_alive: KeepAlive | None = None

    @field_validator("questions")
    @classmethod
    def _question_keys(cls, value: dict[str, Question]) -> dict[str, Question]:
        _check_keys_non_blank(value, "question")
        return value

    @property
    def has_images(self) -> bool:
        return bool(self.images)
