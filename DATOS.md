# Ficha de datos

Los campos marcados **[verificar]** hay que confirmarlos en la página de cada dataset al
descargarlo; no se han comprobado todavía.

## Datos con los que construimos

| | BRACOL | Saposoa |
|---|---|---|
| Qué es | Hojas de café arábica fotografiadas enteras, con el estrés predominante anotado | Hojas de café de Saposoa (San Martín, Perú) |
| País | Brasil | Perú |
| Fuente | Krohling, Esgario y Ventura (2019), Mendeley Data, doi:10.17632/yy2k5y8mxg **[verificar]** | **[verificar: cita y URL]** |
| Licencia | CC BY 4.0 **[verificar]** | CC BY 4.0 **[verificar]** |
| Tamaño | 1.747 hojas completas | **[verificar]**; unas 500 de ojo de gallo |
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

- **Voz**: MMS-TTS (`facebook/mms-tts-quz`, `facebook/mms-tts-spa`), licencia CC BY-NC: solo demo.
- **Quechua**: traducción automática (LLM) y voz sintética, **sin validar por hablante**.
  Falta la retraducción con un segundo motor y la revisión de una persona hablante.
- **Reconocedor de quechua** para comprobar el audio: licencia sin confirmar; tratar como no comercial.
- Datos sintéticos o impresos (hojas impresas para el recorrido): se rotulan como tales.

## Evidencia del problema (no son datos de entrenamiento)

Cifras de contexto leídas en prensa, no en la fuente oficial; cobertura celular en Santa
Teresa y disponibilidad de técnico y padrón en COCLA: **supuestos sin verificar**.
