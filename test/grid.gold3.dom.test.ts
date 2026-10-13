// @vitest-environment happy-dom
//
// <nx-grid> 0.20.0 («estándar de oro», 3ª ronda): la descarga del conjunto entero que llega tarde no
// pisa lo nuevo, la búsqueda va por palabras, el recorte de `client-only` se dice, la tabla tiene
// nombre y avisa el fallo al lector de pantalla, las peticiones tienen plazo, la celda activa sigue a
// su fila, `refresh()` con las filas aquí no vacía la tabla y «Todos» dice la verdad.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GridColumn, GridErrorDetail, GridRow, GridTruncatedDetail, NxGrid } from "../src/index";
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...headers } });
const body = (call: unknown) => JSON.parse(((call as [string, RequestInit])[1].body as string) ?? "{}");
const column = (el: NxGrid, c: number) => [...el.querySelectorAll(`.nx-grid__row:not(.nx-grid__row--group) > [data-c="${c}"]`)].map((x) => x.textContent);
const count = (el: NxGrid) => el.querySelector(".nx-grid__chips .nx-grid__count")?.textContent;
const live = (el: NxGrid) => el.querySelector('.nx-sr-only[role="status"]')!.textContent;
const rows = (n: number, tag = "") => Array.from({ length: n }, (_, i) => ({ id: String(i), oc: `OC-${i}${tag}`, prov: i % 2 ? "Aceros" : "Empaques", estado: i % 4 ? "pend" : "apr", monto: i }));

