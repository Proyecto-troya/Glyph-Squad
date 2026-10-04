// Código SMS de una línea (< 160 caracteres), sin datos personales:
//   LP <parcela> <total>H [ROYA<n>] [MIN<n>] [CER<n>] [PHO<n>] [DUDA<n>] [E15+]
// Las clases en 0 se omiten; E15+ solo si respondió que sí.

import { Counts, emptyCounts, normalizePlot, tooManyUnsure } from "./sample";

export interface SmsPayload {
  plot: string;
  counts: Counts;
  over15: boolean;
}

const TOKENS = [
  ["ROYA", "roya"],
  ["MIN", "minador"],
  ["CER", "cercospora"],
  ["PHO", "phoma"],
  ["DUDA", "duda"],
] as const;

export const SMS_MAX_LENGTH = 160;

export function encodeSms(plot: string, counts: Counts, over15: boolean | null): string {
  const parts = ["LP", plot, `${counts.total}H`];
  for (const [token, key] of TOKENS) {
    if (counts[key] > 0) parts.push(`${token}${counts[key]}`);
  }
  if (over15 === true) parts.push("E15+");
  const text = parts.join(" ");
  if (text.length > SMS_MAX_LENGTH) throw new Error("El código no cabe en un SMS");
  return text;
}

/** Devuelve null si la línea no es un código válido. */
export function decodeSms(text: string): SmsPayload | null {
  const parts = text.trim().toUpperCase().split(/\s+/);
  if (parts.length < 3 || parts[0] !== "LP") return null;
  const plot = normalizePlot(parts[1]);
  const totalMatch = /^(\d{1,3})H$/.exec(parts[2]);
  if (!plot || !totalMatch) return null;

  const counts = emptyCounts();
  counts.total = Number(totalMatch[1]);
  let over15 = false;
  const seen = new Set<string>();
  for (const part of parts.slice(3)) {
    if (seen.has(part.replace(/\d+$/, ""))) return null;
    seen.add(part.replace(/\d+$/, ""));
    if (part === "E15+") {
      over15 = true;
      continue;
    }
    const match = /^([A-Z]+)(\d{1,3})$/.exec(part);
    const token = match && TOKENS.find(([name]) => name === match[1]);
    if (!match || !token || Number(match[2]) === 0) return null;
    counts[token[1]] = Number(match[2]);
  }
  const named = counts.roya + counts.minador + counts.cercospora + counts.phoma + counts.duda;
  if (counts.total === 0 || named > counts.total) return null;
  counts.sana = counts.total - named;
  return { plot, counts, over15 };
}

/** Una pieza del código y lo que significa, para explicarlo junto al SMS. */
export type CodePart =
  | { text: string; kind: "app" | "plot" | "total" | "over15" }
  /** La clase contada y cuántas hojas. */
  | { text: string; kind: "count"; label: (typeof TOKENS)[number][1]; n: number };

/** Separa un código armado por `encodeSms` en sus piezas, en orden. */
export function codeParts(code: string): CodePart[] {
  return code.split(" ").map((text, i): CodePart => {
    if (i === 0) return { text, kind: "app" };
    if (i === 1) return { text, kind: "plot" };
    if (i === 2) return { text, kind: "total" };
    if (text === "E15+") return { text, kind: "over15" };
    const [token, label] = TOKENS.find(([name]) => text.startsWith(name))!;
    return { text, kind: "count", label, n: Number(text.slice(token.length)) };
  });
}

/** Lo que recibe el servicio LLM (POST /api/sms): solo lo que ya va en el código. */
export interface SmsRequest {
  plot: string;
  counts: Counts;
  over15: boolean;
  flagUnsure: boolean;
  code: string;
}

export function buildSmsRequest(plot: string, counts: Counts, over15: boolean | null): SmsRequest {
  return {
    plot,
    counts,
    over15: over15 === true,
    flagUnsure: tooManyUnsure(counts),
    code: encodeSms(plot, counts, over15),
  };
}

const SENTENCE_NAMES: Record<(typeof TOKENS)[number][1], string> = {
  roya: "con roya",
  minador: "con minador",
  cercospora: "con cercospora",
  phoma: "con phoma",
  duda: "dudosas",
};

/**
 * Frase fija para el técnico: los conteos del código, en palabras. La arman reglas en el
 * teléfono, sin IA y sin red, con la misma plantilla que usa el servidor (api/_lib.js).
 */
export function fixedSentence({ plot, counts, over15, code }: SmsRequest): string {
  const parts = TOKENS.filter(([, key]) => counts[key] > 0).map(([, key]) => `${counts[key]} ${SENTENCE_NAMES[key]}`);
  const base = parts.length
    ? `Parcela ${plot}: de ${counts.total} hojas, ${parts.join(", ")}.`
    : `Parcela ${plot}: ${counts.total} hojas revisadas, sin senales de enfermedad.`;
  const withAge = over15 ? `${base} Plantas de mas de 15 anos.` : base;
  return code.length + 1 + withAge.length <= SMS_MAX_LENGTH ? withAge : base;
}

/**
 * Las frases que pueden ir debajo del código, ya limpias; la que no vale queda fuera.
 * El contenido del mensaje del modelo lo valida el servidor que lo redacta; aquí solo se
 * comprueba que no rompa el SMS: una línea ASCII, sin otro código, que quepa junto al código.
 */
export function smsSentences(code: string, ...sentences: (string | null | undefined)[]): string[] {
  return sentences
    .map((sentence) => sentence?.trim() ?? "")
    .filter(
      (text) =>
        /^[\x20-\x7E]+$/.test(text) &&
        !text.toUpperCase().includes("LP ") &&
        code.length + 1 + text.length <= SMS_MAX_LENGTH,
    );
}

/** SMS final: el código y, debajo, una frase por línea (la fija y el mensaje del modelo). */
export function composeSms(code: string, ...sentences: (string | null | undefined)[]): string {
  return [code, ...smsSentences(code, ...sentences)].join("\n");
}

/** Separa un texto pegado (un código por línea) en códigos válidos y líneas que no se entienden. */
export function parseCodes(text: string): { payloads: SmsPayload[]; invalid: string[] } {
  const payloads: SmsPayload[] = [];
  const invalid: string[] = [];
  // Debajo de un código van las frases de su SMS, que no se usan para ordenar: la fija, que
  // empieza por "Parcela <parcela>", y una línea libre, el mensaje del modelo.
  let plot: string | null = null;
  let freeLine = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Tolera texto alrededor (p. ej. hora o remitente copiados con el SMS).
    const start = line.toUpperCase().indexOf("LP ");
    const payload = start >= 0 ? decodeSms(line.slice(start)) : null;
    if (payload) {
      payloads.push(payload);
      plot = payload.plot;
      freeLine = true;
    } else if (plot && line.toUpperCase().startsWith(`PARCELA ${plot}`)) {
      continue;
    } else if (freeLine && start < 0) {
      // Una línea con "LP " que no se entiende es un código mal escrito, no una frase.
      freeLine = false;
    } else {
      invalid.push(line);
      plot = null;
    }
  }
  return { payloads, invalid };
}
