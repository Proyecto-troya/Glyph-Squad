# Brief: logos e iconos de Leaf Plate

> Documento autocontenido para pasar a un asistente de IA (u otra persona) que ayude a proponer y generar los logos, iconos e ilustraciones de Leaf Plate. Todo lo necesario está aquí; no hace falta ver el código.

---

## 1. Tu tarea

Actúa como director de identidad visual y diseñador de iconos. Necesito:

1. **Propuestas de concepto para la marca** (sección 6.A): tres direcciones distintas, cada una con nombre, idea en una frase, por qué encaja con la usuaria y el producto, un boceto descrito con precisión y el riesgo honesto de esa dirección.
2. **Después de que elija una**, el SVG de cada pieza, siguiendo las reglas técnicas de la sección 5 al pie de la letra.
3. **Iconos e ilustraciones** (secciones 6.C a 6.E) en tandas, empezando por la prioridad 1, manteniendo un solo estilo en todo el set.

En cada respuesta con SVG, entrega el código completo de cada archivo en su propio bloque, con el nombre de archivo exacto como título, y una línea con lo que verifiqué (tamaño de prueba, colores usados, elementos permitidos). Si una especificación no se puede cumplir, dilo y propón la alternativa más cercana; no la ignores en silencio.

Si generas imágenes raster para explorar, trátalas como bocetos: la entrega final siempre es vector.

---

## 2. El producto

**Leaf Plate** es una app web instalable (PWA) que funciona **sin conexión** en un smartphone Android de gama baja. Apoya una sola decisión: que una caficultora nombre el problema de sus hojas de café y avise al técnico de su cooperativa el mismo fin de semana, sin datos móviles.

**Cómo funciona.** Ella recoge 30 hojas (10 plantas × 3 ramas: baja, media y alta) y fotografía cada una sobre un **plato blanco**. Un clasificador de visión que corre **dentro del teléfono** nombra cada hoja: sana, roya, minador, cercospora o phoma, o dice **"No estoy seguro"** cuando su confianza es baja. La app cuenta, pregunta si las plantas tienen más de 15 años, reproduce un mensaje fijo en quechua y en español, y abre un SMS prellenado (por ejemplo `LP P114 30H ROYA7 CER1 DUDA2 E15+`). Ella pulsa enviar. El técnico recibe una lista de parcelas ordenada y decide qué hacer.

**La única IA es la visión.** Contar, los mensajes, el audio, el SMS y la lista del técnico son reglas fijas. La app no da dosis, tratamientos, rendimiento ni precio. Su rasgo más importante es la honestidad: sabe decir "no estoy seguro, pregunte a una persona".

**Contexto.** Reto de agricultura del hackathon *Small AI for Development* (Banco Mundial y Hack-Nation). Lugar: Santa Teresa, La Convención, Cusco (Perú), fincas entre 1.400 y 2.200 m. Lengua local: quechua cusqueño (Cusco-Collao).

## 3. La usuaria y la escena

**Noor**, 38 años, 2 hectáreas (café arriba, maíz y frijol abajo), socia de una cooperativa cafetalera desde hace once años. En casa habla quechua y usa el español cuando hace falta. Usa el smartphone de su hija de 16 años, que solo está en casa los fines de semana; sin Wi-Fi.

**Escena de uso:** un sábado de día, en el patio de la casa, con el sol encima, el brillo de la pantalla bajo para ahorrar batería y las manos ocupadas con hojas y un plato. Todo lo gráfico debe leerse a la primera en esas condiciones.

**Segundo público:** el jurado del hackathon y la cooperativa, que verán la app en una demo en vivo y en un video.

## 4. Dirección visual

- **Identidad que evoluciona, no que se reemplaza.** La app ya tiene un verde de cooperativa, la tipografía IBM Plex y una marca de plato blanco con una hoja encima. La nueva identidad debe reconocerse como la misma.
- **Más tecnológica y de precisión.** Debe sentirse como una herramienta que de verdad usa IA en el teléfono: un instrumento de campo preciso, no un juguete ni una app de bienestar. Lo tecnológico se expresa con geometría limpia, precisión, ideas de visor o encuadre, y la estructura del muestreo (10 × 3), **no** con efectos.
- **Del mundo de Noor.** Las ideas visuales vienen del protocolo y del café: el plato blanco visto desde arriba, la hoja de café (elíptica, con punta marcada y nervadura central), el cafeto, la cosecha, el muestreo por plantas y ramas, el visor de una cámara. La roya es literalmente "óxido".
- **Honesta.** Nada que sugiera certeza absoluta o "magia". La duda es parte de la marca: en la interfaz, la línea discontinua significa "esto lo tiene que mirar una persona".

