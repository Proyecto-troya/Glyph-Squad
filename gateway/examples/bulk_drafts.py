"""Use case 4: fast bulk drafts with ``think: false``, only when the model allows it.

``show`` reports ``thinking.values``; ``false`` must be listed before it is sent [R20].
"""

from __future__ import annotations

import argparse
import json
import sys

from examples._client import GatewayClient, connect, env_token, env_url
from examples.translation_draft import TranslationDraft, build_payload, parse_draft


def think_false_allowed(client: GatewayClient, model: str) -> bool:
    shown = client.request("show", {"model": model})
    thinking = shown.get("thinking") or {}
    return False in (thinking.get("values") or [])


def bulk_drafts(client: GatewayClient, model: str, phrases: list[str]) -> list[TranslationDraft]:
    fast = think_false_allowed(client, model)
    drafts: list[TranslationDraft] = []
    for phrase in phrases:
        payload = build_payload(model, phrase)
        if fast:
            payload["think"] = False
        drafts.append(parse_draft(client.request("chat", payload)))
    return drafts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="gemma4:e2b")
    parser.add_argument("phrases", nargs="*", help="Spanish phrases; stdin lines when empty")
    args = parser.parse_args()
    phrases = args.phrases or [line.strip() for line in sys.stdin if line.strip()]
    with connect(env_url(), env_token()) as client:
        drafts = bulk_drafts(client, args.model, phrases)
    for phrase, draft in zip(phrases, drafts, strict=True):
        print(
            json.dumps(
                {"es": phrase, "quz": draft.quz, "notes": draft.notes, "ok": draft.ok},
                ensure_ascii=False,
            )
        )


if __name__ == "__main__":
    main()
