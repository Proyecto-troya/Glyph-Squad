// Filtro de calidad de la foto (reglas, no IA): nitidez por varianza del
// laplaciano, brillo medio y área de hoja sobre el plato.
// Los umbrales son de partida: ajustarlos con ~30 fotos propias en el Android real.

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface QualityThresholds {
  minSharpness: number;
  minBrightness: number;
  maxBrightness: number;
  minLeafArea: number;
  maxLeafArea: number;
}

export const QUALITY_DEFAULTS: QualityThresholds = {
  minSharpness: 40,
  minBrightness: 50,
  maxBrightness: 240,
  minLeafArea: 0.05,
  maxLeafArea: 0.95,
};

export type RejectReason = "borrosa" | "oscura" | "quemada" | "sin_hoja" | "sin_plato";

export interface QualityReport {
  quality: "ok" | "repetir";
  reason?: RejectReason;
  sharpness: number;
  brightness: number;
  leafArea: number;
}

export function measure(p: Pixels): { sharpness: number; brightness: number; leafArea: number } {
  const { data, width, height } = p;
  const gray = new Float32Array(width * height);
  let brightnessSum = 0;
  let leafPixels = 0;
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[j] = 0.299 * r + 0.587 * g + 0.114 * b;
    brightnessSum += gray[j];
    // El plato es claro y sin color; lo demás cuenta como hoja.
    const max = Math.max(r, g, b);
    const saturation = max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
    if (!(max > 170 && saturation < 0.18)) leafPixels++;
  }

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = n ? sum / n : 0;
  return {
    sharpness: n ? sumSq / n - mean * mean : 0,
    brightness: brightnessSum / gray.length,
    leafArea: leafPixels / gray.length,
  };
}

export function checkQuality(p: Pixels, t: QualityThresholds = QUALITY_DEFAULTS): QualityReport {
  const m = measure(p);
  let reason: RejectReason | undefined;
  if (m.brightness < t.minBrightness) reason = "oscura";
  else if (m.brightness > t.maxBrightness) reason = "quemada";
  else if (m.leafArea < t.minLeafArea) reason = "sin_hoja";
  else if (m.leafArea > t.maxLeafArea) reason = "sin_plato";
  else if (m.sharpness < t.minSharpness) reason = "borrosa";
  return { quality: reason ? "repetir" : "ok", reason, ...m };
}
