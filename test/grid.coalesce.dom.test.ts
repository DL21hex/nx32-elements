// @vitest-environment happy-dom
//
// <nx-grid> con `source`: lo que se asigna en la misma tarea es UNA petición. Una app (o el
// envoltorio de Solid) conecta la tabla y enseguida le pone `filters`, `sort` y `search`; antes cada
// asignación pedía su página y cortaba la anterior (tres peticiones por carga, dos canceladas).
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GridColumn, NxGrid } from "../src/index";
import "../src/index";

afterEach(() => {
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
const FILTERS = [{ key: "prov", op: "in" as const, values: ["Aceros"] }];
const SORT = { key: "monto", dir: -1 as const };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Body = { offset: number; limit: number; sort: unknown; filters: unknown[]; search?: string; matrix?: unknown };

/** Un backend de filas por bloques que filtra por `prov` (filtro `in`) y tarda unos milisegundos
 *  en responder. Guarda cada cuerpo pedido, los que se cancelaron en camino y cuántos salieron de
 *  una tabla todavía sin columnas (`bare`). */
function server(total = 250) {
  const all = Array.from({ length: total }, (_, i) => ({ id: `r${i}`, oc: `OC-${i}`, prov: i % 2 ? "Aceros" : "Empaques", estado: i % 3 ? "pend" : "apr", monto: i }));
  const bodies: Body[] = [];
  const aborted: Body[] = [];
  let bare = 0;
  let inflight = 0;
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    inflight++;
    try {
      return await answer(init);
    } finally {
      inflight--;
    }
  });
  const answer = async (init: RequestInit) => {
    const q = JSON.parse(String(init.body)) as Body;
    bodies.push(q);
    if (!document.querySelector("nx-grid")?.columns.length) bare++;
    const cut = () => aborted.push(q);
    init.signal?.addEventListener("abort", cut);
    await sleep(5);
    init.signal?.removeEventListener("abort", cut);
    if (init.signal?.aborted) throw new DOMException("cancelada", "AbortError");
    if (q.matrix) return new Response(JSON.stringify({ rows: [], total: 0, matrix: [{ row: "Aceros", col: "pend", value: 1 }] }));
    const f = (q.filters as { key: string; values: string[] }[]).find((x) => x.key === "prov");
    const rows = f ? all.filter((r) => f.values.includes(r.prov)) : all;
    return new Response(JSON.stringify({ rows: rows.slice(q.offset, q.offset + q.limit), total: rows.length }));
  };
  vi.stubGlobal("fetch", fetch);
  /** Espera al menos `ms` y, después, a que no quede ninguna petición en camino ni salga otra (una
   *  espera fija sola fallaba con la máquina cargada: la segunda respuesta llegaba tarde). */
  const settle = async (ms = 20) => {
    await sleep(ms);
    for (let i = 0; i < 500; i++) {
      const n = bodies.length;
      if (!inflight) {
        await sleep(0);
        await sleep(0);
        if (!inflight && bodies.length === n) return;
      } else await sleep(2);
    }
  };
  return { fetch, bodies, aborted, settle, bare: () => bare, rows: () => bodies.filter((b) => !b.matrix), matrix: () => bodies.filter((b) => b.matrix) };
}

/** Como la conecta una app: el elemento entra al DOM con sus atributos y, en la misma tarea, recibe
 *  sus propiedades. */
function connect(attrs: Record<string, string>): NxGrid {
  const el = document.createElement("nx-grid") as NxGrid;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.columns = COLS;
  document.body.append(el);
  return el;
}

