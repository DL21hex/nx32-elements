/** Lógica pura de la adjudicación: validar lo que llega (props, eventos), los repartos (cuánto se
 *  le puede dar a cada uno), las cuentas de libro (totales, órdenes por proveedor, lo que cuesta
 *  apartarse de la sugerencia), el reparto de los pesos y el movimiento por la grilla. Sin DOM.
 *  Aquí no se puntúa: eso es del backend. */
import type { AwardAllocation, AwardChange, AwardChoice, AwardCriterion, AwardEvent, AwardFlag, AwardItem, AwardOrder, AwardQuote, AwardRank, AwardRecommendation, AwardScenario, AwardSplit, AwardSupplier, AwardTone } from "./types";

const TONES = new Set<AwardTone>(["neutral", "warning", "danger"]);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);
const idOf = (v: unknown) => str(v) ?? (typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
export const list = (v: unknown): unknown[] => {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v : [];
};
/** Un número finito (también escrito en formato de máquina: «4150.5»). */
export const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
/** Dos decimales: las cuentas de dinero no arrastran 0,30000000000000004. */
export const cents = (n: number): number => Math.round(n * 100) / 100;
/** Tres decimales: una cantidad (media tonelada, un cuarto de litro) sin errores de coma flotante. */
export const milli = (n: number): number => Math.round(n * 1000) / 1000;
/** Un número no negativo, en milésimas, o `undefined`. */
const qtyIn = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== undefined && n >= 0 ? milli(n) : undefined;
};

/** «{n} cambios» → «3 cambios». Lo que no está en `vars` queda como estaba. */
export const fill = (t: string, vars: Record<string, string | number>): string => t.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

/** La clave de una cotización. */
export const qkey = (item: string, supplier: string): string => `${item}\u0000${supplier}`;

