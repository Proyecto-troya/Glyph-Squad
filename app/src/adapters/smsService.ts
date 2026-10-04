// Cliente del servicio que redacta el mensaje de la IA para el técnico: POST /api/sms.
// En la laptop lo atiende el gateway (FastAPI + Ollama, carpeta gateway/ del repositorio); en el
// servidor que sirve la app, la función api/sms.js, con el mismo contrato.
// Es opcional: si nadie responde a tiempo, el SMS lleva el código y la frase fija.

import { SmsRequest } from "../domain/sms";

/** Dónde corre el modelo: en la laptop del equipo o en un servidor de internet. */
export type AiHost = "laptop" | "cloud";

export interface SmsResponse {
  text: string;
  /** "llm": la redactó el modelo y pasó la validación del servidor. "fallback": plantilla fija. */
  source: "llm" | "fallback";
  /** Lo dice el servidor que sirve la app; la laptop no lo dice porque su modelo corre en ella. */
  host?: AiHost;
}

/** El mensaje de la IA y dónde se redactó, para rotularlo en pantalla. */
export interface AiMessage {
  text: string;
  host: AiHost;
}

/** Encendido: Enviar pide el mensaje de la IA al abrirse. Apagado, la app no llama a nadie. */
export const SMS_SERVICE_ENABLED: boolean = true;
export const SMS_SERVICE_TIMEOUT_MS = 10_000;

/** Dirección como la escribe una persona ("192.168.43.1:8000/") lista para añadirle la ruta. Vacío = este servidor. */
export function normalizeServiceUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  return !url || /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

const LOCAL_HOST = /^(127\.\d{1,3}|10\.\d{1,3}|192\.168|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}$/;

/**
 * La laptop está siempre en la red local y se nombra por su IP. Solo esas direcciones valen:
 * así un enlace no puede apuntar la app a un servidor de fuera que escriba en el SMS.
 */
export function isLocalAddress(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return /^https?:$/.test(protocol) && LOCAL_HOST.test(hostname);
  } catch {
    return false;
  }
}

/** `baseUrl` vacío = el mismo servidor que sirve la app. Devuelve null si no hay respuesta útil. */
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
    return {
      text: data.text.trim(),
      source: data.source === "llm" ? "llm" : "fallback",
      ...(data.host === "cloud" || data.host === "laptop" ? { host: data.host } : {}),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * El mensaje que redacta el modelo, o null si no lo hay. Se pregunta primero a la laptop
 * guardada en el teléfono y, si no da una frase del modelo, al servidor que sirve la app.
 * Las plantillas de los servidores no cuentan: la frase fija ya la arma la app.
 */
export async function requestAiSentence(laptopUrl: string, request: SmsRequest): Promise<AiMessage | null> {
  for (const baseUrl of laptopUrl ? [laptopUrl, ""] : [""]) {
    const response = await requestSentence(baseUrl, request);
    if (response?.source === "llm") return { text: response.text, host: response.host ?? "laptop" };
  }
  return null;
}

/** El servidor (POST /api/send) envía el SMS al técnico. El número lo fija el servidor, no la app. */
export const SMS_SEND_ENABLED: boolean = true;

/** "simulated": el servidor no tiene proveedor de SMS configurado y no envió nada (modo demo). */
export type SendStatus = "queued" | "simulated";

/**
 * Lo envía siempre el servidor que sirve la app, que es el que tiene el proveedor de SMS y el
 * número del técnico; la laptop solo redacta. `text` es la frase fija y `ai` el mensaje del
 * modelo: van debajo del código, una por línea. Devuelve null si no responde o lo rechaza.
 */
export async function sendSms(code: string, text: string | null, ai: string | null = null): Promise<SendStatus | null> {
  try {
    const response = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, ...(text ? { text } : {}), ...(ai ? { ai } : {}) }),
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
