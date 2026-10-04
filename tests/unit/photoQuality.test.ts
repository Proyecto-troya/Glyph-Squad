import { describe, expect, it } from "vitest";
import { checkQuality, Pixels } from "../../app/src/adapters/photoQuality";

const SIZE = 64;
type Rgb = [number, number, number];
const PLATE: Rgb = [235, 235, 230];
const LEAF: Rgb = [40, 110, 40];

/** Imagen sintética: `leafness(x, y)` va de 0 (fondo) a 1 (hoja). */
function image(background: Rgb, leafness: (x: number, y: number) => number, texture = 0): Pixels {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const t = leafness(x, y);
      const shade = t === 1 && (x + y) % 2 === 0 ? texture : 0;
      const rgb = background.map((value, c) => value + (LEAF[c] + shade - value) * t);
      data.set([...rgb, 255], (y * SIZE + x) * 4);
    }
  }
  return { data, width: SIZE, height: SIZE };
}

const square = (x: number, y: number) => (x >= 16 && x < 48 && y >= 16 && y < 48 ? 1 : 0);
// Mancha sin bordes: pasa de hoja a plato poco a poco, como una foto movida.
const blob = (x: number, y: number) => {
  const t = Math.min(1, Math.max(0, (30 - Math.hypot(x - 32, y - 32)) / 24));
  return t * t * (3 - 2 * t);
};
const none = () => 0;

describe("filtro de calidad de la foto", () => {
  it("acepta una hoja nítida sobre el plato", () => {
    expect(checkQuality(image(PLATE, square, 60))).toMatchObject({ quality: "ok" });
  });

  it("pide repetir una foto borrosa", () => {
    expect(checkQuality(image(PLATE, blob))).toMatchObject({ quality: "repetir", reason: "borrosa" });
  });

  it("pide repetir si está oscura, si no hay hoja o si no hay plato", () => {
    expect(checkQuality(image([10, 10, 10], none)).reason).toBe("oscura");
    expect(checkQuality(image(PLATE, none)).reason).toBe("sin_hoja");
    expect(checkQuality(image([120, 90, 60], square, 60)).reason).toBe("sin_plato");
  });
});
