"""Use case 2: does the back-translation keep the meaning of the source?

systemone with a ``noul`` question over ``{es_source, es_back}``. A phrase is kept
only above the configured threshold; phrases near the threshold go to a person.
Confidence is not correctness [R7].
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any

from examples._client import GatewayClient, connect, env_token, env_url

QUESTION = "Does the back-translation keep the meaning of the source?"
REVIEW_BAND = 0.1  # phrases within this distance of the threshold are flagged for review


@dataclass(frozen=True)
class BackTranslationCheck:
    probability: float
    keep: bool
    needs_review: bool
    usage: dict[str, Any]


def build_payload(model: str, es_source: str, es_back: str) -> dict[str, Any]:
    return {
        "model": model,
        "state": {"es_source": es_source, "es_back": es_back},
        "questions": {
            "keeps_meaning": {
                "type": "noul",
                "instructions": QUESTION,
                "criteria": {
                    "false": "The back-translation changes or loses meaning",
                    "true": "The back-translation keeps the meaning of the source",
                },
            }
        },
    }


def decide(probability: float, threshold: float, band: float = REVIEW_BAND) -> tuple[bool, bool]:
    keep = probability > threshold
    needs_review = abs(probability - threshold) <= band
    return keep, needs_review


def check_back_translation(
    client: GatewayClient, model: str, es_source: str, es_back: str, threshold: float
) -> BackTranslationCheck:
    result = client.request("systemone", build_payload(model, es_source, es_back))
    probability = float(result["answers"]["keeps_meaning"]["noul"])
    keep, needs_review = decide(probability, threshold)
    return BackTranslationCheck(probability, keep, needs_review, dict(result.get("usage", {})))


def default_threshold() -> float:
    from gateway.config import Settings

    return Settings().backtranslation_threshold


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Spanish source")
    parser.add_argument("back", help="Spanish back-translation of the Quechua draft")
    parser.add_argument("--model", default="nimble")
    parser.add_argument("--threshold", type=float, default=None)
    args = parser.parse_args()
    threshold = args.threshold if args.threshold is not None else default_threshold()
    with connect(env_url(), env_token()) as client:
        check = check_back_translation(client, args.model, args.source, args.back, threshold)
    print(json.dumps(check.__dict__, indent=2))


if __name__ == "__main__":
    main()
