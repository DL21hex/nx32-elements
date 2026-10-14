// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { nxFormat } from "../src/core/locale";
import "../src/components/dialog/index";
import { AWARD_LABELS, type AwardAdviseDetail, type AwardChangeDetail, type AwardSubmitDetail, type NxAward } from "../src/components/award/index";

const SUPPLIERS = [
  { id: "p1", name: "Ferrex", detail: "★ 4,6 · 5 d" },
  { id: "p2", name: "Induma" },
  { id: "p3", name: "Sumatec", alert: "Póliza vencida" },
];
const ITEMS = [
  { id: "a", name: "Tubo PVC", qty: 240, unit: "und", code: "TB-12", group: "Hidráulico" },
  { id: "b", name: "Codo 90°", qty: 100, unit: "und", group: "Hidráulico" },
  { id: "c", name: "Cable 12 AWG", qty: 1500, unit: "m", group: "Eléctricos" },
];
const QUOTES = [
  { item: "a", supplier: "p1", price: 18500, leadTime: 5, original: "US$ 4,46 · TRM 4.150" },
  { item: "a", supplier: "p2", price: 17900, leadTime: 8 },
  { item: "a", supplier: "p3", price: 19000, leadTime: 3, offered: 200 },
  { item: "b", supplier: "p1", price: 2500 },
  { item: "b", supplier: "p3", price: 2400, note: "Marca Gerfor" },
  { item: "c", supplier: "p2", price: 3200 },
];
const CRITERIA = [
  { id: "precio", label: "Precio", weight: 0.55 },
  { id: "plazo", label: "Plazo", weight: 0.3 },
  { id: "calidad", label: "Calidad", weight: 0.15 },
];
const ADVICE = [
  { type: "recommend", item: "a", supplier: "p2", reason: "El más barato", ranking: [{ supplier: "p2", score: 86, scores: { precio: 100, plazo: 40, calidad: 90 } }, { supplier: "p1", score: 80, scores: { precio: 96, plazo: 60, calidad: 70 } }, { supplier: "p3", score: 70 }] },
  { type: "recommend", item: "b", supplier: "p3", ranking: [{ supplier: "p3", score: 90 }, { supplier: "p1", score: 88 }] },
  { type: "recommend", item: "c", supplier: "p2", ranking: [{ supplier: "p2", score: 75 }] },
  { type: "flag", item: "b", message: "Decisión cerrada: el segundo queda a 2 puntos." },
  { type: "flag", item: "c", supplier: "p2", message: "Única cotización." },
  { type: "scenario", id: "uno", label: "Menos órdenes", picks: { b: "p1", c: "p9" } },
  { type: "done" },
];
const TOTAL = 17900 * 240 + 2400 * 100 + 3200 * 1500;

