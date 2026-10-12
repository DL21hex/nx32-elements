// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/stats/index";
import type { NxStats, StatItem, StatsSelectDetail } from "../src/components/stats/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const ITEMS: StatItem[] = [
  { id: "pay", label: "Último pago", value: 1882000, format: "money", currency: "COP", note: "Catorcena 19 · 2026", badge: { label: "Sin abrir" }, trend: [1882000, 1974000, 1882000], href: "/pagos/40.pdf", newTab: true },
  { id: "vac", label: "Vacaciones en 2026", value: "8 días", note: "1 solicitud por aprobar", meter: { value: 8, max: 15 } },
  { id: "x", label: "En trámite", value: 2, ring: { value: 1, max: 3, text: "1/3" } },
];

describe("<nx-stats>", () => {
  it("cifras con su formato, nota, pastilla y forma", async () => {
    const el = document.createElement("nx-stats") as NxStats;
    el.setAttribute("locale", "es-CO");
    el.items = ITEMS;
    document.body.append(el);
    await tick();
    const items = [...el.querySelectorAll(".nx-stats__item")];
    expect(items).toHaveLength(3);
    expect(items[0].tagName).toBe("A");
    expect(items[0].getAttribute("target")).toBe("_blank");
    expect(items[0].querySelector(".nx-stats__value")?.textContent).toMatch(/1\.882\.000/);
    expect(items[0].querySelector(".nx-stats__badge")?.textContent).toBe("Sin abrir");
    expect(items[0].querySelector(".nx-stats__spark-line")?.getAttribute("d")).toMatch(/^M/);
    expect(items[1].tagName).toBe("DIV");
    expect(items[1].querySelector(".nx-stats__value")?.textContent).toBe("8 días");
    expect(items[1].querySelector<HTMLElement>(".nx-stats__meter i")!.style.width).toMatch(/^53\.3/);
    expect(items[2].querySelector(".nx-stats__ring text")?.textContent).toBe("1/3");
    expect(el.querySelector(".nx-stats__list")?.className).toContain("is-row");
  });

  it("en lista, evento cancelable y vacía sin nada", async () => {
    const el = document.createElement("nx-stats") as NxStats;
    el.layout = "list";
    el.items = ITEMS;
    document.body.append(el);
    await tick();
    expect(el.querySelector(".nx-stats__list")?.className).toContain("is-list");
    const seen: StatsSelectDetail[] = [];
    el.addEventListener("nx-stats-select", (e) => {
      seen.push(e.detail);
      e.preventDefault();
    });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    el.querySelector("a")!.dispatchEvent(click);
    expect(seen[0].item.id).toBe("pay");
    expect(click.defaultPrevented).toBe(true);
    el.items = [];
    await tick();
    expect(el.querySelector(".nx-stats__list")).toBeNull();
  });
});

describe("<nx-stats>: cambio y meta", () => {
  it("la flecha y el color siguen a la polaridad; la meta va en la minigráfica", async () => {
    const el = document.createElement("nx-stats") as NxStats;
    el.setAttribute("locale", "es-CO");
    el.items = [
      { id: "aus", label: "Ausentismo", value: 0.0183, format: "percent", trend: [0.015, 0.017, 0.0183], goal: 0.02, delta: { value: 0.003, format: "points", label: "frente a 2025" } },
      { id: "dias", label: "Días", value: 10012, delta: { value: -0.14 } },
      { id: "ventas", label: "Ventas", value: 5, delta: { value: 0.2, polarity: "up-good" } },
      { id: "x", label: "Igual", value: 5, delta: { value: 0.0001 } },
    ];
    document.body.append(el);
    await tick();
    const d = [...el.querySelectorAll(".nx-stats__delta")];
    expect(d[0].className).toBe("nx-stats__delta is-bad");
    expect(d[0].textContent).toBe("▲ Sube 0,3 pp frente a 2025");
    expect(d[1].className).toBe("nx-stats__delta is-good");
    expect(d[1].textContent).toMatch(/^▼ Baja 14\s?%$/);
    expect(d[2].className).toBe("nx-stats__delta is-good");
    expect(d[3].className).toBe("nx-stats__delta is-flat");
    expect(d[3].textContent).toMatch(/^= Igual/);
    const goal = el.querySelector(".nx-stats__spark-goal")!;
    expect(Number(goal.getAttribute("y1"))).toBe(1.5);
  });
});
