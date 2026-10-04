import { describe, expect, it } from "vitest";
import { Counts, emptyCounts } from "../../app/src/domain/sample";
import { decodeSms, encodeSms, parseCodes, SMS_MAX_LENGTH } from "../../app/src/domain/sms";

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

  it("separa lo pegado en códigos y líneas que no se entienden", () => {
    const { payloads, invalid } = parseCodes("lp p027 30h\n\n12:40 LP P203 28H ROYA15 MIN3\nbuenos días");
    expect(payloads.map((p) => p.plot)).toEqual(["P027", "P203"]);
    expect(invalid).toEqual(["buenos días"]);
  });
});
