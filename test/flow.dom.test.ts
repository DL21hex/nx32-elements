// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/flow/index";
import type { FlowItem, FlowStage, NxFlow } from "../src/components/flow/index";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const START = Date.UTC(2026, 9, 14, 5, 0); // 00:00 en Bogotá
const NOW = START + 15 * 3_600_000; // 15:00
const iso = (min: number) => new Date(NOW + min * 60_000).toISOString();

const STAGES: FlowStage[] = [
  { id: "ruta", label: "En ruta a finca", note: "salieron, no han ingresado", limit: 120 },
  { id: "finca", label: "En finca", limit: 120 },
  { id: "cierre", label: "Cerrado", limit: 60 },
  { id: "puerto", label: "Despachado a puerto", end: true },
];

const ITEMS: FlowItem[] = [
  { id: "a", label: "SZLU4012039", sub: "KMZ426 · Jair", meta: "Agape", times: { ruta: iso(-300), finca: iso(-200) } },
  { id: "b", label: "MSCU1", times: { ruta: iso(-100), finca: iso(-50) } },
  { id: "c", label: "MSCU2", flag: "Inspección con «No»", times: { ruta: iso(-30) } },
  { id: "d", label: "MSCU3", times: { ruta: iso(-400), finca: iso(-380), cierre: iso(-300), puerto: iso(-20) } },
  { id: "e", label: "MSCU4", times: { ruta: iso(60) } },
];

async function mount(attrs: Record<string, string> = {}, items: FlowItem[] = ITEMS, stages: FlowStage[] = STAGES): Promise<NxFlow> {
  const el = document.createElement("nx-flow") as NxFlow;
  el.setAttribute("locale", "es-CO");
  el.setAttribute("time-zone", "America/Bogota");
  el.setAttribute("now", new Date(NOW).toISOString());
  el.setAttribute("start", new Date(START).toISOString());
  el.setAttribute("end", new Date(START + 24 * 3_600_000).toISOString());
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.labels = { item: "viaje|viajes", ended: "despachados hoy" };
  el.stages = stages;
  el.items = items;
  document.body.append(el);
  await tick();
  return el;
}

const nums = (el: NxFlow) => [...el.querySelectorAll(".nx-flow__num > b")].map((b) => b.textContent);
const dot = (el: NxFlow, id: string) => el.querySelector<HTMLElement>(`.nx-flow__dot[data-nx-tip="${id}"]`)!;