**Evitar (son clichés o chocan con el producto):**
- Degradados morados o azul neón, brillos, resplandores, destellos (✨), cerebros, circuitos genéricos, robots.
- Vidrio esmerilado, sombras duras, efectos 3D.
- Mayúsculas con mucho espaciado como recurso de marca, letra monoespaciada como disfraz "técnico".
- Iconografía andina o textil sin validarla antes con la cooperativa o las socias. Si propones motivos culturales, márcalos como "requiere validación".
- Cualquier parecido con marcas existentes (agroquímicas, apps de plantas, Google Lens).

### Paleta (usar solo estos colores)

| Nombre | Hex | Uso |
|---|---|---|
| Verde bosque | `#133f27` | Fondo de los iconos de app; marca sobre fondo claro |
| Verde | `#1f6b3a` | Hoja de la marca, acentos |
| Menta | `#d4ecd9` | Acento sobre fondo bosque |
| Verde suave | `#e0f0e4` | Fondos suaves de ilustración |
| Blanco | `#ffffff` | El plato; marca sobre fondo bosque |
| Tinta | `#141a16` | Trazos de ilustración |

Colores de clase, solo para ilustraciones: sana `#2e8b57`, roya `#c25a14`, minador `#8a5a2b`, cercospora `#7a4fa3`, phoma `#2f6f9f`, duda `#a37800`.

Contrastes ya verificados: blanco sobre `#133f27` da 11,9:1; `#133f27` sobre `#d4ecd9`, 9,5:1; blanco sobre `#1f6b3a`, 6,5:1.

### Tipografía

IBM Plex Sans (700 para el nombre de la marca). Se acepta otra si se justifica, pero el texto de los logos siempre va **convertido a trazos**.

### La marca actual (punto de partida)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1f6b3a"/>
  <circle cx="256" cy="256" r="180" fill="#fbfaf5"/>
  <path d="M150 330c0-110 80-190 220-190 0 130-70 220-190 220l-40 30z" fill="#1f6b3a"/>
</svg>
```

Plato blanco visto desde arriba sobre fondo verde, con una hoja encima. Se puede reinterpretar, pero debe seguir leyéndose como "hoja sobre plato".

### Estilo actual de los iconos de interfaz (para mantener la coherencia)

Iconos de línea en 24×24 con trazo de 2 px y puntas redondeadas (hoy son de la familia Lucide). Ejemplo, el icono `leaf` actual:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
</svg>
```

Los nuevos deben ser **propios** (no copiar Lucide), con ese mismo peso y lenguaje.

---

## 5. Reglas técnicas para todo SVG

- SVG 1.1 con `viewBox`, **sin** atributos `width` ni `height`.
- **Nada de `<text>`:** todo texto convertido a trazos (la app no puede depender de fuentes instaladas).
- Prohibido: `<image>`, base64, `<filter>`, `<style>` interno, `<foreignObject>`, scripts, atributos `id`, `class` y metadatos de editor.
- Coordenadas con un decimal como máximo.
- Nombres de archivo en minúsculas, con guiones, sin espacios ni tildes, exactamente como en las tablas.
- Todo original. Si algo parte de una fuente externa, dilo.
- La app funciona sin conexión y el paquete entero debe pesar menos de 20 MB (casi todo es el modelo de IA), así que el peso cuenta: todas las piezas juntas deben pesar menos de 150 KB.

Prioridad en las tablas: **1** = imprescindible para la demo, **2** = para los componentes nuevos de "visor de análisis", **3** = opcional.

---

## 6. Piezas que se necesitan (49)

### 6.A Marca (6) → carpeta `marca/`

| Archivo | Qué es | Lienzo | Colores | Prioridad |
|---|---|---|---|---|
| `logo-marca.svg` | Marca sola: plato + hoja | `viewBox="0 0 64 64"`, contenido dentro de 60×60 | Bosque, verde, blanco | 1 |
| `logo-marca-mono.svg` | La misma marca en un solo color | `0 0 64 64` | Solo `fill="currentColor"`; los huecos transparentes, no blancos | 1 |
| `logo-horizontal.svg` | Marca + "Leaf Plate" a la derecha | Alto 64, ancho libre (cerca de 4:1) | Para fondo claro | 1 |
| `logo-horizontal-inverso.svg` | Igual, para fondo `#133f27` | Alto 64 | Blanco y menta | 1 |
| `logo-vertical.svg` | Marca arriba, nombre debajo | Ancho libre (cerca de 1:1) | Para fondo claro | 3 |
| `logo-vertical-inverso.svg` | Igual, para fondo `#133f27` | | Blanco y menta | 3 |

