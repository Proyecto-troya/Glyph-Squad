import { audioClips, Lang, MessageCatalog, MessageRef, renderMessage } from "../domain/message";
import { playClips } from "../adapters/audio";

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

export const LABEL_NAMES: Record<string, string> = {
  sana: "Sana",
  roya: "Roya",
  minador: "Minador",
  cercospora: "Cercospora",
  phoma: "Phoma",
  duda: "No estoy seguro",
};

function listenButton(lang: Lang, ref: MessageRef): HTMLButtonElement {
  const button = el("button", { class: "listen", type: "button" }, lang === "es" ? "🔊 Español" : "🔊 Quechua");
  button.onclick = async () => {
    const ok = await playClips(lang, audioClips(ref));
    if (!ok) button.textContent = "Audio no disponible";
  };
  return button;
}

/** Mensaje fijo en español con el quechua al lado, rotulado, y un botón de audio por idioma. */
export function messageCard(ref: MessageRef, catalog: MessageCatalog): HTMLElement {
  return el(
    "div",
    { class: "message" },
    el("p", { class: "es" }, renderMessage(ref, catalog, "es")),
    el("p", { class: "quz", lang: "qu" }, renderMessage(ref, catalog, "quz")),
    el("p", { class: "quz-label" }, catalog.quzLabel),
    el("div", { class: "row" }, listenButton("es", ref), listenButton("quz", ref)),
  );
}
