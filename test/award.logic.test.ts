import { describe, expect, it } from "vitest";
import {
  amountOf,
  buildOrders,
  capOf,
  changesOf,
  choiceList,
  choicesFromValue,
  cleanChoices,
  cleanCriteria,
  cleanEvent,
  cleanItems,
  cleanQuotes,
  cleanStrings,
  cleanSuppliers,
  contributions,
  fill,
  flagSig,
  gridMove,
  keyOf,
  nextIndex,
  normSplits,
  parseEvent,
  percents,
  qkey,
  sameSplits,
  shares,
  shortOf,
  totalOf,
  valueOf,
  type Choice,
} from "../src/components/award/logic";
import type { AwardSplit } from "../src/components/award/types";

const ITEMS = cleanItems([
  { id: "a", name: "Tubo", qty: 240, unit: "und" },
  { id: "b", name: "Cable", qty: 1500 },
  { id: "c", name: "Breaker", qty: 3 },
  { id: "s", name: "Aseo mensual", qtyText: "servicio mensual" },
]);
const [A, B, C, S] = ITEMS;
const SUPPLIERS = cleanSuppliers([
  { id: "p1", name: "Ferrex" },
  { id: "p2", name: "Induma", blocked: "Inhabilitado" },
  { id: "p3", name: "Sumatec" },
]);
const QUOTES = cleanQuotes([
  { item: "a", supplier: "p1", price: 18500 },
  { item: "a", supplier: "p2", price: 17900 },
  { item: "a", supplier: "p3", price: 17000, offered: 100 },
  { item: "b", supplier: "p2", price: 3200.1 },
  { item: "c", supplier: "p1", price: 0.1 },
  { item: "s", supplier: "p1", price: 900000, offered: 1 },
  { item: "s", supplier: "p3", price: 850000 },
]);
const map = (o: Record<string, AwardSplit[]>) => (id: string) => o[id] ?? [];

describe("validar", () => {
  it("proveedores y artículos: id y nombre, sin repetir; sin cantidad, lo pedido no tiene número", () => {
    expect(SUPPLIERS[1]).toEqual({ id: "p2", name: "Induma", detail: undefined, alert: undefined, blocked: "Inhabilitado" });
    expect(cleanSuppliers([{ id: "x" }, { id: 1, name: "Uno" }, { id: "1", name: "Otro" }]).map((s) => s.name)).toEqual(["Uno"]);
    expect(A).toMatchObject({ id: "a", qty: 240, unit: "und" });
    expect(S).toMatchObject({ qty: undefined, qtyText: "servicio mensual" });
    expect(cleanItems([{ id: "x", name: "X", qty: -3 }, { id: "y", name: "Y", qty: "1.5" }]).map((i) => i.qty)).toEqual([undefined, 1.5]);
    expect(cleanItems([{ id: "z", name: "Z", qty: 0.1 + 0.2 }])[0].qty).toBe(0.3);
  });

  it("cotizaciones: precio finito y no negativo; lo ofrecido en milésimas; una oferta de 0 no es oferta", () => {
    const q = cleanQuotes([
      { item: "a", supplier: "p1", price: 10 },
      { item: "a", supplier: "p1", price: 12, leadTime: -1, offered: 50.0004 },
      { item: "a", supplier: "p2", price: -1 },
      { item: "a", supplier: "p3", price: "abc" },
      { item: "a", supplier: "p4", price: 5, offered: 0 },
    ]);
    expect([...q.values()]).toEqual([{ item: "a", supplier: "p1", price: 12, offered: 50, leadTime: undefined, original: undefined, note: undefined }]);
    expect(QUOTES.get(qkey("a", "p3"))!.offered).toBe(100);
  });

  it("criterios, elecciones (las dos formas) y listas de textos", () => {
    expect(cleanCriteria([{ id: "p", label: "Precio", weight: -2 }, { id: "q", label: "Q", weight: "3" }]).map((c) => c.weight)).toEqual([1, 3]);
    const ch = cleanChoices([
      { item: "a", supplier: "p1", reason: "Habitual" },
      { item: "b", allocations: [{ supplier: "p1", qty: 10 }, { supplier: "p3" }, { qty: 2 }] },
      { item: "c", allocations: [] },
      { item: "d" },
    ]);
    expect([...ch]).toEqual([
      ["a", { allocations: [{ supplier: "p1" }], reason: "Habitual" }],
      ["b", { allocations: [{ supplier: "p1", qty: 10 }, { supplier: "p3" }], reason: undefined }],
      ["c", { allocations: [], reason: undefined }],
    ]);
    expect(choiceList(ch)).toEqual([
      { item: "a", allocations: [{ supplier: "p1" }], reason: "Habitual" },
      { item: "b", allocations: [{ supplier: "p1", qty: 10 }, { supplier: "p3" }] },
      { item: "c", allocations: [] },
    ]);
    expect(cleanStrings(["a", " a ", "", 3, null, "b"])).toEqual(["a", "3", "b"]);
  });

  it("una adjudicación guardada se vuelve elecciones: lo que no aparece no se adjudica", () => {
    expect(choicesFromValue([{ item: "a", supplier: "p1", qty: 140 }, { item: "a", supplier: "p3", qty: 100 }, { item: "x" }], ITEMS)).toEqual([
      { item: "a", allocations: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }] },
      { item: "b", allocations: [] },
      { item: "c", allocations: [] },
      { item: "s", allocations: [] },
    ]);
    expect(choicesFromValue('[{"item":"b","supplier":"p2"}]')).toEqual([{ item: "b", allocations: [{ supplier: "p2" }] }]);
  });
});

