// Elección de mensajes fijos (M01–M08). Nunca se genera texto libre:
// solo se rellenan {n} y {total} en plantillas de messages.json.

import { Counts, SICK_LABELS, SickLabel, tooManyUnsure } from "./sample";

export type MessageId = "M01" | "M02" | "M03" | "M04" | "M05" | "M06" | "M07" | "M08";
/** Idiomas de la app. */
export type Lang = "es" | "quz" | "en";
/** Idiomas con clips de voz grabados: el inglés solo se lee. */
export type AudioLang = "es" | "quz";

export interface MessageRef {
  id: MessageId;
  n?: number;
  total?: number;
}

export type MessageEntry = Record<Lang, string>;

export interface MessageCatalog {
  /** Rótulo del quechua (traducción automática, sin validar), en cada idioma de la app. */
  quzLabel: Record<Lang, string>;
  messages: Record<MessageId, MessageEntry>;
}

const SICK_MESSAGE: Record<SickLabel, MessageId> = {
  roya: "M02",
  minador: "M03",
  cercospora: "M04",
  phoma: "M05",
};

/** Mensajes de la pantalla de resultado, en orden: enfermas (más frecuente primero), dudas, cierre. */
export function chooseMessages(counts: Counts): MessageRef[] {
  if (counts.total === 0) return [];
  const refs: MessageRef[] = [];
  const sick = SICK_LABELS.filter((label) => counts[label] > 0).sort(
    (a, b) => counts[b] - counts[a],
  );
  if (sick.length === 0) {
    refs.push({ id: "M01", total: counts.total });
  } else {
    for (const label of sick) {
      refs.push({ id: SICK_MESSAGE[label], n: counts[label], total: counts.total });
    }
  }
  if (tooManyUnsure(counts)) refs.push({ id: "M06" });
  refs.push({ id: "M08" });
  return refs;
}

export function photoRejected(): MessageRef {
  return { id: "M07" };
}

export function renderMessage(ref: MessageRef, catalog: MessageCatalog, lang: Lang): string {
  return catalog.messages[ref.id][lang]
    .replace("{n}", String(ref.n ?? ""))
    .replace("{total}", String(ref.total ?? ""));
}

/** Clips de audio a reproducir en fila: el mensaje y, si lleva conteo, el número. */
export function audioClips(ref: MessageRef): string[] {
  return ref.n === undefined ? [ref.id] : [ref.id, `n${ref.n}`];
}
