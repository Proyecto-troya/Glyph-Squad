import { chooseMessages } from "../domain/message";
import { countLeaves, LEAF_LABELS } from "../domain/sample";
import { App } from "./app";
import { el, emptyState, LABEL_NAMES, messageCard } from "./dom";
import { icon } from "./icons";

export function renderResultado(root: HTMLElement, app: App): void {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) {
    root.append(emptyState("Resultado", "chart", () => app.go("muestra")));
    return;
  }
  const counts = countLeaves(sample.leaves);

  const table = el("section", { class: "card counts" });
  for (const label of [...LEAF_LABELS, "duda"] as const) {
    if (counts[label] === 0) continue;
    const fill = el("div", { class: "bar-fill" });
    fill.style.width = `${(counts[label] / counts.total) * 100}%`;
    table.append(
      el(
        "div",
        { class: `count-row tone-${label}` },
        el("span", { class: "dot" }),
        el("span", { class: "count-name" }, LABEL_NAMES[label]),
        el("div", { class: "bar" }, fill),
        el("strong", {}, String(counts[label])),
      ),
    );
  }
  table.append(
    el("div", { class: "count-row total" }, el("span", { class: "count-name" }, "Hojas"), el("strong", {}, String(counts.total))),
  );

  const yes = el("button", { type: "button", class: sample.over15 === true ? "chosen" : "" }, "Sí");
  const no = el("button", { type: "button", class: sample.over15 === false ? "chosen" : "" }, "No");
  yes.onclick = () => app.update({ ...sample, over15: true });
  no.onclick = () => app.update({ ...sample, over15: false });

  const next = el("button", { class: "primary big", type: "button", disabled: sample.over15 === null }, "Preparar mensaje", icon("arrow"));
  next.onclick = () => app.go("enviar");

  root.append(
    el("h1", {}, `Parcela ${sample.plot}`),
    table,
    ...chooseMessages(counts).map((ref) => messageCard(ref, app.catalog)),
    el("div", { class: "card" }, el("h2", {}, "¿Tus plantas tienen más de 15 años?"), el("div", { class: "row" }, yes, no)),
    next,
  );
}