/** Una tabla con `source` que se arma antes de conectarse (como lo hace una app). */
function remote(attrs: Record<string, string>, setup?: (el: NxGrid) => void): NxGrid {
  const el = document.createElement("nx-grid");
  el.columns = COLS;
  setup?.(el);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

/** Un origen cuyas respuestas del conjunto entero (`limit > 100`) esperan a que la prueba las suelte,
 *  y que no atiende la señal (como una respuesta que ya venía en camino: llega igual). */
function gated(data: () => GridRow[]) {
  const gates: { release: () => void; rows: GridRow[] }[] = [];
  const fetch = vi.fn(async (_u: string, init: RequestInit) => {
    const q = JSON.parse(init.body as string);
    const all = data();
    if (q.limit > 100) {
      const snapshot = all.map((r) => ({ ...r }));
      await new Promise<void>((r) => gates.push({ release: r, rows: snapshot }));
      return json({ rows: snapshot.slice(0, q.limit), total: snapshot.length });
    }
    return json({ rows: all.slice(q.offset, q.offset + q.limit), total: all.length });
  });
  return { fetch, gates };
}

describe("1 · la descarga del conjunto entero que llega tarde no pisa lo nuevo", () => {
  it("refresh() corta la decisión de client-max en camino: la vieja que llega después se tira", async () => {
    let version = "-v1";
    const g = gated(() => rows(30, version));
    vi.stubGlobal("fetch", g.fetch);
    const el = remote({ source: "/datos", "client-max": "1000" });
    await sleep(20);
    expect(g.gates).toHaveLength(1);
    expect(el.mode).toBe("server");
    // Mientras viene la v1, cambian los datos y la app pide otra vez.
    version = "-v2";
    el.refresh();
    await sleep(20);
    expect(g.gates).toHaveLength(2);
    // La v1 llega tarde, con el bloque 0 nuevo ya decidido: no se pone (antes pasaba las guardas,
    // se quedaba en el cliente con los datos viejos y la v2 se tiraba al llegar).
    g.gates[0].release();
    await sleep(20);
    expect(el.mode).toBe("server");
    expect(column(el, 0)[0]).toBe("OC-0-v2");
    g.gates[1].release();
    await sleep(20);
    expect(el.mode).toBe("client");
    expect(column(el, 0)[0]).toBe("OC-0-v2");
    expect(el.rows.every((r) => String(r.oc).endsWith("-v2"))).toBe(true);
  });

  it("patchRow y removeRow mientras viene el conjunto entero responden false y se vuelven a aplicar al llegar", async () => {
    const g = gated(() => rows(30));
    vi.stubGlobal("fetch", g.fetch);
    const el = remote({ source: "/datos", "client-max": "1000" });
    await sleep(20);
    expect(g.gates).toHaveLength(1);
    // La fila 3 está cargada en el servidor: se cambia en su lugar, pero no es exacto todavía.
    expect(el.patchRow({ id: "3", oc: "OC-3", prov: "Químicos", estado: "apr", monto: 3 })).toBe(false);
    expect(column(el, 1)[3]).toBe("Químicos");
    expect(el.removeRow("5")).toBe(false);
    // La descarga se leyó antes de esos cambios: al llegar, se aplican encima.
    g.gates[0].release();
    await sleep(20);
    expect(el.mode).toBe("client");
    expect(el.rows.find((r) => r.id === "3")!.prov).toBe("Químicos");
    expect(el.rows.some((r) => r.id === "5")).toBe(false);
    expect(el.rows).toHaveLength(29);
    // Sin nada en camino, patchRow vuelve a ser exacto.
    expect(el.patchRow({ id: "4", oc: "OC-4", prov: "Aceros", estado: "pend", monto: 4 })).toBe(true);
  });

  it("con las filas aquí, un patchRow durante refresh() se conserva al llegar las nuevas", async () => {
    const g = gated(() => rows(20));
    vi.stubGlobal("fetch", g.fetch);
    const el = remote({ source: "/datos", "client-max": "1000" });
    await sleep(20);
    g.gates[0].release();
    await sleep(20);
    expect(el.mode).toBe("client");
    el.refresh();
    await sleep(5);
    expect(el.patchRow({ id: "2", oc: "OC-2", prov: "Químicos", estado: "pend", monto: 2 })).toBe(false);
    expect(column(el, 1)[2]).toBe("Químicos");
    g.gates[1].release();
    await sleep(20);
    expect(el.rows.find((r) => r.id === "2")!.prov).toBe("Químicos");
  });
});

describe("2 · buscar en la tabla es por palabras", () => {
  const PEOPLE: GridColumn[] = [
    { key: "name", label: "Nombre" },
    { key: "city", label: "Ciudad" },
  ];
  const mount = (accents?: string) => {
    document.body.innerHTML = `<nx-grid ${accents ? `accents="${accents}"` : ""}></nx-grid>`;
    const el = document.querySelector("nx-grid")!;
    el.columns = PEOPLE;
    el.rows = [
      { id: "1", name: "JOSE LUIS MARTINEZ", city: "Santa Marta" },
      { id: "2", name: "JOSÉ PÉREZ", city: "Ciénaga" },
      { id: "3", name: "MARIA MARTINEZ", city: "Barranquilla" },
      { id: "4", name: "PEÑA JOSE", city: "Santa Marta" },
    ];
    return el;
  };

  it("cada palabra tiene que estar, en cualquier orden y en cualquier columna", () => {
    const el = mount();
    el.search = "jose martinez";
    expect(el.shownIds).toEqual(["1"]);
    el.search = "martinez   jose";
    expect(el.shownIds).toEqual(["1"]);
    // Entre columnas: el nombre y la ciudad.
    el.search = "jose santa";
    expect(el.shownIds).toEqual(["1", "4"]);
    el.search = "jose ciénaga";
    expect(el.shownIds).toEqual(["2"]);
    el.search = "jose bogota";
    expect(el.shownIds).toEqual([]);
    // Una frase que no está junta también encuentra (antes era la frase entera).
    el.search = "luis martinez";
    expect(el.shownIds).toEqual(["1"]);
  });

  it("respeta accents: sin tildes por omisión, con ellas en exact", () => {
    const fold = mount();
    fold.search = "jose perez";
    expect(fold.shownIds).toEqual(["2"]);
    const exact = mount("exact");
    exact.search = "jose perez";
    expect(exact.shownIds).toEqual([]);
    exact.search = "josé pérez";
    expect(exact.shownIds).toEqual(["2"]);
    exact.search = "peña jose";
    expect(exact.shownIds).toEqual(["4"]);
  });
});

describe("3 · client-only con más filas que el tope", () => {
  it("se dice: aviso en la tabla, el total real en el conteo y en «Todos», y nx-grid-truncated", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ rows: rows(40), total: 40 })),
    );
    const got: GridTruncatedDetail[] = [];
    const el = remote({ source: "/datos", "client-max": "10", "client-only": "", segments: "" }, (g) => {
      g.presets = [{ id: "apr", label: "Aprobadas", filters: [{ key: "estado", op: "in", values: ["apr"] }] }];
      g.addEventListener("nx-grid-truncated", (e) => got.push(e.detail));
    });
    await sleep(30);
    expect(el.mode).toBe("client");
    expect(el.rows).toHaveLength(10);
    expect(got).toEqual([{ shown: 10, total: 40 }]);
    expect(el.querySelector(".nx-grid__truncated")!.textContent).toBe("Se muestran las primeras 10 de 40 filas: los filtros y la búsqueda solo miran estas.");
    expect(count(el)).toBe("10 de 40 filas");
    expect(el.querySelector("[data-preset-all] strong")!.textContent).toBe("40");
    expect(live(el)).toContain("10 de 40");
  });

  it("si el origen manda más filas que su total, cuenta las que llegaron; sin recorte no hay aviso", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 25;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ rows: rows(n), total: 3 })),
    );
    const got: GridTruncatedDetail[] = [];
    const el = remote({ source: "/datos", "client-max": "10", "client-only": "" }, (g) => g.addEventListener("nx-grid-truncated", (e) => got.push(e.detail)));
    await sleep(30);
    expect(got).toEqual([{ shown: 10, total: 25 }]);
    // Al volver a pedir, ya caben: el aviso se va.
    n = 8;
    el.refresh();
    await sleep(30);
    expect(el.rows).toHaveLength(8);
    expect(el.querySelector(".nx-grid__truncated")).toBeNull();
    expect(count(el)).toBe("8 filas");
    expect(got).toHaveLength(1);
  });
});

