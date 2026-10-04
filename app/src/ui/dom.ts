import { playClips } from "../adapters/audio";
import { LANG_INFO, TextKey } from "../domain/i18n";
import { audioClips, AudioLang, MessageRef, renderMessage } from "../domain/message";
import { LeafLabel } from "../domain/sample";
import { App } from "./app";
import { icon, IconName } from "./icons";

type Child = Node | string | null | false | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { class: className, ...rest } = props;
  if (className) node.className = className;
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
 * Mensaje fijo en el idioma de la interfaz. El quechua va siempre con el español al lado.
 * Las dos voces grabadas (español y quechua) se ofrecen en cualquier idioma, con el rótulo del quechua.
 */
export function messageCard(ref: MessageRef, app: App): HTMLElement {
  const { catalog, lang } = app;
  const voices: AudioLang[] = lang === "quz" ? ["quz", "es"] : ["es", "quz"];
  return el(
    "div",
    { class: "message" },
    el("p", { class: "main", lang: LANG_INFO[lang].html }, renderMessage(ref, catalog, lang)),
    lang === "quz" && el("p", { class: "aside", lang: "es" }, renderMessage(ref, catalog, "es")),
    el("p", { class: "quz-label" }, catalog.quzLabel[lang]),
    el("div", { class: "row" }, ...voices.map((voice) => listenButton(voice, ref, app))),
  );
}