/** Una clave corta y estable de un texto (cyrb53): la misma adjudicación, la misma clave. */
export function keyOf(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ---------------------------------------------------------------- validar

/** Los proveedores válidos (`id` y `name`, sin repetir). */
export function cleanSuppliers(v: unknown): AwardSupplier[] {
  const out: AwardSupplier[] = [];
  for (const x of list(v)) {
    const o = obj(x);
    const id = idOf(o?.id);
    const name = str(o?.name);
    if (o && id && name && !out.some((s) => s.id === id)) out.push({ id, name, detail: str(o.detail), alert: str(o.alert), blocked: str(o.blocked) });
  }
  return out;
}

/** Los artículos válidos (`id` y `name`, sin repetir). Sin cantidad (o con una inválida), lo
 *  pedido no tiene número y el artículo no se reparte. */
export function cleanItems(v: unknown): AwardItem[] {
  const out: AwardItem[] = [];
  for (const x of list(v)) {
    const o = obj(x);
    const id = idOf(o?.id);
    const name = str(o?.name);
    if (!o || !id || !name || out.some((i) => i.id === id)) continue;
    const qty = qtyIn(o.qty);
    out.push({ id, name, qty: qty ? qty : undefined, qtyText: str(o.qtyText), unit: str(o.unit), code: idOf(o.code), group: str(o.group) });
  }
  return out;
}

/** Las cotizaciones, por `qkey(item, supplier)`. Un precio inválido o negativo se descarta (y una
 *  oferta de cantidad 0, que no ofrece nada); si un proveedor cotiza dos veces el mismo artículo,
 *  vale la última. */
export function cleanQuotes(v: unknown): Map<string, AwardQuote> {
  const out = new Map<string, AwardQuote>();
  for (const x of list(v)) {
    const o = obj(x);
    const item = idOf(o?.item);
    const supplier = idOf(o?.supplier);
    const price = num(o?.price);
    if (!o || !item || !supplier || price === undefined || price < 0) continue;
    const offered = qtyIn(o.offered);
    if (offered === 0) continue;
    const lead = num(o.leadTime);
    out.set(qkey(item, supplier), { item, supplier, price, offered, leadTime: lead !== undefined && lead >= 0 ? lead : undefined, original: str(o.original), note: str(o.note) });
  }
  return out;
}

/** Los criterios (`id` y `label`); sin peso (o con uno negativo), 1. */
export function cleanCriteria(v: unknown): AwardCriterion[] {
  const out: AwardCriterion[] = [];
  for (const x of list(v)) {
    const o = obj(x);
    const id = idOf(o?.id);
    const label = str(o?.label);
    const w = num(o?.weight);
    if (o && id && label && !out.some((c) => c.id === id)) out.push({ id, label, weight: w !== undefined && w >= 0 ? w : 1 });
  }
  return out;
}

/** Las partes de un reparto tal como llegan (`[{supplier, qty?}]`), sin validar contra las cotizaciones. */
export function cleanSplits(v: unknown): AwardSplit[] {
  const out: AwardSplit[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const o = obj(x);
    const supplier = idOf(o?.supplier);
    if (!supplier) continue;
    const qty = qtyIn(o!.qty);
    // Una cantidad que vino pero no se entiende (negativa, texto) no es «todo»: la parte no vale.
    if (qty === undefined && o!.qty !== undefined && o!.qty !== null) continue;
    out.push(qty === undefined ? { supplier } : { supplier, qty });
  }
  return out;
}

export type Choice = { allocations: AwardSplit[]; reason?: string };

/** Las elecciones del comprador, por artículo (la última gana): `{item, allocations, reason?}`.
 *  También acepta la forma corta `{item, supplier, reason?}` (todo el artículo a uno). */
export function cleanChoices(v: unknown): Map<string, Choice> {
  const out = new Map<string, Choice>();
  for (const x of list(v)) {
    const o = obj(x);
    const item = idOf(o?.item);
    if (!o || !item) continue;
    const short = idOf(o.supplier);
    const allocations = Array.isArray(o.allocations) ? cleanSplits(o.allocations) : short ? [{ supplier: short }] : null;
    if (allocations) out.set(item, { allocations, reason: str(o.reason) });
  }
  return out;
}

/** Las elecciones que dejan todo exactamente como `value` (una adjudicación guardada, `[{item,
 *  supplier, qty?}]`): para abrirla en `readonly` o retomarla. Los artículos que no aparecen no
 *  se adjudican. */
export function choicesFromValue(value: unknown, items?: readonly { id: string }[]): AwardChoice[] {
  const by = new Map<string, AwardSplit[]>();
  for (const id of items?.map((i) => i.id) ?? []) by.set(id, []);
  for (const x of list(value)) {
    const o = obj(x);
    const item = idOf(o?.item);
    const [split] = cleanSplits([o]);
    if (!item || !split) continue;
    const parts = by.get(item) ?? [];
    parts.push(split);
    by.set(item, parts);
  }
  return [...by].map(([item, allocations]) => ({ item, allocations }));
}

/** Una lista de textos (ids excluidos, motivos), sin vacíos ni repetidos. */
export function cleanStrings(v: unknown): string[] {
  const out: string[] = [];
  for (const x of list(v)) {
    const s = idOf(x)?.trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function cleanRanking(v: unknown): AwardRank[] {
  const out: AwardRank[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const o = obj(x);
    const supplier = idOf(o?.supplier);
    const score = num(o?.score);
    if (!o || !supplier || score === undefined || out.some((r) => r.supplier === supplier)) continue;
    const s = obj(o.scores);
    const scores: Record<string, number> = {};
    if (s) for (const [k, n] of Object.entries(s)) if (num(n) !== undefined) scores[k] = num(n)!;
    out.push({ supplier, score, scores: s ? scores : undefined });
  }
  return out;
}

/** Un evento de la recomendación, validado (lo que no se entiende se ignora). `recommend` acepta
 *  `supplier` (entero a uno) o `allocations` (un reparto). */
export function cleanEvent(v: unknown): AwardEvent | null {
  const o = obj(v);
  if (!o) return null;
  const tone = TONES.has(o.tone as AwardTone) ? (o.tone as AwardTone) : undefined;
  switch (o.type) {
    case "recommend": {
      const item = idOf(o.item);
      if (!item) return null;
      const supplier = idOf(o.supplier);
      const allocations = Array.isArray(o.allocations) ? cleanSplits(o.allocations) : supplier ? [{ supplier }] : [];
      const rec: AwardRecommendation = { item, allocations, reason: str(o.reason), ranking: cleanRanking(o.ranking) };
      return { type: "recommend", ...rec };
    }
    case "flag": {
      const item = idOf(o.item);
      const message = str(o.message);
      if (!item || !message) return null;
      const flag: AwardFlag = { item, supplier: idOf(o.supplier), message, tone: tone ?? "warning" };
      return { type: "flag", ...flag };
    }
    case "scenario": {
      const id = idOf(o.id);
      const label = str(o.label);
      const p = obj(o.picks);
      if (!id || !label || !p) return null;
      const picks: Record<string, string> = {};
      for (const [k, s] of Object.entries(p)) if (idOf(s)) picks[k] = idOf(s)!;
      const sc: AwardScenario = { id, label, detail: str(o.detail), picks };
      return { type: "scenario", ...sc };
    }
    case "note":
    case "error": {
      const message = str(o.message);
      if (!message) return null;
      return o.type === "error" ? { type: "error", message } : { type: "note", message, tone: tone ?? "neutral" };
    }
    case "done":
      return { type: "done" };
  }
  return null;
}

/** Una línea del stream (ya sin `data:`): JSON → evento. `[DONE]` también termina. */
export function parseEvent(raw: string | null): AwardEvent | null {
  if (raw === "[DONE]") return { type: "done" };
  try {
    return raw ? cleanEvent(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- repartos

type Quotes = ReadonlyMap<string, AwardQuote>;
type Alloc = (item: string) => readonly AwardSplit[];

/** ¿El artículo se reparte por cantidad? Solo si lo pedido tiene número. */
export const splittable = (item: AwardItem): boolean => item.qty !== undefined;

/** Lo más que se le puede dar a un proveedor de un artículo: lo pedido, o lo ofrecido si es menos
 *  (`undefined` si ninguno tiene número). */
export function capOf(item: AwardItem, quote: AwardQuote | undefined): number | undefined {
  const a = item.qty;
  const o = quote?.offered;
  return a === undefined ? o : o === undefined ? a : Math.min(a, o);
}

/** La cantidad de una parte: la suya, o todo lo que puede. */
export const qtyOf = (item: AwardItem, split: AwardSplit, quote: AwardQuote | undefined): number | undefined => split.qty ?? capOf(item, quote);

/** Lo que vale una parte: precio × cantidad (sin número de cantidad, el precio de la línea). */
export function partTotal(item: AwardItem, split: AwardSplit, quote: AwardQuote | undefined): number {
  return quote ? cents(quote.price * (qtyOf(item, split, quote) ?? 1)) : 0;
}

/** Lo que vale un reparto. */
export function amountOf(item: AwardItem, splits: readonly AwardSplit[], quotes: Quotes): number {
  let t = 0;
  for (const s of splits) t += partTotal(item, s, quotes.get(qkey(item.id, s.supplier)));
  return cents(t);
}

/** Cuánto se adjudica de un artículo (`undefined` si alguna parte no tiene número). */
export function awardedQty(item: AwardItem, splits: readonly AwardSplit[], quotes: Quotes): number | undefined {
  let n = 0;
  for (const s of splits) {
    const q = qtyOf(item, s, quotes.get(qkey(item.id, s.supplier)));
    if (q === undefined) return undefined;
    n += q;
  }
  return milli(n);
}

/** Lo que falta para llegar a lo pedido (0 si llega o si no se sabe). */
export function shortOf(item: AwardItem, splits: readonly AwardSplit[], quotes: Quotes): number {
  if (item.qty === undefined || !splits.length) return 0;
  const n = awardedQty(item, splits, quotes);
  return n === undefined ? 0 : Math.max(0, milli(item.qty - n));
}

/**
 * Un reparto que se puede comprar: solo a quien cotizó (y pasa `ok`), sin repetir (las partes del
 * mismo proveedor se suman), cada parte hasta lo que ofreció y el total hasta lo pedido (las
 * primeras partes ganan); sin las partes en 0. Lo que no tiene número de cantidad no se reparte:
 * queda la primera parte, por lo que se ofreció.
 */
export function normSplits(item: AwardItem, splits: readonly AwardSplit[], quotes: Quotes, ok: (supplier: string) => boolean = () => true): AwardSplit[] {
  const merged = new Map<string, number | undefined>();
  for (const s of splits) {
    const q = quotes.get(qkey(item.id, s.supplier));
    if (!q || !ok(s.supplier)) continue;
    if (!splittable(item)) {
      if (!merged.size) merged.set(s.supplier, q.offered);
      continue;
    }
    const want = s.qty ?? capOf(item, q)!;
    merged.set(s.supplier, merged.has(s.supplier) ? (merged.get(s.supplier) ?? 0) + want : want);
  }
  if (!splittable(item)) return [...merged].map(([supplier, qty]) => (qty === undefined ? { supplier } : { supplier, qty }));
  const out: AwardSplit[] = [];
  let left = item.qty!;
  for (const [supplier, want] of merged) {
    const cap = capOf(item, quotes.get(qkey(item.id, supplier)))!;
    const qty = milli(Math.max(0, Math.min(want ?? cap, cap, left)));
    if (qty <= 0) continue;
    left = milli(left - qty);
    out.push({ supplier, qty });
  }
  return out;
}

/** ¿Dos repartos compran lo mismo (los mismos proveedores, por las mismas cantidades)? */
export function sameSplits(item: AwardItem, a: readonly AwardSplit[], b: readonly AwardSplit[], quotes: Quotes): boolean {
  if (a.length !== b.length) return false;
  const m = new Map(a.map((s) => [s.supplier, qtyOf(item, s, quotes.get(qkey(item.id, s.supplier)))]));
  return b.every((s) => m.has(s.supplier) && m.get(s.supplier) === qtyOf(item, s, quotes.get(qkey(item.id, s.supplier))));
}

// ---------------------------------------------------------------- cuentas

/** Lo adjudicado como lista de líneas `{item, supplier, qty?}` (en el orden de los artículos). */
export function valueOf(items: readonly AwardItem[], alloc: Alloc, quotes: Quotes): AwardAllocation[] {
  const out: AwardAllocation[] = [];
  for (const it of items)
    for (const s of alloc(it.id)) {
      const qty = qtyOf(it, s, quotes.get(qkey(it.id, s.supplier)));
      out.push(qty === undefined ? { item: it.id, supplier: s.supplier } : { item: it.id, supplier: s.supplier, qty });
    }
  return out;
}

/** El total de una adjudicación y cuántos proveedores (órdenes) usa. */
export function totalOf(items: readonly AwardItem[], alloc: Alloc, quotes: Quotes): { total: number; suppliers: number } {
  let total = 0;
  const used = new Set<string>();
  for (const it of items) {
    const splits = alloc(it.id);
    total += amountOf(it, splits, quotes);
    for (const s of splits) used.add(s.supplier);
  }
  return { total: cents(total), suppliers: used.size };
}

/** Las órdenes de compra, una por proveedor (en el orden de `suppliers`), lo que quedó sin
 *  adjudicar y lo que quedó con menos de lo pedido. */
export function buildOrders(items: readonly AwardItem[], suppliers: readonly AwardSupplier[], alloc: Alloc, quotes: Quotes): { orders: AwardOrder[]; total: number; unassigned: string[]; partial: string[] } {
  const by = new Map<string, AwardOrder>();
  const unassigned: string[] = [];
  const partial: string[] = [];
  let total = 0;
  for (const it of items) {
    const splits = alloc(it.id);
    if (!splits.length) {
      unassigned.push(it.id);
      continue;
    }
    if (shortOf(it, splits, quotes) > 0) partial.push(it.id);
    for (const s of splits) {
      const q = quotes.get(qkey(it.id, s.supplier));
      if (!q) continue;
      let o = by.get(s.supplier);
      if (!o) by.set(s.supplier, (o = { supplier: s.supplier, lines: [], total: 0 }));
      const t = partTotal(it, s, q);
      const qty = qtyOf(it, s, q);
      o.lines.push(qty === undefined ? { item: it.id, price: q.price, total: t } : { item: it.id, qty, price: q.price, total: t });
      o.total = cents(o.total + t);
      total += t;
    }
  }
  const rank = new Map(suppliers.map((s, i) => [s.id, i]));
  const orders = [...by.values()].sort((a, b) => (rank.get(a.supplier) ?? 1e9) - (rank.get(b.supplier) ?? 1e9));
  return { orders, total: cents(total), unassigned, partial };
}

/** Los artículos donde la elección se aparta de la sugerencia, con lo que cuesta de más (o de
 *  menos). Sin sugerencia, la elección es libre y no cuenta. */
export function changesOf(items: readonly AwardItem[], choices: ReadonlyMap<string, Choice>, rec: Alloc, quotes: Quotes, own: Alloc = (id) => choices.get(id)?.allocations ?? []): AwardChange[] {
  const out: AwardChange[] = [];
  for (const it of items) {
    const c = choices.get(it.id);
    if (!c) continue;
    const r = rec(it.id);
    const mine = own(it.id);
    if (!r.length || sameSplits(it, mine, r, quotes)) continue;
    out.push({ item: it.id, allocations: [...mine], recommended: [...r], reason: c.reason?.trim() || undefined, delta: cents(amountOf(it, mine, quotes) - amountOf(it, r, quotes)) });
  }
  return out;
}

/** Las elecciones como lista (`choices` de la prop). */
export const choiceList = (m: ReadonlyMap<string, Choice>): AwardChoice[] =>
  [...m].map(([item, c]) => (c.reason?.trim() ? { item, allocations: c.allocations.map((s) => ({ ...s })), reason: c.reason.trim() } : { item, allocations: c.allocations.map((s) => ({ ...s })) }));

// ---------------------------------------------------------------- pesos

/** Los pesos de los criterios como fracción de su suma (si todos son 0, a partes iguales). */
export function shares(criteria: readonly AwardCriterion[], weights: Readonly<Record<string, number>>): Record<string, number> {
  const w = criteria.map((c) => Math.max(0, weights[c.id] ?? c.weight));
  const sum = w.reduce((a, b) => a + b, 0);
  return Object.fromEntries(criteria.map((c, i) => [c.id, sum > 0 ? w[i] / sum : 1 / criteria.length]));
}

/** Los pesos en porcentaje entero de su suma (lo que muestran los deslizadores): cualquier escala
 *  relativa (0,6/0,4 o 600/200) se ve igual. */
export function percents(criteria: readonly AwardCriterion[], weights: Readonly<Record<string, number>>): Record<string, number> {
  const sh = shares(criteria, weights);
  return Object.fromEntries(criteria.map((c) => [c.id, Math.round(sh[c.id] * 100)]));
}

/** Cuánto aporta cada criterio al puntaje de un proveedor (0–100 en total): su parte del peso por
 *  lo que sacó. Sin puntajes por criterio, `null` (se muestra solo el total). */
export function contributions(rank: AwardRank, criteria: readonly AwardCriterion[], share: Readonly<Record<string, number>>): number[] | null {
  if (!rank.scores || !criteria.some((c) => rank.scores![c.id] !== undefined)) return null;
  return criteria.map((c) => Math.max(0, Math.min(100, rank.scores![c.id] ?? 0)) * (share[c.id] ?? 0));
}

/** «{id}\n{mensajes}»: una alerta abierta sigue abierta si llega igual en otra recomendación. */
export const flagSig = (item: string, flags: readonly AwardFlag[]): string => [item, ...flags.map((f) => `${f.supplier ?? ""}:${f.message}`)].join("\n");

// ---------------------------------------------------------------- grilla

/**
 * A dónde lleva una tecla en la grilla (patrón «data grid» de WAI-ARIA): flechas una celda,
 * Inicio/Fin al comienzo o final de la fila (con Ctrl, de la grilla), RePág/AvPág diez filas.
 * `null` si la tecla no es de movimiento.
 */
export function gridMove(key: string, row: number, col: number, rows: number, cols: number, ctrl = false): [number, number] | null {
  if (rows < 1 || cols < 1) return null;
  const r = (n: number) => Math.max(0, Math.min(rows - 1, n));
  const c = (n: number) => Math.max(0, Math.min(cols - 1, n));
  switch (key) {
    case "ArrowUp":
      return [r(row - 1), col];
    case "ArrowDown":
      return [r(row + 1), col];
    case "ArrowLeft":
      return [row, c(col - 1)];
    case "ArrowRight":
      return [row, c(col + 1)];
    case "Home":
      return ctrl ? [0, 0] : [row, 0];
    case "End":
      return ctrl ? [rows - 1, cols - 1] : [row, cols - 1];
    case "PageUp":
      return [r(row - 10), col];
    case "PageDown":
      return [r(row + 10), col];
  }
  return null;
}

/** La siguiente posición (en `dir`, dando la vuelta) que cumple `ok`, empezando después de `from`. -1 si ninguna. */
export function nextIndex(n: number, from: number, dir: 1 | -1, ok: (i: number) => boolean): number {
  // Sin posición (-1): hacia adelante empieza por la primera; hacia atrás, por la última.
  if (from < 0) from = dir > 0 ? -1 : n;
  for (let k = 1; k <= n; k++) {
    const i = (((from + dir * k) % n) + n) % n;
    if (ok(i)) return i;
  }
  return -1;
}
