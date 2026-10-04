import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeServiceUrl, requestSentence, sendSms } from "../../app/src/adapters/smsService";
import { emptyCounts } from "../../app/src/domain/sample";
import { buildSmsRequest } from "../../app/src/domain/sms";

const request = buildSmsRequest("P114", { ...emptyCounts(), total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 }, true);
const SENTENCE = "Parcela P114: 7 de 30 hojas con roya, 1 con cercospora, 2 dudosas. Plantas de mas de 15 anos.";

/** Sustituye a fetch: responde lo que se le diga y guarda la llamada. */
function stubFetch(reply: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => reply());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("frase para el técnico (POST /api/sms)", () => {
  it("la pide a la laptop con los campos exactos que acepta su gateway", async () => {
    const fetchMock = stubFetch(() => json({ text: SENTENCE, source: "llm", reason: null }));
    await requestSentence("http://192.168.43.1:8000/", request);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://192.168.43.1:8000/api/sms");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    // El gateway rechaza con 422 cualquier campo de más (gateway/src/gateway/sms/models.py).
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(["code", "counts", "flagUnsure", "over15", "plot"]);
    expect(Object.keys(body.counts).sort()).toEqual(["cercospora", "duda", "minador", "phoma", "roya", "sana", "total"]);
    expect(body).toMatchObject({ plot: "P114", over15: true, flagUnsure: false, code: "LP P114 30H ROYA7 CER1 DUDA2 E15+" });
  });

  it("sin dirección la pide al servidor que sirve la app", async () => {
    const fetchMock = stubFetch(() => json({ text: SENTENCE, source: "fallback" }));
    await requestSentence("", request);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/sms");
  });

  it("distingue la frase del modelo de la plantilla fija", async () => {
    stubFetch(() => json({ text: ` ${SENTENCE} `, source: "llm", reason: null }));
    expect(await requestSentence("", request)).toEqual({ text: SENTENCE, source: "llm" });

    stubFetch(() => json({ text: SENTENCE, source: "fallback", reason: "upstream:UPSTREAM_UNAVAILABLE" }));
    expect(await requestSentence("", request)).toEqual({ text: SENTENCE, source: "fallback" });
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

  it("completa la dirección escrita a mano", () => {
    expect(normalizeServiceUrl("")).toBe("");
    expect(normalizeServiceUrl("  ")).toBe("");
    expect(normalizeServiceUrl("192.168.43.1:8000")).toBe("http://192.168.43.1:8000");
    expect(normalizeServiceUrl(" http://192.168.43.1:8000// ")).toBe("http://192.168.43.1:8000");
    expect(normalizeServiceUrl("HTTPS://192.168.43.1:8000")).toBe("HTTPS://192.168.43.1:8000");
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

  it("sin frase envía solo el código", async () => {
    const fetchMock = stubFetch(() => json({ status: "queued" }));
    expect(await sendSms(request.code, null)).toBe("queued");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ code: request.code });
  });
});
