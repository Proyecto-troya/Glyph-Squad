"""Server-side checks a model sentence must pass before anyone sees it."""

from __future__ import annotations

import re
import unicodedata

from gateway.sms.models import SmsRequest

BANNED_WORDS: tuple[str, ...] = (
    "dosis",
    "fungicida",
    "aplicar",
    "tratamiento",
    "rendimiento",
    "precio",
    "kg",
    "litro",
)
_BANNED = re.compile(r"\b(" + "|".join(BANNED_WORDS) + r")\w*", re.IGNORECASE)
_NUMBER = re.compile(r"\d+")
_WS = re.compile(r"\s+")


class SmsValidationError(ValueError):
    def __init__(self, rule: str, message: str) -> None:
        super().__init__(message)
        self.rule = rule


def strip_accents(text: str) -> str:
    """``más`` → ``mas``, ``años`` → ``anos``: keep every byte inside the basic SMS alphabet."""
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def allowed_numbers(request: SmsRequest) -> set[int]:
    numbers = {int(n) for n in _NUMBER.findall(request.plot)}
    numbers |= set(request.counts.model_dump().values())
    if request.over15:
        numbers.add(15)
    return numbers


def required_numbers(request: SmsRequest) -> set[int]:
    """The total and every non-zero problem count; ``sana`` is implied by the rest."""
    return {request.counts.total, *request.counts.problems().values()}


def normalize(text: str) -> str:
    return _WS.sub(" ", strip_accents(text)).strip()


def validate_sentence(text: str, request: SmsRequest, max_chars: int) -> str:
    """Return the cleaned sentence or raise ``SmsValidationError`` naming the failed rule."""
    cleaned = normalize(text)
    if not cleaned:
        raise SmsValidationError("empty", "the sentence is empty")
    if "\n" in text.strip() or "\r" in text.strip():
        raise SmsValidationError("shape", "the sentence must be a single line")
    if "LP " in cleaned:
        raise SmsValidationError("shape", "the sentence must not repeat the code")
    if not cleaned.isascii() or not cleaned.isprintable():
        raise SmsValidationError(
            "characters", "only plain ASCII is allowed after stripping accents"
        )
    budget = max_chars - len(request.code) - 1
    if len(cleaned) > budget:
        raise SmsValidationError(
            "length",
            f"code plus sentence is {len(request.code) + 1 + len(cleaned)} chars; max {max_chars}",
        )
    found = {int(n) for n in _NUMBER.findall(cleaned)}
    extra = found - allowed_numbers(request)
    if extra:
        raise SmsValidationError("numbers", f"numbers not in the request: {sorted(extra)}")
    missing = required_numbers(request) - found
    if missing:
        raise SmsValidationError("numbers", f"counts missing from the sentence: {sorted(missing)}")
    banned = _BANNED.search(cleaned)
    if banned:
        raise SmsValidationError("banned_word", f"banned word: {banned.group(0)}")
    return cleaned