describe("eventos", () => {
  it("recommend: entero a uno (`supplier`) o un reparto (`allocations`); con ranking y puntajes", () => {
    expect(cleanEvent({ type: "recommend", item: "a", supplier: "p2", ranking: [{ supplier: "p2", score: 90, scores: { precio: 100, x: "n" } }, { supplier: "p2", score: 1 }, { score: 3 }] })).toEqual({
      type: "recommend",
      item: "a",
      allocations: [{ supplier: "p2" }],
      reason: undefined,
      ranking: [{ supplier: "p2", score: 90, scores: { precio: 100 } }],
    });
    expect(cleanEvent({ type: "recommend", item: "a", allocations: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: "100" }] })).toMatchObject({ allocations: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }] });
    expect(cleanEvent({ type: "recommend", item: "a", supplier: null })).toMatchObject({ allocations: [] });
    expect(cleanEvent({ type: "recommend" })).toBeNull();
  });

  it("flag (ámbar por defecto), scenario, note, error y done", () => {
    expect(cleanEvent({ type: "flag", item: "a", message: "Ojo" })).toEqual({ type: "flag", item: "a", supplier: undefined, message: "Ojo", tone: "warning" });
    expect(cleanEvent({ type: "scenario", id: "s1", label: "Menos órdenes", picks: { a: "p1", b: 3, c: null } })).toEqual({ type: "scenario", id: "s1", label: "Menos órdenes", detail: undefined, picks: { a: "p1", b: "3" } });
    expect(cleanEvent({ type: "note", message: "Hola", tone: "x" })).toEqual({ type: "note", message: "Hola", tone: "neutral" });
    expect(cleanEvent({ type: "error", message: "Mal" })).toEqual({ type: "error", message: "Mal" });
    expect(parseEvent("[DONE]")).toEqual({ type: "done" });
    expect(parseEvent("{no es json")).toBeNull();
    expect(parseEvent(null)).toBeNull();
  });
});

