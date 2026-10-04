// Iconos y marca del set 1B3 del equipo (UI-UX-Modules/assets), dibujados en el propio código:
// no dependen de la red ni de los emojis del teléfono. Su contenido se regenera con `npm run assets:sync`.

import { LeafLabel } from "../domain/sample";
import { BRAND_MONO, PATHS } from "./icons.generated";

export type IconName = keyof typeof PATHS;

function svgElement(viewBox: string, className: string, content: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = content;
  return svg;
}

export function icon(name: IconName): SVGSVGElement {
  return svgElement("0 0 24 24", "icon", PATHS[name]);
}

/** Icono de la clase: la forma dice la clase y el color de .tone-* la refuerza. */
export function classIcon(label: LeafLabel | "duda"): SVGSVGElement {
  return svgElement("0 0 24 24", "icon class-icon", PATHS[`class-${label}`]);
}

/** Marca en un color para la barra superior. */
export function brandLogo(): SVGSVGElement {
  return svgElement("0 0 64 64", "brand-logo", BRAND_MONO);
}
