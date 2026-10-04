import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLocalAddress,
  normalizeServiceUrl,
  requestAiSentence,
  requestSentence,
  sendSms,
} from "../../app/src/adapters/smsService";
import { emptyCounts } from "../../app/src/domain/sample";
import { buildSmsRequest, fixedSentence } from "../../app/src/domain/sms";

const request = buildSmsRequest("P114", { ...emptyCounts(), total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 }, true);
const SENTENCE = "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas. Plantas de mas de 15 anos.";
const LAPTOP = "http://192.168.43.57:8000";

/** Sustituye a fetch: responde lo que se le diga y guarda la llamada. */
function stubFetch(reply: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string, _init: RequestInit) => reply(url));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const llm = () => json({ text: SENTENCE, source: "llm", reason: null });
const template = () => json({ text: fixedSentence(request), source: "fallback", reason: "upstream:UPSTREAM_UNAVAILABLE" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("servicio de la frase (POST /api/sms)", () => {
  it("pregunta a la laptop con los campos exactos que acepta su gateway", async () => {
    const fetchMock = stubFetch(llm);
    await requestSentence(`${LAPTOP}/`, request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${LAPTOP}/api/sms`);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    // El gateway rechaza con 422 cualquier campo de más (gateway/src/gateway/sms/models.py).
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(["code", "counts", "flagUnsure", "over15", "plot"]);
    expect(Object.keys(body.counts).sort()).toEqual(["cercospora", "duda", "minador", "phoma", "roya", "sana", "total"]);
    expect(body).toMatchObject({ plot: "P114", over15: true, flagUnsure: false, code: "LP P114 30H ROYA7 CER1 DUDA2 E15+" });
  });

  it("sin dirección pregunta al servidor que sirve la app", async () => {
    const fetchMock = stubFetch(template);
    await requestSentence("", request);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sms");
  });

  it("distingue la frase del modelo de la plantilla fija", async () => {
    stubFetch(() => json({ text: ` ${SENTENCE} `, source: "llm", reason: null }));
    expect(await requestSentence("", request)).toEqual({ text: SENTENCE, source: "llm" });

    stubFetch(template);
    expect(await requestSentence("", request)).toEqual({ text: fixedSentence(request), source: "fallback" });
  });

  it("sin respuesta útil no hay frase", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch(() => json({ detail: "total must equal the sum of the counts" }, 422));
    expect(await requestSentence("", request)).toBeNull();

    stubFetch(() => json({ text: "  ", source: "llm" }));
    expect(await requestSentence("", request)).toBeNull();

    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await requestSentence("", request)).toBeNull();
  });

  it("no espera más del tiempo límite", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted")))),
    );
    expect(await requestSentence("", request, 20)).toBeNull();
  });
});

describe("mensaje de la IA", () => {
  it("sin laptop guardada pregunta solo al servidor que sirve la app", async () => {
    const fetchMock = stubFetch(llm);
    expect(await requestAiSentence("", request)).toEqual({ text: SENTENCE, host: "laptop" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/sms"]);
  });

  it("con laptop guardada le pregunta a ella y no molesta al servidor", async () => {
    const fetchMock = stubFetch(llm);
    expect(await requestAiSentence(LAPTOP, request)).toEqual({ text: SENTENCE, host: "laptop" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${LAPTOP}/api/sms`]);
  });

  it("si la laptop no da una frase del modelo, pregunta al servidor", async () => {
    let fetchMock = stubFetch((url) => (url.startsWith(LAPTOP) ? template() : llm()));
    expect(await requestAiSentence(LAPTOP, request)).toEqual({ text: SENTENCE, host: "laptop" });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([`${LAPTOP}/api/sms`, "/api/sms"]);

    fetchMock = stubFetch((url) => (url.startsWith(LAPTOP) ? Promise.reject(new TypeError("Failed to fetch")) : llm()));
    expect(await requestAiSentence(LAPTOP, request)).toEqual({ text: SENTENCE, host: "laptop" });
  });

  it("recuerda si el servidor lo redactó con un modelo de internet", async () => {
    stubFetch(() => json({ text: SENTENCE, source: "llm", host: "cloud" }));
    expect(await requestAiSentence("", request)).toEqual({ text: SENTENCE, host: "cloud" });
  });

  it("la plantilla de un servidor no es un mensaje de la IA", async () => {
    stubFetch(template);
    expect(await requestAiSentence(LAPTOP, request)).toBeNull();
    expect(await requestAiSentence("", request)).toBeNull();
  });
});

describe("dirección de la laptop", () => {
  it("completa la dirección escrita a mano", () => {
    expect(normalizeServiceUrl("")).toBe("");
    expect(normalizeServiceUrl("  ")).toBe("");
    expect(normalizeServiceUrl("192.168.43.1:8000")).toBe("http://192.168.43.1:8000");
    expect(normalizeServiceUrl(" http://192.168.43.1:8000// ")).toBe("http://192.168.43.1:8000");
    expect(normalizeServiceUrl("HTTPS://192.168.43.1:8000")).toBe("HTTPS://192.168.43.1:8000");
  });

  it("solo vale una dirección IP de la red local", () => {
    for (const ok of ["http://192.168.43.1:8000", "https://10.0.0.7:8000", "http://172.16.5.4", "http://172.31.255.1:8000", "http://127.0.0.1:8000"]) {
      expect(isLocalAddress(ok), ok).toBe(true);
    }
    for (const bad of [
      "",
      "192.168.43.1:8000",
      "http://example.com",
      "http://192.168.43.1.example.com:8000",
      "http://8.8.8.8:8000",
      "http://172.32.0.1:8000",
      "http://1192.168.1.1",
      "ftp://192.168.43.1",
    ]) {
      expect(isLocalAddress(bad), bad).toBe(false);
    }
  });
});

describe("envío del SMS (POST /api/send)", () => {
  it("va al servidor que sirve la app, nunca a la laptop", async () => {
    const fetchMock = stubFetch(() => json({ status: "simulated" }));
    expect(await sendSms(request.code, SENTENCE)).toBe("simulated");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/send");
    expect(JSON.parse(init.body as string)).toEqual({ code: request.code, text: SENTENCE });
  });

  it("manda la frase fija y el mensaje de la IA por separado", async () => {
    const fetchMock = stubFetch(() => json({ status: "queued" }));
    expect(await sendSms(request.code, fixedSentence(request), SENTENCE)).toBe("queued");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      code: request.code,
      text: fixedSentence(request),
      ai: SENTENCE,
    });
  });

  it("sin frases envía solo el código", async () => {
    const fetchMock = stubFetch(() => json({ status: "queued" }));
    expect(await sendSms(request.code, null)).toBe("queued");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ code: request.code });
  });
});
