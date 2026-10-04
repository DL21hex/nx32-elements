// @vitest-environment happy-dom
// `accents` de <nx-grid>: cómo compara lo escrito al buscar y filtrar en el navegador. Por omisión
// pliega tildes y mayúsculas (como siempre); con `accents="exact"` ignora mayúsculas pero no tildes
// ni ñ («peña es peña, no pena»), la regla del servidor para datos de un ERP en mayúsculas. Vale
// para «Buscar en la tabla», el «contiene» de una columna, el buscador de la lista de valores del
// filtro y el de las facetas.
import { describe, expect, it } from "vitest";
import "../src/index";
import { applyFilters } from "../src/components/grid/logic";
import { GRID_LABELS, type GridColumn, type GridRow, type NxGrid } from "../src/index";

const NAMES = ["PEÑA", "Peña", "Pena", "TÉCNICO", "Llinás", "técnico", "Gómez", "Ríos", "Ortiz", "Mejía"];
const ROWS: GridRow[] = NAMES.map((n, i) => ({ id: String(i + 1), oc: `OC-${i + 1}`, n }));

function mount(col: Partial<GridColumn> = {}, attrs = 'accents="exact"'): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}></nx-grid>`;
  const el = document.querySelector("nx-grid")!;
  el.columns = [
    { key: "oc", label: "Pedido" },
    { key: "n", label: "Nombre", ...col },
  ];
  el.rows = ROWS;
  return el;
}

const shown = (el: NxGrid) => [...el.querySelectorAll('.nx-grid__row > [data-c="1"]')].map((x) => x.textContent);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function panel(el: NxGrid, title: string): Promise<HTMLElement> {
  for (let i = 0; i < 200 && el.querySelector(".nx-grid__filter .nx-grid__f-head")?.textContent !== title; i++) await wait(10);
  return el.querySelector<HTMLElement>(".nx-grid__filter")!;
}
function write(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Con `accents="exact"`: lo escrito → lo que tiene que quedar (en el orden de las filas). */
const EXACT: [string, string[]][] = [
  ["peña", ["PEÑA", "Peña"]],
  ["PEÑA", ["PEÑA", "Peña"]],
  ["pena", ["Pena"]],
  ["técnico", ["TÉCNICO", "técnico"]],
  // Lo escrito descompuesto (e + U+0301) encuentra lo compuesto, y al revés.
  ["técnico", ["TÉCNICO", "técnico"]],
  ["tecnico", []],
  ["Llinas", []],
  ["llinás", ["Llinás"]],
];
/** Sin el atributo: como siempre, sin tildes ni mayúsculas. */
const FOLD: [string, string[]][] = [
  ["pena", ["PEÑA", "Peña", "Pena"]],
  ["tecnico", ["TÉCNICO", "técnico"]],
  ["Llinas", ["Llinás"]],
];

describe("<nx-grid accents>: la propiedad", () => {
  it("por omisión «fold»; «exact» pone el atributo y cualquier otra cosa lo quita", () => {
    const el = mount({}, "");
    expect(el.accents).toBe("fold");
    el.accents = "exact";
    expect(el.getAttribute("accents")).toBe("exact");
    expect(el.accents).toBe("exact");
    el.accents = "fold";
    expect(el.hasAttribute("accents")).toBe(false);
    el.setAttribute("accents", "otra");
    expect(el.accents).toBe("fold");
  });
});

describe("<nx-grid>: «Buscar en la tabla»", () => {
  it('con accents="exact": sin mayúsculas, con sus tildes y su ñ', () => {
    const el = mount();
    for (const [q, want] of EXACT) {
      el.search = q;
      expect(shown(el), q).toEqual(want);
    }
  });

  it("sin el atributo: sin tildes ni mayúsculas, como siempre", () => {
    const el = mount({}, "");
    for (const [q, want] of FOLD) {
      el.search = q;
      expect(shown(el), q).toEqual(want);
    }
  });

  it("cambiar el atributo con algo buscado vuelve a buscar con la otra regla", () => {
    const el = mount({}, "");
    el.search = "pena";
    expect(shown(el)).toEqual(["PEÑA", "Peña", "Pena"]);
    el.accents = "exact";
    expect(shown(el)).toEqual(["Pena"]);
    el.removeAttribute("accents");
    expect(shown(el)).toEqual(["PEÑA", "Peña", "Pena"]);
  });

  it("el atributo que llega después de `search` (antes de conectarse) también cuenta", () => {
    document.body.innerHTML = "";
    const el = document.createElement("nx-grid");
    el.search = "pena";
    el.setAttribute("accents", "exact");
    el.columns = [
      { key: "oc", label: "Pedido" },
      { key: "n", label: "Nombre" },
    ];
    el.rows = ROWS;
    document.body.append(el);
    expect(shown(el)).toEqual(["Pena"]);
  });
});

describe("<nx-grid>: el «contiene» de una columna", () => {
  it('con accents="exact": la tabla, la muestra del panel y su aviso', async () => {
    const el = mount({ filter: "text" });
    await el.openFilter("n");
    const pop = await panel(el, "Nombre");
    expect(pop.querySelector(".nx-grid__f-hint")!.textContent).toBe(GRID_LABELS.containsHintExact);
    const input = pop.querySelector<HTMLInputElement>('input[type="search"]')!;
    for (const [q, want] of EXACT) {
      write(input, q);
      await wait(200);
      expect(el.filters, q).toEqual([{ key: "n", op: "contains", value: q }]);
      expect(shown(el), q).toEqual(want);
      // La muestra del panel cuenta lo mismo que queda en la tabla, y resalta lo encontrado.
      const sample = [...pop.querySelectorAll(".nx-grid__f-sample li")];
      expect(sample.map((li) => li.textContent), q).toEqual(want);
      for (const li of sample) expect(li.querySelector("mark"), q).not.toBeNull();
    }
  });

  it("sin el atributo: sin tildes, y el aviso lo dice", async () => {
    const el = mount({ filter: "text" }, "");
    await el.openFilter("n");
    const pop = await panel(el, "Nombre");
    expect(pop.querySelector(".nx-grid__f-hint")!.textContent).toBe(GRID_LABELS.containsHint);
    const input = pop.querySelector<HTMLInputElement>('input[type="search"]')!;
    for (const [q, want] of FOLD) {
      write(input, q);
      await wait(200);
      expect(shown(el), q).toEqual(want);
    }
  });

  it("applyFilters: «exact» como último argumento; por omisión, plegar", () => {
    const ids = (value: string, accents?: "fold" | "exact") => applyFilters(ROWS, [{ key: "n", op: "contains", value }], accents).map((r) => r.n);
    expect(ids("pena", "exact")).toEqual(["Pena"]);
    expect(ids("peña", "exact")).toEqual(["PEÑA", "Peña"]);
    expect(ids("pena")).toEqual(["PEÑA", "Peña", "Pena"]);
  });
});

describe("<nx-grid>: buscadores de valores", () => {
  it('la lista de valores del filtro, con accents="exact"', async () => {
    const el = mount({ filter: "list" });
    await el.openFilter("n");
    const pop = await panel(el, "Nombre");
    const search = pop.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(search.hidden).toBe(false);
    const values = () => [...pop.querySelectorAll<HTMLInputElement>("input[data-v]")].map((x) => x.dataset.v).sort();
    write(search, "pena");
    expect(values()).toEqual(["Pena"]);
    write(search, "PEÑA");
    expect(values()).toEqual(["PEÑA", "Peña"].sort());
    write(search, "técnico");
    expect(values()).toEqual(["TÉCNICO", "técnico"].sort());
    write(search, "tecnico");
    expect(values()).toEqual([]);
  });

  it("la lista de valores del filtro, sin el atributo", async () => {
    const el = mount({ filter: "list" }, "");
    await el.openFilter("n");
    const pop = await panel(el, "Nombre");
    const search = pop.querySelector<HTMLInputElement>('input[type="search"]')!;
    write(search, "pena");
    expect([...pop.querySelectorAll<HTMLInputElement>("input[data-v]")].map((x) => x.dataset.v).sort()).toEqual(["PEÑA", "Pena", "Peña"].sort());
  });

  it('las facetas, con accents="exact" y sin él', () => {
    const facetSearch = (el: NxGrid) => el.querySelector<HTMLInputElement>('.nx-grid__facets input[data-q="n"]')!;
    const labels = (el: NxGrid) => [...el.querySelectorAll(".nx-grid__facets .nx-grid__opt-label")].map((x) => x.textContent).sort();
    const el = mount({ facet: true }, 'accents="exact" facets-open');
    write(facetSearch(el), "pena");
    expect(labels(el)).toEqual(["Pena"]);
    write(facetSearch(el), "PEÑA");
    expect(labels(el)).toEqual(["PEÑA", "Peña"].sort());
    write(facetSearch(el), "Llinas");
    expect(labels(el)).toEqual([]);
    const fold = mount({ facet: true }, "facets-open");
    write(facetSearch(fold), "pena");
    expect(labels(fold)).toEqual(["PEÑA", "Pena", "Peña"].sort());
  });
});
