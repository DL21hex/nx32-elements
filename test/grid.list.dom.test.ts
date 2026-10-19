// @vitest-environment happy-dom
// <nx-grid> como lista (`narrow`): cuando el componente mide menos de 480 px, cada fila es un
// renglón de dos líneas que se abre con un toque. happy-dom no maqueta: el ancho se simula
// (`getBoundingClientRect`) y el observador de tamaño se dispara a mano.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/grid/index";
import type { GridColumn, GridRow, NxGrid } from "../src/components/grid/index";

const COLS: GridColumn[] = [
  { key: "nombre", label: "Nombre", avatar: true, sticky: true },
  { key: "doc", label: "Documento" },
  { key: "cargo", label: "Cargo" },
  { key: "area", label: "Área", dot: true },
  { key: "estado", label: "Estado", type: "status", options: [{ value: "Activo", tone: "success" }, { value: "Retirado" }] },
  { key: "salario", label: "Salario", type: "money", editable: true },
];
const ROWS: GridRow[] = Array.from({ length: 300 }, (_, i) => ({
  id: String(i + 1),
  nombre: `Persona ${i + 1} Pérez`,
  doc: String(1000 + i),
  cargo: i % 2 ? "Operario" : "Analista",
  area: i % 3 ? "Cosecha" : "Empaque",
  estado: i % 10 ? "Activo" : "Retirado",
  salario: 1_500_000 + i * 1000,
}));

