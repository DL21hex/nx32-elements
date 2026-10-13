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
 *  en responder. Guarda cada cuerpo pedido y los que se cancelaron en camino. */
function server(total = 250) {
  const all = Array.from({ length: total }, (_, i) => ({ id: `r${i}`, oc: `OC-${i}`, prov: i % 2 ? "Aceros" : "Empaques", estado: i % 3 ? "pend" : "apr", monto: i }));
  const bodies: Body[] = [];
  const aborted: Body[] = [];
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const q = JSON.parse(String(init.body)) as Body;
    bodies.push(q);
    const cut = () => aborted.push(q);
    init.signal?.addEventListener("abort", cut);
    await sleep(5);
    init.signal?.removeEventListener("abort", cut);
    if (init.signal?.aborted) throw new DOMException("cancelada", "AbortError");
    if (q.matrix) return new Response(JSON.stringify({ rows: [], total: 0, matrix: [{ row: "Aceros", col: "pend", value: 1 }] }));
    const f = (q.filters as { key: string; values: string[] }[]).find((x) => x.key === "prov");
    const rows = f ? all.filter((r) => f.values.includes(r.prov)) : all;
    return new Response(JSON.stringify({ rows: rows.slice(q.offset, q.offset + q.limit), total: rows.length }));
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, bodies, aborted, rows: () => bodies.filter((b) => !b.matrix), matrix: () => bodies.filter((b) => b.matrix) };
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
    await sleep(20);
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
    await sleep(20);
    expect(s.aborted).toEqual([s.rows()[0]]);
  });

  it("salir del DOM antes de que salga no pide nada; al volver se pide una vez", async () => {
    const s = server();
    const el = connect({ source: "/datos" });
    el.filters = FILTERS;
    el.remove();
    await sleep(20);
    expect(s.fetch).not.toHaveBeenCalled();
    document.body.append(el);
    await sleep(20);
    expect(s.rows()).toHaveLength(1);
    expect(s.rows()[0]).toMatchObject({ offset: 0, filters: FILTERS });
    expect(el.querySelector('[data-r="0"] [data-c="0"]')!.textContent).toBe("OC-1");
  });

  it("client-only: el conjunto entero, una vez, sin filtros ni orden", async () => {
    const s = server(40);
    const el = connect({ source: "/datos", "client-only": "", "client-max": "1000" });
    el.filters = FILTERS;
    el.sort = SORT;
    await sleep(20);
    expect(s.rows()).toEqual([{ offset: 0, limit: 1001, sort: null, filters: [] }]);
    expect(el.mode).toBe("client");
    expect(el.count).toBe(20);
  });
});

describe("refresh()", () => {
  it("pide una vez, también si se llama varias veces en la misma tarea", async () => {
    const s = server();
    const el = connect({ source: "/datos" });
    await sleep(20);
    expect(s.rows()).toHaveLength(1);
    el.refresh();
    await Promise.resolve();
    expect(s.rows()).toHaveLength(2);
    await sleep(20);
    el.refresh();
    el.refresh();
    el.refresh();
    await sleep(20);
    expect(s.rows()).toHaveLength(3);
    expect(s.aborted).toEqual([]);
  });
});

describe("al desplazarse", () => {
  it("los bloques que faltan se piden en el acto, sin volver a pedir el primero", async () => {
    const s = server(1000);
    const el = connect({ source: "/datos" });
    await sleep(20);
    expect(s.rows()).toHaveLength(1);
    const box = el.querySelector<HTMLElement>(".nx-grid__scroll")!;
    box.scrollTop = 32 * 450;
    box.dispatchEvent(new Event("scroll"));
    await sleep(30);
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
    await sleep(20);
    expect(s.matrix()).toHaveLength(1);
    expect(s.matrix()[0]).toMatchObject({ limit: 0, filters: FILTERS, search: "oc", matrix: { rows: "prov", cols: "estado" } });
    expect(s.aborted).toEqual([]);
  });
});
