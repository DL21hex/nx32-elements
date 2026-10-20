// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/lanes/index";
import type { Lane, LaneItem, LanesChangeDetail, LanesSpotlightDetail, NxLanes } from "../src/components/lanes/index";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const LANES: Lane[] = [
  { id: "vac", label: "Vacaciones", stages: [{ id: "jefe", label: "Jefe", other: true }, { id: "rev", label: "Revisar", href: "/vac/rev" }, { id: "eje", label: "Ejecutar" }] },
  { id: "ret", label: "Retiros", stages: [{ id: "liq", label: "Liquidar" }, { id: "pag", label: "Pagar" }] },
  { id: "ces", label: "Cesantías", stages: [{ id: "rev", label: "Revisar" }] },
];

const ITEMS: LaneItem[] = [
  { id: 1, lane: "vac", stage: "jefe", age: 30 },
  { id: 2, lane: "vac", stage: "rev", age: 1 },
  { id: 3, lane: "vac", stage: "rev", age: 12, label: "#4821", sub: "Ana Pérez" },
  { id: 4, lane: "vac", stage: "eje", age: 4 },
  { id: 5, lane: "ret", stage: "liq", age: 40 },
  { id: 6, lane: "ret", stage: "liq", age: 15 },
  { id: 7, lane: "ret", stage: "pag", age: 7 },
];

async function mount(attrs: Record<string, string> = {}, items: LaneItem[] = ITEMS): Promise<NxLanes> {
  const el = document.createElement("nx-lanes") as NxLanes;
  el.setAttribute("locale", "es-CO");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.labels = { item: "solicitud|solicitudes", oldest: "la más vieja {age}" };
  el.lanes = LANES;
  el.items = items;
  document.body.append(el);
  await tick();
  return el;
}

const lane = (el: NxLanes, id: string) => el.querySelector<HTMLElement>(`.nx-lanes__lane[data-lane="${id}"]`)!;
const dot = (el: NxLanes, id: string) => el.querySelector<HTMLElement>(`.nx-lanes__dot[data-nx-tip="${id}"]`);
const stations = (el: NxLanes, id: string) => [...lane(el, id).querySelectorAll<HTMLElement>(".nx-lanes__st")];

