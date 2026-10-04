import { AiMessage, requestAiSentence, sendSms, SMS_SEND_ENABLED, SMS_SERVICE_ENABLED } from "../adapters/smsService";
import { storage } from "../adapters/storage";
import { countLeaves } from "../domain/sample";
import { buildSmsRequest, CodePart, codeParts, composeSms, fixedSentence, smsSentences } from "../domain/sms";
import { App, forgetLast } from "./app";
import { el, emptyState, LABEL_KEYS, messageCard } from "./dom";
import { icon } from "./icons";

export function renderEnviar(root: HTMLElement, app: App): void {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) {
    root.append(emptyState(app.t("tabSend"), "send", app));
    return;
  }
  const request = buildSmsRequest(sample.plot, countLeaves(sample.leaves), sample.over15);
  const code = request.code;
  // El código y la frase fija los arma siempre la app, con reglas y sin red, y son iguales en
  // todos los idiomas. El modelo de la laptop añade otro mensaje debajo, cuando responde.
  const fixedLine = smsSentences(code, fixedSentence(request))[0] ?? null;
  let aiLine: string | null = null;
  let sms = composeSms(code, fixedLine);

  // La app no envía nada: solo abre la app de SMS con el texto listo y ella pulsa enviar.
  const link = el("a", { class: SMS_SEND_ENABLED ? "button big" : "button primary big" }, icon("message"), app.t("openSms"));
  const codeBox = el("p", { class: "code" }, code);
  // El mensaje de la IA va en su propio recuadro: es otro mensaje, aparte de la frase fija.
  const aiBox = el("p", { class: "sentence" });
  const aiLabel = el("p", { class: "hint" });
  const aiCard = el("div", { class: "ai-message", hidden: true }, aiBox, aiLabel);
  const setLink = () => {
    link.href = `sms:${app.techNumber.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(sms)}`;
  };

  const showAi = (message: AiMessage | null) => {
    aiLine = smsSentences(code, message?.text)[0] ?? null;
    // Lo que se ve es lo que se envía: el código, la frase fija y, si llegó, el mensaje de la IA.
    sms = composeSms(code, fixedLine, aiLine);
    aiBox.textContent = aiLine ?? "";
    // Se dice dónde corre el modelo que lo redactó: en la laptop o en un servidor de internet.
    const label = app.t(message?.host === "cloud" ? "sentenceAiCloud" : "sentenceAi");
    aiLabel.replaceChildren(...(aiLine ? [icon("local-ai"), label] : []));
    aiCard.hidden = !aiLine;
    setLink();
  };

  const askAi = async () => {
    // El aviso de espera sale solo si la respuesta tarda.
    const waiting = setTimeout(() => {
      aiLabel.textContent = app.t("sentenceAsking");
      aiCard.hidden = false;
    }, 400);
    const message = await requestAiSentence(app.serviceUrl, request);
    clearTimeout(waiting);
    // Solo se recuerda el mensaje que llegó: si no hubo, se vuelve a pedir al volver a esta pantalla.
    if (message) app.sentence = { code, ai: message };
    // Si mientras tanto cambió la pantalla, estos nodos ya no están a la vista y no pasa nada.
    showAi(message);
  };

  setLink();
  if (SMS_SERVICE_ENABLED) {
    if (app.sentence?.code === code) showAi(app.sentence.ai);
    else void askAi();
  }

  const number = el("input", { type: "tel", value: app.techNumber, placeholder: app.t("techNumberPlaceholder") });
  number.oninput = () => {
    app.techNumber = number.value;
    void storage.saveTechNumber(number.value);
    setLink();
  };

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
    forgetLast(app);
    app.sentence = null;
    app.update(null);
    app.go("muestra");
  };

  // Envío por el servidor; el enlace sms: queda como respaldo sin conexión.
  const sendStatus = el("p", { class: "status" });
  const sendButton = el("button", { class: "primary big", type: "button" }, icon("send"), app.t("sendToTech"));
  sendButton.onclick = async () => {
    sendButton.disabled = true;
    delete sendStatus.dataset.state;
    sendStatus.textContent = app.t("sending");
    const status = await sendSms(code, fixedLine, aiLine);
    sendButton.disabled = status === "queued";
    // El punto de .status late solo mientras se envía; al terminar queda fijo o, si no salió, en aviso.
    sendStatus.dataset.state = status === "queued" ? "done" : "fail";
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
      codeMeaning(code, app),
      fixedLine && el("p", { class: "sentence" }, fixedLine),
      fixedLine && el("p", { class: "hint" }, app.t("sentenceTemplate")),
      aiCard,
      el("p", { class: "hint" }, app.t("privacyHint")),
    ),
    SMS_SEND_ENABLED ? sendButton : "",
    SMS_SEND_ENABLED ? sendStatus : "",
    el("label", {}, app.t("techNumberLabel"), number),
    link,
    el("div", { class: "row" }, copy, restart),
  );
}

/** Lo que significa cada pieza del código, para que ella sepa qué envía y el técnico lo lea sin manual. */
function codeMeaning(code: string, app: App): HTMLElement {
  const meaning = (part: CodePart): string => {
    switch (part.kind) {
      case "app":
        return "Leaf Plate";
      case "plot":
        return app.t("partPlot");
      case "total":
        return app.t("partLeaves");
      case "over15":
        return app.t("partOld");
      case "count":
        return part.label === "duda"
          ? app.t("partUnsure", { n: part.n })
          : app.t("partCount", { n: part.n, name: app.t(LABEL_KEYS[part.label]).toLowerCase() });
    }
  };
  return el(
    "dl",
    { class: "code-parts" },
    ...codeParts(code).map((part) => el("div", { class: "code-part" }, el("dt", {}, part.text), el("dd", {}, meaning(part)))),
  );
}
