# Leaf Plate: dirección de diseño de la interfaz

Propuesta de estilo para las seis pantallas del [blueprint de UI](leaf-plate-ui-blueprint.html), con el contexto del [blueprint técnico](leaf-plate-blueprint.md). Evoluciona la identidad actual (verde de cooperativa, IBM Plex) hacia una estructura más decidida, sin tocar el TypeScript: todo vive en una hoja de estilos que respeta los nombres de clase.

| Archivo | Qué es |
|---|---|
| [`prototipo/style.css`](prototipo/style.css) | La propuesta (versión 3). Reemplaza a `app/src/style.css` de la rama `leaf-plate`; la sección "Componentes nuevos" necesita el markup de [COMPONENTES.md](COMPONENTES.md). |
| [`COMPONENTES.md`](COMPONENTES.md) | Especificación de los componentes nuevos (visor de análisis, mapa de la muestra, medidor de confianza…) para llevarlos a `app/src/ui/`. |
| [`prototipo/index.html`](prototipo/index.html) | Galería con los 17 estados de las 6 pantallas, a 375 px. Se abre con doble clic. La casilla "Ver la hoja original" muestra lo mismo con la hoja actual de la app, para comparar. |
| [`prototipo/pantalla.html`](prototipo/pantalla.html) | Una pantalla suelta; `?estado=b-duda` elige el estado, `&demo=1` muestra la franja de demostración y `&css=original` usa la hoja actual. |
| [`prototipo/estados.js`](prototipo/estados.js) | Reproduce el DOM de `app/src/ui/*.ts` con las mismas clases, los mensajes de `messages.json` y las reglas de conteo, SMS y lista. |
| [`prototipo/original.css`](prototipo/original.css) | Copia de `app/src/style.css` de la rama `leaf-plate` (commit `ea13825`), solo para comparar. |
| `prototipo/muestras/` | Dos ilustraciones que hacen de foto de hoja en el visor del prototipo. En la app va la foto real. |
| `prototipo/fuentes/` | Las mismas fuentes IBM Plex que la app empaqueta con `@fontsource` (SIL OFL 1.1). Solo para el prototipo. |

## Para quién y dónde

Noor o su hija, un sábado, en el patio de una casa en Santa Teresa (1.400 a 2.200 m), con el smartphone de la hija, el brillo bajo para ahorrar batería y el sol encima. Fotografía 30 hojas sobre un plato blanco, una por una, con las manos ocupadas. El técnico mira su lista otro día, quizás en una laptop.

Esa escena decide casi todo:

- **Contenido en tema claro.** Al sol, un fondo oscuro detrás del texto largo se lee peor. El verde oscuro queda para el marco (franja superior y barra de pestañas), con texto blanco grande, a 11,9:1.
- **Contraste de sol, no de oficina.** Texto principal 15 a 17:1, texto secundario 7 a 8:1, bordes de controles 3,6 a 4:1. Las cifras de la tabla de colores están medidas.
- **Toques grandes.** Botón principal 68 px, botones 56 px, Sí / No 62 px, audio 48 px, pestañas 72 px.
- **Nada que se mueva solo.** El script reconstruye el DOM en cada toque, así que solo hay transiciones al pulsar y un pulso en "Mirando la hoja…", que es un estado real.

## La idea

**Versión 3: instrumento + visor.** Pantallas claras y de precisión para el campo, y un solo momento oscuro tipo visor cuando la IA analiza cada foto: la foto encuadrada, una línea de escaneo, los pasos reales del análisis (nitidez, luz, hoja en el plato, clasificación) y el resultado con su confianza frente al umbral calibrado y las otras clases que consideró. La barra de progreso pasa a ser un mapa de la muestra con cada hoja en el color de su clase. Todo lo que se muestra es un dato real de la app. Detalle y markup en [COMPONENTES.md](COMPONENTES.md).

Lo que viene de las versiones anteriores y se mantiene:

1. **Una franja verde que es la pantalla.** La barra superior y el título ("Parcela P114", "Mensaje para el técnico", "Lista del técnico") forman una sola franja verde oscura con el título grande en blanco; la primera tarjeta se monta sobre ella. La barra de pestañas cierra abajo con el mismo verde y marca la pestaña activa con una píldora clara detrás del icono. Así cada pantalla dice dónde estás antes de leer nada.
2. **La barra de progreso es la muestra.** Treinta óvalos agrupados de tres en tres: 10 plantas × 3 ramas, como pide el muestreo. Cada hoja aceptada enciende un óvalo; Noor ve en qué planta va sin contar. Se hace solo con una máscara CSS sobre `.progress`; el ancho que pone el script cae siempre en un hueco, así que nunca se enciende media hoja.
3. **Dos globos de SMS.** El mensaje fijo es lo que la app "dice": globo verde suave con la esquina de abajo a la izquierda en punta, como un mensaje recibido. El código que ella envía es un globo verde lleno, alineado a la derecha, con la esquina de abajo a la derecha en punta, como un mensaje enviado. Es el SMS que va a salir, tal cual.
4. **El color de la clase nombra la hoja.** En la última foto, la cabecera se llena con el color de la clase (óxido para roya, ámbar para duda) y el nombre va en blanco. En el resultado, cada fila lleva una hoja pequeña de ese color. El color nunca va solo: siempre lo acompañan el nombre y el número.
5. **El plato blanco.** El icono redondo (`.hero`) y la marca se dibujan como un plato visto desde arriba, con su borde. En el estado vacío el plato aparece con borde discontinuo y sin hoja.
6. **Línea discontinua = la tiene que mirar una persona.** "No estoy seguro", la foto para repetir, los avisos del técnico y el rótulo del quechua sin validar usan borde discontinuo.

