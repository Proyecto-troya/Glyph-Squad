// Código SMS de una línea (< 160 caracteres), sin datos personales:
//   LP <parcela> <total>H [ROYA<n>] [MIN<n>] [CER<n>] [PHO<n>] [DUDA<n>] [E15+]
// Las clases en 0 se omiten; E15+ solo si respondió que sí.

import { Counts, emptyCounts, normalizePlot } from "./sample";

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

/** Separa un texto pegado (un código por línea) en códigos válidos y líneas que no se entienden. */
export function parseCodes(text: string): { payloads: SmsPayload[]; invalid: string[] } {
  const payloads: SmsPayload[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Tolera texto alrededor (p. ej. hora o remitente copiados con el SMS).
    const start = line.toUpperCase().indexOf("LP ");
    const payload = start >= 0 ? decodeSms(line.slice(start)) : null;
    if (payload) payloads.push(payload);
    else invalid.push(line);
  }
  return { payloads, invalid };
}
