import { rankPlots } from "../domain/ranking";
import { parseCodes } from "../domain/sms";
import { el } from "./dom";
import { icon } from "./icons";

const EXAMPLES = [
  "LP P114 30H ROYA7 CER1 DUDA2 E15+",
  "LP P027 30H",
  "LP P203 28H ROYA15 MIN3",
  "LP P088 30H PHO1 DUDA9",
].join("\n");

export function renderTecnico(root: HTMLElement): void {
  const text = el("textarea", { rows: 6, placeholder: "Pega aquí los códigos recibidos, uno por línea" });
  const file = el("input", { type: "file", accept: ".txt,.csv,text/plain", hidden: true });
  const upload = el("button", { type: "button" }, icon("upload"), "Subir archivo");
  upload.onclick = () => file.click();
  const output = el("div", {});

  const refresh = () => {
    output.replaceChildren();
    const { payloads, invalid } = parseCodes(text.value);
    const rows = rankPlots(payloads);
    if (rows.length > 0) {
      const table = el(
        "table",
        { class: "ranking" },
        el("tr", {}, ...["Parcela", "% enfermas", "Hojas", "Detalle", "Avisos"].map((h) => el("th", {}, h))),
      );
      for (const row of rows) {
        const c = row.counts;
        const detail = [
          c.roya && `roya ${c.roya}`,
          c.minador && `minador ${c.minador}`,
          c.cercospora && `cercospora ${c.cercospora}`,
          c.phoma && `phoma ${c.phoma}`,
          c.duda && `duda ${c.duda}`,
        ].filter(Boolean);
        const flags = [row.over15 && "Plantas > 15 años", row.flagUnsure && "Muchas dudas"].filter(Boolean);
        table.append(
          el(
            "tr",
            {},
            el("td", {}, row.plot),
            el("td", {}, el("span", { class: "pill" }, `${Math.round(row.sickPct)} %`)),
            el("td", {}, String(c.total)),
            el("td", {}, detail.join(", ") || "sin enfermas"),
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
          el("p", { class: "error" }, "Líneas que no se entienden:"),
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
  const examples = el("button", { type: "button" }, icon("list"), "Cargar ejemplos");
  examples.onclick = () => {
    text.value = EXAMPLES;
    refresh();
  };

  root.append(
    el("h1", {}, "Lista del técnico"),
    el("p", { class: "hint" }, "Ordena las parcelas por % de hojas con señales. Son 30 hojas por parcela: a quién visitar lo decide el técnico."),
    text,
    el("div", { class: "row" }, upload, examples, file),
    output,
  );
}
