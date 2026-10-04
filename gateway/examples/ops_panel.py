"""Use case 6: ops panel. version, loaded models (context_length, size_vram, expires_at), list."""

from __future__ import annotations

import json
from typing import Any

from examples._client import GatewayClient, connect, env_token, env_url


def ops_snapshot(client: GatewayClient) -> dict[str, Any]:
    version = client.request("version")
    ps = client.request("ps")
    listed = client.request("list")
    return {
        "version": version.get("version"),
        "gates": version.get("gates", {}),
        "running": [
            {
                "model": m.get("model") or m.get("name"),
                "context_length": m.get("context_length"),
                "size_vram": m.get("size_vram"),
                "expires_at": m.get("expires_at"),
            }
            for m in ps.get("models", [])
        ],
        "installed": [
            {
                "name": m.get("name"),
                "size": m.get("size"),
                "remote": bool(m.get("remote_model") or m.get("remote_host")),
            }
            for m in listed.get("models", [])
        ],
    }


def main() -> None:
    with connect(env_url(), env_token()) as client:
        snapshot = ops_snapshot(client)
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    main()
