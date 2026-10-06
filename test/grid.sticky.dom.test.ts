// @vitest-environment happy-dom
// <nx-grid>: columnas fijas a la izquierda (`sticky`). Van primero, con la de las casillas, y cada
// una sabe dónde empieza (`--_s0`, `--_s1`…) para que el CSS la deje quieta al desplazar a lo ancho.
import { afterEach, describe, expect, it } from "vitest";
import "../src/index";
import type { GridColumn, GridRow, NxGrid } from "../src/index";

afterEach(() => {
  document.body.innerHTML = "";
});

const ROWS: GridRow[] = [
  { id: "1", cargo: "Operario", nombre: "Ana Ruiz", doc: "100", empresa: "Agro", salario: 1500 },
  { id: "2", cargo: "Jefe", nombre: "Luis Mora", doc: "200", empresa: "Agro", salario: 3200 },
];

function mount(cols: GridColumn[], attrs = ""): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}></nx-grid>`;
  const el = document.querySelector("nx-grid")!;
  el.columns = cols;
  el.rows = ROWS;
  return el;
}

const scroll = (el: NxGrid) => el.querySelector<HTMLElement>(".nx-grid__scroll")!;
const heads = (el: NxGrid) => [...el.querySelectorAll(".nx-grid__th-label")].map((x) => x.textContent);
const row = (el: NxGrid, r: number) => [...el.querySelectorAll<HTMLElement>(`[data-r="${r}"] > .nx-grid__cell`)];
const pinned = (els: HTMLElement[]) => els.map((x) => (x.classList.contains("is-sticky-end") ? "end" : x.classList.contains("is-sticky") ? "pin" : "-"));

describe("<nx-grid> columnas fijas (sticky)", () => {
  it("la fija va primero, aunque llegue en medio, y no cambia lo que la app pasó", () => {
    const cols: GridColumn[] = [{ key: "cargo", label: "Cargo" }, { key: "nombre", label: "Nombre", sticky: true }, { key: "doc", label: "Documento" }];
    const el = mount(cols);
    expect(heads(el)).toEqual(["Nombre", "Cargo", "Documento"]);
    expect(el.columns.map((c) => c.key)).toEqual(["cargo", "nombre", "doc"]);
    expect(pinned(row(el, 0))).toEqual(["end", "-", "-"]);
    expect(row(el, 0)[0].textContent).toBe("Ana Ruiz");
    expect(row(el, 0)[0].style.getPropertyValue("--_at")).toBe("var(--_s0)");
    expect(scroll(el).style.getPropertyValue("--_s0")).toBe("0px");
  });

  it("varias fijas: cada una empieza donde acaba la anterior, y `--_pin` es lo que tapan juntas", () => {
    const el = mount([{ key: "nombre", label: "Nombre", sticky: true, width: 200 }, { key: "doc", label: "Documento", sticky: true, width: 120 }, { key: "empresa", label: "Empresa" }]);
    expect(pinned(row(el, 1))).toEqual(["pin", "end", "-"]);
    const s = scroll(el).style;
    expect([s.getPropertyValue("--_s0"), s.getPropertyValue("--_s1"), s.getPropertyValue("--_pin")]).toEqual(["0px", "200px", "320px"]);
    const ths = [...el.querySelectorAll<HTMLElement>(".nx-grid__th")];
    expect(pinned(ths)).toEqual(["pin", "end", "-"]);
  });

  it("con casillas (`selectable`), la de las casillas también se fija y corre a las demás 36 px", () => {
    const el = mount([{ key: "nombre", label: "Nombre", sticky: true, width: 200 }, { key: "empresa", label: "Empresa" }], "selectable");
    const check = el.querySelector<HTMLElement>('[data-r="0"] > .nx-grid__check')!;
    expect(check.classList.contains("is-sticky")).toBe(true);
    expect(check.style.getPropertyValue("--_at")).toBe("0px");
    expect(el.querySelector(".nx-grid__th.nx-grid__check")!.classList.contains("is-sticky")).toBe(true);
    expect(scroll(el).style.getPropertyValue("--_s0")).toBe("36px");
    expect(scroll(el).style.getPropertyValue("--_pin")).toBe("236px");
  });

  it("sin fijas, nada se fija: tampoco la de las casillas", () => {
    const el = mount([{ key: "nombre", label: "Nombre" }, { key: "empresa", label: "Empresa" }], "selectable");
    expect(el.querySelectorAll(".is-sticky")).toHaveLength(0);
    expect(scroll(el).style.getPropertyValue("--_pin")).toBe("0px");
  });

  it("todas fijas es ninguna: no habría nada que desplazar por debajo", () => {
    const el = mount([{ key: "nombre", label: "Nombre", sticky: true }, { key: "doc", label: "Documento", sticky: true }]);
    expect(el.querySelectorAll(".is-sticky")).toHaveLength(0);
  });

  it("una fija escondida (`hidden`) no cuenta; `sticky` que no es booleano se corrige", () => {
    const el = mount([
      { key: "nombre", label: "Nombre", sticky: true, hidden: true },
      { key: "doc", label: "Documento", sticky: "sí" as unknown as boolean },
      { key: "empresa", label: "Empresa" },
    ]);
    expect(heads(el)).toEqual(["Documento", "Empresa"]);
    expect(pinned(row(el, 0))).toEqual(["end", "-"]);
  });

  it("al agrupar, la etiqueta que ocupa varias columnas no se fija", () => {
    const el = mount([{ key: "nombre", label: "Nombre", sticky: true }, { key: "cargo", label: "Cargo" }, { key: "empresa", label: "Empresa", facet: true }, { key: "salario", label: "Salario", type: "number" }]);
    el.groupBy = "empresa";
    const label = el.querySelector<HTMLElement>(".nx-grid__row--group > .nx-grid__cell")!;
    expect(label.classList.contains("is-sticky")).toBe(false);
    expect(label.style.getPropertyValue("--_at")).toBe("");
  });
});
