// POST /api/send — envía de verdad el SMS al técnico.
// El destinatario lo fija el servidor (TECH_NUMBER), nunca la app, y el texto tiene
// que ser un código LP válido: así el servicio no sirve para mandar SMS arbitrarios.
//
// Quién envía depende de las variables de entorno:
//   - SMS_GATEWAY_USER + SMS_GATEWAY_PASSWORD: un teléfono Android con la app
//     "SMS Gateway for Android" en modo Cloud Server; el SMS sale por su SIM.
//   - TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM: Twilio.
//   - Ninguna: responde "simulated" y no envía nada (modo demo).

import { isCode, isSentence, readJson } from "./_lib.js";

const PROVIDER_TIMEOUT_MS = 8_000;
const basic = (user, password) => "Basic " + Buffer.from(`${user}:${password}`).toString("base64");

async function viaAndroidGateway(env, to, message) {
  const base = (env.SMS_GATEWAY_URL ?? "https://api.sms-gate.app/3rdparty/v1").replace(/\/+$/, "");
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
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: basic(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: message }).toString(),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const result = await response.json().catch(() => ({}));
  return { ok: response.ok, id: result.sid, error: result.message };
}

function chooseProvider(env) {
  if (env.SMS_GATEWAY_USER && env.SMS_GATEWAY_PASSWORD) return { name: "android", send: viaAndroidGateway };
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) return { name: "twilio", send: viaTwilio };
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = readJson(req);
  if (!body || !isCode(body.code)) return res.status(400).json({ error: "invalid code" });
  if (body.text != null && !isSentence(body.code, body.text)) return res.status(400).json({ error: "invalid text" });
  const message = body.text ? `${body.code}\n${body.text}` : body.code;

  const provider = chooseProvider(process.env);
  if (!provider) return res.status(200).json({ status: "simulated", message });

  const to = process.env.TECH_NUMBER ?? "";
  if (!/^\+\d{8,15}$/.test(to)) {
    return res.status(500).json({ status: "failed", error: "TECH_NUMBER must be set, like +50370000000" });
  }

  try {
    const result = await provider.send(process.env, to, message);
    if (!result.ok) {
      return res.status(502).json({ status: "failed", provider: provider.name, error: result.error ?? "provider error" });
    }
    // El proveedor aceptó el mensaje; la entrega al teléfono del técnico ocurre después.
    return res.status(200).json({ status: "queued", provider: provider.name, id: result.id });
  } catch {
    return res.status(502).json({ status: "failed", provider: provider.name, error: "provider unreachable" });
  }
}
