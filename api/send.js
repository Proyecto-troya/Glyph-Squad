// POST /api/send — envía de verdad el SMS al técnico.
// El destinatario lo fija el servidor (TECH_NUMBER), nunca la app, y el texto tiene
// que ser un código LP válido: así el servicio no sirve para mandar SMS arbitrarios.
// Debajo del código pueden ir dos frases, cada una validada: la fija y el mensaje del modelo.
//
// Quién envía depende de las variables de entorno (en local, del archivo .env):
//   - Twilio: TWILIO_ACCOUNT_SID + TWILIO_FROM y, para autenticarse,
//     TWILIO_AUTH_TOKEN o bien TWILIO_API_KEY + TWILIO_API_SECRET.
//   - SMS_GATEWAY_USER + SMS_GATEWAY_PASSWORD: un teléfono Android con la app
//     "SMS Gateway for Android" en modo Cloud Server; el SMS sale por su SIM.
//   - Ninguna: responde "simulated" y no envía nada (modo demo).

import { isCode, isSentence, readJson } from "./_lib.js";

const PROVIDER_TIMEOUT_MS = 8_000;
const basic = (user, password) => "Basic " + Buffer.from(`${user}:${password}`).toString("base64");

async function viaAndroidGateway(env, to, message) {
  const base = (env.SMS_GATEWAY_URL || "https://api.sms-gate.app/3rdparty/v1").replace(/\/+$/, "");
  const post = (path) =>
    fetch(base + path, {
      method: "POST",
      headers: {
        Authorization: basic(env.SMS_GATEWAY_USER, env.SMS_GATEWAY_PASSWORD),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textMessage: { text: message }, phoneNumbers: [to] }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  let response = await post("/messages");
  // Los servidores antiguos solo conocen /message.
  if (response.status === 404) response = await post("/message");
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, id: result.id, error: result.message };
}

async function viaTwilio(env, to, message) {
  // Con API Key (SK...) se entra con la clave y su secreto; si no, con el Auth Token de la cuenta.
  const [user, password] =
    env.TWILIO_API_KEY && env.TWILIO_API_SECRET
      ? [env.TWILIO_API_KEY, env.TWILIO_API_SECRET]
      : [env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN];
  // TWILIO_FROM es un número de Twilio (+1...) o un Messaging Service (MG...).
  const sender = env.TWILIO_FROM.startsWith("MG") ? { MessagingServiceSid: env.TWILIO_FROM } : { From: env.TWILIO_FROM };
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: basic(user, password), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, ...sender, Body: message }).toString(),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, id: result.sid, error: result.message };
}

/** Devuelve null si no hay ningún proveedor configurado, o lo que le falta si está a medias. */
function chooseProvider(env) {
  if (env.SMS_GATEWAY_USER && env.SMS_GATEWAY_PASSWORD) return { name: "android", send: viaAndroidGateway };
  const twilioKeys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_API_KEY", "TWILIO_API_SECRET", "TWILIO_FROM"];
  if (!twilioKeys.some((key) => env[key])) return null;
  const missing = [
    !env.TWILIO_ACCOUNT_SID && "TWILIO_ACCOUNT_SID",
    !(env.TWILIO_AUTH_TOKEN || (env.TWILIO_API_KEY && env.TWILIO_API_SECRET)) &&
      "TWILIO_AUTH_TOKEN (or TWILIO_API_KEY + TWILIO_API_SECRET)",
    !env.TWILIO_FROM && "TWILIO_FROM",
  ].filter(Boolean);
  return { name: "twilio", send: viaTwilio, missing };
}

function fail(res, http, provider, error) {
  // Queda en los registros del servidor; nunca incluye credenciales.
  console.error(`SMS no enviado (${provider.name}): ${error}`);
  return res.status(http).json({ status: "failed", provider: provider.name, error });
}

export default async function handler(req, res) {
  const provider = chooseProvider(process.env);
  const to = process.env.TECH_NUMBER ?? "";
  const problem = !provider
    ? null
    : provider.missing?.length
      ? `missing ${provider.missing.join(", ")}`
      : /^\+\d{8,15}$/.test(to)
        ? null
        : "TECH_NUMBER must be set, like +50370000000";

  // GET solo dice si hay un proveedor configurado: no envía nada, no revela credenciales
  // y no comprueba que el proveedor las acepte.
  if (req.method === "GET") {
    const status = !provider ? "simulated" : problem ? "misconfigured" : "configured";
    return res.status(200).json({ status, provider: provider?.name, problem: problem ?? undefined });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });

  const body = readJson(req);
  if (!body || !isCode(body.code)) return res.status(400).json({ error: "invalid code" });
  if (body.text != null && !isSentence(body.code, body.text)) return res.status(400).json({ error: "invalid text" });
  if (body.ai != null && !isSentence(body.code, body.ai)) return res.status(400).json({ error: "invalid ai" });
  // Debajo del código, una frase por línea: la fija (text) y el mensaje del modelo (ai).
  const message = [body.code, body.text, body.ai].filter(Boolean).join("\n");

  if (!provider) return res.status(200).json({ status: "simulated", message });
  if (problem) return fail(res, 500, provider, problem);

  try {
    const result = await provider.send(process.env, to, message);
    if (!result.ok) return fail(res, 502, provider, result.error ?? "provider error");
    // El proveedor aceptó el mensaje; la entrega al teléfono del técnico ocurre después.
    return res.status(200).json({ status: "queued", provider: provider.name, id: result.id });
  } catch {
    return fail(res, 502, provider, "provider unreachable");
  }
}
