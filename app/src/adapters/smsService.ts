// Cliente del servicio LLM de la laptop (FastAPI + Ollama): POST /api/sms.
// Es opcional: si no responde a tiempo o responde mal, el SMS lleva solo el código.

import { SmsRequest } from "../domain/sms";

export interface SmsResponse {
  text: string;
  source: "llm" | "fallback";
}

/** Apagado: la app no llama a la laptop y el SMS lleva solo el código. Poner en true cuando el servicio exista. */
export const SMS_SERVICE_ENABLED: boolean = false;
export const SMS_SERVICE_TIMEOUT_MS = 10_000;

/** `baseUrl` vacío = el mismo servidor que sirve la app. Devuelve null si no hay frase. */
export async function requestSentence(
  baseUrl: string,
  request: SmsRequest,
  timeoutMs = SMS_SERVICE_TIMEOUT_MS,
): Promise<SmsResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.trim().replace(/\/+$/, "")}/api/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Partial<SmsResponse>;
    if (typeof data.text !== "string" || !data.text.trim()) return null;
    return { text: data.text.trim(), source: data.source === "llm" ? "llm" : "fallback" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
