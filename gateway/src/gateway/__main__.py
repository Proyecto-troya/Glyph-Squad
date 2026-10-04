"""``python -m gateway``: run uvicorn with host, port, TLS and WebSocket limits from env [R35]."""

from __future__ import annotations

import logging

import uvicorn

from gateway.config import Settings
from gateway.main import create_app

WS_FRAME_OVERHEAD = 64 * 1024


def main() -> None:
    settings = Settings()
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)  # one line per upstream call is noise
    scheme = "wss" if settings.tls_enabled else "ws"
    logging.getLogger("gateway").info(
        "listening on %s://%s:%d/ws", scheme, settings.host, settings.port
    )
    uvicorn.run(
        create_app(settings),
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        access_log=False,  # the token travels in a header; keep handshakes out of the log
        ssl_certfile=str(settings.ssl_certfile) if settings.ssl_certfile else None,
        ssl_keyfile=str(settings.ssl_keyfile) if settings.ssl_keyfile else None,
        ws_max_size=max(settings.max_message_bytes, settings.max_image_message_bytes)
        + WS_FRAME_OVERHEAD,
        ws_ping_interval=settings.ws_ping_interval_s,
        ws_ping_timeout=settings.ws_ping_timeout_s,
    )


if __name__ == "__main__":
    main()
