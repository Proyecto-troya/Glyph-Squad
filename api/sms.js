// POST /api/sms — frase para el técnico a partir de los conteos.
// Con GATEWAY_URL la pide al gateway de la laptop (gateway/, su POST /api/sms), donde la
// redacta el LLM; sin gateway, con OLLAMA_URL la redacta aquí el LLM (llama3.2:3b). En los dos
// casos se valida; si no hay LLM, tarda demasiado o falla la validación, se usa la plantilla fija.

import { isSentence, isSmsRequest, numbersMatch, readJson, templateSentence } from "./_lib.js";

// Menos que los 10 s que espera la app: si la laptop no contesta, todavía llega la plantilla.
const GATEWAY_TIMEOUT_MS = 8_000;
const COUNT_KEYS = ["total", "sana", "roya", "minador", "cercospora", "phoma", "duda"];

/** La frase que redactó el modelo de la laptop, o null si el gateway respondió con su plantilla. */
async function askGateway(body) {
  const response = await fetch(`${process.env.GATEWAY_URL.replace(/\/+$/, "")}/api/sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // El token, si el gateway lo exige (GATEWAY_SMS_REQUIRE_TOKEN), no sale nunca del servidor.
      ...(process.env.GATEWAY_TOKEN ? { "X-Gateway-Token": process.env.GATEWAY_TOKEN } : {}),
    },
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    // El gateway rechaza cualquier campo de más: se le manda solo lo que espera.
    body: JSON.stringify({
      plot: body.plot,
      counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, body.counts[key]])),
      over15: body.over15,
      flagUnsure: body.flagUnsure === true,
      code: body.code,
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data.source === "llm" && typeof data.text === "string" ? data.text.trim() : null;
}

const SYSTEM = [
  "Escribe UNA frase en espanol para el tecnico de una cooperativa de cafe.",
  "Usa solo los numeros que recibes; no anadas, redondees ni omitas ningun conteo distinto de 0.",
  "Habla de 'senales de' un problema; nunca des un diagnostico.",
  "Nunca menciones dosis, productos, tratamientos, rendimiento ni precios.",
  "Sin tildes ni la letra n con virgulilla. Maximo 110 caracteres.",
].join(" ");

async function askLlm(body) {
  const response = await fetch(`${process.env.OLLAMA_URL.replace(/\/+$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? "llama3.2:3b",
      stream: false,
      keep_alive: "30m",
      format: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
      options: { temperature: 0, seed: 7, num_predict: 80 },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ plot: body.plot, counts: body.counts, over15: body.over15 }) },
      ],
    }),
  });
  const text = JSON.parse((await response.json()).message.content).text;
  return typeof text === "string" ? text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim() : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = readJson(req);
  if (!isSmsRequest(body)) return res.status(400).json({ error: "invalid request" });

  const ask = process.env.GATEWAY_URL ? askGateway : process.env.OLLAMA_URL ? askLlm : null;
  if (ask) {
    try {
      const text = await ask(body);
      if (text && isSentence(body.code, text) && numbersMatch(text, body)) {
        return res.status(200).json({ text, source: "llm" });
      }
    } catch {
      // Sin LLM a tiempo: plantilla.
    }
  }
  return res.status(200).json({ text: templateSentence(body), source: "fallback" });
}
