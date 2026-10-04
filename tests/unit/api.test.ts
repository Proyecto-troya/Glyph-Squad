import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCounts } from "../../app/src/domain/sample";
import { buildSmsRequest, fixedSentence } from "../../app/src/domain/sms";

// Las funciones de /api son JavaScript sin tipos: se cargan por ruta y se llaman como las llama Vercel.
const handlerOf = async (name: string) => (await import(/* @vite-ignore */ `../../api/${name}.js`)).default;

async function call(name: string, body: unknown) {
  const res = {
    code: 0,
    data: null as any,
    status(code: number) {
      this.code = code;
      return this;
    },
    json(data: unknown) {
      this.data = data;
      return this;
    },
  };
  await (await handlerOf(name))({ method: "POST", body }, res);
  return res;
}

const request = buildSmsRequest("P114", { ...emptyCounts(), total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 }, true);
const AI = "Hay senales de roya en 7 de 30 hojas, cercospora en 1 y 2 dudosas.";
const GATEWAY = "http://192.168.43.57:8000";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

/** Sustituye a fetch dentro de la función: aquí nunca se llama a un servidor de verdad. */
function stubFetch(reply: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => reply());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  // Sin proveedor de SMS ni LLM, pase lo que pase con las variables de quien corre las pruebas.
  for (const name of [
    "GATEWAY_URL",
    "GATEWAY_TOKEN",
    "OLLAMA_URL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_API_KEY",
    "TWILIO_API_SECRET",
    "TWILIO_FROM",
    "SMS_GATEWAY_USER",
    "SMS_GATEWAY_PASSWORD",
    "TECH_NUMBER",
  ]) {
    vi.stubEnv(name, "");
  }
  stubFetch(() => Promise.reject(new Error("no debería salir a la red")));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/sms en el servidor de la app", () => {
  it("sin LLM responde con la plantilla, la misma frase fija que arma la app", async () => {
    const samples = [
      request,
      buildSmsRequest("P027", { ...emptyCounts(), total: 30, sana: 30 }, false),
      buildSmsRequest("P088", { ...emptyCounts(), total: 30, sana: 20, phoma: 1, duda: 9 }, null),
      buildSmsRequest("P203", { ...emptyCounts(), total: 28, sana: 10, roya: 15, minador: 3 }, true),
    ];
    for (const sample of samples) {
      const res = await call("sms", sample);
      expect(res.code).toBe(200);
      expect(res.data).toEqual({ text: fixedSentence(sample), source: "fallback" });
    }
  });

  it("con GATEWAY_URL pide la frase al gateway de la laptop", async () => {
    vi.stubEnv("GATEWAY_URL", `${GATEWAY}/`);
    const fetchMock = stubFetch(() => json({ text: AI, source: "llm", reason: null }));
    const res = await call("sms", { ...request, extra: "no se reenvía" });

    expect(res.data).toEqual({ text: AI, source: "llm" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GATEWAY}/api/sms`);
    expect(new Headers(init.headers).has("X-Gateway-Token")).toBe(false);
    // El gateway rechaza cualquier campo de más: le llega exactamente la petición de la app.
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("el token del gateway lo pone el servidor, no el teléfono", async () => {
    vi.stubEnv("GATEWAY_URL", GATEWAY);
    vi.stubEnv("GATEWAY_TOKEN", "secreto-de-prueba");
    const fetchMock = stubFetch(() => json({ text: AI, source: "llm", reason: null }));
    await call("sms", request);
    expect(new Headers(fetchMock.mock.calls[0][1].headers).get("X-Gateway-Token")).toBe("secreto-de-prueba");
  });

  it("si la laptop no da una frase del modelo que valga, responde con la plantilla", async () => {
    vi.stubEnv("GATEWAY_URL", GATEWAY);
    const expected = { text: fixedSentence(request), source: "fallback" };

    stubFetch(() => json({ text: "Parcela P114: lo que sea.", source: "fallback", reason: "timeout" }));
    expect((await call("sms", request)).data).toEqual(expected);

    stubFetch(() => Promise.reject(new TypeError("fetch failed")));
    expect((await call("sms", request)).data).toEqual(expected);

    stubFetch(() => json({ detail: "missing or invalid gateway token" }, 401));
    expect((await call("sms", request)).data).toEqual(expected);

    // Una frase del modelo con una cifra inventada no pasa.
    stubFetch(() => json({ text: "Hay senales de roya en 9 de 30 hojas, cercospora en 1 y 2 dudosas.", source: "llm" }));
    expect((await call("sms", request)).data).toEqual(expected);
  });

  it("rechaza una petición mal formada sin preguntar a nadie", async () => {
    vi.stubEnv("GATEWAY_URL", GATEWAY);
    const fetchMock = stubFetch(() => json({ text: AI, source: "llm" }));
    expect((await call("sms", { ...request, plot: "p114" })).code).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/send con dos frases", () => {
  const fixed = fixedSentence(request);

  it("arma el SMS con el código, la frase fija y el mensaje de la IA", async () => {
    const res = await call("send", { code: request.code, text: fixed, ai: AI });
    expect(res.code).toBe(200);
    expect(res.data).toEqual({ status: "simulated", message: `${request.code}\n${fixed}\n${AI}` });
  });

  it("sin mensaje de la IA sigue saliendo el código con la frase fija", async () => {
    expect((await call("send", { code: request.code, text: fixed })).data.message).toBe(`${request.code}\n${fixed}`);
    expect((await call("send", { code: request.code })).data.message).toBe(request.code);
  });

  it("no envía un mensaje de la IA que rompa las reglas del SMS", async () => {
    for (const ai of ["Aplicar fungicida en dosis alta.", "Ver LP P999 30H", "Plantas de más de 15 años.", "x".repeat(160)]) {
      const res = await call("send", { code: request.code, text: fixed, ai });
      expect(res.code, ai).toBe(400);
      expect(res.data).toEqual({ error: "invalid ai" });
    }
  });
});