describe("<nx-flow>", () => {
  it("cuenta cada etapa, la cola y lo despachado", async () => {
    const el = await mount();
    expect(nums(el)).toEqual(["1", "2", "0", "1"]);
    expect(el.querySelector(".nx-flow__total b")!.textContent).toBe("3");
    expect(el.querySelectorAll(".nx-flow__total")[1].textContent).toContain("despachados hoy");
    expect(el.querySelector(".nx-flow__heading")!.textContent).toBe("Flujo");
  });

  it("cada etapa es un botón con su resumen; el riel dice cuántos pasaron en la última hora", async () => {
    const el = await mount();
    const hits = [...el.querySelectorAll(".nx-flow__hit")];
    expect(hits).toHaveLength(4);
    expect(hits[1].getAttribute("aria-label")).toBe("En finca: 2 viajes, 1 pasa del límite de 2 h, mediana 2 h 5 min");
    expect(hits[0].getAttribute("aria-label")).toBe("En ruta a finca: 1 viaje, mediana 30 min");
    const rates = [...el.querySelectorAll(".nx-flow__rate")].map((r) => r.textContent);
    expect(rates).toEqual(["1/h", "0/h", "1/h"]);
    expect(el.querySelectorAll(".nx-flow__line.is-flowing")).toHaveLength(2);
    // La etapa vacía dice su nota.
    expect(el.querySelectorAll(".nx-flow__meta")[2].textContent).toBe("límite 1 h");
  });

  it("dice dónde se atasca", async () => {
    const el = await mount();
    const neck = el.querySelector(".nx-flow__st.is-neck")!;
    expect(neck.getAttribute("data-stage")).toBe("finca");
    expect(neck.querySelector<HTMLElement>(".nx-flow__tag")!.hidden).toBe(false);
    expect(el.querySelector(".nx-flow__insight")!.textContent).toBe(
      "Se acumula en En finca: 2 viajes, 1 lleva más de 2 h. En la última hora entraron 1 y salieron 0.",
    );
  });

  it("un punto por viaje, con su tono; el que no ha salido espera invisible", async () => {
    const el = await mount();
    expect(el.querySelectorAll(".nx-flow__dot")).toHaveLength(5);
    expect(dot(el, "a").className).toContain("is-over");
    expect(dot(el, "b").className).toContain("is-ok");
    expect(dot(el, "c").className).toContain("is-flag");
    expect(dot(el, "d").className).toContain("is-done");
    expect(dot(el, "e").className).toContain("is-ghost");
    expect(el.querySelector(".nx-flow__dots")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("con datos nuevos, el punto es el mismo nodo y viaja a su etapa", async () => {
    const el = await mount();
    const b = dot(el, "b");
    const before = b.style.transform;
    el.items = ITEMS.map((it) => (it.id === "b" ? { ...it, times: { ...it.times, cierre: iso(-5) } } : { ...it }));
    await tick();
    expect(dot(el, "b")).toBe(b);
    expect(b.style.transform).not.toBe(before);
    expect(nums(el)).toEqual(["1", "1", "1", "1"]);
    // Un viaje que ya no llega se va.
    el.items = ITEMS.filter((it) => it.id !== "a");
    await tick();
    expect(el.querySelector('.nx-flow__dot[data-nx-tip="a"]')).toBeNull();
  });

  it("elegir una etapa avisa y la marca; otra vez la suelta", async () => {
    const el = await mount();
    const seen: (string | null)[] = [];
    el.addEventListener("nx-flow-stage", (e) => seen.push(e.detail.stage));
    const hit = el.querySelectorAll<HTMLButtonElement>(".nx-flow__hit")[1];
    hit.click();
    await tick();
    expect(el.stage).toBe("finca");
    expect(hit.getAttribute("aria-pressed")).toBe("true");
    hit.click();
    await tick();
    expect(seen).toEqual(["finca", null]);
    expect(hit.getAttribute("aria-pressed")).toBe("false");
  });

  it("tocar un punto muestra el viaje y sus horas bajo cada etapa; Escape lo suelta", async () => {
    const el = await mount();
    const seen: (string | null)[] = [];
    el.addEventListener("nx-flow-item", (e) => seen.push(e.detail.id));
    dot(el, "a").click();
    await tick();
    const trip = el.querySelector<HTMLElement>(".nx-flow__trip")!;
    expect(trip.hidden).toBe(false);
    expect(trip.textContent).toContain("SZLU4012039");
    expect(trip.textContent).toContain("Agape");
    const cells = [...el.querySelectorAll<HTMLElement>(".nx-flow__cell")].map((c) => c.textContent);
    expect(cells).toEqual(["10:001 h 40 min", "11:40lleva 3 h 20 min", "—", "—"]);
    expect(dot(el, "a").className).toContain("is-sel");
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await tick();
    expect(trip.hidden).toBe(true);
    expect(seen).toEqual(["a", null]);
  });

  it("«Abrir» avisa a la app, o es un enlace si el viaje trae href", async () => {
    const el = await mount({ selected: "a" });
    const opened: string[] = [];
    el.addEventListener("nx-flow-open", (e) => opened.push(e.detail.id));
    el.querySelector<HTMLButtonElement>("button.nx-flow__open")!.click();
    expect(opened).toEqual(["a"]);
    el.items = ITEMS.map((it) => (it.id === "a" ? { ...it, href: "/viajes/a" } : it));
    await tick();
    expect(el.querySelector<HTMLAnchorElement>("a.nx-flow__open")!.getAttribute("href")).toBe("/viajes/a");
    el.items = ITEMS.map((it) => (it.id === "a" ? { ...it, href: "javascript:alert(1)" } : it));
    await tick();
    expect(el.querySelector("a.nx-flow__open")).toBeNull();
  });

  it("highlight atenúa lo que no sigue al filtro y dice «de N»", async () => {
    const el = await mount();
    el.highlight = ["a"];
    await tick();
    expect(nums(el)).toEqual(["0", "1", "0", "0"]);
    expect(el.querySelectorAll(".nx-flow__of")[1].textContent).toBe("de 2");
    expect(dot(el, "b").className).toContain("is-dim");
    expect(dot(el, "a").className).toContain("is-focus");
    el.highlight = null;
    await tick();
    expect(nums(el)).toEqual(["1", "2", "0", "1"]);
    expect(dot(el, "b").className).not.toContain("is-dim");
  });

  it("la línea del día: mirar otra hora y volver a ahora", async () => {
    const el = await mount();
    expect(el.querySelector(".nx-flow__live")!.textContent).toContain("En vivo");
    const range = el.querySelector<HTMLInputElement>(".nx-flow__range")!;
    expect(range.max).toBe(String(15 * 60));
    range.value = String(10 * 60 + 30);
    range.dispatchEvent(new Event("input"));
    expect(el.querySelector(".nx-flow__live")!.textContent).toContain("Viendo las 10:30");
    expect(nums(el)).toEqual(["1", "0", "1", "0"]);
    expect(el.at).toBe(START + (10 * 60 + 30) * 60_000);
    el.querySelector<HTMLButtonElement>(".nx-flow__back")!.click();
    expect(el.at).toBeNull();
    expect(nums(el)).toEqual(["1", "2", "0", "1"]);
    expect(el.querySelector(".nx-flow__curve path.nx-flow__stroke")!.getAttribute("d")).toMatch(/^M0\.0,/);
    expect(el.querySelectorAll(".nx-flow__hours span").length).toBeGreaterThan(2);
  });

  it("un día que ya terminó no está en vivo ni deja un reloj corriendo", async () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    const el = await mount({ end: new Date(START + 14 * 3_600_000).toISOString() });
    expect(el.querySelector<HTMLElement>(".nx-flow__live")!.hidden).toBe(true);
    expect(el.querySelector(".nx-flow__clock span")!.textContent).toBe("fin del día");
    expect(el.querySelector(".nx-flow__clock b")!.textContent).toBe("14:00");
    expect(spy.mock.calls.filter(([, ms]) => ms === 30_000)).toHaveLength(0);
    spy.mockRestore();
  });

  it("en vivo, el reloj avanza solo y se apaga al salir de la página", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(NOW);
    const el = await mount();
    expect(dot(el, "b").className).toContain("is-ok");
    vi.setSystemTime(NOW + 75 * 60_000);
    vi.advanceTimersByTime(30_000);
    await Promise.resolve();
    await Promise.resolve();
    // b ya lleva 2 h 5 min en la finca (límite, 2 h).
    expect(dot(el, "b").className).toContain("is-over");
    el.remove();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("el globo de un punto dice quién es y cuánto lleva", async () => {
    const el = await mount();
    dot(el, "a").dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 10, clientY: 10 }));
    const tip = el.querySelector<HTMLElement>(".nx-chart-tip")!;
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain("SZLU4012039");
    expect(tip.textContent).toContain("KMZ426 · Jair · Agape");
    expect(tip.textContent).toContain("lleva 3 h 20 min de 2 h · pasó el límite");
  });

  it("sin límites, la frase dice la etapa más llena; sin cola, que no hay nada", async () => {
    const el = await mount({}, ITEMS, STAGES.map(({ limit: _l, ...s }) => s));
    expect(el.querySelector(".nx-flow__insight")!.textContent).toBe("3 viajes en cola. La etapa más llena es En finca, con 2.");
    expect(el.querySelector(".nx-flow__legend")!.textContent).not.toContain("Pasó el límite");
    el.items = [];
    await tick();
    expect(el.querySelector(".nx-flow__insight")!.textContent).toBe("No hay nada en cola.");
  });

  it("los atributos JSON funcionan y uno roto avisa sin romper", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = await mount();
    el.setAttribute("labels", JSON.stringify({ heading: "Flujo del día", queue: "viajes en cola" }));
    el.setAttribute("items", "{roto");
    await tick();
    expect(el.querySelector(".nx-flow__heading")!.textContent).toBe("Flujo del día");
    expect(el.querySelector(".nx-flow__total span")!.textContent).toBe("viajes en cola");
    expect(warn).toHaveBeenCalledWith('[nx-flow] el atributo "items" no es JSON válido');
    expect(nums(el)).toEqual(["1", "2", "0", "1"]);
    warn.mockRestore();
  });

  it("sin etapas dice que no hay; heading vacío quita el título", async () => {
    const el = await mount({ heading: "" }, [], []);
    expect(el.querySelector<HTMLElement>(".nx-flow__empty")!.hidden).toBe(false);
    expect(el.querySelector(".nx-flow__root")!.classList.contains("is-empty")).toBe(true);
    el.stages = STAGES;
    await tick();
    expect(el.querySelector<HTMLElement>(".nx-flow__heading")!.hidden).toBe(true);
    expect(el.querySelectorAll(".nx-flow__st")).toHaveLength(4);
  });

  it("aguanta datos raros: horas inválidas, ids repetidos, sin times", async () => {
    const el = await mount({}, [
      { id: "x", label: "X", times: { ruta: "ayer", finca: iso(-10) } },
      { id: "x", label: "Repetido", times: { ruta: iso(-5) } },
      { id: "y", label: "Y", times: null as unknown as FlowItem["times"] },
      null as unknown as FlowItem,
    ]);
    expect(nums(el)).toEqual(["0", "1", "0", "0"]);
    expect(el.querySelectorAll(".nx-flow__dot")).toHaveLength(1);
  });

  it("se puede sacar y volver a poner sin perder lo elegido ni duplicar nodos", async () => {
    const el = await mount({ selected: "a", stage: "finca" });
    const a = dot(el, "a");
    el.remove();
    document.body.append(el);
    await tick();
    expect(dot(el, "a")).toBe(a);
    expect(el.querySelectorAll(".nx-flow__root")).toHaveLength(1);
    expect(el.querySelectorAll(".nx-flow__st")).toHaveLength(4);
    expect(el.querySelector<HTMLElement>(".nx-flow__trip")!.hidden).toBe(false);
    expect(el.querySelector(".nx-flow__st.is-on")!.getAttribute("data-stage")).toBe("finca");
  });

  it("2.000 viajes se pintan rápido y repintar lo mismo no toca los puntos", async () => {
    const many: FlowItem[] = Array.from({ length: 2000 }, (_, i) => ({
      id: `m${i}`,
      label: `M${i}`,
      times: { ruta: iso(-600 + (i % 500)), finca: i % 3 ? iso(-500 + (i % 400)) : null, puerto: i % 7 ? null : iso(-10) },
    }));
    const t0 = performance.now();
    const el = await mount({}, many);
    expect(performance.now() - t0).toBeLessThan(2500);
    expect(el.querySelectorAll(".nx-flow__dot")).toHaveLength(2000);
    expect(el.querySelector(".nx-flow__root")!.classList.contains("is-crowded")).toBe(true);
    const first = dot(el, "m1");
    const style = first.getAttribute("style");
    el.items = many.map((m) => ({ ...m }));
    await tick();
    expect(dot(el, "m1")).toBe(first);
    expect(first.getAttribute("style")).toBe(style);
    // Lo que no cabe se cuenta como «+N».
    expect([...el.querySelectorAll<HTMLElement>(".nx-flow__more")].some((m) => !m.hidden && /^\+\d/.test(m.textContent ?? ""))).toBe(true);
  });
});