describe("repartos", () => {
  it("lo más que se le da a uno: lo pedido, o lo ofrecido si es menos", () => {
    expect(capOf(A, QUOTES.get(qkey("a", "p1")))).toBe(240);
    expect(capOf(A, QUOTES.get(qkey("a", "p3")))).toBe(100);
    expect(capOf(S, QUOTES.get(qkey("s", "p1")))).toBe(1);
    expect(capOf(S, QUOTES.get(qkey("s", "p3")))).toBeUndefined();
  });

  it("un reparto que se puede comprar: hasta lo ofrecido, sin pasar de lo pedido, sin repetir ni ceros", () => {
    // Entero a quien ofrece menos: solo lo que ofrece (falta el resto).
    expect(normSplits(A, [{ supplier: "p3" }], QUOTES)).toEqual([{ supplier: "p3", qty: 100 }]);
    expect(shortOf(A, [{ supplier: "p3", qty: 100 }], QUOTES)).toBe(140);
    // Pedir de más a uno: hasta lo que ofreció; el total nunca pasa de lo pedido (las primeras partes ganan).
    expect(normSplits(A, [{ supplier: "p3", qty: 150 }, { supplier: "p1", qty: 200 }], QUOTES)).toEqual([
      { supplier: "p3", qty: 100 },
      { supplier: "p1", qty: 140 },
    ]);
    // El mismo proveedor dos veces se suma; un 0 se va; quien no cotizó, también.
    expect(normSplits(A, [{ supplier: "p1", qty: 20 }, { supplier: "p1", qty: 30 }, { supplier: "p3", qty: 0 }, { supplier: "p9", qty: 5 }], QUOTES)).toEqual([{ supplier: "p1", qty: 50 }]);
    // Un filtro (los no elegibles fuera).
    expect(normSplits(A, [{ supplier: "p2" }, { supplier: "p1", qty: 10 }], QUOTES, (s) => s !== "p2")).toEqual([{ supplier: "p1", qty: 10 }]);
    // Milésimas sin errores de coma flotante.
    expect(normSplits(A, [{ supplier: "p1", qty: 0.1 + 0.2 }], QUOTES)).toEqual([{ supplier: "p1", qty: 0.3 }]);
  });

  it("lo pedido sin número no se reparte: queda el primero, por lo que ofreció", () => {
    expect(normSplits(S, [{ supplier: "p1", qty: 5 }, { supplier: "p3" }], QUOTES)).toEqual([{ supplier: "p1", qty: 1 }]);
    expect(normSplits(S, [{ supplier: "p3", qty: 9 }], QUOTES)).toEqual([{ supplier: "p3" }]);
    expect(amountOf(S, [{ supplier: "p3" }], QUOTES)).toBe(850000);
    expect(shortOf(S, [{ supplier: "p3" }], QUOTES)).toBe(0);
  });

  it("dos repartos iguales: los mismos proveedores por las mismas cantidades (sin cantidad, todo lo que puede)", () => {
    expect(sameSplits(A, [{ supplier: "p1" }], [{ supplier: "p1", qty: 240 }], QUOTES)).toBe(true);
    expect(sameSplits(A, [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }], [{ supplier: "p3" }, { supplier: "p1", qty: 140 }], QUOTES)).toBe(true);
    expect(sameSplits(A, [{ supplier: "p1", qty: 200 }], [{ supplier: "p1" }], QUOTES)).toBe(false);
    expect(sameSplits(A, [], [], QUOTES)).toBe(true);
  });
});

describe("cuentas", () => {
  const alloc = map({ a: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }], b: [{ supplier: "p2" }], c: [{ supplier: "p1" }] });

  it("totales sin arrastrar decimales, y cuántas órdenes", () => {
    expect(totalOf(ITEMS, alloc, QUOTES)).toEqual({ total: 18500 * 140 + 17000 * 100 + 4800150 + 0.3, suppliers: 3 });
    expect(amountOf(C, [{ supplier: "p1" }], QUOTES)).toBe(0.3);
  });

  it("lo adjudicado como líneas, con su cantidad", () => {
    expect(valueOf(ITEMS, map({ a: [{ supplier: "p3" }], s: [{ supplier: "p3" }] }), QUOTES)).toEqual([
      { item: "a", supplier: "p3", qty: 100 },
      { item: "s", supplier: "p3" },
    ]);
  });

  it("órdenes por proveedor en el orden de las columnas, con lo que quedó sin adjudicar o corto", () => {
    const { orders, total, unassigned, partial } = buildOrders(ITEMS, SUPPLIERS, map({ a: [{ supplier: "p3" }], c: [{ supplier: "p1" }], b: [{ supplier: "p2" }] }), QUOTES);
    expect(orders.map((o) => [o.supplier, o.lines, o.total])).toEqual([
      ["p1", [{ item: "c", qty: 3, price: 0.1, total: 0.3 }], 0.3],
      ["p2", [{ item: "b", qty: 1500, price: 3200.1, total: 4800150 }], 4800150],
      ["p3", [{ item: "a", qty: 100, price: 17000, total: 1700000 }], 1700000],
    ]);
    expect(total).toBe(6500150.3);
    expect(unassigned).toEqual(["s"]);
    expect(partial).toEqual(["a"]);
  });

  it("cambios: solo donde hay sugerencia y la elección se aparta (otro proveedor, otra cantidad o nada)", () => {
    const choices = new Map<string, Choice>([
      ["a", { allocations: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }], reason: " Calidad " }],
      ["b", { allocations: [] }],
      ["c", { allocations: [{ supplier: "p1" }] }],
      ["s", { allocations: [{ supplier: "p3" }] }],
    ]);
    const rec = map({ a: [{ supplier: "p1" }], b: [{ supplier: "p2" }], c: [{ supplier: "p1", qty: 3 }] });
    expect(changesOf(ITEMS, choices, rec, QUOTES)).toEqual([
      { item: "a", allocations: [{ supplier: "p1", qty: 140 }, { supplier: "p3", qty: 100 }], recommended: [{ supplier: "p1" }], reason: "Calidad", delta: 17000 * 100 - 18500 * 100 },
      { item: "b", allocations: [], recommended: [{ supplier: "p2" }], reason: undefined, delta: -4800150 },
    ]);
  });

  it("la misma adjudicación da la misma clave", () => {
    expect(keyOf("[1,2]")).toBe(keyOf("[1,2]"));
    expect(keyOf("[1,2]")).not.toBe(keyOf("[1,3]"));
  });
});