describe("4 · accesibilidad: el nombre de la tabla y el fallo en la región viva", () => {
  it("label nombra el role=grid; sin él, heading", () => {
    document.body.innerHTML = `<nx-grid heading="Empleados"></nx-grid>`;
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.rows = rows(3);
    const grid = el.querySelector('[role="grid"]')!;
    expect(grid.getAttribute("aria-label")).toBe("Empleados");
    el.label = "Empleados activos";
    expect(grid.getAttribute("aria-label")).toBe("Empleados activos");
    el.label = null;
    el.heading = null;
    expect(grid.hasAttribute("aria-label")).toBe(false);
  });

  it("si la primera carga falla, el motivo va a la región viva (una vez por fallo)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "No tienes permiso" }, 403)),
    );
    const el = remote({ source: "/datos" });
    await vi.advanceTimersByTimeAsync(100);
    expect(live(el)).toBe("No se pudieron cargar las filas: No tienes permiso");
  });
});

describe("5 · la red: plazo, 408, Retry-After y variación", () => {
  it("una petición que no contesta se corta en `timeout` y se repite como la red caída", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    let answer = false;
    const signals: AbortSignal[] = [];
    // Nunca contesta (ni atiende la señal) hasta que `answer`.
    const fetch = vi.fn((_u: string, init: RequestInit) => {
      signals.push(init.signal!);
      return answer ? Promise.resolve(json({ rows: rows(2), total: 2 })) : new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetch);
    const errors: GridErrorDetail[] = [];
    const el = remote({ source: "/datos", timeout: "5000" }, (g) => g.addEventListener("nx-grid-error", (e) => errors.push(e.detail)));
    expect(el.timeout).toBe(5000);
    await vi.advanceTimersByTimeAsync(4900);
    expect(errors).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ status: 0, attempt: 1, retrying: true, error: "Sin respuesta en 5 s" });
    // La petición se cortó (no queda colgada).
    expect(signals[0].aborted).toBe(true);
    answer = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(column(el, 0)).toEqual(["OC-0", "OC-1"]);
  });

  it("sin `timeout`, 30 s", () => {
    document.body.innerHTML = `<nx-grid></nx-grid>`;
    const el = document.querySelector("nx-grid")!;
    expect(el.timeout).toBe(30_000);
    el.timeout = 1000;
    expect(el.getAttribute("timeout")).toBe("1000");
  });

  it("un 408 se repite solo", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 408 })),
    );
    const errors: GridErrorDetail[] = [];
    remote({ source: "/datos" }, (g) => g.addEventListener("nx-grid-error", (e) => errors.push(e.detail)));
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(errors.map((e) => [e.status, e.retrying])).toEqual([
      [408, true],
      [408, true],
      [408, true],
      [408, true],
      [408, false],
    ]);
  });

  it("un 429 con Retry-After espera lo que pide el servidor", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    vi.spyOn(Math, "random").mockReturnValue(0);
    let busy = true;
    const fetch = vi.fn(async () => (busy ? new Response("", { status: 429, headers: { "Retry-After": "20" } }) : json({ rows: rows(1), total: 1 })));
    vi.stubGlobal("fetch", fetch);
    remote({ source: "/datos" });
    await vi.advanceTimersByTimeAsync(100);
    expect(fetch).toHaveBeenCalledTimes(1);
    busy = false;
    // Sin Retry-After serían 0,5–1 s; el servidor pidió 20.
    await vi.advanceTimersByTimeAsync(19_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("la espera entre intentos varía al azar (hasta la mitad hacia abajo)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetch = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    remote({ source: "/datos" });
    await vi.advanceTimersByTimeAsync(10);
    expect(fetch).toHaveBeenCalledTimes(1);
    // El 2º intento a 1 s × ½ (con el azar en 0), el 3º 2 s × ½ después.
    await vi.advanceTimersByTimeAsync(520);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1020);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe("6 · la celda activa sigue a su fila", () => {
  const activeRow = (el: NxGrid) => el.querySelector(".nx-grid__cell.is-active")?.closest(".nx-grid__row")?.querySelector('[data-c="0"]')?.textContent;
  const mount = () => {
    document.body.innerHTML = `<nx-grid></nx-grid>`;
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.rows = rows(6);
    el.sort = { key: "monto", dir: 1 };
    const grid = el.querySelector<HTMLElement>('[role="grid"]')!;
    grid.focus();
    for (let i = 0; i < 2; i++) grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    return el;
  };

  it("patchRow que la reordena: la activa se va con ella", () => {
    const el = mount();
    expect(activeRow(el)).toBe("OC-2");
    expect(el.patchRow({ ...rows(6)[2], monto: 100 })).toBe(true);
    expect(column(el, 0).at(-1)).toBe("OC-2");
    expect(activeRow(el)).toBe("OC-2");
  });

  it("removeRow de una fila de arriba: la activa sigue en la suya", () => {
    const el = mount();
    expect(el.removeRow("0")).toBe(true);
    expect(activeRow(el)).toBe("OC-2");
    // Quitar la activa: queda la que ocupa su lugar.
    expect(el.removeRow("2")).toBe(true);
    expect(activeRow(el)).toBe("OC-3");
  });
});

describe("7 · refresh() con las filas aquí no vacía la tabla", () => {
  it("las filas, el conteo y el desplazamiento se quedan hasta que llega el reemplazo", async () => {
    let tag = "";
    const g = gated(() => rows(400, tag));
    vi.stubGlobal("fetch", g.fetch);
    const el = remote({ source: "/datos", "client-max": "1000", "client-only": "" });
    await sleep(10);
    g.gates[0].release();
    await sleep(20);
    expect(el.mode).toBe("client");
    const grid = el.querySelector<HTMLElement>('[role="grid"]')!;
    grid.scrollTop = 3200;
    grid.dispatchEvent(new Event("scroll"));
    await sleep(30);
    const before = column(el, 0);
    expect(before.length).toBeGreaterThan(0);
    const height = el.querySelector<HTMLElement>(".nx-grid__body")!.style.blockSize;
    tag = "-b";
    el.refresh();
    await sleep(10);
    // Mientras viene: lo mismo de antes, sin «Cargando…», y la tabla dice que está ocupada.
    expect(el.mode).toBe("client");
    expect(column(el, 0)).toEqual(before);
    expect(count(el)).toBe("400 filas");
    expect(el.querySelector(".nx-grid__empty.is-loading")).toBeNull();
    expect(el.querySelector<HTMLElement>(".nx-grid__body")!.style.blockSize).toBe(height);
    expect(grid.getAttribute("aria-busy")).toBe("true");
    expect(g.fetch.mock.calls.map(body).at(-1)).toEqual({ offset: 0, limit: 1001, sort: null, filters: [] });
    g.gates[1].release();
    await sleep(20);
    expect(grid.hasAttribute("aria-busy")).toBe(false);
    expect(grid.scrollTop).toBe(3200);
    expect(column(el, 0)[0]).toBe(`${before[0]}-b`);
  });

  it("si falla, se quedan las filas de antes y sale nx-grid-error sin reintento", async () => {
    let down = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (down ? json({ error: "Mantenimiento" }, 503) : json({ rows: rows(5), total: 5 }))),
    );
    const errors: GridErrorDetail[] = [];
    const el = remote({ source: "/datos", "client-only": "" }, (g) => g.addEventListener("nx-grid-error", (e) => errors.push(e.detail)));
    await sleep(20);
    down = true;
    el.refresh();
    await sleep(20);
    expect(el.mode).toBe("client");
    expect(el.rows).toHaveLength(5);
    expect(errors).toEqual([{ offset: 0, limit: 20_001, error: "HTTP 503", status: 503, message: "Mantenimiento", body: { error: "Mantenimiento" }, attempt: 1, retrying: false }]);
    expect(live(el)).toBe("No se pudieron cargar las filas: Mantenimiento");
  });

  it("client-max: si ya no cabe, pasa al servidor con la consulta de ahora", async () => {
    let n = 30;
    const fetch = vi.fn(async (_u: string, init: RequestInit) => {
      const q = JSON.parse(init.body as string);
      const all = rows(n);
      if (q.limit > 100 && n > 50) return json({ rows: [], total: n });
      return json({ rows: all.slice(q.offset, q.offset + q.limit), total: all.length });
    });
    vi.stubGlobal("fetch", fetch);
    const el = remote({ source: "/datos", "client-max": "50" });
    await sleep(30);
    expect(el.mode).toBe("client");
    n = 300;
    el.refresh();
    await sleep(30);
    expect(el.mode).toBe("server");
    expect(count(el)).toBe("300 filas");
  });
});

