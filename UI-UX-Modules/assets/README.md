# Leaf Plate: logos, iconos e ilustraciones

Lista de todas las piezas gráficas que necesita la app, con sus especificaciones para crearlas en otra herramienta (Figma, Illustrator, Inkscape) y la carpeta donde va cada archivo. Cuando un archivo esté listo, se guarda en su carpeta **con el nombre exacto de esta lista** y se marca su casilla.

Para pedírselas a un asistente de IA o a otra persona sin más contexto, usar [BRIEF-LLM.md](BRIEF-LLM.md): las mismas especificaciones con la descripción del producto, la usuaria y la dirección visual.

```text
assets/
├─ marca/            logos de Leaf Plate (A)
├─ app/              favicon e iconos de la app instalada (B)
├─ iconos/
│  ├─ ui/            iconos de botones, pestañas y estados (C)
│  └─ clases/        un icono por clase de hoja (D)
└─ ilustraciones/    guías de foto y de muestreo (E, opcional)
```

Prioridad: **1** = hace falta para la demo, **2** = para la dirección "visor de análisis" (componentes nuevos), **3** = opcional.

## Paleta

Usar solo estos colores. Son los de [DISENO.md](../DISENO.md), con su contraste ya medido.

| Nombre | Hex | Uso en gráficos |
|---|---|---|
| Verde bosque | `#133f27` | Fondo de iconos de app, marca sobre claro |
| Verde | `#1f6b3a` | Hoja de la marca, acentos |
| Menta | `#d4ecd9` | Acento sobre fondo bosque |
| Verde suave | `#e0f0e4` | Fondos suaves de ilustración |
| Blanco | `#ffffff` | Plato, marca sobre bosque |
| Tinta | `#141a16` | Trazos de ilustración |
| Clases | sana `#2e8b57` · roya `#c25a14` · minador `#8a5a2b` · cercospora `#7a4fa3` · phoma `#2f6f9f` · duda `#a37800` | Solo en ilustraciones; los iconos de clase van en un color (ver D) |

## Reglas para todos los SVG