let width = 390;
let fire: (() => void) | null = null;
/** Un observador de tamaño que se dispara a mano. */
class FakeRO {
  constructor(cb: ResizeObserverCallback) {
    fire = () => cb([], this as unknown as ResizeObserver);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function mount(opts: { width?: number; attrs?: Record<string, string>; columns?: GridColumn[]; rows?: GridRow[] } = {}): NxGrid {
  width = opts.width ?? 390;
  vi.stubGlobal("ResizeObserver", FakeRO);
  document.body.innerHTML = "";
  const el = document.createElement("nx-grid");
  el.getBoundingClientRect = () => ({ width, height: 600, top: 0, left: 0, right: width, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  for (const [k, v] of Object.entries(opts.attrs ?? {})) el.setAttribute(k, v);
  el.columns = opts.columns ?? COLS;
  el.rows = opts.rows ?? ROWS;
  document.body.append(el);
  return el;
}
const resize = (w: number) => {
  width = w;
  fire!();
};
const row = (el: NxGrid, r: number) => el.querySelector<HTMLElement>(`.nx-grid__rows > [data-r="${r}"]`)!;
const scroller = (el: NxGrid) => el.querySelector<HTMLElement>(".nx-grid__scroll")!;
const key = (el: NxGrid, k: string, init: KeyboardEventInit = {}) => scroller(el).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
function tap(target: Element, init: MouseEventInit = {}): void {
  target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "touch" }));
  target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "touch" }));
  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, ...init }));
}
const opened = (el: NxGrid) => {
  const ids: string[] = [];
  el.addEventListener("nx-grid-open", (e) => ids.push(e.detail.id));
  return ids;
};

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("<nx-grid> como lista", () => {
  it("por debajo de 480 px cada fila es un renglón: título, dos datos, el estado y el punto", () => {
    const el = mount();
    expect(el.hasAttribute("data-list")).toBe(true);
    const r0 = row(el, 0);
    expect(r0.classList.contains("nx-grid__lrow")).toBe(true);
    expect(r0.querySelectorAll("[role=gridcell]").length).toBe(1);
    expect(r0.querySelector(".nx-grid__lt")!.textContent).toBe("Persona 1 Pérez");
    // Las iniciales, como en la celda: la primera letra de las dos primeras palabras.
    expect(r0.querySelector(".nx-grid__lav")!.textContent).toBe("P1");
    // Sin `list` en las columnas: debajo, las dos primeras de texto; a la derecha, el estado y el punto.
    expect(r0.querySelector(".nx-grid__lm")!.textContent).toBe("1000 · Analista");
    expect(r0.querySelector(".nx-grid__le .nx-grid__pill")!.textContent).toBe("Retirado");
    expect(r0.querySelector(".nx-grid__lem .nx-grid__dot")).not.toBeNull();
    expect(r0.querySelector(".nx-grid__lem")!.textContent).toBe("Empaque");
    expect(scroller(el).getAttribute("aria-colcount")).toBe("1");
  });

  it("con `list` en las columnas, van solo esas", () => {
    const el = mount({
      columns: [
        { key: "nombre", label: "Nombre", list: "title" },
        { key: "doc", label: "Documento" },
        { key: "cargo", label: "Cargo", list: "meta" },
        { key: "area", label: "Área", list: "meta" },
        { key: "salario", label: "Salario", type: "money", list: "end" },
        { key: "estado", label: "Estado", type: "status" },
      ],
    });
    const r1 = row(el, 1);
    expect(r1.querySelector(".nx-grid__lm")!.textContent).toBe("Operario · Cosecha");
    expect(r1.querySelector(".nx-grid__le")!.textContent).toContain("1.501.000");
    expect(r1.querySelector(".nx-grid__lem")).toBeNull();
    // Sin `avatar` y sin `selectable`, no hay círculo.
    expect(r1.querySelector(".nx-grid__lav")).toBeNull();
  });

  it("un `list` que no es un lugar se quita de la columna", () => {
    const el = mount({ columns: [{ key: "nombre", label: "Nombre", list: "arriba" as never }] });
    expect(el.columns[0].list).toBeUndefined();
  });

  it("virtualiza igual, con renglones de 60 px", () => {
    const el = mount();
    expect(el.querySelector<HTMLElement>(".nx-grid__body")!.style.blockSize).toBe(`${300 * 60}px`);
    expect(el.querySelectorAll(".nx-grid__rows > *").length).toBeLessThan(40);
  });

  it("un toque abre la fila, una sola vez aunque llegue un doble clic", () => {
    const el = mount();
    const ids = opened(el);
    const details: string[] = [];
    el.addEventListener("nx-grid-open", (e) => details.push(e.detail.key));
    tap(row(el, 2).querySelector(".nx-grid__lt")!);
    expect(ids).toEqual(["3"]);
    expect(details).toEqual(["nombre"]);
    // El segundo clic de un doble clic y el `dblclick` no la abren otra vez.
    row(el, 2).querySelector(".nx-grid__lt")!.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
    row(el, 2).querySelector(".nx-grid__lt")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(ids).toEqual(["3"]);
  });

  it("con `href`, el renglón es el enlace y Enter lo sigue", () => {
    const el = mount({
      columns: [{ key: "nombre", label: "Nombre", href: "url", newTab: true }, ...COLS.slice(1)],
      rows: ROWS.slice(0, 5).map((r) => ({ ...r, url: `/personas/${r.id}` })),
    });
    const a = row(el, 0).querySelector<HTMLAnchorElement>("a.nx-grid__lmain")!;
    expect(a.getAttribute("href")).toBe("/personas/1");
    expect(a.getAttribute("target")).toBe("_blank");
    const click = vi.fn();
    a.click = click;
    key(el, "Enter");
    expect(click).toHaveBeenCalledOnce();
  });

  it("con `selectable`, el círculo es la casilla y, con algo marcado, tocar marca", () => {
    const el = mount();
    el.selectable = true;
    const ids = opened(el);
    const box = row(el, 0).querySelector<HTMLInputElement>(".nx-grid__lav input[data-pick]")!;
    box.click();
    expect(el.selected).toEqual(["1"]);
    expect(row(el, 0).classList.contains("is-picked")).toBe(true);
    tap(row(el, 1).querySelector(".nx-grid__lmain")!);
    expect(el.selected).toEqual(["1", "2"]);
    expect(ids).toEqual([]);
  });

  it("el teclado recorre las filas: Enter abre, Espacio marca; no edita ni borra", () => {
    const el = mount();
    el.selectable = true;
    const ids = opened(el);
    scroller(el).focus();
    key(el, "ArrowDown");
    key(el, "ArrowDown");
    key(el, "ArrowRight");
    expect(el.querySelector(".nx-grid__litem.is-active")!.parentElement!.dataset.r).toBe("2");
    key(el, "Enter");
    expect(ids).toEqual(["3"]);
    key(el, " ");
    expect(el.selected).toEqual(["3"]);
    key(el, "5");
    key(el, "F2");
    key(el, "Delete");
    expect(el.querySelector(".nx-grid__input")).toBeNull();
    expect(el.rows[2].salario).toBe(1_502_000);
    // Fin va a la última fila (happy-dom no maqueta: se mira abriéndola).
    key(el, "End");
    key(el, "Enter");
    expect(ids).toEqual(["3", "300"]);
  });

  it("pegar no escribe en la lista", () => {
    const el = mount();
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { getData: () => "1\t2\t3\t4\t5\t999" } });
    scroller(el).dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(false);
    expect(el.rows[0].salario).toBe(1_500_000);
  });

  it("desde 480 px es tabla, y el borde no parpadea (vuelve a tabla desde 496)", () => {
    const el = mount({ width: 600 });
    expect(el.hasAttribute("data-list")).toBe(false);
    expect(row(el, 0).querySelectorAll("[data-c]").length).toBe(COLS.length);
    resize(470);
    expect(el.hasAttribute("data-list")).toBe(true);
    resize(490);
    expect(el.hasAttribute("data-list")).toBe(true);
    resize(500);
    expect(el.hasAttribute("data-list")).toBe(false);
    resize(485);
    expect(el.hasAttribute("data-list")).toBe(false);
    // Oculta (ancho 0) no cambia.
    resize(0);
    expect(el.hasAttribute("data-list")).toBe(false);
  });

  it('`narrow="table"` la deja como tabla', () => {
    const el = mount({ attrs: { narrow: "table" } });
    expect(el.narrow).toBe("table");
    expect(el.hasAttribute("data-list")).toBe(false);
    el.narrow = "list";
    expect(el.hasAttribute("narrow")).toBe(false);
    expect(el.hasAttribute("data-list")).toBe(true);
    el.narrow = "table";
    expect(el.hasAttribute("data-list")).toBe(false);
  });

  it("al cambiar de modo, la fila de arriba sigue arriba", () => {
    const el = mount();
    const s = scroller(el);
    Object.defineProperty(s, "scrollHeight", { configurable: true, get: () => 100_000 });
    Object.defineProperty(s, "clientHeight", { configurable: true, get: () => 500 });
    s.scrollTop = 50 * 60;
    resize(700);
    expect(s.scrollTop).toBe(50 * 32);
    resize(390);
    expect(s.scrollTop).toBe(50 * 60);
  });

  it("lo que se editaba en la tabla se guarda al pasar a lista", () => {
    const el = mount({ width: 700 });
    const cell = row(el, 0).querySelector<HTMLElement>('[data-c="5"]')!;
    cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" }));
    cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = el.querySelector<HTMLInputElement>(".nx-grid__input")!;
    input.value = "2000000";
    resize(390);
    expect(el.querySelector(".nx-grid__input")).toBeNull();
    expect(el.rows[0].salario).toBe(2_000_000);
  });

  it("los grupos son renglones con sus subtotales y se pliegan tocándolos", () => {
    const el = mount({ attrs: { "group-by": "area" } });
    const g = row(el, 0);
    expect(g.classList.contains("nx-grid__row--group")).toBe(true);
    expect(g.querySelector(".nx-grid__g-label")!.textContent).toBe("Cosecha");
    expect(g.querySelector(".nx-grid__g-n")!.textContent).toBe("200");
    expect(g.querySelector(".nx-grid__g-sums")!.textContent).toMatch(/^Salario \$/);
    g.querySelector(".nx-grid__g-sums")!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "touch" }));
    expect(row(el, 0).getAttribute("aria-expanded")).toBe("false");
    expect(row(el, 1).querySelector(".nx-grid__g-label")!.textContent).toBe("Empaque");
  });

  it("«Ordenar por» y su sentido aparecen solo en la lista", () => {
    const el = mount({ width: 700 });
    const sel = el.querySelector<HTMLSelectElement>(".nx-grid__sortby")!;
    const dir = el.querySelector<HTMLButtonElement>(".nx-grid__sortdir")!;
    expect(sel.hidden).toBe(true);
    resize(390);
    expect(sel.hidden).toBe(false);
    expect(sel.getAttribute("aria-label")).toBe("Ordenar por");
    expect(sel.options[0].textContent).toBe("Sin ordenar");
    expect(dir.hidden).toBe(true);
    sel.value = "salario";
    sel.dispatchEvent(new Event("change"));
    expect(el.sort).toEqual({ key: "salario", dir: 1 });
    expect(dir.hidden).toBe(false);
    expect(dir.getAttribute("aria-label")).toBe("Orden ascendente");
    dir.click();
    expect(el.sort).toEqual({ key: "salario", dir: -1 });
    expect(row(el, 0).querySelector(".nx-grid__lt")!.textContent).toBe("Persona 300 Pérez");
    sel.value = "";
    sel.dispatchEvent(new Event("change"));
    expect(el.sort).toBeNull();
    expect(dir.hidden).toBe(true);
  });

  it("las acciones de fila van al final del renglón y no abren la fila", () => {
    const el = mount();
    el.actions = [{ key: "ver", label: "Ver" }];
    const ids = opened(el);
    const acts: string[] = [];
    el.addEventListener("nx-grid-action", (e) => acts.push(e.detail.id));
    const btn = row(el, 0).querySelector<HTMLButtonElement>(".nx-grid__actions .nx-grid__act")!;
    tap(btn);
    expect(acts).toEqual(["1"]);
    expect(ids).toEqual([]);
    expect(scroller(el).getAttribute("aria-colcount")).toBe("2");
  });
});
