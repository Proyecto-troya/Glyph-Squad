import { describe, expect, it } from "vitest";
import {
  addLeaf,
  countLeaves,
  decideLabel,
  LeafResult,
  newSample,
  normalizePlot,
  sickPct,
  softmax,
  TARGET_LEAVES,
  tooManyUnsure,
  topClasses,
} from "../../app/src/domain/sample";

const leaf = (label: LeafResult["label"], quality: LeafResult["quality"] = "ok"): LeafResult => ({
  label,
  confidence: 0.9,
  quality,
});

describe("conteo de la muestra", () => {
  it("cuenta por clase y deja fuera las fotos rechazadas", () => {
    const counts = countLeaves([leaf("sana"), leaf("roya"), leaf("roya"), leaf("duda"), leaf("phoma", "repetir")]);
    expect(counts).toEqual({ total: 4, sana: 1, roya: 2, minador: 0, cercospora: 0, phoma: 0, duda: 1 });
    expect(sickPct(counts)).toBe(50);
  });

  it("no añade fotos rechazadas ni pasa de 30 hojas", () => {
    let sample = newSample("P114", new Date("2026-10-03T12:00:00Z"));
    sample = addLeaf(sample, leaf("roya", "repetir"));
    expect(sample.leaves).toHaveLength(0);
    for (let i = 0; i < TARGET_LEAVES + 5; i++) sample = addLeaf(sample, leaf("sana"));
    expect(sample.leaves).toHaveLength(TARGET_LEAVES);
  });

  it("avisa solo cuando las dudas pasan del 20 %", () => {
    expect(tooManyUnsure(countLeaves([...Array(8).fill(leaf("sana")), ...Array(2).fill(leaf("duda"))]))).toBe(false);
    expect(tooManyUnsure(countLeaves([...Array(7).fill(leaf("sana")), ...Array(3).fill(leaf("duda"))]))).toBe(true);
    expect(tooManyUnsure(countLeaves([]))).toBe(false);
  });

  it("valida el código de parcela", () => {
    expect(normalizePlot(" p114 ")).toBe("P114");
    expect(normalizePlot("Noor Quispe")).toBeNull();
    expect(normalizePlot("")).toBeNull();
  });
});

describe("abstención", () => {
  it("la temperatura baja la confianza sin cambiar la clase", () => {
    const logits = [4, 1, 0, 0, 0];
    const sharp = softmax(logits, 1);
    const soft = softmax(logits, 3);
    expect(sharp.reduce((a, b) => a + b)).toBeCloseTo(1);
    expect(soft[0]).toBeLessThan(sharp[0]);
    expect(soft.indexOf(Math.max(...soft))).toBe(0);
  });

  it("responde duda por debajo del umbral", () => {
    expect(decideLabel([0.1, 0.8, 0.05, 0.03, 0.02], 0.7).label).toBe("roya");
    expect(decideLabel([0.3, 0.4, 0.1, 0.1, 0.1], 0.7)).toEqual({ label: "duda", confidence: 0.4 });
  });

  it("ordena las clases que el modelo consideró", () => {
    expect(topClasses([0.1, 0.6, 0.05, 0.22, 0.03])).toEqual([
      { label: "roya", p: 0.6 },
      { label: "cercospora", p: 0.22 },
      { label: "sana", p: 0.1 },
    ]);
  });
});
