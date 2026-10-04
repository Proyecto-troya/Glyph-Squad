import { storage } from "../adapters/storage";
import { countLeaves } from "../domain/sample";
import { encodeSms } from "../domain/sms";
import { App } from "./app";
import { el, messageCard } from "./dom";

export function renderEnviar(root: HTMLElement, app: App): void {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) {
    root.append(el("h1", {}, "Enviar"), el("p", {}, "Todavía no hay hojas en la muestra."));
    return;
  }
  const code = encodeSms(sample.plot, countLeaves(sample.leaves), sample.over15);

  // La app no envía nada: solo abre la app de SMS con el texto listo y ella pulsa enviar.
  const link = el("a", { class: "button primary big" }, "✉️ Abrir SMS para el técnico");
  const setLink = () => {
    link.href = `sms:${app.techNumber.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(code)}`;
  };
  setLink();

  const number = el("input", { type: "tel", value: app.techNumber, placeholder: "Número del técnico" });
  number.oninput = () => {
    app.techNumber = number.value;
    void storage.saveTechNumber(number.value);
    setLink();
  };

  const copy = el("button", { type: "button" }, "Copiar código");
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      copy.textContent = "Copiado";
    } catch {
      copy.textContent = "Cópialo a mano";
    }
  };

  const restart = el("button", { type: "button" }, "Empezar otra parcela");
  restart.onclick = async () => {
    await storage.archive(sample);
    app.last = null;
    app.update(null);
    app.go("muestra");
  };

  root.append(
    el("h1", {}, "Mensaje para el técnico"),
    messageCard({ id: "M08" }, app.catalog),
    el("p", { class: "code" }, code),
    el("p", { class: "hint" }, "El mensaje lleva solo el código de parcela y los conteos. Las fotos no salen del teléfono."),
    el("label", {}, "Número del técnico", number),
    link,
    el("div", { class: "row" }, copy, restart),
  );
}
