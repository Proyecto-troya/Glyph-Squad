import { playClips } from "../adapters/audio";
import { LANG_INFO, TextKey } from "../domain/i18n";
import { audioClips, AudioLang, Lang, MessageRef, renderMessage } from "../domain/message";
import { countLeaves, LEAF_LABELS, LeafLabel, LeafResult, LEAVES_PER_PLANT, TARGET_LEAVES } from "../domain/sample";
import { App } from "./app";
import { icon, IconName } from "./icons";

type Child = Node | string | null | false | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: className, dataset, ...rest } = props;
  if (className) node.className = className;
  if (dataset) Object.assign(node.dataset, dataset);
  Object.assign(node, rest);
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    node.append(child);
  }
  return node;
}

/** Texto con el nombre de cada clase, para mostrarlo en el idioma de la interfaz. */
export const LABEL_KEYS: Record<LeafLabel | "duda", TextKey> = {
  sana: "labelSana",
  roya: "labelRoya",
  minador: "labelMinador",
  cercospora: "labelCercospora",
  phoma: "labelPhoma",
  duda: "labelDuda",
};

function listenButton(voice: AudioLang, ref: MessageRef, app: App): HTMLButtonElement {
  const button = el("button", { class: "listen", type: "button" }, icon("volume"), app.t(voice === "es" ? "listenEs" : "listenQuz"));
  button.onclick = async () => {
    const ok = await playClips(voice, audioClips(ref));
    if (!ok) button.textContent = app.t("audioMissing");
  };
  return button;
}

/** Pantalla sin muestra todavía: explica qué falta y lleva a la pestaña Muestra. */
export function emptyState(title: string, iconName: IconName, app: App): HTMLElement {
  const start = el("button", { class: "primary", type: "button" }, app.t("emptyGo"), icon("arrow"));
  start.onclick = () => app.go("muestra");
  return el(
    "div",
    { class: "empty" },
    el("div", { class: "hero" }, icon(iconName)),
    el("h1", {}, title),
    el("p", {}, app.t("emptyText")),
    start,
  );
}

/**
 * Mapa de la muestra: 10 plantas × 3 hojas (rama baja, media y alta), cada hoja con el color de su clase.
 * `markNext` señala el hueco de la hoja que toca fotografiar.
 */
export function sampleMap(leaves: LeafResult[], app: App, markNext = true): HTMLElement {
  const counts = countLeaves(leaves);
  const classes = ([...LEAF_LABELS, "duda"] as const)
    .filter((label) => counts[label] > 0)
    .map((label) => `${counts[label]} ${app.t(LABEL_KEYS[label]).toLowerCase()}`);
  const map = el("div", { class: app.fresh ? "sample-map fresh" : "sample-map" });
  map.setAttribute("role", "img");
  map.setAttribute(
    "aria-label",
    `${counts.total} ${app.t("counter", { total: TARGET_LEAVES })}${classes.length ? `: ${classes.join(", ")}` : ""}`,
  );
  for (let first = 0; first < TARGET_LEAVES; first += LEAVES_PER_PLANT) {
    const plant = el("div", { class: "plant" });
    for (let i = first; i < first + LEAVES_PER_PLANT; i++) {
      const leaf = leaves[i];
      let state = "";
      if (leaf) state = ` tone-${leaf.label}${i === leaves.length - 1 ? " latest" : ""}`;
      else if (markNext && i === leaves.length) state = " next";
      plant.append(el("span", { class: `leaf${state}` }));
    }
    map.append(plant);
  }
  return map;
}

/**
 * Mensaje fijo en el idioma de la interfaz, con el otro idioma de Noor al lado: quechua bajo el
 * español y español bajo el quechua (el quechua nunca va solo). En inglés va solo el inglés.
 * Las dos voces grabadas (español y quechua) se ofrecen en cualquier idioma, con el rótulo del quechua.
 */
export function messageCard(ref: MessageRef, app: App): HTMLElement {
  const { catalog, lang } = app;
  const aside: Lang | null = lang === "es" ? "quz" : lang === "quz" ? "es" : null;
  const voices: AudioLang[] = lang === "quz" ? ["quz", "es"] : ["es", "quz"];
  return el(
    "div",
    { class: "message" },
    el("p", { class: "main", lang: LANG_INFO[lang].html }, renderMessage(ref, catalog, lang)),
    aside && el("p", { class: "aside", lang: LANG_INFO[aside].html }, renderMessage(ref, catalog, aside)),
    el("p", { class: "quz-label" }, catalog.quzLabel[lang]),
    el("div", { class: "row" }, ...voices.map((voice) => listenButton(voice, ref, app))),
  );
}
