import { describe, expect, it } from "vitest";
import { Counts, emptyCounts } from "../../app/src/domain/sample";
import {
  buildSmsRequest,
  codeParts,
  composeSms,
  decodeSms,
  encodeSms,
  fixedSentence,
  parseCodes,
  SMS_MAX_LENGTH,
  smsSentences,
} from "../../app/src/domain/sms";

const counts = (partial: Partial<Counts>): Counts => ({ ...emptyCounts(), ...partial });

describe("código SMS", () => {
  it("escribe el ejemplo del plan", () => {
    const c = counts({ total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 });
    expect(encodeSms("P114", c, true)).toBe("LP P114 30H ROYA7 CER1 DUDA2 E15+");
  });

  it("omite las clases en 0 y E15+ si no dijo que sí", () => {
    expect(encodeSms("P027", counts({ total: 30, sana: 30 }), false)).toBe("LP P027 30H");
    expect(encodeSms("P027", counts({ total: 30, sana: 30 }), null)).toBe("LP P027 30H");
  });

  it("ida y vuelta para todas las combinaciones de clases", () => {
    for (let mask = 0; mask < 32; mask++) {
      const c = counts({
        roya: mask & 1 ? 3 : 0,
        minador: mask & 2 ? 2 : 0,
        cercospora: mask & 4 ? 4 : 0,
        phoma: mask & 8 ? 1 : 0,
        duda: mask & 16 ? 5 : 0,
      });
      c.total = 30;
      c.sana = 30 - c.roya - c.minador - c.cercospora - c.phoma - c.duda;
      for (const over15 of [true, false]) {
        const text = encodeSms("P9", c, over15);
        expect(text.length).toBeLessThan(SMS_MAX_LENGTH);
        expect(decodeSms(text)).toEqual({ plot: "P9", counts: c, over15 });
      }
    }
  });

  it("rechaza códigos mal formados", () => {
    for (const bad of [
      "",
      "hola",
      "LP P114",
      "LP P114 30",
      "LP P114 0H",
      "LP P114 30H ROYA40",
      "LP P114 30H ROYA7 ROYA2",
      "LP P114 30H TIZON3",
      "LP P114 30H ROYA0",
    ]) {
      expect(decodeSms(bad), bad).toBeNull();
    }
  });

  it("explica cada pieza del código", () => {
    expect(codeParts("LP P114 28H ROYA7 DUDA2 E15+")).toEqual([
      { text: "LP", kind: "app" },
      { text: "P114", kind: "plot" },
      { text: "28H", kind: "total" },
      { text: "ROYA7", kind: "count", label: "roya", n: 7 },
      { text: "DUDA2", kind: "count", label: "duda", n: 2 },
      { text: "E15+", kind: "over15" },
    ]);
  });

  it("separa lo pegado en códigos y líneas que no se entienden", () => {
    const { payloads, invalid } = parseCodes("buenos días\nlp p027 30h\n\n12:40 LP P203 28H ROYA15 MIN3");
    expect(payloads.map((p) => p.plot)).toEqual(["P027", "P203"]);
    expect(invalid).toEqual(["buenos días"]);
  });

  it("la lista del técnico se salta la frase que sigue a cada código", () => {
    const sms = composeSms("LP P114 30H ROYA7", "Parcela P114: 7 de 30 hojas con roya.");
    const { payloads, invalid } = parseCodes(`${sms}\nLP P027 30H\nSin hojas enfermas.\notra cosa`);
    expect(payloads.map((p) => p.plot)).toEqual(["P114", "P027"]);
    expect(invalid).toEqual(["otra cosa"]);
  });
});

