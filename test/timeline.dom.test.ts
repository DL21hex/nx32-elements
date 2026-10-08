// @vitest-environment happy-dom
//
// happy-dom no tiene Popover API ni calcula cajas: la lente se prueba por su contenido y su
// `hidden`, y la posición (fija a la ventana) se ve en el navegador. Lo mismo el desplazamiento
// hasta hoy en pantallas angostas.
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/timeline/index";
import type { NxTimeline, TimelineItem, TimelineLane, TimelineSelectDetail } from "../src/components/timeline/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const LANES: TimelineLane[] = [
  { id: "pay", label: "Pagos", kind: "bars" },
  { id: "rest", label: "Descansos", kind: "ranges" },
  { id: "perm", label: "Permisos", kind: "points" },
];
const ITEMS: TimelineItem[] = [
  { id: "p1", lane: "pay", date: "2026-09-15", value: 1974000, label: "Quincena del 1 al 15 de septiembre", detail: ["$ 1.974.000 netos"], href: "/pagos/2026-09-15", action: "Abrir el desprendible" },
  { id: "p2", lane: "pay", date: "2026-09-30", value: 1882000, label: "Quincena del 16 al 30 de septiembre", href: "/pagos/2026-09-30" },
  { id: "p3", lane: "pay", date: "2026-10-15", value: 1951000, label: "Quincena del 1 al 15 de octubre", caption: "en 7 días" },
  { id: "v1", lane: "rest", start: "2026-07-13", end: "2026-07-17", label: "Vacaciones", detail: ["5 días hábiles"] },
  { id: "v2", lane: "rest", start: "2026-12-28", end: "2027-01-08", state: "pending", label: "Vacaciones por aprobar" },
  { id: "x1", lane: "perm", date: "2026-10-14", state: "pending", label: "Cita odontológica" },
];

async function mount(extra: Partial<NxTimeline> = {}): Promise<NxTimeline> {
  const el = document.createElement("nx-timeline");
  el.setAttribute("start", "2026-01-01");
  el.setAttribute("end", "2027-02-28");
  el.setAttribute("today", "2026-10-08");
  Object.assign(el, { lanes: LANES, items: ITEMS, ...extra });
  document.body.append(el);
  await tick();
  return el;
}
const marks = (el: Element) => [...el.querySelectorAll<HTMLElement>(".nx-timeline__mark")];

