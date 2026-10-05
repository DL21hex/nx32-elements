// @vitest-environment happy-dom
// Atajos de <nx-grid>: tarjetas con un filtro y su conteo sobre la tabla.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/grid/index";
import type { GridColumn, GridPreset, GridRow, NxGrid } from "../src/components/grid/index";

afterEach(() => vi.unstubAllGlobals());

const COLS: GridColumn[] = [
  { key: "oc", label: "Pedido" },
  { key: "estado", label: "Estado", type: "status", options: [{ value: "pend", label: "Pendiente" }, { value: "apr", label: "Aprobado" }] },
  { key: "monto", label: "Monto", type: "money" },
];
const ROWS: GridRow[] = [
  { id: "1", oc: "OC-1", estado: "pend", monto: 8_000_000 },
  { id: "2", oc: "OC-2", estado: "apr", monto: 1_000_000 },
  { id: "3", oc: "OC-3", estado: "apr", monto: 500_000 },
  { id: "4", oc: "OC-4", estado: "pend", monto: 3_000_000 },
];
const PRESETS: GridPreset[] = [
  { id: "pend", label: "Pendientes", hint: "por aprobar", filters: [{ key: "estado", op: "in", values: ["pend"] }] },
  { id: "grandes", label: "Grandes", filters: [{ key: "monto", op: "range", min: 2_000_000 }] },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const cards = (el: NxGrid) => [...el.querySelectorAll<HTMLButtonElement>(".nx-grid__preset")];
const pressed = (el: NxGrid) => cards(el).map((b) => b.getAttribute("aria-pressed"));

describe("nx-grid: atajos", () => {
  it("cuenta cada atajo sobre todas las filas; tocarlo filtra, y otra vez devuelve los filtros de antes", () => {
    document.body.innerHTML = "<nx-grid></nx-grid>";
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.rows = ROWS;
    el.filters = [{ key: "estado", op: "in", values: ["apr"] }];
    el.presets = PRESETS;
    expect(cards(el).map((b) => b.querySelector("strong")!.textContent)).toEqual(["2", "2"]);
    expect(cards(el)[0].textContent).toBe("2Pendientespor aprobar");
    expect(pressed(el)).toEqual(["false", "false"]);

    const seen = vi.fn();
    el.addEventListener("nx-grid-filter", seen);
    cards(el)[1].click();
    expect(el.filters).toEqual([{ key: "monto", op: "range", min: 2_000_000 }]);
    expect(pressed(el)).toEqual(["false", "true"]);
    expect(seen).toHaveBeenCalledTimes(1);
    // De un atajo a otro: el «antes» sigue siendo el de la persona.
    cards(el)[0].click();
    expect(pressed(el)).toEqual(["true", "false"]);
    cards(el)[0].click();
    expect(el.filters).toEqual([{ key: "estado", op: "in", values: ["apr"] }]);
    expect(pressed(el)).toEqual(["false", "false"]);
  });

  it("se desmarca solo si la persona cambia los filtros; y se marca si llega a los del atajo por otro camino", () => {
    document.body.innerHTML = "<nx-grid></nx-grid>";
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.rows = ROWS;
    el.presets = PRESETS;
    cards(el)[0].click();
    el.filters = [{ key: "estado", op: "in", values: ["apr"] }];
    expect(pressed(el)).toEqual(["false", "false"]);
    el.filters = [{ op: "range", min: 2_000_000, key: "monto" } as never];
    expect(pressed(el)).toEqual(["false", "true"]);
  });

  it("los conteos cambian con los datos, y sin atajos no hay barra", () => {
    document.body.innerHTML = "<nx-grid></nx-grid>";
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.rows = ROWS;
    const bar = el.querySelector<HTMLElement>(".nx-grid__presets")!;
    expect(bar.hidden).toBe(true);
    el.presets = PRESETS;
    expect(bar.hidden).toBe(false);
    el.rows = [...ROWS, { id: "5", oc: "OC-5", estado: "pend", monto: 9_000_000 }];
    expect(cards(el).map((b) => b.querySelector("strong")!.textContent)).toEqual(["3", "3"]);
  });

  it("con `source`, los conteos llegan del servidor (y mientras tanto, «—»)", async () => {
    let answer!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (answer = r))));
    document.body.innerHTML = '<nx-grid source="/datos"></nx-grid>';
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.presets = PRESETS;
    await sleep(10);
    expect(cards(el).map((b) => b.querySelector("strong")!.textContent)).toEqual(["—", "—"]);
    answer(new Response(JSON.stringify({ rows: ROWS, total: 4, presets: { pend: 1520, grandes: 7, otro: 3 } })));
    await sleep(10);
    expect(cards(el).map((b) => b.querySelector("strong")!.textContent)).toEqual(["1.520", "7"]);
  });

  it("`tone` llega a la tarjeta; sin tono, `neutral` o uno que no existe, nada", () => {
    document.body.innerHTML = "<nx-grid></nx-grid>";
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.rows = ROWS;
    el.presets = [
      { ...PRESETS[0], tone: "warning" },
      PRESETS[1],
      { id: "n", label: "Neutro", tone: "neutral", filters: [] },
      { id: "x", label: "Raro", tone: "fucsia" as never, filters: [] },
    ];
    expect(cards(el).map((b) => b.dataset.tone ?? null)).toEqual(["warning", null, null, null]);
    expect(el.presets[3]).not.toHaveProperty("tone");
    // Cambiar solo el tono vuelve a pintar.
    el.presets = [{ ...PRESETS[0], tone: "danger" }, PRESETS[1]];
    expect(cards(el)[0].dataset.tone).toBe("danger");
  });
});

