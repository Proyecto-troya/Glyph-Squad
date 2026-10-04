// Contratos de datos y conteo de la muestra. Lógica pura, sin DOM.

export const LEAF_LABELS = ["sana", "roya", "minador", "cercospora", "phoma"] as const;
export type LeafLabel = (typeof LEAF_LABELS)[number];
export const SICK_LABELS = ["roya", "minador", "cercospora", "phoma"] as const;
export type SickLabel = (typeof SICK_LABELS)[number];

export interface LeafResult {
  label: LeafLabel | "duda";
  confidence: number;
  quality: "ok" | "repetir";
}

export interface Sample {
  plot: string;
  leaves: LeafResult[];
  over15: boolean | null;
  createdAt: string;
}

export interface Counts {
  total: number;
  sana: number;
  roya: number;
  minador: number;
  cercospora: number;
  phoma: number;
  duda: number;
}

/** Simplificación del muestreo SENASA: 10 plantas × 3 ramas. */
export const TARGET_LEAVES = 30;
/** Por encima de esta fracción de dudas se avisa al técnico (M06 / flagUnsure). */
export const UNSURE_LIMIT = 0.2;

/** Código de parcela: letras y números, sin datos personales. Devuelve null si no vale. */
export function normalizePlot(raw: string): string | null {
  const plot = raw.trim().toUpperCase();
  return /^[A-Z0-9]{1,8}$/.test(plot) ? plot : null;
}

export function newSample(plot: string, now: Date = new Date()): Sample {
  return { plot, leaves: [], over15: null, createdAt: now.toISOString() };
}

/** Las fotos rechazadas ("repetir") no entran en la muestra; tampoco más de 30 hojas. */
export function addLeaf(sample: Sample, leaf: LeafResult): Sample {
  if (leaf.quality !== "ok" || sample.leaves.length >= TARGET_LEAVES) return sample;
  return { ...sample, leaves: [...sample.leaves, leaf] };
}

export function removeLastLeaf(sample: Sample): Sample {
  return { ...sample, leaves: sample.leaves.slice(0, -1) };
}

export function emptyCounts(): Counts {
  return { total: 0, sana: 0, roya: 0, minador: 0, cercospora: 0, phoma: 0, duda: 0 };
}

export function countLeaves(leaves: LeafResult[]): Counts {
  const counts = emptyCounts();
  for (const leaf of leaves) {
    if (leaf.quality !== "ok") continue;
    counts.total += 1;
    counts[leaf.label] += 1;
  }
  return counts;
}

export function sickCount(c: Counts): number {
  return c.roya + c.minador + c.cercospora + c.phoma;
}

export function sickPct(c: Counts): number {
  return c.total === 0 ? 0 : (sickCount(c) / c.total) * 100;
}

export function tooManyUnsure(c: Counts): boolean {
  return c.total > 0 && c.duda / c.total > UNSURE_LIMIT;
}

/** Softmax con temperatura (calibración de Guo et al. 2017). */
export function softmax(logits: ArrayLike<number>, temperature = 1): number[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, logits[i] / temperature);
  const exps: number[] = [];
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] / temperature - max);
    exps.push(e);
    sum += e;
  }
  return exps.map((e) => e / sum);
}

/** Abstención: si la confianza máxima no llega al umbral, la respuesta es "duda". */
export function decideLabel(
  probs: number[],
  threshold: number,
  labels: readonly LeafLabel[] = LEAF_LABELS,
): { label: LeafLabel | "duda"; confidence: number } {
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  const confidence = probs[best] ?? 0;
  return { label: confidence >= threshold ? labels[best] : "duda", confidence };
}