describe("la primera carga es una sola petición", () => {
  it("conectar y asignar filtros, orden y búsqueda en la misma tarea pide una vez, con la consulta final", async () => {
    const s = server();
    const el = connect({ source: "/datos", "client-max": "5000" });
    el.filters = FILTERS;
    el.sort = SORT;
    el.search = "oc";
    // Nada sale en la misma tarea: la petición espera a que la app termine de asignar.
    expect(s.fetch).not.toHaveBeenCalled();
    // «Cargando…» ya se ve: no se espera la red para pintarlo.
    expect(el.querySelector(".nx-grid__empty.is-loading")).not.toBeNull();
    await Promise.resolve();
    expect(s.fetch).toHaveBeenCalledTimes(1);
    expect(s.bodies[0]).toMatchObject({ offset: 0, limit: 100, sort: SORT, filters: FILTERS, search: "oc" });
    await s.settle(20);
    expect(s.aborted).toEqual([]);
    // Después, la de `client-max` (el conjunto entero cabe): la que se esperaba, no una repetida.
    expect(s.rows().map((b) => b.limit)).toEqual([100, 5001]);
    expect(el.mode).toBe("client");
    expect(el.querySelector('[data-r="0"] [data-c="0"]')!.textContent).toBe("OC-249");
  });

  it("una consulta nueva en otra tarea sí corta la anterior (la de antes ya no sirve)", async () => {
    const s = server();
    const el = connect({ source: "/datos" });
    await Promise.resolve();
    el.filters = FILTERS;
    await Promise.resolve();
    expect(s.rows()).toHaveLength(2);
    expect(s.rows()[1]).toMatchObject({ filters: FILTERS });
    await s.settle(20);
    expect(s.aborted).toEqual([s.rows()[0]]);
  });

  it("salir del DOM antes de que salga no pide nada; al volver se pide una vez", async () => {
    const s = server();
    const el = connect({ source: "/datos" });
    el.filters = FILTERS;
    el.remove();
    await s.settle(20);
    expect(s.fetch).not.toHaveBeenCalled();
    document.body.append(el);
    await s.settle(20);
    expect(s.rows()).toHaveLength(1);
    expect(s.rows()[0]).toMatchObject({ offset: 0, filters: FILTERS });
    expect(el.querySelector('[data-r="0"] [data-c="0"]')!.textContent).toBe("OC-1");
  });

  it("client-only: el conjunto entero, una vez, sin filtros ni orden", async () => {
    const s = server(40);
    const el = connect({ source: "/datos", "client-only": "", "client-max": "1000" });
    el.filters = FILTERS;
    el.sort = SORT;
    await s.settle(20);
    expect(s.rows()).toEqual([{ offset: 0, limit: 1001, sort: null, filters: [] }]);
    expect(el.mode).toBe("client");
    expect(el.count).toBe(20);
  });
});

describe("refresh()", () => {
  it("pide una vez, también si se llama varias veces en la misma tarea", async () => {
    const s = server();
    const el = connect({ source: "/datos" });
    await s.settle(20);
    expect(s.rows()).toHaveLength(1);
    el.refresh();
    await Promise.resolve();
    expect(s.rows()).toHaveLength(2);
    await s.settle(20);
    el.refresh();
    el.refresh();
    el.refresh();
    await s.settle(20);
    expect(s.rows()).toHaveLength(3);
    expect(s.aborted).toEqual([]);
  });
});

describe("al desplazarse", () => {
  it("los bloques que faltan se piden en el acto, sin volver a pedir el primero", async () => {
    const s = server(1000);
    const el = connect({ source: "/datos" });
    await s.settle(20);
    expect(s.rows()).toHaveLength(1);
    const box = el.querySelector<HTMLElement>(".nx-grid__scroll")!;
    box.scrollTop = 32 * 450;
    box.dispatchEvent(new Event("scroll"));
    await s.settle(30);
    const offsets = s.rows().map((b) => b.offset);
    expect(offsets[0]).toBe(0);
    expect(offsets.slice(1)).toContain(400);
    expect(offsets.filter((o) => o === 0)).toHaveLength(1);
  });
});

