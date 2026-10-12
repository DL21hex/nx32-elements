import { describe, expect, it } from "vitest";
import { barPct, cleanBars, cleanSeries, layoutBars } from "../src/components/bars/logic";

describe("bars: lógica", () => {
  it("limpia los ítems: id, nombre y valor finito; sin repetidos; partes en 0 si no sirven", () => {
    const items = cleanBars([
      { id: "a", label: "A", value: 3, parts: [1, -2, "x", 2] },
      { id: "a", label: "Otra A", value: 1 },
      { id: 7, label: "Siete", value: 7, code: "M54.5", extra: "" },
      { id: "b", label: "B", value: Number.NaN },
      { label: "Sin id", value: 1 },
      null,
    ]);
    expect(items).toEqual([
      { id: "a", label: "A", value: 3, parts: [1, 0, 0, 2] },
      { id: "7", label: "Siete", value: 7, code: "M54.5" },
    ]);
    expect(cleanBars('[{"id":"x","label":"X","value":1}]')).toHaveLength(1);
    expect(cleanBars("roto")).toEqual([]);
  });

  it("series: hasta 8, con color fijo solo si es válido", () => {
    const s = cleanSeries(Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, label: `S${i}`, slot: i === 0 ? 3 : i === 1 ? 12 : undefined })));
    expect(s).toHaveLength(8);
    expect(s[0]).toEqual({ id: "s0", label: "S0", slot: 3 });
    expect(s[1]).toEqual({ id: "s1", label: "S1" });
  });

  it("escala, tope, total y acumulado", () => {
    const items = cleanBars([10, 6, 3, 1].map((v, i) => ({ id: String(i), label: `L${i}`, value: v })));
    const lay = layoutBars(items, { limit: 2 });
    expect(lay.shown.map((x) => x.id)).toEqual(["0", "1"]);
    expect(lay.hidden.map((x) => x.id)).toEqual(["2", "3"]);
    expect(lay.total).toBe(20);
    expect(lay.max).toBe(10);
    expect(lay.cumulative).toEqual([0.5, 0.8]);
    // Un solo ítem afuera no se resume: se muestra.
    expect(layoutBars(items, { limit: 3 }).hidden).toEqual([]);
    expect(layoutBars(items, { reference: 15 }).max).toBe(15);
    expect(layoutBars(items, { max: 40 }).max).toBe(40);
    expect(layoutBars([], {}).max).toBe(1);
  });

  it("el largo de una barra", () => {
    expect(barPct(5, 10)).toBe(50);
    expect(barPct(20, 10)).toBe(100);
    expect(barPct(-1, 10)).toBe(0);
    expect(barPct(1, 0)).toBe(0);
  });
});
