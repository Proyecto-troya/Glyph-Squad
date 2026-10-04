# Plan de construcción: Leaf Plate

Fuente: `src/Leaf Plate blueprint técnico (1).pdf`. Reto 04 (Agricultura) – Small AI for Development.

**Decisión que apoya:** que Noor nombre el problema de sus hojas de café y avise al técnico de la cooperativa el mismo fin de semana, sin datos móviles.
**IA:** clasificador de visión (5 clases + abstención) en el teléfono. En el último paso (Enviar), un LLM local opcional (`llama3.2:3b` en Ollama, en la laptop) redacta una frase para el técnico. Todo lo demás son reglas o contenido fijo.
**Meta de tamaño:** < 20 MB en total (modelo int8 + onnxruntime-web + audio + código).

---

## 0. Principios (no negociables)

- [ ] Funciona sin conexión; lo único que sale es un SMS que **ella** pulsa enviar. El LLM vive en la laptop (hotspot, sin internet): si no se alcanza, el SMS lleva solo el código.
- [ ] Fail-safe: confianza baja o foto mala → "no estoy seguro" / repetir foto. Los mensajes a Noor son fijos, sin generación libre. El único texto generado es la frase del SMS al técnico: se valida en el servidor y, si falla, se usa una plantilla fija.
- [ ] El código `LP ...` lo arma siempre la app, nunca el LLM; la lista del técnico depende de él.
- [ ] Sin dosis, tratamientos, rendimiento ni precio.
- [ ] Privacidad: fotos y conteo solo en el teléfono; el SMS lleva código de parcela + conteos, sin datos personales.
- [ ] Quechua rotulado como "traducción automática y voz sintética, sin validar por hablante", con español siempre al lado.
- [ ] Cada dataset citado con fuente, licencia, tamaño y lo que **no** cubre.

## 1. Estructura del repositorio

```
leaf-plate/
├─ ml/        manifest.csv, train.py, calibrate.py, evaluate.py, export_onnx.py, tts_quechua.py
├─ app/
│  ├─ src/domain/    sample.ts, message.ts, sms.ts, ranking.ts   (lógica pura + pruebas)
│  ├─ src/adapters/  classifier.ts, photoQuality.ts, audio.ts, storage.ts
│  ├─ src/ui/        Muestra, Resultado, Enviar, Técnico
│  └─ public/        models/{leaf-int8.onnx,calibration.json}, data/messages.json, audio/{quz,es}/*.opus
└─ tests/    golden/ (20–30 fotos), unit/ (sample, message, sms, ranking)
```

> Nota: hoy el repo solo tiene `src/python.ipynb` (vacío). Crear `leaf-plate/` (o `ml/` y `app/` en la raíz) y retirar/reutilizar el notebook para el entrenamiento.

## 2. Contratos de datos (fijar en la hora 0)

```ts
type LeafLabel = "sana" | "roya" | "minador" | "cercospora" | "phoma";
interface LeafResult { label: LeafLabel | "duda"; confidence: number; quality: "ok" | "repetir"; }
interface Sample { plot: string; leaves: LeafResult[]; over15: boolean | null; createdAt: string; }
interface Counts { total; sana; roya; minador; cercospora; phoma; duda: number; }
interface PlotRow { plot: string; sickPct: number; counts: Counts; over15: boolean; flagUnsure: boolean; }
```

**Formato SMS** (< 160 car., una línea): `LP <parcela> <total>H [ROYA<n>] [MIN<n>] [CER<n>] [PHO<n>] [DUDA<n>] [E15+]`
Ej.: `LP P114 30H ROYA7 CER1 DUDA2 E15+`. Clases en 0 se omiten; `E15+` solo si respondió sí.

**Servicio LLM (último paso, lo desarrolla otra persona):** `POST /api/sms` en el servidor FastAPI de la laptop (`:8000`), que llama a Ollama (`:11434`, `llama3.2:3b`, `temperature` 0, `stream` false, salida JSON, tiempo límite 10 s).

```ts
// Petición: sin datos personales, solo lo que ya va en el código.
interface SmsRequest { plot: string; counts: Counts; over15: boolean; flagUnsure: boolean; code: string; }
// Respuesta: una frase en español para el técnico.
interface SmsResponse { text: string; source: "llm" | "fallback"; }
```

El SMS final son dos líneas: el código y la frase. Ej.:
`LP P114 30H ROYA7 CER1 DUDA2 E15+` + salto de línea + `Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas. Plantas de mas de 15 anos.`

