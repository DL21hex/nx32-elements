// @vitest-environment happy-dom
// <nx-grid>: el enlace de verdad de una celda (`href`), las columnas que empiezan escondidas
// (`hidden`) y las acciones de fila (`actions`).
//
// Un enlace es un `<a href>` para que el navegador (y el router de la app) lo traten como tal:
// otra pestaña con Ctrl/⌘+clic o la rueda, copiar el enlace, su menú. Por eso la tabla no emite
// `nx-grid-open` en una fila con dirección: abrirla es seguir el enlace. Una acción con `href`
// también es un enlace; la que no, un botón que emite `nx-grid-action`.
import { afterEach, describe, expect, it } from "vitest";
import "../src/index";
import type { GridAction, GridColumn, GridRow, NxGrid } from "../src/index";

afterEach(() => {
  document.body.innerHTML = "";
});

const ROWS: GridRow[] = [
  { id: "1", oc: "OC-1", prov: "Aceros", url: "/compras/1", pdf: "/compras/1.pdf", can_void: true },
  { id: "2", oc: "OC-2", prov: "Bolsas", url: "", pdf: "/compras/2.pdf", can_void: false },
  { id: "3", oc: "OC-3", prov: "Aceros", url: "javascript:alert(1)", pdf: "javascript:alert(1)", can_void: "0" },
  { id: "4", oc: "OC-4", prov: "Cables", url: "/compras/4", can_void: 1 },
];

