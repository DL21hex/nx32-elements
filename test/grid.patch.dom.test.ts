// @vitest-environment happy-dom
//
// <nx-grid> 0.17.0: una fila que cambió fuera de la tabla se parcha sin volver a pedirla toda
// (`patchRow`, `removeRow`), el error de un origen trae lo que dijo el servidor y un 4xx no se repite,
// y un origen que solo sirve el conjunto entero (`client-only`) nunca recibe un filtro.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GridColumn, GridErrorDetail, GridRow, NxGrid } from "../src/index";
import "../src/index";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const COLS: GridColumn[] = [
  { key: "oc", label: "Pedido" },
  { key: "prov", label: "Proveedor" },
  { key: "estado", label: "Estado", type: "status", options: [{ value: "pend", label: "Pendiente" }, { value: "apr", label: "Aprobado" }] },
  { key: "monto", label: "Monto", type: "money" },
];
const ROWS: GridRow[] = [
  { id: "1", oc: "OC-1", prov: "Aceros", estado: "pend", monto: 300 },
  { id: "2", oc: "OC-2", prov: "Empaques", estado: "apr", monto: 100 },
  { id: "3", oc: "OC-3", prov: "Aceros", estado: "apr", monto: 200 },
];
const PRESETS = [
  { id: "pend", label: "Pendientes", filters: [{ key: "estado", op: "in" as const, values: ["pend"] }] },
  { id: "apr", label: "Aprobadas", filters: [{ key: "estado", op: "in" as const, values: ["apr"] }] },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const body = (call: unknown) => JSON.parse(((call as [string, RequestInit])[1].body as string) ?? "{}");
const column = (el: NxGrid, c: number) => [...el.querySelectorAll(`.nx-grid__row:not(.nx-grid__row--group) > [data-c="${c}"]`)].map((x) => x.textContent);
const count = (el: NxGrid) => el.querySelector(".nx-grid__chips .nx-grid__count")?.textContent;
const presetN = (el: NxGrid, id: string) => el.querySelector(`.nx-grid__preset[data-preset="${id}"] strong`)?.textContent;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

function mount(attrs = ""): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}></nx-grid>`;
  const el = document.querySelector("nx-grid")!;
  el.columns = COLS;
  el.presets = PRESETS;
  el.rows = ROWS;
  return el;
}

/** Una tabla con `source` que se arma antes de conectarse (como lo hace una app). */
function remote(attrs: Record<string, string>, setup?: (el: NxGrid) => void): NxGrid {
  const el = document.createElement("nx-grid");
  el.columns = COLS;
  setup?.(el);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

describe("patchRow y removeRow con las filas aquí", () => {
  it("reemplaza la fila por su id y recalcula filtros, conteos de atajos, orden, totales y shownIds", () => {
    const el = mount();
    el.sort = { key: "monto", dir: 1 };
    el.filters = [{ key: "estado", op: "in", values: ["apr"] }];
    expect(el.shownIds).toEqual(["2", "3"]);
    expect(presetN(el, "pend")).toBe("1");
    // La OC-1 se aprobó y subió de monto en su ficha.
    expect(el.patchRow({ id: "1", oc: "OC-1", prov: "Aceros", estado: "apr", monto: 150 })).toBe(true);
    expect(el.shownIds).toEqual(["2", "1", "3"]);
    expect(count(el)).toBe("3 de 3 filas");
    expect(presetN(el, "pend")).toBe("0");
    expect(presetN(el, "apr")).toBe("3");
    expect(column(el, 0)).toEqual(["OC-2", "OC-1", "OC-3"]);
    expect(el.rows.find((r) => r.id === "1")!.monto).toBe(150);
    // Sale del filtro: se va de la vista y el conteo baja.
    expect(el.patchRow({ id: "3", oc: "OC-3", prov: "Aceros", estado: "pend", monto: 200 })).toBe(true);
    expect(el.shownIds).toEqual(["2", "1"]);
    expect(count(el)).toBe("2 de 3 filas");
  });

  it("una fila que no estaba se agrega (va donde le toca con el orden); sin id no se toca nada", () => {
    const el = mount();
    el.sort = { key: "oc", dir: -1 };
    expect(el.patchRow({ id: "9", oc: "OC-9", prov: "Químicos", estado: "pend", monto: 50 })).toBe(true);
    expect(el.rows).toHaveLength(4);
    expect(el.shownIds[0]).toBe("9");
    expect(presetN(el, "pend")).toBe("2");
    expect(el.patchRow({ oc: "OC-10" })).toBe(false);
    expect(el.patchRow(null as unknown as GridRow)).toBe(false);
    expect(el.rows).toHaveLength(4);
  });

  it("removeRow quita la fila, la saca de la selección (con nx-grid-selection) y recalcula", () => {
    const el = mount("selectable");
    el.selected = ["1", "2"];
    const sel: unknown[] = [];
    el.addEventListener("nx-grid-selection", (e) => sel.push(e.detail));
    expect(el.removeRow("1")).toBe(true);
    expect(el.rows.map((r) => r.id)).toEqual(["2", "3"]);
    expect(el.selected).toEqual(["2"]);
    expect(sel).toEqual([{ ids: ["2"], count: 1 }]);
    expect(presetN(el, "pend")).toBe("0");
    expect(count(el)).toBe("2 filas");
    // Un id que no está: no hay nada que quitar y lo que se ve sigue exacto.
    expect(el.removeRow("nadie")).toBe(true);
    expect(el.removeRow(2)).toBe(true);
    expect(el.shownIds).toEqual(["3"]);
  });

  it("lo editado aquí de esa fila se olvida: lo que llega es lo guardado", () => {
    const el = mount();
    el.columns = COLS.map((c) => (c.key === "oc" ? { ...c, editable: true } : c));
    const scroller = el.querySelector<HTMLElement>(".nx-grid__scroll")!;
    scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "X", bubbles: true }));
    const input = el.querySelector<HTMLInputElement>(".nx-grid__input")!;
    input.value = "OC-1b";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(el.querySelector(".nx-grid__cell.is-edited")).not.toBeNull();
    expect(el.canUndo).toBe(true);
    el.patchRow({ id: "1", oc: "OC-1c", prov: "Aceros", estado: "pend", monto: 300 });
    expect(el.querySelector(".nx-grid__cell.is-edited")).toBeNull();
    expect(el.canUndo).toBe(false);
    expect(column(el, 0)[0]).toBe("OC-1c");
  });

  it("con client-max ya en el cliente también recalcula; un atajo que es enlace con conteo del servidor responde false", async () => {
    const all = ROWS.map((r) => ({ ...r }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        const q = JSON.parse(init.body as string);
        return json({ rows: all.slice(q.offset, q.offset + q.limit), total: all.length, presets: { pend: 1, apr: 2, otra: 7 } });
      }),
    );
    const el = remote({ source: "/datos", "client-max": "100" }, (g) => (g.presets = PRESETS));
    await sleep(30);
    expect(el.mode).toBe("client");
    expect(el.patchRow({ id: "2", oc: "OC-2", prov: "Empaques", estado: "pend", monto: 100 })).toBe(true);
    expect(presetN(el, "pend")).toBe("2");
    el.presets = [...PRESETS, { id: "otra", label: "Otra página", href: "/otra", filters: [] }];
    expect(el.patchRow({ id: "2", oc: "OC-2", prov: "Empaques", estado: "apr", monto: 100 })).toBe(false);
    expect(presetN(el, "pend")).toBe("1");
    expect(el.removeRow("2")).toBe(false);
  });
});

describe("patchRow y removeRow con la consulta en el servidor", () => {
  const ALL = Array.from({ length: 250 }, (_, i) => ({ id: String(i), oc: `OC-${i}`, prov: i % 2 ? "Aceros" : "Empaques", estado: i % 3 ? "pend" : "apr", monto: i }));
  const serve = () =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        const q = JSON.parse(init.body as string);
        return json({
          rows: ALL.slice(q.offset, q.offset + q.limit),
          total: ALL.length,
          facets: [{ key: "estado", options: [{ value: "pend", count: 166 }, { value: "apr", count: 84 }] }],
          totals: { monto: 31_125 },
        });
      }),
    );

  it("cambia la fila cargada en su lugar; exacta solo si no tocó nada de lo que calcula el servidor", async () => {
    serve();
    const el = remote({ source: "/datos" });
    await sleep(30);
    expect(el.mode).toBe("server");
    const calls = () => (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const before = calls();
    // Solo el proveedor: ni orden, ni filtro, ni faceta, ni total dependen de él.
    expect(el.patchRow({ ...ALL[1], prov: "Químicos" })).toBe(true);
    expect(column(el, 1)[1]).toBe("Químicos");
    // El estado es una faceta y el monto un total: los conteos del servidor ya no valen.
    expect(el.patchRow({ ...ALL[2], estado: "apr" })).toBe(false);
    expect(el.patchRow({ ...ALL[3], monto: 9 })).toBe(false);
    // Parchar no pide nada: «false» es para que la app llame a refresh().
    expect(calls()).toBe(before);
    // El orden también.
    el.sort = { key: "oc", dir: 1 };
    await sleep(300);
    expect(el.patchRow({ ...ALL[0], oc: "OC-zzz" })).toBe(false);
    // Una búsqueda puede sacarla por cualquier columna.
    el.sort = null;
    el.search = "OC";
    await sleep(300);
    expect(el.patchRow({ ...ALL[0], prov: "Otra" })).toBe(false);
  });

  it("una fila no cargada responde false sin tocar nada; removeRow siempre false", async () => {
    serve();
    const el = remote({ source: "/datos" });
    await sleep(30);
    expect(el.patchRow({ ...ALL[240], prov: "Químicos" })).toBe(false);
    expect(el.patchRow({ id: "nueva", oc: "OC-n" })).toBe(false);
    expect(el.removeRow("1")).toBe(false);
    expect(column(el, 0)[1]).toBe("OC-1");
  });
});

describe("nx-grid-error: status, message y body; un 4xx no se repite", () => {
  it("un 400 con JSON: el mensaje del servidor en el evento y en el aviso, una sola petición; «Reintentar» vuelve a pedir", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    let down = true;
    const fetch = vi.fn(async () => (down ? json({ error: "No tienes permiso para ver esta bandeja" }, 403) : json({ rows: [{ id: "1", oc: "OC-1" }], total: 1 })));
    vi.stubGlobal("fetch", fetch);
    const errors: GridErrorDetail[] = [];
    const el = remote({ source: "/datos" }, (g) => g.addEventListener("nx-grid-error", (e) => errors.push(e.detail)));
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([
      { offset: 0, limit: 100, error: "HTTP 403", status: 403, message: "No tienes permiso para ver esta bandeja", body: { error: "No tienes permiso para ver esta bandeja" }, attempt: 1, retrying: false },
    ]);
    const empty = el.querySelector<HTMLElement>(".nx-grid__empty")!;
    expect(empty.querySelector(".nx-grid__why")!.textContent).toBe("No tienes permiso para ver esta bandeja");
    // Desplazarse no lo vuelve a pedir (un 4xx no se arregla solo).
    el.querySelector<HTMLElement>(".nx-grid__scroll")!.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
    down = false;
    empty.querySelector<HTMLButtonElement>("[data-retry]")!.click();
    await vi.advanceTimersByTimeAsync(50);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(column(el, 0)).toEqual(["OC-1"]);
  });

  it("la red, un 5xx y un 429 sí se repiten; `message` del JSON cuando lo trae", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    for (const [answer, status, message] of [
      [() => Promise.reject(new TypeError("Failed to fetch")), 0, "Failed to fetch"],
      [async () => json({ message: "Mantenimiento" }, 503), 503, "Mantenimiento"],
      [async () => new Response("", { status: 429 }), 429, "HTTP 429"],
    ] as const) {
      document.body.innerHTML = "";
      const fetch = vi.fn(answer as () => Promise<Response>);
      vi.stubGlobal("fetch", fetch);
      const errors: GridErrorDetail[] = [];
      remote({ source: "/datos" }, (g) => g.addEventListener("nx-grid-error", (e) => errors.push(e.detail)));
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(fetch).toHaveBeenCalledTimes(5);
      expect(errors.map((e) => [e.status, e.message, e.attempt, e.retrying])).toEqual([
        [status, message, 1, true],
        [status, message, 2, true],
        [status, message, 3, true],
        [status, message, 4, true],
        [status, message, 5, false],
      ]);
    }
  });
});

describe("client-only: el origen solo sirve el conjunto entero", () => {
  const ALL = Array.from({ length: 40 }, (_, i) => ({ id: String(i), oc: `OC-${i}`, prov: i % 2 ? "Aceros" : "Empaques", estado: i % 4 ? "pend" : "apr", monto: 1000 }));
  /** Como `browser_grid` de nx32: un filtro, una búsqueda o un orden son 400. */
  const strict = () =>
    vi.fn(async (_u: string, init: RequestInit) => {
      const q = JSON.parse(init.body as string);
      if (q.filters.length || q.sort || q.search) return json({ error: "este origen no filtra" }, 400);
      return json({ rows: ALL.slice(q.offset, q.offset + q.limit), total: ALL.length });
    });

  it("con filtros recordados: una sola petición, sin filtros (limit = client-max + 1), y se filtra aquí", async () => {
    const fetch = strict();
    vi.stubGlobal("fetch", fetch);
    const errors: unknown[] = [];
    const el = remote({ source: "/datos", "client-max": "1000", "client-only": "" }, (g) => {
      g.filters = [{ key: "estado", op: "in", values: ["apr"] }];
      g.sort = { key: "oc", dir: -1 };
      g.addEventListener("nx-grid-error", (e) => errors.push(e.detail));
    });
    await sleep(30);
    expect(fetch.mock.calls.map(body)).toEqual([{ offset: 0, limit: 1001, sort: null, filters: [] }]);
    expect(errors).toEqual([]);
    expect(el.mode).toBe("client");
    expect(el.clientOnly).toBe(true);
    expect(count(el)).toBe("10 de 40 filas");
    // Ya en el cliente: filtrar, buscar y ordenar no piden nada; refresh() pide el conjunto otra vez.
    el.search = "OC-1";
    el.filters = [];
    await sleep(300);
    expect(fetch).toHaveBeenCalledTimes(1);
    el.refresh();
    await sleep(30);
    expect(fetch.mock.calls.map(body).at(-1)).toEqual({ offset: 0, limit: 1001, sort: null, filters: [] });
    expect(el.mode).toBe("client");
  });

  it("sin client-max trae hasta 20.000; filtrar mientras llega no lo vuelve a pedir", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const inner = strict();
    const fetch = vi.fn(async (u: string, init: RequestInit) => {
      await gate;
      return inner(u, init);
    });
    vi.stubGlobal("fetch", fetch);
    const el = remote({ source: "/datos", "client-only": "" });
    await sleep(10);
    el.filters = [{ key: "prov", op: "in", values: ["Aceros"] }];
    el.search = "OC";
    await sleep(300);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(body(fetch.mock.calls[0])).toEqual({ offset: 0, limit: 20_001, sort: null, filters: [] });
    release();
    await sleep(30);
    expect(el.mode).toBe("client");
    expect(count(el)).toBe("20 de 40 filas");
  });

  it("si falla, el error de un primer bloque (con su limit) y «Reintentar» lo vuelve a pedir entero", async () => {
    let down = true;
    const inner = strict();
    const fetch = vi.fn(async (u: string, init: RequestInit) => (down ? new Response("caído", { status: 500 }) : inner(u, init)));
    vi.stubGlobal("fetch", fetch);
    const errors: GridErrorDetail[] = [];
    const el = remote({ source: "/datos", "client-max": "50", "client-only": "" }, (g) => {
      g.filters = [{ key: "estado", op: "in", values: ["apr"] }];
      g.addEventListener("nx-grid-error", (e) => errors.push(e.detail));
    });
    await sleep(30);
    expect(errors[0]).toMatchObject({ offset: 0, limit: 51, status: 500, retrying: true });
    expect(el.querySelector(".nx-grid__empty")!.textContent).toContain("No se pudieron cargar las filas");
    down = false;
    el.querySelector<HTMLButtonElement>("[data-retry]")!.click();
    await sleep(30);
    expect(fetch.mock.calls.map(body).every((b) => b.filters.length === 0 && b.sort === null && b.limit === 51)).toBe(true);
    expect(count(el)).toBe("10 de 40 filas");
  });

  it("si llegan más filas que el tope, se toman las del tope y se avisa por consola", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ rows: ALL, total: ALL.length })),
    );
    const el = remote({ source: "/datos", "client-max": "10", "client-only": "" });
    await sleep(30);
    expect(el.mode).toBe("client");
    expect(el.rows).toHaveLength(10);
    expect(warn).toHaveBeenCalled();
  });
});
