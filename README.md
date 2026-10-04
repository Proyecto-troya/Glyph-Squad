# Glyph-Squad

Challange

## Leaf Plate gateway (`gateway/`)

`gateway/` is an offline WebSocket gateway in front of a local Ollama server. **It runs on
the demo laptop only.** It is tooling for Quechua translation drafts, back-translation
checks and code/test help. The phone app is offline-first, its only AI is the ONNX leaf
classifier, and every user-facing message comes from `public/data/messages.json`. The
phone app never imports `gateway/` and never opens a socket to it; a test fails if it does.

See [`gateway/README.md`](gateway/README.md) for setup, the Ollama server config, the
protocol and the use cases.
