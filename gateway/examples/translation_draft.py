"""Use case 1: a Spanish → Quechua translation draft as structured JSON.

chat, ``stream: false``, temperature 0, ``format`` is a JSON schema ``{quz, notes}``
repeated inside the prompt, as the structured-outputs guide recommends [R21].
A person reviews every draft before it reaches messages.json.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any

from examples._client import GatewayClient, connect, env_token, env_url

DRAFT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "quz": {"type": "string", "description": "Quechua (Cusco-Collao) translation"},
        "notes": {"type": "string", "description": "Translator notes: ambiguity, register"},
    },
    "required": ["quz", "notes"],
    "additionalProperties": False,
}

SYSTEM = (
    "You draft Spanish to Quechua (Cusco-Collao) translations for a plant-disease app "
    "used by farmers. Keep sentences short and plain. Answer only with JSON matching "
    "this schema:\n" + json.dumps(DRAFT_SCHEMA)
)


@dataclass(frozen=True)
class TranslationDraft:
    quz: str
    notes: str
    usage: dict[str, Any]


def build_payload(model: str, es_text: str) -> dict[str, Any]:
    return {
        "model": model,
        "stream": False,
        "format": DRAFT_SCHEMA,
        "options": {"temperature": 0},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": f"Translate to Quechua: {es_text}\n\nSchema: {json.dumps(DRAFT_SCHEMA)}",
            },
        ],
    }


def draft_translation(client: GatewayClient, model: str, es_text: str) -> TranslationDraft:
    result = client.request("chat", build_payload(model, es_text))
    content = json.loads(result["message"]["content"])
    usage = {k: v for k, v in result.items() if k.endswith(("_count", "_duration"))}
    return TranslationDraft(
        quz=str(content["quz"]), notes=str(content.get("notes", "")), usage=usage
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("text", help="Spanish source text")
    parser.add_argument("--model", default="gemma4:e2b")
    args = parser.parse_args()
    with connect(env_url(), env_token()) as client:
        draft = draft_translation(client, args.model, args.text)
    print(
        json.dumps(
            {"quz": draft.quz, "notes": draft.notes, "usage": draft.usage},
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