describe("pesos", () => {
  const C3 = cleanCriteria([
    { id: "precio", label: "Precio", weight: 55 },
    { id: "plazo", label: "Plazo", weight: 30 },
    { id: "calidad", label: "Calidad", weight: 15 },
  ]);
  it("se reparten sobre la suma; en cero, a partes iguales", () => {
    expect(shares(C3, {})).toEqual({ precio: 0.55, plazo: 0.3, calidad: 0.15 });
    expect(shares(C3, { precio: 0, plazo: 0, calidad: 0 })).toEqual({ precio: 1 / 3, plazo: 1 / 3, calidad: 1 / 3 });
    expect(shares(C3, { precio: 50, plazo: 50, calidad: 0 })).toEqual({ precio: 0.5, plazo: 0.5, calidad: 0 });
  });
  it("en porcentaje, cualquier escala se ve igual (600/200 no se topa en 100)", () => {
    expect(percents(C3, { precio: 600, plazo: 200, calidad: 0 })).toEqual({ precio: 75, plazo: 25, calidad: 0 });
    expect(percents(C3, { precio: 0.6, plazo: 0.4, calidad: 0 })).toEqual({ precio: 60, plazo: 40, calidad: 0 });
  });
  it("el aporte de cada criterio al puntaje", () => {
    const parts = contributions({ supplier: "p1", score: 90, scores: { precio: 100, plazo: 50, calidad: 200 } }, C3, shares(C3, {}))!;
    expect(parts.map((p) => Math.round(p * 100) / 100)).toEqual([55, 15, 15]);
    expect(contributions({ supplier: "p1", score: 90 }, C3, shares(C3, {}))).toBeNull();
    expect(contributions({ supplier: "p1", score: 90, scores: { otro: 3 } }, C3, shares(C3, {}))).toBeNull();
  });
});

describe("grilla", () => {
  it("flechas, Inicio/Fin (con Ctrl, de la grilla) y páginas, sin salirse", () => {
    expect(gridMove("ArrowDown", 0, 2, 5, 4)).toEqual([1, 2]);
    expect(gridMove("ArrowUp", 0, 2, 5, 4)).toEqual([0, 2]);
    expect(gridMove("ArrowRight", 3, 3, 5, 4)).toEqual([3, 3]);
    expect(gridMove("ArrowLeft", 3, 1, 5, 4)).toEqual([3, 0]);
    expect(gridMove("Home", 3, 2, 5, 4)).toEqual([3, 0]);
    expect(gridMove("End", 3, 0, 5, 4, true)).toEqual([4, 3]);
    expect(gridMove("Home", 3, 2, 5, 4, true)).toEqual([0, 0]);
    expect(gridMove("PageDown", 1, 1, 30, 4)).toEqual([11, 1]);
    expect(gridMove("PageUp", 4, 1, 30, 4)).toEqual([0, 1]);
    expect(gridMove("a", 0, 0, 5, 4)).toBeNull();
    expect(gridMove("ArrowDown", 0, 0, 0, 4)).toBeNull();
  });
  it("la siguiente posición que cumple, dando la vuelta", () => {
    const ok = (i: number) => i === 1 || i === 4;
    expect(nextIndex(6, -1, 1, ok)).toBe(1);
    expect(nextIndex(6, 1, 1, ok)).toBe(4);
    expect(nextIndex(6, 4, 1, ok)).toBe(1);
    expect(nextIndex(6, 1, -1, ok)).toBe(4);
    expect(nextIndex(6, -1, -1, ok)).toBe(4);
    expect(nextIndex(6, -1, -1, (i) => i === 5)).toBe(5);
    expect(nextIndex(6, 0, 1, () => false)).toBe(-1);
    expect(nextIndex(0, 0, 1, () => true)).toBe(-1);
  });
  it("firma de las alertas y plantillas", () => {
    expect(flagSig("a", [{ item: "a", message: "x", tone: "warning" }])).not.toBe(flagSig("a", [{ item: "a", supplier: "p1", message: "x", tone: "warning" }]));
    expect(fill("{n} de {total}", { n: 2 })).toBe("2 de {total}");
  });
});
