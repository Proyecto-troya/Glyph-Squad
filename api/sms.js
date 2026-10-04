// POST /api/sms — frase para el técnico a partir de los conteos.
// Con OLLAMA_URL la redacta el LLM (llama3.2:3b) y se valida; si no hay LLM,
// tarda más de 10 s o falla la validación, se usa la plantilla fija.

import { isSentence, isSmsRequest, numbersMatch, readJson, templateSentence } from "./_lib.js";

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

  if (process.env.OLLAMA_URL) {
    try {
      const text = await askLlm(body);
      if (text && isSentence(body.code, text) && numbersMatch(text, body)) {
        return res.status(200).json({ text, source: "llm" });
      }
    } catch {
      // Sin LLM a tiempo: plantilla.
    }
  }
  return res.status(200).json({ text: templateSentence(body), source: "fallback" });
}
