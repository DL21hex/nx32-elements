/**
 * Lógica pura de `<nx-timeline>`: el rango de días, los meses del eje, dónde va cada marca, en qué
 * estado está y en qué renglón de su carril cabe. Sin DOM. Una fecha es un día entero (`core/days`).
 */
import { addMonths, dayOf, dayOfISO, isoOf, monthLen, todayOf, ymd } from "../../core/days";
import type { TimelineItem, TimelineLane, TimelineLaneKind, TimelineState } from "./types";

/** El tramo más largo que pinta la cinta (cinco años): más que eso no se lee y pesaría. */
export const MAX_DAYS = 1830;
/** Renglones de un carril de franjas: si se pisan más, la última va encima de la anterior. */
export const MAX_ROWS = 3;

export interface TimelineRange {
  from: number;
  to: number;
  today: number;
}

/**
 * El tramo a pintar. Sin `start`/`end`: del primer día del mes de hace 8 meses al último del mes de
 * dentro de 4 (un año y un mes con hoy en el último tercio, donde caben lo reciente y lo próximo).
 */
export function timelineRange(start?: string | null, end?: string | null, today?: string | null): TimelineRange {
  const t = todayOf(today);
  const [ty, tm] = ymd(t);
  const first = dayOf(ty, tm, 1);
  let from = dayOfISO(start) ?? addMonths(first, -8);
  let to = dayOfISO(end) ?? (() => {
    const m = addMonths(first, 4);
    const [y, mo] = ymd(m);
    return dayOf(y, mo, monthLen(y, mo));
  })();
  if (to < from) [from, to] = [to, from];
  if (to - from + 1 > MAX_DAYS) to = from + MAX_DAYS - 1;
  return { from, to, today: t };
}

/** Días del tramo. */
export const span = (r: TimelineRange): number => r.to - r.from + 1;
/** Borde izquierdo de un día, en % del ancho. */
export const leftOf = (r: TimelineRange, day: number): number => ((day - r.from) / span(r)) * 100;
/** Centro de un día, en %. */
export const centerOf = (r: TimelineRange, day: number): number => ((day - r.from + 0.5) / span(r)) * 100;

export interface MonthTick {
  /** Primer día visible del mes. */
  day: number;
  year: number;
  /** 1–12. */
  month: number;
  left: number;
  width: number;
  /** El primero del tramo o un enero: lleva el año. */
  withYear: boolean;
}

/** Los meses del tramo, recortados a sus bordes. */
export function monthTicks(r: TimelineRange): MonthTick[] {
  const out: MonthTick[] = [];
  let [y, m] = ymd(r.from);
  for (let guard = 0; guard < 72; guard++) {
    const a = Math.max(dayOf(y, m, 1), r.from);
    const b = Math.min(dayOf(y, m, monthLen(y, m)), r.to);
    if (a > r.to) break;
    out.push({ day: a, year: y, month: m, left: leftOf(r, a), width: leftOf(r, b + 1) - leftOf(r, a), withYear: !out.length || m === 1 });
    if (++m > 12) (m = 1), y++;
  }
  return out;
}

/** El estado de una marca: el suyo, o por la fecha (lo que terminó hasta hoy, `done`). */
export function stateOf(item: TimelineItem, lastDay: number, today: number): TimelineState {
  const s = item.state;
  if (s === "done" || s === "upcoming" || s === "pending" || s === "rejected" || s === "draft") return s;
  return lastDay <= today ? "done" : "upcoming";
}

export interface TimelineMark {
  /** Clave estable: el `id`, o la posición en `items`. */
  key: string;
  item: TimelineItem;
  lane: number;
  kind: TimelineLaneKind;
  state: TimelineState;
  /** Primer y último día dentro del tramo. */
  a: number;
  b: number;
  /** Posición (%): el centro para barras y puntos; el borde izquierdo y el ancho para franjas. */
  x: number;
  w: number;
  /** Barras: alto y parte resaltada, en fracción (0–1). */
  h: number;
  extra: number;
  /** Franjas: renglón y cuántos renglones usa su carril. */
  row: number;
  rows: number;
}

