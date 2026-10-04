import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCounts } from "../../app/src/domain/sample";
import { buildSmsRequest, fixedSentence } from "../../app/src/domain/sms";

// Las funciones de /api son JavaScript sin tipos: se cargan por ruta y se llaman como las llama Vercel.
const handlerOf = async (name: string) => (await import(/* @vite-ignore */ `../../api/${name}.js`)).default;

async function call(name: string, body: unknown, headers: Record<string, string> = {}) {
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
  await (await handlerOf(name))({ method: "POST", body, headers }, res);
  return res;
}

const request = buildSmsRequest("P114", { ...emptyCounts(), total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 }, true);
const AI = "Hay senales de roya en 7 de 30 hojas, cercospora en 1 y 2 dudosas.";
const GATEWAY = "http://192.168.43.57:8000";
const HOSTED = "https://ai-gateway.vercel.sh/v1/chat/completions";
/** Así llega en Vercel la credencial de la plataforma con cada petición. */
const OIDC = { "x-vercel-oidc-token": "token-de-prueba" };
const hosted = (content: string) => json({ choices: [{ message: { role: "assistant", content } }] });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

/** Sustituye a fetch dentro de la función: aquí nunca se llama a un servidor de verdad. */
function stubFetch(reply: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => reply());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  // Cada prueba carga la función de nuevo: así no hereda las frases recordadas por otra.
  vi.resetModules();
  // Sin proveedor de SMS ni LLM, pase lo que pase con las variables de quien corre las pruebas.
  for (const name of [
    "GATEWAY_URL",
    "GATEWAY_TOKEN",
    "OLLAMA_URL",
    "AI_GATEWAY_API_KEY",
    "AI_GATEWAY_MODEL",
    "VERCEL_OIDC_TOKEN",
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

    expect(res.data).toEqual({ text: AI, source: "llm", host: "laptop" });
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

describe("POST /api/sms con el modelo alojado", () => {
  it("desplegado en Vercel y sin laptop, la redacta el modelo alojado solo con el código y los conteos", async () => {
    const fetchMock = stubFetch(() => hosted(AI));
    const res = await call("sms", request, OIDC);

    expect(res.data).toEqual({ text: AI, source: "llm", host: "cloud" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(HOSTED);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer token-de-prueba");
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({ model: "meta/llama-3.1-8b", temperature: 0, max_tokens: 80 });
    expect(sent.messages[1].content.split("\n")).toEqual([
      "Datos: parcela P114; 30 hojas; roya 7; cercospora 1; dudosas 2; plantas de mas de 15 anos.",
      "Numeros obligatorios: 30, 7, 2, 1",
      "Maximo 110 caracteres.",
    ]);
  });

  it("limpia las tildes y descarta la frase que inventa cifras o da consejos", async () => {
    stubFetch(() => hosted('"Parcela P114: 7 de 30 hojas con señales de roya, 1 de cercospora y 2 dudosas."'));
    expect((await call("sms", request, OIDC)).data).toEqual({
      text: "Parcela P114: 7 de 30 hojas con senales de roya, 1 de cercospora y 2 dudosas.",
      source: "llm",
      host: "cloud",
    });

    const template = { text: fixedSentence(request), source: "fallback" };
    vi.resetModules();
    stubFetch(() => hosted("Parcela P114: 8 de 30 hojas con senales de roya, 1 de cercospora y 2 dudosas."));
    expect((await call("sms", request, OIDC)).data).toEqual(template);

    vi.resetModules();
    stubFetch(() => hosted("Hay roya en 7 de 30 hojas, 1 cercospora y 2 dudosas: aplicar fungicida."));
    expect((await call("sms", request, OIDC)).data).toEqual(template);

    vi.resetModules();
    stubFetch(() => json({ error: { message: "insufficient credits" } }, 402));
    expect((await call("sms", request, OIDC)).data).toEqual(template);
  });

  it("sin credencial, o con AI_GATEWAY_MODEL=off, no llama a ningún modelo alojado", async () => {
    const fetchMock = stubFetch(() => hosted(AI));
    expect((await call("sms", request)).data.source).toBe("fallback");
    vi.stubEnv("AI_GATEWAY_MODEL", "off");
    expect((await call("sms", request, OIDC)).data.source).toBe("fallback");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("la laptop va primero; si no da una frase de su modelo, escribe el alojado", async () => {
    vi.stubEnv("GATEWAY_URL", GATEWAY);
    const fetchMock = stubFetch(() => json({ text: AI, source: "llm", reason: null }));
    expect((await call("sms", request, OIDC)).data).toEqual({ text: AI, source: "llm", host: "laptop" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${GATEWAY}/api/sms`]);

    const replies = [() => Promise.reject(new TypeError("fetch failed")), () => hosted(AI)];
    const second = vi.fn(async (_url: string, _init: RequestInit) => replies.shift()!());
    vi.stubGlobal("fetch", second);
    expect((await call("sms", request, OIDC)).data).toEqual({ text: AI, source: "llm", host: "cloud" });
    expect(second.mock.calls.map(([url]) => url)).toEqual([`${GATEWAY}/api/sms`, HOSTED]);
  });

  it("recuerda la frase de una muestra y no vuelve a preguntar por ella", async () => {
    const fetchMock = stubFetch(() => hosted(AI));
    const handler = await handlerOf("sms");
    for (let i = 0; i < 3; i++) {
      const res = {
        data: null as any,
        status() {
          return this;
        },
        json(data: unknown) {
          this.data = data;
          return this;
        },
      };
      await handler({ method: "POST", body: request, headers: OIDC }, res);
      expect(res.data.text).toBe(AI);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