- **Área de respeto:** un margen libre igual a un cuarto del alto de la marca.
- **Tamaños mínimos:** marca 24 px (por debajo se usa el favicon simplificado); logo horizontal 96 px de ancho.
- **Debe funcionar:** a 24, 48 y 128 px; sobre blanco y sobre `#133f27`; en escala de grises; y en un solo color (versión mono).
- **Uso:** la versión mono va en la barra superior de la app, dentro de un círculo blanco de 34 px, en verde. Las demás, en el video, el deck y la documentación.

### 6.B Iconos de la app instalada (8) → carpeta `app/`

| Archivo | Uso | Formato y tamaño | Especificación | Prioridad |
|---|---|---|---|---|
| `favicon.svg` | Pestaña del navegador | SVG, `viewBox="0 0 32 32"` | Marca simplificada para 16–32 px: menos detalle, trazos gruesos, fondo bosque | 1 |
| `icon-192.png` | Icono de la app (`any`) | PNG 192×192, sRGB | Puede tener transparencia; marca con su propia forma de fondo | 1 |
| `icon-512.png` | Icono de la app (`any`) | PNG 512×512 | Igual que el de 192 | 1 |
| `icon-maskable-192.png` | Icono adaptable de Android | PNG 192×192 | Como el maskable de 512 | 1 |
| `icon-maskable-512.png` | Icono adaptable de Android (`maskable`) | PNG 512×512 | Fondo `#133f27` a sangre, sin transparencia; la marca entera dentro del círculo central de 410 px (zona segura del 80 %), porque Android recorta en círculo, gota o cuadrado redondeado | 1 |
| `icon-monochrome-512.png` | Iconos con tema de Android 13+ (`monochrome`) | PNG 512×512 | Silueta blanca sobre transparente, dentro de la misma zona segura | 3 |
| `apple-touch-icon.png` | Pantalla de inicio de iPhone | PNG 180×180 | Opaco, fondo bosque | 3 |
| `favicon.ico` | Navegadores viejos | ICO con 16×16 y 32×32 | Generado desde `favicon.svg` | 3 |

Para los PNG, entrega primero el SVG fuente de cada uno (mismo nombre con `.svg`); se exportan a PNG después. Cada PNG optimizado debe pesar menos de 20 KB.

### 6.C Iconos de interfaz (24) → carpeta `iconos/ui/`

**Especificación (igual para todos):**
- `viewBox="0 0 24 24"`, área útil de 20×20 (2 px de margen en cada lado).
- Trazo de 2 px, puntas y uniones redondeadas, sin relleno. **Sin color ni grosor escritos en el archivo:** la app aplica por CSS `stroke: currentColor; stroke-width: 2; fill: none`. Entrega solo los elementos de dibujo.
- Solo `<path>`, `<circle>`, `<rect>`, `<line>`, `<polyline>`, `<ellipse>`. Si un detalle necesita relleno (un punto), ese elemento lleva `fill="currentColor"`.
- Rectángulos con radio de 2 px, para que el set sea parejo.
- Menos de 1 KB por archivo.
- Deben leerse a 16, 24 y 48 px, sobre blanco y sobre `#133f27`.

**Reemplazo de los 15 actuales** (mismo nombre, dibujo propio):

| Archivo | Dónde aparece | Idea | Prioridad |
|---|---|---|---|
| `leaf.svg` | Pestaña Muestra, formulario | Hoja de café: elíptica, punta marcada, nervadura central | 1 |
| `chart.svg` | Pestaña Resultado | Barras de conteo | 1 |
| `send.svg` | Pestaña Enviar | Avión de papel o flecha de envío | 1 |
| `list.svg` | Pestaña Técnico | Portapapeles con lista | 1 |
| `camera.svg` | Botón "Foto de una hoja" | Cámara | 1 |
| `volume.svg` | Botones de audio Español / Quechua | Parlante con ondas | 1 |
| `message.svg` | Botón "Abrir SMS para el técnico" | Globo de mensaje | 1 |
| `copy.svg` | Botón "Copiar mensaje" | Dos hojas de papel superpuestas | 1 |
| `undo.svg` | Botón "Quitar la última" | Flecha que vuelve | 1 |
| `check.svg` | "Muestra completa" | Visto | 1 |
| `alert.svg` | Aviso de modo demostración | Triángulo con signo de exclamación | 1 |
| `upload.svg` | Botón "Subir archivo" | Flecha hacia arriba sobre bandeja | 1 |
| `refresh.svg` | Botón "Pedir la frase otra vez" | Flechas en círculo | 1 |
| `plus.svg` | Botón "Empezar otra parcela" | Signo más | 1 |
| `arrow.svg` | Botones de avanzar | Flecha a la derecha | 1 |