Validación en el servidor (si falla → plantilla fija, `source: "fallback"`): código + frase ≤ 160 caracteres; solo ASCII (sin tildes ni ñ, para no bajar el límite a 70); todos los números de la frase salen de la petición y ningún conteo distinto de 0 se omite; sin dosis, productos, tratamientos, rendimiento ni precio; una sola línea que no contenga `LP `.

**Mensajes fijos (`messages.json`)**: M01 sin enfermas · M02–M05 roya/minador/cercospora/phoma (`{n} de {total}`) · M06 dudas > 20 % · M07 foto rechazada · M08 antes de enviar.

## 3. Plan por flujo de trabajo (4 personas en paralelo, 8 h)

### A. Modelo (`ml/`)
| Tramo | Tareas |
|---|---|
| 0:00–0:30 | Fijar 5 clases y métrica; abrir cuaderno con GPU (Colab/Databricks). |
| 0:30–2:00 | `manifest.csv` (ruta, fuente, país, etiqueta, partición); partición 70/15/15 **por hoja completa** (1.747 hojas BRACOL, no recortes); primera corrida. |
| 2:00–4:00 | `train.py`: MobileNetV3-small (timm), 224×224; fase 1 cabeza (AdamW 1e-3, 5 ép.), fase 2 completa (1e-4 coseno, 15 ép., label smoothing 0,1, pesos por clase); aumentos de patio. `calibrate.py`: temperatura (Guo 2017) + umbral con precisión aceptada ≥ 90 % y cobertura. `export_onnx.py`: ONNX opset 17 + int8 estático (~200 imágenes val) → `leaf-int8.onnx` + `calibration.json`. |
| 4:00–6:00 | **E1** (obligatorio): entrenar BRACOL → probar en Saposoa (sana/roya). Abstención con 500 ojo de gallo. Reevaluar el modelo int8 (las métricas son del archivo que va al teléfono). |
| 6:00–7:30 | Tabla de resultados + matriz de confusión; **E2** solo si sobra tiempo. |

### B. Datos y lista del técnico
| Tramo | Tareas |
|---|---|
| 0:00–0:30 | Descargar BRACOL y Saposoa; anotar licencias (CC BY 4.0). |
| 0:30–2:00 | Mapear etiquetas de Saposoa; `sms.ts` y `ranking.ts` con pruebas (ida y vuelta del código; orden por % enfermas; avisos >15 años y muchas dudas). |
| 2:00–4:00 | Página del técnico (pegar/cargar códigos); filtro de calidad (`photoQuality.ts`: varianza del laplaciano, brillo, área de hoja). |
| 4:00–6:00 | Ficha de datos: fuente, licencia, tamaño, vacíos de cada dataset. |
| 6:00–7:30 | Cifras para el relato; cargar códigos de ejemplo en la lista. |

### C. App (Vite + TypeScript, PWA offline)
| Tramo | Tareas |
|---|---|
| 0:00–0:30 | Crear repo y contratos de datos. |
| 0:30–2:00 | 3 pantallas (Muestra, Resultado, Enviar) con **clasificador de mentira**; enlace `sms:<número>?body=<texto>` prellenado. **Puerta hora 2**: recorrido completo con modelo falso. |
| 2:00–4:00 | Integrar `onnxruntime-web` (WASM) + `calibration.json`; pregunta de edad; audio Opus; `storage.ts` (IndexedDB). **Puerta hora 4**: modelo real en el teléfono. |
| 4:00–6:00 | Service worker / modo sin conexión en un Android real; ajustar umbrales de calidad con ~30 fotos propias. Pantalla Enviar: pedir la frase a `POST /api/sms` (dirección del servidor configurable, espera máx. 10 s) y añadirla como segunda línea del SMS; si no responde, enviar solo el código. Rotular la frase como "redactada por IA". **Hora 6: congelar funciones.** |
| 6:00–7:30 | Medir MB y s/foto; corregir fallos, sin funciones nuevas. |
| 7:30–8:00 | Ensayo completo con datos apagados. |

### D. Idioma y evidencia
| Tramo | Tareas |
|---|---|
| 0:00–0:30 | Fijar los 8 mensajes en español; pedir fotos de hojas reales a contactos. |
| 0:30–2:00 | Traducción + retraducción con dos motores (Google Translate y un LLM); primeros clips. |
| 2:00–4:00 | ~40 clips (8 mensajes + números 0–30) con MMS-TTS quechua cusqueño (`tts_quechua.py`); comprobación con reconocedor afinado en corpus Puno; rótulos. |
| 4:00–6:00 | Conjunto dorado (20–30 fotos, varias que deben dar "duda"); probar ruta de duda; buscar validador de quechua. |
| 6:00–7:30 | Fotos propias etiquetadas y contadas; rellenar los `[__]` de la tabla de evidencia. |
| 7:30–8:00 | Ensayo del guion; subir el código. |