describe("8 · «Todos» dice la verdad y su clic siempre hace algo", () => {
  const PRESETS = [
    { id: "pend", label: "Pendientes", filters: [{ key: "estado", op: "in" as const, values: ["pend"] }] },
    { id: "apr", label: "Aprobadas", filters: [{ key: "estado", op: "in" as const, values: ["apr"] }] },
  ];
  const pressed = (el: NxGrid) => [...el.querySelectorAll<HTMLElement>(".nx-grid__presets .nx-grid__segment")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.preset ?? "todos");
  const todos = (el: NxGrid) => el.querySelector<HTMLButtonElement>("[data-preset-all]")!;
  const mount = () => {
    document.body.innerHTML = `<nx-grid heading="Pedidos"></nx-grid>`;
    const el = document.querySelector("nx-grid")!;
    el.columns = COLS;
    el.presets = PRESETS;
    el.rows = rows(8);
    return el;
  };

  it("arranca con un filtro de la app que no es un atajo: nada presionado, y «Todos» lo quita", () => {
    const el = mount();
    // Como Empleados de nx32: arranca en «Activo», que no es ninguno de los atajos.
    el.filters = [{ key: "prov", op: "in", values: ["Aceros"] }];
    expect(pressed(el)).toEqual([]);
    expect(count(el)).toBe("4 de 8 filas");
    todos(el).click();
    expect(el.filters).toEqual([]);
    expect(pressed(el)).toEqual(["todos"]);
    expect(count(el)).toBe("8 filas");
    // Presionado, no hace nada.
    todos(el).click();
    expect(el.filters).toEqual([]);
  });

  it("con un atajo presionado, «Todos» quita todos los filtros (no vuelve a los de antes del atajo)", () => {
    const el = mount();
    el.filters = [{ key: "prov", op: "in", values: ["Aceros"] }];
    el.querySelector<HTMLButtonElement>('[data-preset="apr"]')!.click();
    expect(pressed(el)).toEqual(["apr"]);
    todos(el).click();
    expect(el.filters).toEqual([]);
    expect(pressed(el)).toEqual(["todos"]);
    // Volver a tocar el atajo y otra vez: vuelve a «Todos» (lo de antes del atajo).
    el.querySelector<HTMLButtonElement>('[data-preset="apr"]')!.click();
    el.querySelector<HTMLButtonElement>('[data-preset="apr"]')!.click();
    expect(pressed(el)).toEqual(["todos"]);
  });
});