## Colores

Todos están en `:root`. Se mantienen los nombres del blueprint (`--green`, `--green-dark`, `--green-soft`, `--ink`, `--muted`, `--paper`, `--surface`, `--line`, `--warn`…) para que nada se rompa.

| Token | Valor | Uso | Contraste medido |
|---|---|---|---|
| `--forest` | `#133f27` | Franja superior, barra de pestañas, cabecera de la tabla | blanco encima: 11,9:1 |
| `--on-forest-muted` | `#b9d4c2` | Texto secundario sobre la franja | 7,5:1 |
| `--green` | `#1f6b3a` | Botón principal, código SMS, barra de progreso | blanco encima: 6,5:1 |
| `--mint` | `#d4ecd9` | Pestaña activa, respuesta elegida, selección de texto | verde oscuro encima: 9,5:1 |
| `--green-soft` | `#e0f0e4` | Globo del mensaje fijo | texto: 14,9:1 |
| `--ink` | `#141a16` | Texto | 17,7:1 con blanco |
| `--muted` | `#48534b` | Texto secundario | 7,3:1 sobre `--paper` |
| `--paper` | `#f2f5f0` | Fondo del contenido (gris verdoso frío, no crema) | |
| `--line-strong` | `#76837a` | Bordes de botones y campos | 3,6:1 sobre `--paper` |
| `--warn` / `--warn-ink` | `#fff2cc` / `#5e4300` | Duda y avisos | 8,3:1 |
| `--danger` | `#a3201c` | Solo errores de formulario | 7,6:1 con blanco |

Clases de hoja, todas con blanco encima a 4:1 o más (cabecera llena) y a 3:1 o más sobre blanco (puntos y barras): sana `#2e8b57`, roya `#c25a14` (óxido, como su nombre), minador `#8a5a2b`, cercospora `#7a4fa3`, phoma `#2f6f9f`, duda `#a37800`.

## Tipo, forma y espacio

- **IBM Plex Sans** para todo, ya empaquetada en la app y con buen soporte de tildes y eñes. **IBM Plex Mono 600** solo donde el texto es un código: la parcela, el SMS, los códigos pegados y la columna de parcelas del técnico.
- Base de 18 px. Títulos de pantalla 2,1 rem en 700 (2,4 rem en "Nueva muestra"); el contador 4 rem; textos de apoyo 0,88 rem (15,8 px), nunca menos de 14 px.
- Forma: todo lo que se toca es una píldora; tarjetas con 20 px de radio; campos y cajas internas 12 px; los dos globos de SMS con una esquina en punta.
- Sombras suaves teñidas de verde, con desplazamiento y desenfoque; ninguna sombra dura.
- Margen lateral de 16 px, columna de 640 px como máximo, y espacio inferior para que la barra de pestañas nunca tape el último botón.

## Pantalla por pantalla

| Pantalla | Qué cambia frente a la hoja actual |
|---|---|
| Marco | Franja verde oscura arriba (barra + título) y barra de pestañas verde oscura abajo, con píldora en la activa. La franja de demostración, ámbar con borde discontinuo, queda entre la barra y el título. |
| A · Formulario | La introducción entera es franja verde con el plato grande; la tarjeta del código se monta encima. Campo en letra de código grande y en mayúsculas, error en rojo bajo el campo (con borde rojo donde el navegador soporta `:has`). Los tres pasos son círculos verde oscuro numerados unidos por una línea. |
| B · Fotos | Tarjeta del contador sobre la franja, número de 4 rem y barra de 10 plantas × 3 hojas. Botón de cámara en píldora de 68 px. Cabecera de la última foto llena con el color de la clase; la duda y la foto para repetir van en ámbar con borde discontinuo. |
| C · Resultado | Tarjeta de conteo sobre la franja, con hoja de color, barra y número tabular grande; total separado por una línea fuerte. Mensajes fijos como globos recibidos. Sí / No en píldoras de 62 px; el elegido lleva una marca además del color. |
| D · Enviar | El mensaje fijo se monta sobre la franja. El código SMS es un globo enviado, en letra de código grande, seleccionable con un toque. La frase de la laptop y su panel ya tienen estilo, aunque la bandera está apagada. |
| E · Técnico | La explicación queda dentro de la franja y el campo se monta encima; el campo crece con el texto pegado. La tabla tiene cabecera verde oscura, se desliza hacia el lado con la columna de parcela fija y una sombra que avisa que hay más columnas. El porcentaje va en una pastilla neutra (no verde, porque no es una buena noticia) y los avisos en ámbar. |
| F · Vacío | Plato vacío con borde discontinuo, texto breve y un botón que lleva a Muestra. |

