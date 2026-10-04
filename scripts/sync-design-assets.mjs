// Trae a la app las piezas gráficas del set del equipo (UI-UX-Modules/assets):
//   - app/src/ui/icons.generated.ts: los iconos de interfaz y de clase, y la marca en un color
//   - app/public/: la marca a color, las guías ilustradas y los iconos de la app instalada
// Uso, después de un cambio en UI-UX-Modules/assets:  npm run assets:sync
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const ASSETS = "UI-UX-Modules/assets";
/** El contenido del SVG sin su etiqueta <svg>: la app crea la suya, con la clase que le pone el estilo. */
const inner = (path) => readFileSync(path, "utf8").trim().replace(/^<svg[^>]*>|<\/svg>$/g, "");

const icons = {};
for (const dir of ["iconos/ui", "iconos/clases"]) {
  for (const file of readdirSync(`${ASSETS}/${dir}`).filter((name) => name.endsWith(".svg")).sort()) {
    icons[file.slice(0, -4)] = inner(`${ASSETS}/${dir}/${file}`);
  }
}

writeFileSync(
  "app/src/ui/icons.generated.ts",
  [
    "// Generado por scripts/sync-design-assets.mjs desde UI-UX-Modules/assets: no editar a mano.",
    "",
    "/** Contenido de cada icono (viewBox 0 0 24 24). Trazo, grosor y color los pone la clase .icon. */",
    "export const PATHS = {",
    ...Object.entries(icons).map(([name, svg]) => `  ${JSON.stringify(name)}: ${JSON.stringify(svg)},`),
    "} as const;",
    "",
    "/** Marca en un color (logo-marca-mono.svg, viewBox 0 0 64 64): toma el color del texto. */",
    `export const BRAND_MONO = ${JSON.stringify(inner(`${ASSETS}/marca/logo-marca-mono.svg`))};`,
    "",
  ].join("\n"),
);

// Lo que la app carga como archivo. Las demás guías de foto quedan para una pantalla de ayuda futura.
const PUBLIC = [
  "marca/logo-marca.svg",
  "ilustraciones/muestreo-plantas.svg",
  "ilustraciones/guia-foto-correcta.svg",
  "app/favicon.svg",
  "app/favicon.ico",
  "app/apple-touch-icon.png",
  "app/icon-192.png",
  "app/icon-512.png",
  "app/icon-maskable-192.png",
  "app/icon-maskable-512.png",
  "app/icon-monochrome-512.png",
];
for (const file of PUBLIC) copyFileSync(`${ASSETS}/${file}`, `app/public/${file.split("/").pop()}`);

console.log(`${Object.keys(icons).length} iconos -> app/src/ui/icons.generated.ts; ${PUBLIC.length} archivos -> app/public/`);
