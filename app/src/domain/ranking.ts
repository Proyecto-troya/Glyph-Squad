// Lista del técnico: una fila por parcela, ordenada por % de hojas enfermas.
// Es una regla, no IA: el técnico decide a quién visita.

import { Counts, sickPct, tooManyUnsure } from "./sample";
import { SmsPayload } from "./sms";

export interface PlotRow {
  plot: string;
  sickPct: number;
  counts: Counts;
  over15: boolean;
  flagUnsure: boolean;
}

export function toPlotRow(payload: SmsPayload): PlotRow {
  return {
    plot: payload.plot,
    sickPct: sickPct(payload.counts),
    counts: payload.counts,
    over15: payload.over15,
    flagUnsure: tooManyUnsure(payload.counts),
  };
}

/** Si una parcela llega dos veces, vale el último código. */
export function rankPlots(payloads: SmsPayload[]): PlotRow[] {
  const byPlot = new Map<string, PlotRow>();
  for (const payload of payloads) byPlot.set(payload.plot, toPlotRow(payload));
  return [...byPlot.values()].sort(
    (a, b) =>
      b.sickPct - a.sickPct ||
      Number(b.flagUnsure) - Number(a.flagUnsure) ||
      Number(b.over15) - Number(a.over15) ||
      a.plot.localeCompare(b.plot),
  );
}
