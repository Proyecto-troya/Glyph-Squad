"""Use case 5: load a model before the live demo and unload it afterwards [R27].

``keep_alive: -1`` keeps the model resident until ``unload`` sends ``keep_alive: 0``.
"""

from __future__ import annotations

import argparse
import json
from typing import Any

from examples._client import GatewayClient, connect, env_token, env_url


def warm_up(client: GatewayClient, model: str) -> dict[str, Any]:
    return client.request("load", {"model": model, "keep_alive": -1})


def cool_down(client: GatewayClient, model: str) -> dict[str, Any]:
    return client.request("unload", {"model": model})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="gemma4:e2b")
    parser.add_argument("--unload", action="store_true", help="unload instead of load")
    args = parser.parse_args()
    with connect(env_url(), env_token()) as client:
        result = cool_down(client, args.model) if args.unload else warm_up(client, args.model)
    print(json.dumps({"model": args.model, "done_reason": result.get("done_reason")}))


if __name__ == "__main__":
    main()