describe("<nx-flow>: lo que encontró la revisión", () => {
  it("si la app lo mueve a media repetición, la repetición sigue (no se queda en una hora vieja)", async () => {
    const el = await mount();
    el.querySelector<HTMLButtonElement>(".nx-flow__play")!.click();
    expect(el.querySelector(".nx-flow__play")!.textContent).toBe("Pausar");
    const other = document.createElement("div");
    document.body.append(other);
    other.append(el);
    await tick();
    expect(el.querySelector(".nx-flow__play")!.textContent).toBe("Pausar");
    expect(el.querySelector(".nx-flow__root")!.classList.contains("is-playing")).toBe(true);
    el.querySelector<HTMLButtonElement>(".nx-flow__play")!.click();
    expect(el.querySelector(".nx-flow__play")!.textContent).toBe("Repetir el día");
  });

  it("la franja del elegido no se rehace si no cambia lo que dice, y sus botones siguen andando", async () => {
    const el = await mount({ selected: "a" });
    const close = el.querySelector<HTMLButtonElement>(".nx-flow__close")!;
    el.items = ITEMS.map((it) => ({ ...it }));
    await tick();
    expect(el.querySelector(".nx-flow__close")).toBe(close);
    close.click();
    await tick();
    expect(el.selected).toBeNull();
    expect(el.querySelector<HTMLElement>(".nx-flow__trip")!.hidden).toBe(true);
  });

  it("una hora absurda no rompe el pintado", async () => {
    const el = await mount();
    el.now = 1.76e18;
    el.items = [...ITEMS, { id: "z", label: "Z", times: { puerto: -9e15, ruta: 0 } }];
    await tick();
    expect(() => el.live()).not.toThrow();
    expect(el.querySelectorAll(".nx-flow__dot")).toHaveLength(5);
  });

  it("con highlight, los resaltados no quedan escondidos en «+N»", async () => {
    const many: FlowItem[] = Array.from({ length: 600 }, (_, i) => ({ id: `m${i}`, label: `M${i}`, times: { finca: iso(-600 + i) } }));
    const el = await mount({}, many);
    el.highlight = ["m597", "m598", "m599"];
    await tick();
    for (const id of ["m597", "m598", "m599"]) expect(dot(el, id).className).not.toContain("is-over-cap");
    expect(el.querySelectorAll(".nx-flow__hit")[1].getAttribute("aria-label")).toContain("En finca: 3 de 600 viajes");
  });

  it("al desconectarse no deja la colocación instantánea pegada", async () => {
    const el = await mount();
    el.remove();
    expect(el.querySelector(".nx-flow__root")!.classList.contains("is-instant")).toBe(false);
  });

  it("Escape suelta el elegido y no sigue subiendo (no cierra el diálogo que lo contiene)", async () => {
    const el = await mount({ selected: "a" });
    let reached = false;
    document.body.addEventListener("keydown", () => (reached = true));
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(el.selected).toBeNull();
    expect(reached).toBe(false);
  });

  it("flag: true sale en la leyenda y en el punto, sin escribir «true»", async () => {
    const el = await mount({}, [{ id: "t", label: "T", flag: true, times: { ruta: iso(-10) } }]);
    expect(el.querySelector(".nx-flow__legend")!.textContent).toContain("Con aviso");
    expect(dot(el, "t").className).toContain("is-flag");
    dot(el, "t").dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 1, clientY: 1 }));
    expect(el.querySelector(".nx-chart-tip")!.textContent).not.toContain("true");
  });

  it("el botón de repetir no lleva aria-pressed (su texto ya dice qué hace)", async () => {
    const el = await mount();
    expect(el.querySelector(".nx-flow__play")!.hasAttribute("aria-pressed")).toBe(false);
  });
});
