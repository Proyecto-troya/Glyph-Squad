// Cliente del servicio que redacta la frase para el técnico: POST /api/sms.
// En la laptop lo atiende el gateway (FastAPI + Ollama, carpeta gateway/ del repositorio); en el
// servidor que sirve la app, la función api/sms.js, con el mismo contrato.
// Es opcional: si no responde a tiempo o responde mal, el SMS lleva solo el código.

import { SmsRequest } from "../domain/sms";

export interface SmsResponse {
  text: string;
  /** "llm": la redactó el modelo y pasó la validación del servidor. "fallback": plantilla fija. */
  source: "llm" | "fallback";
}

/** Encendido: Enviar pide la frase al abrirse. Apagado, la app no llama a nadie y el SMS lleva solo el código. */
export const SMS_SERVICE_ENABLED: boolean = true;
export const SMS_SERVICE_TIMEOUT_MS = 10_000;

/** Dirección como la escribe una persona ("192.168.43.1:8000/") lista para añadirle la ruta. Vacío = este servidor. */
export function normalizeServiceUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  return !url || /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

/** `baseUrl` vacío = el mismo servidor que sirve la app. Devuelve null si no hay frase. */
export async function requestSentence(
  baseUrl: string,
  request: SmsRequest,
  timeoutMs = SMS_SERVICE_TIMEOUT_MS,
): Promise<SmsResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalizeServiceUrl(baseUrl)}/api/sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) {
      // Para quien depura: el gateway responde 422 si la petición no es la que espera.
      console.warn("El servicio no dio la frase:", response.status, await response.text());
      return null;
    }
    const data = (await response.json()) as Partial<SmsResponse>;
    if (typeof data.text !== "string" || !data.text.trim()) return null;
    return { text: data.text.trim(), source: data.source === "llm" ? "llm" : "fallback" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** El servidor (POST /api/send) envía el SMS al técnico. El número lo fija el servidor, no la app. */
export const SMS_SEND_ENABLED: boolean = true;

/** "simulated": el servidor no tiene proveedor de SMS configurado y no envió nada (modo demo). */
export type SendStatus = "queued" | "simulated";

/**
 * Lo envía siempre el servidor que sirve la app, que es el que tiene el proveedor de SMS y el
 * número del técnico; la laptop solo redacta la frase. Devuelve null si no responde o lo rechaza.
 */
export async function sendSms(code: string, text: string | null): Promise<SendStatus | null> {
  try {
    const response = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(text ? { code, text } : { code }),
      signal: AbortSignal.timeout(SMS_SERVICE_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Para quien depura: el motivo (credenciales, número, proveedor) va en la respuesta.
      console.warn("El servidor no envió el SMS:", await response.text());
      return null;
    }
    const status = ((await response.json()) as { status?: string }).status;
    return status === "queued" || status === "simulated" ? status : null;
  } catch {
    return null;
  }
}
