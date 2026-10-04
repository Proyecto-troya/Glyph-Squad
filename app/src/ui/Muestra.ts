import { fileToPixels } from "../adapters/image";
import { checkQuality } from "../adapters/photoQuality";
import { photoRejected } from "../domain/message";
import {
  addLeaf,
  LeafResult,
  newSample,
  normalizePlot,
  removeLastLeaf,
  TARGET_LEAVES,
} from "../domain/sample";
import { App } from "./app";
import { el, LABEL_NAMES, messageCard } from "./dom";

export function renderMuestra(root: HTMLElement, app: App): void {
  if (!app.sample) {
    renderPlotForm(root, app);
    return;
  }
  const sample = app.sample;
  const done = sample.leaves.length >= TARGET_LEAVES;

  const input = el("input", { type: "file", accept: "image/*", hidden: true });
  input.setAttribute("capture", "environment");
  const status = el("p", { class: "status" });
  const shoot = el("button", { class: "primary big", type: "button", disabled: done }, "📷 Foto de una hoja");
  shoot.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    shoot.disabled = true;
    status.textContent = "Mirando la hoja…";
    const started = performance.now();
    try {
      const pixels = await fileToPixels(file);
      const report = checkQuality(pixels);
      let leaf: LeafResult;
      if (report.quality === "repetir") {
        leaf = { label: "duda", confidence: 0, quality: "repetir" };
      } else {
        leaf = { ...(await app.classifier.classify(pixels)), quality: "ok" };
      }
      app.last = { leaf, reason: report.reason, seconds: (performance.now() - started) / 1000 };
      app.update(addLeaf(sample, leaf));
    } catch (error) {
      console.error(error);
      app.last = { leaf: { label: "duda", confidence: 0, quality: "repetir" }, seconds: 0 };
      app.render();
    }
  };

  const undo = el("button", { type: "button", disabled: sample.leaves.length === 0 }, "Quitar la última");
  undo.onclick = () => {
    app.last = null;
    app.update(removeLastLeaf(sample));
  };
  const next = el("button", { class: "primary", type: "button", disabled: sample.leaves.length === 0 }, "Ver resultado");
  next.onclick = () => app.go("resultado");

  root.append(
    el("h1", {}, `Parcela ${sample.plot}`),
    el("p", { class: "counter" }, `${sample.leaves.length} de ${TARGET_LEAVES} hojas`),
    el("p", { class: "hint" }, "Una hoja sola sobre un plato blanco, con luz. 3 hojas por planta, 10 plantas."),
    shoot,
    input,
    status,
    lastPhoto(app) ?? "",
    el("div", { class: "row" }, undo, next),
  );
}

function lastPhoto(app: App): HTMLElement | null {
  if (!app.last) return null;
  const { leaf, seconds } = app.last;
  if (leaf.quality === "repetir") {
    return el("div", { class: "card warn" }, el("h2", {}, "Repite la foto"), messageCard(photoRejected(), app.catalog));
  }
  const unsure = leaf.label === "duda";
  return el(
    "div",
    { class: unsure ? "card warn" : "card" },
    el("h2", {}, LABEL_NAMES[leaf.label]),
    el(
      "p",
      {},
      unsure
        ? "La hoja se cuenta como duda para que la vea el técnico."
        : `Confianza: ${Math.round(leaf.confidence * 100)} %`,
    ),
    el("p", { class: "hint" }, `${seconds.toFixed(1)} s`),
  );
}

function renderPlotForm(root: HTMLElement, app: App): void {
  const input = el("input", { type: "text", placeholder: "P114", maxLength: 8, autocapitalize: "characters" });
  const error = el("p", { class: "error" });
  const form = el(
    "form",
    {},
    el("h1", {}, "Nueva muestra"),
    el("label", {}, "Código de tu parcela (solo letras y números)", input),
    error,
    el("button", { class: "primary big", type: "submit" }, "Empezar"),
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    const plot = normalizePlot(input.value);
    if (!plot) {
      error.textContent = "Escribe el código de la parcela, por ejemplo P114.";
      return;
    }
    app.last = null;
    app.update(newSample(plot));
  };
  root.append(form);
}
