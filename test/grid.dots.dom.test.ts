// @vitest-environment happy-dom
// <nx-grid>: el punto de color de un valor (`dot`) y el ícono junto al título (`heading-icon`).
//
// Un punto clasifica sin gritar: va antes del valor en la celda (en vez de la píldora), y el mismo
// punto se repite en el panel de filtros y en el chip del filtro puesto, para que el color diga lo
// mismo en todas partes. Su color es el tono de la opción o, sin tono, uno de ocho por su lugar.
import { afterEach, describe, expect, it } from "vitest";
import "../src/index";
import { registerIcons, type GridColumn, type GridRow, type NxGrid } from "../src/index";
import { dotOf } from "../src/components/grid/logic";

afterEach(() => {
  document.body.innerHTML = "";
});

const CONTRATO: GridColumn = {
  key: "contrato",
  label: "Contrato",
  dot: true,
  options: [{ value: "Indefinido" }, { value: "Término fijo" }, { value: "Obra o labor" }, { value: "Prácticas", tone: "warning" }],
};
const ESTADO: GridColumn = {
  key: "estado",
  label: "Estado",
  type: "status",
  options: [
    { value: "Activo", tone: "success" },
    { value: "Inactivo", tone: "neutral" },
  ],
};
const ROWS: GridRow[] = [
  { id: "1", nombre: "Ana Ríos", contrato: "Indefinido", estado: "Activo" },
  { id: "2", nombre: "Luis Peña", contrato: "Término fijo", estado: "Activo" },
  { id: "3", nombre: "Marta Gómez", contrato: "Prácticas", estado: "Inactivo" },
  { id: "4", nombre: "Pedro Gil", contrato: "Aprendizaje", estado: "Activo" },
];

