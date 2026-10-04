// Visor de análisis: la foto encuadrada, los pasos reales del filtro de calidad y del modelo
// y, al terminar, el resultado con su confianza frente al umbral calibrado.
// Solo muestra lo que la app mide; no hay animación que finja trabajo.

import { QUALITY_DEFAULTS, QualityReport, RejectReason } from "../adapters/photoQuality";
import { TextKey } from "../domain/i18n";
import { photoRejected } from "../domain/message";
import { ClassProb } from "../domain/sample";
import { App, LastPhoto } from "./app";
import { el, LABEL_KEYS, messageCard } from "./dom";
import { classIcon } from "./icons";

/** Por dónde va el análisis: midiendo la foto, clasificando, terminado o para repetir. */
type ScanPhase = "measuring" | "classifying" | "done" | "retry";
type StepState = "done" | "active" | "pending" | "fail";

interface QualityStep {
  name: TextKey;
  /** Motivos de rechazo de photoQuality.ts que corresponden a este paso. */
  fails: RejectReason[];
  ok(q: QualityReport): boolean;
  value(q: QualityReport, app: App): string;
}

const T = QUALITY_DEFAULTS;

/** Los tres primeros pasos son las medidas del filtro de calidad; el cuarto es el modelo. */
const QUALITY_STEPS: QualityStep[] = [
  {
    name: "stepSharpness",
    fails: ["borrosa"],
    ok: (q) => q.sharpness >= T.minSharpness,
    value: (q, app) => `${app.t(q.sharpness >= T.minSharpness ? "sharpOk" : "sharpBad")} · ${Math.round(q.sharpness)}`,
  },
  {
    name: "stepLight",
    fails: ["oscura", "quemada"],
    ok: (q) => q.brightness >= T.minBrightness && q.brightness <= T.maxBrightness,
    value: (q, app) => {
      const word = q.brightness < T.minBrightness ? "lightDark" : q.brightness > T.maxBrightness ? "lightBurnt" : "lightOk";
      return `${app.t(word)} · ${Math.round(q.brightness)}`;
    },
  },
  {
    name: "stepLeaf",
    fails: ["sin_hoja", "sin_plato"],
    ok: (q) => q.leafArea >= T.minLeafArea && q.leafArea <= T.maxLeafArea,
    value: (q, app) => app.t("leafArea", { pct: Math.round(q.leafArea * 100) }),
  },
];
const CLASSIFY = QUALITY_STEPS.length;

/** `quality` es null mientras la foto no se ha medido, o si no se pudo leer. */
function scanSteps(app: App, phase: ScanPhase, quality: QualityReport | null, seconds = 0): HTMLElement {
  // Paso que falló: el del motivo del filtro; sin medidas, la foto no se pudo leer; con medidas buenas, falló el modelo.
  const failAt =
    phase !== "retry"
      ? -1
      : !quality
        ? 0
        : quality.reason
          ? QUALITY_STEPS.findIndex((step) => step.fails.includes(quality.reason!))
          : CLASSIFY;

  const stateOf = (i: number): StepState => {
    if (phase === "measuring") return i === 0 ? "active" : "pending";
    if (phase === "classifying") return i < CLASSIFY ? "done" : "active";
    if (phase === "done") return "done";
    if (i > failAt) return "pending";
    if (i === failAt) return "fail";
    // El filtro da un solo motivo; un paso anterior con su medida fuera de rango tampoco se da por bueno.
    return quality && !QUALITY_STEPS[i].ok(quality) ? "fail" : "done";
  };
  const valueOf = (i: number, state: StepState): string => {
    if (state === "pending") return "";
    if (i < CLASSIFY) return quality ? QUALITY_STEPS[i].value(quality, app) : state === "fail" ? app.t("stepFailed") : "";
    return state === "done" ? `${seconds.toFixed(1)} s` : app.t(state === "active" ? "onPhone" : "stepFailed");
  };

  const names: TextKey[] = [...QUALITY_STEPS.map((step) => step.name), "stepClassify"];
  return el(
    "ol",
    { class: "scan-steps" },
    ...names.map((name, i) => {
      const state = stateOf(i);
      return el(
        "li",
        { class: "step", dataset: { state } },
        el("span", { class: "step-name" }, app.t(name)),
        el("span", { class: "step-value" }, valueOf(i, state)),
      );
    }),
  );
}

function scanCard(
  app: App,
  state: "working" | "done" | "retry",
  photoUrl: string,
  steps: HTMLElement,
  tone?: string,
): HTMLElement {
  const frame = el(
    "div",
    { class: tone ? `scan-frame tone-${tone}` : "scan-frame" },
    el("img", { class: "scan-photo", src: photoUrl, alt: app.t("photoAlt") }),
    state === "working" && el("span", { class: "scan-line" }),
  );
  const card = el("section", { class: "scan", dataset: { state } }, el("div", { class: "scan-top" }, frame, steps));
  card.setAttribute("aria-live", "polite");
  return card;
}