**Nuevos, para el "visor de análisis":**

| Archivo | Para qué | Idea | Prioridad |
|---|---|---|---|
| `plate.svg` | Estado vacío y guía de foto | Plato visto desde arriba (dos círculos concéntricos) | 2 |
| `scan.svg` | Momento en que la IA analiza la hoja | Hoja dentro de cuatro esquinas de visor | 2 |
| `local-ai.svg` | Indicador "IA en el teléfono" | Chip (cuadrado con patitas) con una hoja dentro | 2 |
| `offline.svg` | Indicador "sin datos" | Antena o nube tachada | 2 |
| `focus.svg` | Paso "Nitidez" del análisis | Esquinas de enfoque con un punto central | 2 |
| `sun.svg` | Paso "Luz" del análisis | Sol con rayos cortos | 2 |
| `plant-age.svg` | Pregunta "¿más de 15 años?" | Cafeto con tronco grueso, o tronco con anillos | 2 |
| `technician.svg` | Mensajes que nombran al técnico | Persona con portapapeles | 3 |
| `cooperative.svg` | Lista del técnico, créditos | Grupo de casas o tres personas | 3 |

### 6.D Iconos de clase de hoja (6) → carpeta `iconos/clases/`

Uno por cada resultado del modelo. **Misma especificación que 6.C** (24×24, trazo de 2 px, un solo color, sin color escrito): la app los pinta con el color de cada clase.

- **Base común:** los seis comparten la misma silueta de hoja de café; solo cambia el síntoma dibujado dentro.
- **Abstractos:** son señales, no ilustración médica, y no deben prometer más precisión que el modelo.
- **Prueba clave:** distinguibles entre sí a 24 px en escala de grises, sin depender del color.

| Archivo | Síntoma | Prioridad |
|---|---|---|
| `class-sana.svg` | Hoja limpia con nervadura central y dos o tres laterales | 1 |
| `class-roya.svg` | Grupo de 5 a 7 puntos rellenos (pústulas) en una zona de la hoja | 1 |
| `class-minador.svg` | Línea serpenteante que recorre la hoja (galería del minador) | 1 |
| `class-cercospora.svg` | Una mancha redonda con un halo alrededor (círculo + anillo) | 1 |
| `class-phoma.svg` | Punta o borde de la hoja oscurecido (zona rellena en el extremo) | 1 |
| `class-duda.svg` | Contorno de hoja discontinuo con un signo de interrogación dibujado como trazo | 1 |

### 6.E Ilustraciones (5, opcionales) → carpeta `ilustraciones/`

**Especificación:** `viewBox="0 0 320 240"` (4:3), vista desde arriba, máximo cuatro colores de la paleta más blanco, trazo de tinta de 2 px, sin degradados ni sombras, menos de 15 KB cada una.

| Archivo | Qué muestra | Prioridad |
|---|---|---|
| `guia-foto-correcta.svg` | Plato blanco con una sola hoja por el envés, centrada, con luz pareja | 3 |
| `guia-foto-borrosa.svg` | La misma escena movida (líneas dobles) | 3 |
| `guia-foto-oscura.svg` | La misma escena con poca luz | 3 |
| `guia-foto-dos-hojas.svg` | Dos hojas en el plato (lo que no hay que hacer) | 3 |
| `muestreo-plantas.svg` | 10 plantas en la parcela y, en una, las 3 ramas (baja, media, alta) con la hoja que se toma | 3 |

---

## 7. Cómo se verifica cada entrega

- [ ] El nombre del archivo es exactamente el de la tabla.
- [ ] Usa solo colores de la paleta (o ninguno, en los iconos de 6.C y 6.D).
- [ ] No contiene `<text>`, `<image>`, `id`, `class`, `<style>`, `width` ni `height`.
- [ ] Se ve bien a los tamaños de prueba de su sección, sobre blanco y sobre `#133f27`.
- [ ] Los iconos de 6.C y 6.D miden menos de 1 KB y comparten trazo y lenguaje.
- [ ] La marca se reconoce como "hoja sobre plato" y en un solo color.
- [ ] Nada recuerda a los clichés de la sección 4.

## 8. Orden de trabajo sugerido

1. Tres conceptos de marca (6.A), sin SVG todavía. Espera mi elección.
2. `logo-marca.svg` y `logo-marca-mono.svg` del concepto elegido, más `favicon.svg`.
3. Los logos horizontales y el SVG fuente del icono maskable.
4. Los seis iconos de clase (6.D), que fijan el lenguaje de los iconos.
5. Los 15 iconos de reemplazo (6.C) y luego los nuevos.
6. Ilustraciones (6.E) si queda tiempo.