function mount(attrs = ""): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}></nx-grid>`;
  const el = document.querySelector("nx-grid")!;
  el.columns = [{ key: "nombre", label: "Nombre" }, CONTRATO, ESTADO];
  el.rows = ROWS;
  return el;
}
const cell = (el: NxGrid, r: number, c: number) => el.querySelector<HTMLElement>(`[data-r="${r}"] > [data-c="${c}"]`)!;
const dotAttrs = (x: Element | null) => {
  const d = x?.querySelector(".nx-grid__dot");
  return d ? (d.getAttribute("data-tone") ?? `cat ${d.getAttribute("data-cat")}`) : null;
};

describe("dotOf", () => {
  it("el tono de la opción; con `dot` y sin tono, uno de ocho por su lugar; sin nada, ninguno", () => {
    expect(dotOf(CONTRATO, "Indefinido")).toEqual({ cat: 0 });
    expect(dotOf(CONTRATO, "Obra o labor")).toEqual({ cat: 2 });
    expect(dotOf(CONTRATO, "Prácticas")).toEqual({ tone: "warning" });
    expect(dotOf(ESTADO, "Activo")).toEqual({ tone: "success" });
    // Sin `dot`, una opción sin tono no lleva punto.
    expect(dotOf({ ...CONTRATO, dot: false }, "Indefinido")).toBeNull();
    // Sin valor no hay punto, ni sin columna.
    expect(dotOf(CONTRATO, "")).toBeNull();
    expect(dotOf(undefined, "Indefinido")).toBeNull();
    // La opción novena vuelve al primer color.
    const many: GridColumn = { key: "x", label: "X", dot: true, options: Array.from({ length: 10 }, (_, i) => ({ value: `v${i}` })) };
    expect(dotOf(many, "v8")).toEqual({ cat: 0 });
    expect(dotOf(many, "v9")).toEqual({ cat: 1 });
  });

  it("un valor que no está en `options` toma su color del texto: el mismo siempre", () => {
    const a = dotOf(CONTRATO, "Aprendizaje");
    expect(a).toEqual(dotOf(CONTRATO, "Aprendizaje"));
    expect(a && "cat" in a && a.cat >= 0 && a.cat < 8).toBe(true);
    expect(dotOf({ key: "sede", label: "Sede", dot: true }, "Cali")).toEqual(dotOf({ key: "otra", label: "Otra", dot: true }, "Cali"));
  });
});

describe("nx-grid: puntos", () => {
  it("con `dot`, la celda lleva el punto antes del valor y no la píldora; sin `dot`, el tono sigue en píldora", () => {
    const el = mount();
    const c0 = cell(el, 0, 1);
    expect(c0.firstElementChild?.className).toBe("nx-grid__dot");
    expect(c0.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(c0.textContent).toBe("Indefinido");
    expect(dotAttrs(c0)).toBe("cat 0");
    expect(dotAttrs(cell(el, 1, 1))).toBe("cat 1");
    // Con tono, el punto es del tono; tampoco hay píldora.
    expect(dotAttrs(cell(el, 2, 1))).toBe("warning");
    expect(cell(el, 2, 1).querySelector(".nx-grid__pill")).toBeNull();
    // `status` sin `dot`: la píldora de siempre.
    expect(cell(el, 0, 2).querySelector(".nx-grid__pill")?.getAttribute("data-tone")).toBe("success");
    expect(cell(el, 0, 2).querySelector(".nx-grid__dot")).toBeNull();
  });

  it("una columna `status` con `dot` también va con punto", () => {
    document.body.innerHTML = "<nx-grid></nx-grid>";
    const el = document.querySelector("nx-grid")!;
    el.columns = [{ ...ESTADO, dot: true }];
    el.rows = ROWS;
    expect(cell(el, 0, 0).querySelector(".nx-grid__pill")).toBeNull();
    expect(dotAttrs(cell(el, 0, 0))).toBe("success");
    expect(dotAttrs(cell(el, 2, 0))).toBe("neutral");
  });

  it("el panel de filtros repite el punto: el de `dot` y el de las opciones con tono", () => {
    const el = mount("facets-open");
    const opt = (label: string) => [...el.querySelectorAll(".nx-grid__facets .nx-grid__opt")].find((o) => o.querySelector(".nx-grid__opt-label")?.textContent === label) ?? null;
    expect(dotAttrs(opt("Indefinido"))).toBe("cat 0");
    expect(dotAttrs(opt("Término fijo"))).toBe("cat 1");
    expect(dotAttrs(opt("Prácticas"))).toBe("warning");
    expect(dotAttrs(opt("Activo"))).toBe("success");
    expect(dotAttrs(opt("Inactivo"))).toBe("neutral");
    // Entre la casilla y el nombre.
    const parts = [...opt("Activo")!.children].map((x) => x.className || x.localName);
    expect(parts.slice(0, 3)).toEqual(["input", "nx-grid__dot", "nx-grid__opt-label"]);
  });

  it("el chip de un filtro con un solo valor lleva su punto; con varios, no", () => {
    const el = mount();
    el.filters = [{ key: "estado", op: "in", values: ["Activo"] }];
    const chip = () => el.querySelector(".nx-grid__chip")!;
    expect(dotAttrs(chip())).toBe("success");
    expect(chip().querySelector(".nx-grid__dot")!.nextSibling!.textContent).toContain("Activo");
    el.filters = [{ key: "contrato", op: "in", values: ["Término fijo"] }];
    expect(dotAttrs(chip())).toBe("cat 1");
    el.filters = [{ key: "estado", op: "in", values: ["Activo", "Inactivo"] }];
    expect(dotAttrs(chip())).toBeNull();
    // Una columna sin color (el nombre): sin punto.
    el.filters = [{ key: "nombre", op: "in", values: ["Ana Ríos"] }];
    expect(dotAttrs(chip())).toBeNull();
  });

  it("`dot` que no es booleano (BDUI) se toma como verdadero o falso", () => {
    document.body.innerHTML = "<nx-grid></nx-grid>";
    const el = document.querySelector("nx-grid")!;
    el.columns = [{ ...CONTRATO, dot: "sí" as unknown as boolean }];
    el.rows = ROWS;
    expect(el.columns[0].dot).toBe(true);
    expect(dotAttrs(cell(el, 0, 0))).toBe("cat 0");
  });
});

describe("nx-grid: ícono del título", () => {
  registerIcons({ "users-test": '<circle cx="12" cy="12" r="4"/>' });

  it("con `heading-icon` registrado, un cuadro con el ícono antes del título; el texto del título no cambia", () => {
    const el = mount('heading="Empleados" heading-icon="users-test"');
    const h = el.querySelector(".nx-grid__heading")!;
    const tile = h.firstElementChild!;
    expect(tile.className).toBe("nx-grid__heading-icon nx-page-title__icon");
    expect(tile.getAttribute("aria-hidden")).toBe("true");
    expect(tile.querySelector(".nx-icon svg")).not.toBeNull();
    expect(h.textContent).toBe("Empleados");
    // Repintar no rehace el ícono (el mismo nodo).
    el.filters = [{ key: "estado", op: "in", values: ["Activo"] }];
    expect(el.querySelector(".nx-grid__heading")!.firstElementChild).toBe(tile);
    // Cambiar el título conserva el ícono.
    el.heading = "Personas";
    expect(el.querySelector(".nx-grid__heading")!.textContent).toBe("Personas");
    expect(el.querySelector(".nx-grid__heading-icon .nx-icon svg")).not.toBeNull();
    // Quitarlo deja solo el texto.
    el.headingIcon = null;
    expect(el.querySelector(".nx-grid__heading-icon")).toBeNull();
    expect(el.querySelector(".nx-grid__heading")!.textContent).toBe("Personas");
  });

  it("un nombre que no está registrado no pinta nada (ni iniciales que se leerían con el título)", () => {
    const el = mount('heading="Empleados" heading-icon="no-existe"');
    expect(el.querySelector(".nx-grid__heading-icon")).toBeNull();
    expect(el.querySelector(".nx-grid__heading")!.textContent).toBe("Empleados");
  });

  it("sin `heading`, `heading-icon` no pinta nada", () => {
    const el = mount('heading-icon="users-test"');
    expect(el.querySelector(".nx-grid__heading")).toBeNull();
    expect(el.querySelector(".nx-grid__heading-icon")).toBeNull();
  });
});
