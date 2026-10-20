import { describe, expect, it } from "vitest";
import { LANES_LABELS } from "../src/components/lanes/lanes";
import {
  bandLabels,
  bandOf,
  cleanBands,
  cleanLanes,
  delayOf,
  diffPlaces,
  dotSize,
  jamOf,
  placesOf,
  prepare,
  rankLanes,
  slotOf,
  stackOf,
  summarize,
  toneNames,
} from "../src/components/lanes/logic";
import type { Lane, LaneItem } from "../src/components/lanes/types";

const LANES: Lane[] = [
  { id: "vac", label: "Vacaciones", stages: [{ id: "jefe", label: "Jefe", other: true }, { id: "rev", label: "Revisar" }, { id: "eje", label: "Ejecutar" }] },
  { id: "ret", label: "Retiros", stages: [{ id: "liq", label: "Liquidar" }, { id: "pag", label: "Pagar" }] },
  { id: "ces", label: "Cesantías", stages: [{ id: "rev", label: "Revisar" }] },
];

const ITEMS: LaneItem[] = [
  { id: 1, lane: "vac", stage: "jefe", age: 30 },
  { id: 2, lane: "vac", stage: "rev", age: 1 },
  { id: 3, lane: "vac", stage: "rev", age: 12 },
  { id: 4, lane: "vac", stage: "eje", age: 4 },
  { id: 5, lane: "ret", stage: "liq", age: 40 },
  { id: 6, lane: "ret", stage: "liq", age: 15 },
  { id: 7, lane: "ret", stage: "pag", age: 7 },
];

const num = (n: number) => String(n);

