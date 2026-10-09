// @vitest-environment happy-dom
// <nx-grid> con matriz (`matrix`): «Tabla | Matriz», los cruces en el navegador y en el servidor, y
// tocar un cruce para volver a la tabla filtrada.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/grid/index";
import { matrixCells } from "../src/components/grid/logic";
import type { GridColumn, GridRow, NxGrid } from "../src/components/grid/index";

afterEach(() => vi.unstubAllGlobals());

const COLS: GridColumn[] = [
  { key: "oc", label: "Pedido" },
  { key: "prov", label: "Proveedor" },
  { key: "estado", label: "Estado", type: "status", options: [{ value: "pend", label: "Pendiente" }, { value: "apr", label: "Aprobado" }, { value: "anul", label: "Anulado" }] },
  { key: "monto", label: "Monto", type: "money" },
];
const ROWS: GridRow[] = [
  { id: "1", oc: "OC-1", prov: "Aceros", estado: "pend", monto: 8_000_000 },
  { id: "2", oc: "OC-2", prov: "Empaques", estado: "apr", monto: 1_000_000 },
  { id: "3", oc: "OC-3", prov: "Aceros", estado: "apr", monto: 500_000 },
  { id: "4", oc: "OC-4", prov: "Químicos", estado: "pend", monto: 3_000_000 },
  { id: "5", oc: "OC-5", prov: "Aceros", estado: "pend", monto: 2_000_000 },
  { id: "6", oc: "OC-6", prov: "", estado: "apr", monto: 100_000 },
];

