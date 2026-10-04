# Leaf Plate gateway (laptop only)

A FastAPI WebSocket gateway in front of a **local** Ollama server. It exposes every
Ollama native API action to clients on the local network, by IP, fully offline.

It is demo-laptop tooling: Quechua translation drafts, back-translation checks, and
code/test help. **The phone app never imports this package and never opens a socket
to it.** `tests/unit/test_repo_rules.py` fails if `app/src` ever does.

Tested with **Ollama v0.35.1** (latest stable, 2026-09-29). The v0.40 pre-release is
not a target. Python 3.11+, Pydantic v2, httpx, uvicorn.

---

## 1. Ollama server config (laptop)

Set these before starting Ollama. On macOS with the menu-bar app, use `launchctl setenv`
and restart the app; with `ollama serve`, export them in the shell [R27].

| Variable | Value | Why |
|---|---|---|
| `OLLAMA_NO_CLOUD` | `1` | First layer against cloud models. Alternatively `~/.ollama/server.json` with `{"disable_ollama_cloud": true}`. |
| `OLLAMA_HOST` | leave default `127.0.0.1:11434` | Ollama never faces the LAN. Only the gateway does. |
| `OLLAMA_KEEP_ALIVE` | `-1` during the demo | Keeps the model loaded between requests. |
| `OLLAMA_CONTEXT_LENGTH` | sized for the translation prompts (e.g. `8192`) | Check with the `ps` action: `context_length`. |
| `OLLAMA_NUM_PARALLEL` | default `1` | Requests beyond this queue inside Ollama. |
| `OLLAMA_MAX_QUEUE` | default `512` | Beyond this Ollama answers 503, which the gateway maps to `UPSTREAM_BUSY`. |
| `OLLAMA_MODELS` | optional | Where model blobs live (this laptop: `/Volumes/Expansion/repos/ollama-models`). |

```sh
launchctl setenv OLLAMA_NO_CLOUD 1
launchctl setenv OLLAMA_KEEP_ALIVE -1
launchctl setenv OLLAMA_CONTEXT_LENGTH 8192
# restart Ollama.app, then:
grep "cloud disabled" ~/.ollama/logs/server.log | tail -1
# must print: msg="Ollama cloud disabled: true"
```

The gateway's `GATEWAY_MAX_CONCURRENT_PER_SOCKET` (default 4) must stay within what
`OLLAMA_NUM_PARALLEL × OLLAMA_MAX_QUEUE` allows. With the defaults, extra requests simply
queue inside Ollama.

### Second layer: cloud models are blocked in the gateway too

For every model-bound action the gateway reads the cached `/api/tags` entry. If
`remote_model` or `remote_host` is set, the request ends with `CLOUD_MODEL_BLOCKED`.
Name suffixes are not used: both `:cloud` and `-cloud` exist and neither is authoritative.
Ollama's own answers map there too: 502 "cloud unreachable", and the 403
`ollama cloud is disabled: remote model is unavailable` that v0.35.1 returns for a
cloud model that was never pulled (observed live; the errors page [R18] does not list 403).

---

## 2. Setup

Install everything **while online**; the demo runs from the pinned `uv.lock`.

```sh
cd gateway
uv sync --frozen            # runtime + dev deps, exact versions from uv.lock
cp .env.example .env        # fill GATEWAY_TOKEN; never commit .env
```