function mount(cols: GridColumn[], actions?: GridAction[], attrs = ""): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}></nx-grid>`;
  const el = document.querySelector("nx-grid")!;
  el.columns = cols;
  if (actions) el.actions = actions;
  el.rows = ROWS;
  return el;
}

const LINK_COLS: GridColumn[] = [
  { key: "oc", label: "Pedido", href: "url" },
  { key: "prov", label: "Proveedor" },
];
const scroll = (el: NxGrid) => el.querySelector<HTMLElement>(".nx-grid__scroll")!;
const cell = (el: NxGrid, r: number, c: number) => el.querySelector<HTMLElement>(`[data-r="${r}"] > [data-c="${c}"]`)!;
const key = (el: NxGrid, k: string, init: KeyboardEventInit = {}) => scroll(el).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...init }));
const heads = (el: NxGrid) => [...el.querySelectorAll(".nx-grid__th-label")].map((x) => x.textContent);
/** Los clics que llegan a un enlace, sin dejar que happy-dom navegue. */
function clicks(el: NxGrid): string[] {
  const seen: string[] = [];
  el.addEventListener("click", (e) => {
    const a = (e.target as Element).closest("a");
    if (a) {
      seen.push(a.getAttribute("href")!);
      e.preventDefault();
    }
  });
  return seen;
}
function events(el: NxGrid, type: string): CustomEvent[] {
  const out: CustomEvent[] = [];
  el.addEventListener(type, (e) => out.push(e as CustomEvent));
  return out;
}
async function until<T>(fn: () => T | null | undefined | false): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("no llegó");
}
async function menuOn(el: NxGrid, r: number, c: number): Promise<HTMLButtonElement[]> {
  el.querySelector(".nx-grid__menu")?.replaceChildren();
  const target = cell(el, r, c);
  const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
  target.dispatchEvent(ev);
  await until(() => el.querySelector(".nx-grid__menu-item"));
  return [...el.querySelectorAll<HTMLButtonElement>(".nx-grid__menu-item")];
}

describe("<nx-grid>: columna con `href`", () => {
  it("la fila con dirección segura pinta un <a href> fuera del Tab; sin ella (o con javascript:), el enlace de siempre", () => {
    const el = mount(LINK_COLS);
    const a = cell(el, 0, 0).querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/compras/1");
    expect(a.className).toBe("nx-grid__link");
    expect(a.getAttribute("tabindex")).toBe("-1");
    expect(a.hasAttribute("target")).toBe(false);
    expect(a.textContent).toBe("OC-1");
    for (const r of [1, 2]) {
      expect(cell(el, r, 0).querySelector("a")).toBeNull();
      expect(cell(el, r, 0).querySelector("span.nx-grid__link")!.textContent).toBe(`OC-${r + 1}`);
    }
  });

  it("newTab: target=_blank con rel=noopener noreferrer", () => {
    const el = mount([{ key: "oc", label: "Pedido", href: "url", newTab: true }]);
    const a = cell(el, 0, 0).querySelector("a")!;
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("clic en el enlace: lo sigue el navegador y no emite nx-grid-open; sin dirección, sí lo emite", () => {
    const el = mount(LINK_COLS);
    const seen = clicks(el);
    const opened = events(el, "nx-grid-open");
    cell(el, 0, 0).querySelector("a")!.click();
    expect(seen).toEqual(["/compras/1"]);
    expect(opened).toHaveLength(0);
    cell(el, 1, 0).querySelector<HTMLElement>(".nx-grid__link")!.click();
    expect(opened).toHaveLength(1);
    expect(opened[0].detail.id).toBe("2");
  });

  it("Enter (o doble clic en otra celda) abre la fila siguiendo su enlace; una fila sin enlace emite nx-grid-open", () => {
    const el = mount(LINK_COLS);
    const seen = clicks(el);
    const opened = events(el, "nx-grid-open");
    scroll(el).focus();
    key(el, "ArrowRight"); // la columna Proveedor, sin enlace: igual se sigue el de la fila
    key(el, "Enter");
    expect(seen).toEqual(["/compras/1"]);
    expect(opened).toHaveLength(0);
    key(el, "ArrowDown");
    key(el, "Enter");
    expect(opened.map((e) => e.detail.id)).toEqual(["2"]);
    cell(el, 3, 1).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
    cell(el, 3, 1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(seen).toEqual(["/compras/1", "/compras/4"]);
  });

  it("clic derecho sobre el enlace: el menú del navegador (no se cancela); en otra celda, el de la tabla", async () => {
    const el = mount(LINK_COLS);
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    cell(el, 0, 0).querySelector("a")!.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    const items = await menuOn(el, 0, 1);
    expect(items[0].textContent).toBe("Solo «Aceros»");
  });

  it("un `href` que no es texto se descarta (la columna queda como texto)", () => {
    const el = mount([{ key: "oc", label: "Pedido", href: 5 as unknown as string }]);
    expect(el.columns[0].href).toBeUndefined();
    expect(cell(el, 0, 0).querySelector(".nx-grid__link")).toBeNull();
  });
});

describe("<nx-grid>: columnas `hidden`", () => {
  const COLS: GridColumn[] = [
    { key: "oc", label: "Pedido" },
    { key: "prov", label: "Proveedor", hidden: true },
    { key: "url", label: "Dirección" },
  ];

  it("empiezan escondidas, en `view.hidden`, y siguen en `columns`", () => {
    const el = mount(COLS);
    expect(heads(el)).toEqual(["Pedido", "Dirección"]);
    expect(el.view.hidden).toEqual(["prov"]);
    expect(el.columns).toHaveLength(3);
  });

  it("reasignar las columnas no vuelve a esconder la que la persona mostró; una nueva `hidden`, sí", () => {
    const el = mount(COLS);
    el.view = { hidden: [] };
    expect(heads(el)).toEqual(["Pedido", "Proveedor", "Dirección"]);
    el.columns = [...COLS, { key: "pdf", label: "PDF", hidden: true }];
    expect(heads(el)).toEqual(["Pedido", "Proveedor", "Dirección"]);
    expect(el.view.hidden).toEqual(["pdf"]);
  });

  it("una vista sin `hidden` (la tabla original) deja escondidas las declaradas; con `hidden: []`, todas a la vista", () => {
    const el = mount(COLS);
    el.view = { hidden: [] };
    el.view = { filters: [] };
    expect(heads(el)).toEqual(["Pedido", "Dirección"]);
    el.view = { hidden: ["url"] };
    expect(heads(el)).toEqual(["Pedido", "Proveedor"]);
  });

  it("restablecer columnas vuelve a esconder las declaradas, y lo dice", async () => {
    const el = mount(COLS);
    el.view = { hidden: [] };
    [...el.querySelectorAll<HTMLButtonElement>(".nx-grid__bar .nx-grid__btn")].find((b) => b.textContent === "Columnas")!.click();
    const cpop = await until(() => [...el.querySelectorAll<HTMLElement>(".nx-grid__vpop")][1]?.querySelector("input[data-col]") && [...el.querySelectorAll<HTMLElement>(".nx-grid__vpop")][1]);
    const reset = cpop.querySelector<HTMLButtonElement>(".nx-grid__clear")!;
    expect(reset.textContent).toBe("Volver a las columnas de la tabla, con su ancho original");
    reset.click();
    expect(heads(el)).toEqual(["Pedido", "Dirección"]);
  });
});

describe("<nx-grid>: acciones de fila", () => {
  const COLS: GridColumn[] = [
    { key: "oc", label: "Pedido" },
    { key: "prov", label: "Proveedor" },
  ];
  const ACTIONS: GridAction[] = [
    { key: "pdf", label: "Descargar PDF", icon: "download", href: "pdf", newTab: true, download: true },
    { key: "edit", label: "Editar" },
    { key: "void", label: "Anular", tone: "danger", when: "can_void" },
  ];
  const acts = (el: NxGrid, r: number) => [...el.querySelectorAll<HTMLElement>(`[data-r="${r}"] > .nx-grid__actions .nx-grid__act`)];

  it("una columna fija al final: cabecera para lectores de pantalla, su ancho en la plantilla y en aria-colcount", () => {
    const el = mount(COLS, ACTIONS);
    const th = el.querySelector(".nx-grid__head > .nx-grid__actions")!;
    expect(th.getAttribute("role")).toBe("columnheader");
    expect(th.getAttribute("aria-colindex")).toBe("3");
    expect(th.textContent).toBe("Acciones");
    expect(scroll(el).getAttribute("aria-colcount")).toBe("3");
    // 30 (ícono) + 18 + 6·7 («Editar») + 18 + 6·7 («Anular») + 14.
    expect(scroll(el).style.getPropertyValue("--_cols")).toMatch(/ 164px$/);
    const td = el.querySelector('[data-r="0"] > .nx-grid__actions')!;
    expect(td.getAttribute("role")).toBe("gridcell");
    expect(td.getAttribute("aria-colindex")).toBe("3");
    // No es una columna de datos: ni `columns`, ni la cabecera de etiquetas.
    expect(el.columns.map((c) => c.key)).toEqual(["oc", "prov"]);
    expect(heads(el)).toEqual(["Pedido", "Proveedor"]);
  });

  it("el texto de la cabecera sigue a `labels`", () => {
    const el = mount(COLS, ACTIONS);
    el.labels = { actions: "Actions" };
    expect(el.querySelector(".nx-grid__head > .nx-grid__actions")!.textContent).toBe("Actions");
  });

  it("abrir la fila prueba la siguiente columna `href` si la primera viene vacía", () => {
    const el = mount([
      { key: "vacia", label: "Vacía", href: "url" },
      { key: "oc", label: "Pedido", href: "url" },
    ]);
    const seen = clicks(el);
    scroll(el).focus();
    key(el, "Enter");
    expect(seen).toEqual(["/compras/1"]);
  });

  it("cada fila trae las suyas: `when` las filtra y una acción `href` sin dirección segura no sale", () => {
    const el = mount(COLS, ACTIONS);
    expect(acts(el, 0).map((a) => a.dataset.act)).toEqual(["pdf", "edit", "void"]);
    expect(acts(el, 1).map((a) => a.dataset.act)).toEqual(["pdf", "edit"]);
    expect(acts(el, 2).map((a) => a.dataset.act)).toEqual(["edit"]);
    expect(acts(el, 3).map((a) => a.dataset.act)).toEqual(["edit", "void"]);
  });

  it("con `href`, un enlace (pestaña nueva, descarga, solo ícono con su nombre); sin él, un botón", () => {
    const el = mount(COLS, ACTIONS);
    const [pdf, edit, kill] = acts(el, 0);
    expect(pdf.tagName).toBe("A");
    expect(pdf.getAttribute("href")).toBe("/compras/1.pdf");
    expect(pdf.getAttribute("target")).toBe("_blank");
    expect(pdf.getAttribute("rel")).toBe("noopener noreferrer");
    expect(pdf.hasAttribute("download")).toBe(true);
    expect(pdf.getAttribute("aria-label")).toBe("Descargar PDF");
    expect(pdf.getAttribute("title")).toBe("Descargar PDF");
    expect(pdf.getAttribute("tabindex")).toBe("-1");
    expect(edit.tagName).toBe("BUTTON");
    expect(edit.textContent).toBe("Editar");
    expect(edit.hasAttribute("aria-label")).toBe(false);
    expect(kill.dataset.tone).toBe("danger");
  });

  it("el botón emite nx-grid-action con la acción y la fila; el enlace no emite nada", () => {
    const el = mount(COLS, ACTIONS);
    const seen = clicks(el);
    const fired = events(el, "nx-grid-action");
    const opened = events(el, "nx-grid-open");
    acts(el, 3)[1].click();
    expect(fired).toHaveLength(1);
    expect(fired[0].detail).toMatchObject({ action: "void", id: "4", row: { oc: "OC-4" } });
    acts(el, 0)[0].click();
    expect(seen).toEqual(["/compras/1.pdf"]);
    expect(fired).toHaveLength(1);
    expect(opened).toHaveLength(0);
  });

  it("tocar la columna de acciones deja el foco en la tabla y su fila como la activa", () => {
    const el = mount(COLS, ACTIONS);
    const btn = acts(el, 2)[0];
    const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" });
    btn.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(scroll(el));
    expect(scroll(el).getAttribute("aria-activedescendant")).toBe(cell(el, 2, 0).id);
  });

  it("con el teclado, en el menú de la celda (Mayús+F10): las acciones primero, después los filtros", async () => {
    const el = mount(COLS, ACTIONS);
    const seen = clicks(el);
    const fired = events(el, "nx-grid-action");
    scroll(el).focus();
    key(el, "F10", { shiftKey: true });
    await until(() => el.querySelector(".nx-grid__menu-item"));
    const items = [...el.querySelectorAll<HTMLButtonElement>(".nx-grid__menu-item")];
    expect(items.map((b) => b.textContent)).toEqual(["Descargar PDF", "Editar", "Anular", "Contiene «OC-1»", "Más filtros de Pedido…"]);
    expect(el.querySelector(".nx-grid__menu > hr")).not.toBeNull();
    expect(items[2].dataset.tone).toBe("danger");
    items[1].click();
    expect(fired.map((e) => e.detail.action)).toEqual(["edit"]);
    // La acción que es enlace se sigue con el clic del enlace de la fila.
    const again = await menuOn(el, 0, 0);
    again[0].click();
    expect(seen).toEqual(["/compras/1.pdf"]);
  });

  it("una columna que no se filtra igual ofrece las acciones de la fila", async () => {
    const el = mount([{ key: "oc", label: "Pedido", filter: false }], ACTIONS);
    const items = await menuOn(el, 1, 0);
    expect(items.map((b) => b.textContent)).toEqual(["Descargar PDF", "Editar"]);
    expect(el.querySelector(".nx-grid__menu")!.getAttribute("aria-label")).toBe("Acciones de la fila");
  });

  it("no cuentan para «Buscar en la tabla», ni van en filas de grupo", () => {
    const el = mount(COLS, ACTIONS);
    el.search = "Editar";
    expect(el.querySelectorAll(".nx-grid__row:not(.nx-grid__row--group)[data-r]")).toHaveLength(0);
    el.search = "";
    el.groupBy = "prov";
    expect(el.querySelector(".nx-grid__row--group > .nx-grid__actions")).toBeNull();
    expect(el.querySelector(".nx-grid__row:not(.nx-grid__row--group) > .nx-grid__actions")).not.toBeNull();
  });

  it("lo que no tiene la forma se descarta (sin key, sin label, key repetida); asignarlas repinta", () => {
    const el = mount(COLS);
    expect(el.querySelector(".nx-grid__actions")).toBeNull();
    el.actions = [{ key: "a", label: "Uno" }, { key: "a", label: "Otra" }, { key: "", label: "Sin key" }, { label: "Sin key" } as GridAction, { key: "b" } as GridAction, { key: "c", label: "Tres", tone: "rojo" as "danger", href: 9 as unknown as string }];
    expect(el.actions).toEqual([{ key: "a", label: "Uno" }, { key: "c", label: "Tres" }]);
    expect(acts(el, 0).map((a) => a.textContent)).toEqual(["Uno", "Tres"]);
    el.setAttribute("actions", JSON.stringify([{ key: "z", label: "Zeta" }]));
    expect(acts(el, 0).map((a) => a.textContent)).toEqual(["Zeta"]);
  });
});