describe("la matriz con `source`", () => {
  it("filtros y búsqueda en la misma tarea son una sola petición de la matriz", async () => {
    const s = server();
    const el = connect({ source: "/datos", matrix: '{"rows":"prov","cols":"estado"}', layout: "matrix" });
    el.filters = FILTERS;
    el.search = "oc";
    expect(s.fetch).not.toHaveBeenCalled();
    await s.settle(20);
    expect(s.matrix()).toHaveLength(1);
    expect(s.matrix()[0]).toMatchObject({ limit: 0, filters: FILTERS, search: "oc", matrix: { rows: "prov", cols: "estado" } });
    expect(s.aborted).toEqual([]);
  });
});

/** Como sale en el HTML del servidor: solo atributos. Al cargar la librería se mejora y se conecta
 *  sin columnas ni filtros; esos llegan después, al hidratar. */
function ssr(attrs: string): NxGrid {
  document.body.innerHTML = `<nx-grid ${attrs}><template></template></nx-grid>`;
  return document.querySelector("nx-grid")!;
}

describe("sin columnas no se pide nada", () => {
  it("la tabla del HTML del servidor espera sus columnas; con ellas, los filtros y el orden, una petición", async () => {
    const s = server();
    const el = ssr('source="/datos" client-max="5000" views-storage="nx-coalesce-ssr" facets-open segments');
    await s.settle(20);
    expect(s.fetch).not.toHaveBeenCalled();
    // Ni un «Cargando…» sin columnas que lo enmarquen.
    expect(el.querySelector(".nx-grid__empty.is-loading")).toBeNull();
    // La hidratación: todo en la misma tarea.
    el.columns = COLS;
    el.filters = FILTERS;
    el.sort = SORT;
    await s.settle(20);
    expect(s.rows()[0]).toEqual({ offset: 0, limit: 100, sort: SORT, filters: FILTERS });
    // Después, la de `client-max`: el conjunto cabe.
    expect(s.rows().map((b) => b.limit)).toEqual([100, 5001]);
    expect(s.aborted).toEqual([]);
    expect(s.bare()).toBe(0);
    expect(el.count).toBe(125);
  });

  it("columnas en una tarea y filtros en otra: dos peticiones como mucho, ninguna sin columnas", async () => {
    // La segunda tarea ya no se puede juntar con la primera (ver `#reload`): la primera petición
    // sale con lo que había y la segunda la corta. Lo que no vuelve es la petición vacía del
    // momento de mejorar el elemento.
    const s = server();
    const el = ssr('source="/datos"');
    await s.settle(20);
    el.columns = COLS;
    await Promise.resolve();
    el.filters = FILTERS;
    el.sort = SORT;
    await s.settle(20);
    expect(s.rows()).toHaveLength(2);
    expect(s.rows()[1]).toMatchObject({ sort: SORT, filters: FILTERS });
    expect(s.bare()).toBe(0);
    // Lo pintado es de la segunda (el servidor de prueba no ordena: la primera de «Aceros»).
    expect(el.querySelector('[data-r="0"] [data-c="0"]')!.textContent).toBe("OC-1");
  });

  it("la vista predeterminada guardada viaja en la primera petición, la de las columnas", async () => {
    const KEY = "nx-coalesce-views";
    localStorage.setItem(KEY, JSON.stringify({ v: 1, views: [{ id: "a", name: "Aceros", filters: FILTERS, default: true }] }));
    try {
      const s = server();
      const el = ssr(`source="/datos" views-storage="${KEY}"`);
      await s.settle(20);
      expect(s.fetch).not.toHaveBeenCalled();
      el.columns = COLS;
      await s.settle(20);
      expect(s.rows()).toEqual([{ offset: 0, limit: 100, sort: null, filters: FILTERS }]);
    } finally {
      localStorage.removeItem(KEY);
    }
  });

  it("refresh() sin columnas no pide; las columnas que llegan, una vez", async () => {
    const s = server();
    const el = ssr('source="/datos"');
    el.refresh();
    await s.settle(20);
    el.refresh();
    await s.settle(20);
    expect(s.fetch).not.toHaveBeenCalled();
    el.columns = COLS;
    await s.settle(20);
    expect(s.rows()).toHaveLength(1);
    // Volver a asignar las mismas columnas (un repintado de la app) no vuelve a pedir.
    el.columns = COLS;
    await s.settle(20);
    expect(s.rows()).toHaveLength(1);
  });

  it("los filtros que cambian mientras faltan las columnas viajan cuando llegan", async () => {
    const s = server();
    const el = connect({ source: "/datos" });
    await s.settle(20);
    expect(s.rows()).toHaveLength(1);
    el.columns = [];
    el.filters = FILTERS;
    await s.settle(20);
    expect(s.rows()).toHaveLength(1);
    el.columns = COLS;
    await s.settle(20);
    expect(s.rows()).toHaveLength(2);
    expect(s.rows()[1]).toMatchObject({ filters: FILTERS });
    expect(s.bare()).toBe(0);
  });

  it("un source que llega después de las columnas pide una vez", async () => {
    const s = server();
    const el = ssr("");
    el.columns = COLS;
    el.filters = FILTERS;
    await s.settle(20);
    expect(s.fetch).not.toHaveBeenCalled();
    el.source = "/datos";
    await s.settle(20);
    expect(s.rows()).toEqual([{ offset: 0, limit: 100, sort: null, filters: FILTERS }]);
  });

  it("client-only y la matriz tampoco piden sin columnas", async () => {
    const s = server(40);
    const only = ssr('source="/datos" client-only client-max="1000"');
    await s.settle(20);
    expect(s.fetch).not.toHaveBeenCalled();
    only.columns = COLS;
    only.filters = FILTERS;
    await s.settle(20);
    expect(s.rows()).toEqual([{ offset: 0, limit: 1001, sort: null, filters: [] }]);
    expect(only.count).toBe(20);
    s.bodies.length = 0;
    const mx = ssr(`source="/datos" matrix='{"rows":"prov","cols":"estado"}' layout="matrix"`);
    await s.settle(20);
    expect(s.fetch).toHaveBeenCalledTimes(1);
    mx.columns = COLS;
    mx.filters = FILTERS;
    await s.settle(20);
    expect(s.matrix()).toHaveLength(1);
    expect(s.matrix()[0]).toMatchObject({ limit: 0, filters: FILTERS });
    expect(s.bare()).toBe(0);
  });
});