describe("<nx-timeline>", () => {
  it("pinta carriles, meses, festivos, hoy y las marcas en su carril", async () => {
    const el = await mount({ heading: "Tu año", summary: "$ 36.600.400 recibidos" } as Partial<NxTimeline>);
    expect(el.querySelector("h2.nx-timeline__title")?.textContent).toBe("Tu año");
    expect(el.querySelector(".nx-timeline__summary")?.textContent).toBe("$ 36.600.400 recibidos");
    expect([...el.querySelectorAll(".nx-timeline__lane-label")].map((l) => l.textContent)).toEqual(["Pagos", "Descansos", "Permisos"]);
    expect(el.querySelectorAll(".nx-timeline__month")).toHaveLength(14);
    expect(el.querySelectorAll(".nx-timeline__holiday").length).toBe(21); // 19 de 2026 + 1 y 11 de enero de 2027
    expect(el.querySelector(".nx-timeline__today-pill")?.textContent).toMatch(/^Hoy · 8 oct/);
    const lanes = el.querySelectorAll(".nx-timeline__lane");
    expect(lanes[0].querySelectorAll(".nx-timeline__mark--bar")).toHaveLength(3);
    expect(lanes[1].querySelectorAll(".nx-timeline__mark--range")).toHaveLength(2);
    expect(lanes[2].querySelectorAll(".nx-timeline__mark--point")).toHaveLength(1);
    const track = el.querySelector(".nx-timeline__track")!;
    expect(track.getAttribute("role")).toBe("group");
    expect(track.getAttribute("aria-labelledby")).toBe(el.querySelector("h2")!.id);
  });

  it("estados por fecha, alto de las barras, enlaces reales y nombre accesible", async () => {
    const el = await mount();
    const [m1, , m3] = marks(el).filter((m) => m.classList.contains("nx-timeline__mark--bar"));
    expect(m1.tagName).toBe("A");
    expect(m1.getAttribute("href")).toBe("/pagos/2026-09-15");
    expect(m1.classList.contains("is-done")).toBe(true);
    expect(m1.style.getPropertyValue("--h")).toBe("100");
    expect(m1.getAttribute("aria-label")).toBe("Quincena del 1 al 15 de septiembre. $ 1.974.000 netos");
    expect(m3.tagName).toBe("BUTTON");
    expect(m3.classList.contains("is-upcoming")).toBe(true);
    expect(m3.getAttribute("aria-label")).toMatch(/por llegar$/);
    expect(m3.querySelector(".nx-timeline__caption")?.textContent).toBe("en 7 días");
    const pending = el.querySelector(".nx-timeline__mark--point")!;
    expect(pending.classList.contains("is-pending")).toBe(true);
    expect(pending.getAttribute("aria-label")).toBe("Cita odontológica. por aprobar");
  });

  it("un solo Tab (la marca de hoy en adelante) y las flechas recorren el eje", async () => {
    const el = await mount();
    const tabbable = marks(el).filter((m) => m.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0].getAttribute("aria-label")).toMatch(/^Cita odontológica/); // la primera desde hoy
    tabbable[0].focus();
    tabbable[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toMatch(/^Quincena del 1 al 15 de octubre/);
    (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toMatch(/^Vacaciones\. 5 días/);
    expect(marks(el).filter((m) => m.tabIndex === 0)).toEqual([document.activeElement]);
  });

  it("la lente dice el detalle al enfocar y se va con Escape", async () => {
    const el = await mount();
    const m1 = marks(el).find((m) => m.getAttribute("href") === "/pagos/2026-09-15")!;
    m1.focus();
    const lens = el.querySelector<HTMLElement>(".nx-timeline__lens")!;
    expect(lens.hidden).toBe(false);
    expect(lens.getAttribute("aria-hidden")).toBe("true");
    expect([...lens.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["Quincena del 1 al 15 de septiembre", "$ 1.974.000 netos", "Abrir el desprendible"]);
    m1.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(lens.hidden).toBe(true);
  });

  it("la lente de un festivo dice su nombre", async () => {
    const el = await mount();
    const tick12 = [...el.querySelectorAll<HTMLElement>(".nx-timeline__holiday")].find((t) => t.dataset.nxName === "Día de la Raza")!;
    tick12.dispatchEvent(new Event("pointerover", { bubbles: true }));
    const lens = el.querySelector<HTMLElement>(".nx-timeline__lens")!;
    expect(lens.hidden).toBe(false);
    expect(lens.querySelector(".nx-timeline__lens-title")?.textContent).toBe("Día de la Raza");
    expect(lens.textContent).toMatch(/lunes, 12 de octubre|lunes 12 de octubre/);
  });

  it("nx-timeline-select: cancelable, con el ítem y el href", async () => {
    const el = await mount();
    const seen: TimelineSelectDetail[] = [];
    el.addEventListener("nx-timeline-select", (e) => {
      seen.push(e.detail);
      e.preventDefault();
    });
    const m1 = marks(el).find((m) => m.getAttribute("href") === "/pagos/2026-09-15")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    m1.dispatchEvent(click);
    expect(seen[0].item.id).toBe("p1");
    expect(seen[0].href).toBe("/pagos/2026-09-15");
    expect(click.defaultPrevented).toBe(true);
    // Con Ctrl, el navegador decide (otra pestaña) y no se anuncia.
    m1.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(seen).toHaveLength(1);
  });

  it("resalta una marca y conserva el foco al cambiar los datos", async () => {
    const el = await mount();
    el.highlight = "p2";
    await tick();
    expect(el.querySelector(".is-highlight")?.getAttribute("href")).toBe("/pagos/2026-09-30");
    const m = marks(el).find((x) => x.getAttribute("href") === "/pagos/2026-09-30")!;
    m.focus();
    el.items = [...ITEMS, { id: "x2", lane: "perm", date: "2026-11-20", label: "Otro" }];
    await tick();
    expect((document.activeElement as HTMLElement).getAttribute("href")).toBe("/pagos/2026-09-30");
  });

  it("atributos JSON, leyenda, sin festivos y href inseguro descartado", async () => {
    const el = document.createElement("nx-timeline") as NxTimeline;
    el.setAttribute("today", "2026-10-08");
    el.setAttribute("lanes", JSON.stringify(LANES));
    el.setAttribute("items", JSON.stringify([{ lane: "pay", date: "2026-09-30", value: 1, label: "x", href: "javascript:alert(1)" }]));
    el.setAttribute("legend", JSON.stringify([{ mark: "bar", label: "Pagado" }, { mark: "holiday", label: "Festivo" }]));
    el.setAttribute("holidays", "null");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    el.setAttribute("labels", "{no es json");
    document.body.append(el);
    await tick();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect([...el.querySelectorAll(".nx-timeline__legend li")].map((l) => l.textContent)).toEqual(["Pagado", "Festivo"]);
    expect(el.querySelectorAll(".nx-timeline__holiday")).toHaveLength(0);
    const m = el.querySelector(".nx-timeline__mark")!;
    expect(m.tagName).toBe("BUTTON");
    expect(m.hasAttribute("href")).toBe(false);
  });

  it("sin carriles ni marcas no rompe y no ofrece Tab", async () => {
    const el = document.createElement("nx-timeline");
    document.body.append(el);
    await tick();
    expect(el.querySelector(".nx-timeline__track")).not.toBeNull();
    expect(el.querySelectorAll("[tabindex='0']")).toHaveLength(0);
    el.remove();
    document.body.append(el);
    await tick();
    expect(el.querySelectorAll(".nx-timeline__root")).toHaveLength(1);
  });
});
