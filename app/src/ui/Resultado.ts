import { chooseMessages } from "../domain/message";
import { countLeaves, LEAF_LABELS, sickCount, sickPct } from "../domain/sample";
import { App } from "./app";
import { el, emptyState, LABEL_KEYS, messageCard, sampleMap } from "./dom";
import { icon } from "./icons";

export function renderResultado(root: HTMLElement, app: App): void {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) {
    root.append(emptyState(app.t("tabResult"), "chart", app));
    return;
  }
  const counts = countLeaves(sample.leaves);

  const table = el(
    "section",
    { class: "card counts" },
    sampleMap(sample.leaves, app, false),
    el(
      "p",
      { class: "summary" },
      el("strong", {}, app.t("summaryCount", { sick: sickCount(counts), total: counts.total })),
      ` ${app.t("summaryRest", { pct: Math.round(sickPct(counts)) })}`,
    ),
  );
  for (const label of [...LEAF_LABELS, "duda"] as const) {
    if (counts[label] === 0) continue;
    const fill = el("div", { class: "bar-fill" });
    fill.style.width = `${(counts[label] / counts.total) * 100}%`;
    table.append(
      el(
        "div",
        { class: `count-row tone-${label}` },
        el("span", { class: "dot" }),
        el("span", { class: "count-name" }, app.t(LABEL_KEYS[label])),
        el("div", { class: "bar" }, fill),
        el("strong", {}, String(counts[label])),
      ),
    );
  }
  table.append(
    el("div", { class: "count-row total" }, el("span", { class: "count-name" }, app.t("leavesTotal")), el("strong", {}, String(counts.total))),
  );

  const yes = el("button", { type: "button", class: sample.over15 === true ? "chosen" : "" }, app.t("yes"));
  const no = el("button", { type: "button", class: sample.over15 === false ? "chosen" : "" }, app.t("no"));
  yes.onclick = () => app.update({ ...sample, over15: true });
  no.onclick = () => app.update({ ...sample, over15: false });

  const next = el("button", { class: "primary big", type: "button", disabled: sample.over15 === null }, app.t("prepare"), icon("arrow"));
  next.onclick = () => app.go("enviar");

  root.append(
    el("h1", {}, app.t("plotTitle", { plot: sample.plot })),
    table,
    ...chooseMessages(counts).map((ref) => messageCard(ref, app)),
    el("div", { class: "card" }, el("h2", {}, app.t("ageQuestion")), el("div", { class: "row" }, yes, no)),
    next,
  );
}
