"""Ollama version parsing and feature gates [R16][R29]."""

from __future__ import annotations

import re
from dataclasses import dataclass

_VERSION_RE = re.compile(r"^v?(\d+)\.(\d+)(?:\.(\d+))?")


@dataclass(frozen=True, order=True)
class Version:
    major: int
    minor: int
    patch: int = 0

    @classmethod
    def parse(cls, text: str) -> Version:
        match = _VERSION_RE.match(text.strip())
        if not match:
            raise ValueError(f"unrecognised Ollama version: {text!r}")
        major, minor, patch = match.groups()
        return cls(int(major), int(minor), int(patch or 0))

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"


SYSTEMONE_MIN = Version(0, 35, 0)
SYSTEMONE_IMAGES_MIN = Version(0, 35, 1)


@dataclass(frozen=True)
class VersionGate:
    """Pure feature decisions for one known upstream version."""

    version: Version

    @property
    def supports_systemone(self) -> bool:
        return self.version >= SYSTEMONE_MIN

    @property
    def supports_systemone_images(self) -> bool:
        return self.version >= SYSTEMONE_IMAGES_MIN
