# UI-UX-Modules

Espacio de trabajo para el diseño de interfaz y experiencia de Leaf Plate: propuestas de
pantallas, componentes, flujos y guías visuales antes (o en paralelo) de llevarlas a
`app/src/ui/`.

## Documentos

- [Leaf Plate UI Blueprint](leaf-plate-ui-blueprint.html): especificación de la interfaz
  (navegación, estructura de página, pantallas A–F, componentes con sus clases CSS, tokens
  de `style.css` y restricciones). Ábrelo en el navegador.
- [Blueprint técnico](leaf-plate-blueprint.md): contexto de la aplicación (usuaria, flujo,
  modelo, mensajes fijos, formato del SMS).
- [Dirección de diseño](DISENO.md): decisiones de la propuesta visual, colores medidos y
  cómo aplicarla en la app.
- [Prototipo](prototipo/index.html): los 17 estados de las 6 pantallas con la hoja de estilos
  propuesta ([`prototipo/style.css`](prototipo/style.css)). Ábrelo con doble clic.
- [Componentes nuevos](COMPONENTES.md): visor de análisis, mapa de la muestra, medidor de
  confianza y demás piezas de la versión 3, con su markup y los cambios en `app/src/`.
- [Logos, iconos e ilustraciones](assets/README.md): lista de todas las piezas gráficas con
  sus especificaciones y la carpeta donde va cada archivo.

## Pantallas actuales de la app

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Muestra | `app/src/ui/Muestra.ts` | Toma de fotos de las hojas y filtro de calidad. |
| Resultado | `app/src/ui/Resultado.ts` | Conteo por clase y mensajes predefinidos según el conteo para Noor. |
| Enviar | `app/src/ui/Enviar.ts` | Vista previa del SMS que ella pulsa enviar. |
| Técnico | `app/src/ui/Tecnico.ts` | Lista de parcelas ordenada para el técnico. |

## Principios que el diseño debe respetar

Tomados de [PLAN.md](../PLAN.md) §0:

- Funciona sin conexión; lo único que sale del teléfono es el SMS que ella envía.
- Ante confianza baja o foto mala, mostrar "no estoy seguro" o pedir repetir la foto.
- Sin dosis, tratamientos, rendimiento ni precio.
- Quechua rotulado como "traducción automática y voz sintética, sin validar por hablante",
  con español siempre al lado.
- Meta de tamaño total < 20 MB: evitar fuentes, imágenes o librerías pesadas.

## Estructura sugerida

```
UI-UX-Modules/
├─ flujos/        diagramas del recorrido (Muestra → Resultado → Enviar, vista Técnico)
├─ wireframes/    bocetos por pantalla
├─ componentes/   botones, tarjetas de conteo, franjas de aviso, etc.
└─ guia-visual/   colores, tipografía, iconos, accesibilidad
```
