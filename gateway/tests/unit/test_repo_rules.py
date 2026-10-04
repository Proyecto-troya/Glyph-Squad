"""Rules the task fixes for the whole gateway: no hostnames, short files, no phone-app coupling."""

import re
from pathlib import Path

GATEWAY = Path(__file__).resolve().parents[2]
REPO = GATEWAY.parent

# Code and config only. docs/openapi.yaml is vendored verbatim; README has reference URLs.
SCANNED = ["src", "examples", "tests", ".env.example", "pyproject.toml"]
# Lines that must contain a hostname on purpose (negative tests) carry this marker.
MARKER = "hostname-check: allow"
HOSTNAME = re.compile(
    r"local" + r"host|\b[a-z0-9-]+\.(?:com|org|net|io|dev|local|lan|ai)\b", re.IGNORECASE
)
# Allowed because they are not network endpoints.
ALLOWED = re.compile(
    r"docs\.ollama\.com|pydantic\.dev|ollama\.com\b|errors\.pydantic\.dev|example\.invalid|evil\.invalid"
)


def _real(path: Path) -> bool:
    """Skip macOS AppleDouble files (``._name``) that exFAT volumes grow."""
    return path.is_file() and not path.name.startswith("._") and ".venv" not in path.parts


def _files(root: Path) -> list[Path]:
    if root.is_file():
        return [root]
    return [p for p in root.rglob("*") if _real(p) and p.suffix in {".py", ".toml", ".example"}]


def test_no_hostnames_in_code_or_config() -> None:
    offenders: list[str] = []
    for entry in SCANNED:
        for path in _files(GATEWAY / entry):
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if MARKER in line:
                    continue
                cleaned = ALLOWED.sub("", line)
                for match in HOSTNAME.finditer(cleaned):
                    offenders.append(f"{path.relative_to(GATEWAY)}:{number}: {match.group(0)}")
    assert not offenders, "\n".join(offenders)


def _line_count(path: Path) -> int:
    with path.open(encoding="utf-8") as handle:
        return sum(1 for _ in handle)


def test_every_python_file_is_under_500_lines() -> None:
    too_long = [
        f"{p.relative_to(GATEWAY)} ({_line_count(p)} lines)"
        for p in GATEWAY.rglob("*.py")
        if _real(p) and _line_count(p) >= 500
    ]
    assert not too_long, "\n".join(too_long)


FORBIDDEN_IN_APP = [
    re.compile(r"\bfrom\s+gateway\b|\bimport\s+gateway\b"),
    re.compile(r"wss?://"),
    re.compile(r"/ws\b"),
    re.compile(r"\b8765\b"),
    re.compile(r"\b11434\b"),
]


def test_phone_app_never_imports_or_dials_the_gateway() -> None:
    """``app/src`` must not import ``gateway`` or open a WebSocket to it. Vacuous until it exists.

    The one sanctioned HTTP call is ``POST /api/sms`` (see the gateway README), which the app
    must guard with its code-only fallback; it is not matched here.
    """
    app_src = REPO / "app" / "src"
    if not app_src.exists():
        return
    offenders: list[str] = []
    for path in app_src.rglob("*"):
        if not _real(path) or path.suffix not in {
            ".py",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".mjs",
            ".json",
            ".env",
        }:
            continue
        for number, line in enumerate(
            path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1
        ):
            if any(rule.search(line) for rule in FORBIDDEN_IN_APP):
                offenders.append(f"{path.relative_to(REPO)}:{number}: {line.strip()[:80]}")
    assert not offenders, "the phone app must not depend on the gateway:\n" + "\n".join(offenders)
