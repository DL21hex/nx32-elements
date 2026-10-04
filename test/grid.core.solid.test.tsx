// <Grid> de Solid: `rowKey` llega como atributo después de `rows` (el elemento sale del template ya
// mejorado) y los eventos que suben de un hijo (`slot="bulk"`) no son de la tabla.
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { Grid } from "../src/solid/grid";

afterEach(() => {
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
});