function scanMeta(app: App): HTMLElement {
  return el("p", { class: "scan-meta" }, app.t(app.classifier.kind === "onnx" ? "scanMeta" : "scanMetaDemo"));
}

/** La confianza frente al umbral calibrado; la zona rayada es donde la app diría "No estoy seguro". */
function meter(app: App, confidence: number): HTMLElement {
  const { threshold } = app.classifier;
  const below = confidence < threshold;
  const pct = Math.round(confidence * 100);
  const fill = el("div", { class: "meter-fill" });
  fill.style.width = `${pct}%`;
  const box = el(
    "div",
    { class: below ? "meter below" : "meter" },
    el(
      "div",
      { class: "meter-head" },
      el("span", {}, app.t("meterLabel")),
      el("strong", {}, String(pct), el("span", { class: "unit" }, "%")),
    ),
    el("div", { class: "meter-track" }, fill, el("span", { class: "meter-threshold" })),
    el("p", { class: "meter-note" }, app.t(below ? "meterBelow" : "meterNote", { pct: Math.round(threshold * 100) })),
  );
  box.style.setProperty("--threshold", String(threshold));
  box.setAttribute("role", "meter");
  box.setAttribute("aria-valuenow", String(pct));
  box.setAttribute("aria-valuemin", "0");
  box.setAttribute("aria-valuemax", "100");
  box.setAttribute("aria-label", app.t("meterAria"));
  return box;
}

function alternativesList(app: App, classes: ClassProb[]): HTMLElement {
  const list = el("ul", { class: "alternatives" });
  list.setAttribute("aria-label", app.t("altsAria"));
  for (const { label, p } of classes) {
    const fill = el("span", { class: "alt-fill" });
    fill.style.width = `${Math.max(2, p * 100)}%`;
    list.append(
      el(
        "li",
        { class: `alt tone-${label}` },
        el("span", { class: "alt-name" }, app.t(LABEL_KEYS[label])),
        el("span", { class: "alt-bar" }, fill),
        el("span", { class: "alt-pct" }, `${Math.round(p * 100)} %`),
      ),
    );
  }
  return list;
}

/** Visor mientras se analiza la foto: empieza midiendo la calidad. */
export function scanWorking(app: App, photoUrl: string): HTMLElement {
  const card = scanCard(app, "working", photoUrl, scanSteps(app, "measuring", null));
  card.append(scanMeta(app));
  return card;
}

/** La calidad ya está medida y es buena: los pasos avanzan en el mismo nodo, sin repintar la pantalla. */
export function scanClassifying(card: HTMLElement, app: App, quality: QualityReport): void {
  card.querySelector(".scan-steps")?.replaceWith(scanSteps(app, "classifying", quality));
}

/** Visor con la última foto ya analizada: el resultado, o qué paso falló y hay que repetirla. */
export function scanResult(app: App, last: LastPhoto): HTMLElement {
  const { leaf, quality, alternatives } = last;
  if (leaf.quality === "repetir") {
    const card = scanCard(app, "retry", last.photoUrl, scanSteps(app, "retry", quality));
    card.append(
      el("h2", { class: "scan-title" }, app.t("retake")),
      messageCard(photoRejected(), app),
      el(
        "figure",
        { class: "scan-guide" },
        el("img", { src: "guia-foto-correcta.svg", alt: app.t("guideAlt") }),
        el("figcaption", {}, app.t("guideCaption")),
      ),
      scanMeta(app),
    );
    return card;
  }
  const unsure = leaf.label === "duda";
  const card = scanCard(app, "done", last.photoUrl, scanSteps(app, "done", quality, last.seconds), leaf.label);
  if (app.fresh) card.classList.add("fresh");
  card.append(
    el(
      "div",
      { class: `result-head tone-${leaf.label}` },
      classIcon(leaf.label),
      el("h2", {}, app.t(LABEL_KEYS[leaf.label])),
    ),
    meter(app, leaf.confidence),
    unsure ? el("p", { class: "scan-say" }, app.t("unsureExplain")) : "",
    el("p", { class: "scan-label" }, app.t(unsure ? "altsSeen" : "altsOther")),
    // En una hoja nombrada la primera es la propia respuesta: se muestran la segunda y la tercera.
    alternativesList(app, unsure ? alternatives : alternatives.slice(1)),
    scanMeta(app),
  );
  return card;
}
