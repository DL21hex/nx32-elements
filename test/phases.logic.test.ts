import { describe, expect, it } from "vitest";
import { axisTicks, axisTotal, cleanPhases, dayEnd, dayStart, parseTicks, phaseProgress, tickPos } from "../src/components/phases/logic";
import type { Phase } from "../src/components/phases/types";

const EG: Phase[] = [
  { from: 91, to: 180, label: "EPS 50 %" },
  { from: 1, to: 2, label: "Empresa" },
  { from: 3, to: 90, label: "EPS" },
  { from: 181, to: 240, label: "Fondo de pensiones" },
];

describe("phases: lógica", () => {
  it("limpia y ordena los tramos", () => {
    const bad = [null, { from: 0, to: 3, label: "x" }, { from: 2.5, to: 3, label: "x" }, { from: 5, to: 4, label: "x" }, { from: 1, to: 2 }, "x"];
    expect(cleanPhases([...EG, ...bad]).map((p) => [p.from, p.to])).toEqual([[1, 2], [3, 90], [91, 180], [181, 240]]);
    expect(cleanPhases("no")).toEqual([]);
  });

  it("un tramo montado empieza donde termina el anterior; total corta el eje", () => {
    const over = cleanPhases([{ from: 1, to: 10, label: "A" }, { from: 5, to: 20, label: "B" }, { from: 8, to: 9, label: "C" }]);
    expect(over.map((p) => [p.label, p.from, p.to])).toEqual([["A", 1, 10], ["B", 11, 20]]);
    const cut = cleanPhases(EG, 100);
    expect(cut.map((p) => [p.from, p.to])).toEqual([[1, 2], [3, 90], [91, 100]]);
    expect(EG[0].to).toBe(180); // no muta lo que llega
  });

  it("el total del eje", () => {
    expect(axisTotal(cleanPhases(EG))).toBe(240);
    expect(axisTotal(cleanPhases(EG), 300)).toBe(300);
    expect(axisTotal(cleanPhases(EG), 0)).toBe(240);
    expect(axisTotal([])).toBe(0);
  });

  it("cuánto pasó y cuánto falta (hoy cuenta como pasado)", () => {
    const p = { from: 3, to: 90, label: "EPS" };
    expect(phaseProgress(p, 50)).toEqual({ days: 88, done: 48, left: 40 });
    expect(phaseProgress(p, 2)).toEqual({ days: 88, done: 0, left: 88 });
    expect(phaseProgress(p, 90)).toEqual({ days: 88, done: 88, left: 0 });
    expect(phaseProgress(p, 500)).toEqual({ days: 88, done: 88, left: 0 });
    expect(phaseProgress(p)).toEqual({ days: 88, done: 88, left: 0 });
    expect(phaseProgress(p, null)).toEqual({ days: 88, done: 88, left: 0 });
  });

  it("la posición de un día en el eje", () => {
    expect(dayStart(1, 200)).toBe(0);
    expect(dayStart(101, 200)).toBe(50);
    expect(dayEnd(200, 200)).toBe(100);
    expect(dayEnd(50, 200)).toBe(25);
    expect(dayEnd(500, 200)).toBe(100);
    expect(tickPos(1, 200)).toBe(0);
    expect(tickPos(200, 200)).toBe(100);
    expect(tickPos(91, 200)).toBe(45);
    expect(dayStart(1, 0)).toBe(0);
  });

  it("ticks por defecto: 1, el último y los inicios que no se pisan", () => {
    const ph = cleanPhases(EG);
    // El 3 queda pegado al 1 (menos del 8 %): se va.
    expect(axisTicks(ph, 240)).toEqual([1, 91, 181, 240]);
    // El 181 queda pegado al 190: se va (los extremos mandan).
    expect(axisTicks(cleanPhases(EG, 190), 190)).toEqual([1, 91, 190]);
    expect(axisTicks([{ from: 1, to: 1, label: "uno" }], 1)).toEqual([1]);
    expect(axisTicks(ph, 0)).toEqual([]);
  });

  it("ticks dados: dentro del eje, sin repetir y en orden", () => {
    expect(axisTicks(cleanPhases(EG), 240, [180, 90, 1, 90, 0, 999, 2.5, 240])).toEqual([1, 90, 180, 240]);
    expect(parseTicks("[1, 90]")).toEqual([1, 90]);
    expect(parseTicks("1, 90; 180")).toEqual([1, 90, 180]);
    expect(parseTicks("[roto")).toEqual([]);
    expect(parseTicks(null)).toEqual([]);
  });
});
