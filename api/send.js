// POST /api/send — envía de verdad el SMS al técnico (Twilio).
// El destinatario lo fija el servidor (TECH_NUMBER), nunca la app, y el texto tiene
// que ser un código LP válido: así el servicio no sirve para mandar SMS arbitrarios.
// Sin credenciales responde "simulated" y no envía nada (modo demo).

import { isCode, isSentence, readJson } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = readJson(req);
  if (!body || !isCode(body.code)) return res.status(400).json({ error: "invalid code" });
  if (body.text != null && !isSentence(body.code, body.text)) return res.status(400).json({ error: "invalid text" });
  const message = body.text ? `${body.code}\n${body.text}` : body.code;

  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from, TECH_NUMBER: to } = process.env;
  if (!sid || !token || !from || !to) {
    return res.status(200).json({ status: "simulated", message });
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: message }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return res.status(502).json({ status: "failed", error: result.message ?? "provider error" });
  return res.status(200).json({ status: "sent", id: result.sid });
}
