// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/bars/index";
import "../src/components/board/index";
import type { BarItem, BarsSelectDetail, NxBars } from "../src/components/bars/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const DX: BarItem[] = [
  { id: "M54.5", code: "M54.5", label: "Lumbago", value: 1062, note: "206 incapacidades" },
  { id: "M51.1", code: "M51.1", label: "Trastorno de disco lumbar", value: 1015 },
  { id: "F32.9", code: "F32.9", label: "Episodio depresivo", value: 966 },
  { id: "J06.9", code: "J06.9", label: "Infección respiratoria", value: 750 },
  { id: "F41.1", code: "F41.1", label: "Ansiedad", value: 727 },
];

async function mount(html: string): Promise<NxBars> {
  document.body.innerHTML = html;
  await tick();
  return document.querySelector("nx-bars")!;
}

describe("<nx-bars>", () => {
  it("horizontal: nombre, código, valor, acumulado y largo de cada barra", async () => {
    const el = await mount('<nx-bars locale="es-CO" cumulative limit="3"></nx-bars>');
    el.items = DX;
    await tick();
    const rows = [...el.querySelectorAll(".nx-bars__row")];
    expect(rows).toHaveLength(3);
    expect(rows[0].tagName).toBe("DIV");
    expect(rows[0].querySelector(".nx-bars__code")?.textContent).toBe("M54.5");
    expect(rows[0].querySelector(".nx-bars__value")?.textContent).toBe("1.062");
    expect(rows[0].querySelector(".nx-bars__cum")?.textContent).toMatch(/^23\s?%$/);
    expect(rows[0].querySelector<HTMLElement>(".nx-bars__fill")!.style.inlineSize).toBe("100%");
    expect(rows[2].querySelector<HTMLElement>(".nx-bars__fill")!.style.inlineSize).toMatch(/^90\.9/);
    expect(el.querySelector(".nx-bars__head")?.textContent).toBe("ValorAcum.");
    expect(el.querySelector(".nx-bars__more")?.textContent).toMatch(/^Y 2 más con el 33\s?% del total\.$/);
  });

  it("con dimensión: botones que filtran el tablero y emiten su evento", async () => {
    document.body.innerHTML = '<nx-board><nx-bars dimension="cie" locale="es-CO"></nx-bars></nx-board>';
    await tick();
    const el = document.querySelector("nx-bars")!;
    el.items = DX;
    await tick();
    const btn = el.querySelector<HTMLButtonElement>("button.nx-bars__row")!;
    expect(btn.getAttribute("data-nx-filter")).toBe("cie:M54.5");
    expect(btn.getAttribute("data-nx-label")).toBe("Lumbago");
    expect(btn.getAttribute("aria-label")).toMatch(/^M54\.5 · Lumbago: 1\.062 \(23\s?%\)$/);
    const seen: BarsSelectDetail[] = [];
    el.addEventListener("nx-bars-select", (e) => seen.push(e.detail));
    btn.click();
    expect(seen[0].item.id).toBe("M54.5");
    const board = document.querySelector("nx-board")!;
    expect(board.filters).toEqual({ cie: ["M54.5"] });
    await tick();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelectorAll('[data-nx-filter-state="off"]')).toHaveLength(4);
  });

  it("apiladas por serie con rampa ordinal y leyenda", async () => {
    const el = await mount('<nx-bars ramp="ordinal" locale="es-CO" format="money" currency="COP"></nx-bars>');
    el.series = [{ id: "0-30", label: "0 a 30 días" }, { id: "31-60", label: "31 a 60" }, { id: "61-90", label: "61 a 90" }, { id: "90+", label: "Más de 90" }];
    el.items = [{ id: "Sura", label: "Sura", value: 100, parts: [40, 30, 0, 30] }, { id: "ARL", label: "ARL Sura", value: 50, parts: [50, 0, 0, 0] }];
    await tick();
    expect([...el.querySelectorAll(".nx-bars__legend li")].map((li) => li.textContent)).toEqual(["0 a 30 días", "31 a 60", "61 a 90", "Más de 90"]);
    const segs = el.querySelectorAll<HTMLElement>("li:first-child > .nx-bars__row .nx-bars__fill.is-stack > i");
    expect([...segs].map((s) => [s.dataset.nxSlot, s.style.flexGrow])).toEqual([["o1", "40"], ["o2", "30"], ["o4", "30"]]);
    expect(el.querySelectorAll<HTMLElement>(".nx-bars__fill")[1].style.inlineSize).toBe("50%");
  });

  it("columnas con línea de referencia y valores cortos", async () => {
    const el = await mount('<nx-bars orientation="vertical" reference="100" reference-label="parejo" height="200" selectable></nx-bars>');
    el.items = [{ id: "1", label: "lun", value: 143 }, { id: "2", label: "mar", value: 1200 }];
    await tick();
    const cols = el.querySelectorAll<HTMLElement>("button.nx-bars__col");
    expect(cols).toHaveLength(2);
    expect(cols[0].querySelector(".nx-bars__collabel")?.textContent).toBe("lun");
    expect(cols[1].querySelector(".nx-bars__colval")?.textContent).toMatch(/^1,2/);
    expect(cols[0].querySelector<HTMLElement>(".nx-bars__fill")!.style.blockSize).toMatch(/^11\.9/);
    const line = el.querySelector<HTMLElement>(".nx-bars__hline")!;
    expect(line.textContent).toBe("parejo");
    expect(line.style.insetBlockEnd).toMatch(/^35\.33/);
  });

  it("tooltip al pasar y vacío sin datos", async () => {
    const el = await mount('<nx-bars locale="es-CO"></nx-bars>');
    expect(el.querySelector(".nx-bars__empty")?.textContent).toBe("Sin datos.");
    el.setAttribute("items", JSON.stringify(DX.slice(0, 2)));
    await tick();
    const row = el.querySelector(".nx-bars__row")!;
    row.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 10, clientY: 10 }));
    const tip = el.querySelector<HTMLElement>(".nx-chart-tip")!;
    expect(tip.hidden).toBe(false);
    expect(tip.querySelector(".nx-chart-tip__title")?.textContent).toBe("M54.5 · Lumbago");
    expect(tip.querySelector(".nx-chart-tip__foot")?.textContent).toBe("206 incapacidades");
    el.dispatchEvent(new PointerEvent("pointerleave"));
    expect(tip.hidden).toBe(true);
    el.labels = { empty: "Nada" };
    el.items = [];
    await tick();
    expect(el.querySelector(".nx-bars__empty")?.textContent).toBe("Nada");
  });
});
