import { describe, expect, it } from "vitest";
import { dayOfISO, isoOf } from "../src/core/days";
import { holidayLookup } from "../src/core/holidays";
import { holidaysIn, layoutMarks, MAX_DAYS, monthTicks, stateOf, timelineRange } from "../src/components/timeline/logic";
import type { TimelineLane } from "../src/components/timeline/types";

const r = timelineRange("2026-01-01", "2027-02-28", "2026-10-08");
const LANES: TimelineLane[] = [
  { id: "pay", label: "Pagos", kind: "bars" },
  { id: "rest", label: "Descansos", kind: "ranges" },
  { id: "perm", label: "Permisos", kind: "points" },
];

describe("tramo y meses", () => {
  it("por defecto: de hace 8 meses a dentro de 4, por meses enteros", () => {
    const d = timelineRange(null, null, "2026-10-08");
    expect(isoOf(d.from)).toBe("2026-02-01");
    expect(isoOf(d.to)).toBe("2027-02-28");
    expect(isoOf(d.today)).toBe("2026-10-08");
  });
  it("invertido se endereza y uno larguísimo se recorta", () => {
    const inv = timelineRange("2026-12-31", "2026-01-01", "2026-06-01");
    expect(isoOf(inv.from)).toBe("2026-01-01");
    const long = timelineRange("2000-01-01", "2030-01-01", "2026-06-01");
    expect(long.to - long.from + 1).toBe(MAX_DAYS);
  });
  it("14 meses, con el año en el primero y en enero; anchos que suman 100", () => {
    const t = monthTicks(r);
    expect(t).toHaveLength(14);
    expect(t.filter((m) => m.withYear).map((m) => `${m.year}-${m.month}`)).toEqual(["2026-1", "2027-1"]);
    expect(t.reduce((s, m) => s + m.width, 0)).toBeCloseTo(100, 6);
    expect(t[0].left).toBe(0);
  });
  it("un tramo que empieza a mitad de mes recorta el primero", () => {
    const t = monthTicks(timelineRange("2026-03-15", "2026-05-10", "2026-04-01"));
    expect(t.map((m) => m.month)).toEqual([3, 4, 5]);
    expect(isoOf(t[0].day)).toBe("2026-03-15");
  });
});

describe("marcas", () => {
  it("estado por la fecha cuando no viene", () => {
    expect(stateOf({ lane: "pay", label: "x" }, dayOfISO("2026-09-30")!, r.today)).toBe("done");
    expect(stateOf({ lane: "pay", label: "x" }, dayOfISO("2026-10-15")!, r.today)).toBe("upcoming");
    expect(stateOf({ lane: "pay", label: "x", state: "pending" }, 0, r.today)).toBe("pending");
    expect(stateOf({ lane: "pay", label: "x", state: "otro" as never }, dayOfISO("2027-01-01")!, r.today)).toBe("upcoming");
  });
  it("descarta lo que no se puede pintar y ordena por el eje", () => {
    const m = layoutMarks(
      LANES,
      [
        { lane: "pay", date: "2026-09-30", value: 1882000, label: "30 sep" },
        { lane: "nope", date: "2026-09-30", label: "sin carril" },
        { lane: "pay", date: "no-es-fecha", label: "mala" },
        { lane: "pay", date: "2025-12-31", label: "antes" },
        { lane: "perm", date: "2026-05-14", label: "permiso" },
        { lane: "rest", start: "2026-12-28", end: "2027-03-15", label: "se sale" },
        null as never,
      ],
      r,
    );
    expect(m.map((x) => x.item.label)).toEqual(["permiso", "30 sep", "se sale"]);
    const cut = m[2];
    expect(isoOf(cut.b)).toBe("2027-02-28");
    expect(cut.x + cut.w).toBeCloseTo(100 - 0, 0);
  });
  it("barras: alto contra la más alta de su carril y lo resaltado contra la propia", () => {
    const m = layoutMarks(
      LANES,
      [
        { lane: "pay", date: "2026-06-30", value: 4000000, extra: 2000000, label: "con prima" },
        { lane: "pay", date: "2026-07-15", value: 2000000, label: "normal" },
        { lane: "pay", date: "2026-07-31", value: -5, label: "negativo" },
      ],
      r,
    );
    expect(m.map((x) => [x.h, x.extra])).toEqual([[1, 0.5], [0.5, 0], [0, 0]]);
  });
  it("franjas que se pisan van en renglones; las que no, en uno", () => {
    const m = layoutMarks(
      LANES,
      [
        { lane: "rest", start: "2026-03-30", end: "2026-04-01", label: "a" },
        { lane: "rest", start: "2026-03-31", end: "2026-04-10", label: "b" },
        { lane: "rest", start: "2026-04-05", end: "2026-04-06", label: "c" },
        { lane: "rest", start: "2026-07-13", end: "2026-07-17", label: "d" },
      ],
      r,
    );
    const byLabel = Object.fromEntries(m.map((x) => [x.item.label, [x.row, x.rows]]));
    expect(byLabel).toEqual({ a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 2] });
  });
  it("claves estables: el id, o la posición; los repetidos se desambiguan", () => {
    const m = layoutMarks(
      LANES,
      [
        { id: "x", lane: "perm", date: "2026-05-01", label: "1" },
        { id: "x", lane: "perm", date: "2026-05-02", label: "2" },
        { lane: "perm", date: "2026-05-03", label: "3" },
      ],
      r,
    );
    expect(m.map((x) => x.key)).toEqual(["x", "x~1", "#2"]);
  });
  it("festivos del tramo con su nombre", () => {
    const hs = holidaysIn(timelineRange("2026-10-01", "2026-12-31", "2026-10-08"), holidayLookup());
    expect(hs.map((x) => `${isoOf(x.day)} ${x.name}`)).toEqual([
      "2026-10-12 Día de la Raza",
      "2026-11-02 Todos los Santos",
      "2026-11-16 Independencia de Cartagena",
      "2026-12-08 Inmaculada Concepción",
      "2026-12-25 Navidad",
    ]);
  });
  it("cien marcas en un tramo de cinco años, al instante", () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({ lane: i % 3 === 0 ? "pay" : i % 3 === 1 ? "rest" : "perm", date: isoOf(dayOfISO("2024-01-01")! + i), start: isoOf(dayOfISO("2024-01-01")! + i), end: isoOf(dayOfISO("2024-01-01")! + i + 3), value: i, label: String(i) }));
    const t = performance.now();
    const m = layoutMarks(LANES, items, timelineRange("2024-01-01", "2028-12-31", "2026-06-01"));
    expect(m.length).toBe(1000);
    expect(performance.now() - t).toBeLessThan(200);
  });
});
