# Leaf Plate

*Versión en español: [README.es.md](README.es.md)*

Noor photographs 30 coffee leaves on a plate. The app names the problem on each leaf (or says
"not sure") and prepares an SMS with the plot code and the counts for the cooperative's field
technician. It works offline; the only thing that leaves the phone is the SMS she chooses to
send. Full plan (in Spanish): [PLAN.md](PLAN.md).

The only AI is the vision classifier (5 classes plus abstention). The counting, the messages,
the SMS code, the photo quality filter and the technician's list are all rules.

## App (`app/`)

```
npm install
npm run dev       # development; --host lets you open it from a phone on the same network
npm test          # unit tests: counting, messages, SMS round trip, ranking, photo quality
npm run build     # dist/ with service worker (offline mode)
npm run size      # MB of dist/ against the 20 MB goal
```

Without `app/public/models/calibration.json` and its `.onnx` model the app uses a **fake
classifier** and says so with an amber warning strip ("MODO DEMOSTRACIÓN"). It is good for
rehearsing the flow, not for measuring anything.

The service worker and installation require HTTPS (or `localhost`). Photos are taken through
the native camera file picker, which also works without HTTPS.

The interface starts in Spanish; the ES / QU / EN button under the top bar switches it to
Quechua or English. The Quechua text is a machine translation that no speaker has validated,
and the app says so on screen. The look and the components (analysis viewer, sample map,
confidence meter, SMS code parts) follow the design in [UI-UX-Modules](UI-UX-Modules/README.md). The four screens are Muestra (sample), Resultado (result), Enviar
(send) and Técnico (technician's list).

## Model (`ml/`)

```
pip install -r ml/requirements.txt
python ml/make_manifest.py --bracol ml/data/bracol/leaf --saposoa ml/data/saposoa \
    --saposoa-map "carpeta_sana=sana,carpeta_roya=roya,carpeta_ojo_de_gallo=desconocida"
python ml/train.py          # MobileNetV3-small, 2 phases -> ml/out/model.pt
python ml/export_onnx.py    # ONNX opset 17 + int8 -> app/public/models/leaf-int8.onnx
python ml/calibrate.py      # temperature + threshold -> app/public/models/calibration.json
python ml/evaluate.py       # results table for the int8 model -> ml/out/results.md
python ml/tts_quechua.py    # ~40 Opus clips (needs ffmpeg) -> app/public/audio/
```

Datasets are downloaded to `ml/data/` (not committed to the repo). See [DATOS.md](DATOS.md)
(in Spanish).

## Server (`api/`, Vercel)

Production: https://leaf-plate-kappa.vercel.app (deployed with `npx vercel deploy --prod`).

- `POST /api/send` sends the SMS to the technician. The number is fixed by the server
  (`TECH_NUMBER`, formatted like `+50370000000`) and it only accepts a valid `LP` code. Who
  sends it depends on the environment variables:
  - Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_FROM` (a `+1...` number or an `MG...` Messaging
    Service) and, to authenticate, either `TWILIO_AUTH_TOKEN` or `TWILIO_API_KEY` +
    `TWILIO_API_SECRET`.
  - `SMS_GATEWAY_USER` and `SMS_GATEWAY_PASSWORD`: an Android phone running
    [SMS Gateway for Android](https://github.com/capcom6/android-sms-gateway) in Cloud Server
    mode; the SMS goes out through its SIM.
  - None: it answers `simulated` and sends nothing.
- `POST /api/sms` returns the sentence for the technician: a fixed template, or an LLM if
  `OLLAMA_URL` points to a reachable Ollama server.

Secrets go in `.env`, at the project root, which is not committed to git. `npm run dev` and
`npm run preview` serve `/api/*` using that file. `npm run secrets:check` asks Twilio whether
it accepts the credentials, without sending anything; `npm run secrets:push` copies the values
to the Vercel project without printing them, after which you need to redeploy.
`GET /api/send` reports whether a provider is configured.

Sending through the server needs internet on the phone. The "Abrir SMS" button uses the
phone's own SIM and is the only path that works without mobile data.

## Status

Done and tested: domain logic (31 tests), build, 4 screens and, in Chrome against the
deployment, the real model and the 78 audio clips. The app with model and audio weighs 20.1 MB
(goal: 20 MB; 13.7 MB of that is the onnxruntime-web WASM).

The model was trained on CPU with 1,401 of BRACOL's 1,747 leaves (the zip published on
Mendeley is truncated). int8 quantization wrecks it (13–27 % on validation), so the app ships
the unquantized model, `leaf-fp32.onnx` (5.8 MB). Measurements for that file
(`python ml/evaluate.py`):

| Measure | Where | Result |
|---|---|---|
| 5-class accuracy | BRACOL test, 202 leaves | 88.1 % |
| Accuracy on an unseen country (E1) | Saposoa healthy/rust, 999 photos | 46.7 % (accepted: 60.7 %, coverage 67.1 %) |
| Abstention on an unknown class | Saposoa "ojo de gallo", 500 photos | 7.4 % |
| Coverage at 90 % accuracy | Calibrated validation, 201 leaves | 89.5 % |

The model is right in Brazil and wrong in Peru, and it almost never abstains on "ojo de
gallo" (a disease it was not trained on): as it stands it is not fit for Noor's decision.

The LLM sentence in the SMS is built but switched off (`SMS_SERVICE_ENABLED` in
`app/src/adapters/smsService.ts`): the SMS carries only the code.

Not done yet: offline mode verified (on the development laptop Chrome fails to cache the
14 MB WASM; it still has to be tried on the Android phone), an SMS actually sent and received
(the server has no SMS credentials), Quechua pronunciation reviewed by a speaker, and a golden
set of our own photos.

## License

MIT. See [LICENSE](LICENSE).