function mount(attrs = `matrix='{"rows":"prov","cols":"estado"}'`): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}></nx-grid>`;
  const el = document.querySelector("nx-grid")!;
  el.columns = COLS;
  el.rows = ROWS;
  return el;
}
const layoutBtn = (el: NxGrid, l: string) => el.querySelector<HTMLButtonElement>(`.nx-grid__layout [data-layout="${l}"]`)!;
const table = (el: NxGrid) => el.querySelector<HTMLTableElement>(".nx-grid__mx");
const cell = (el: NxGrid, row: string, col: string) => el.querySelector<HTMLButtonElement>(`.nx-grid__mx button[data-row="${row}"][data-col="${col}"]`);
/** La matriz como texto: una línea por fila, celdas separadas por «|». */
const grid = (el: NxGrid) => [...table(el)!.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => (c.querySelector("button")?.textContent ?? c.querySelector("[aria-hidden]")?.textContent ?? c.textContent)!.trim()).join("|"));
async function toMatrix(el: NxGrid): Promise<void> {
  layoutBtn(el, "matrix").click();
  await vi.waitFor(() => expect(table(el)).not.toBeNull());
}

describe("matrixCells", () => {
  it("cuenta, suma y promedia por cruce; «sin dato» es la cadena vacía", () => {
    const count = matrixCells(ROWS, { rows: "prov", cols: "estado", agg: "count", value: "" });
    expect(count).toContainEqual({ row: "Aceros", col: "pend", value: 2, count: 2 });
    expect(count).toContainEqual({ row: "", col: "apr", value: 1, count: 1 });
    expect(count.reduce((a, c) => a + c.value, 0)).toBe(6);
    const sum = matrixCells(ROWS, { rows: "prov", cols: "estado", agg: "sum", value: "monto" });
    expect(sum.find((c) => c.row === "Aceros" && c.col === "pend")!.value).toBe(10_000_000);
    // El promedio cuenta solo las filas con número (con eso se ponderan los totales).
    const avg = matrixCells([...ROWS, { id: "7", prov: "Aceros", estado: "pend", monto: null }], { rows: "prov", cols: "estado", agg: "avg", value: "monto" });
    expect(avg.find((c) => c.row === "Aceros" && c.col === "pend")).toEqual({ row: "Aceros", col: "pend", value: 5_000_000, count: 2 });
  });
});

describe("<nx-grid> con matriz", () => {
  it("sin `matrix` no hay selector; con él, «Tabla | Matriz» y la matriz en el lugar de la tabla", async () => {
    const plain = mount("");
    expect(plain.querySelector<HTMLElement>(".nx-grid__layout")!.hidden).toBe(true);
    expect(plain.layout).toBe("table");

    const el = mount();
    const bar = el.querySelector<HTMLElement>(".nx-grid__layout")!;
    expect(bar.hidden).toBe(false);
    expect(bar.getAttribute("aria-label")).toBe("Ver como");
    expect(layoutBtn(el, "table").getAttribute("aria-pressed")).toBe("true");
    const said = vi.fn();
    el.addEventListener("nx-grid-layout", (e) => said((e as CustomEvent).detail));
    await toMatrix(el);
    expect(el.layout).toBe("matrix");
    expect(el.getAttribute("layout")).toBe("matrix");
    expect(said).toHaveBeenCalledWith({ layout: "matrix", matrix: { rows: "prov", cols: "estado", agg: "count" } });
    expect(el.querySelector(".nx-grid__main")!.classList.contains("is-matrix")).toBe(true);
    expect(el.querySelector<HTMLElement>(".nx-grid__matrix")!.hidden).toBe(false);
    // Las opciones declaradas van en su orden (también «Anulado», sin filas); los valores, de más a
    // menos filas, y «sin dato» al final. Cada fila con su total, y abajo los de cada columna.
    expect(grid(el)).toEqual([
      "Proveedor|Pendiente|Aprobado|Anulado|Total",
      "Aceros|2|1|·|3",
      "Empaques|·|1|·|1",
      "Químicos|1|·|·|1",
      "(Sin dato)|·|1|·|1",
      "Total|3|3|0|6",
    ]);
    expect(cell(el, "Aceros", "pend")!.getAttribute("aria-label")).toBe("Aceros, Pendiente: 2");
    // Volver a la tabla.
    layoutBtn(el, "table").click();
    expect(el.layout).toBe("table");
    expect(el.querySelector<HTMLElement>(".nx-grid__matrix")!.hidden).toBe(true);
  });

  it("un cruce vuelve a la tabla con sus dos filtros; al volver, la matriz lo marca y no se encoge", async () => {
    const el = mount();
    await toMatrix(el);
    const filtered = vi.fn();
    el.addEventListener("nx-grid-filter", (e) => filtered((e as CustomEvent).detail.count));
    cell(el, "Aceros", "pend")!.click();
    expect(el.layout).toBe("table");
    expect(el.filters).toEqual([
      { key: "prov", op: "in", values: ["Aceros"] },
      { key: "estado", op: "in", values: ["pend"] },
    ]);
    expect(filtered).toHaveBeenLastCalledWith(2);
    expect(el.count).toBe(2);
    await toMatrix(el);
    expect(cell(el, "Aceros", "pend")!.getAttribute("aria-pressed")).toBe("true");
    expect(grid(el)[1]).toBe("Aceros|2|1|·|3");
    expect(el.querySelector(".nx-grid__mx-note")!.textContent).toContain("«Proveedor», «Estado»");
    // Un encabezado: solo su columna. El total general: ninguna de las dos.
    el.querySelector<HTMLButtonElement>('.nx-grid__mx thead button[data-col="apr"]')!.click();
    expect(el.filters).toEqual([{ key: "estado", op: "in", values: ["apr"] }]);
    await toMatrix(el);
    el.querySelector<HTMLButtonElement>(".nx-grid__mx [data-all]")!.click();
    expect(el.filters).toEqual([]);
    // «Sin dato» filtra por el valor vacío.
    await toMatrix(el);
    cell(el, "", "apr")!.click();
    expect(el.count).toBe(1);
    expect(el.selectedRows).toEqual([]);
  });

  it("cuenta con la búsqueda y los demás filtros; suma o promedia una columna de montos", async () => {
    const el = mount();
    el.filters = [{ key: "monto", op: "range", min: 1_000_000 }];
    await toMatrix(el);
    expect(grid(el).at(-1)).toBe("Total|3|1|0|4");
    el.search = "OC-1";
    await vi.waitFor(() => expect(grid(el).at(-1)).toBe("Total|1|0|0|1"));
    el.search = "";
    el.filters = [];
    const show = el.querySelector<HTMLSelectElement>('.nx-grid__mx-field[data-label="show"] select')!;
    expect([...show.options].map((o) => o.textContent)).toEqual(["Cantidad", "Suma de Monto", "Promedio de Monto"]);
    show.value = "sum:monto";
    show.dispatchEvent(new Event("change"));
    expect(el.matrix).toEqual({ rows: "prov", cols: "estado", agg: "sum", value: "monto" });
    expect(cell(el, "Aceros", "pend")!.textContent).toMatch(/10/);
    show.value = "avg:monto";
    show.dispatchEvent(new Event("change"));
    // El total de un promedio se pondera por sus filas: (8 + 0,5 + 2) M / 3 = 3,5 M.
    expect(el.querySelector('.nx-grid__mx tbody tr:first-child td:last-child button')!.textContent).toMatch(/3,5/);
    show.value = "count";
    show.dispatchEvent(new Event("change"));
    expect(el.matrix).toEqual({ rows: "prov", cols: "estado", agg: "count" });
  });

  it("los ejes se eligen y se intercambian; no hay dos iguales", async () => {
    const el = mount("matrix");
    await toMatrix(el);
    // Sin columnas nombradas: las dos primeras que se pueden cruzar (los montos no).
    expect(el.matrix).toEqual({ rows: "prov", cols: "estado", agg: "count" });
    const axes = el.querySelector<HTMLSelectElement>('.nx-grid__mx-field[data-label="rows"] select')!;
    expect([...axes.options].map((o) => o.value)).toEqual(["prov", "estado"]);
    el.querySelector<HTMLButtonElement>(".nx-grid__mx-bar > .nx-grid__icon")!.click();
    expect(el.matrix).toMatchObject({ rows: "estado", cols: "prov" });
    expect(grid(el)[0]).toBe("Estado|Aceros|Empaques|Químicos|(Sin dato)|Total");
    // Poner en filas la columna de las columnas las intercambia.
    axes.value = "prov";
    axes.dispatchEvent(new Event("change"));
    expect(el.matrix).toMatchObject({ rows: "prov", cols: "estado" });
  });

  it("las flechas recorren la matriz con una sola parada de Tab", async () => {
    const el = mount();
    await toMatrix(el);
    const tabbable = [...el.querySelectorAll<HTMLElement>(".nx-grid__mx button")].filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toBe(cell(el, "Aceros", "pend"));
    tabbable[0].focus();
    const key = (k: string) => (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("ArrowRight");
    expect(document.activeElement).toBe(cell(el, "Aceros", "apr"));
    // Un cruce sin filas no tiene botón: se salta.
    key("ArrowRight");
    expect((document.activeElement as HTMLElement).textContent).toBe("3");
    key("ArrowDown");
    expect((document.activeElement as HTMLElement).textContent).toBe("1");
    key("Home");
    expect((document.activeElement as HTMLElement).textContent).toBe("Empaques");
    expect((document.activeElement as HTMLElement).tabIndex).toBe(0);
  });

  it("la vista guarda el modo y la matriz; aplicar una sin ellos vuelve a la tabla", async () => {
    const el = mount();
    await toMatrix(el);
    expect(el.view).toMatchObject({ layout: "matrix", matrix: { rows: "prov", cols: "estado", agg: "count" } });
    el.view = { filters: [] };
    expect(el.layout).toBe("table");
    expect(el.view.layout).toBeUndefined();
    el.view = { filters: [], layout: "matrix", matrix: { rows: "estado", cols: "prov" } };
    expect(el.layout).toBe("matrix");
    expect(el.matrix).toMatchObject({ rows: "estado", cols: "prov" });
    // Una tabla sin matriz no la abre aunque la vista la traiga.
    const plain = mount("");
    plain.view = { filters: [], layout: "matrix" };
    expect(plain.layout).toBe("table");
  });

  it("con `source`, la pide aparte (sin filas ni los filtros de sus ejes) y la pinta con los nombres del servidor", async () => {
    const bodies: Record<string, unknown>[] = [];
    let fail = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        bodies.push(body);
        if (body.matrix) {
          if (fail) return new Response("no", { status: 500 });
          return new Response(
            JSON.stringify({
              rows: [],
              total: 6,
              matrix: [
                { row: "10", col: "pend", value: 2, rowLabel: "Aceros" },
                { row: "20", col: "apr", value: 1, rowLabel: "Empaques" },
                { row: "x", col: "pend", value: "no" },
              ],
            }),
          );
        }
        return new Response(JSON.stringify({ rows: ROWS.slice(0, 2), total: 6 }));
      }),
    );
    document.body.innerHTML = `<nx-grid source="/datos" matrix='{"rows":"prov","cols":"estado"}'></nx-grid>`;
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.filters = [
      { key: "prov", op: "in", values: ["10"] },
      { key: "monto", op: "range", min: 1 },
    ];
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    await toMatrix(el);
    const asked = bodies.find((b) => b.matrix)!;
    expect(asked).toMatchObject({ offset: 0, limit: 0, matrix: { rows: "prov", cols: "estado", agg: "count" }, filters: [{ key: "monto", op: "range", min: 1 }] });
    expect(grid(el)).toEqual(["Proveedor|Pendiente|Aprobado|Anulado|Total", "Aceros|2|·|·|2", "Empaques|·|1|·|1", "Total|2|1|0|3"]);
    // Tocar un cruce filtra por el valor (el id), no por el nombre.
    cell(el, "20", "apr")!.click();
    expect(el.filters).toContainEqual({ key: "prov", op: "in", values: ["20"] });
    // Si no llega: el aviso y «Reintentar».
    fail = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    el.search = "algo";
    layoutBtn(el, "matrix").click();
    await vi.waitFor(() => expect(el.querySelector(".nx-grid__mx-state")?.textContent).toContain("No se pudieron cargar"));
    fail = false;
    el.querySelector<HTMLButtonElement>(".nx-grid__mx-state button")!.click();
    await vi.waitFor(() => expect(table(el)).not.toBeNull());
    warn.mockRestore();
  });
});
