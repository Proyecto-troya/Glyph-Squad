# Glyph-Squad

Challange

## Leaf Plate gateway (`gateway/`)

`gateway/` is an offline WebSocket gateway in front of a local Ollama server. **It runs on
the demo laptop only.** It is tooling for Quechua translation drafts, back-translation
checks and code/test help. The phone app is offline-first, its only AI is the ONNX leaf
classifier, and every user-facing message comes from `public/data/messages.json`. The
phone app never imports `gateway/` and never opens a WebSocket to it; a test fails if it does.

**One sanctioned exception (decided 2026-10-04):** the Enviar screen may call
`POST /api/sms` on the laptop to get one validated Spanish sentence appended to the
deterministic `LP ...` code line. This breaks the original plan's "no free text
generation" and "the classifier is the only AI" rules on purpose, so those statements in
PLAN.md must be updated. The code-only SMS stays the default and the app must send it alone
whenever the laptop does not answer. Details in the gateway README, section 5b.

See [`gateway/README.md`](gateway/README.md) for setup, the Ollama server config, the
protocol and the use cases.

### What the branch `feature/endpoint_ollama` adds

- `gateway/src/gateway/`: the package (config, protocol, Ollama client layer, security,
  18 action handlers with a registry, WebSocket transport, the `POST /api/sms` sentence
  service, app factory and runner).
- `gateway/examples/`: six laptop use cases (translation drafts, back-translation check
  with System One, embedding similarity, bulk drafts, demo warm-up, ops panel).
- `gateway/tests/`: 243 tests in unit, transport, contract, examples and integration
  suites; the contract suite checks the vendored OpenAPI spec against the registry.
- `gateway/docs/openapi.yaml` (vendored spec), `gateway/schemas/` (JSON Schemas for
  clients), `gateway/.env.example`, `gateway/pyproject.toml` and `gateway/uv.lock`.
- `.gitignore` entries for macOS AppleDouble files and the gateway `.env`.

Verified on 2026-10-03 against Ollama v0.35.1 with cloud disabled, over the laptop's
LAN IP. See the "What's included" section of the gateway README for the full inventory.