describe("SMS con la frase del LLM", () => {
  const code = "LP P114 30H ROYA7 CER1 DUDA2 E15+";

  it("arma la petición al servicio solo con lo que ya va en el código", () => {
    const c = counts({ total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 });
    expect(buildSmsRequest("P114", c, true)).toEqual({ plot: "P114", counts: c, over15: true, flagUnsure: false, code });
    expect(buildSmsRequest("P114", c, null).over15).toBe(false);
  });

  it("pone la frase debajo del código", () => {
    expect(composeSms(code, " Parcela P114: 7 de 30 hojas con roya. ")).toBe(
      `${code}\nParcela P114: 7 de 30 hojas con roya.`,
    );
  });

  it("sin frase válida sale solo el código", () => {
    expect(composeSms(code, null)).toBe(code);
    expect(composeSms(code, "")).toBe(code);
    expect(composeSms(code, "x".repeat(SMS_MAX_LENGTH))).toBe(code);
    expect(composeSms(code, "Plantas de más de 15 años.")).toBe(code);
    expect(composeSms(code, "dos\nlineas")).toBe(code);
    expect(composeSms(code, "Ver LP P999 30H")).toBe(code);
  });
});

describe("SMS con la frase fija y el mensaje del modelo", () => {
  const request = buildSmsRequest("P114", counts({ total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 }), true);
  const fixed = "Parcela P114: de 30 hojas, 7 con roya, 1 con cercospora, 2 dudosas. Plantas de mas de 15 anos.";
  const ai = "Hay senales de roya en 7 de 30 hojas, cercospora en 1 y 2 dudosas.";

  it("la frase fija la arma la app con los conteos, sin red", () => {
    expect(fixedSentence(request)).toBe(fixed);
    expect(fixedSentence(buildSmsRequest("P027", counts({ total: 30, sana: 30 }), false))).toBe(
      "Parcela P027: 30 hojas revisadas, sin senales de enfermedad.",
    );
  });

  it("la frase fija cabe siempre debajo del código", () => {
    for (let mask = 0; mask < 32; mask++) {
      const c = counts({
        roya: mask & 1 ? 21 : 0,
        minador: mask & 2 ? 22 : 0,
        cercospora: mask & 4 ? 23 : 0,
        phoma: mask & 8 ? 24 : 0,
        duda: mask & 16 ? 25 : 0,
      });
      c.total = 999;
      c.sana = 999 - c.roya - c.minador - c.cercospora - c.phoma - c.duda;
      const r = buildSmsRequest("PARCELA9", c, true);
      expect(smsSentences(r.code, fixedSentence(r)), r.code).toHaveLength(1);
    }
  });

  it("debajo del código van la frase fija y, después, el mensaje del modelo", () => {
    expect(composeSms(request.code, fixed, ai)).toBe(`${request.code}\n${fixed}\n${ai}`);
  });

  it("un mensaje del modelo que no vale se queda fuera y la frase fija sigue", () => {
    expect(composeSms(request.code, fixed, null)).toBe(`${request.code}\n${fixed}`);
    expect(composeSms(request.code, fixed, "Plantas de más de 15 años.")).toBe(`${request.code}\n${fixed}`);
    expect(composeSms(request.code, fixed, "Ver LP P999 30H")).toBe(`${request.code}\n${fixed}`);
  });

  it("la lista del técnico se salta las dos frases de cada SMS", () => {
    const sms = composeSms(request.code, fixed, ai);
    const { payloads, invalid } = parseCodes(
      `${sms}\nLP P027 30H\nParcela P027: 30 hojas revisadas, sin senales de enfermedad.\nTodo sano.\notra cosa`,
    );
    expect(payloads.map((p) => p.plot)).toEqual(["P114", "P027"]);
    expect(invalid).toEqual(["otra cosa"]);
  });

  it("un código mal escrito no se toma por frase", () => {
    const { payloads, invalid } = parseCodes("LP P114 30H ROYA7\nLP P203 28 ROYA15");
    expect(payloads.map((p) => p.plot)).toEqual(["P114"]);
    expect(invalid).toEqual(["LP P203 28 ROYA15"]);
  });
});
