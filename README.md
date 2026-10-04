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

Sin `app/public/models/calibration.json` y su modelo `.onnx` la app usa un **clasificador de
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

Hecho y probado: lógica de dominio (31 pruebas), build y service worker, 4 pantallas.
La app con modelo y sin audio pesa 19,5 MB (13,7 MB son el WASM de onnxruntime-web).

Modelo entrenado en CPU con 1.401 de las 1.747 hojas de BRACOL (el zip publicado en
Mendeley está cortado). La cuantización int8 lo hunde (13–27 % en validación), así que la
app lleva el modelo sin cuantizar, `leaf-fp32.onnx` (5,8 MB). Medidas de ese archivo
(`python ml/evaluate.py`):

| Medida | Dónde | Resultado |
|---|---|---|
| Precisión 5 clases | BRACOL test, 202 hojas | 88,1 % |
| Precisión país no visto (E1) | Saposoa sana/roya, 999 fotos | 46,7 % (aceptadas: 60,7 %, cobertura 67,1 %) |
| Abstención ante clase desconocida | Saposoa ojo de gallo, 500 fotos | 7,4 % |
| Cobertura con 90 % de precisión | Validación calibrada, 201 hojas | 89,5 % |

El modelo acierta en Brasil y falla en Perú, y casi nunca se abstiene ante ojo de gallo:
tal como está no sirve para la decisión de Noor.

La frase del LLM en el SMS está preparada pero apagada (`SMS_SERVICE_ENABLED` en
`app/src/adapters/smsService.ts`): el SMS lleva solo el código.

Sin hacer todavía: clips de audio, modelo ONNX probado en un navegador real, prueba en
Android con datos apagados, SMS recibido, conjunto dorado con fotos propias.