describe("9 · patchRow no rehace lo que no cambió, y da lo mismo que recalcular todo", () => {
  const PRESETS = [
    { id: "pend", label: "Pendientes", filters: [{ key: "estado", op: "in" as const, values: ["pend"] }] },
    { id: "aceros", label: "Aceros", filters: [{ key: "prov", op: "in" as const, values: ["Aceros"] }] },
  ];
  const snap = (el: NxGrid) => ({
    ids: el.shownIds,
    count: count(el),
    presets: [...el.querySelectorAll(".nx-grid__preset strong")].map((x) => x.textContent),
    facets: [...el.querySelectorAll(".nx-grid__facets label")].map((x) => x.textContent),
    foot: el.querySelector(".nx-grid__foot")!.textContent,
  });
  const build = (data: GridRow[]) => {
    const el = document.createElement("nx-grid");
    el.columns = COLS;
    el.presets = PRESETS;
    el.rows = data;
    el.sort = { key: "oc", dir: 1 };
    el.filters = [{ key: "estado", op: "in", values: ["pend"] }];
    el.search = "oc";
    el.facetsOpen = true;
    document.body.append(el);
    return el;
  };

  it("cambiando o no el valor del orden, una faceta, un atajo; agregando y quitando", () => {
    const data = rows(60);
    const el = build(data);
    const steps: ((d: GridRow[]) => GridRow)[] = [
      // Solo el monto (ni orden, ni facetas, ni atajos).
      (d) => ({ ...d[5], monto: 999 }),
      // El estado: sale del filtro y cambia los atajos.
      (d) => ({ ...d[6], estado: "apr" }),
      // El proveedor: una faceta y un atajo.
      (d) => ({ ...d[7], prov: "Químicos" }),
      // El valor del orden.
      (d) => ({ ...d[9], oc: "OC-00" }),
      // Una fila que no estaba.
      () => ({ id: "nueva", oc: "OC-500", prov: "Aceros", estado: "pend", monto: 1 }),
    ];
    // Lo que se compara existe (no se comparan dos listas vacías).
    expect(snap(el).presets).toHaveLength(2);
    expect(snap(el).ids.length).toBeGreaterThan(10);
    expect(snap(el).facets.length).toBeGreaterThan(0);
    let current: GridRow[] = data.map((r) => ({ ...r }));
    for (const step of steps) {
      const next = step(current);
      expect(el.patchRow(next)).toBe(true);
      const i = current.findIndex((r) => r.id === next.id);
      if (i >= 0) current[i] = next;
      else current.push(next);
      const fresh = build(current.map((r) => ({ ...r })));
      expect(snap(el)).toEqual(snap(fresh));
      fresh.remove();
    }
    expect(el.removeRow("11")).toBe(true);
    current = current.filter((r) => r.id !== "11");
    const fresh = build(current);
    expect(snap(el)).toEqual(snap(fresh));
  });
});