const f = nxFormat("es-CO");
const money = (n: number, short = false) => {
  const big = short && Math.abs(n) >= 1e6;
  return f.money(big ? Number(n.toPrecision(3)) : n, { currency: "COP" }, big);
};
const nb = (s: string | null | undefined) => (s ?? "").replace(/[  ]/g, " ");
const pc = (n: number) => nb(new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 0 }).format(n));
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const ndjson = (evs: unknown[]) => new Response(evs.map((e) => JSON.stringify(e)).join("\n"), { headers: { "Content-Type": "application/x-ndjson" } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function mount(attrs = "", advice: unknown[] | null = ADVICE, wrap = "@"): NxAward {
  document.body.innerHTML = wrap.replace("@", `<nx-award locale="es-CO" currency="COP" ${attrs}></nx-award>`);
  const el = document.querySelector("nx-award")!;
  el.suppliers = SUPPLIERS;
  el.items = ITEMS;
  el.quotes = QUOTES;
  el.criteria = CRITERIA;
  if (advice) el.advice = advice;
  return el;
}
/** A quién se le da el artículo: «p1» o «p1:140,p3:100». */
const who = (el: NxAward, id: string) =>
  el.value
    .filter((v) => v.item === id)
    .map((v) => (el.value.filter((x) => x.item === id).length > 1 ? `${v.supplier}:${v.qty}` : v.supplier))
    .join(",");
const row = (el: NxAward, id: string) => el.querySelector<HTMLTableRowElement>(`tr[data-item="${id}"]`)!;
const head = (el: NxAward, id: string) => row(el, id).querySelector<HTMLElement>("th")!;
const cell = (el: NxAward, id: string, j: number) => row(el, id).querySelectorAll<HTMLElement>("td")[j];
const value = (el: NxAward, id: string, j: number) => nb(cell(el, id, j).querySelector(".nx-award__v")!.textContent);
const detail = (el: NxAward) => el.querySelector<HTMLElement>(".nx-award__detail");
const sum = (el: NxAward, i: number) => el.querySelectorAll<HTMLElement>(".nx-award__sum dd")[i];
const msg = (el: NxAward) => nb(el.querySelector(".nx-award__msg")!.textContent);
const notes = (el: NxAward) => nb(el.querySelector(".nx-award__notes")!.textContent);
const submitBtn = (el: NxAward) => el.querySelector<HTMLButtonElement>(".nx-award__btn--primary")!;
const key = (t: Element, k: string, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  t.dispatchEvent(e);
  return e;
};
const click = (t: Element) => t.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const typeIn = (input: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};
const qtyInput = (el: NxAward, sid: string) => detail(el)!.querySelector<HTMLInputElement>(`[data-f="qty:${sid}"]`)!;

describe("<nx-award>", () => {
  it("pinta la matriz: artículos agrupados, proveedores, precios del locale, «—» donde no cotizó y la oferta parcial", async () => {
    const el = mount();
    await tick();
    const table = el.querySelector("table")!;
    expect(table.getAttribute("role")).toBe("grid");
    expect(table.getAttribute("aria-label")).toBe(AWARD_LABELS.table);
    const heads = [...el.querySelectorAll("thead th")].map((t) => nb(t.textContent));
    expect(heads[0]).toBe("Artículo");
    expect(heads[1]).toContain("Ferrex");
    expect(heads[1]).toContain("★ 4,6 · 5 d");
    expect(heads[3]).toContain("Póliza vencida");
    expect(el.querySelectorAll("tbody").length).toBe(2);
    expect([...el.querySelectorAll(".nx-award__group th")].map((t) => nb(t.textContent).split(" · ")[0])).toEqual(["Hidráulico", "Eléctricos"]);
    expect(value(el, "a", 0)).toBe("18.500");
    expect(cell(el, "b", 1).hasAttribute("data-none")).toBe(true);
    expect(cell(el, "b", 1).getAttribute("aria-disabled")).toBe("true");
    expect(nb(cell(el, "b", 1).textContent)).toContain(AWARD_LABELS.noQuote);
    // Sumatec ofrece 200 de las 240: se ve y se lee.
    expect(nb(cell(el, "a", 2).querySelector(".nx-award__q")!.textContent)).toBe("≤ 200");
    expect(nb(cell(el, "a", 2).textContent)).toContain("Ofrece 200 und");
    expect(el.querySelectorAll('table [tabindex="0"]').length).toBe(1);
  });

  it("la sugerencia es también la elección inicial; resumen con el total exacto, órdenes y alertas", async () => {
    const el = mount();
    await tick();
    const a = cell(el, "a", 1);
    expect(a.hasAttribute("data-rec")).toBe(true);
    expect(a.hasAttribute("data-chosen")).toBe(true);
    expect(a.getAttribute("aria-selected")).toBe("true");
    expect(nb(a.textContent)).toContain(AWARD_LABELS.suggested);
    expect(cell(el, "a", 0).getAttribute("aria-selected")).toBe("false");
    expect(el.value).toEqual([
      { item: "a", supplier: "p2", qty: 240 },
      { item: "b", supplier: "p3", qty: 100 },
      { item: "c", supplier: "p2", qty: 1500 },
    ]);
    // El total que se firma va completo, no compacto.
    expect(nb(sum(el, 0).textContent)).toBe(money(TOTAL));
    expect(nb(sum(el, 1).textContent)).toBe(AWARD_LABELS.same);
    expect(nb(sum(el, 2).textContent)).toBe("2 proveedores");
    expect(nb(sum(el, 3).textContent)).toContain("2de 2 alertas");
    expect(head(el, "b").querySelector(".nx-award__warn:not(.is-seen)")).not.toBeNull();
    expect(cell(el, "c", 1).dataset.tone).toBe("warning");
    expect(cell(el, "c", 1).title).toBe("Única cotización.");
    const foot = [...el.querySelectorAll("tfoot td")].map((t) => nb(t.textContent));
    expect(foot).toEqual(["—", `2 art.${money(17900 * 240 + 3200 * 1500, true)}`, `1 art.${money(240000, true)}`]);
  });

  it("elegir otro proveedor: la sugerencia queda a la vista, la fila dice cuánto cuesta y el detalle pide el motivo", async () => {
    const el = mount();
    const changes: AwardChangeDetail[] = [];
    el.addEventListener("nx-award-change", (e) => changes.push(e.detail));
    await tick();
    click(cell(el, "a", 0));
    await tick();
    expect(cell(el, "a", 0).hasAttribute("data-chosen")).toBe(true);
    expect(cell(el, "a", 1).hasAttribute("data-chosen")).toBe(false);
    expect(cell(el, "a", 1).hasAttribute("data-rec")).toBe(true);
    expect(row(el, "a").hasAttribute("data-changed")).toBe(true);
    // Sin `require-reason`, la fila no se abre (no empuja las de abajo): el costo va en la fila.
    expect(detail(el)).toBeNull();
    expect(nb(head(el, "a").querySelector(".nx-award__chg")!.textContent)).toBe(` · +${money(144000)}`);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "pick", item: "a", items: ["a"], choices: [{ item: "a", allocations: [{ supplier: "p1", qty: 240 }] }], motive: "", scenario: "" });
    expect(changes[0].value[0]).toEqual({ item: "a", supplier: "p1", qty: 240 });
    expect(nb(sum(el, 1).textContent)).toBe(`+${money(144000)}1 cambio`);
    expect(sum(el, 1).querySelector("span")!.dataset.tone).toBe("up");

    click(head(el, "a"));
    await tick();
    const d = detail(el)!;
    expect(nb(d.querySelector(".nx-award__change p")!.textContent)).toBe(`Elegiste Ferrex: +${money(144000)} frente a la sugerencia.`);
    const lis = [...d.querySelectorAll(".nx-award__rank li")];
    expect(lis.map((li) => nb(li.querySelector(".nx-award__pick")!.textContent))).toEqual(["Induma", "Ferrex", "Sumatec"]);
    expect(lis[1].hasAttribute("data-chosen")).toBe(true);
    expect(lis[0].querySelectorAll(".nx-award__bar > span").length).toBe(3);
    expect(lis[0].querySelector<HTMLElement>(".nx-award__bar > span")!.style.inlineSize).toBe("55%");
    expect(nb(lis[1].textContent)).toContain("Cotizó: US$ 4,46 · TRM 4.150");
    expect(nb(lis[2].textContent)).toContain("Ofrece 200 und");
    expect(nb(d.querySelector(".nx-award__ai")!.textContent)).toBe("El más barato");
    expect(nb(d.querySelector(".nx-award__legend")!.textContent)).toBe(`Precio ${pc(0.55)}Plazo ${pc(0.3)}Calidad ${pc(0.15)}`);

    const input = d.querySelector<HTMLInputElement>(".nx-award__reason")!;
    expect(input.getAttribute("list")).toBe(el.querySelector("datalist")!.id);
    expect(el.querySelectorAll("datalist option").length).toBe(5);
    typeIn(input, "Calidad comprobada");
    expect(changes.at(-1)).toMatchObject({ kind: "reason", item: "a" });
    expect(el.choices).toEqual([{ item: "a", allocations: [{ supplier: "p1", qty: 240 }], reason: "Calidad comprobada" }]);
    // Escribir el motivo no rehace el detalle.
    await tick();
    expect(detail(el)).toBe(d);

    const undo = d.querySelector<HTMLButtonElement>("[data-f=undo]")!;
    undo.focus();
    click(undo);
    await tick();
    expect(cell(el, "a", 1).hasAttribute("data-chosen")).toBe(true);
    expect(row(el, "a").hasAttribute("data-changed")).toBe(false);
    expect(el.choices).toEqual([]);
    expect(changes.at(-1)).toMatchObject({ kind: "undo", item: "a" });
    expect(document.activeElement).toBe(head(el, "a"));
  });

  it("elegir desde el detalle; una celda sin cotización o de un proveedor no elegible no se elige", async () => {
    const el = mount();
    await tick();
    click(cell(el, "b", 1));
    await tick();
    expect(who(el, "b")).toBe("p3");
    click(head(el, "b"));
    await tick();
    const pick = detail(el)!.querySelector<HTMLButtonElement>('[data-f="pick:p1"]')!;
    pick.focus();
    click(pick);
    await tick();
    expect(who(el, "b")).toBe("p1");
    expect((document.activeElement as HTMLElement).dataset.f).toBe("pick:p1");
    expect(detail(el)!.querySelector('[data-f="pick:p1"]')!.getAttribute("aria-pressed")).toBe("true");

    // Induma queda inhabilitada: su sugerencia no vale y sus celdas no se eligen.
    el.suppliers = SUPPLIERS.map((s) => (s.id === "p2" ? { ...s, blocked: "Inhabilitado por calidad" } : s));
    await tick();
    expect(cell(el, "a", 1).getAttribute("aria-disabled")).toBe("true");
    expect(cell(el, "a", 1).hasAttribute("data-rec")).toBe(false);
    expect(nb(el.querySelector('[data-supplier="p2"]')!.textContent)).toContain(AWARD_LABELS.blocked);
    expect(who(el, "a")).toBe("");
    click(cell(el, "a", 1));
    await tick();
    expect(who(el, "a")).toBe("");
  });

  it("generar no deja pasar un proveedor no elegible que venía en un borrador", async () => {
    const el = mount();
    el.choices = [{ item: "b", allocations: [{ supplier: "p1" }] }];
    el.suppliers = SUPPLIERS.map((s) => (s.id === "p1" ? { ...s, blocked: "Sin RUT vigente" } : s));
    const sent = vi.fn();
    el.addEventListener("nx-award-submit", sent);
    await tick();
    expect(el.submit()).toBe(false);
    expect(sent).not.toHaveBeenCalled();
    expect(msg(el)).toBe("Ferrex no es elegible (Codo 90°).");
    expect(detail(el)).not.toBeNull();
  });

  it("teclado: flechas con foco móvil, Espacio elige, Supr vuelve a la sugerencia, Intro abre y Esc cierra", async () => {
    const el = mount();
    await tick();
    const start = head(el, "a");
    expect(start.tabIndex).toBe(0);
    start.focus();
    key(start, "ArrowRight");
    expect(document.activeElement).toBe(cell(el, "a", 0));
    expect(cell(el, "a", 0).tabIndex).toBe(0);
    expect(start.tabIndex).toBe(-1);
    key(document.activeElement!, "ArrowDown");
    expect(document.activeElement).toBe(cell(el, "b", 0));
    key(document.activeElement!, "ArrowUp");
    key(document.activeElement!, "ArrowUp");
    expect((document.activeElement as HTMLElement).dataset.supplier).toBe("p1");
    key(document.activeElement!, "End", { ctrlKey: true });
    expect(document.activeElement).toBe(cell(el, "c", 2));
    key(document.activeElement!, "Home");
    expect(document.activeElement).toBe(head(el, "c"));

    cell(el, "a", 0).focus();
    expect(key(cell(el, "a", 0), " ").defaultPrevented).toBe(true);
    await tick();
    expect(who(el, "a")).toBe("p1");
    key(cell(el, "a", 0), "Delete");
    await tick();
    expect(who(el, "a")).toBe("p2");

    head(el, "c").focus();
    key(head(el, "c"), "Enter");
    await tick();
    expect(detail(el)).not.toBeNull();
    expect(head(el, "c").getAttribute("aria-expanded")).toBe("true");
    key(head(el, "c"), "Escape");
    expect(detail(el)).toBeNull();
    expect(document.activeElement).toBe(head(el, "c"));
  });

  it("repartir por cantidad: nunca más de lo ofrecido ni de lo pedido; lo que falta se ve", async () => {
    const el = mount();
    await tick();
    el.open("a");
    await tick();
    // Darle a Sumatec todo lo que ofrece (200): a Induma le queda el resto (40).
    let q3 = qtyInput(el, "p3");
    expect(q3.placeholder).toBe("200");
    typeIn(q3, "500");
    await tick();
    expect(who(el, "a")).toBe("p2:40,p3:200");
    expect(qtyInput(el, "p3").value).toBe("200");
    expect(qtyInput(el, "p2").value).toBe("40");
    expect(nb(cell(el, "a", 2).querySelector(".nx-award__q")!.textContent)).toBe("200 und");
    expect(nb(cell(el, "a", 1).querySelector(".nx-award__q")!.textContent)).toBe("40 und");
    expect(row(el, "a").hasAttribute("data-changed")).toBe(true);
    expect(nb(detail(el)!.querySelector(".nx-award__change p")!.textContent)).toBe(`Tu reparto: +${money(200 * (19000 - 17900))} frente a la sugerencia.`);
    // 100 para Ferrex: lo que se escribe gana y cede el de más a la derecha (Sumatec).
    typeIn(qtyInput(el, "p1"), "100");
    await tick();
    expect(who(el, "a")).toBe("p1:100,p2:40,p3:100");
    expect(qtyInput(el, "p3").value).toBe("100");
    // Quitarle a Induma (0) deja 40 sin adjudicar: la fila y el detalle lo dicen.
    typeIn(qtyInput(el, "p2"), "0");
    await tick();
    expect(who(el, "a")).toBe("p1:100,p3:100");
    expect(nb(head(el, "a").querySelector(".nx-award__short")!.textContent)).toBe(" · faltan 40");
    expect(nb(detail(el)!.querySelector(".nx-award__left")!.textContent)).toBe("Quedan 40 und sin adjudicar.");
    expect(nb(sum(el, 0).querySelector("small")!.textContent)).toBe("1 con menos de lo pedido");
    // Decimales del locale: «12,5».
    q3 = qtyInput(el, "p3");
    typeIn(qtyInput(el, "p1"), "12,5");
    await tick();
    expect(el.value.filter((v) => v.item === "a")).toEqual([
      { item: "a", supplier: "p1", qty: 12.5 },
      { item: "a", supplier: "p3", qty: 100 },
    ]);
    // Algo que no es un número no cambia nada.
    typeIn(qtyInput(el, "p1"), "doce");
    await tick();
    expect(qtyInput(el, "p1").value).toBe("12,5");
  });

  it("no adjudicar un artículo: queda fuera de las órdenes y cuenta como cambio (de menos)", async () => {
    const el = mount();
    const sent: AwardSubmitDetail[] = [];
    el.addEventListener("nx-award-submit", (e) => sent.push(e.detail));
    await tick();
    el.open("c");
    await tick();
    click(detail(el)!.querySelector('[data-f="skip"]')!);
    await tick();
    expect(who(el, "c")).toBe("");
    expect(nb(head(el, "c").textContent)).toContain(AWARD_LABELS.skipped);
    expect(nb(detail(el)!.querySelector(".nx-award__change p")!.textContent)).toBe(`No se adjudica: −${money(4800000)} frente a la sugerencia.`);
    expect(nb(sum(el, 0).querySelector("small")!.textContent)).toBe("1 sin adjudicar");
    expect(el.submit()).toBe(true);
    expect(sent[0].unassigned).toEqual(["c"]);
    expect(sent[0].changes).toEqual([{ item: "c", allocations: [], recommended: [{ supplier: "p2", qty: 1500 }], reason: undefined, delta: -4800000 }]);
    expect(sent[0].followed).toBe(false);
  });

  it("lo pedido sin número (un servicio) no se reparte: va entero, por lo que se ofreció", async () => {
    const el = mount("", null);
    el.items = [{ id: "s", name: "Aseo mensual", qtyText: "servicio mensual" }];
    el.quotes = [
      { item: "s", supplier: "p1", price: 900000, offered: 1 },
      { item: "s", supplier: "p3", price: 850000 },
    ];
    el.advice = [{ type: "recommend", item: "s", supplier: "p3" }, { type: "done" }];
    await tick();
    expect(nb(head(el, "s").textContent)).toContain("servicio mensual");
    el.open("s");
    await tick();
    expect(detail(el)!.querySelector(".nx-award__qty")).toBeNull();
    click(cell(el, "s", 0));
    await tick();
    expect(el.value).toEqual([{ item: "s", supplier: "p1", qty: 1 }]);
    click(cell(el, "s", 2));
    await tick();
    expect(el.value).toEqual([{ item: "s", supplier: "p3" }]);
  });

  it("alertas: J lleva a la siguiente por revisar; la alerta de un proveedor cuenta donde se le adjudica", async () => {
    const el = mount();
    await tick();
    head(el, "a").focus();
    key(head(el, "a"), "j");
    expect(document.activeElement).toBe(head(el, "b"));
    const flags = nb(detail(el)!.querySelector(".nx-award__flags")!.textContent);
    expect(flags).toContain("Decisión cerrada");
    // A «b» se le adjudica Sumatec, que tiene la póliza vencida: se ve en la misma fila.
    expect(flags).toContain("Sumatec: Póliza vencida");
    await tick();
    expect(nb(sum(el, 3).querySelector("span")!.textContent)).toBe("1");
    click(sum(el, 3).querySelector("button")!);
    expect(document.activeElement).toBe(head(el, "c"));
    await tick();
    expect(nb(sum(el, 3).textContent)).toContain(AWARD_LABELS.reviewed);
    // Una alerta distinta en otra recomendación vuelve a estar por revisar.
    el.open(null);
    el.advice = ADVICE.map((e) => (e.type === "flag" && e.item === "c" ? { ...e, message: "Otra cosa." } : e));
    await tick();
    expect(nb(sum(el, 3).querySelector("span")!.textContent)).toBe("1");
  });

  it("require-review: elegir a un proveedor con alerta deja esa fila por revisar", async () => {
    const el = mount("require-review");
    const sent = vi.fn();
    el.addEventListener("nx-award-submit", sent);
    await tick();
    el.open("c");
    await tick();
    expect(nb(sum(el, 3).querySelector("span")!.textContent)).toBe("1");
    // Darle el tubo a Sumatec (póliza vencida, sin ver todavía): esa fila queda por revisar.
    click(cell(el, "a", 2));
    await tick();
    expect(nb(sum(el, 3).querySelector("span")!.textContent)).toBe("2");
    expect(el.submit()).toBe(false);
    expect(document.activeElement).toBe(head(el, "a"));
    // Vista la alerta del proveedor, queda la de «b» (su propia alerta).
    expect(el.submit()).toBe(false);
    expect(document.activeElement).toBe(head(el, "b"));
    expect(el.submit()).toBe(true);
    expect(sent).toHaveBeenCalledTimes(1);
  });

  it("filtros y lentes", async () => {
    const el = mount();
    await tick();
    const [all, alerts, changed] = el.querySelectorAll<HTMLButtonElement>(".nx-award__segbtn");
    expect(nb(alerts.textContent)).toBe("Con alertas2");
    click(alerts);
    await tick();
    expect(alerts.getAttribute("aria-pressed")).toBe("true");
    expect(row(el, "a").hidden).toBe(true);
    expect(row(el, "b").hidden).toBe(false);
    click(changed);
    await tick();
    expect([...el.querySelectorAll<HTMLElement>("tbody tr")].every((tr) => tr.hidden)).toBe(true);
    click(all);
    el.lens = "total";
    await tick();
    expect(value(el, "a", 1)).toBe(money(17900 * 240, true));
    // El total de la línea de quien ofrece menos: solo lo que ofrece.
    expect(value(el, "a", 2)).toBe(money(19000 * 200, true));
    el.lens = "lead";
    await tick();
    expect(value(el, "a", 2)).toBe("3 d");
    expect(value(el, "b", 0)).toBe("—");
    el.lens = "score";
    await tick();
    expect(value(el, "a", 0)).toBe("80");
    expect(el.querySelectorAll<HTMLSelectElement>(".nx-award__select")[1].value).toBe("score");
  });

  it("dentro de <nx-dialog>: ver o filtrar no es un cambio sin guardar; adjudicar sí", async () => {
    const el = mount("", ADVICE, '<nx-dialog open heading="Adjudicar">@</nx-dialog>');
    await tick();
    const dlg = document.querySelector("nx-dialog") as unknown as { dirty: boolean };
    const lens = el.querySelectorAll<HTMLSelectElement>(".nx-award__select")[1];
    lens.value = "total";
    lens.dispatchEvent(new Event("input", { bubbles: true }));
    lens.dispatchEvent(new Event("change", { bubbles: true }));
    click(el.querySelectorAll<HTMLButtonElement>(".nx-award__segbtn")[1]);
    await tick();
    expect(dlg.dirty).toBe(false);
    expect(el.dirty).toBe(false);
    click(cell(el, "a", 0));
    await tick();
    expect(el.dirty).toBe(true);
    expect(dlg.dirty).toBe(true);
  });

  it("escenarios: cambian la sugerencia de los artículos que tocan", async () => {
    const el = mount();
    const changes: AwardChangeDetail[] = [];
    el.addEventListener("nx-award-change", (e) => changes.push(e.detail));
    await tick();
    const sel = el.querySelectorAll<HTMLSelectElement>(".nx-award__select")[0];
    expect(sel.closest("label")!.hidden).toBe(false);
    const opts = [...sel.options].map((o) => nb(o.textContent));
    expect(opts[0]).toBe("Mejor por artículo · 2 proveedores");
    expect(opts[1]).toMatch(/^Menos órdenes · 2 proveedores · \+0,1\s?%$/);
    sel.value = "uno";
    sel.dispatchEvent(new Event("change"));
    await tick();
    expect(el.scenario).toBe("uno");
    expect(cell(el, "b", 0).hasAttribute("data-rec")).toBe(true);
    expect(cell(el, "b", 0).hasAttribute("data-chosen")).toBe(true);
    expect(cell(el, "c", 1).hasAttribute("data-rec")).toBe(true);
    expect(changes.at(-1)).toMatchObject({ kind: "scenario", item: null, items: ["b"], scenario: "uno" });
    el.scenario = "";
    el.choices = [{ item: "b", supplier: "p1", reason: "Habitual" }];
    await tick();
    expect(row(el, "b").hasAttribute("data-changed")).toBe(true);
    el.scenario = "uno";
    await tick();
    expect(row(el, "b").hasAttribute("data-changed")).toBe(false);
  });

  it("sin endpoint y con `adjustable`: nx-award-advise; los pesos y las exclusiones la vuelven a pedir (no si no cambian)", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<nx-award locale="es-CO" adjustable></nx-award>`;
    const el = document.querySelector("nx-award")!;
    const asks: AwardAdviseDetail[] = [];
    el.addEventListener("nx-award-advise", (e) => {
      asks.push(e.detail);
      e.preventDefault();
    });
    el.suppliers = SUPPLIERS;
    el.items = ITEMS;
    el.quotes = QUOTES;
    el.criteria = CRITERIA;
    await vi.advanceTimersByTimeAsync(0);
    expect(asks.length).toBe(1);
    expect(asks[0].weights).toEqual({ precio: 55, plazo: 30, calidad: 15 });
    expect(asks[0].excluded).toEqual([]);
    expect(el.hasAttribute("data-busy")).toBe(true);
    expect(notes(el)).toBe(AWARD_LABELS.advising);
    asks[0].respond(ADVICE);
    await vi.advanceTimersByTimeAsync(0);
    expect(el.hasAttribute("data-busy")).toBe(false);
    expect(cell(el, "a", 1).hasAttribute("data-rec")).toBe(true);

    // Los mismos pesos no vuelven a pedir.
    el.weights = el.weights;
    el.weights = { precio: 0.55, plazo: 0.3, calidad: 0.15 };
    await vi.advanceTimersByTimeAsync(500);
    expect(asks.length).toBe(1);
    // Un juego completo en otra escala no se topa: 600/200 es 75/25.
    el.weights = { precio: 600, plazo: 200, calidad: 0 };
    await vi.advanceTimersByTimeAsync(0);
    expect(asks.length).toBe(2);
    expect(asks[1].weights).toEqual({ precio: 75, plazo: 25, calidad: 0 });
    asks[1].respond(ADVICE);
    await vi.advanceTimersByTimeAsync(0);

    // Mover un peso: espera y pide con los pesos nuevos.
    el.querySelector<HTMLButtonElement>(".nx-award__tools .nx-award__btn")!.click();
    const range = el.querySelector<HTMLInputElement>(".nx-award__range")!;
    range.value = "50";
    range.dispatchEvent(new Event("input"));
    expect(nb(el.querySelector(".nx-award__share")!.textContent)).toBe(pc(50 / 75));
    await vi.advanceTimersByTimeAsync(100);
    expect(asks.length).toBe(2);
    await vi.advanceTimersByTimeAsync(300);
    expect(asks.length).toBe(3);
    expect(asks[2].weights.precio).toBe(50);
    // La recomendación nueva no trae «b»: al terminar, su sugerencia desaparece.
    asks[2].respond([ADVICE[0], ADVICE[2], { type: "done" }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(cell(el, "b", 2).hasAttribute("data-rec")).toBe(false);
    expect(who(el, "b")).toBe("");

    // Excluir a un proveedor desde su columna.
    click(el.querySelector('[data-supplier="p2"]')!);
    await vi.advanceTimersByTimeAsync(0);
    const bar = el.querySelector<HTMLElement>(".nx-award__sup")!;
    expect(bar.hidden).toBe(false);
    expect(nb(bar.textContent)).toContain("2 cotizados · 2 adjudicados");
    click(bar.querySelector('[data-f="sup:ex"]')!);
    await vi.advanceTimersByTimeAsync(0);
    expect(asks.at(-1)!.excluded).toEqual(["p2"]);
    expect(cell(el, "a", 1).hasAttribute("data-excluded")).toBe(true);
    expect(nb(el.querySelector('[data-supplier="p2"]')!.textContent)).toContain(AWARD_LABELS.excluded);
  });

  it("sin endpoint ni `adjustable`, la recomendación es fija: no hay pesos ni «Excluir»", async () => {
    const el = mount();
    await tick();
    expect(el.querySelector<HTMLElement>(".nx-award__tools .nx-award__btn")!.hidden).toBe(true);
    click(el.querySelector('[data-supplier="p2"]')!);
    await tick();
    expect(el.querySelector('[data-f="sup:ex"]')).toBeNull();
    expect(el.querySelector('[data-f="sup:all"]')).not.toBeNull();
  });

  it("con endpoint: POST {weights, excluded} y la respuesta en NDJSON; un error deja la anterior y reintentar", async () => {
    const bodies: { weights: Record<string, number>; excluded: string[] }[] = [];
    let fail = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return fail ? new Response("no", { status: 500 }) : ndjson(ADVICE);
      }),
    );
    const el = mount('endpoint="/compras/rfq/88/recomendar"', null);
    await tick(10);
    expect(bodies).toEqual([{ weights: { precio: 55, plazo: 30, calidad: 15 }, excluded: [] }]);
    expect(cell(el, "b", 2).hasAttribute("data-rec")).toBe(true);
    expect(el.advice.filter((e) => e.type === "recommend").length).toBe(3);

    // Excluir a Induma falla: vuelve todo a como estaba (también la exclusión) y se puede reintentar.
    fail = true;
    el.excluded = ["p2"];
    await tick(10);
    expect(bodies.at(-1)!.excluded).toEqual(["p2"]);
    const note = el.querySelector<HTMLElement>('.nx-award__note[data-tone="danger"]')!;
    expect(nb(note.textContent)).toContain(AWARD_LABELS.error);
    expect(cell(el, "b", 2).hasAttribute("data-rec")).toBe(true);
    expect(el.excluded).toEqual([]);
    expect(cell(el, "a", 1).hasAttribute("data-excluded")).toBe(false);
    let sent: AwardSubmitDetail | undefined;
    el.addEventListener("nx-award-submit", (e) => (sent = e.detail));
    expect(el.submit()).toBe(true);
    expect(sent!.excluded).toEqual([]);
    expect(sent!.weights).toEqual({ precio: 55, plazo: 30, calidad: 15 });
    fail = false;
    click(note.querySelector("button")!);
    await tick(10);
    expect(el.querySelector('.nx-award__note[data-tone="danger"]')).toBeNull();
    expect(bodies.length).toBe(3);
  });

  it("una recomendación que se corta (sin `done`) no deja nada a medias: vuelve la anterior y lo dice", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (n++ ? ndjson([{ type: "recommend", item: "a", supplier: "p1" }]) : ndjson(ADVICE))),
    );
    const el = mount('endpoint="/rec"', null);
    await tick(10);
    el.weights = { precio: 10, plazo: 80, calidad: 10 };
    await tick(10);
    expect(who(el, "a")).toBe("p2");
    expect(el.weights).toEqual({ precio: 55, plazo: 30, calidad: 15 });
    expect(notes(el)).toContain(AWARD_LABELS.partialAdvice);
    expect(el.hasAttribute("data-busy")).toBe(false);
  });

  it("plazo: si la recomendación no llega, sigue la anterior y se puede generar", async () => {
    vi.stubGlobal("fetch", vi.fn((_u: string, init: RequestInit) => new Promise((_r, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))))));
    const el = mount('endpoint="/rec" timeout="30"');
    await tick();
    el.refresh();
    await tick(5);
    expect(el.hasAttribute("data-busy")).toBe(true);
    expect(el.submit()).toBe(false);
    await tick(60);
    expect(el.hasAttribute("data-busy")).toBe(false);
    expect(notes(el)).toContain(AWARD_LABELS.timeout);
    expect(who(el, "a")).toBe("p2");
    expect(el.submit()).toBe(true);
  });

  it("plazo también para la app que responde después (preventDefault) y nunca responde", async () => {
    const el = mount('adjustable timeout="30"');
    el.addEventListener("nx-award-advise", (e) => e.preventDefault());
    await tick();
    el.refresh();
    await tick(5);
    expect(el.hasAttribute("data-busy")).toBe(true);
    await tick(50);
    expect(el.hasAttribute("data-busy")).toBe(false);
    expect(notes(el)).toContain(AWARD_LABELS.timeout);
  });

  it("una recomendación nueva que mueve lo adjudicado lo avisa (evento, lector y destello); lo elegido a mano no se mueve", async () => {
    const el = mount();
    await tick();
    el.choices = [{ item: "c", allocations: [{ supplier: "p2" }] }];
    const changes: AwardChangeDetail[] = [];
    el.addEventListener("nx-award-change", (e) => changes.push(e.detail));
    el.advice = [
      { type: "recommend", item: "a", supplier: "p1" },
      { type: "recommend", item: "b", supplier: "p1" },
      { type: "recommend", item: "c", supplier: "p2" },
      { type: "done" },
    ];
    await tick();
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "advice", item: null, items: ["a", "b"] });
    expect(nb(el.querySelector('.nx-award__vh[role="status"]')!.textContent)).toBe("La nueva sugerencia cambió 2 artículos.");
    expect(row(el, "a").hasAttribute("data-moved")).toBe(true);
    expect(row(el, "c").hasAttribute("data-moved")).toBe(false);
    // Una recomendación nueva no es un cambio del comprador.
    expect(el.dirty).toBe(false);
    click(cell(el, "b", 2));
    await tick();
    expect(row(el, "a").hasAttribute("data-moved")).toBe(false);
  });

  it("un endpoint de otro origen no se usa: se pide a la app", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    document.body.innerHTML = `<nx-award endpoint="https://otro.example/recomendar"></nx-award>`;
    const el = document.querySelector("nx-award")!;
    const asked = vi.fn();
    el.addEventListener("nx-award-advise", asked);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await tick(5);
    expect(spy).not.toHaveBeenCalled();
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it("darle todo a un proveedor y deshacerlo", async () => {
    const el = mount();
    const changes: AwardChangeDetail[] = [];
    el.addEventListener("nx-award-change", (e) => changes.push(e.detail));
    await tick();
    click(el.querySelector('[data-supplier="p1"]')!);
    await tick();
    click(el.querySelector('[data-f="sup:all"]')!);
    await tick();
    expect([who(el, "a"), who(el, "b"), who(el, "c")]).toEqual(["p1", "p1", "p2"]);
    expect(el.choices).toEqual([
      { item: "a", allocations: [{ supplier: "p1", qty: 240 }], reason: "Consolidar en Ferrex" },
      { item: "b", allocations: [{ supplier: "p1", qty: 100 }], reason: "Consolidar en Ferrex" },
    ]);
    expect(changes.at(-1)).toMatchObject({ kind: "bulk", item: null, items: ["a", "b"] });
    const bulk = el.querySelector<HTMLElement>(".nx-award__bulk")!;
    expect(nb(bulk.textContent)).toContain("2 artículos pasaron a Ferrex.");
    click(bulk.querySelector("button")!);
    await tick();
    expect(el.choices).toEqual([]);
    expect(changes.at(-1)).toMatchObject({ kind: "revert", items: ["a", "b"] });
    expect(el.querySelector(".nx-award__bulk")).toBeNull();
    // Uno solo, en singular.
    click(el.querySelector('[data-supplier="p2"]')!);
    await tick();
    el.choices = [{ item: "a", allocations: [{ supplier: "p1" }] }];
    await tick();
    click(el.querySelector('[data-f="sup:all"]')!);
    await tick();
    expect(nb(el.querySelector(".nx-award__bulk")!.textContent)).toContain("1 artículo pasó a Induma.");
  });

  it("generar las órdenes: lo adjudicado con cantidades, las órdenes, los cambios, el motivo y una clave estable", async () => {
    const el = mount();
    const sent: AwardSubmitDetail[] = [];
    el.addEventListener("nx-award-submit", (e) => sent.push(e.detail));
    el.choices = [{ item: "a", allocations: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }], reason: "Calidad" }];
    el.motive = "Se reparte el tubo para no depender de un solo proveedor.";
    await tick();
    expect(el.submit()).toBe(true);
    const d = sent[0];
    expect(d.value).toEqual([
      { item: "a", supplier: "p1", qty: 140 },
      { item: "a", supplier: "p3", qty: 100 },
      { item: "b", supplier: "p3", qty: 100 },
      { item: "c", supplier: "p2", qty: 1500 },
    ]);
    expect(d.orders.map((o) => [o.supplier, o.lines.map((l) => `${l.item}×${l.qty}`), o.total])).toEqual([
      ["p1", ["a×140"], 18500 * 140],
      ["p2", ["c×1500"], 3200 * 1500],
      ["p3", ["a×100", "b×100"], 19000 * 100 + 240000],
    ]);
    expect(d.changes).toEqual([{ item: "a", allocations: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }], recommended: [{ supplier: "p2", qty: 240 }], reason: "Calidad", delta: 18500 * 140 + 19000 * 100 - 17900 * 240 }]);
    expect(d.followed).toBe(false);
    expect(d.total).toBe(18500 * 140 + 19000 * 100 + 240000 + 3200 * 1500);
    expect(d.unassigned).toEqual([]);
    expect(d.partial).toEqual([]);
    expect(d.motive).toBe("Se reparte el tubo para no depender de un solo proveedor.");
    // Las dos alertas de fila y la de Sumatec, que ahora recibe parte del tubo.
    expect(d.pending).toBe(3);
    expect(d.weights).toEqual({ precio: 55, plazo: 30, calidad: 15 });
    // La misma adjudicación, la misma clave (para Idempotency-Key); otra, otra.
    expect(el.submit()).toBe(true);
    expect(sent[1].key).toBe(d.key);
    el.motive = "Otro motivo";
    el.submit();
    expect(sent[2].key).not.toBe(d.key);
  });

  it("guardando (`wait`): un segundo clic no vuelve a enviar; si falla, lo dice y se puede reintentar", async () => {
    const el = mount();
    const sent: AwardSubmitDetail[] = [];
    let done!: (v: unknown) => void;
    let fail!: (e: unknown) => void;
    el.addEventListener("nx-award-submit", (e) => {
      sent.push(e.detail);
      e.detail.wait(new Promise((res, rej) => ((done = res), (fail = rej))));
    });
    await tick();
    click(cell(el, "a", 0));
    await tick();
    click(submitBtn(el));
    click(submitBtn(el));
    await tick();
    expect(sent).toHaveLength(1);
    expect(el.submitting).toBe(true);
    expect(submitBtn(el).disabled).toBe(true);
    expect(submitBtn(el).textContent).toBe(AWARD_LABELS.submitting);
    // Mientras guarda, no se cambia nada.
    click(cell(el, "a", 1));
    await tick();
    expect(who(el, "a")).toBe("p1");
    fail(new Error("La ronda ya no está cerrada."));
    await tick();
    expect(el.submitting).toBe(false);
    expect(msg(el)).toBe("La ronda ya no está cerrada.");
    expect(el.dirty).toBe(true);
    click(submitBtn(el));
    await tick();
    expect(sent).toHaveLength(2);
    done({ ok: true });
    await tick();
    expect(el.submitting).toBe(false);
    expect(el.dirty).toBe(false);
    expect(submitBtn(el).textContent).toBe(AWARD_LABELS.submit);
  });

  it("require-reason, require-review y require-motive llevan a lo que falta antes de generar", async () => {
    const el = mount("require-reason require-review require-motive");
    const sent = vi.fn();
    el.addEventListener("nx-award-submit", sent);
    await tick();
    // Con motivo obligatorio, apartarse abre el detalle.
    click(cell(el, "a", 0));
    await tick();
    expect(detail(el)).not.toBeNull();
    head(el, "c").focus();
    submitBtn(el).click();
    expect(sent).not.toHaveBeenCalled();
    expect(msg(el)).toBe("Falta el motivo del cambio en Tubo PVC.");
    expect((document.activeElement as HTMLElement).dataset.f).toBe("reason");
    const input = document.activeElement as HTMLInputElement;
    input.value = "Plazo de entrega";
    input.dispatchEvent(new Event("input"));
    expect(el.submit()).toBe(false);
    expect(msg(el)).toBe(AWARD_LABELS.needReview);
    expect(document.activeElement).toBe(head(el, "b"));
    el.next();
    expect(el.submit()).toBe(false);
    expect(msg(el)).toBe(AWARD_LABELS.needMotive);
    const motive = el.querySelector<HTMLTextAreaElement>(".nx-award__mtext")!;
    expect(document.activeElement).toBe(motive);
    expect(motive.required).toBe(true);
    typeIn(motive, "La mejor relación precio y plazo.");
    expect(el.motive).toBe("La mejor relación precio y plazo.");
    expect(el.submit()).toBe(true);
    expect(sent).toHaveBeenCalledTimes(1);
    expect(el.querySelector(".nx-award__msg")!.textContent).toBe("");
  });

  it("readonly: una adjudicación cerrada se consulta tal cual; no se cambia ni se pide recomendación", async () => {
    const spy = vi.fn(async () => ndjson(ADVICE));
    vi.stubGlobal("fetch", spy);
    const el = mount('readonly endpoint="/rec"', null);
    el.value = [
      { item: "a", supplier: "p1", qty: 140 },
      { item: "a", supplier: "p3", qty: 100 },
      { item: "c", supplier: "p2", qty: 1500 },
    ];
    el.motive = "Decisión del comité";
    await tick(10);
    expect(spy).not.toHaveBeenCalled();
    expect(el.value).toEqual([
      { item: "a", supplier: "p1", qty: 140 },
      { item: "a", supplier: "p3", qty: 100 },
      { item: "c", supplier: "p2", qty: 1500 },
    ]);
    expect(nb(head(el, "b").textContent)).toContain(AWARD_LABELS.skipped);
    click(cell(el, "b", 0));
    await tick();
    expect(who(el, "b")).toBe("");
    expect(el.querySelector("table")!.getAttribute("aria-readonly")).toBe("true");
    expect(submitBtn(el).hidden).toBe(true);
    const motive = el.querySelector<HTMLTextAreaElement>(".nx-award__mtext")!;
    expect(motive.readOnly).toBe(true);
    expect(motive.value).toBe("Decisión del comité");
    el.open("a");
    await tick();
    expect([...detail(el)!.querySelectorAll<HTMLButtonElement>(".nx-award__pick")].every((b) => b.disabled)).toBe(true);
    expect(detail(el)!.querySelector(".nx-award__qty")).toBeNull();
    expect(detail(el)!.querySelector('[data-f="skip"]')).toBeNull();
    click(el.querySelector('[data-supplier="p1"]')!);
    await tick();
    expect(el.querySelector('[data-f="sup:ex"]')).toBeNull();
    expect(el.querySelector('[data-f="sup:all"]')).toBeNull();
    expect(el.submit()).toBe(false);
  });

  it("`value` asignado antes que `items` se lee cuando llegan", async () => {
    document.body.innerHTML = `<nx-award locale="es-CO"></nx-award>`;
    const el = document.querySelector("nx-award")!;
    el.value = [{ item: "b", supplier: "p1" }];
    el.suppliers = SUPPLIERS;
    el.items = ITEMS;
    el.quotes = QUOTES;
    el.advice = ADVICE;
    await tick();
    expect(el.value).toEqual([{ item: "b", supplier: "p1", qty: 100 }]);
  });

  it("no genera órdenes mientras llega una recomendación", async () => {
    const el = mount("adjustable");
    const sent = vi.fn();
    el.addEventListener("nx-award-submit", sent);
    el.addEventListener("nx-award-advise", (e) => e.preventDefault());
    await tick();
    el.refresh();
    await tick();
    expect(el.hasAttribute("data-busy")).toBe(true);
    expect(el.submit()).toBe(false);
    expect(sent).not.toHaveBeenCalled();
    expect(msg(el)).toBe(AWARD_LABELS.busy);
  });

  it("el escenario que ya no llega vuelve a lo mejor por artículo, y avisa", async () => {
    const el = mount();
    await tick();
    el.scenario = "uno";
    await tick();
    const changes: AwardChangeDetail[] = [];
    el.addEventListener("nx-award-change", (e) => changes.push(e.detail));
    el.advice = ADVICE.filter((e) => e.type !== "scenario");
    await tick();
    expect(el.scenario).toBe("");
    expect(who(el, "b")).toBe("p3");
    expect(changes.at(-1)).toMatchObject({ kind: "advice", items: ["b"] });
  });

  it("pesos antes que criterios; unos pocos en la escala de los deslizadores; mover el elemento no pierde el pedido", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
    const el = document.createElement("nx-award");
    el.adjustable = true;
    const asks: AwardAdviseDetail[] = [];
    el.addEventListener("nx-award-advise", (e) => {
      asks.push(e.detail);
      e.detail.respond(ADVICE);
    });
    el.weights = { precio: 80, plazo: 20, calidad: 0 };
    el.criteria = CRITERIA;
    expect(el.weights).toEqual({ precio: 80, plazo: 20, calidad: 0 });
    el.suppliers = SUPPLIERS;
    el.items = ITEMS;
    el.quotes = QUOTES;
    document.getElementById("a")!.append(el);
    await vi.advanceTimersByTimeAsync(0);
    expect(asks.length).toBe(1);
    el.weights = { precio: 10 };
    expect(el.weights).toEqual({ precio: 10, plazo: 20, calidad: 0 });
    document.getElementById("b")!.append(el);
    await vi.advanceTimersByTimeAsync(400);
    expect(asks.length).toBe(2);
    expect(asks[1].weights.precio).toBe(10);
    el.excluded = ["p2"];
    await vi.advanceTimersByTimeAsync(0);
    expect(asks.at(-1)!.excluded).toEqual(["p2"]);
  });

  it("lo escrito en el motivo o en una cantidad sobrevive a una recomendación que llega", async () => {
    const el = mount();
    await tick();
    click(cell(el, "a", 0));
    el.open("a");
    await tick();
    const input = detail(el)!.querySelector<HTMLInputElement>(".nx-award__reason")!;
    input.focus();
    input.value = "Plazo ";
    input.dispatchEvent(new Event("input"));
    el.advice = ADVICE;
    await tick();
    expect(detail(el)!.querySelector(".nx-award__reason")).toBe(input);
    expect(input.value).toBe("Plazo ");
    expect(document.activeElement).toBe(input);
    expect(el.choices).toEqual([{ item: "a", allocations: [{ supplier: "p1", qty: 240 }], reason: "Plazo" }]);
    const q = qtyInput(el, "p3");
    q.focus();
    q.value = "5";
    el.advice = ADVICE.slice(0, 3).concat({ type: "done" });
    await tick();
    expect(qtyInput(el, "p3")).toBe(q);
    expect(q.value).toBe("5");
  });

  it("un clic dentro del detalle no se pierde aunque el `change` de una cantidad lo repinte", async () => {
    const el = mount();
    await tick();
    el.open("a");
    await tick();
    const d = detail(el)!;
    const q = qtyInput(el, "p1");
    q.value = "40";
    const pick = d.querySelector<HTMLButtonElement>('[data-f="pick:p3"]')!;
    pick.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    q.dispatchEvent(new Event("change", { bubbles: true }));
    await tick();
    // El detalle sigue siendo el mismo hasta que termine el clic.
    expect(detail(el)).toBe(d);
    pick.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    click(pick);
    await tick(5);
    expect(who(el, "a")).toBe("p3");
    expect(detail(el)).not.toBe(d);
  });

  it("K sin nada abierto va a la última alerta; con «Cambiados», Supr no deja el foco perdido", async () => {
    const el = mount();
    await tick();
    el.next(-1);
    expect(document.activeElement).toBe(head(el, "c"));
    el.open(null);
    el.choices = [{ item: "a", supplier: "p1" }];
    el.filter = "changed";
    await tick();
    cell(el, "a", 0).focus();
    key(cell(el, "a", 0), "Delete");
    await tick();
    expect(row(el, "a").hidden).toBe(true);
    expect((document.activeElement as HTMLElement).closest("tr")?.hidden).not.toBe(true);
    expect(el.contains(document.activeElement)).toBe(true);
  });

  it("los montos no se redondean: US$ 123,45 se ve con sus centavos", async () => {
    const el = mount("", null);
    el.removeAttribute("currency");
    el.setAttribute("currency", "USD");
    el.setAttribute("locale", "en-US");
    el.quotes = [
      { item: "a", supplier: "p1", price: 123.45 },
      { item: "a", supplier: "p2", price: 120.99 },
    ];
    el.advice = [{ type: "recommend", item: "a", supplier: "p1" }, { type: "done" }];
    el.open("a");
    await tick();
    const usd = nxFormat("en-US");
    expect([...detail(el)!.querySelectorAll(".nx-award__price")].map((p) => nb(p.firstChild!.textContent))).toEqual([usd.money(120.99, { currency: "USD" }), usd.money(123.45, { currency: "USD" })]);
  });

  it("revisión: una recomendación reemplazada a medias no queda como «la anterior» si la siguiente falla", async () => {
    let n = 0;
    let hang!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        n++;
        if (n === 1) return ndjson(ADVICE);
        if (n === 2) {
          // Manda «a → p1» y se queda abierta.
          const stream = new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: "recommend", item: "a", supplier: "p1" })}\n`));
              init.signal!.addEventListener("abort", () => c.error(new DOMException("x", "AbortError")));
            },
          });
          return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
        }
        return new Response("no", { status: 500 });
      }),
    );
    void hang;
    const el = mount('endpoint="/rec"', null);
    await tick(10);
    el.weights = { precio: 10, plazo: 80, calidad: 10 };
    await tick(10);
    expect(who(el, "a")).toBe("p1");
    el.weights = { precio: 20, plazo: 70, calidad: 10 };
    await tick(10);
    expect(n).toBe(3);
    expect(who(el, "a")).toBe("p2");
    expect(el.weights).toEqual({ precio: 55, plazo: 30, calidad: 15 });
  });

  it("revisión: salir del DOM a mitad de una recomendación la deshace y la vuelve a pedir al volver", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        n++;
        if (n === 1) return ndjson(ADVICE);
        const stream = new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode(`${JSON.stringify({ type: "recommend", item: "a", supplier: "p1" })}\n`));
            init.signal!.addEventListener("abort", () => c.error(new DOMException("x", "AbortError")));
          },
        });
        return new Response(stream);
      }),
    );
    const el = mount('endpoint="/rec"', null);
    await tick(10);
    el.refresh();
    await tick(10);
    expect(who(el, "a")).toBe("p1");
    el.remove();
    await tick();
    expect(who(el, "a")).toBe("p2");
    document.body.append(el);
    await tick(10);
    expect(n).toBe(3);
  });

  it("revisión: si falla una recomendación, no se pierde el peso que el comprador movió mientras corría", async () => {
    vi.useFakeTimers();
    const el = mount("adjustable");
    const asks: AwardAdviseDetail[] = [];
    el.addEventListener("nx-award-advise", (e) => {
      asks.push(e.detail);
      e.preventDefault();
    });
    await vi.advanceTimersByTimeAsync(0);
    el.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(asks.length).toBe(1);
    el.querySelector<HTMLButtonElement>(".nx-award__tools .nx-award__btn")!.click();
    const range = el.querySelector<HTMLInputElement>(".nx-award__range")!;
    range.value = "90";
    range.dispatchEvent(new Event("input"));
    asks[0].respond([{ type: "error", message: "Sin cupo" }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(range.value).toBe("90");
    await vi.advanceTimersByTimeAsync(400);
    expect(asks.at(-1)!.weights.precio).toBe(90);
  });

  it("revisión: mientras se guarda no se vuelve a pedir la recomendación; lo pedido sale al terminar", async () => {
    const el = mount("adjustable");
    const asks: AwardAdviseDetail[] = [];
    el.addEventListener("nx-award-advise", (e) => asks.push(e.detail));
    let done!: () => void;
    el.addEventListener("nx-award-submit", (e) => e.detail.wait(new Promise<void>((r) => (done = r))));
    await tick();
    expect(el.submit()).toBe(true);
    await tick();
    expect(el.querySelector<HTMLInputElement>(".nx-award__range")!.disabled).toBe(true);
    click(el.querySelector('[data-supplier="p2"]')!);
    await tick();
    expect(el.querySelector('[data-f="sup:ex"]')).toBeNull();
    const n = asks.length;
    el.excluded = ["p2"];
    el.refresh();
    await tick(5);
    expect(asks.length).toBe(n);
    expect(who(el, "a")).toBe("p2");
    done();
    await tick(5);
    expect(asks.length).toBe(n + 1);
    expect(asks.at(-1)!.excluded).toEqual(["p2"]);
  });

  it("revisión: lo que el comprador cambia mientras llega una recomendación no se le atribuye a ella", async () => {
    const el = mount("adjustable");
    let pending: AwardAdviseDetail | undefined;
    el.addEventListener("nx-award-advise", (e) => {
      pending = e.detail;
      e.preventDefault();
    });
    await tick();
    el.refresh();
    await tick();
    const kinds: [string, string[]][] = [];
    el.addEventListener("nx-award-change", (e) => kinds.push([e.detail.kind, e.detail.items]));
    click(cell(el, "b", 0));
    await tick();
    pending!.respond(ADVICE);
    await tick();
    expect(kinds).toEqual([["pick", ["b"]]]);
    expect(row(el, "b").hasAttribute("data-moved")).toBe(false);
  });

  it("revisión: `advice` como texto JSON por propiedad; `choices` iguales no borran «Deshacer» ni `dirty`", async () => {
    const el = mount("", null);
    (el as unknown as { advice: string }).advice = JSON.stringify(ADVICE);
    await tick();
    expect(who(el, "a")).toBe("p2");
    click(cell(el, "a", 0));
    await tick();
    expect(el.dirty).toBe(true);
    el.choices = el.choices;
    expect(el.dirty).toBe(true);
  });

  it("revisión: cantidades inválidas no son «todo»; una cotización retirada vuelve a la sugerencia; «No adjudicar» sin sugerencia se mantiene", async () => {
    const el = mount();
    el.choices = [{ item: "a", allocations: [{ supplier: "p1", qty: -5 }] }];
    await tick();
    // La parte inválida no vale: lo elegido queda vacío (no 240 a Ferrex).
    expect(who(el, "a")).toBe("");
    el.choices = [{ item: "b", allocations: [{ supplier: "p1" }] }];
    el.quotes = QUOTES.filter((q) => !(q.item === "b" && q.supplier === "p1"));
    await tick();
    expect(who(el, "b")).toBe("p3");
    el.advice = ADVICE.filter((e) => !(e.type === "recommend" && e.item === "c"));
    await tick();
    expect(who(el, "c")).toBe("");
    el.open("c");
    el.choices = [{ item: "c", allocations: [{ supplier: "p2" }] }];
    await tick();
    click(detail(el)!.querySelector('[data-f="skip"]')!);
    await tick();
    expect(el.choices).toEqual([{ item: "c", allocations: [] }]);
    el.advice = ADVICE;
    await tick();
    expect(who(el, "c")).toBe("");
    expect(row(el, "c").hasAttribute("data-changed")).toBe(true);
  });

  it("revisión: la clave cambia si cambian los precios", async () => {
    const el = mount();
    const keys: string[] = [];
    el.addEventListener("nx-award-submit", (e) => keys.push(e.detail.key));
    await tick();
    el.submit();
    el.quotes = QUOTES.map((q) => (q.item === "a" && q.supplier === "p2" ? { ...q, price: 18000 } : q));
    await tick();
    el.submit();
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("atributos JSON (BDUI) y textos propios", async () => {
    document.body.innerHTML = `<nx-award locale="es-CO" heading="RFQ-88" motive="Comité" labels='{"submit":"Adjudicar","total":7}'
      suppliers='${JSON.stringify(SUPPLIERS)}' items='${JSON.stringify(ITEMS)}' quotes='${JSON.stringify(QUOTES)}'
      advice='${JSON.stringify(ADVICE)}' choices='[{"item":"c","allocations":[{"supplier":"p2"}]}]' excluded='["p3"]'></nx-award>`;
    const el = document.querySelector("nx-award")!;
    await tick();
    expect(submitBtn(el).textContent).toBe("Adjudicar");
    expect(el.labels.total).toBe(AWARD_LABELS.total);
    expect(el.querySelector("h2")!.textContent).toBe("RFQ-88");
    expect(el.querySelector("table")!.getAttribute("aria-labelledby")).toBe(el.querySelector("h2")!.id);
    expect(cell(el, "b", 2).hasAttribute("data-rec")).toBe(true);
    expect(el.excluded).toEqual(["p3"]);
    expect(el.motive).toBe("Comité");
    expect(el.querySelector<HTMLTextAreaElement>(".nx-award__mtext")!.value).toBe("Comité");
    expect(el.querySelector<HTMLElement>(".nx-award__tools .nx-award__btn")!.hidden).toBe(true);
    el.setAttribute("value", '[{"item":"a","supplier":"p1"}]');
    await tick();
    expect(el.value).toEqual([{ item: "a", supplier: "p1", qty: 240 }]);
  });
});