/** El menú de Vistas se carga aparte: espera a que aparezca con algo adentro. */
async function until<T>(fn: () => T | null | undefined | false): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const v = fn();
    if (v) return v;
    await sleep(10);
  }
  throw new Error("no llegó");
}
function mount(attrs = ""): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}></nx-grid>`;
  const el = document.querySelector("nx-grid")!;
  el.columns = COLS;
  el.rows = ROWS;
  return el;
}

describe("nx-grid: título, «Seguimiento» y el total", () => {
  it("heading: el título en la primera fila, con su nivel, y los atajos como botones a su lado", () => {
    const el = mount('heading="Pedidos"');
    el.presets = PRESETS;
    const top = el.querySelector<HTMLElement>(".nx-grid__top")!;
    expect(top.hidden).toBe(false);
    expect(top.hasAttribute("data-heading")).toBe(true);
    expect(top.querySelector("h2.nx-grid__heading")!.textContent).toBe("Pedidos");
    // La flecha dice que llevan a algún lado; marcado, la ✕ que se quita.
    expect(cards(el).every((b) => b.querySelector(".nx-grid__preset-go .nx-glyph"))).toBe(true);
    const glyphOf = (b: HTMLButtonElement) => b.querySelector(".nx-grid__preset-go")!.innerHTML;
    const arrow = glyphOf(cards(el)[0]);
    cards(el)[0].click();
    expect(pressed(el)).toEqual(["true", "false"]);
    expect(glyphOf(cards(el)[0])).not.toBe(arrow);
    expect(glyphOf(cards(el)[1])).toBe(arrow);
    // Es el título de la página: h1. El nodo se cambia, el texto sigue.
    el.headingLevel = 1;
    expect(el.getAttribute("heading-level")).toBe("1");
    expect(top.querySelectorAll(".nx-grid__heading").length).toBe(1);
    expect(top.querySelector("h1.nx-grid__heading")!.textContent).toBe("Pedidos");
    // Sin título, los atajos vuelven a ser tarjetas, sin flecha.
    el.heading = null;
    expect(top.querySelector(".nx-grid__heading")).toBeNull();
    expect(top.hasAttribute("data-heading")).toBe(false);
    expect(el.querySelector(".nx-grid__preset-go")).toBeNull();
    // Sin título ni tarjetas, la fila no se ve.
    el.presets = [];
    expect(top.hidden).toBe(true);
  });

  it("menu: el atajo va en «Vistas» → «Seguimiento», sin conteo; se marca y se quita como una tarjeta", async () => {
    const el = mount();
    el.presets = [PRESETS[0], { ...PRESETS[1], menu: true }];
    // Una sola tarjeta: la de menú no se pinta ni se cuenta.
    expect(cards(el).map((b) => b.dataset.preset)).toEqual(["pend"]);
    // Sin `views-storage` el botón «Vistas» aparece igual, porque hay «Seguimiento».
    const btn = el.querySelector<HTMLButtonElement>(".nx-grid__views")!;
    expect(btn.hidden).toBe(false);
    btn.click();
    const item = await until(() => el.querySelector<HTMLButtonElement>('.nx-grid__vpop [data-preset="grandes"]'));
    const pop = el.querySelector<HTMLElement>(".nx-grid__vpop")!;
    // Solo el grupo: sin vistas guardadas ni «Guardar como vista».
    expect(pop.querySelector(".nx-grid__v-group")!.textContent).toBe("Seguimiento");
    expect(pop.querySelectorAll(".nx-grid__menu-item").length).toBe(1);
    expect(item.textContent).toBe("Grandes");
    expect(item.textContent).not.toMatch(/\d/);
    el.filters = [{ key: "estado", op: "in", values: ["apr"] }];
    item.click();
    expect(el.filters).toEqual([{ key: "monto", op: "range", min: 2_000_000 }]);
    // Otra vez: vuelven los filtros de antes, y el renglón lo dice.
    btn.click();
    const again = await until(() => el.querySelector<HTMLButtonElement>('.nx-grid__vpop [data-preset="grandes"][aria-current="true"]'));
    again.click();
    expect(el.filters).toEqual([{ key: "estado", op: "in", values: ["apr"] }]);
    // Un `menu` que no es booleano se vuelve booleano.
    el.setAttribute("presets", JSON.stringify([{ ...PRESETS[1], menu: 1 }]));
    expect(el.presets[0].menu).toBe(true);
  });

  it("con `views-storage`, «Seguimiento» va debajo de las vistas guardadas", async () => {
    localStorage.removeItem("t-seg");
    const el = mount('views-storage="t-seg"');
    el.presets = [{ ...PRESETS[0], menu: true }];
    el.querySelector<HTMLButtonElement>(".nx-grid__views")!.click();
    const pop = await until(() => el.querySelector<HTMLElement>(".nx-grid__vpop:has(.nx-grid__v-group)") ?? (el.querySelector(".nx-grid__vpop .nx-grid__v-group") && el.querySelector<HTMLElement>(".nx-grid__vpop")));
    const order = [...pop.children].map((c) => c.className || c.localName);
    expect(order.indexOf("nx-grid__v-text")).toBeLessThan(order.indexOf("nx-grid__v-group"));
    expect(pop.textContent).toContain("Guardar como vista nueva…");
    expect(pop.querySelector('[data-preset="pend"]')!.textContent).toBe("Pendientes · por aprobar");
  });

  it("el total va arriba, con los filtros; un solo «Limpiar todo» y el pie solo si tiene algo", () => {
    const el = mount("facets-open");
    const chips = el.querySelector<HTMLElement>(".nx-grid__chips")!;
    expect(chips.hidden).toBe(false);
    expect(chips.querySelector(".nx-grid__count")!.textContent).toBe("4 filas");
    expect(chips.querySelector(".nx-grid__count strong")!.textContent).toBe("4");
    expect(chips.querySelector(".nx-grid__clear")).toBeNull();
    // Hay montos: el pie trae su total.
    const foot = el.querySelector<HTMLElement>(".nx-grid__foot")!;
    expect(foot.hidden).toBe(false);
    expect(foot.textContent).not.toContain("filas");
    el.filters = [{ key: "estado", op: "in", values: ["pend"] }];
    expect(chips.querySelector(".nx-grid__count")!.textContent).toBe("2 de 4 filas");
    expect(el.querySelectorAll(".nx-grid__clear[data-clear]").length).toBe(1);
    expect(el.querySelector(".nx-grid__facets-head .nx-grid__clear")).toBeNull();
    // Sin montos ni rango marcado, el pie no ocupa nada.
    el.columns = COLS.slice(0, 2);
    expect(foot.hidden).toBe(true);
  });

  it('height="fill" no fija un alto en px; un número sí', () => {
    const el = mount('height="300"');
    expect(el.style.getPropertyValue("--nx-grid-height")).toBe("300px");
    el.height = "fill";
    expect(el.getAttribute("height")).toBe("fill");
    expect(el.style.getPropertyValue("--nx-grid-height")).toBe("");
  });
});