## 4. Orden de recorte (si falta tiempo)

1. E2 → 2. varias hojas por foto → 3. comprobación automática del audio → 4. modo instalable (servir desde laptop por red local).
**No se recorta:** clasificador real, abstención, SMS que llega, tabla de medidas.

## 5. Evidencia a producir (tabla de medidas)

| Medida | Dónde | Resultado |
|---|---|---|
| Precisión 5 clases | BRACOL test (por hoja) | [__]% |
| Precisión país no visto (E1) | Saposoa sana/roya | [__]% |
| Abstención ante clase desconocida | Saposoa ojo de gallo | [__]% |
| Cobertura con 90 % de precisión | Validación calibrada | [__]% |
| Fotos propias sobre plato | Android gama baja | [] de [] |
| Tamaño y velocidad | int8 en ese teléfono | [] MB, [] s/foto |
| SMS recibido | Teléfono básico, datos apagados | sí / no |

Pruebas automáticas: unitarias (conteo, elección de mensaje, SMS ida/vuelta, orden de lista) + golden set.

## 6. Guion de la demo en vivo

1. Mostrar Android con Wi-Fi y datos apagados.
2. Foto de una hoja sobre el plato → clase + confianza.
3. Varias hojas → conteo acumulado.
4. Algo que no es café / foto movida → "no estoy seguro" o repetir.
5. Pregunta de edad + audio quechua y español.
6. Botón → la laptop (hotspot, sin internet) redacta la frase con el LLM → SMS prellenado con código + frase → enviar → llega a teléfono básico. Repetir con la laptop apagada: sale solo el código.
7. Pegar ese SMS + 3 más en la página del técnico → lista ordenada (lee la línea del código e ignora la frase).
8. Cerrar con la tabla de medidas.

## 7. Riesgos y plan B

| Riesgo | Plan B |
|---|---|
| Acierta en BRACOL, falla en Perú | Reportar caída, subir umbral de abstención, mostrar que duda. |
| Sin hojas reales de café | Planta de vivero (sanas); hojas impresas solo para el recorrido, rotuladas. |
| Quechua sin validar | Voz sintética rotulada; español al lado; validación = primer paso del piloto. |
| int8 pierde precisión | Usar 16 bits o sin cuantizar; reportar tamaño real. |
| App lenta en Android barato | Bajar resolución de entrada; medir y declarar. |
| `sms:` se comporta distinto | Mostrar el código en grande para copiarlo. |
| El LLM inventa cifras o recomienda tratamientos | Validación en el servidor y plantilla fija; el código nunca pasa por el LLM. |
| Laptop fuera de alcance o LLM lento | Espera máx. 10 s y SMS solo con el código. |
| App en HTTPS no puede llamar a la laptop por HTTP | Servir la app desde el mismo servidor FastAPI (`static/`) o darle HTTPS local. |
| Cámara exige HTTPS | HTTPS local o selector de archivos con cámara nativa. |
| "30 hojas no representan la parcela" | Simplificación del muestreo SENASA (10 plantas × 3 ramas); decide el técnico. |

Supuestos sin verificar: cobertura celular en Santa Teresa; COCLA con técnico y padrón utilizables; licencia del reconocedor de quechua (tratar como no comercial); cifras de contexto leídas en prensa, no en la fuente oficial.

## 8. Entregables fuera de las 8 h

- [ ] Prototipo con código en el repo.
- [ ] Video 2–5 min: frase-problema ("Because of this tool, Noor will … by … that she would otherwise …; we know because …"), qué hace la IA y por qué no basta SMS/hoja de cálculo/búsqueda, demo, dónde entra en su día, qué significa localizar la IA.
- [ ] Ficha de datos (fuente, licencia, tamaño, vacíos) y separación "evidencia del problema" vs. "datos con los que construimos".
- [ ] Declarar: MMS-TTS es CC BY-NC (solo demo); datos sintéticos/impresos etiquetados como tales.

## 9. Solución completa (visión, no demo)

Varias hojas por foto (segmentación), ojo de gallo + deficiencias (CoLeaf-DB), quechua validado y grabado por socias, pasarela SMS en Android de la cooperativa unida al padrón de parcelas, reentrenamiento con fotos con consentimiento, instalación por Bluetooth, y un piloto de campo que mida visitas, tiempos y cosecha.
