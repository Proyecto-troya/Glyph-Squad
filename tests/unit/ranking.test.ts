import { describe, expect, it } from "vitest";
import { rankPlots } from "../../app/src/domain/ranking";
import { parseCodes } from "../../app/src/domain/sms";

const rank = (text: string) => rankPlots(parseCodes(text).payloads);

describe("lista del técnico", () => {
  it("ordena por % de hojas enfermas", () => {
    const rows = rank(
      ["LP P114 30H ROYA7 CER1 DUDA2 E15+", "LP P027 30H", "LP P203 28H ROYA15 MIN3", "LP P088 30H PHO1 DUDA9"].join("\n"),
    );
    expect(rows.map((row) => row.plot)).toEqual(["P203", "P114", "P088", "P027"]);
    expect(rows[0].sickPct).toBeCloseTo((18 / 28) * 100);
  });

  it("marca plantas de más de 15 años y muchas dudas", () => {
    const rows = rank("LP P114 30H ROYA7 CER1 DUDA2 E15+\nLP P088 30H PHO1 DUDA9");
    expect(rows[0]).toMatchObject({ plot: "P114", over15: true, flagUnsure: false });
    expect(rows[1]).toMatchObject({ plot: "P088", over15: false, flagUnsure: true });
  });

  it("con el mismo %, primero las que llevan aviso", () => {
    const rows = rank("LP A1 30H ROYA3\nLP B2 30H ROYA3 E15+\nLP C3 30H ROYA3 DUDA9");
    expect(rows.map((row) => row.plot)).toEqual(["C3", "B2", "A1"]);
  });

  it("si una parcela llega dos veces, vale el último código", () => {
    const rows = rank("LP P114 30H ROYA7\nLP P114 30H ROYA2");
    expect(rows).toHaveLength(1);
    expect(rows[0].counts.roya).toBe(2);
  });
});
