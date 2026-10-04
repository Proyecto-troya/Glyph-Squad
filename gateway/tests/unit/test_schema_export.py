"""The committed JSON Schemas in gateway/schemas/ match the models."""

from pathlib import Path

from gateway.protocol.export_schemas import DEFAULT_OUT, render, schema_documents, write_all


def test_committed_schemas_are_current() -> None:
    expected = {name: render(doc) for name, doc in schema_documents().items()}
    actual = {
        p.name: p.read_text(encoding="utf-8")
        for p in DEFAULT_OUT.glob("*.json")
        if not p.name.startswith("._")  # macOS AppleDouble files on exFAT
    }
    assert set(actual) == set(expected), "run: python -m gateway.protocol.export_schemas"
    stale = [name for name in expected if actual[name] != expected[name]]
    assert not stale, f"stale schemas {stale}: run python -m gateway.protocol.export_schemas"


def test_write_all_round_trips(tmp_path: Path) -> None:
    written = write_all(tmp_path)
    assert {p.name for p in written} == set(schema_documents())
    assert (tmp_path / "chat.payload.json").read_text(encoding="utf-8").startswith("{")
