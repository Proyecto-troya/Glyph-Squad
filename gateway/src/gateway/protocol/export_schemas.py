"""Export the payload and envelope models as JSON Schema into ``gateway/schemas/``.

Run: ``python -m gateway.protocol.export_schemas [out_dir]``
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from pydantic import BaseModel

from gateway.protocol.envelope import RequestEnvelope, ResponseEnvelope
from gateway.protocol.payloads import PAYLOAD_MODELS

DEFAULT_OUT = Path(__file__).resolve().parents[3] / "schemas"


def schema_documents() -> dict[str, dict[str, object]]:
    docs: dict[str, dict[str, object]] = {
        "envelope.request.json": RequestEnvelope.model_json_schema(),
        "envelope.response.json": ResponseEnvelope.model_json_schema(),
    }
    for action, model in PAYLOAD_MODELS.items():
        docs[f"{action}.payload.json"] = _schema(model)
    return docs


def _schema(model: type[BaseModel]) -> dict[str, object]:
    return model.model_json_schema(by_alias=True)


def render(doc: dict[str, object]) -> str:
    return json.dumps(doc, indent=2, sort_keys=True) + "\n"


def write_all(out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, doc in schema_documents().items():
        path = out_dir / name
        path.write_text(render(doc), encoding="utf-8")
        written.append(path)
    return written


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    out_dir = Path(args[0]) if args else DEFAULT_OUT
    for path in write_all(out_dir):
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
