// @vitest-environment happy-dom
// `applyFilters()`: filtrar desde afuera como si fuera la persona (emite `nx-grid-filter`).
import { describe, expect, it } from "vitest";
import "../src/index";
import type { GridColumn, GridRow, NxGrid } from "../src/index";

const COLS: GridColumn[] = [
  { key: "oc", label: "Pedido" },
  { key: "estado", label: "Estado", type: "status", options: [{ value: "a", label: "Abierto" }, { value: "c", label: "Cerrado" }] },
];
const ROWS: GridRow[] = [
  { id: "1", oc: "OC-1", estado: "a" },
  { id: "2", oc: "OC-2", estado: "c" },
  { id: "3", oc: "OC-3", estado: "a" },
];

describe("<nx-grid>.applyFilters()", () => {
  it("filtra y emite nx-grid-filter; el setter `filters` filtra sin emitir", async () => {
    document.body.innerHTML = `<nx-grid row-key="id"></nx-grid>`;
    const el = document.querySelector("nx-grid") as NxGrid;
    el.columns = COLS;
    el.rows = ROWS;
    await new Promise((r) => setTimeout(r, 0));
    const seen: number[] = [];
    el.addEventListener("nx-grid-filter", (e) => seen.push(e.detail.count));
    el.applyFilters([{ key: "estado", op: "in", values: ["a"] }]);
    expect(el.shownIds).toEqual(["1", "3"]);
    expect(seen).toEqual([2]);
    el.filters = [];
    expect(el.shownIds).toEqual(["1", "2", "3"]);
    expect(seen).toEqual([2]);
    el.applyFilters(null);
    expect(seen).toEqual([2, 3]);
  });
});
