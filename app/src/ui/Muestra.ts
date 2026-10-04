import { fileToPixels } from "../adapters/image";
import { checkQuality, QualityReport } from "../adapters/photoQuality";
import {
  addLeaf,
  ClassProb,
  LeafResult,
  newSample,
  normalizePlot,
  removeLastLeaf,
  TARGET_LEAVES,
} from "../domain/sample";
import { App, forgetLast } from "./app";
import { el, sampleMap } from "./dom";
import { icon } from "./icons";
import { scanClassifying, scanResult, scanWorking } from "./scan";

export function renderMuestra(root: HTMLElement, app: App): void {
  if (!app.sample) {
    renderPlotForm(root, app);
    return;
  }
  const sample = app.sample;
  const done = sample.leaves.length >= TARGET_LEAVES;

  const input = el("input", { type: "file", accept: "image/*", hidden: true });
  input.setAttribute("capture", "environment");
  const shoot = el("button", { class: "primary big", type: "button", disabled: done }, icon("camera"), app.t("shoot"));
  shoot.onclick = () => input.click();
  // El visor: la foto en análisis o, al terminar, la última foto con su resultado.
  const scanSlot = el("div", { class: "scan-slot" });
  if (app.last) scanSlot.append(scanResult(app, app.last));

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    shoot.disabled = true;
    forgetLast(app);
    const photoUrl = URL.createObjectURL(file);
    const card = scanWorking(app, photoUrl);
    scanSlot.replaceChildren(card);
    const started = performance.now();
    let quality: QualityReport | null = null;
    try {
      const pixels = await fileToPixels(file);
      quality = checkQuality(pixels);
      let leaf: LeafResult;
      let alternatives: ClassProb[] = [];
      if (quality.quality === "repetir") {
        leaf = { label: "duda", confidence: 0, quality: "repetir" };
      } else {
        scanClassifying(card, app, quality);
        await painted();
        const prediction = await app.classifier.classify(pixels);
        leaf = { label: prediction.label, confidence: prediction.confidence, quality: "ok" };
        alternatives = prediction.alternatives;
      }
      const seconds = (performance.now() - started) / 1000;
      app.last = { leaf, reason: quality.reason, seconds, photoUrl, quality, alternatives };
      app.fresh = true;
      app.update(addLeaf(sample, leaf));
    } catch (error) {
      console.error(error);
      const leaf: LeafResult = { label: "duda", confidence: 0, quality: "repetir" };
      app.last = { leaf, seconds: 0, photoUrl, quality, alternatives: [] };
      app.render();
    }
  };

  const undo = el("button", { type: "button", disabled: sample.leaves.length === 0 }, icon("undo"), app.t("undo"));
  undo.onclick = () => {
    forgetLast(app);
    app.update(removeLastLeaf(sample));
  };
  const next = el(
    "button",
    { class: "primary", type: "button", disabled: sample.leaves.length === 0 },
    app.t("seeResult"),
    icon("arrow"),
  );
  next.onclick = () => app.go("resultado");

  root.append(
    el("h1", {}, app.t("plotTitle", { plot: sample.plot })),
    el(
      "section",
      { class: "card" },
      el("p", { class: "counter" }, el("strong", {}, String(sample.leaves.length)), app.t("counter", { total: TARGET_LEAVES })),
      sampleMap(sample.leaves, app),
      done
        ? el("p", { class: "done" }, icon("check"), app.t("sampleDone"))
        : el("p", { class: "hint" }, app.t("sampleHint")),
    ),
    shoot,
    input,
    scanSlot,
    el("div", { class: "row" }, undo, next),
  );
}

/** Deja que el navegador pinte el paso antes de que el modelo ocupe el hilo. */
function painted(): Promise<void> {
  return new Promise((resolve) => {
    // Con la pestaña en segundo plano no hay cuadro que esperar: se sigue igual.
    const fallback = setTimeout(resolve, 100);
    requestAnimationFrame(() => {
      clearTimeout(fallback);
      setTimeout(resolve);
    });
  });
}

function renderPlotForm(root: HTMLElement, app: App): void {
  const input = el("input", { type: "text", placeholder: "P114", maxLength: 8, autocapitalize: "characters" });
  const error = el("p", { class: "error" });
  const form = el(
    "form",
    {},
    el(
      "div",
      { class: "intro" },
      // La marca a color ya trae su plato.
      el("img", { class: "brand-hero", src: "logo-marca.svg", alt: "" }),
      el("h1", {}, app.t("newSample")),
      el("p", {}, app.t("newSampleIntro", { total: TARGET_LEAVES })),
    ),
    el(
      "section",
      { class: "card" },
      el("label", {}, app.t("plotLabel"), input),
      error,
      el("button", { class: "primary big", type: "submit" }, app.t("start"), icon("arrow")),
    ),
    el(
      "ol",
      { class: "steps" },
      el("li", {}, app.t("step1")),
      el("li", {}, app.t("step2")),
      el("li", {}, app.t("step3")),
    ),
    el(
      "figure",
      { class: "guide" },
      el("img", { src: "muestreo-plantas.svg", alt: app.t("samplingAlt") }),
      el("figcaption", {}, app.t("samplingCaption")),
    ),
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    const plot = normalizePlot(input.value);
    if (!plot) {
      error.textContent = app.t("plotError");
      return;
    }
    forgetLast(app);
    app.update(newSample(plot));
  };
  root.append(form);
}
