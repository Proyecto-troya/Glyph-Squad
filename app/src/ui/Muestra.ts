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
import { el, LABEL_KEYS, messageCard } from "./dom";
import { icon } from "./icons";

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
  const shoot = el("button", { class: "primary big", type: "button", disabled: done }, icon("camera"), app.t("shoot"));
  shoot.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    shoot.disabled = true;
    status.textContent = app.t("looking");
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

  const undo = el("button", { type: "button", disabled: sample.leaves.length === 0 }, icon("undo"), app.t("undo"));
  undo.onclick = () => {
    app.last = null;
    app.update(removeLastLeaf(sample));
  };
  const next = el(
    "button",
    { class: "primary", type: "button", disabled: sample.leaves.length === 0 },
    app.t("seeResult"),
    icon("arrow"),
  );
  next.onclick = () => app.go("resultado");

  const fill = el("div", { class: "progress-fill" });
  fill.style.width = `${Math.min(100, (sample.leaves.length / TARGET_LEAVES) * 100)}%`;

  root.append(
    el("h1", {}, app.t("plotTitle", { plot: sample.plot })),
    el(
      "section",
      { class: "card" },
      el("p", { class: "counter" }, el("strong", {}, String(sample.leaves.length)), app.t("counter", { total: TARGET_LEAVES })),
      el("div", { class: "progress" }, fill),
      done
        ? el("p", { class: "done" }, icon("check"), app.t("sampleDone"))
        : el("p", { class: "hint" }, app.t("sampleHint")),
    ),
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
    return el("div", { class: "card warn" }, el("h2", {}, app.t("retake")), messageCard(photoRejected(), app));
  }
  const unsure = leaf.label === "duda";
  return el(
    "div",
    { class: unsure ? "card warn" : "card" },
    el(
      "div",
      { class: `result-head tone-${leaf.label}` },
      el("span", { class: "dot" }),
      el("h2", {}, app.t(LABEL_KEYS[leaf.label])),
    ),
    el(
      "p",
      {},
      unsure ? app.t("unsureExplain") : app.t("confidence", { pct: Math.round(leaf.confidence * 100) }),
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
    el(
      "div",
      { class: "intro" },
      el("div", { class: "hero" }, icon("leaf")),
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
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    const plot = normalizePlot(input.value);
    if (!plot) {
      error.textContent = app.t("plotError");
      return;
    }
    app.last = null;
    app.update(newSample(plot));
  };
  root.append(form);
}
