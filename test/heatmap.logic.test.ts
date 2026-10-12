import { describe, expect, it } from "vitest";
import { cleanColumns, cleanRows, cleanValues, heatDomain, intensity, mixPct, moveCell } from "../src/components/heatmap/logic";

describe("heatmap: lógica", () => {
  it("limpia filas, columnas y la matriz", () => {
    expect(cleanRows([{ id: "a", label: "A", note: "10", total: 0.03, delta: "x" }, { id: "a", label: "B" }, { label: "sin id" }])).toEqual([{ id: "a", label: "A", note: "10", total: 0.03 }]);
    expect(cleanColumns('[{"id":1,"label":"ene"},{"id":"2"}]')).toEqual([{ id: "1", label: "ene" }]);
    expect(cleanValues([[1, "x"], [null]], 3, 2)).toEqual([[1, null], [null, null], [null, null]]);
    expect(cleanValues("roto", 1, 1)).toEqual([[null]]);
  });

  it("dominio secuencial y divergente", () => {
    const v = [[0.01, 0.04], [null, 0.02]];
    expect(heatDomain(v, "sequential")).toEqual({ min: 0, max: 0.04, mid: 0 });
    expect(heatDomain(v, "sequential", { max: 0.1 })).toEqual({ min: 0, max: 0.1, mid: 0 });
    expect(heatDomain([[-3, 1]], "sequential").min).toBe(-3);
    expect(heatDomain([[-3, 1]], "diverging")).toEqual({ min: -3, max: 3, mid: 0 });
    expect(heatDomain([[]], "sequential")).toEqual({ min: 0, max: 1, mid: 0 });
  });

  it("intensidad de una celda y su mezcla", () => {
    const d = heatDomain([[0, 10]], "sequential");
    expect(intensity(5, d, "sequential")).toEqual({ t: 0.5, side: 1 });
    expect(intensity(null, d, "sequential")).toBeNull();
    expect(intensity(-2, heatDomain([[-4, 4]], "diverging"), "diverging")).toEqual({ t: 0.5, side: -1 });
    expect(mixPct(0)).toBe(6);
    expect(mixPct(1)).toBe(100);
    expect(mixPct(2)).toBe(100);
  });

  it("las flechas recorren celdas y encabezados, sin la esquina", () => {
    expect(moveCell(0, 0, "ArrowRight", 3, 4)).toEqual([0, 1]);
    expect(moveCell(0, 0, "ArrowLeft", 3, 4)).toEqual([0, -1]);
    expect(moveCell(0, 0, "ArrowUp", 3, 4)).toEqual([-1, 0]);
    expect(moveCell(-1, 0, "ArrowLeft", 3, 4)).toBeNull();
    expect(moveCell(2, 3, "ArrowDown", 3, 4)).toBeNull();
    expect(moveCell(1, 2, "Home", 3, 4)).toEqual([1, -1]);
    expect(moveCell(-1, 2, "Home", 3, 4)).toEqual([-1, 0]);
    expect(moveCell(1, 0, "End", 3, 4)).toEqual([1, 3]);
    expect(moveCell(1, 1, "End", 3, 4, true)).toEqual([2, 3]);
    expect(moveCell(1, 1, "Home", 3, 4, true)).toEqual([0, 0]);
    expect(moveCell(1, 1, "Enter", 3, 4)).toBeNull();
  });
});