const kindOf = (l: TimelineLane): TimelineLaneKind => (l.kind === "bars" || l.kind === "points" ? l.kind : "ranges");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Las marcas a pintar, ya medidas: las de un carril que no existe, sin fecha válida o fuera del
 * tramo se descartan; una franja que se sale se recorta. Van en el orden del eje (para el teclado).
 */
export function layoutMarks(lanes: readonly TimelineLane[], items: readonly TimelineItem[], r: TimelineRange): TimelineMark[] {
  const laneIndex = new Map<string, number>();
  lanes.forEach((l, i) => {
    if (l && typeof l.id === "string" && !laneIndex.has(l.id)) laneIndex.set(l.id, i);
  });
  const marks: TimelineMark[] = [];
  const seen = new Map<string, number>();
  items.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const li = laneIndex.get(item.lane);
    if (li === undefined) return;
    const kind = kindOf(lanes[li]);
    let a: number | null;
    let b: number | null;
    if (kind === "ranges") {
      a = dayOfISO(item.start ?? item.date);
      b = dayOfISO(item.end) ?? a;
      if (a !== null && b !== null && b < a) [a, b] = [b, a];
    } else {
      a = b = dayOfISO(item.date ?? item.start);
    }
    if (a === null || b === null || b < r.from || a > r.to) return;
    const ca = Math.max(a, r.from);
    const cb = Math.min(b, r.to);
    const base = item.id != null && item.id !== "" ? String(item.id) : `#${i}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    marks.push({
      key: n ? `${base}~${n}` : base,
      item,
      lane: li,
      kind,
      state: stateOf(item, b, r.today),
      a: ca,
      b: cb,
      x: kind === "ranges" ? leftOf(r, ca) : centerOf(r, ca),
      w: kind === "ranges" ? leftOf(r, cb + 1) - leftOf(r, ca) : 0,
      h: 0,
      extra: 0,
      row: 0,
      rows: 1,
    });
  });

  // Barras: alto contra la más alta de su carril; lo resaltado, contra la propia barra.
  const maxByLane = new Map<number, number>();
  for (const m of marks) if (m.kind === "bars") maxByLane.set(m.lane, Math.max(maxByLane.get(m.lane) ?? 0, num(m.item.value)));
  for (const m of marks) {
    if (m.kind !== "bars") continue;
    const v = Math.max(0, num(m.item.value));
    const max = maxByLane.get(m.lane) ?? 0;
    m.h = max > 0 ? v / max : 0;
    m.extra = v > 0 ? Math.min(1, Math.max(0, num(m.item.extra)) / v) : 0;
  }

  // Franjas que se pisan en un carril: renglones (como se apilan los eventos de un calendario).
  const byLane = new Map<number, TimelineMark[]>();
  for (const m of marks) if (m.kind === "ranges") (byLane.get(m.lane) ?? byLane.set(m.lane, []).get(m.lane)!).push(m);
  for (const list of byLane.values()) {
    list.sort((p, q) => p.a - q.a || q.b - p.b);
    const ends: number[] = [];
    for (const m of list) {
      let row = ends.findIndex((e) => e < m.a);
      if (row < 0) row = ends.length < MAX_ROWS ? ends.length : MAX_ROWS - 1;
      ends[row] = Math.max(ends[row] ?? -Infinity, m.b);
      m.row = row;
    }
    for (const m of list) m.rows = Math.max(1, ends.length);
  }

  return marks.sort((p, q) => p.a - q.a || p.lane - q.lane || p.b - q.b);
}

/** Los festivos dentro del tramo, con su nombre (`""` si la fuente no lo da). */
export function holidaysIn(r: TimelineRange, lookup: (day: number) => string | null): { day: number; name: string }[] {
  const out: { day: number; name: string }[] = [];
  for (let d = r.from; d <= r.to; d++) {
    const name = lookup(d);
    if (name !== null) out.push({ day: d, name });
  }
  return out;
}

/** La fecha ISO de un día (para el evento y las pruebas). */
export const iso = isoOf;
