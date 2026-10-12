// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../src/components/parts/index";
import { shownParts, type NxParts, type PartItem, type PartsSelectDetail } from "../src/components/parts/index";

afterEach(() => {
  document.body.innerHTML = "";
});
const tick = () => new Promise((r) => setTimeout(r, 0));

const PAYERS: PartItem[] = [
  { id: "emp", label: "Empresa", value: 2_000_000, note: "Días 1 y 2" },
  { id: "eps", label: "EPS", value: 5_000_000, note: "Días 3 a 180" },
  { id: "arl", label: "ARL", value: 3_000_000, note: "Riesgos laborales", slot: 6 },
  { id: "afp", label: "Fondo de pensiones", value: 0 },
];

async function mount(attrs: Record<string, string> = {}, items: PartItem[] = PAYERS): Promise<NxParts> {
  const el = document.createElement("nx-parts") as NxParts;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.items = items;
  document.body.append(el);
  await tick();
  return el;
}

describe("<nx-parts>: lógica", () => {
  it("descarta lo inválido, respeta el orden y da color por slot o posición", () => {
    const { parts, total } = shownParts([...PAYERS, { id: "x", label: "Negativo", value: -1 }, { id: "y", label: "NaN", value: NaN }, null, { id: "z", value: 3 }], "Otros");
    expect(parts.map((p) => p.item.id)).toEqual(["emp", "eps", "arl", "afp"]);
    expect(parts.map((p) => p.slot)).toEqual(["1", "2", "6", "4"]);
    expect(total).toBe(10_000_000);
  });

  it("más de ocho: pliega el resto en «Otros» atenuado", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, label: `P${i}`, value: 1 }));
    const { parts, total } = shownParts(many, "Otros");
    expect(parts).toHaveLength(8);
    expect(parts[7]).toMatchObject({ item: { label: "Otros", value: 4 }, slot: "m" });
    expect(parts[7].others?.map((o) => o.id)).toEqual(["p7", "p8", "p9", "p10"]);
    expect(total).toBe(11);
  });
});

describe("<nx-parts>", () => {
  it("barra decorativa y lista con monto, nota y porcentaje", async () => {
    const el = await mount({ locale: "es-CO", format: "money", currency: "COP" });
    const bar = el.querySelector(".nx-parts__bar")!;
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    const segs = [...bar.querySelectorAll<HTMLElement>(".nx-parts__seg")];
    expect(segs).toHaveLength(3); // la de cero no ocupa la barra
    expect(segs.map((s) => s.dataset.nxSlot)).toEqual(["1", "2", "6"]);
    expect(Number(segs[1].style.flexGrow)).toBeCloseTo(0.5);
    const rows = [...el.querySelectorAll(".nx-parts__row")];
    expect(rows).toHaveLength(4);
    expect(rows[0].tagName).toBe("DIV");
    expect(rows[0].querySelector(".nx-parts__name")?.textContent).toBe("Empresa");
    expect(rows[0].querySelector(".nx-parts__amount")?.textContent).toMatch(/2\.000\.000/);
    expect(rows[0].querySelector(".nx-parts__note")?.textContent).toBe("Días 1 y 2");
    expect(rows[0].querySelector(".nx-parts__share")?.textContent?.replace(/\s/g, "")).toBe("20%");
    expect(rows[3].querySelector(".nx-parts__share")?.textContent?.replace(/\s/g, "")).toBe("0%");
    expect(rows[2].querySelector(".nx-chart-sw")?.getAttribute("data-nx-slot")).toBe("6");
    expect(el.querySelector(".nx-parts__list")?.getAttribute("aria-label")).toBe("Partes");
    expect(el.querySelector("[data-nx-filter]")).toBeNull();
    // Los nodos propios van dentro de la raíz; el tooltip, junto a ella.
    expect(el.querySelector(":scope > .nx-parts__root")).not.toBeNull();
    expect(el.querySelector(":scope > .nx-chart-tip")).not.toBeNull();
  });

  it("los textos son texto, nunca HTML", async () => {
    const el = await mount({}, [{ id: "x", label: "<img src=x onerror=alert(1)>", value: 1, note: "<b>n</b>" }]);
    expect(el.querySelector("img, .nx-parts__note b")).toBeNull();
    expect(el.querySelector(".nx-parts__name")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("con dimension: renglones que son botones con su marca, y la barra también", async () => {
    const el = await mount({ dimension: "ent" });
    const rows = [...el.querySelectorAll<HTMLButtonElement>("button.nx-parts__row")];
    expect(rows).toHaveLength(4);
    expect(rows[1].getAttribute("data-nx-filter")).toBe("ent:eps");
    expect(rows[1].getAttribute("data-nx-label")).toBe("EPS");
    expect(rows[1].type).toBe("button");
    expect(el.querySelector(".nx-parts__seg")?.getAttribute("data-nx-filter")).toBe("ent:emp");
    const seen: PartsSelectDetail[] = [];
    el.addEventListener("nx-parts-select", (e) => seen.push(e.detail));
    rows[1].querySelector(".nx-parts__amount")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    (el.querySelectorAll(".nx-parts__seg")[2] as HTMLElement).click();
    expect(seen.map((d) => d.item.id)).toEqual(["eps", "arl"]);
  });

  it("«Otros» no filtra ni avisa", async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, label: `P${i}`, value: 1 }));
    const el = await mount({ dimension: "x" }, many);
    const rows = el.querySelectorAll(".nx-parts__row");
    expect(rows).toHaveLength(8);
    expect(rows[7].tagName).toBe("DIV");
    expect(rows[7].querySelector(".nx-parts__name")?.textContent).toBe("Otros");
    expect(rows[7].querySelector(".nx-parts__note")?.textContent).toBe("P7, P8");
    expect(rows[7].querySelector(".nx-chart-sw")?.getAttribute("data-nx-slot")).toBe("m");
  });

  it("vacía con total 0; JSON en atributos y labels propios", async () => {
    const el = await mount({ labels: '{"empty":"Nada que mostrar."}' }, [{ id: "a", label: "A", value: 0 }]);
    expect(el.querySelector(".nx-parts__empty")?.textContent).toBe("Nada que mostrar.");
    expect(el.querySelector(".nx-parts__bar")).toBeNull();
    el.setAttribute("items", JSON.stringify([{ id: "a", label: "A", value: 1 }]));
    await tick();
    expect(el.querySelectorAll(".nx-parts__row")).toHaveLength(1);
    el.items = [];
    await tick();
    expect(el.querySelector(".nx-parts__empty")?.textContent).toBe("Nada que mostrar.");
  });

  it("tooltip con nombre, monto, porcentaje y nota", async () => {
    const el = await mount({ locale: "es-CO" });
    const seg = el.querySelectorAll(".nx-parts__seg")[1];
    seg.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 10, clientY: 10 }));
    const tip = el.querySelector<HTMLElement>(".nx-chart-tip")!;
    expect(tip.hidden).toBe(false);
    expect(tip.querySelector(".nx-chart-tip__title")?.textContent).toBe("EPS");
    expect(tip.textContent).toMatch(/5\.000\.000/);
    expect(tip.textContent?.replace(/\s/g, "")).toMatch(/50,0%/);
    expect(tip.querySelector(".nx-chart-tip__foot")?.textContent).toBe("Días 3 a 180");
  });
});
