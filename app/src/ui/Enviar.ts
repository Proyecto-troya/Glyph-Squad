import { requestSentence, sendSms, SMS_SEND_ENABLED, SMS_SERVICE_ENABLED } from "../adapters/smsService";
import { storage } from "../adapters/storage";
import { countLeaves } from "../domain/sample";
import { buildSmsRequest, composeSms } from "../domain/sms";
import { App } from "./app";
import { el, emptyState, messageCard } from "./dom";
import { icon } from "./icons";

export function renderEnviar(root: HTMLElement, app: App): void {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) {
    root.append(emptyState("Enviar", "send", () => app.go("muestra")));
    return;
  }
  const request = buildSmsRequest(sample.plot, countLeaves(sample.leaves), sample.over15);
  const code = request.code;
  // El código lo arma siempre la app; el LLM solo añade una frase debajo.
  let sms = code;

  // La app no envía nada: solo abre la app de SMS con el texto listo y ella pulsa enviar.
  const link = el("a", { class: SMS_SEND_ENABLED ? "button big" : "button primary big" }, icon("message"), "Abrir SMS para el técnico");
  const codeBox = el("p", { class: "code" }, code);
  const sentenceBox = el("p", { class: "sentence" });
  const sentenceLabel = el("p", { class: "hint" });
  const setLink = () => {
    link.href = `sms:${app.techNumber.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(sms)}`;
  };

  const showSentence = (text: string | null) => {
    sms = composeSms(code, text);
    const used = sms !== code;
    sentenceBox.textContent = used ? sms.slice(code.length + 1) : "";
    sentenceLabel.textContent = used
      ? "Frase redactada por IA en la laptop. Léela antes de enviar."
      : "Sin frase de la laptop: el mensaje lleva solo el código.";
    setLink();
  };

  const askSentence = async () => {
    sentenceBox.textContent = "";
    sentenceLabel.textContent = "Pidiendo la frase a la laptop…";
    const response = await requestSentence(app.serviceUrl, request);
    app.sentence = { code, text: response?.text ?? null };
    // Si mientras tanto cambió la pantalla, estos nodos ya no están a la vista y no pasa nada.
    showSentence(app.sentence.text);
  };

  setLink();
  if (SMS_SERVICE_ENABLED) {
    if (app.sentence?.code === code) showSentence(app.sentence.text);
    else void askSentence();
  }

  const number = el("input", { type: "tel", value: app.techNumber, placeholder: "Número del técnico" });
  number.oninput = () => {
    app.techNumber = number.value;
    void storage.saveTechNumber(number.value);
    setLink();
  };

  const server = el("input", { type: "url", value: app.serviceUrl, placeholder: "http://192.168.43.1:8000" });
  server.onchange = () => {
    app.serviceUrl = server.value;
    void storage.saveServiceUrl(server.value);
    void askSentence();
  };
  const retry = el("button", { type: "button" }, icon("refresh"), "Pedir la frase otra vez");
  retry.onclick = () => void askSentence();

  const copy = el("button", { type: "button" }, icon("copy"), "Copiar mensaje");
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(sms);
      copy.textContent = "Copiado";
    } catch {
      copy.textContent = "Cópialo a mano";
    }
  };

  const restart = el("button", { type: "button" }, icon("plus"), "Empezar otra parcela");
  restart.onclick = async () => {
    await storage.archive(sample);
    app.last = null;
    app.sentence = null;
    app.update(null);
    app.go("muestra");
  };

  // Envío por el servidor; el enlace sms: queda como respaldo sin conexión.
  const sendStatus = el("p", { class: "status" });
  const sendButton = el("button", { class: "primary big", type: "button" }, icon("send"), "Enviar al técnico");
  sendButton.onclick = async () => {
    sendButton.disabled = true;
    sendStatus.textContent = "Enviando…";
    const status = await sendSms(app.serviceUrl, code, sms === code ? null : sms.slice(code.length + 1));
    sendButton.disabled = status === "sent";
    sendStatus.textContent =
      status === "sent"
        ? "Mensaje enviado al técnico."
        : status === "simulated"
          ? "Demostración: el servidor recibió el mensaje, pero no tiene servicio de SMS y no envió nada."
          : "No se pudo enviar por el servidor. Usa el botón de SMS del teléfono.";
  };

  root.append(
    el("h1", {}, "Mensaje para el técnico"),
    messageCard({ id: "M08" }, app.catalog),
    el(
      "section",
      { class: "card" },
      el("h2", {}, "Tu mensaje"),
      codeBox,
      sentenceBox,
      sentenceLabel,
      el("p", { class: "hint" }, "El mensaje lleva solo el código de parcela y los conteos. Las fotos no salen del teléfono."),
    ),
    SMS_SEND_ENABLED ? sendButton : "",
    SMS_SEND_ENABLED ? sendStatus : "",
    el("label", {}, "Número del técnico (para el SMS desde este teléfono)", number),
    link,
    el("div", { class: "row" }, copy, restart),
  );
  if (SMS_SERVICE_ENABLED) {
    root.append(
      el(
        "details",
        {},
        el("summary", {}, "Laptop que redacta la frase"),
        el("label", {}, "Dirección del servidor (vacío = el mismo que sirve la app)", server),
        retry,
      ),
    );
  }
}
