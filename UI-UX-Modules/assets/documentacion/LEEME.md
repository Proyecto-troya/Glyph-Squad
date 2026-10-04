# Leaf Plate · 1B3 / Sello de campo

Set reconstruido en vector a partir del lienzo aprobado «Leaf Plate Brand System Board.png» y del BRIEF-LLM.md. Es una interpretación de producción de la exploración raster: aro de plato, hoja vertical de café, grano en negativo y cuatro marcas cardinales de precisión. La marca simplificada elimina el aro interior y las marcas para favicon y app.

## Contenido completo

| Carpeta | Entregables del brief |
|---|---:|
| marca/ | 6 logos SVG |
| app/ | favicon SVG, 6 PNG e ICO con 16 y 32 px = 8 piezas |
| iconos/ui/ | 24 iconos SVG |
| iconos/clases/ | 6 iconos SVG |
| ilustraciones/ | 5 ilustraciones SVG |
| Total | 49 |

Se incluyen además los 6 SVG fuente de los PNG en app/. Los 55 archivos gráficos suman **70,339 bytes**; todos los PNG pesan menos de 20 KB. La documentación y los catálogos de revisión son adicionales y no deben incluirse en el paquete de activos de la PWA. No se incluye el modelo IA.

## Revisar el set

Abrir documentacion/catalogo.html directamente en un navegador: funciona sin conexión y permite cambiar el fondo. catalogo.png muestra las 49 piezas. comprobacion.png muestra la marca a 24, 48 y 128 px; horizontal a 96 px; e iconos a 16, 24 y 48 px en claro y oscuro. verificacion.json contiene la auditoría de archivos y pesos.

## Reglas de uso

- Paleta: bosque #133f27, verde #1f6b3a, menta #d4ecd9, suave #e0f0e4, blanco #ffffff, tinta #141a16.
- Área de respeto: 1/4 de la altura visual de la marca, fuera del lienzo del archivo. No confundir con el margen interno de 2 px.
- Marca mínima 24 px; por debajo usar favicon. Horizontal mínimo 96 px de ancho.
- Usar logos inversos sobre bosque. Logo-marca-mono: definir `color` en el SVG inline o su contenedor. Todos sus rellenos son currentColor y todos los huecos son transparentes.
- App maskable: fondo a sangre, opaco. El símbolo está íntegro dentro de un radio del 40 % del lado. any tiene esquinas transparentes; Apple es opaco. PNG incluyen chunk sRGB.
- Clases: misma hoja; roya = 6 pústulas, minador = galería, cercospora = halo, phoma = extremo relleno, duda = discontinuo e interrogación. Son señales abstractas, no ilustraciones diagnósticas.
- Muestreo: diez plantas; ampliación de una planta con tres alturas de rama. La ampliación lateral no agrega una undécima planta al muestreo.

## Integrar UI y clases

Los SVG de iconos deliberadamente no incluyen color, grosor ni relleno global, como exige el brief. **Requieren SVG inline** y la clase `.lp-icon` con el CSS de documentacion/iconos.css. Agregar la clase al elemento SVG desde el componente de la app. Un `<img src="iconos/ui/leaf.svg">` no hereda las reglas CSS de trazo hacia su contenido y no es la integración indicada.

Para una acción etiquetada, usar aria-hidden="true" en el icono. Para un botón de solo icono, colocar aria-label en el botón. Mantener siempre el nombre textual de la clase al lado de su símbolo; el color no debe ser la única señal.

El manifest de ejemplo presupone que app/ se sirve en la raíz del sitio; ajustar las rutas al proyecto. Para HTML: favicon SVG, favicon.ico y apple-touch-icon.png se vinculan mediante etiquetas link apropiadas.

## Autoría y fuentes

Geometría original del set, reconstruida desde la propuesta visual de Leaf Plate; no se han copiado trazos de Lucide. El wordmark utiliza **IBM Plex Sans Bold**, convertido a curvas de una decimal; no necesita fuentes instaladas ni contiene `<text>`. Fuente externa: https://github.com/IBM/plex, licencia SIL OFL 1.1, incluida en licencia-ibm-plex.txt. No se distribuye el archivo de fuente TTF. Las diferencias frente al raster (sin sombreado, pocas nervaduras, síntomas simplificados) son deliberadas para cumplir los requisitos de SVG y reducción.

## Alcance de la comprobación

Se verificaron presencia y nombres de las 49 piezas, formatos y dimensiones, lienzos, caracteres SVG prohibidos, precisión decimal, colores, pesos individuales y totales, opacidad maskable/Apple y silueta blanca monocroma. Se revisaron láminas de legibilidad a los tamaños prescritos. La interpretación de los síntomas y el funcionamiento en los teléfonos reales deben validarse con las personas usuarias; estas señales no afirman diagnóstico ni tratamiento.
