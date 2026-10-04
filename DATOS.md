# Ficha de datos

Fuente, licencia y tamaño de cada dataset se comprobaron en su página de Mendeley Data el
3 de octubre de 2026. Conviene volver a mirarlas al descargar, porque las condiciones cambian.

## Datos con los que construimos

| | BRACOL | Saposoa |
|---|---|---|
| Qué es | Hojas de café arábica fotografiadas enteras, con el estrés predominante anotado | Hojas de café de Saposoa (San Martín, Perú) |
| País | Brasil | Perú |
| Fuente | Krohling, Esgario y Ventura (2019), [Mendeley Data](https://data.mendeley.com/datasets/yy2k5y8mxg/1), doi:10.17632/yy2k5y8mxg | UNMSM (2026), [Mendeley Data](https://data.mendeley.com/datasets/mfpxg4y65r/2) |
| Licencia | CC BY 4.0 | CC BY 4.0 |
| Tamaño | 1.747 hojas completas (164,5 MB); el zip publicado está cortado y solo pudimos leer 1.401 | 1.500 imágenes (3,4 GB): 999 de sana y roya, 500 de ojo de gallo |
| Clases | sana, roya, minador, cercospora, phoma | sana, roya, ojo de gallo |
| Uso | Entrenar, validar y probar (70/15/15 por hoja) | Solo evaluar: E1 (sana/roya) y abstención (ojo de gallo) |

### Lo que no cubren

- **BRACOL**: un solo país y condiciones de foto controladas; no son fotos de patio sobre un
  plato. No tiene ojo de gallo ni deficiencias de nutrientes. Una hoja con varios problemas
  lleva solo la etiqueta del predominante.
- **Saposoa**: solo dos de nuestras cinco clases (sana y roya); no sirve para medir minador,
  cercospora ni phoma en Perú. Es San Martín, no Cusco (Santa Teresa).
- **Ninguno** tiene fotos hechas por caficultoras con un Android de gama baja. Eso lo cubren
  solo las fotos propias del conjunto dorado (`tests/golden/`), que son pocas.

### Otros componentes

- **Frase para el técnico**: `llama3.2:3b` con Ollama en la laptop del equipo (Llama 3.2 Community License, unos 2 GB, sin internet) o, en el sitio desplegado, `meta/llama-3.1-8b` alojado por Vercel AI Gateway (Llama 3.1 Community License). Solo reciben el código de parcela y los conteos; la frase se valida contra ellos y, si no vale, va la frase fija. No saben quechua ni de café: solo reescriben los conteos.
- **Voz**: MMS-TTS (`facebook/mms-tts-quz`, `facebook/mms-tts-spa`), licencia CC BY-NC: solo demo.
- **Quechua**: traducción automática (LLM) y voz sintética, **sin validar por hablante**.
  Falta la retraducción con un segundo motor y la revisión de una persona hablante.
- **Reconocedor de quechua** para comprobar el audio: licencia sin confirmar; tratar como no comercial.
- Datos sintéticos o impresos (hojas impresas para el recorrido): se rotulan como tales.

## Evidencia del problema (no son datos de entrenamiento)

Cifras de contexto leídas en prensa, no en la fuente oficial; cobertura celular en Santa
Teresa y disponibilidad de técnico y padrón en COCLA: **supuestos sin verificar**.