describe("<nx-lanes>", () => {
  it("pinta un carril por proceso con lo propio, lo de otros y lo más viejo", async () => {
    const el = await mount();
    expect(el.querySelectorAll(".nx-lanes__lane")).toHaveLength(3);
    const vac = lane(el, "vac");
    expect(vac.querySelector(".nx-lanes__name b")!.textContent).toBe("Vacaciones");
    expect(vac.querySelector(".nx-lanes__count")!.textContent).toBe("3");
    const others = vac.querySelector<HTMLElement>(".nx-lanes__others")!;
    expect(others.hidden).toBe(false);
    expect(others.textContent).toBe("1");
    expect(others.title).toBe("1 esperan a otro");
    const oldest = vac.querySelector(".nx-lanes__oldest")!;
    expect(oldest.textContent).toBe("la más vieja 12 d");
    expect(oldest.classList.contains("is-late")).toBe(true);
    expect(lane(el, "ret").querySelector<HTMLElement>(".nx-lanes__others")!.hidden).toBe(true);
    expect(lane(el, "ces").querySelector(".nx-lanes__oldest")!.textContent).toBe("al día");
    expect(vac.getAttribute("aria-label")).toBe("Vacaciones: 3 solicitudes");
  });

  it("la leyenda dice los tramos y el punto hueco", async () => {
    const el = await mount();
    const texts = [...el.querySelectorAll(".nx-lanes__legend > span")].map((s) => s.textContent);
    expect(texts).toEqual(["0 a 2 días", "3 a 5", "6 a 10", "Más de 10", "Espera a otro"]);
    el.bands = [5, 10];
    await tick();
    expect([...el.querySelectorAll(".nx-lanes__legend > span")].map((s) => s.textContent)).toEqual(["0 a 5 días", "6 a 10", "Más de 10", "Espera a otro"]);
  });

  it("cada bandeja es un botón con su resumen; con href, un enlace", async () => {
    const el = await mount();
    const [jefe, rev, eje] = stations(el, "vac");
    expect(jefe.tagName).toBe("BUTTON");
    expect(jefe.getAttribute("aria-label")).toBe("Jefe: 1 solicitud, esperan a otro");
    expect(rev.tagName).toBe("A");
    expect(rev.getAttribute("href")).toBe("/vac/rev");
    expect(rev.getAttribute("aria-label")).toBe("Revisar: 2 solicitudes, 1 con más de 10 días");
    expect(rev.classList.contains("is-late")).toBe(true);
    expect(jefe.classList.contains("is-late")).toBe(false);
    expect(eje.style.insetInlineStart).toBe(`${(2 / 3) * 100}%`);
    const seen: unknown[] = [];
    el.addEventListener("nx-lanes-stage", (e) => seen.push(e.detail));
    eje.click();
    expect(seen).toEqual([{ lane: "vac", stage: "eje" }]);
  });

  it("un punto por elemento, con su tramo; hueco si espera a otro; late si es propio y atrasado", async () => {
    const el = await mount();
    expect(el.querySelectorAll(".nx-lanes__dot")).toHaveLength(7);
    expect(el.querySelector(".nx-lanes__dots")!.getAttribute("aria-hidden")).toBe("true");
    expect(dot(el, "1")!.className).toBe("nx-lanes__dot is-late is-other");
    expect(dot(el, "2")!.className).toBe("nx-lanes__dot is-fresh");
    expect(dot(el, "3")!.className).toBe("nx-lanes__dot is-late is-pulse");
    expect(dot(el, "4")!.className).toBe("nx-lanes__dot is-ok");
    expect(dot(el, "7")!.className).toBe("nx-lanes__dot is-warn");
    expect(dot(el, "3")!.style.getPropertyValue("--nx-lanes-delay")).toMatch(/^\d(\.\d)?s$/);
  });

  it("con datos nuevos, el punto es el mismo nodo y nx-lanes-change cuenta lo que pasó", async () => {
    const el = await mount();
    const changes: LanesChangeDetail[] = [];
    el.addEventListener("nx-lanes-change", (e) => changes.push(e.detail));
    const node = dot(el, "1")!;
    const before = node.style.transform;
    el.items = [
      { id: 1, lane: "vac", stage: "rev", age: 0 },
      ...ITEMS.filter((i) => i.id !== 1 && i.id !== 5),
      { id: 8, lane: "ces", stage: "rev", age: 0 },
    ];
    await tick();
    expect(dot(el, "1")).toBe(node);
    expect(node.style.transform).not.toBe(before);
    expect(node.className).toBe("nx-lanes__dot is-fresh");
    expect(changes).toEqual([
      {
        moved: [{ id: "1", lane: "vac", from: "jefe", to: "rev" }],
        added: [{ id: "8", lane: "ces", stage: "rev" }],
        removed: [{ id: "5", lane: "ret", stage: "liq" }],
      },
    ]);
    // Los mismos datos otra vez: nada que contar.
    el.items = [...el.items];
    await tick();
    expect(changes).toHaveLength(1);
  });

  it("lo que sale va a la punta de su riel, se apaga y se borra; al desconectar se borra ya", async () => {
    const el = await mount();
    const node = dot(el, "5")!;
    el.items = ITEMS.filter((i) => i.id !== 5);
    await tick();
    expect(node.isConnected).toBe(true);
    expect(node.classList.contains("is-leaving")).toBe(true);
    expect(node.hasAttribute("data-nx-tip")).toBe(false);
    // happy-dom no mide: el carril cuenta como 880 × 76 px, el punto mide 8 px y llega a 880 − 8 − 2.
    expect(node.style.transform).toMatch(/^translate\(870px,/);
    el.remove();
    expect(node.isConnected).toBe(false);
  });

  it("no anuncia cambios en la primera carga", async () => {
    const el = document.createElement("nx-lanes") as NxLanes;
    const changes: unknown[] = [];
    el.addEventListener("nx-lanes-change", (e) => changes.push(e.detail));
    el.lanes = LANES;
    el.items = ITEMS;
    document.body.append(el);
    await tick();
    expect(changes).toEqual([]);
  });

  it("tocar un punto emite nx-lanes-item", async () => {
    const el = await mount();
    const seen: unknown[] = [];
    el.addEventListener("nx-lanes-item", (e) => seen.push(e.detail.id));
    dot(el, "3")!.click();
    expect(seen).toEqual(["3"]);
  });

  it("spotlight resalta su carril y nx-lanes-spotlight da sus cifras", async () => {
    const el = await mount();
    const seen: LanesSpotlightDetail[] = [];
    el.addEventListener("nx-lanes-spotlight", (e) => seen.push(e.detail));
    el.spotlight = "vac";
    await tick();
    expect(lane(el, "vac").classList.contains("is-spot")).toBe(true);
    expect(lane(el, "ret").classList.contains("is-spot")).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      lane: "vac",
      label: "Vacaciones",
      index: 2,
      total: 2,
      own: 3,
      other: 1,
      late: 1,
      tones: [1, 1, 0, 1],
      oldest: { id: "3", age: 12, stage: "rev", stageLabel: "Revisar" },
      jam: { stage: "rev", label: "Revisar", late: 1, count: 2 },
    });
    // Repintar sin cambios no lo repite; quitar el foco sí avisa.
    el.heading = "Torre";
    await tick();
    expect(seen).toHaveLength(1);
    el.spotlight = null;
    await tick();
    expect(seen.at(-1)!.lane).toBeNull();
  });

  it("cycle rota el foco por los carriles con atrasados", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const el = await mount({ cycle: "5" });
    await tick();
    // Primero el de más atrasados (Retiros: 2), luego Vacaciones (1); Cesantías no tiene nada.
    expect(el.spotlight).toBe("ret");
    vi.advanceTimersByTime(5000);
    await tick();
    expect(el.spotlight).toBe("vac");
    vi.advanceTimersByTime(5000);
    await tick();
    expect(el.spotlight).toBe("ret");
    el.cycle = 0;
    await tick();
    vi.advanceTimersByTime(20000);
    await tick();
    expect(el.spotlight).toBe("ret");
  });

  it("cycle no baja de 3 s y se apaga al desconectar", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const el = await mount({ cycle: "1" });
    expect(el.cycle).toBe(3);
    el.remove();
    const at = el.spotlight;
    vi.advanceTimersByTime(30000);
    expect(el.spotlight).toBe(at);
  });

  it("lee lanes, items y bands desde atributos JSON y avisa si no son JSON", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = document.createElement("nx-lanes") as NxLanes;
    el.setAttribute("lanes", JSON.stringify(LANES));
    el.setAttribute("items", JSON.stringify(ITEMS));
    el.setAttribute("bands", "[5]");
    document.body.append(el);
    await tick();
    expect(el.querySelectorAll(".nx-lanes__dot")).toHaveLength(7);
    expect(dot(el, "7")!.className).toBe("nx-lanes__dot is-late is-pulse");
    el.setAttribute("items", "{nope");
    expect(warn).toHaveBeenCalledWith('[nx-lanes] el atributo "items" no es JSON válido');
    warn.mockRestore();
  });

  it("sin carriles dice que no hay; con título, lo pinta con su nivel", async () => {
    const el = document.createElement("nx-lanes") as NxLanes;
    document.body.append(el);
    await tick();
    const empty = el.querySelector<HTMLElement>(".nx-lanes__empty")!;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toBe("Sin carriles.");
    expect(el.querySelector<HTMLElement>(".nx-lanes__heading")!.hidden).toBe(true);
    el.heading = "Torre de control";
    el.headingLevel = 3;
    await tick();
    const hd = el.querySelector<HTMLElement>(".nx-lanes__heading")!;
    expect(hd.tagName).toBe("H3");
    expect(hd.textContent).toBe("Torre de control");
    expect(el.querySelector(".nx-lanes__list")!.getAttribute("aria-label")).toBe("Torre de control");
  });

  it("al cambiar los carriles, los puntos se rehacen en su sitio", async () => {
    const el = await mount();
    el.lanes = LANES.slice(1);
    await tick();
    expect(el.querySelectorAll(".nx-lanes__lane")).toHaveLength(2);
    expect(el.querySelectorAll(".nx-lanes__dot")).toHaveLength(3);
    expect(dot(el, "5")!.closest(".nx-lanes__lane")!.getAttribute("data-lane")).toBe("ret");
  });

  it("lo que no cabe en una bandeja se cuenta como «+N»", async () => {
    const many: LaneItem[] = Array.from({ length: 300 }, (_, i) => ({ id: `m${i}`, lane: "ces", stage: "rev", age: i % 20 }));
    const el = await mount({}, many);
    const more = lane(el, "ces").querySelector<HTMLElement>(".nx-lanes__more")!;
    expect(more.hidden).toBe(false);
    expect(more.textContent).toMatch(/^\+\d+$/);
    const hidden = el.querySelectorAll(".nx-lanes__dot.is-over-cap").length;
    expect(more.textContent).toBe(`+${hidden}`);
  });
});

