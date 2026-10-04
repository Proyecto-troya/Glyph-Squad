"""Use case 3: a second similarity signal from embeddings.

Embed the source and the back-translation with the same model and score with a dot
product. ``/api/embed`` returns unit-length vectors, so this is cosine similarity [R39].
"""

from __future__ import annotations

import argparse
import json

from examples._client import GatewayClient, connect, env_token, env_url


def dot(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError("vectors have different lengths")
    return sum(x * y for x, y in zip(a, b, strict=True))


def similarity(client: GatewayClient, model: str, es_source: str, es_back: str) -> float:
    result = client.request("embed", {"model": model, "input": [es_source, es_back]})
    source_vec, back_vec = result["embeddings"]
    return dot([float(x) for x in source_vec], [float(x) for x in back_vec])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("back")
    parser.add_argument("--model", default="embeddinggemma")
    args = parser.parse_args()
    with connect(env_url(), env_token()) as client:
        score = similarity(client, args.model, args.source, args.back)
    print(json.dumps({"similarity": round(score, 4)}))


if __name__ == "__main__":
    main()
