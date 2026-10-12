// @vitest-environment happy-dom
// <nx-grid> con matriz (`matrix`): «Tabla | Matriz», los cruces en el navegador y en el servidor, y
// tocar un cruce para volver a la tabla filtrada.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/grid/index";
import { matrixCells } from "../src/components/grid/logic";
import { sheetXml } from "../src/components/grid/xlsx";
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
const grid = (el: NxGrid) => [...table(el)!.querySelectorAll("tr")].map((tr) => [...tr.children].filter((c) => !c.classList.contains("nx-grid__mx-fill")).map((c) => (c.querySelector("button")?.textContent ?? c.querySelector("[aria-hidden]")?.textContent ?? c.textContent)!.trim()).join("|"));
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
    // Las opciones declaradas van en su orden, pero solo las que tienen filas («Anulado» no sale,
    // como en el panel de filtros); los demás valores, de más a menos filas, y «sin dato» al final.
    // Cada fila con su total, y abajo los de cada columna.
    expect(grid(el)).toEqual([
      "Proveedor|Pendiente|Aprobado|Total",
      "Aceros|2|1|3",
      "Empaques|·|1|1",
      "Químicos|1|·|1",
      "(Sin dato)|·|1|1",
      "Total|3|3|6",
    ]);
    expect(cell(el, "Aceros", "pend")!.getAttribute("aria-label")).toBe("Aceros, Pendiente: 2");
    // Volver a la tabla.
    layoutBtn(el, "table").click();
    expect(el.layout).toBe("table");
    expect(el.querySelector<HTMLElement>(".nx-grid__matrix")!.hidden).toBe(true);
  });

  it("un cruce vuelve a la tabla con sus dos filtros; la matriz cuenta lo que filtra la tabla", async () => {
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
    // La matriz cuenta las mismas filas que la tabla: con esos filtros puestos (por la app o a mano,
    // no por el clic, que se quita al volver), sin los valores que quitan.
    el.filters = el.filters.slice();
    await toMatrix(el);
    expect(grid(el)).toEqual(["Proveedor|Pendiente|Total", "Aceros|2|2", "Total|2|2"]);
    expect(el.querySelector(".nx-grid__mx-note")!.textContent).toBe("Un cruce abre la tabla con esos dos filtros; un encabezado o un total, con el suyo.");
    expect(el.querySelector(".nx-grid__mx [aria-pressed]")).toBeNull();
  });

  it("volver a «Matriz» con el selector quita lo que puso el cruce: la matriz vuelve entera", async () => {
    const el = mount();
    await toMatrix(el);
    cell(el, "Aceros", "pend")!.click();
    expect(el.count).toBe(2);
    const filtered = vi.fn();
    el.addEventListener("nx-grid-filter", (e) => filtered((e as CustomEvent).detail.filters));
    await toMatrix(el);
    expect(el.filters).toEqual([]);
    expect(filtered).toHaveBeenLastCalledWith([]);
    expect(grid(el).at(-1)).toBe("Total|3|3|6");
    // Una sola vez: volver a la tabla y a la matriz de nuevo no cambia nada más.
    layoutBtn(el, "table").click();
    await toMatrix(el);
    expect(el.filters).toEqual([]);
  });

  it("vuelve a los filtros de antes del clic en ese eje, y deja lo que la persona cambió a mano", async () => {
    const el = mount();
    el.filters = [{ key: "estado", op: "notIn", values: ["anul"] }];
    await toMatrix(el);
    cell(el, "Aceros", "pend")!.click();
    expect(el.filters).toEqual([
      { key: "prov", op: "in", values: ["Aceros"] },
      { key: "estado", op: "in", values: ["pend"] },
    ]);
    await toMatrix(el);
    expect(el.filters).toEqual([{ key: "estado", op: "notIn", values: ["anul"] }]);
    // Si la persona quitó a mano el chip de «Pendiente», eso se respeta: solo vuelve el proveedor.
    cell(el, "Aceros", "pend")!.click();
    [...el.querySelectorAll<HTMLButtonElement>(".nx-grid__chip [data-i]")].find((b) => b.getAttribute("aria-label")!.includes("Pendiente"))!.click();
    expect(el.filters).toEqual([{ key: "prov", op: "in", values: ["Aceros"] }]);
    await toMatrix(el);
    expect(el.filters).toEqual([]);
    // Asignar `filters` desde la app (o aplicar una vista) olvida el clic.
    cell(el, "Aceros", "pend")!.click();
    el.filters = [{ key: "prov", op: "in", values: ["Aceros"] }];
    await toMatrix(el);
    expect(el.filters).toEqual([{ key: "prov", op: "in", values: ["Aceros"] }]);
  });

  it("un encabezado pone el filtro de su eje y deja el otro; el total general no cambia nada", async () => {
    const el = mount();
    await toMatrix(el);
    el.querySelector<HTMLButtonElement>('.nx-grid__mx thead button[data-col="apr"]')!.click();
    expect(el.filters).toEqual([{ key: "estado", op: "in", values: ["apr"] }]);
    // Con ese filtro puesto por la app (el del clic se quitaría al volver), la matriz es la de lo filtrado.
    el.filters = [{ key: "estado", op: "in", values: ["apr"] }];
    await toMatrix(el);
    expect(grid(el)).toEqual(["Proveedor|Aprobado|Total", "Aceros|1|1", "Empaques|1|1", "(Sin dato)|1|1", "Total|3|3"]);
    el.querySelector<HTMLButtonElement>('.nx-grid__mx tbody button[data-row="Aceros"]:not([data-col])')!.click();
    expect(el.filters).toEqual([
      { key: "estado", op: "in", values: ["apr"] },
      { key: "prov", op: "in", values: ["Aceros"] },
    ]);
    // Al volver, se quita solo el proveedor que puso la fila; el estado era de antes.
    await toMatrix(el);
    expect(el.filters).toEqual([{ key: "estado", op: "in", values: ["apr"] }]);
    // El total general vuelve a la tabla sin cambiar nada, y no deja nada que quitar.
    el.querySelector<HTMLButtonElement>(".nx-grid__mx [data-all]")!.click();
    expect(el.layout).toBe("table");
    expect(el.count).toBe(3);
    await toMatrix(el);
    expect(el.filters).toEqual([{ key: "estado", op: "in", values: ["apr"] }]);
    // «Sin dato» filtra por el valor vacío.
    el.filters = [];
    await toMatrix(el);
    cell(el, "", "apr")!.click();
    expect(el.count).toBe(1);
    expect(el.selectedRows).toEqual([]);
  });

  it("las líneas de las columnas siguen debajo de la tabla: una capa del fondo por línea", async () => {
    const el = mount();
    await toMatrix(el);
    const box = el.querySelector<HTMLElement>(".nx-grid__mx-scroll")!;
    // Pendiente | Aprobado | Total: el borde izquierdo de cada una y el derecho de «Total». Marcadas la
    // primera (cierra los nombres) y las dos de «Total».
    const strong = "linear-gradient(var(--nx-border), var(--nx-border))";
    const subtle = "linear-gradient(var(--nx-border-subtle), var(--nx-border-subtle))";
    expect(box.style.backgroundImage).toBe([strong, subtle, strong, strong].join(", "));
    expect(box.style.backgroundSize.split(",")).toHaveLength(4);
    // Sin tabla (nada que cruzar), sin líneas.
    el.rows = [];
    await vi.waitFor(() => expect(table(el)).toBeNull());
    expect(box.style.backgroundImage).toBe("");
  });

  it("un valor sin filas no sale: ni el que quita un filtro ni el declarado que no tiene", async () => {
    const el = mount();
    el.filters = [{ key: "estado", op: "notIn", values: ["anul"] }];
    await toMatrix(el);
    expect(grid(el)[0]).toBe("Proveedor|Pendiente|Aprobado|Total");
    el.filters = [{ key: "prov", op: "in", values: ["Aceros", "Químicos"] }];
    await vi.waitFor(() => expect(grid(el)).toEqual(["Proveedor|Pendiente|Aprobado|Total", "Aceros|2|1|3", "Químicos|1|·|1", "Total|3|1|4"]));
    expect(el.count).toBe(4);
    // Lo que sobra a la derecha es una celda vacía al final de cada fila, fuera del lector.
    for (const tr of table(el)!.querySelectorAll("tr")) expect(tr.lastElementChild!.matches('.nx-grid__mx-fill[aria-hidden="true"]')).toBe(true);
    // Un filtro de otra columna también deja fuera los valores que se quedan sin filas.
    el.filters = [{ key: "monto", op: "range", min: 2_000_000 }];
    await vi.waitFor(() => expect(grid(el)).toEqual(["Proveedor|Pendiente|Total", "Aceros|2|2", "Químicos|1|1", "Total|3|3"]));
  });

  it("cuenta con la búsqueda y los demás filtros; suma o promedia una columna de montos", async () => {
    const el = mount();
    el.filters = [{ key: "monto", op: "range", min: 1_000_000 }];
    await toMatrix(el);
    expect(grid(el).at(-1)).toBe("Total|3|1|4");
    el.search = "OC-1";
    await vi.waitFor(() => expect(grid(el).at(-1)).toBe("Total|1|1"));
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
    expect(el.querySelector('.nx-grid__mx tbody tr:first-child td.nx-grid__mx-tot button')!.textContent).toMatch(/3,5/);
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

  it("una columna fuera del panel (`facet: false`) no es eje, salvo que se nombre", async () => {
    const el = mount("matrix");
    el.columns = [...COLS, { key: "jefe", label: "Jefe", options: [{ value: "Sin asignar" }], facet: false }];
    await toMatrix(el);
    const axes = () => [...el.querySelectorAll<HTMLSelectElement>('.nx-grid__mx-field[data-label="rows"] option')].map((o) => o.value);
    expect(axes()).toEqual(["prov", "estado"]);
    el.matrix = { rows: "jefe", cols: "estado" };
    expect(axes()).toEqual(["prov", "estado", "jefe"]);
    expect(el.matrix).toMatchObject({ rows: "jefe", cols: "estado" });
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

  it("con `source`, la pide aparte (sin filas, con todos los filtros) y la pinta con los nombres del servidor", async () => {
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
    expect(asked).toMatchObject({
      offset: 0,
      limit: 0,
      matrix: { rows: "prov", cols: "estado", agg: "count" },
      filters: [
        { key: "prov", op: "in", values: ["10"] },
        { key: "monto", op: "range", min: 1 },
      ],
    });
    expect(grid(el)).toEqual(["Proveedor|Pendiente|Aprobado|Total", "Aceros|2|·|2", "Empaques|·|1|1", "Total|2|1|3"]);
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

  it("«Exportar» en la matriz baja la matriz como se ve, con «Total» fuera del autofiltro", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    URL.createObjectURL = () => "blob:x";
    URL.revokeObjectURL = () => {};
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const el = mount();
    el.filters = [{ key: "estado", op: "notIn", values: ["anul"] }];
    await toMatrix(el);
    const btn = [...el.querySelectorAll<HTMLButtonElement>(".nx-grid__bar > .nx-grid__btn")].find((b) => b.textContent === "Exportar")!;
    expect(btn.hasAttribute("data-table-only")).toBe(false);
    const done = vi.fn();
    el.addEventListener("nx-grid-export", (e) => done((e as CustomEvent).detail));
    btn.click();
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(done).toHaveBeenCalledWith({ ok: true, count: 4, filename: "tabla-matriz", layout: "matrix" });
    expect(names).toEqual(["tabla-matriz.xlsx"]);
    await vi.waitFor(() => expect(el.querySelector(".nx-sr-only[role=status]")!.textContent).toBe("Se exportó la matriz"));
    // En la tabla, como siempre: sus filas y su nombre.
    layoutBtn(el, "table").click();
    expect(await el.exportXlsx()).toBe(6);
    expect(names.at(-1)).toBe("tabla.xlsx");
  });
});

describe("matrixSheet", () => {
  it("la matriz como hoja: nombres, cruces, totales; 0 al contar y vacío en un promedio", async () => {
    const { matrixSheet } = await import("../src/components/grid/grid-matrix");
    const loc = { compare: (a: string, b: string) => a.localeCompare(b) } as never;
    const view = (agg: "count" | "avg", cells = matrixCells(ROWS, { rows: "prov", cols: "estado", agg, value: "monto" })) => ({
      config: { rows: "prov", cols: "estado", agg, value: agg === "count" ? "" : "monto" },
      axes: COLS.filter((c) => c.key === "prov" || c.key === "estado"),
      measures: COLS.filter((c) => c.key === "monto"),
      cells,
      loading: false,
      failed: false,
    });
    expect(matrixSheet(view("count"), null, loc)).toEqual({
      header: ["Proveedor × Estado", "Pendiente", "Aprobado", "Total"],
      rows: [
        ["Aceros", 2, 1, 3],
        ["Empaques", 0, 1, 1],
        ["Químicos", 1, 0, 1],
        ["(Sin dato)", 0, 1, 1],
        ["Total", 3, 3, 6],
      ],
    });
    const avg = matrixSheet(view("avg"), null, loc)!;
    expect(avg.money?.key).toBe("monto");
    expect(avg.rows[0]).toEqual(["Aceros", 5_000_000, 500_000, 3_500_000]);
    expect(avg.rows[1]).toEqual(["Empaques", null, 1_000_000, 1_000_000]);
    expect(matrixSheet({ ...view("count"), cells: null }, null, loc)).toBeNull();
  });

  it("el autofiltro deja fuera las filas del pie", () => {
    const xml = sheetXml(["A", "B"], [["x", 1], ["Total", 1]], ["text", "number"], [10, 10], [], 1);
    expect(xml).toContain('<autoFilter ref="A1:B2"/>');
  });
});
