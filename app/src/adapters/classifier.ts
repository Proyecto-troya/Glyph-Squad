// Única IA de la app: clasificador de visión (5 clases + abstención).
// Si no hay modelo en public/models/, se usa un clasificador de mentira
// para poder ensayar el recorrido; la interfaz lo rotula como demostración.

import { ClassProb, decideLabel, LEAF_LABELS, LeafLabel, softmax, topClasses } from "../domain/sample";
import { Pixels } from "./photoQuality";

export interface Prediction {
  label: LeafLabel | "duda";
  confidence: number;
  /** Las tres clases más probables con su probabilidad calibrada, de mayor a menor. */
  alternatives: ClassProb[];
}

export interface Classifier {
  kind: "onnx" | "fake";
  /** Umbral de abstención: con una confianza menor la respuesta es "duda". */
  threshold: number;
  classify(pixels: Pixels): Promise<Prediction>;
}

/** Lo escribe ml/calibrate.py junto al modelo. */
export interface Calibration {
  /** Archivo del modelo en models/: leaf-int8.onnx, o leaf-fp32.onnx si int8 perdió precisión. */
  model: string;
  labels: LeafLabel[];
  temperature: number;
  threshold: number;
  inputSize: number;
  mean: [number, number, number];
  std: [number, number, number];
}

const CALIBRATION_URL = "models/calibration.json";

export async function loadClassifier(): Promise<Classifier> {
  try {
    const response = await fetch(CALIBRATION_URL);
    if (!response.ok) throw new Error("sin calibration.json");
    const calibration = (await response.json()) as Calibration;
    return await createOnnxClassifier(calibration);
  } catch (error) {
    console.warn("Sin modelo real, se usa el clasificador de mentira:", error);
    return createFakeClassifier();
  }
}

async function createOnnxClassifier(calibration: Calibration): Promise<Classifier> {
  const ort = await import("onnxruntime-web/wasm");
  // Vite empaqueta el .wasm con la app (sin CDN). Un solo hilo no exige cabeceras COOP/COEP.
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(`models/${calibration.model}`, { executionProviders: ["wasm"] });
  const size = calibration.inputSize;

  return {
    kind: "onnx",
    threshold: calibration.threshold,
    async classify(pixels) {
      const input = toTensorData(pixels, calibration);
      const tensor = new ort.Tensor("float32", input, [1, 3, size, size]);
      const output = await session.run({ [session.inputNames[0]]: tensor });
      const logits = output[session.outputNames[0]].data as Float32Array;
      const probs = softmax(logits, calibration.temperature);
      return {
        ...decideLabel(probs, calibration.threshold, calibration.labels),
        alternatives: topClasses(probs, calibration.labels),
      };
    },
  };
}

/** Recorte central cuadrado → inputSize × inputSize → NCHW normalizado (igual que ml/common.py). */
function toTensorData(pixels: Pixels, calibration: Calibration): Float32Array {
  const size = calibration.inputSize;
  const source = document.createElement("canvas");
  source.width = pixels.width;
  source.height = pixels.height;
  source
    .getContext("2d")!
    .putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);

  const side = Math.min(pixels.width, pixels.height);
  const target = document.createElement("canvas");
  target.width = size;
  target.height = size;
  const ctx = target.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(
    source,
    (pixels.width - side) / 2,
    (pixels.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  const rgba = ctx.getImageData(0, 0, size, size).data;

  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (rgba[i * 4 + c] / 255 - calibration.mean[c]) / calibration.std[c];
    }
  }
  return out;
}

/** Determinista: la misma foto da siempre la misma respuesta. No mira la hoja de verdad. */
export function createFakeClassifier(threshold = 0.6): Classifier {
  return {
    kind: "fake",
    threshold,
    async classify(pixels) {
      let hash = 2166136261;
      const step = Math.max(4, Math.floor(pixels.data.length / 4096) * 4);
      for (let i = 0; i < pixels.data.length; i += step) {
        hash = Math.imul(hash ^ pixels.data[i] ^ (pixels.data[i + 1] << 8), 16777619) >>> 0;
      }
      const confidence = 0.45 + ((hash >>> 8) % 1000) / 1000 * 0.54;
      const label = LEAF_LABELS[hash % LEAF_LABELS.length];
      // Tan inventadas como la clase: lo que sobra de la confianza, repartido entre otras dos.
      const others = LEAF_LABELS.filter((other) => other !== label);
      const second = others[(hash >>> 4) % others.length];
      const third = others.filter((other) => other !== second)[(hash >>> 6) % (others.length - 1)];
      const rest = 1 - confidence;
      const alternatives = [
        { label, p: confidence },
        { label: second, p: rest * 0.6 },
        { label: third, p: rest * 0.3 },
      ];
      return { label: confidence >= threshold ? label : "duda", confidence, alternatives };
    },
  };
}