- SVG 1.1 con `viewBox` y **sin** `width` ni `height` fijos.
- Texto convertido a trazos: nada de `<text>`, porque la app no puede depender de una fuente instalada.
- Sin imágenes incrustadas (`<image>`, base64), sin filtros, sin `<style>` interno, sin `id` y sin metadatos del editor.
- Exportar con trazos aplanados y luego limpiar con SVGO: `npx svgo --multipass archivo.svg`.
- Nombres en minúsculas, con guiones, sin espacios ni tildes, exactamente como en las tablas.
- Todo original o con licencia que permita usarlo. Si una pieza parte de otra (Lucide, una foto, un generador de IA), anotarlo en la columna "Origen" de [Créditos](#créditos).

---

## A. Marca → `marca/`

La marca actual es un plato blanco visto desde arriba con una hoja encima; es buena base. Pueden reinterpretarla, pero debe seguir leyéndose como "hoja sobre plato".

| ☐ | Archivo | Qué es | Lienzo | Colores | Prioridad |
|---|---|---|---|---|---|
| ☐ | `logo-marca.svg` | Marca sola: plato + hoja | `viewBox="0 0 64 64"`, contenido dentro de 60×60 | Bosque, verde, blanco | 1 |
| ☐ | `logo-marca-mono.svg` | La misma marca en un solo color | `0 0 64 64` | Solo `fill="currentColor"`; los huecos transparentes, no blancos | 1 |
| ☐ | `logo-horizontal.svg` | Marca + "Leaf Plate" a la derecha | Alto 64, ancho libre (cerca de 4:1) | Para fondo claro | 1 |
| ☐ | `logo-horizontal-inverso.svg` | Igual, para fondo bosque | Alto 64 | Blanco y menta | 1 |
| ☐ | `logo-vertical.svg` | Marca arriba, nombre debajo | Ancho libre (cerca de 1:1) | Para fondo claro | 3 |
| ☐ | `logo-vertical-inverso.svg` | Igual, para fondo bosque | | Blanco y menta | 3 |

- **Tipografía del nombre:** IBM Plex Sans 700, la misma de la app, u otra si se justifica. Siempre convertida a trazos.
- **Área de respeto:** alrededor del logo, un margen libre igual a un cuarto del alto de la marca.
- **Tamaños mínimos:** marca 24 px (debajo de eso se usa `favicon.svg`); logo horizontal 96 px de ancho.
- **Pruebas:** a 24, 48 y 128 px, sobre blanco y sobre `#133f27`, y en escala de grises.
- **Dónde se usa:** la mono reemplaza a la marca de la barra superior (hoy `span.brand-mark` con el icono `leaf`). Los demás sirven para el video, el deck y la documentación.

## B. Iconos de la app instalada → `app/` (luego van a `app/public/`)

Son los que ve el teléfono al instalar la app y en la pestaña del navegador.

| ☐ | Archivo | Uso | Formato y tamaño | Especificación | Prioridad |
|---|---|---|---|---|---|
| ☐ | `favicon.svg` | Pestaña del navegador | SVG, `viewBox="0 0 32 32"` | Marca simplificada para 16–32 px: menos detalle, trazos gruesos, fondo bosque | 1 |
| ☐ | `icon-192.png` | Icono de la app (`purpose: any`) | PNG 192×192, sRGB | Puede tener transparencia; la marca con su propia forma de fondo | 1 |
| ☐ | `icon-512.png` | Icono de la app (`purpose: any`) | PNG 512×512 | Igual que el de 192 | 1 |
| ☐ | `icon-maskable-192.png` | Icono adaptable de Android | PNG 192×192 | Como el de 512 maskable | 1 |
| ☐ | `icon-maskable-512.png` | Icono adaptable de Android (`purpose: maskable`) | PNG 512×512 | Fondo `#133f27` a sangre, sin transparencia. La marca entera dentro del círculo central de 410 px (zona segura del 80 %), porque Android recorta la forma | 1 |
| ☐ | `icon-monochrome-512.png` | Iconos con tema de Android 13+ (`purpose: monochrome`) | PNG 512×512 | Silueta blanca sobre transparente, dentro de la misma zona segura | 3 |
| ☐ | `apple-touch-icon.png` | Pantalla de inicio de iPhone | PNG 180×180 | Opaco, fondo bosque. El público es Android, así que es opcional | 3 |
| ☐ | `favicon.ico` | Navegadores viejos | ICO con 16×16 y 32×32 | Generado desde `favicon.svg` | 3 |

- **Peso:** cada PNG optimizado (oxipng, TinyPNG o Squoosh) por debajo de 20 KB.
- **Prueba del maskable:** cargarlo en [maskable.app](https://maskable.app) y revisar las formas círculo, gota y cuadrado redondeado.
- **Pantalla de arranque:** Android la arma sola con el icono de 512 y el `background_color` del manifest, así que no hace falta un archivo aparte.
- **Para quien integre** (fuera de esta carpeta): en `app/public/manifest.webmanifest`, separar los iconos `any` y `maskable`, que hoy van juntos en un solo `icon.svg`, y cambiar `theme_color` a `#133f27`:

```json
"theme_color": "#133f27",
"icons": [
  { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
  { "src": "icon-monochrome-512.png", "sizes": "512x512", "type": "image/png", "purpose": "monochrome" }
]
```

## C. Iconos de interfaz → `iconos/ui/`

Van dentro del código (`app/src/ui/icons.ts`), así que el nombre del archivo es el nombre con el que el código los llama: `leaf.svg` se usa como `icon("leaf")`.

**Especificación técnica (igual para todos):**

- `viewBox="0 0 24 24"`, área útil de 20×20 (2 px de margen).
- **Trazo de 2 px**, puntas y uniones redondeadas, sin relleno. Que no lleven color ni grosor escritos: la app los pone por CSS (`stroke: currentColor; stroke-width: 2; fill: none`).
- Solo `<path>`, `<circle>`, `<rect>`, `<line>`, `<polyline>`, `<ellipse>`. Si un detalle necesita relleno (un punto), ese elemento lleva `fill="currentColor"`.
- Esquinas con radio de 2 px cuando haya rectángulos, para que el set se vea parejo.
- Menos de 1 KB cada uno.
- Probar a 16, 24 y 48 px, sobre blanco y sobre bosque.

**Reemplazos de los 15 actuales.** Hoy son iconos de Lucide (licencia ISC, que pide conservar su aviso). Si se dibujan propios, se reemplazan uno a uno con el mismo nombre:

| ☐ | Archivo | Dónde aparece | Idea | Prioridad |
|---|---|---|---|---|
| ☐ | `leaf.svg` | Pestaña Muestra, formulario | Hoja de café: elíptica, punta marcada, nervadura central | 1 |
| ☐ | `chart.svg` | Pestaña Resultado | Barras de conteo | 1 |
| ☐ | `send.svg` | Pestaña Enviar | Avión de papel o flecha de envío | 1 |
| ☐ | `list.svg` | Pestaña Técnico | Portapapeles con lista | 1 |
| ☐ | `camera.svg` | Botón "Foto de una hoja" | Cámara | 1 |
| ☐ | `volume.svg` | Botones de audio Español / Quechua | Parlante con ondas | 1 |
| ☐ | `message.svg` | Botón "Abrir SMS para el técnico" | Globo de mensaje | 1 |
| ☐ | `copy.svg` | Botón "Copiar mensaje" | Dos hojas superpuestas | 1 |
| ☐ | `undo.svg` | Botón "Quitar la última" | Flecha que vuelve | 1 |
| ☐ | `check.svg` | "Muestra completa" | Visto | 1 |
| ☐ | `alert.svg` | Franja de demostración | Triángulo con signo de exclamación | 1 |
| ☐ | `upload.svg` | Botón "Subir archivo" | Flecha hacia arriba sobre bandeja | 1 |
| ☐ | `refresh.svg` | Botón "Pedir la frase otra vez" | Flechas en círculo | 1 |
| ☐ | `plus.svg` | Botón "Empezar otra parcela" | Signo más | 1 |
| ☐ | `arrow.svg` | Botones de avanzar | Flecha a la derecha | 1 |

**Nuevos, para la dirección "visor de análisis":**

| ☐ | Archivo | Para qué | Idea | Prioridad |
|---|---|---|---|---|
| ☐ | `plate.svg` | Estado vacío y guía de foto | Plato visto desde arriba (dos círculos concéntricos) | 2 |
| ☐ | `scan.svg` | Momento de análisis de la IA | Hoja dentro de cuatro esquinas de visor | 2 |
| ☐ | `local-ai.svg` | Indicador "IA en el teléfono" | Chip (cuadrado con patitas) con una hoja dentro | 2 |
| ☐ | `offline.svg` | Indicador "sin datos" | Antena o nube tachada | 2 |
| ☐ | `focus.svg` | Paso "Nitidez" del análisis | Esquinas de enfoque con un punto central | 2 |
| ☐ | `sun.svg` | Paso "Luz" del análisis | Sol con rayos cortos | 2 |
| ☐ | `plant-age.svg` | Pregunta "¿más de 15 años?" | Cafeto con tronco grueso, o tronco con anillos | 2 |
| ☐ | `technician.svg` | Mensajes que nombran al técnico | Persona con portapapeles | 3 |
| ☐ | `cooperative.svg` | Lista del técnico, créditos | Grupo de casas o tres personas | 3 |

## D. Iconos de clase de hoja → `iconos/clases/`

Uno por resultado del modelo. El nombre usa la etiqueta exacta del código (`LeafLabel` y `"duda"`), así la app los llama con `icon(\`class-${label}\`)`.

**Especificación técnica:** la misma que en C (`0 0 24 24`, trazo de 2 px, un solo color `currentColor`). La app los pinta con el color de cada clase, así que **no llevan color propio**.

- **Base común:** las seis comparten la misma silueta de hoja; solo cambia el síntoma dibujado dentro. Así se leen como familia.
- **Abstractos:** son señales, no ilustración médica. No deben prometer más precisión que el modelo.
- **Prueba clave:** distinguibles entre sí a 24 px en escala de grises, sin depender del color.

| ☐ | Archivo | Síntoma a dibujar | Prioridad |
|---|---|---|---|
| ☐ | `class-sana.svg` | Hoja limpia con nervadura central y dos o tres laterales | 1 |
| ☐ | `class-roya.svg` | Grupo de 5 a 7 puntos rellenos (pústulas) en una zona de la hoja | 1 |
| ☐ | `class-minador.svg` | Línea serpenteante que recorre la hoja (la galería del minador) | 1 |
| ☐ | `class-cercospora.svg` | Una mancha redonda con un halo alrededor (círculo + anillo) | 1 |
| ☐ | `class-phoma.svg` | Punta o borde de la hoja oscurecido (zona rellena en el extremo) | 1 |
| ☐ | `class-duda.svg` | Contorno de hoja discontinuo con un signo de interrogación dibujado como trazo | 1 |

## E. Ilustraciones → `ilustraciones/` (opcional)

Para guiar la foto y el muestreo. Necesitan pantallas que hoy no existen (cambios en `app/src/ui/`), así que son para una fase siguiente.

**Especificación técnica:** `viewBox="0 0 320 240"` (4:3), vista desde arriba, máximo cuatro colores de la paleta más blanco, trazo de tinta de 2 px, sin degradados ni sombras, menos de 15 KB cada una.

| ☐ | Archivo | Qué muestra | Prioridad |
|---|---|---|---|
| ☐ | `guia-foto-correcta.svg` | Plato blanco con una sola hoja por el envés, centrada, con luz pareja | 3 |
| ☐ | `guia-foto-borrosa.svg` | La misma escena movida (líneas dobles) | 3 |
| ☐ | `guia-foto-oscura.svg` | La misma escena con poca luz | 3 |
| ☐ | `guia-foto-dos-hojas.svg` | Dos hojas en el plato (lo que no hay que hacer) | 3 |
| ☐ | `muestreo-plantas.svg` | 10 plantas en la parcela y, en una, las 3 ramas (baja, media, alta) con la hoja que se toma | 3 |

---

## Antes de guardar un archivo aquí

- [ ] El nombre es exactamente el de la tabla.
- [ ] Abre en el navegador y se ve bien a los tamaños de prueba de su sección.
- [ ] El SVG pasó por SVGO y no tiene `<text>`, `<image>`, `id`, `<style>` ni `width`/`height`.
- [ ] Los iconos de C y D no llevan color propio y miden menos de 1 KB.
- [ ] Los PNG pesan menos de 20 KB y el maskable pasó la prueba de maskable.app.
- [ ] Su origen está anotado en Créditos.

Presupuesto total de esta carpeta: menos de 150 KB (la app entera debe pesar menos de 20 MB, y casi todo es el modelo).

## Créditos

| Archivo o grupo | Autor | Origen (propio, Lucide, generado con IA y redibujado…) | Licencia |
|---|---|---|---|
| | | | |
