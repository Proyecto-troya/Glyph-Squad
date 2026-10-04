import { rankPlots } from "../domain/ranking";
import { SICK_LABELS } from "../domain/sample";
import { parseCodes } from "../domain/sms";
import { App } from "./app";
import { el, LABEL_KEYS } from "./dom";
import { icon } from "./icons";

const EXAMPLES = [
  "LP P114 30H ROYA7 CER1 DUDA2 E15+",
  "LP P027 30H",
  "LP P203 28H ROYA15 MIN3",
  "LP P088 30H PHO1 DUDA9",
].join("\n");

export function renderTecnico(root: HTMLElement, app: App): void {
  const text = el("textarea", { rows: 6, placeholder: app.t("techPlaceholder"), value: app.techText });
  const file = el("input", { type: "file", accept: ".txt,.csv,text/plain", hidden: true });
  const upload = el("button", { type: "button" }, icon("upload"), app.t("upload"));
  upload.onclick = () => file.click();
  const output = el("div", {});

  const refresh = () => {
    // Se guarda lo pegado para no perderlo al cambiar de idioma o de pestaña.
    app.techText = text.value;
    output.replaceChildren();
    const { payloads, invalid } = parseCodes(text.value);
    const rows = rankPlots(payloads);
    if (rows.length > 0) {
      const headers = [app.t("colPlot"), app.t("colSick"), app.t("leavesTotal"), app.t("colDetail"), app.t("colFlags")];
      const table = el("table", { class: "ranking" }, el("tr", {}, ...headers.map((h) => el("th", {}, h))));
      for (const row of rows) {
        const c = row.counts;
        const detail = SICK_LABELS.filter((label) => c[label] > 0).map(
          (label) => `${app.t(LABEL_KEYS[label]).toLowerCase()} ${c[label]}`,
        );
        if (c.duda > 0) detail.push(`${app.t("unsureShort")} ${c.duda}`);
        const flags = [row.over15 && app.t("flagOld"), row.flagUnsure && app.t("flagUnsure")].filter(Boolean);
        table.append(
          el(
            "tr",
            {},
            el("td", {}, row.plot),
            el("td", {}, el("span", { class: "pill" }, `${Math.round(row.sickPct)} %`)),
            el("td", {}, String(c.total)),
            el("td", {}, detail.join(", ") || app.t("noSick")),
            el("td", {}, ...flags.map((flag) => el("span", { class: "chip" }, flag as string))),
          ),
        );
      }
      output.append(el("div", { class: "card scroll" }, table));
    }
    if (invalid.length > 0) {
      output.append(
        el(
          "div",
          { class: "card warn" },
          el("p", { class: "error" }, app.t("invalidLines")),
          el("ul", { class: "invalid" }, ...invalid.map((line) => el("li", {}, line))),
        ),
      );
    }
  };

  text.oninput = refresh;
  file.onchange = async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    text.value = [text.value.trim(), await chosen.text()].filter(Boolean).join("\n");
    refresh();
  };
  const examples = el("button", { type: "button" }, icon("list"), app.t("loadExamples"));
  examples.onclick = () => {
    text.value = EXAMPLES;
    refresh();
  };

  root.append(
    el("h1", {}, app.t("techTitle")),
    el("p", { class: "hint" }, app.t("techHint")),
    text,
    el("div", { class: "row" }, upload, examples, file),
    output,
  );
  refresh();
}
