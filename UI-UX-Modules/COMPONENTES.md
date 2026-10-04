# Leaf Plate: componentes nuevos (dirección "instrumento + visor")

Especificación para llevar a `app/src/ui/` los componentes que el [prototipo](prototipo/index.html) ya muestra funcionando. Los estilos están en [`prototipo/style.css`](prototipo/style.css), sección "Componentes nuevos", y el DOM de referencia en [`prototipo/estados.js`](prototipo/estados.js) (funciones con el mismo nombre que cada componente).

**La idea.** Pantallas claras y de precisión para el campo (dirección C) y un solo momento oscuro tipo visor cuando la IA analiza cada foto (dirección A). Todo lo que se muestra es un dato real de la app: no hay animación que finja trabajo.

| Componente | Pantalla | Archivo que cambia | Necesita datos nuevos |
|---|---|---|---|
| [Indicador de IA local](#1-indicador-de-ia-local) | Barra superior | `main.ts` | No |
| [Mapa de la muestra](#2-mapa-de-la-muestra) | Muestra, Resultado | `Muestra.ts`, `Resultado.ts` | No (usa `sample.leaves`) |
| [Visor de análisis](#3-visor-de-análisis) | Muestra | `Muestra.ts`, `app.ts` | Sí: foto, informe de calidad |
| [Medidor de confianza](#4-medidor-de-confianza) | Muestra (dentro del visor) | `Muestra.ts`, `classifier.ts` | Sí: umbral |
| [Otras clases](#5-otras-clases) | Muestra (dentro del visor) | `classifier.ts`, `sample.ts` | Sí: probabilidades |
| [Piezas del SMS](#6-piezas-del-sms) | Enviar | `Enviar.ts` | No |
| [Gravedad por parcela](#7-gravedad-por-parcela) | Técnico | `Tecnico.ts` | No |
| [Resumen del resultado](#8-resumen-del-resultado) | Resultado | `Resultado.ts` | No |

**Regla para estados.** Los componentes nuevos marcan su estado con `data-state`, nunca con clases como `.done`, `.active` o `.warn`, que ya existen en la hoja con otro significado. En el prototipo, una clase `.done` en el visor lo rompía.

---

## 1. Indicador de IA local

Una píldora en la barra superior que dice que el modelo corre en el teléfono. Solo aparece con el modelo real; con el clasificador de mentira ya está la franja de demostración.

```html
<header class="appbar">
  <span class="brand">…</span>
  <span class="ai-status"><span class="ai-dot"></span>IA en el teléfono</span>
</header>
```

- **`main.ts`:** añadir el `span.ai-status` al `header` cuando `classifier.kind === "onnx"`.

## 2. Mapa de la muestra

Reemplaza a la barra `.progress` en Muestra y se repite arriba del conteo en Resultado. Diez plantas con tres hojas cada una (rama baja, media y alta); cada hoja tomada lleva el color de su clase y el hueco siguiente late.

```html
<div class="sample-map" role="img" aria-label="13 de 30 hojas: 9 sana, 4 roya">
  <div class="plant">
    <span class="leaf tone-sana"></span>
    <span class="leaf tone-roya"></span>
    <span class="leaf tone-sana"></span>
  </div>
  <!-- … 10 .plant en total; hojas sin tomar: .leaf sola; la siguiente: .leaf.next;
       la última tomada: .leaf.latest -->
</div>
```

- **Datos:** `sample.leaves` en orden. Hoja `i` = planta `Math.floor(i / 3)`, rama `i % 3`.
- **`Muestra.ts`:** cambiar el `div.progress` por este bloque. Añadir `fresh` a la clase solo en el repintado que sigue a una foto (ver [Animaciones](#animaciones)).
- **`Resultado.ts`:** el mismo bloque como primer hijo de `section.card.counts`, sin `.next`.
- **Accesibilidad:** el `aria-label` resume los conteos; las hojas son decorativas.

## 3. Visor de análisis

Reemplaza a `p.status` ("Mirando la hoja…") y a la tarjeta de la última foto. Es una tarjeta oscura con la foto encuadrada, los pasos del análisis y, al terminar, el resultado.

```html
<section class="scan" data-state="working | done | retry" aria-live="polite">
  <div class="scan-top">
    <div class="scan-frame tone-roya">            <!-- tone-* solo en done -->
      <img class="scan-photo" src="blob:…" alt="Foto de la hoja">
      <span class="scan-line"></span>             <!-- solo en working -->
    </div>
    <ol class="scan-steps">
      <li class="step" data-state="done | active | pending | fail">
        <span class="step-name">Nitidez</span>
        <span class="step-value">nítida · 182</span>
      </li>
      <!-- Luz · Hoja en el plato · Clasificación -->
    </ol>
  </div>

  <!-- done -->
  <div class="result-head tone-roya"><span class="dot"></span><h2>Roya</h2></div>
  <div class="meter">…</div>                      <!-- ver 4 -->
  <p class="scan-say">La hoja se cuenta como duda…</p>   <!-- solo si es duda -->
  <p class="scan-label">Otras clases que consideró</p>
  <ul class="alternatives">…</ul>                 <!-- ver 5 -->

  <!-- retry -->
  <h2 class="scan-title">Repite la foto</h2>
  <div class="message">…M07…</div>

  <p class="scan-meta">MobileNetV3 · sin internet</p>
</section>
```

**Los cuatro pasos son las medidas reales** de `photoQuality.ts` y del modelo:

| Paso | Valor que muestra | Falla con `reason` |
|---|---|---|
| Nitidez | `nítida · 182` o `movida · 31` (`sharpness`) | `borrosa` |
| Luz | `buena · 146`, `oscura · 38` o `quemada · 251` (`brightness`) | `oscura`, `quemada` |
| Hoja en el plato | `34 % del plato` (`leafArea`) | `sin_hoja`, `sin_plato` |
| Clasificación | `1.2 s` | nunca |

Si un paso falla, ese paso queda en `fail` con su valor en ámbar, los siguientes quedan en `pending` y debajo aparece M07. Así "Repite la foto" dice exactamente qué salió mal.

**Cambios en el código:**
- **`Muestra.ts`, al elegir la foto:** crear `URL.createObjectURL(file)` para la `img` (y revocar la anterior), pintar el visor en `working` con el paso 0 activo, y avanzar el paso **en el mismo nodo** al terminar cada medida: tras `checkQuality` (pasos 1 a 3) y tras `classify` (paso 4). No repintar toda la pantalla hasta tener el resultado.
- **`app.ts`, `LastPhoto`:** guardar lo que el visor necesita al repintar.

```ts
export interface LastPhoto {
  leaf: LeafResult;
  reason?: RejectReason;
  seconds: number;
  photoUrl: string;                 // URL.createObjectURL(file)
  quality: QualityReport;           // ya lo devuelve checkQuality()
  alternatives: { label: LeafLabel; p: number }[];   // ver 5
}
```

- **Privacidad:** la foto solo vive en memoria como `blob:`; no se guarda ni sale del teléfono, igual que hoy.

## 4. Medidor de confianza

La confianza frente al umbral calibrado. La zona rayada a la izquierda de la marca es donde la app diría "No estoy seguro"; por debajo del umbral el relleno pasa a ámbar.

```html
<div class="meter [below]" style="--threshold: 0.6057" role="meter"
     aria-valuenow="87" aria-valuemin="0" aria-valuemax="100" aria-label="Confianza del modelo">
  <div class="meter-head"><span>Confianza</span><strong>87<span class="unit">%</span></strong></div>
  <div class="meter-track">
    <div class="meter-fill" style="width: 87%"></div>
    <span class="meter-threshold"></span>
  </div>
  <p class="meter-note">Umbral 61 %: por debajo, la app diría «No estoy seguro».</p>
</div>
```

- **Umbral:** el de `models/calibration.json` (`threshold: 0.6057`, con 90 % de precisión en lo aceptado). **`classifier.ts`:** exponer `threshold` en el objeto `Classifier` para no repetir el número en la interfaz.
- **Duda:** clase `below` y nota "Bajo el umbral de 61 %: la app no nombra la hoja."

## 5. Otras clases

Las clases que el modelo consideró, con su probabilidad calibrada. En una hoja nombrada se muestran la segunda y la tercera; en una duda, las tres primeras ("Lo que el modelo alcanzó a ver").

```html
<ul class="alternatives" aria-label="Clases más probables">
  <li class="alt tone-cercospora">
    <span class="alt-name">Cercospora</span>
    <span class="alt-bar"><span class="alt-fill" style="width: 8%"></span></span>
    <span class="alt-pct">8 %</span>
  </li>
</ul>
```

- **`sample.ts`, `decideLabel`:** devolver además las tres clases más probables, a partir de las `probs` que ya calcula `softmax`.
- **`classifier.ts`:** pasar esa lista en la `Prediction`. El clasificador de mentira puede devolver una lista inventada; ya lo rotula la franja de demostración.

## 6. Piezas del SMS

Debajo del código, lo que significa cada pieza. Ella sabe qué envía y el técnico (o el jurado) lo lee sin manual.

```html
<dl class="code-parts">
  <div class="code-part"><dt>LP</dt><dd>Leaf Plate</dd></div>
  <div class="code-part"><dt>P114</dt><dd>parcela</dd></div>
  <div class="code-part"><dt>28H</dt><dd>hojas</dd></div>
  <div class="code-part"><dt>ROYA7</dt><dd>7 con roya</dd></div>
  <div class="code-part"><dt>DUDA2</dt><dd>2 sin certeza</dd></div>
  <div class="code-part"><dt>E15+</dt><dd>plantas de más de 15 años</dd></div>
</dl>
```

- **`Enviar.ts`:** construirlo con `code.split(" ")` justo después de `p.code`. Los significados salen de la misma tabla `TOKENS` de `sms.ts`.

## 7. Gravedad por parcela

Una barra corta junto al porcentaje de cada parcela en la lista del técnico.

```html
<td><span class="pill">64 %</span><span class="sev"><span class="sev-fill" style="width: 64%"></span></span></td>
```

- **`Tecnico.ts`:** añadir el `span.sev` en la celda del porcentaje, con `row.sickPct` como ancho.

## 8. Resumen del resultado

Una línea bajo el mapa en Resultado: cuántas hojas tienen señales y qué porcentaje.

```html
<p class="summary"><strong>8 de 28</strong> hojas con señales · 29 %</p>
```

- **`Resultado.ts`:** con `sickCount` y `sickPct` de `sample.ts`.

---

## Animaciones

El script reconstruye toda la pantalla en cada cambio, así que cualquier animación de entrada se repetiría al tocar cualquier botón. Por eso:

- **Mientras analiza** (estado real): la línea de escaneo y el paso activo laten. Paran solos al terminar.
- **Después de una foto, una sola vez:** la cabecera del resultado sube, el medidor y las barras crecen desde cero y la hoja nueva del mapa salta. Se activan con la clase `fresh` en `.scan` y `.sample-map`, que el código pone **solo en el repintado que sigue a una foto** (una bandera `app.fresh` que se apaga después de pintar). Al navegar o deshacer no se repiten.
- Todo se apaga con `prefers-reduced-motion`.

## Lo que no cambia

- Todas las clases del blueprint siguen igual; la hoja de estilos sirve también para el markup actual, sin estos componentes.
- Los mensajes fijos, el código SMS y las reglas de conteo no cambian.
- El visor no muestra nada que la app no mida.
