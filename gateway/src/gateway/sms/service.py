"""Compose the SMS sentence: ask the model, validate, fall back."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from gateway.config import Settings
from gateway.ollama.cache import ModelInfoCache
from gateway.ollama.client import OllamaClient
from gateway.ollama.errors import ensure_ok, translate
from gateway.protocol.errors import GatewayError
from gateway.security.cloud_guard import ensure_local_model
from gateway.sms.fallback import fallback_sentence
from gateway.sms.models import SmsRequest, SmsResponse
from gateway.sms.validate import SmsValidationError, validate_sentence

log = logging.getLogger("gateway.sms")

TEXT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {"text": {"type": "string"}},
    "required": ["text"],
}

SYSTEM_PROMPT = (
    "Escribes una sola oracion en espanol para el tecnico de la cooperativa, que resume "
    "el conteo de hojas de una parcela de cafe.\n"
    "Reglas:\n"
    "- Incluye TODOS los numeros de la lista 'numeros obligatorios', sin cambiarlos. "
    "No inventes otros numeros.\n"
    "- Habla de 'senales de' un problema; nunca afirmes un diagnostico.\n"
    "- Nunca menciones dosis, productos, tratamientos, rendimiento ni precios.\n"
    "- Una sola linea, sin acentos ni enie, maximo 110 caracteres.\n"
    "Ejemplo de entrada: parcela P9; 30 hojas; roya 4; dudosas 2; plantas de mas de 15 anos.\n"
    'Ejemplo de salida: {"text": "Parcela P9: 4 de 30 hojas con senales de roya y 2 dudosas. '
    'Plantas de mas de 15 anos."}\n'
    'Responde solo con JSON: {"text": "<oracion>"}'
)

_LABELS = {
    "roya": "roya",
    "minador": "minador",
    "cercospora": "cercospora",
    "phoma": "phoma",
    "duda": "dudosas",
}


def describe(request: SmsRequest) -> str:
    """The facts as a short Spanish list the model can copy numbers from."""
    counts = request.counts
    parts = [f"parcela {request.plot}", f"{counts.total} hojas"]
    parts += [f"{_LABELS[name]} {n}" for name, n in counts.problems().items()]
    if not counts.problems():
        parts.append("sin senales de problemas")
    if request.over15:
        parts.append("plantas de mas de 15 anos")
    if request.flag_unsure:
        parts.append("muchas hojas dudosas, conviene revisar")
    return "; ".join(parts) + "."


def build_chat_body(request: SmsRequest, settings: Settings) -> dict[str, Any]:
    required = sorted({request.counts.total, *request.counts.problems().values()}, reverse=True)
    budget = settings.sms_max_chars - len(request.code) - 1
    user = (
        f"Datos: {describe(request)}\n"
        f"Numeros obligatorios: {', '.join(str(n) for n in required)}\n"
        f"Maximo {budget} caracteres.\n"
        f"El SMS ya lleva el codigo {request.code}; no lo repitas."
    )
    return {
        "model": settings.sms_model,
        "stream": False,
        "format": TEXT_SCHEMA,
        "options": {
            "temperature": 0,
            "seed": settings.sms_seed,
            "num_predict": settings.sms_num_predict,
        },
        "keep_alive": settings.sms_keep_alive,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    }


class SmsService:
    def __init__(self, client: OllamaClient, cache: ModelInfoCache, settings: Settings) -> None:
        self._client = client
        self._cache = cache
        self._settings = settings

    async def compose(self, request: SmsRequest) -> SmsResponse:
        started = time.monotonic()
        try:
            text = await asyncio.wait_for(self._ask_model(request), self._settings.sms_timeout_s)
            response = SmsResponse(text=text, source="llm")
        except TimeoutError:
            response = self._fallback(request, "timeout")
        except SmsValidationError as exc:
            response = self._fallback(request, f"validation:{exc.rule}")
        except Exception as exc:  # upstream failures of any kind still yield a sentence
            mapped = translate(exc)
            if mapped is None:
                log.exception("unexpected error composing the SMS sentence")
                response = self._fallback(request, "internal")
            else:
                response = self._fallback(request, f"upstream:{mapped.code.value}")
        log.info(
            "sms source=%s reason=%s duration_ms=%d",
            response.source,
            response.reason,
            round((time.monotonic() - started) * 1000),
        )
        return response

    async def _ask_model(self, request: SmsRequest) -> str:
        await ensure_local_model(self._cache, self._settings.sms_model)
        body = ensure_ok(
            await self._client.call("POST", "/api/chat", build_chat_body(request, self._settings))
        )
        content = str((body.get("message") or {}).get("content") or "")
        try:
            parsed: Any = json.loads(content)
            text = parsed["text"] if isinstance(parsed, dict) else None
        except (json.JSONDecodeError, KeyError, TypeError):
            text = None
        if not isinstance(text, str):
            raise SmsValidationError("json", 'model output was not {"text": ...}')
        return validate_sentence(text, request, self._settings.sms_max_chars)

    def _fallback(self, request: SmsRequest, reason: str) -> SmsResponse:
        text = fallback_sentence(request, self._settings.sms_max_chars)
        return SmsResponse(text=text, source="fallback", reason=reason)


__all__ = ["GatewayError", "SmsService", "build_chat_body"]
