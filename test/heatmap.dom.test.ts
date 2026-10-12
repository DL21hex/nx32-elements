// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/heatmap/index";
import "../src/components/board/index";
import type { HeatmapSelectDetail, NxHeatmap } from "../src/components/heatmap/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

const ROWS = [
  { id: "prod", label: "Producción", note: "420", total: 0.021, delta: 0.003 },
  { id: "emp", label: "Empacadoras", note: "310", total: 0.034, delta: -0.002 },
];
const COLS = [{ id: "20", label: "jun" }, { id: "21", label: "jul" }, { id: "22", label: "ago" }];
const VALUES = [[0.02, 0.022, null], [0.03, 0.039, 0.033]];

async function mount(attrs = ""): Promise<NxHeatmap> {
  document.body.innerHTML = `<nx-board><nx-heatmap locale="es-CO" format="percent" ${attrs}></nx-heatmap></nx-board>`;
  await tick();
  const el = document.querySelector("nx-heatmap")!;
  el.rows = ROWS;
  el.columns = COLS;
  el.values = VALUES;
  await tick();
  return el;
}

describe("<nx-heatmap>", () => {
  it("una tabla con encabezados, el valor escrito, el color por escala y los totales", async () => {
    const el = await mount();
    expect([...el.querySelectorAll("thead th")].map((th) => th.textContent)).toEqual(["jun", "jul", "ago", "Total"]);
    const rows = el.querySelectorAll("tbody tr");
    expect(rows[1].querySelector("th")?.textContent).toBe("Empacadoras310");
    const cells = [...rows[1].querySelectorAll<HTMLElement>(".nx-heatmap__c")];
    expect(cells.map((c) => c.textContent)).toEqual(["3,0", "3,9", "3,3"]);
    expect(cells[1].style.getPropertyValue("--nx-heatmap-mix")).toBe("100%");
    expect(cells[1].hasAttribute("data-strong")).toBe(true);
    const empty = rows[0].querySelectorAll<HTMLElement>(".nx-heatmap__c")[2];
    expect(empty.textContent).toBe("—");
    expect(empty.hasAttribute("data-empty")).toBe(true);
    expect(empty.getAttribute("aria-label")).toBe("Producción, ago: Sin dato");
    const totals = el.querySelectorAll(".nx-heatmap__total");
    expect(totals[0].querySelector("b")?.textContent).toMatch(/^2,1\s?%$/);
    expect(totals[0].querySelector("small")?.textContent).toBe("▲ 0,3 pp");
    expect(totals[0].querySelector("small")?.className).toBe("is-bad");
    expect(totals[1].querySelector("small")?.className).toBe("is-good");
    expect(el.querySelector(".nx-heatmap__scale")?.getAttribute("aria-label")).toMatch(/Escala de color: 0,0\s?% – 3,9\s?%/);
    // Sin dimensiones, nada es botón.
    expect(el.querySelector("button")).toBeNull();
  });

  it("con dimensiones: filas, columnas y celdas filtran el tablero, con una sola parada de Tab", async () => {
    const el = await mount('row-dimension="area" column-dimension="mes"');
    const cell = el.querySelector<HTMLButtonElement>('button[data-r="1"][data-c="2"]')!;
    expect(cell.getAttribute("data-nx-filter")).toBe("area:emp,mes:22");
    expect(el.querySelector('button[data-r="-1"][data-c="0"]')?.getAttribute("data-nx-filter")).toBe("mes:20");
    expect(el.querySelector('button[data-r="0"][data-c="-1"]')?.getAttribute("data-nx-filter")).toBe("area:prod");
    expect(el.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    const seen: HeatmapSelectDetail[] = [];
    el.addEventListener("nx-heatmap-select", (e) => seen.push(e.detail));
    cell.click();
    expect(seen[0]).toEqual({ row: ROWS[1], column: COLS[2], value: 0.033 });
    expect(document.querySelector("nx-board")!.filters).toEqual({ area: ["emp"], mes: ["22"] });
    expect(cell.tabIndex).toBe(0);
    key(cell, "ArrowLeft");
    expect(document.activeElement).toBe(el.querySelector('button[data-r="1"][data-c="1"]'));
    key(document.activeElement!, "Home");
    expect(document.activeElement).toBe(el.querySelector('button[data-r="1"][data-c="-1"]'));
    key(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(el.querySelector('button[data-r="0"][data-c="-1"]'));
    key(document.activeElement!, "ArrowUp");
    expect(document.activeElement).toBe(el.querySelector('button[data-r="0"][data-c="-1"]'));
    expect(el.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
  });

  it("divergente, subir es bueno, atributos JSON y vacío", async () => {
    document.body.innerHTML = `<nx-heatmap scale="diverging" polarity="up-good" rows='[{"id":"a","label":"A","total":5,"delta":2}]' columns='[{"id":"x","label":"X"},{"id":"y","label":"Y"}]' values='[[-4,2]]'></nx-heatmap>`;
    await tick();
    const el = document.querySelector("nx-heatmap")!;
    const [a, b] = el.querySelectorAll<HTMLElement>(".nx-heatmap__c");
    expect(a.hasAttribute("data-neg")).toBe(true);
    expect(a.style.getPropertyValue("--nx-heatmap-mix")).toBe("100%");
    expect(b.style.getPropertyValue("--nx-heatmap-mix")).toBe("53%");
    expect(el.querySelector(".nx-heatmap__total small")?.className).toBe("is-good");
    expect(el.querySelector(".nx-heatmap__scale i")?.className).toBe("is-diverging");
    el.rows = [];
    await tick();
    expect(el.querySelector(".nx-heatmap__empty")?.textContent).toBe("Sin datos.");
  });
});

describe("<nx-heatmap>: cambio que redondea a cero", () => {
  it("no lleva flecha ni color", async () => {
    document.body.innerHTML = `<nx-heatmap format="percent" rows='[{"id":"a","label":"A","total":0.02,"delta":0.0002}]' columns='[{"id":"x","label":"X"}]' values='[[0.02]]'></nx-heatmap>`;
    await tick();
    const small = document.querySelector(".nx-heatmap__total small")!;
    expect(small.textContent).toBe("= 0,0 pp");
    expect(small.className).toBe("");
  });
});