describe("<nx-lanes>: lo que encontró la revisión", () => {
  it("los datos que llegan después de montar son la primera carga: sin nx-lanes-change ni puntos que crecen", async () => {
    const el = document.createElement("nx-lanes") as NxLanes;
    document.body.append(el);
    await tick();
    const changes: unknown[] = [];
    el.addEventListener("nx-lanes-change", (e) => changes.push(e.detail));
    el.lanes = LANES;
    await tick();
    el.items = ITEMS;
    await tick();
    expect(changes).toEqual([]);
    expect(el.querySelectorAll(".nx-lanes__dot")).toHaveLength(7);
    expect(el.querySelectorAll(".nx-lanes__dot.is-born")).toHaveLength(0);
    // La siguiente carga sí cuenta.
    el.items = ITEMS.slice(1);
    await tick();
    expect(changes).toEqual([{ moved: [], added: [], removed: [{ id: "1", lane: "vac", stage: "jefe" }] }]);
  });

  it("cambiar los carriles no cuenta como cerrar ni abrir", async () => {
    const el = await mount();
    const changes: unknown[] = [];
    el.addEventListener("nx-lanes-change", (e) => changes.push(e.detail));
    el.lanes = LANES.slice(1);
    await tick();
    el.lanes = [];
    await tick();
    el.lanes = LANES;
    await tick();
    expect(changes).toEqual([]);
    expect(el.querySelectorAll(".nx-lanes__dot")).toHaveLength(7);
  });

  it("cambiar carriles y cycle a la vez no lanza; el foco se elige con los carriles nuevos", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const el = await mount();
    expect(() => {
      el.lanes = [LANES[0]];
      el.cycle = 5;
    }).not.toThrow();
    await tick();
    await tick();
    expect(el.spotlight).toBe("vac");
    vi.advanceTimersByTime(5000);
    await tick();
    expect(el.spotlight).toBe("vac");
  });

  it("un oyente que cambia los carriles con un foco puesto no rompe el pintado", async () => {
    const el = await mount({ spotlight: "ret" });
    const errors: unknown[] = [];
    const onError = (e: unknown) => errors.push(e);
    process.on("uncaughtException", onError);
    el.addEventListener("nx-lanes-change", () => (el.lanes = [LANES[2], LANES[1]]), { once: true });
    el.items = ITEMS.slice(1);
    await tick();
    await tick();
    process.off("uncaughtException", onError);
    expect(errors).toEqual([]);
    expect(lane(el, "ret").classList.contains("is-spot")).toBe(true);
  });

  it("con cycle, el foco se elige en cuanto llegan los datos y salta si su carril se va", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const el = document.createElement("nx-lanes") as NxLanes;
    el.setAttribute("cycle", "12");
    el.lanes = LANES;
    document.body.append(el);
    await tick();
    expect(el.spotlight).toBeNull();
    el.items = ITEMS;
    await tick();
    await tick();
    expect(el.spotlight).toBe("ret");
    el.lanes = [LANES[0], LANES[2]];
    await tick();
    await tick();
    expect(el.spotlight).toBe("vac");
    expect(lane(el, "vac").classList.contains("is-spot")).toBe(true);
  });

  it("sin foco no llegan avisos de foco vacío", async () => {
    const el = document.createElement("nx-lanes") as NxLanes;
    const seen: unknown[] = [];
    el.addEventListener("nx-lanes-spotlight", (e) => seen.push(e.detail));
    document.body.append(el);
    el.lanes = LANES;
    el.items = ITEMS;
    await tick();
    el.items = ITEMS.slice(2);
    await tick();
    expect(seen).toEqual([]);
  });

  it("con edades fraccionarias, el color va con los días cumplidos (lo que se muestra)", async () => {
    const el = await mount({}, [
      { id: "a", lane: "ret", stage: "liq", age: 2.5 },
      { id: "b", lane: "ret", stage: "pag", age: 10.4 },
    ]);
    expect(dot(el, "a")!.className).toBe("nx-lanes__dot is-fresh");
    expect(dot(el, "b")!.className).toBe("nx-lanes__dot is-warn");
    const old = lane(el, "ret").querySelector(".nx-lanes__oldest")!;
    expect(old.textContent).toBe("la más vieja 10 d");
    expect(old.classList.contains("is-late")).toBe(false);
  });

  it("cambiar tramos, textos o idioma no rehace los puntos", async () => {
    const el = await mount();
    const node = dot(el, "3");
    el.bands = [5, 20];
    await tick();
    el.labels = { item: "caso|casos" };
    await tick();
    el.locale = "en-US";
    await tick();
    expect(dot(el, "3")).toBe(node);
    expect(node!.className).toBe("nx-lanes__dot is-warn");
  });

  it("el «+N» de la última bandeja va antes de la pila, para no salirse del carril", async () => {
    // Ocho bandejas en 880 px: la pila de la última llega a ~4 px de la punta.
    const eight: Lane = { id: "ret", label: "Retiros", stages: Array.from({ length: 8 }, (_, i) => ({ id: `s${i}`, label: `S${i}` })) };
    const many: LaneItem[] = ["s0", "s7"].flatMap((st) => Array.from({ length: 100 }, (_, i) => ({ id: `${st}-${i}`, lane: "ret", stage: st, age: 1 })));
    const el = await mount({}, many);
    el.lanes = [eight];
    await tick();
    const mores = lane(el, "ret").querySelectorAll<HTMLElement>(".nx-lanes__more");
    expect(mores[0].hidden).toBe(false);
    expect(mores[0].style.transform).not.toMatch(/translateX/);
    expect(mores[7].hidden).toBe(false);
    expect(mores[7].style.transform).toMatch(/translateX\(-100%\)$/);
  });
});

describe("<nx-lanes>: de derecha a izquierda", () => {
  it("en RTL los puntos se espejan: la primera bandeja queda a la derecha", async () => {
    const el = document.createElement("nx-lanes") as NxLanes;
    el.style.direction = "rtl";
    el.lanes = [{ id: "ret", label: "Retiros", stages: [{ id: "liq", label: "Liquidar" }, { id: "pag", label: "Pagar" }] }];
    el.items = [{ id: "a", lane: "ret", stage: "liq", age: 1 }];
    document.body.append(el);
    await tick();
    expect(getComputedStyle(el.querySelector(".nx-lanes__list")!).direction).toBe("rtl");
    // 880 px, dos bandejas: el centro de la primera queda a 220 px del borde derecho, en x = 660 − 4.
    expect(dot(el, "a")!.style.transform).toMatch(/^translate\(656px,/);
  });
});
