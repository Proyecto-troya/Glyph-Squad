"""Fixed template used when the model is unavailable or its sentence fails validation."""

from __future__ import annotations

from gateway.sms.models import SmsRequest

_LABELS = {
    "roya": "con roya",
    "minador": "con minador",
    "cercospora": "con cercospora",
    "phoma": "con phoma",
    "duda": "dudosas",
}


def _full(request: SmsRequest) -> str:
    counts = request.counts
    problems = counts.problems()
    if problems:
        first, *rest = problems.items()
        parts = [f"{first[1]} de {counts.total} hojas {_LABELS[first[0]]}"]
        parts += [f"{n} {_LABELS[name]}" for name, n in rest]
        body = f"Parcela {request.plot}: " + ", ".join(parts) + "."
    else:
        body = f"Parcela {request.plot}: {counts.total} hojas revisadas, sin senales de problemas."
    if request.over15:
        body += " Plantas de mas de 15 anos."
    if request.flag_unsure:
        body += " Muchas hojas dudosas; conviene revisar."
    return body


def _compact(request: SmsRequest) -> str:
    counts = request.counts
    problems = counts.problems()
    items = ", ".join(f"{name} {n}" for name, n in problems.items()) or "sin senales"
    body = f"{request.plot}: {items} de {counts.total} hojas."
    if request.over15:
        body += " Mas de 15 anos."
    if request.flag_unsure:
        body += " Revisar dudas."
    return body


def _minimal(request: SmsRequest) -> str:
    """Numbers only; the code line already carries the age and unsure flags."""
    counts = request.counts
    items = ", ".join(f"{name} {n}" for name, n in counts.problems().items()) or "sin senales"
    return f"{request.plot}: {items} de {counts.total}."


def fallback_sentence(request: SmsRequest, max_chars: int) -> str:
    """The fullest template that fits the SMS budget."""
    budget = max_chars - len(request.code) - 1
    for candidate in (_full(request), _compact(request), _minimal(request)):
        if len(candidate) <= budget:
            return candidate
    return _minimal(request)
