import { chooseMessages } from "../domain/message";
import { countLeaves, LEAF_LABELS } from "../domain/sample";
import { App } from "./app";
import { el, LABEL_NAMES, messageCard } from "./dom";

export function renderResultado(root: HTMLElement, app: App): void {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) {
    root.append(el("h1", {}, "Resultado"), el("p", {}, "Todavía no hay hojas en la muestra."));
    return;
  }
  const counts = countLeaves(sample.leaves);

  const table = el("table", { class: "counts" });
  for (const label of [...LEAF_LABELS, "duda"] as const) {
    if (counts[label] === 0) continue;
    table.append(el("tr", {}, el("th", {}, LABEL_NAMES[label]), el("td", {}, String(counts[label]))));
  }
  table.append(el("tr", { class: "total" }, el("th", {}, "Hojas"), el("td", {}, String(counts.total))));

  const yes = el("button", { type: "button", class: sample.over15 === true ? "chosen" : "" }, "Sí");
  const no = el("button", { type: "button", class: sample.over15 === false ? "chosen" : "" }, "No");
  yes.onclick = () => app.update({ ...sample, over15: true });
  no.onclick = () => app.update({ ...sample, over15: false });

  const next = el("button", { class: "primary big", type: "button", disabled: sample.over15 === null }, "Preparar mensaje");
  next.onclick = () => app.go("enviar");

  root.append(
    el("h1", {}, `Parcela ${sample.plot}`),
    table,
    ...chooseMessages(counts).map((ref) => messageCard(ref, app.catalog)),
    el("div", { class: "card" }, el("h2", {}, "¿Tus plantas tienen más de 15 años?"), el("div", { class: "row" }, yes, no)),
    next,
  );
}