describe("lanes: tramos", () => {
  it("cleanBands ordena, quita repetidos y negativos, y deja a lo sumo tres", () => {
    expect(cleanBands([10, 2, 5, 2, -1, NaN, "3"])).toEqual([2, 5, 10]);
    expect(cleanBands([1, 2, 3, 4])).toEqual([1, 2, 3]);
    expect(cleanBands(undefined)).toEqual([2, 5, 10]);
    expect(cleanBands([])).toEqual([]);
  });

  it("bandOf: el primer corte que no supera, o el último tramo", () => {
    const b = [2, 5, 10];
    expect([0, 2, 2.5, 5, 6, 10, 10.1, 99].map((a) => bandOf(a, b))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(bandOf(50, [])).toBe(0);
  });

  it("toneNames: el último tramo es el atraso, el anterior el aviso", () => {
    expect(toneNames([2, 5, 10])).toEqual(["fresh", "ok", "warn", "late"]);
    expect(toneNames([5, 10])).toEqual(["ok", "warn", "late"]);
    expect(toneNames([10])).toEqual(["warn", "late"]);
    expect(toneNames([])).toEqual(["ok"]);
  });

  it("bandLabels: «0 a 2 días», «3 a 5», «6 a 10», «Más de 10»", () => {
    expect(bandLabels([2, 5, 10], LANES_LABELS, num)).toEqual(["0 a 2 días", "3 a 5", "6 a 10", "Más de 10"]);
    // Con cortes que no son enteros, el tramo empieza donde terminó el anterior.
    expect(bandLabels([0.5, 1.5], LANES_LABELS, num)).toEqual(["0 a 0.5 días", "0.5 a 1.5", "Más de 1.5"]);
    expect(bandLabels([], LANES_LABELS, num)).toEqual([]);
  });
});

describe("lanes: carriles y elementos", () => {
  it("cleanLanes descarta lo que no se puede pintar", () => {
    const out = cleanLanes([
      { id: "a", label: "A", stages: [{ id: "x", label: "X" }, { id: "x", label: "repetida" }, null, { label: "sin id" }] },
      { id: "a", label: "repetido", stages: [{ id: "y", label: "Y" }] },
      { id: "b", label: "B", stages: [] },
      { id: 7, stages: [{ id: 1 }] },
      "nada",
    ]);
    expect(out).toEqual([
      { id: "a", label: "A", stages: [{ id: "x", label: "X", other: false, href: undefined }] },
      { id: "7", label: "7", stages: [{ id: "1", label: "1", other: false, href: undefined }] },
    ]);
    expect(cleanLanes(null)).toEqual([]);
  });

  it("prepare ubica cada elemento, ordena del más viejo al más nuevo y descarta lo desconocido", () => {
    const p = prepare(
      [...ITEMS, { id: 8, lane: "nope", stage: "rev", age: 1 }, { id: 9, lane: "vac", stage: "nope", age: 1 }, { id: 10, lane: "vac", stage: "rev", age: NaN }, { id: 2, lane: "ret", stage: "pag", age: 1 }, { id: 11, lane: "ces", stage: "rev", age: -3 }],
      LANES,
      [2, 5, 10],
    );
    expect(p.rows.map((r) => r.id)).toEqual(["1", "2", "3", "4", "5", "6", "7", "11"]);
    expect(p.groups[0][1].map((r) => r.id)).toEqual(["3", "2"]);
    expect(p.groups[2][0][0].age).toBe(0);
    expect(p.rows[0].other).toBe(true);
    expect(p.rows.find((r) => r.id === "5")!.band).toBe(3);
  });

  it("summarize separa lo propio de lo de otros y cuenta lo atrasado", () => {
    const sums = summarize(prepare(ITEMS, LANES, [2, 5, 10]), LANES, [2, 5, 10]);
    expect(sums[0]).toMatchObject({ own: 3, other: 1, late: 1, tones: [1, 1, 0, 1] });
    // Lo más viejo es lo propio, no lo que espera al jefe (30 días).
    expect(sums[0].oldest!.id).toBe("3");
    expect(sums[0].stations.map((s) => [s.count, s.late])).toEqual([[1, 0], [2, 1], [1, 0]]);
    expect(sums[1]).toMatchObject({ own: 3, other: 0, late: 2 });
    expect(sums[2]).toMatchObject({ own: 0, other: 0, late: 0, oldest: null });
  });

  it("sin cortes nada es atraso", () => {
    const sums = summarize(prepare(ITEMS, LANES, []), LANES, []);
    expect(sums.map((s) => s.late)).toEqual([0, 0, 0]);
    expect(sums[1].tones).toEqual([3]);
  });

  it("rankLanes: primero los que tienen atrasados; si no hay, los que tienen algo propio", () => {
    const sums = summarize(prepare(ITEMS, LANES, [2, 5, 10]), LANES, [2, 5, 10]);
    expect(rankLanes(sums)).toEqual([1, 0]);
    const calm = summarize(prepare(ITEMS, LANES, [100]), LANES, [100]);
    // Vacaciones y Retiros tienen 3 propios cada uno: queda el orden de los carriles.
    expect(rankLanes(calm)).toEqual([0, 1]);
    expect(rankLanes([])).toEqual([]);
  });

  it("jamOf: la bandeja con más atrasados, o la más llena", () => {
    const sums = summarize(prepare(ITEMS, LANES, [2, 5, 10]), LANES, [2, 5, 10]);
    expect(jamOf(sums[0], LANES[0])).toBe(1);
    expect(jamOf(sums[1], LANES[1])).toBe(0);
    expect(jamOf(sums[2], LANES[2])).toBe(-1);
  });

  it("diffPlaces cuenta lo que pasó de bandeja, lo que llegó y lo que salió", () => {
    const before = placesOf(prepare(ITEMS, LANES, []), LANES);
    const next: LaneItem[] = [
      { id: 1, lane: "vac", stage: "rev", age: 0 },
      { id: 2, lane: "vac", stage: "rev", age: 1 },
      { id: 3, lane: "ret", stage: "liq", age: 0 },
      { id: 4, lane: "vac", stage: "eje", age: 4 },
      { id: 6, lane: "ret", stage: "liq", age: 15 },
      { id: 7, lane: "ret", stage: "pag", age: 7 },
      { id: 12, lane: "ces", stage: "rev", age: 0 },
    ];
    const d = diffPlaces(before, placesOf(prepare(next, LANES, []), LANES));
    expect(d.moved).toEqual([{ id: "1", lane: "vac", from: "jefe", to: "rev" }]);
    expect(d.added).toEqual([{ id: "3", lane: "ret", stage: "liq" }, { id: "12", lane: "ces", stage: "rev" }]);
    expect(d.removed).toEqual([{ id: "3", lane: "vac", stage: "rev" }, { id: "5", lane: "ret", stage: "liq" }]);
  });
});

describe("lanes: geometría", () => {
  it("dotSize: según el ancho, y siempre caben dos filas", () => {
    expect(dotSize(1100, 90)).toBe(10);
    expect(dotSize(2000, 90)).toBe(13);
    expect(dotSize(1100, 50)).toBe(6);
    expect(dotSize(300, 200)).toBe(6);
  });

  it("stackOf y slotOf: el más viejo junto al riel, centrados sobre el nodo", () => {
    const st = stackOf(600, 90, 3, 10);
    expect(st).toMatchObject({ railY: 68, sw: 200, gap: 13, cols: 12 });
    expect(st.rows).toBe(Math.floor((68 - 8 - 10) / 13) + 1);
    const a = slotOf(st, 1, 0, 1, 10);
    expect(a).toEqual({ x: 300, y: 59 });
    // Dos puntos: lado a lado, centrados.
    expect(slotOf(st, 0, 0, 2, 10).x).toBe(100 - 6.5);
    expect(slotOf(st, 0, 1, 2, 10).x).toBe(100 + 6.5);
    // La fila siguiente queda encima.
    expect(slotOf(st, 0, 12, 30, 10).y).toBe(59 - 13);
    // Lo que pasa del tope comparte el último sitio.
    expect(slotOf(st, 0, 999, 999, 10)).toEqual(slotOf(st, 0, st.cap - 1, 999, 10));
  });

  it("delayOf es estable y cae entre 0 y 2,5 s", () => {
    expect(delayOf("4821")).toBe(delayOf("4821"));
    for (const id of ["a", "b", "4821", "x".repeat(40)]) expect(delayOf(id)).toBeGreaterThanOrEqual(0);
    for (const id of ["a", "b", "4821", "x".repeat(40)]) expect(delayOf(id)).toBeLessThan(2.6);
  });
});
