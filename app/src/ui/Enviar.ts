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
    root.append(emptyState(app.t("tabSend"), "send", app));
    return;
  }
  const request = buildSmsRequest(sample.plot, countLeaves(sample.leaves), sample.over15);
  const code = request.code;
  // El código lo arma siempre la app y es igual en todos los idiomas; el LLM solo añade una frase debajo.
  let sms = code;

  // La app no envía nada: solo abre la app de SMS con el texto listo y ella pulsa enviar.
  const link = el("a", { class: SMS_SEND_ENABLED ? "button big" : "button primary big" }, icon("message"), app.t("openSms"));
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
    sentenceLabel.textContent = app.t(used ? "sentenceAi" : "sentenceNone");
    setLink();
  };

  const askSentence = async () => {
    sentenceBox.textContent = "";
    sentenceLabel.textContent = app.t("sentenceAsking");
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

  const number = el("input", { type: "tel", value: app.techNumber, placeholder: app.t("techNumberPlaceholder") });
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
  const retry = el("button", { type: "button" }, icon("refresh"), app.t("sentenceRetry"));
  retry.onclick = () => void askSentence();

  const copy = el("button", { type: "button" }, icon("copy"), app.t("copy"));
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(sms);
      copy.textContent = app.t("copied");
    } catch {
      copy.textContent = app.t("copyManually");
    }
  };

  const restart = el("button", { type: "button" }, icon("plus"), app.t("restart"));
  restart.onclick = async () => {
    await storage.archive(sample);
    app.last = null;
    app.sentence = null;
    app.update(null);
    app.go("muestra");
  };

  // Envío por el servidor; el enlace sms: queda como respaldo sin conexión.
  const sendStatus = el("p", { class: "status" });
  const sendButton = el("button", { class: "primary big", type: "button" }, icon("send"), app.t("sendToTech"));
  sendButton.onclick = async () => {
    sendButton.disabled = true;
    sendStatus.textContent = app.t("sending");
    const status = await sendSms(app.serviceUrl, code, sms === code ? null : sms.slice(code.length + 1));
    sendButton.disabled = status === "queued";
    sendStatus.textContent = app.t(
      status === "queued" ? "sendQueued" : status === "simulated" ? "sendSimulated" : "sendFailed",
    );
  };

  root.append(
    el("h1", {}, app.t("sendTitle")),
    messageCard({ id: "M08" }, app),
    el(
      "section",
      { class: "card" },
      el("h2", {}, app.t("yourMessage")),
      codeBox,
      sentenceBox,
      sentenceLabel,
      el("p", { class: "hint" }, app.t("privacyHint")),
    ),
    SMS_SEND_ENABLED ? sendButton : "",
    SMS_SEND_ENABLED ? sendStatus : "",
    el("label", {}, app.t("techNumberLabel"), number),
    link,
    el("div", { class: "row" }, copy, restart),
  );
  if (SMS_SERVICE_ENABLED) {
    root.append(
      el(
        "details",
        {},
        el("summary", {}, app.t("laptopSummary")),
        el("label", {}, app.t("serverLabel"), server),
        retry,
      ),
    );
  }
}