On an exFAT volume (like this repo's drive) wheel installs fail because macOS writes
AppleDouble `._*` files into the venv. Put the venv on the internal disk:

```sh
export UV_PROJECT_ENVIRONMENT="$HOME/.venvs/leaf-plate-gateway"
uv sync --frozen
```

Models the examples expect (pull while online):

```sh
ollama pull gemma4:e2b       # chat / translation drafts (4.6 GB)
ollama pull embeddinggemma   # similarity signal (0.6 GB)
ollama pull nimble           # decision model for systemone (9.3 GB)
```

### Environment

Every setting is an environment variable with the `GATEWAY_` prefix. Nothing is read
from files. `.env.example` lists them all; the important ones:

| Variable | Default | Notes |
|---|---|---|
| `GATEWAY_TOKEN` | required | Kept as `SecretStr`. Never logged, never hardcoded. |
| `GATEWAY_HOST` / `GATEWAY_PORT` | `127.0.0.1` / `8765` | Set the laptop's LAN IP for the demo. IP literals only. |
| `GATEWAY_OLLAMA_URL` | `http://127.0.0.1:11434` | IP literals only; hostnames fail validation. |
| `GATEWAY_ALLOWED_ORIGINS` | empty | Browser `Origin` must match; non-browser clients send none and pass. |
| `GATEWAY_MAX_MESSAGE_BYTES` | 1 MiB | Text requests. |
| `GATEWAY_MAX_IMAGE_MESSAGE_BYTES` | 32 MiB | Requests whose payload carries `images`. Base64 adds ~33 %. |
| `GATEWAY_MAX_CONCURRENT_PER_SOCKET` | 4 | Excess requests get `UPSTREAM_BUSY`. |
| `GATEWAY_REQUEST_TIMEOUT_S` | 600 | Per request; ends with `TIMEOUT`. |
| `GATEWAY_WS_PING_INTERVAL_S` / `_TIMEOUT_S` | 20 / 20 | Protocol-level heartbeat (uvicorn). |
| `GATEWAY_IMPORT_DIR` | unset | Folder `blob_upload` may read. Unset disables it. |
| `GATEWAY_ENABLED_ACTIONS` | see below | Allowlist. |
| `GATEWAY_SSL_CERTFILE` / `_KEYFILE` | unset | Enables `wss`. |
| `GATEWAY_BACKTRANSLATION_THRESHOLD` | 0.8 | Use case 2. |

Default enabled actions: `version, list, show, ps, load, unload, generate, chat, embed,
systemone, ping`. Opt-in: `create, blob_exists, blob_upload, copy, delete, pull, push`.
`pull` and `push` need internet (`push` also an ollama.com sign-in); when enabled and
offline they fail with a clear "needs internet" message.

---

## 3. Running

### ws (plain, LAN)

```sh
set -a; source .env; set +a
export GATEWAY_HOST=192.168.1.20          # this laptop's LAN IP
python -m gateway
# listening on ws://192.168.1.20:8765/ws
```

`python -m gateway` runs uvicorn with host, port, TLS, `ws_max_size` (image limit plus
headroom) and the ping interval taken from the settings, and with the access log off so
handshake headers never reach the log [R35].

Equivalent uvicorn command, if you prefer it:

```sh
uvicorn --factory gateway.main:create_app --host 192.168.1.20 --port 8765 \
  --no-access-log --ws-max-size 33619968 --ws-ping-interval 20 --ws-ping-timeout 20
```

### wss (when the app is served over local HTTPS for the camera)

Browsers block `ws://` from an `https://` page. Point the two SSL settings at a local
certificate (for example one issued by `mkcert` for the LAN IP) and run the same command:

```sh
export GATEWAY_SSL_CERTFILE=/path/to/192.168.1.20.pem
export GATEWAY_SSL_KEYFILE=/path/to/192.168.1.20-key.pem
python -m gateway
# listening on wss://192.168.1.20:8765/ws
```

or `uvicorn ... --ssl-certfile ... --ssl-keyfile ...` [R35]. Clients then connect to
`wss://192.168.1.20:8765/ws`.

### Connecting

- Non-browser clients: header `X-Gateway-Token: <token>`.
- Browsers cannot set headers; they offer the subprotocols
  `["gateway.v1", "gateway.token.<token>"]`. The server answers with `gateway.v1`, so
  the token is never echoed. Query-string tokens are **not** accepted: they would land in
  access logs.
- A bad token: the server accepts, sends one `error` frame with `UNAUTHORIZED`, then
  closes with code 4401. A bad `Origin` closes with 4403.

```js
const ws = new WebSocket("wss://192.168.1.20:8765/ws", ["gateway.v1", "gateway.token." + token]);
```

---

## 4. Protocol

Endpoint: `/ws`. One JSON text frame per message.

Request:

```json
{"v": 1, "id": "<uuid>", "action": "chat", "payload": {...}}
```

Cancel:

```json
{"v": 1, "id": "<uuid>", "action": "cancel"}
```

Response frames:

```json
{"id": "<uuid>", "type": "chunk" | "result" | "error", "data": {...}}
```

Rules:

- Every request ends with **exactly one** `result` or `error`. Chunks come before it.
- Several requests can run on one socket, matched by `id`. Each runs as its own asyncio
  task. Reusing an id that is still running is `INVALID_REQUEST`.
- `cancel` stops that task and closes the upstream stream; the request ends with
  `error` / `CANCELLED`. Cancelling an unknown or finished id does nothing.
- The envelope is validated strictly (Pydantic v2, no coercion, no unknown keys).
  Payloads are validated by the models in `src/gateway/protocol/payloads/`, exported as
  JSON Schema to `schemas/` (`python -m gateway.protocol.export_schemas`).
- Frames above the size limit are answered with `PAYLOAD_TOO_LARGE`; the id is still
  reported when it can be found near the start of the frame.
- Mid-stream upstream errors (an NDJSON line with `error` while HTTP stays 200) stop the
  stream and end the request with `UPSTREAM_ERROR` and `details.mid_stream = true`.
- `stream` is passed through. With `stream: false` the gateway sends a single `result`
  with Ollama's response. With `stream: true` it forwards every chunk and then sends one
  `result` shaped like the non-streaming response: full content/response, `thinking`,
  all `tool_calls`, `done_reason`, and the usage metrics from the `done: true` chunk.
- The gateway never executes tools. It relays `tool_calls`; the client runs them and
  sends `tool` messages back with `tool_name`.

### Error codes

| Code | When |
|---|---|
| `INVALID_REQUEST` | Bad envelope or payload, duplicate id, model gate (decision model for chat, unknown `think` level, non-decision model for systemone), Ollama 400 |
| `UNKNOWN_ACTION` | Action not in the registry |
| `ACTION_DISABLED` | Action not in `GATEWAY_ENABLED_ACTIONS`, or `blob_upload` without `IMPORT_DIR` |
| `UNAUTHORIZED` | Missing/invalid token, or Origin not allowed (sent once, then close) |
| `PAYLOAD_TOO_LARGE` | Frame above the limit, or Ollama 413 |
| `MODEL_NOT_FOUND` | Ollama 404 (except `blob_exists`, which returns `exists: false`) |
| `CLOUD_MODEL_BLOCKED` | `/api/tags` marks the model remote, Ollama 502, or Ollama 403 "cloud is disabled" |
| `UNSUPPORTED_VERSION` | systemone below 0.35.0; systemone images below 0.35.1 |
| `UPSTREAM_UNAVAILABLE` | Ollama unreachable |
| `UPSTREAM_BUSY` | Ollama 429 or 503 (queue full), or the per-socket concurrency cap |
| `UPSTREAM_ERROR` | Ollama 500, mid-stream error line, other 5xx, or an internal gateway error |
| `TIMEOUT` | `GATEWAY_REQUEST_TIMEOUT_S` exceeded |
| `CANCELLED` | Client sent `cancel` |

HTTP map: 400→`INVALID_REQUEST`, 404→`MODEL_NOT_FOUND`, 413→`PAYLOAD_TOO_LARGE`,
429→`UPSTREAM_BUSY`, 500→`UPSTREAM_ERROR`, 502→`CLOUD_MODEL_BLOCKED`, 503→`UPSTREAM_BUSY`,
403 with "cloud is disabled"→`CLOUD_MODEL_BLOCKED`; other 4xx→`INVALID_REQUEST`, other
5xx→`UPSTREAM_ERROR`.

### Actions, one example each

All examples omit the envelope; `payload` is shown. Responses are Ollama's JSON unless noted.

**generate** (stream) — `POST /api/generate` [R3]
```json
{"model": "gemma4:e2b", "prompt": "Why is the sky blue?", "stream": true, "think": false,
 "options": {"temperature": 0}}
```
Chunks: `{"model", "created_at", "response", "done": false}` … Final result: `{"response": "<full text>", "done": true, "done_reason": "stop", "eval_count": 42, ...}`.

**chat** (stream) — `POST /api/chat` [R4]
```json
{"model": "gemma4:e2b", "stream": false, "format": {"type": "object", "properties": {"quz": {"type": "string"}, "notes": {"type": "string"}}, "required": ["quz", "notes"]},
 "messages": [{"role": "user", "content": "Translate to Quechua: Las hojas se ponen amarillas"}]}
```
Tool loop: the assistant message carries `thinking` and `tool_calls` `[{"type": "function", "function": {"index": 0, "name": "...", "arguments": {...}}}]`; the client answers with `{"role": "tool", "tool_name": "...", "content": "..."}`.

**load** — `POST /api/generate` with no prompt [R3][R27]
```json
{"model": "gemma4:e2b", "keep_alive": -1}
```

**unload** — same, with `keep_alive: 0` set by the gateway
```json
{"model": "gemma4:e2b"}
```

**embed** — `POST /api/embed` [R5][R39]
```json
{"model": "embeddinggemma", "input": ["hoja amarilla", "yellow leaf"]}
```
Result: `{"embeddings": [[...], [...]], "prompt_eval_count": 7}` (unit-length vectors).

**systemone** — `POST /v1/systemone` [R6][R7]. Ollama ≥ 0.35.0; `images` need ≥ 0.35.1 and Clef / Clef Flash
```json
{"model": "nimble", "state": {"es_source": "La hoja tiene manchas", "es_back": "La hoja presenta manchas"},
 "questions": {"keeps_meaning": {"type": "noul", "instructions": "Does the back-translation keep the meaning of the source?"},
               "label": {"type": "choice", "instructions": "Which fits?", "criteria": {"healthy": "No damage", "diseased": "Disease signs"}},
               "severity": {"type": "score", "instructions": "How severe?", "criteria": ["none", "mild", "severe"]}}}
```
Result: `{"answers": {"keeps_meaning": {"type": "noul", "noul": 0.93}, "label": {"type": "choice", "choice": "diseased", "probabilities": {...}, "confidence": 0.81}, ...}, "usage": {"input_tokens": 120, "output_tokens": 1}}`. Images must be base64 PNG, JPEG or WebP.

**list** — `GET /api/tags` [R8]: `{}` → `{"models": [{"name", "size", "digest", "details", "remote_model"?, ...}]}`

**ps** — `GET /api/ps` [R9]: `{}` → `{"models": [{"name", "size_vram", "context_length", "expires_at", ...}]}`

**show** — `POST /api/show` [R10]
```json
{"model": "gemma4:e2b", "verbose": false}
```
Result includes `capabilities` and `thinking: {"values": [...], "default": ...}`.

**version** — `GET /api/version` [R16]: `{}` → `{"version": "0.35.1", "gates": {"systemone": true, "systemone_images": true}}` (gates added by the gateway).

**create** (stream, opt-in) — `POST /api/create` [R11][R26]
```json
{"model": "leaf-quz", "files": {"model-00001-of-00002.gguf": "sha256:<hex>", "model-00002-of-00002.gguf": "sha256:<hex>"}, "system": "You translate to Quechua."}
```
Chunks are status events; result `{"status": "success", "events": N}`. `quantize` with GGUF files is rejected: Ollama does not quantize GGUF on import, quantize with llama.cpp first. Split GGUF: one `files` entry per shard under its original name.

**blob_exists** (opt-in) — `HEAD /api/blobs/{digest}` [R2]
```json
{"digest": "sha256:<hex>"}
```
Result `{"digest": "...", "exists": true|false}`; 404 is an answer, not an error.

**blob_upload** (opt-in, needs `GATEWAY_IMPORT_DIR`) — `POST /api/blobs/{digest}` [R2][R26]
```json
{"file": "model.gguf"}
```
The file name must be a bare name inside `IMPORT_DIR` (traversal and symlinks out of the folder are rejected). The gateway computes the SHA-256 itself and streams the file to Ollama; nothing crosses the WebSocket. Result `{"file", "digest", "size", "created": true|false}` (201 created / 200 already existed).

**copy** (opt-in) — `POST /api/copy` [R12]: `{"source": "gemma4:e2b", "destination": "leaf-draft"}` → `{"status": "success", ...}`

**delete** (opt-in) — `DELETE /api/delete` with a JSON body [R15][R33]: `{"model": "leaf-draft"}` → `{"status": "success", "model": "leaf-draft"}`

**pull** (stream, opt-in, needs internet) — `POST /api/pull` [R13]: `{"model": "gemma4:e2b", "insecure": false, "stream": true}`

**push** (stream, opt-in, needs internet + ollama.com sign-in) — `POST /api/push` [R14][R27]: `{"model": "me/leaf-quz", "stream": true}`

**ping** — no upstream: `{}` → `{"pong": true, "ts": 1759...}`

### Model gates

- `think`: validated against cached `/api/show → thinking.values`. Accepted: a boolean
  listed in `values`, an exact level string listed in `values`, or `null` (model default).
  Numbers are rejected by the schema. Unknown level names are rejected because Ollama would
  silently fall back to the default. A model without thinking metadata accepts `true`/`false`
  only.
- Decision models report only `decision` in `capabilities` (Ollama ≥ 0.35.1); they are
  rejected for `chat` and `generate`. Non-decision models are rejected for `systemone`.
- `systemone` images need Ollama ≥ 0.35.1 and a model with `vision` (Clef, Clef Flash).

---

## 5. Use cases (`examples/`)

Each example is a small CLI and a pure function tested against the fake Ollama through
the real WebSocket transport (`tests/examples/`). Set `GATEWAY_URL` (default
`ws://127.0.0.1:8765/ws`) and `GATEWAY_TOKEN`.

| # | Example | Action | Notes |
|---|---|---|---|
| 1 | `translation_draft.py "Las hojas se ponen amarillas"` | chat, `stream: false`, temperature 0 | `format` is the `{quz, notes}` JSON schema, repeated in the prompt [R21] |
| 2 | `back_translation_check.py "<source>" "<back>"` | systemone `noul` | state `{es_source, es_back}`; keep above `GATEWAY_BACKTRANSLATION_THRESHOLD`; phrases within ±0.1 of it are flagged for human review. Confidence is not correctness [R7] |
| 3 | `similarity_signal.py "<source>" "<back>"` | embed | dot product of unit vectors [R39] |
| 4 | `bulk_drafts.py "frase 1" "frase 2"` | show + chat | `think: false` only when `/api/show` lists `false` [R20] |
| 5 | `demo_warmup.py [--unload]` | load / unload | `keep_alive: -1` before the demo, unload afterwards [R27] |
| 6 | `ops_panel.py` | version, ps, list | `context_length`, `size_vram`, `expires_at` |

Run with `uv run python -m examples.translation_draft "..."` from `gateway/`.

Never use an LLM or vision model to label golden-set or evidence photos. Labels come
from people.

---

## 6. Out of scope

- OpenAI-compatible `/v1/*` endpoints, except `/v1/systemone` [R24].
- Anthropic-compatible `/v1/messages` [R25].
- ollama.com `web_search` / `web_fetch`: cloud-only, need an API key [R23].
- Cloud models of any kind [R1][R19].
- `OLLAMA_API_KEY` and `Authorization` headers are never read, stored or forwarded.

`tests/contract/test_openapi_coverage.py` keeps this list honest: every `operationId`
in `docs/openapi.yaml` must be registered or listed there with a reason.

### Spec gaps found (vendored 2026-10-03)

The spec is the source of truth together with the docs pages; where they disagree the
newer page wins. Gaps the models account for:

- `ChatMessage` lacks `thinking` (assistant messages in multi-turn and tool loops) and
  `tool_name` (tool results). Both are in the tool-calling guide [R22]. Modeled explicitly.
- `ToolCall` lacks `type: "function"` and `function.index`, both used by the guide [R22].
- `ChatMessage.content` is `required` in the spec, but assistant messages that only carry
  `tool_calls` omit it in the guide. The model defaults it to `""`.
- `EmbedRequest.keep_alive` is string-only; generate and chat accept a number too. The
  model accepts both.
- The `/v1/systemone` operation description does not say that `images` require Ollama
  0.35.1 and Clef / Clef Flash; only the `SystemOneRequest.images` schema text and the
  decision guide [R7] / release notes [R29] do. The gateway gates on the version.
- The errors page [R18] lists 400/404/429/500/502 only. Ollama 0.35.1 with
  `OLLAMA_NO_CLOUD=1` answers **403** `ollama cloud is disabled: remote model is
  unavailable` for cloud models, and `/v1/systemone` adds 413. Both are mapped.
- `servers[0].url` is `http://localhost:11434`. The gateway never uses it; the upstream
  comes from `GATEWAY_OLLAMA_URL` and must be an IP literal.

---

## 7. Offline notes

- No hostnames anywhere in code or config, including the loopback name. Settings reject
  them; `tests/unit/test_repo_rules.py` greps for them. Manual check:
  ```sh
  grep -rnE 'localhost|[a-z0-9-]+\.(com|org|net|io|dev|local|lan)' src examples tests .env.example pyproject.toml
  ```
  (expected hits are only the negative test fixtures marked `hostname-check: allow`
  and the reference comments pointing at docs.ollama.com).
- No outbound calls except Ollama at `GATEWAY_OLLAMA_URL`: no CDN, no telemetry, no
  runtime downloads. FastAPI's docs pages are disabled so nothing loads from a CDN.
- `uv sync --frozen` before going offline; the lockfile pins every dependency.
- `pull`/`push` are the only actions that leave the laptop; both are off by default.
- Verified on 2026-10-03 against Ollama 0.35.1 over the laptop's LAN IP (not loopback):
  connect by IP with header and subprotocol auth, wrong token closes 4401, `list`, a
  streamed `chat` cancelled mid-stream, `load`/`unload`, `embed`, structured-output
  drafts, and cloud models (`gpt-oss:120b-cloud`, `gemma4:31b-cloud`) answered with
  `CLOUD_MODEL_BLOCKED`. Repeat the same checks from a second device on the demo hotspot
  before the demo; only the network path differs.

---

## 8. Development

```sh
export UV_PROJECT_ENVIRONMENT="$HOME/.venvs/leaf-plate-gateway"   # only on exFAT drives
uv sync --frozen
uv run pytest                     # unit, transport, contract, examples
uv run pytest -m integration      # needs Ollama at 127.0.0.1:11434; skips otherwise
uv run mypy                       # strict
uv run ruff check . && uv run ruff format --check .
uv run python -m gateway.protocol.export_schemas   # refresh schemas/ after model changes
```

Layout (see the task blueprint):

```
src/gateway/
  config/     settings.py (pydantic-settings, env only)
  protocol/   envelope, error codes, payload models, schema export
  actions/    one module per action + registry.py (adding an action = module + one line)
  ollama/     OllamaClient protocol, httpx adapter, NDJSON, aggregation, error map, caches
  transport/  /ws route, Session (ids, cancel, timeout, limits), runtime contract
  security/   auth, origin, size limits, cloud guard, routing gates
  main.py     app factory (composition root)
```

Transport imports nothing from `gateway.ollama`; handlers never see the WebSocket; both
depend on `typing.Protocol` interfaces injected through `create_app`.

---

## References

Ollama API (official)
- [R1]  API introduction: https://docs.ollama.com/api/introduction.md
- [R2]  OpenAPI spec: https://docs.ollama.com/openapi.yaml (vendored at `docs/openapi.yaml`)
- [R3]  Generate: https://docs.ollama.com/api/generate.md
- [R4]  Chat: https://docs.ollama.com/api/chat.md
- [R5]  Embed: https://docs.ollama.com/api/embed.md
- [R6]  System One: https://docs.ollama.com/api/systemone.md
- [R7]  Decision guide: https://docs.ollama.com/capabilities/decision.md
- [R8]  List models: https://docs.ollama.com/api/tags.md
- [R9]  List running models: https://docs.ollama.com/api/ps.md
- [R10] Show model details: https://docs.ollama.com/api-reference/show-model-details.md
- [R11] Create a model: https://docs.ollama.com/api/create.md
- [R12] Copy a model: https://docs.ollama.com/api/copy.md
- [R13] Pull a model: https://docs.ollama.com/api/pull.md
- [R14] Push a model: https://docs.ollama.com/api/push.md
- [R15] Delete a model: https://docs.ollama.com/api/delete.md
- [R16] Get version: https://docs.ollama.com/api-reference/get-version.md
- [R17] Streaming: https://docs.ollama.com/api/streaming.md
- [R18] Errors: https://docs.ollama.com/api/errors.md
- [R19] Authentication: https://docs.ollama.com/api/authentication.md
- [R38] Usage metrics: https://docs.ollama.com/api/usage.md

Ollama capabilities and guides
- [R20] Thinking: https://docs.ollama.com/capabilities/thinking.md
- [R21] Structured outputs: https://docs.ollama.com/capabilities/structured-outputs.md
- [R22] Tool calling: https://docs.ollama.com/capabilities/tool-calling.md
- [R23] Web search (out of scope): https://docs.ollama.com/capabilities/web-search.md
- [R24] OpenAI compatibility (out of scope): https://docs.ollama.com/api/openai-compatibility.md
- [R25] Anthropic compatibility (out of scope): https://docs.ollama.com/api/anthropic-compatibility.md
- [R26] Importing a model: https://docs.ollama.com/import.md
- [R27] FAQ (server config, keep_alive, concurrency, cloud off): https://docs.ollama.com/faq.md
- [R28] Docs index: https://docs.ollama.com/llms.txt
- [R37] Context length: https://docs.ollama.com/context-length.md
- [R39] Embeddings guide: https://docs.ollama.com/capabilities/embeddings.md
- [R40] Vision guide: https://docs.ollama.com/capabilities/vision.md

Ollama releases
- [R29] v0.35.1 release notes: https://github.com/ollama/ollama/releases/tag/v0.35.1
- [R30] All releases: https://github.com/ollama/ollama/releases

Stack
- [R31] FastAPI WebSockets: https://fastapi.tiangolo.com/advanced/websockets/
- [R32] FastAPI testing WebSockets: https://fastapi.tiangolo.com/advanced/testing-websockets/
- [R33] HTTPX async client: https://www.python-httpx.org/async/
- [R34] Pydantic v2 JSON Schema: https://docs.pydantic.dev/latest/concepts/json_schema/
- [R35] Uvicorn settings (host, SSL): https://www.uvicorn.org/settings/
- [R36] pydantic-settings: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