// Prioridad del arranque: lo que la app pone encima (la URL, lo recordado) › la vista
// predeterminada guardada › los filtros y el orden de arranque que asigna la app. La tabla del HTML
// del servidor se conecta antes de recibir sus propiedades (cada carga completa: un enlace, un
// marcador, recargar); la vista se aplicaba al conectarse, la pisaban los filtros de arranque y
// `activeView` seguía nombrándola.
describe("la vista predeterminada gana a los filtros de arranque", () => {
  const KEY = "nx-coalesce-default";
  const VIEW_SORT = { key: "oc", dir: 1 as const };
  const START = [{ key: "prov", op: "in" as const, values: ["Empaques"] }];
  const save = () => localStorage.setItem(KEY, JSON.stringify({ v: 1, views: [{ id: "a", name: "Aceros", filters: FILTERS, sort: VIEW_SORT, hidden: ["estado"], default: true }] }));
  afterEach(() => localStorage.removeItem(KEY));
  /** La vista quedó aplicada de verdad: `activeView`, la consulta, las columnas y una sola petición. */
  function applied(el: NxGrid, s: ReturnType<typeof server>): void {
    expect(el.activeView).toBe("a");
    expect(el.filters).toEqual(FILTERS);
    expect(el.sort).toEqual(VIEW_SORT);
    expect(el.view.hidden).toEqual(["estado"]);
    expect(s.rows()).toEqual([{ offset: 0, limit: 100, sort: VIEW_SORT, filters: FILTERS }]);
    expect(s.aborted).toEqual([]);
    expect(s.bare()).toBe(0);
    expect(el.count).toBe(125);
  }

  it("propiedades antes de conectar (una navegación en la app): la vista, en el acto", async () => {
    save();
    const s = server();
    const el = document.createElement("nx-grid") as NxGrid;
    el.setAttribute("source", "/datos");
    el.setAttribute("views-storage", KEY);
    el.columns = COLS;
    el.filters = START;
    el.sort = SORT;
    document.body.append(el);
    expect(el.activeView).toBe("a");
    await s.settle(30);
    applied(el, s);
  });

  it("conectada sin nada y las propiedades en la misma tarea (las columnas primero): la vista, al final de la tarea", async () => {
    save();
    const s = server();
    const el = ssr(`source="/datos" views-storage="${KEY}"`);
    el.columns = COLS;
    el.filters = START;
    el.sort = SORT;
    // Todavía no se aplicó: `activeView` no la nombra.
    expect(el.activeView).toBeNull();
    expect(el.filters).toEqual(START);
    await s.settle(30);
    applied(el, s);
  });

  it("también con los filtros y el orden antes que las columnas", async () => {
    save();
    const s = server();
    const el = ssr(`source="/datos" views-storage="${KEY}"`);
    el.filters = START;
    el.sort = SORT;
    el.columns = COLS;
    await s.settle(30);
    applied(el, s);
  });

  it("conectada sin nada y las propiedades en una tarea posterior: igual", async () => {
    save();
    const s = server();
    const el = ssr(`source="/datos" views-storage="${KEY}"`);
    await s.settle(20);
    expect(s.fetch).not.toHaveBeenCalled();
    expect(el.activeView).toBeNull();
    el.columns = COLS;
    el.filters = START;
    el.sort = SORT;
    await s.settle(30);
    applied(el, s);
  });

  it("lo que la app pone encima después (un microtask encolado tras las propiedades) gana, en la misma petición", async () => {
    save();
    const s = server();
    const el = ssr(`source="/datos" views-storage="${KEY}"`);
    const URL_FILTERS = [{ key: "prov", op: "in" as const, values: ["Empaques"] }];
    el.columns = COLS;
    el.filters = START;
    // Como un adaptador que repone la URL o lo recordado sobre la vista predeterminada.
    queueMicrotask(() => {
      expect(el.activeView).toBe("a");
      el.filters = URL_FILTERS;
    });
    await s.settle(30);
    expect(el.activeView).toBe("a");
    expect(el.filters).toEqual(URL_FILTERS);
    expect(s.rows()).toEqual([{ offset: 0, limit: 100, sort: VIEW_SORT, filters: URL_FILTERS }]);
    expect(s.aborted).toEqual([]);
  });

  it("applyView(id) en la misma tarea reemplaza a la predeterminada", async () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, views: [{ id: "a", name: "Aceros", filters: FILTERS, default: true }, { id: "b", name: "Empaques", filters: START }] }));
    const s = server();
    const el = ssr(`source="/datos" views-storage="${KEY}"`);
    el.columns = COLS;
    expect(el.applyView("b")).toBe(true);
    await s.settle(30);
    expect(el.activeView).toBe("b");
    expect(s.rows()).toEqual([{ offset: 0, limit: 100, sort: null, filters: START }]);
  });

  it("sin source, con las filas en el cliente, igual", async () => {
    save();
    const el = ssr(`views-storage="${KEY}"`);
    el.columns = COLS;
    el.rows = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, oc: `OC-${i}`, prov: i % 2 ? "Aceros" : "Empaques", estado: "pend", monto: i }));
    el.filters = START;
    el.sort = SORT;
    await Promise.resolve();
    expect(el.activeView).toBe("a");
    expect(el.filters).toEqual(FILTERS);
    expect(el.sort).toEqual(VIEW_SORT);
    expect(el.count).toBe(5);
  });
});
