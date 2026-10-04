# Leaf Plate

Noor fotografía 30 hojas de café sobre un plato, la app nombra el problema de cada hoja
(o dice "no estoy seguro") y prepara un SMS con el código de parcela y los conteos para el
técnico de la cooperativa. Funciona sin conexión; lo único que sale del teléfono es el SMS
que ella pulsa enviar. Plan completo: [PLAN.md](PLAN.md).

La única IA es el clasificador de visión (5 clases + abstención). El conteo, los mensajes,
el código SMS, el filtro de calidad de la foto y la lista del técnico son reglas.

## App (`app/`)

```
npm install
npm run dev       # desarrollo; --host para abrirla desde el teléfono en la misma red
npm test          # pruebas unitarias: conteo, mensajes, SMS ida y vuelta, lista, calidad de foto
npm run build     # dist/ con service worker (modo sin conexión)
npm run size      # MB de dist/ contra la meta de 20 MB
```

Sin `app/public/models/leaf-int8.onnx` y `calibration.json` la app usa un **clasificador de
mentira** y lo avisa con una franja roja ("MODO DEMOSTRACIÓN"). Sirve para ensayar el
recorrido, no para medir nada.

El service worker y la instalación exigen HTTPS (o `localhost`). La foto se toma con el
selector de archivos de la cámara nativa, que funciona también sin HTTPS.

## Modelo (`ml/`)

```
pip install -r ml/requirements.txt
python ml/make_manifest.py --bracol ml/data/bracol/leaf --saposoa ml/data/saposoa \
    --saposoa-map "carpeta_sana=sana,carpeta_roya=roya,carpeta_ojo_de_gallo=desconocida"
python ml/train.py          # MobileNetV3-small, 2 fases -> ml/out/model.pt
python ml/export_onnx.py    # ONNX opset 17 + int8 -> app/public/models/leaf-int8.onnx
python ml/calibrate.py      # temperatura + umbral -> app/public/models/calibration.json
python ml/evaluate.py       # tabla de medidas sobre el int8 -> ml/out/results.md
python ml/tts_quechua.py    # ~40 clips Opus (necesita ffmpeg) -> app/public/audio/
```

Los datasets se descargan a `ml/data/` (no se suben al repo). Ver [DATOS.md](DATOS.md).

## Estado

Hecho y probado: lógica de dominio (27 pruebas), build y service worker, 4 pantallas con
el clasificador de mentira. La app sin modelo ni audio pesa 13,7 MB (casi todo es el WASM
de onnxruntime-web).

Escrito pero sin ejecutar todavía (faltan datos, GPU o teléfono): entrenamiento, export,
calibración, evaluación, clips de audio, integración ONNX en un navegador real, prueba en
Android con datos apagados y SMS recibido. La tabla de medidas de PLAN.md §5 sigue vacía.
