import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, isLang, LANG_INFO, LANGS, TextKey, TEXTS, translate } from "../../app/src/domain/i18n";

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join();

describe("textos de la interfaz", () => {
  const keys = Object.keys(TEXTS.es) as TextKey[];

  it("ofrece español, quechua e inglés, y arranca en español", () => {
    expect([...LANGS].sort()).toEqual(["en", "es", "quz"]);
    expect(DEFAULT_LANG).toBe("es");
    for (const lang of LANGS) expect(LANG_INFO[lang].short).toHaveLength(2);
  });

  it("cada texto existe en los tres idiomas, con los mismos huecos", () => {
    for (const lang of LANGS) {
      expect(Object.keys(TEXTS[lang]).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(TEXTS[lang][key].trim(), `${lang}.${key}`).not.toBe("");
        expect(placeholders(TEXTS[lang][key]), `${lang}.${key}`).toBe(placeholders(TEXTS.es[key]));
      }
    }
  });

  it("rellena los huecos", () => {
    expect(translate("es", "plotTitle", { plot: "P114" })).toBe("Parcela P114");
    expect(translate("en", "counter", { total: 30 })).toBe("of 30 leaves");
    expect(translate("quz", "confidence", { pct: 91 })).toContain("91 %");
  });

  it("el aviso del quechua lleva también el español", () => {
    expect(TEXTS.quz.quzNotice).toContain(TEXTS.es.quzNotice);
  });

  it("solo acepta idiomas conocidos", () => {
    expect(isLang("quz")).toBe(true);
    expect(isLang("fr")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
