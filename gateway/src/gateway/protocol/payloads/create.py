"""POST /api/create payload [R11][R26]."""

from __future__ import annotations

import re
from typing import Any

from pydantic import ConfigDict, Field, model_validator

from gateway.protocol.payloads.common import ChatMessage, ModelName, StrictPayload

DIGEST_PATTERN = r"^sha256:[0-9a-f]{64}$"


class CreatePayload(StrictPayload):
    """Ollama does not quantize GGUF on import, so ``quantize`` is rejected with GGUF files."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    model: ModelName
    from_: str | None = Field(default=None, alias="from")
    files: dict[str, str] | None = None
    draft_files: dict[str, str] | None = None
    template: str | None = None
    renderer: str | None = None
    parser: str | None = None
    system: str | None = None
    parameters: dict[str, Any] | None = None
    messages: list[ChatMessage] | None = None
    license: str | list[str] | None = None
    quantize: str | None = None
    draft_quantize: str | None = None
    requires: str | None = None
    capabilities: list[str] | None = None
    stream: bool = True

    @model_validator(mode="after")
    def _rules(self) -> CreatePayload:
        if self.from_ is None and not self.files:
            raise ValueError("create needs either 'from' or 'files'")
        gguf = _has_gguf(self.files) or _has_gguf(self.draft_files)
        if gguf and (self.quantize or self.draft_quantize):
            raise ValueError(
                "Ollama does not quantize GGUF on import; quantize with llama.cpp first "
                "and drop 'quantize'/'draft_quantize'"
            )
        for mapping in (self.files, self.draft_files):
            for name, digest in (mapping or {}).items():
                if not _is_digest(digest):
                    raise ValueError(f"files['{name}'] must be a 'sha256:<hex>' digest")
        return self


def _has_gguf(files: dict[str, str] | None) -> bool:
    return any(name.lower().endswith(".gguf") for name in (files or {}))


def _is_digest(value: str) -> bool:
    return re.fullmatch(DIGEST_PATTERN, value) is not None
