import { describe, expect, it } from "vitest";
import catalogJson from "../../app/public/data/messages.json";
import { LANGS } from "../../app/src/domain/i18n";
import {
  audioClips,
  chooseMessages,
  MessageCatalog,
  MessageId,
  photoRejected,
  renderMessage,
} from "../../app/src/domain/message";
import { Counts, emptyCounts } from "../../app/src/domain/sample";

const catalog = catalogJson as unknown as MessageCatalog;
const counts = (partial: Partial<Counts>): Counts => ({ ...emptyCounts(), ...partial });
const ids = (c: Counts) => chooseMessages(c).map((ref) => ref.id);

describe("elección de mensaje", () => {
  it("sin hojas no dice nada", () => {
    expect(chooseMessages(emptyCounts())).toEqual([]);
  });

  it("sin enfermas: M01 y cierre", () => {
    expect(ids(counts({ total: 30, sana: 30 }))).toEqual(["M01", "M08"]);
  });

  it("una línea por enfermedad, la más frecuente primero", () => {
    const refs = chooseMessages(counts({ total: 30, sana: 20, roya: 7, cercospora: 1, duda: 2 }));
    expect(refs).toEqual([
      { id: "M02", n: 7, total: 30 },
      { id: "M04", n: 1, total: 30 },
      { id: "M08" },
    ]);
  });

  it("añade M06 cuando las dudas pasan del 20 %", () => {
    expect(ids(counts({ total: 30, sana: 20, phoma: 1, duda: 9 }))).toEqual(["M05", "M06", "M08"]);
    expect(ids(counts({ total: 10, sana: 7, duda: 3 }))).toEqual(["M01", "M06", "M08"]);
  });

  it("foto rechazada: M07", () => {
    expect(photoRejected()).toEqual({ id: "M07" });
  });
});

describe("catálogo de mensajes fijos", () => {
  const all: MessageId[] = ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08"];

  it("tiene los 8 mensajes en español, quechua e inglés, con el rótulo del quechua", () => {
    for (const id of all) {
      for (const lang of LANGS) expect(catalog.messages[id][lang], `${id}.${lang}`).toBeTruthy();
    }
    expect(catalog.quzLabel.es).toMatch(/sin validar/);
    expect(catalog.quzLabel.en).toMatch(/not validated/);
    expect(catalog.quzLabel.quz).toBeTruthy();
  });

  it("rellena {n} y {total} en los tres idiomas", () => {
    const ref = { id: "M02" as const, n: 7, total: 30 };
    expect(renderMessage(ref, catalog, "es")).toBe("Roya: 7 de 30 hojas.");
    expect(renderMessage(ref, catalog, "en")).toBe("Rust: 7 of 30 leaves.");
    expect(renderMessage(ref, catalog, "quz")).not.toMatch(/[{}]/);
    for (const id of all) {
      for (const lang of LANGS) {
        expect(renderMessage({ id, n: 7, total: 30 }, catalog, lang), `${id}.${lang}`).not.toMatch(/[{}]/);
      }
    }
  });

  it("no habla de dosis, tratamientos, rendimiento ni precio", () => {
    const es = all.map((id) => catalog.messages[id].es).join(" ");
    expect(es).not.toMatch(/dosis|fungicida|aplica|tratamiento|rendimiento|precio|kg|litro/i);
    const en = all.map((id) => catalog.messages[id].en).join(" ");
    expect(en).not.toMatch(/dose|fungicide|spray|treatment|yield|price|kg|litre|liter/i);
  });

  it("el audio es el clip del mensaje más el número", () => {
    expect(audioClips({ id: "M02", n: 7, total: 30 })).toEqual(["M02", "n7"]);
    expect(audioClips({ id: "M08" })).toEqual(["M08"]);
  });
});
