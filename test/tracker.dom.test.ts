// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/components/tracker/index";
import type { NxTracker, TrackerItem, TrackerSelectDetail } from "../src/components/tracker/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const ITEMS: TrackerItem[] = [
  {
    id: "abs-7",
    title: "Permiso · cita odontológica",
    subtitle: "miércoles 14 de octubre · 7:00 a 9:00 a. m.",
    icon: "clock",
    status: { label: "Por aprobar", tone: "warning" },
    steps: [
      { label: "Enviado", detail: "Ayer, 4:12 p. m.", state: "done" },
      { label: "Con tu jefe", detail: "Marcela Ruiz", state: "current" },
      { label: "Aprobado", state: "todo" },
    ],
    href: "/permisos/7",
  },
  {
    id: "vac-idea",
    eyebrow: "Para ti",
    title: "18 días de descanso con 9 de vacaciones",
    days: { start: "2026-12-28", end: "2027-01-08" },
    actions: [
      { label: "Pedir esas fechas", href: "/vac?desde=2026-12-28", primary: true },
      { label: "Reglamento", href: "/reglamento.pdf", newTab: true },
    ],
  },
];

async function mount(items = ITEMS): Promise<NxTracker> {
  const el = document.createElement("nx-tracker") as NxTracker;
  el.items = items;
  document.body.append(el);
  await tick();
  return el;
}

describe("<nx-tracker>", () => {
  it("una tarjeta por solicitud: título enlazado, estado, pasos con el actual marcado", async () => {
    const el = await mount();
    const cards = el.querySelectorAll(".nx-tracker__card");
    expect(cards).toHaveLength(2);
    const first = cards[0];
    expect(first.querySelector("h3 a")?.getAttribute("href")).toBe("/permisos/7");
    expect(first.querySelector(".nx-tracker__status")?.className).toContain("is-warning");
    const steps = [...first.querySelectorAll(".nx-tracker__step")];
    expect(steps.map((s) => s.className.replace("nx-tracker__step ", ""))).toEqual(["is-done", "is-current", "is-todo"]);
    expect(steps[1].getAttribute("aria-current")).toBe("step");
    expect(steps[1].textContent).toBe("Con tu jefeMarcela Ruiz");
    expect(first.querySelector(".nx-tracker__icon svg, .nx-tracker__icon span")).not.toBeNull();
  });

  it("la tira de días: del 25 de diciembre al 11 de enero, con los 9 que se piden y los festivos", async () => {
    const el = await mount();
    const days = [...el.querySelectorAll<HTMLElement>(".nx-tracker__card.is-suggestion .nx-tracker__day")];
    expect(days).toHaveLength(18);
    expect(days[0].textContent).toBe("25");
    expect(days[17].textContent).toBe("11");
    expect(days.filter((d) => d.classList.contains("is-asked"))).toHaveLength(9);
    expect(days.filter((d) => d.classList.contains("is-holiday")).map((d) => d.textContent)).toEqual(["25", "1", "11"]);
    expect(days[0].title).toMatch(/Navidad/);
  });

  it("con sábados laborales la tira cambia", async () => {
    const el = await mount();
    el.workdays = [1, 2, 3, 4, 5, 6];
    await tick();
    const days = [...el.querySelectorAll<HTMLElement>(".nx-tracker__card.is-suggestion .nx-tracker__day")];
    expect(days.filter((d) => d.classList.contains("is-asked"))).toHaveLength(10); // + el sábado 2 de enero
  });

  it("acciones: la principal, las de otra pestaña y el evento cancelable", async () => {
    const el = await mount();
    const actions = [...el.querySelectorAll<HTMLAnchorElement>(".nx-tracker__action")];
    expect(actions.map((a) => [a.textContent, a.classList.contains("is-primary"), a.target])).toEqual([
      ["Pedir esas fechas", true, ""],
      ["Reglamento", false, "_blank"],
    ]);
    const seen: TrackerSelectDetail[] = [];
    el.addEventListener("nx-tracker-select", (e) => {
      seen.push(e.detail);
      e.preventDefault();
    });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    actions[0].dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(seen[0]).toMatchObject({ href: "/vac?desde=2026-12-28", action: { label: "Pedir esas fechas" } });
    expect(seen[0].item.id).toBe("vac-idea");
  });

  it("vacía: sin `empty` no ocupa espacio; con él, lo dice", async () => {
    const el = await mount([]);
    expect(el.hasAttribute("data-empty")).toBe(true);
    expect(el.querySelector(".nx-tracker__empty")).toBeNull();
    el.empty = "Nada en camino.";
    await tick();
    expect(el.querySelector(".nx-tracker__empty")?.textContent).toBe("Nada en camino.");
  });

  it("datos raros no rompen: href inseguro, estado desconocido, rango enorme", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = await mount([
      { id: "x", title: "X", href: "javascript:alert(1)", steps: [{ label: "A", state: "otro" as never }], days: { start: "2026-01-01", end: "2026-12-31" }, actions: [{ label: "Mal", href: "javascript:x" }] },
    ]);
    expect(el.querySelector("h3 a")).toBeNull();
    expect(el.querySelector(".nx-tracker__step")?.className).toContain("is-todo");
    expect(el.querySelector(".nx-tracker__strip")).toBeNull();
    expect(el.querySelector(".nx-tracker__action")).toBeNull();
    el.setAttribute("items", "{roto");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
