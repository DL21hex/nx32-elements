// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/phases/index";
import type { NxPhases, Phase } from "../src/components/phases/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const PHASES: Phase[] = [
  { id: "eps", from: 3, to: 90, label: "EPS", note: "66,67 % del salario", slot: 2, value: 4_000_000 },
  { id: "emp", from: 1, to: 2, label: "Empresa", note: "66,67 % del salario", slot: 1, value: 100_000 },
  { id: "eps50", from: 91, to: 180, label: "EPS", note: "50 % del salario", slot: 2 },
  { id: "afp", from: 181, to: 240, label: "Fondo de pensiones", slot: 5 },
];

async function mount(attrs: Record<string, string> = {}, phases: Phase[] = PHASES): Promise<NxPhases> {
  const el = document.createElement("nx-phases") as NxPhases;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.phases = phases;
  document.body.append(el);
  await tick();
  return el;
}

describe("<nx-phases>", () => {
  it("un trozo por tramo, en su lugar del eje, con su color", async () => {
    const el = await mount({ locale: "es-CO" });
    const segs = [...el.querySelectorAll<HTMLElement>(".nx-phases__seg")];
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.dataset.nxSlot)).toEqual(["1", "2", "2", "5"]);
    expect(segs[0].style.insetInlineStart).toBe("0%");
    expect(segs[2].style.insetInlineStart).toBe("37.5%");
    expect(segs[0].classList.contains("is-start")).toBe(true);
    expect(segs[3].classList.contains("is-end")).toBe(true);
    expect(segs[1].classList.contains("is-start") || segs[1].classList.contains("is-end")).toBe(false);
    // Sin hoy: todo pasado, nada rayado ni línea.
    expect(el.querySelector(".nx-phases__left")).toBeNull();
    expect(el.querySelector(".nx-phases__today")).toBeNull();
    expect(el.querySelector(".nx-phases__list")).toBeNull();
  });

  it("hoy: la línea con su etiqueta, lo que falta rayado y el resumen para el lector", async () => {
    const el = await mount({ locale: "es-CO", today: "120" });
    const bar = el.querySelector(".nx-phases__bar")!;
    expect(bar.getAttribute("role")).toBe("img");
    expect(bar.getAttribute("aria-label")).toBe("Días 1 a 2: Empresa; días 3 a 90: EPS; días 91 a 180: EPS; días 181 a 240: Fondo de pensiones; hoy, día 120");
    const today = el.querySelector<HTMLElement>(".nx-phases__today")!;
    expect(today.textContent).toBe("hoy · día 120");
    expect(today.style.insetInlineStart).toBe("calc(50% - 1px)");
    const segs = el.querySelectorAll(".nx-phases__seg");
    expect(segs[1].querySelector(".nx-phases__left")).toBeNull();
    expect(Number((segs[2].querySelector(".nx-phases__done") as HTMLElement).style.flexGrow)).toBe(30);
    expect(Number((segs[2].querySelector(".nx-phases__left") as HTMLElement).style.flexGrow)).toBe(60);
    expect(segs[3].querySelector(".nx-phases__done")).toBeNull();
    expect(el.querySelector(".nx-phases__chart")?.classList.contains("has-today")).toBe(true);
  });

  it("el eje: ticks sin pisarse, el primero y el último en los bordes", async () => {
    const el = await mount({ locale: "es-CO" });
    const ticks = [...el.querySelectorAll<HTMLElement>(".nx-phases__tick")];
    expect(ticks.map((t) => t.textContent)).toEqual(["día 1", "día 91", "día 181", "día 240"]);
    expect(ticks[0].classList.contains("is-first")).toBe(true);
    expect(ticks[3].classList.contains("is-last")).toBe(true);
    expect(ticks[3].style.insetInlineStart).toBe("100%");
    expect(el.querySelector(".nx-phases__axis")?.getAttribute("aria-hidden")).toBe("true");
    el.setAttribute("ticks", "1, 90, 180");
    await tick();
    expect([...el.querySelectorAll(".nx-phases__tick")].map((t) => t.textContent)).toEqual(["día 1", "día 90", "día 180"]);
    el.ticks = [];
    el.total = 300;
    await tick();
    expect([...el.querySelectorAll(".nx-phases__tick")].map((t) => t.textContent)).toEqual(["día 1", "día 91", "día 181", "día 300"]);
  });

  it("la lista: rango, nota, valor y lo que falta", async () => {
    const el = await mount({ locale: "es-CO", today: "179", list: "", format: "money", currency: "COP" });
    const rows = [...el.querySelectorAll(".nx-phases__row")];
    expect(rows).toHaveLength(4);
    expect(el.querySelector(".nx-phases__list")?.getAttribute("aria-label")).toBe("Tramos");
    expect(rows[0].querySelector("b")?.textContent).toBe("Empresa");
    expect(rows[0].querySelector(".nx-phases__range")?.textContent).toBe("días 1 a 2");
    expect(rows[0].querySelector(".nx-phases__value")?.textContent).toMatch(/100\.000/);
    expect(rows[0].querySelector(".nx-phases__status")).toBeNull();
    expect(rows[0].querySelector(".nx-phases__sub")?.textContent).toBe("66,67 % del salario");
    expect(rows[2].querySelector(".nx-phases__value")).toBeNull();
    expect(rows[2].querySelector(".nx-phases__status")?.textContent).toBe("falta 1 día");
    expect(rows[3].querySelector(".nx-phases__status")?.textContent).toBe("todavía no empieza");
    el.today = 100;
    await tick();
    expect(el.querySelectorAll(".nx-phases__row")[2].querySelector(".nx-phases__status")?.textContent).toBe("faltan 80 días");
    el.list = false;
    await tick();
    expect(el.querySelector(".nx-phases__list")).toBeNull();
  });

  it("tooltip con nombre, rango, nota y valor", async () => {
    const el = await mount({ locale: "es-CO", today: "50", format: "money" });
    el.querySelectorAll(".nx-phases__seg")[1].dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 5, clientY: 5 }));
    const tip = el.querySelector<HTMLElement>(".nx-chart-tip")!;
    expect(tip.hidden).toBe(false);
    expect(tip.querySelector(".nx-chart-tip__title")?.textContent).toBe("EPS");
    expect(tip.querySelector(".nx-chart-tip__row span")?.textContent).toBe("Días 3 a 90");
    expect(tip.querySelector(".nx-chart-tip__row b")?.textContent).toMatch(/4\.000\.000/);
    expect(tip.querySelector(".nx-chart-tip__foot")?.textContent).toBe("66,67 % del salario · faltan 40 días");
  });

  it("vacía, textos como texto y labels propios", async () => {
    const el = await mount({ labels: '{"empty":"Sin tramos.","day":"day {n}"}' }, []);
    expect(el.querySelector(".nx-phases__empty")?.textContent).toBe("Sin tramos.");
    el.setAttribute("phases", JSON.stringify([{ from: 1, to: 5, label: "<img src=x>" }]));
    await tick();
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector(".nx-phases__bar")?.getAttribute("aria-label")).toBe("Días 1 a 5: <img src=x>");
    expect([...el.querySelectorAll(".nx-phases__tick")].map((t) => t.textContent)).toEqual(["day 1", "day 5"]);
  });
});
