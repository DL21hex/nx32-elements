// <Grid> de Solid: `rowKey` llega como atributo después de `rows` (el elemento sale del template ya
// mejorado) y los eventos que suben de un hijo (`slot="bulk"`) no son de la tabla.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { Grid } from "../src/solid/grid";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

const COLS = [{ key: "oc", label: "Pedido" }];
const ROWS = [
  { id: "1", codigo: "A", oc: "OC-1" },
  { id: "2", codigo: "B", oc: "OC-2" },
];

describe("<Grid>", () => {
  it("accents=\"exact\" llega como atributo y la búsqueda distingue tildes; sin él, no", () => {
    const rows = [
      { id: "1", oc: "PEÑA" },
      { id: "2", oc: "Pena" },
    ];
    const shown = (root: Element) => [...root.querySelectorAll('.nx-grid__row > [data-c="0"]')].map((x) => x.textContent);
    const exact = document.body.appendChild(document.createElement("div"));
    render(() => <Grid columns={COLS} rows={rows} search="pena" accents="exact" />, exact);
    expect(exact.querySelector("nx-grid")!.getAttribute("accents")).toBe("exact");
    expect(shown(exact)).toEqual(["Pena"]);
    const fold = document.body.appendChild(document.createElement("div"));
    render(() => <Grid columns={COLS} rows={rows} search="pena" />, fold);
    expect(fold.querySelector("nx-grid")!.hasAttribute("accents")).toBe(false);
    expect(shown(fold)).toEqual(["PEÑA", "Pena"]);
  });

  it("actions llega como propiedad y onAction recibe el botón de una fila", () => {
    const root = document.body.appendChild(document.createElement("div"));
    const onAction = vi.fn();
    render(() => <Grid columns={COLS} rows={ROWS} actions={[{ key: "edit", label: "Editar" }]} onAction={onAction} />, root);
    root.querySelector<HTMLButtonElement>('[data-r="1"] .nx-grid__act')!.click();
    expect(onAction).toHaveBeenCalledOnce();
    expect(onAction.mock.calls[0][0].detail).toMatchObject({ action: "edit", id: "2" });
  });

  it("onColumns recibe el ancho que cambió la persona, con {columns, hidden, widths}; lo que asigna la app no", () => {
    const root = document.body.appendChild(document.createElement("div"));
    const onColumns = vi.fn();
    render(() => <Grid columns={COLS} rows={ROWS} view={{ widths: { oc: 300 } }} onColumns={onColumns} />, root);
    expect(onColumns).not.toHaveBeenCalled();
    root.querySelector<HTMLElement>(".nx-grid__resize")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(onColumns).toHaveBeenCalledOnce();
    expect(onColumns.mock.calls[0][0].detail).toEqual({ columns: COLS, hidden: [], widths: { oc: 316 } });
  });

  it("rowKey: los id salen de esa columna", () => {
    const root = document.body.appendChild(document.createElement("div"));
    const onSelection = vi.fn();
    render(() => <Grid columns={COLS} rows={ROWS} rowKey="codigo" selectable onSelection={onSelection} />, root);
    root.querySelector<HTMLInputElement>('[data-r="1"] input[data-pick]')!.click();
    expect(onSelection).toHaveBeenCalledOnce();
    expect(onSelection.mock.calls[0][0].detail.ids).toEqual(["B"]);
  });

  it("un evento nx-grid-* que sube desde un hijo no llega a los manejadores de la tabla", () => {
    const root = document.body.appendChild(document.createElement("div"));
    const onFilter = vi.fn();
    const onSelection = vi.fn();
    render(
      () => (
        <Grid columns={COLS} rows={ROWS} onFilter={onFilter} onSelection={onSelection}>
          <span slot="bulk" class="hijo" />
        </Grid>
      ),
      root,
    );
    const child = root.querySelector(".hijo")!;
    child.dispatchEvent(new CustomEvent("nx-grid-filter", { bubbles: true, detail: {} }));
    child.dispatchEvent(new CustomEvent("nx-grid-selection", { bubbles: true, detail: {} }));
    expect(onFilter).not.toHaveBeenCalled();
    expect(onSelection).not.toHaveBeenCalled();
    root.querySelector("nx-grid")!.filters = [{ key: "oc", op: "in", values: ["OC-1"] }];
    root.querySelector("nx-grid")!.clearFilters();
    expect(onFilter).toHaveBeenCalledOnce();
  });

  it("con source, la primera carga es una sola petición con filtros, orden y búsqueda", async () => {
    // Aquí las propiedades llegan antes de insertar el elemento; una app que las asigna ya conectado
    // es el caso de grid.coalesce.dom.test.ts. Las dos formas, una sola petición.
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ rows: [], total: 0 }));
      }),
    );
    const root = document.body.appendChild(document.createElement("div"));
    const filters = [{ key: "oc", op: "in" as const, values: ["OC-1"] }];
    render(() => <Grid columns={COLS} source="/datos" clientMax={5000} filters={filters} sort={{ key: "oc", dir: -1 }} search="oc" />, root);
    await new Promise((r) => setTimeout(r, 20));
    // La consulta final, una vez; después, la de `client-max` (el conjunto entero cabe).
    expect(bodies).toEqual([
      { offset: 0, limit: 100, sort: { key: "oc", dir: -1 }, filters, search: "oc" },
      { offset: 0, limit: 5001, sort: null, filters: [] },
    ]);
  });
});
