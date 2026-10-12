// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/insights/index";
import "../src/components/board/index";
import { emphasis, type InsightItem, type InsightsActionDetail, type NxInsights } from "../src/components/insights/index";
import type { NxBoard } from "../src/components/board/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));
/** Un clic; devuelve si el componente lo canceló. Después se cancela siempre, para que happy-dom
 *  no intente navegar a los enlaces. */
const click = (el: Element, init: MouseEventInit = {}) => {
  let prevented = false;
  const stop = (e: Event) => {
    prevented = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener("click", stop, { once: true });
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  document.removeEventListener("click", stop);
  return { defaultPrevented: prevented };
};

const ITEMS: InsightItem[] = [
  { id: "cambio", text: "Los días **subieron 18 %** frente a 2025. Logística explica **62 %** del aumento.", tone: "bad", icon: "up", action: { label: "Ver solo Logística", filter: "area:log" } },
  { id: "lunes", text: "El **31 %** empieza un lunes.", icon: "calendar", action: { label: "Ver el informe", href: "/sst/lunes" } },
  { id: "pago", text: "Sura paga en 41 días.", tone: "good", icon: "money", action: { label: "Avisar" } },
  { id: "raro", text: "Sin ícono conocido.", tone: "otro" as never, icon: "nube" as never },
  { id: "vacio", text: "   " },
];

async function mount(items: InsightItem[] = ITEMS): Promise<NxInsights> {
  document.body.innerHTML = `<nx-insights></nx-insights>`;
  const el = document.querySelector("nx-insights")!;
  el.items = items;
  await tick();
  return el;
}

describe("emphasis", () => {
  it("parte la frase en texto y negritas", () => {
    expect(emphasis("Los días **subieron 18 %** frente a **2025**.")).toEqual(["Los días ", { b: "subieron 18 %" }, " frente a ", { b: "2025" }, "."]);
    expect(emphasis("**todo**")).toEqual([{ b: "todo" }]);
    expect(emphasis("sin marcas")).toEqual(["sin marcas"]);
    expect(emphasis("")).toEqual([]);
  });
  it("un ** sin cerrar o vacío se queda como texto", () => {
    expect(emphasis("a **b** c **d")).toEqual(["a ", { b: "b" }, " c **d"]);
    expect(emphasis("x **** y")).toEqual(["x **** y"]);
    expect(emphasis("2 * 3 = 6")).toEqual(["2 * 3 = 6"]);
  });
});

describe("<nx-insights>", () => {
  it("frases con su marca, su énfasis y su acción", async () => {
    const el = await mount();
    const ol = el.querySelector("ol.nx-insights__list")!;
    expect(ol.getAttribute("aria-label")).toBe("Lectura");
    const items = el.querySelectorAll(".nx-insights__item");
    expect(items).toHaveLength(4);
    expect(items[0].querySelector(".nx-insights__mark")!.className).toContain("is-bad");
    expect(items[0].querySelector(".nx-insights__mark svg")).toBeTruthy();
    expect([...items[0].querySelectorAll("b")].map((b) => b.textContent)).toEqual(["subieron 18 %", "62 %"]);
    expect(items[0].querySelector(".nx-insights__text")!.textContent).toBe("Los días subieron 18 % frente a 2025. Logística explica 62 % del aumento.");
    const filt = items[0].querySelector("button.nx-insights__action")!;
    expect(filt.getAttribute("data-nx-filter")).toBe("area:log");
    expect(filt.getAttribute("data-nx-label")).toBe("Ver solo Logística");
    expect(items[1].querySelector(".nx-insights__mark")!.className).toContain("is-neutral");
    expect(items[1].querySelector("a.nx-insights__action")!.getAttribute("href")).toBe("/sst/lunes");
    expect(items[2].querySelector(".nx-insights__mark")!.className).toContain("is-good");
    expect(items[2].querySelector("button.nx-insights__action")!.hasAttribute("data-nx-filter")).toBe(false);
    expect(items[3].querySelector(".nx-insights__mark")!.className).toContain("is-neutral");
    expect(items[3].querySelector(".nx-insights__action")).toBeNull();
  });

  it("los datos van como texto, nunca como HTML", async () => {
    const el = await mount([{ id: "a", text: "<img src=x onerror=alert(1)> **<i>b</i>**", action: { label: "<u>v</u>", href: "javascript:alert(1)" } }]);
    expect(el.querySelector("img, i, u, a")).toBeNull();
    expect(el.querySelector("b")!.textContent).toBe("<i>b</i>");
  });

  it("atributos en JSON, labels y vacío", async () => {
    const el = await mount([]);
    expect(el.querySelector(".nx-insights__empty")!.textContent).toBe("Sin hallazgos con estos filtros.");
    el.setAttribute("empty", "Sin datos");
    await tick();
    expect(el.querySelector(".nx-insights__empty")!.textContent).toBe("Sin datos");
    el.setAttribute("labels", '{"group":"Hallazgos"}');
    el.setAttribute("items", JSON.stringify([{ id: "q", text: "Una **frase**." }]));
    await tick();
    expect(el.querySelector("ol")!.getAttribute("aria-label")).toBe("Hallazgos");
    expect(el.querySelector("b")!.textContent).toBe("frase");
  });

  it("repintar devuelve el foco a la misma acción", async () => {
    const el = await mount();
    const btn = el.querySelector<HTMLElement>('[data-nx-key="pago"] .nx-insights__action')!;
    btn.focus();
    el.items = ITEMS.slice(1);
    await tick();
    expect(document.activeElement).toBe(el.querySelector('[data-nx-key="pago"] .nx-insights__action'));
    expect(document.activeElement).not.toBe(btn);
  });

  it("nx-insights-action: avisa; cancelado, ni navega ni filtra el tablero", async () => {
    document.body.innerHTML = `<nx-board><nx-insights></nx-insights></nx-board>`;
    const board = document.querySelector("nx-board") as NxBoard;
    const el = document.querySelector("nx-insights")!;
    el.items = ITEMS;
    await tick();
    const seen: InsightsActionDetail[] = [];
    let cancel = true;
    el.addEventListener("nx-insights-action", (e) => {
      seen.push(e.detail);
      if (cancel) e.preventDefault();
    });
    const link = el.querySelector("a.nx-insights__action")!;
    expect(click(link).defaultPrevented).toBe(true);
    expect(seen[0].item.id).toBe("lunes");
    const btn = el.querySelector('[data-nx-key="cambio"] .nx-insights__action')!;
    click(btn);
    expect(board.filters).toEqual({});
    cancel = false;
    click(btn);
    expect(seen.map((d) => d.item.id)).toEqual(["lunes", "cambio", "cambio"]);
    expect(board.filters).toEqual({ area: ["log"] });
  });
});