## Cómo se llegó aquí

- **Versión 1** mejoró contraste, bordes y la barra de hojas, pero conservó la estructura de la hoja actual (barra verde fina, tarjetas blancas sobre gris, botones rectangulares). Al compararla, se veía como la misma app.
- **Versión 2** cambia la estructura sin tocar el markup: la franja verde con el título, las tarjetas montadas sobre ella, la barra de pestañas oscura, las píldoras, los globos de SMS y las cabeceras llenas con el color de la clase. La comparación lado a lado está en la galería.
- **Versión 3** (dirección C + A) suma lo que la hacía ver plana: un visor de análisis oscuro con los pasos y medidas reales, un medidor de confianza con la zona donde la app diría "No estoy seguro", las clases alternativas, un mapa de la muestra por clase, el indicador "IA en el teléfono", las piezas del SMS explicadas y la gravedad en la lista del técnico. Necesita cambios de markup, especificados en [COMPONENTES.md](COMPONENTES.md). En la revisión, una clase `.done` en el visor chocaba con la de "Muestra completa"; los estados nuevos pasaron a `data-state`.
- **Revisión contra el brief antes de escribir.** Se descartaron rasgos de plantilla: etiquetas en mayúsculas con letra mono en la tabla, números "01, 02" en los pasos y una sombra dura bajo el botón principal. La pastilla del porcentaje pasó de verde a neutra.
- **Capturas a 375 y 360 px** de los 17 estados, con y sin franja de demostración, y de la hoja original en los mismos estados, en Chrome sin ventana. Fallos encontrados y corregidos: la barra de 30 segmentos rectos parecía un código de barras (ahora son óvalos), Chrome descartaba la máscara cuando mezclaba `%` y `px` en un `radial-gradient` (ahora va solo en `%`) y el título quedaba pegado a la franja de demostración.
- **Contraste** calculado con la fórmula WCAG para cada pareja de la tabla de colores.

## Cómo aplicarlo en la app

1. En la rama `leaf-plate` (o la que tenga `app/src/ui/icons.ts`), copiar `prototipo/style.css` sobre `app/src/style.css`. Con eso solo ya se ve la versión 2 (franja, píldoras, globos), sin tocar ningún `.ts`.
2. Para el visor y los demás componentes nuevos, seguir [COMPONENTES.md](COMPONENTES.md): cambia `main.ts`, `Muestra.ts`, `Resultado.ts`, `Enviar.ts`, `Tecnico.ts`, `app.ts`, `classifier.ts` y `sample.ts`.
3. Cambiar `<meta name="theme-color">` de `app/index.html` a `#133f27` para que la barra del navegador continúe la franja (opcional, es lo único fuera de la hoja de estilos).
4. `npm run dev` y abrir la URL a ancho de teléfono. Revisar con y sin modelo cargado, para ver la franja de demostración.

Esta carpeta no modifica nada fuera de `UI-UX-Modules/`; esos pasos los hace quien trabaje en `app/`.

## Lo que queda abierto

- **No se probó en un Android real ni al sol.** Es la prueba que más importa: brillo bajo, pantalla barata y luz de mediodía.
- **La franja depende del orden del markup.** Usa `main > h1:first-child` y la pieza que le sigue. Si alguien añade algo antes del `h1` en una pantalla, esa pantalla pierde la franja (se ve bien, solo más simple).
- **`:has`, `color-mix` y `field-sizing`** mejoran el borde rojo del error, la explicación del técnico dentro de la franja y el campo que crece. Los navegadores viejos ignoran esas reglas y queda una versión correcta, más simple.
- **La pantalla de resultado es larga.** Con dos enfermedades salen tres mensajes fijos, cada uno con su rótulo de quechua y sus dos botones de audio, y la pregunta de edad queda abajo. Acortarla pide cambiar el markup (por ejemplo, un solo rótulo de quechua por pantalla), y eso se decide en `app/src/ui/`.
- **Fuera del alcance de esta hoja:** un estado visual para "Copiado" y un estado "reproduciendo" en los botones de audio. Ninguno de los dos tiene clase propia en el markup de hoy.
- **Sobre las skills usadas.** Se siguieron las guías de frontend-design, ui-ux-pro-max, Impeccable (modo Operate, piso de calidad, "bolder") y design-taste-frontend. No se ejecutó el programa de Impeccable (descarga un binario y la skill no se revisó con SkillSpector). De design-taste-frontend se aplicó lo que sirve a una app de trabajo; su regla de modo oscuro cede ante el blueprint, que pide tema claro.
