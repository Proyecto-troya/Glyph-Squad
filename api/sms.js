// POST /api/sms — frase para el técnico a partir de los conteos.
// Quién la redacta, por orden: el gateway de la laptop si hay GATEWAY_URL (gateway/, su
// POST /api/sms); un Ollama propio si hay OLLAMA_URL; y, desplegado en Vercel, un modelo pequeño
// alojado (Vercel AI Gateway). En todos los casos se valida aquí; si nadie da una frase que
// valga a tiempo, se responde con la plantilla fija.

import { isSentence, isSmsRequest, numbersMatch, readJson, templateSentence } from "./_lib.js";

// Menos que los 10 s que espera la app: si nadie contesta, todavía llega la plantilla.
const BUDGET_MS = 9_000;
const GATEWAY_TIMEOUT_MS = 6_000;
const COUNT_KEYS = ["total", "sana", "roya", "minador", "cercospora", "phoma", "duda"];

/** La frase que redactó el modelo de la laptop, o null si el gateway respondió con su plantilla. */
async function askGateway(body, timeoutMs) {
  const response = await fetch(`${process.env.GATEWAY_URL.replace(/\/+$/, "")}/api/sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // El token, si el gateway lo exige (GATEWAY_SMS_REQUIRE_TOKEN), no sale nunca del servidor.
      ...(process.env.GATEWAY_TOKEN ? { "X-Gateway-Token": process.env.GATEWAY_TOKEN } : {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
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

/** Sin tildes, eñes ni signos de apertura: el SMS se queda en el alfabeto básico. */
const plain = (text) => text.normalize("NFD").replace(/[̀-ͯ¿¡]/g, "").replace(/\s+/g, " ").trim();

async function askLlm(body, timeoutMs) {
  const response = await fetch(`${process.env.OLLAMA_URL.replace(/\/+$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
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
  return typeof text === "string" ? plain(text) : null;
}

// ---------- Modelo alojado (Vercel AI Gateway) ----------

const HOSTED_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
/** Modelo pequeño y abierto, de la familia del de la laptop. AI_GATEWAY_MODEL lo cambia; con "off" no se usa ningún modelo alojado. */
const HOSTED_MODEL = "meta/llama-3.1-8b";
const hostedModel = () => process.env.AI_GATEWAY_MODEL || HOSTED_MODEL;

const HOSTED_SYSTEM = [
  "Escribes una sola oracion en espanol para el tecnico de la cooperativa, que resume el conteo de hojas de una parcela de cafe.",
  "Reglas:",
  "- Incluye TODOS los numeros de la lista 'numeros obligatorios', sin cambiarlos. No inventes otros numeros.",
  "- Habla de 'senales de' un problema; nunca afirmes un diagnostico.",
  "- Nunca menciones dosis, productos, tratamientos, rendimiento ni precios.",
  "- Una sola linea, sin acentos ni enie, maximo 110 caracteres.",
  "Ejemplo de entrada: parcela P9; 30 hojas; roya 4; dudosas 2; plantas de mas de 15 anos.",
  "Ejemplo de salida: Parcela P9: 4 de 30 hojas con senales de roya y 2 dudosas. Plantas de mas de 15 anos.",
  "Responde solo con la oracion, sin comillas ni explicaciones.",
].join("\n");

const PROBLEMS = [["roya", "roya"], ["minador", "minador"], ["cercospora", "cercospora"], ["phoma", "phoma"], ["duda", "dudosas"]];

/** Los datos como una lista corta de la que el modelo puede copiar los números. */
function describe({ plot, counts, over15, code }) {
  const found = PROBLEMS.filter(([key]) => counts[key] > 0);
  const facts = [`parcela ${plot}`, `${counts.total} hojas`, ...found.map(([key, name]) => `${name} ${counts[key]}`)];
  if (found.length === 0) facts.push("sin senales de problemas");
  if (over15) facts.push("plantas de mas de 15 anos");
  const required = [...new Set([counts.total, ...found.map(([key]) => counts[key])])].sort((a, b) => b - a);
  return [
    `Datos: ${facts.join("; ")}.`,
    `Numeros obligatorios: ${required.join(", ")}`,
    `Maximo ${Math.min(110, 159 - code.length)} caracteres.`,
  ].join("\n");
}

/** En Vercel la credencial llega con cada petición (OIDC); fuera, solo si alguien la configuró. */
function hostedToken(req) {
  return process.env.AI_GATEWAY_API_KEY || req.headers?.["x-vercel-oidc-token"] || process.env.VERCEL_OIDC_TOKEN || "";
}

// La misma muestra da siempre la misma petición: su frase se recuerda mientras viva la función.
const hostedCache = new Map();

async function askHosted(body, token, timeoutMs) {
  const key = `${hostedModel()} ${body.code}`;
  if (hostedCache.has(key)) return hostedCache.get(key);
  const response = await fetch(HOSTED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    // Al modelo solo le llegan el código de parcela y los conteos.
    body: JSON.stringify({
      model: hostedModel(),
      temperature: 0,
      max_tokens: 80,
      messages: [
        { role: "system", content: HOSTED_SYSTEM },
        { role: "user", content: describe(body) },
      ],
    }),
  });
  if (!response.ok) return null;
  const content = (await response.json()).choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;
  const text = plain(content.split("\n").find((line) => line.trim()) ?? "").replace(/^["']+|["']+$/g, "");
  if (isSentence(body.code, text) && numbersMatch(text, body)) {
    if (hostedCache.size >= 300) hostedCache.delete(hostedCache.keys().next().value);
    hostedCache.set(key, text);
  }
  return text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = readJson(req);
  if (!isSmsRequest(body)) return res.status(400).json({ error: "invalid request" });

  const deadline = Date.now() + BUDGET_MS;
  const left = () => deadline - Date.now();
  const token = hostedModel() === "off" ? "" : hostedToken(req);
  // `host` dice a la app dónde corre el modelo, para que lo rotule en pantalla.
  const writers = [
    process.env.GATEWAY_URL && { host: "laptop", ask: () => askGateway(body, Math.min(GATEWAY_TIMEOUT_MS, left())) },
    !process.env.GATEWAY_URL && process.env.OLLAMA_URL && { host: "laptop", ask: () => askLlm(body, left()) },
    token && { host: "cloud", ask: () => askHosted(body, token, left()) },
  ].filter(Boolean);

  for (const { host, ask } of writers) {
    if (left() < 500) break;
    try {
      const text = await ask();
      if (text && isSentence(body.code, text) && numbersMatch(text, body)) {
        return res.status(200).json({ text, source: "llm", host });
      }
    } catch {
      // Sin respuesta a tiempo: se prueba con el siguiente y, al final, la plantilla.
    }
  }
  return res.status(200).json({ text: templateSentence(body), source: "fallback" });
}
