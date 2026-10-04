"""Request and response models for ``POST /api/sms``."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator

PROBLEM_FIELDS: tuple[str, ...] = ("roya", "minador", "cercospora", "phoma", "duda")
MAX_LEAVES = 30


class Counts(BaseModel):
    """Leaf counts for one sample. ``total`` is the sum of the other fields."""

    model_config = ConfigDict(extra="forbid")

    total: int = Field(ge=0, le=MAX_LEAVES)
    sana: int = Field(ge=0)
    roya: int = Field(ge=0)
    minador: int = Field(ge=0)
    cercospora: int = Field(ge=0)
    phoma: int = Field(ge=0)
    duda: int = Field(ge=0)

    @model_validator(mode="after")
    def _total_is_the_sum(self) -> Counts:
        parts = self.sana + sum(getattr(self, name) for name in PROBLEM_FIELDS)
        if parts != self.total:
            raise ValueError(f"total ({self.total}) must equal the sum of the counts ({parts})")
        return self

    def problems(self) -> dict[str, int]:
        """Non-zero problem counts in a fixed order."""
        return {name: getattr(self, name) for name in PROBLEM_FIELDS if getattr(self, name)}


class SmsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    plot: str = Field(pattern=r"^[A-Z0-9]{1,8}$")
    counts: Counts
    over15: StrictBool
    flag_unsure: StrictBool = Field(alias="flagUnsure")
    code: str = Field(min_length=3, max_length=100, pattern=r"^LP [^\r\n]*$")

    @model_validator(mode="after")
    def _code_mentions_plot(self) -> SmsRequest:
        if self.plot not in self.code:
            raise ValueError("code must contain the plot")
        return self


Source = Literal["llm", "fallback"]


class SmsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    source: Source
    # Why the fallback was used; null when the model's sentence passed validation.
    reason: str | None = None
