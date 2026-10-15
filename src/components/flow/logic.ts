/**
 * La lógica de `<nx-flow>`, sin DOM: etapas e ítems limpios, en qué etapa va cada uno a una hora,
 * cuánto lleva, cuántos pasaron en la última hora, dónde se atasca, la curva de la cola del día y
 * el tamaño de los puntos.
 *
 * Una regla manda: **un elemento está en la etapa más avanzada cuya hora ya pasó.** No se exige que
 * las horas vengan en orden ni completas (un hito que no se registró no detiene a nadie), y así la
 * suma de las etapas es siempre el total.
 */
import type { FlowItem, FlowLabels, FlowStage, FlowTone } from "./types";

export const MINUTE = 60_000;
export const HOUR = 3_600_000;

/** Las horas plausibles: de 2000 a 2200. Fuera (un 0 que llegó como «sin hora», «0001-01-01», nanosegundos), no es una hora. */
const MIN_MS = Date.UTC(2000, 0, 1);
const MAX_MS = Date.UTC(2200, 0, 1);
const plausible = (ms: number) => (ms >= MIN_MS && ms <= MAX_MS ? ms : NaN);
/** Una fecha y hora ISO SIN desfase («2026-10-14T10:00» o con espacio). */
const NAIVE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;

/**
 * Una hora en milisegundos: ISO, milisegundos o segundos (un número menor que 10¹¹). Una ISO sin
 * desfase se lee en `tz` (la zona del componente), no en la del equipo. `NaN` si no es una hora o
 * no es plausible (antes de 2000 o después de 2200).
 */
export function toMs(v: unknown, tz?: string): number {
  if (typeof v === "number") return Number.isFinite(v) ? plausible(Math.abs(v) < 1e11 ? v * 1000 : v) : NaN;
  if (typeof v !== "string") return NaN;
  const s = v.trim();
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) return toMs(Number(s));
  const naive = tz ? NAIVE.exec(s) : null;
  if (naive) {
    const guess = Date.parse(`${naive[1]}T${naive[2]}Z`);
    if (Number.isNaN(guess)) return NaN;
    // La hora de pared en `tz` de ese instante dice el desfase; una vuelta basta salvo en el cambio de hora.
    return plausible(guess - (wallMs(guess, tz) - guess));
  }
  return plausible(Date.parse(s));
}

const pos = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const idOf = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "");

/** Las etapas válidas (con `id` único y nombre), en el orden en que llegan. */
export function cleanStages(input: unknown): FlowStage[] {
  const out: FlowStage[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(input) ? input : []) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const id = idOf(s.id);
    if (!id || seen.has(id) || typeof s.label !== "string" || !s.label.trim()) continue;
    seen.add(id);
    const stage: FlowStage = { id, label: s.label };
    if (typeof s.note === "string" && s.note.trim()) stage.note = s.note;
    if (pos(s.limit)) stage.limit = s.limit;
    if (pos(s.warn)) stage.warn = s.warn;
    if (s.end === true) stage.end = true;
    out.push(stage);
  }
  return out;
}

/** Un elemento listo para consultar: la hora de cada etapa (en el orden de las etapas) y sus tramos en cola. */
export interface FlowPrepared {
  id: string;
  item: FlowItem;
  /** Hora de entrada a cada etapa, en ms (`NaN` si no pasó por ella). */
  t: number[];
  /** La primera hora conocida. */
  first: number;
  /** Los tramos `[desde, hasta)` en que estuvo en cola (en una etapa que no es final). */
  spans: [number, number][];
  /** El aviso del elemento: su texto, `""` si es `true` sin texto, o `null` si no tiene. */
  flag: string | null;
  /** Cada cambio de etapa: `[hora, de, a]` (`de` = -1 al aparecer). Un hito que se salta no es un paso. */
  steps: [number, number, number][];
}

/**
 * Los elementos válidos: con `id` (el primero gana si se repite) y al menos una hora conocida. Los
 * que no tienen ninguna todavía no empezaron y no se pintan.
 */
export function prepareItems(input: unknown, stages: readonly FlowStage[], tz?: string): FlowPrepared[] {
  const out: FlowPrepared[] = [];
  const seen = new Set<string>();
  const end = stages.map((s) => !!s.end);
  for (const raw of Array.isArray(input) ? input : []) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as FlowItem;
    const id = idOf(it.id);
    if (!id || seen.has(id)) continue;
    const times = it.times && typeof it.times === "object" ? it.times : {};
    const t = stages.map((s) => toMs((times as Record<string, unknown>)[s.id], tz));
    const known = t.map((v, i) => [v, i] as const).filter(([v]) => !Number.isNaN(v)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (!known.length) continue;
    seen.add(id);
    // La etapa en cada momento es el mayor índice ya alcanzado: se recorre en orden de hora.
    const spans: [number, number][] = [];
    const steps: [number, number, number][] = [];
    let top = -1;
    let open: number | null = null;
    for (const [v, i] of known) {
      if (i <= top) continue;
      steps.push([v, top, i]);
      top = i;
      if (!end[i] && open === null) open = v;
      else if (end[i] && open !== null) {
        if (v > open) spans.push([open, v]);
        open = null;
      }
    }
    if (open !== null) spans.push([open, Infinity]);
    const flag = typeof it.flag === "string" && it.flag.trim() ? it.flag : (it.flag as unknown) === true ? "" : null;
    out.push({ id, item: it, t, first: known[0][0], spans, steps, flag });
  }
  return out;
}

/** La etapa del elemento a la hora `at` (la más avanzada que ya pasó), o -1 si todavía no empieza. */
export function stageAt(p: FlowPrepared, at: number): number {
  for (let i = p.t.length - 1; i >= 0; i--) if (p.t[i] <= at) return i;
  return -1;
}

/** Cómo va quien lleva `age` minutos en `stage`. */
export function toneOf(stage: FlowStage, age: number): FlowTone {
  if (stage.end) return "done";
  // Sin límite, `warn` solo avisa (nunca rojo).
  if (!stage.limit) return stage.warn && age >= stage.warn ? "near" : "ok";
  if (age > stage.limit) return "over";
  if (age >= (stage.warn && stage.warn < stage.limit ? stage.warn : stage.limit * 0.75)) return "near";
  return "ok";
}

export interface FlowRow {
  p: FlowPrepared;
  /** Índice de su etapa. */
  s: number;
  /** Cuándo entró a esa etapa (ms). */
  enter: number;
  /** Minutos en la etapa. */
  age: number;
  tone: FlowTone;
}

export interface FlowSnapshot {
  at: number;
  /** Los elementos de cada etapa, el que lleva más primero. */
  groups: FlowRow[][];
  where: Map<string, FlowRow>;
  /** Cuántos salieron de cada etapa en la última hora (el número del riel a su derecha). */
  rate: number[];
  /** Cuántos entraron a cada etapa en la última hora. */
  entered: number[];
  /** Cuántos había en cada etapa una hora antes. */
  before: number[];
  /** En cola (etapas que no son finales). */
  queue: number;
  /** En etapas finales. */
  ended: number;
}

/** La foto del flujo a la hora `at`. */
export function snapshot(items: readonly FlowPrepared[], stages: readonly FlowStage[], at: number): FlowSnapshot {
  const n = stages.length;
  const groups: FlowRow[][] = stages.map(() => []);
  const where = new Map<string, FlowRow>();
  const left = new Array<number>(n).fill(0);
  const entered = new Array<number>(n).fill(0);
  const before = new Array<number>(n).fill(0);
  const ago = at - HOUR;
  for (const p of items) {
    for (const [v, from, to] of p.steps) {
      if (v <= ago || v > at) continue;
      if (from >= 0) left[from]++;
      entered[to]++;
    }
    let s = -1;
    for (let i = n - 1; i >= 0 && s < 0; i--) if (p.t[i] <= at) s = i;
    const b = stageAt(p, ago);
    if (b >= 0) before[b]++;
    if (s < 0) continue;
    const enter = p.t[s];
    const age = Math.max(0, Math.floor((at - enter) / MINUTE));
    const row: FlowRow = { p, s, enter, age, tone: toneOf(stages[s], age) };
    groups[s].push(row);
    where.set(p.id, row);
  }
  let queue = 0;
  let ended = 0;
  groups.forEach((g, i) => {
    g.sort((a, b) => a.enter - b.enter || (a.p.id < b.p.id ? -1 : a.p.id > b.p.id ? 1 : 0));
    if (stages[i].end) ended += g.length;
    else queue += g.length;
  });
  return { at, groups, where, rate: left, entered, before, queue, ended };
}

/** Los números de una etapa: cuántos, cuántos pasaron el límite y la mediana de lo que llevan. */
export function stageStats(rows: readonly FlowRow[]): { count: number; over: number; near: number; median: number | null } {
  let over = 0;
  let near = 0;
  for (const r of rows) {
    if (r.tone === "over") over++;
    else if (r.tone === "near") near++;
  }
  return { count: rows.length, over, near, median: median(rows.map((r) => r.age)) };
}

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Dónde se atasca: la etapa (no final) con más elementos pasados de su límite; a igualdad, la más
 * llena y, después, la primera. -1 si ninguno pasó su límite.
 */
export function bottleneck(snap: FlowSnapshot, stages: readonly FlowStage[]): number {
  let best = -1;
  let bestOver = 0;
  let bestCount = 0;
  snap.groups.forEach((g, i) => {
    if (stages[i].end || !stages[i].limit) return;
    let over = 0;
    for (const r of g) if (r.tone === "over") over++;
    if (over > bestOver || (over === bestOver && over > 0 && g.length > bestCount)) {
      best = i;
      bestOver = over;
      bestCount = g.length;
    }
  });
  return best;
}

/** La etapa (no final) con más elementos, o -1 si la cola está vacía. */
export function busiest(snap: FlowSnapshot, stages: readonly FlowStage[]): number {
  let best = -1;
  let top = 0;
  snap.groups.forEach((g, i) => {
    if (!stages[i].end && g.length > top) {
      best = i;
      top = g.length;
    }
  });
  return best;
}

/**
 * Cuántos había en cola en `samples` momentos parejos de `from` a `to` (ambos incluidos). Barre los
 * tramos de cada elemento una vez: no recalcula el flujo en cada muestra.
 */
export function queueCurve(items: readonly FlowPrepared[], from: number, to: number, samples: number): number[] {
  const n = Math.max(2, Math.floor(samples));
  if (!(to > from) || !Number.isFinite(from) || !Number.isFinite(to)) return [];
  const step = (to - from) / (n - 1);
  const diff = new Array<number>(n + 1).fill(0);
  for (const p of items) {
    for (const [a, b] of p.spans) {
      // Muestras k con a ≤ from + k·step < b.
      const k0 = Math.max(0, Math.ceil((a - from) / step - 1e-9));
      const k1 = b === Infinity ? n - 1 : Math.min(n - 1, Math.ceil((b - from) / step - 1e-9) - 1);
      if (k0 > k1 || k0 > n - 1) continue;
      diff[k0]++;
      diff[k1 + 1]--;
    }
  }
  const out = new Array<number>(n);
  let acc = 0;
  for (let k = 0; k < n; k++) out[k] = acc += diff[k];
  return out;
}

export interface DotScale {
  /** De un punto al siguiente (px). */
  pitch: number;
  /** El diámetro (px). */
  size: number;
  /** Puntos por fila en una etapa de `width`. */
  cols: number;
  /** Filas que caben (las de la etapa más llena, o el tope). */
  rows: number;
}

const SCALES: readonly [number, number][] = [
  [13, 10],
  [11, 8],
  [9, 7],
  [7, 5],
  [6, 4],
];

/** Puntos que caben en una fila de `width` con este paso. */
export const colsFor = (width: number, pitch: number, size: number): number => Math.max(1, Math.floor((Math.max(0, width) - size) / pitch) + 1);

/**
 * El punto más grande con el que la etapa más llena (`max`) cabe en `height`. Si ni el más chico
 * cabe, el más chico con las filas que quepan (lo demás va como «+N»).
 */
export function dotScale(max: number, width: number, height: number): DotScale {
  for (const [pitch, size] of SCALES) {
    const cols = colsFor(width, pitch, size);
    const rows = Math.max(1, Math.ceil(max / cols));
    if ((rows - 1) * pitch + size <= height) return { pitch, size, cols, rows };
  }
  const [pitch, size] = SCALES[SCALES.length - 1];
  return { pitch, size, cols: colsFor(width, pitch, size), rows: Math.max(1, Math.floor((height - size) / pitch) + 1) };
}

/** Rellena `{clave}` en un texto. */
export function fill(t: string, map: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(map, k) ? String(map[k]) : m));
}

/** «singular|plural» según `n`. */
export function plural(spec: string, n: number): string {
  const [one, many = one] = spec.split("|");
  return n === 1 ? one : many;
}

/** Una duración en minutos: «45 min», «2 h», «2 h 25 min», «3 d 4 h». */
export function fmtDuration(minutes: number, L: Pick<FlowLabels, "minutes" | "hours" | "hoursMinutes" | "days">): string {
  const m = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0));
  if (m < 60) return fill(L.minutes, { n: m });
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h >= 48) return fill(L.days, { d: Math.floor(h / 24), h: h % 24 });
  return r ? fill(L.hoursMinutes, { h, m: r }) : fill(L.hours, { h });
}

// ---------------------------------------------------------------- horas en una zona horaria

const formatters = new Map<string, Intl.DateTimeFormat>();

function fmt(locale: string | undefined, tz: string | undefined, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${tz}|${JSON.stringify(o)}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...o, timeZone: tz || undefined });
    } catch {
      // Zona u locale inválidos: los del navegador.
      f = new Intl.DateTimeFormat(undefined, o);
    }
    formatters.set(key, f);
  }
  return f;
}

/** La hora de pared de `ms` en `tz`, como si fuera UTC (para sacar el desfase de la zona). */
export function wallMs(ms: number, tz?: string): number {
  const parts = fmt("en-US", tz, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) + (ms % 1000);
}

/** Los minutos del día (con fracción) de `ms` en la zona `tz`. */
export function minuteOfDay(ms: number, tz?: string): number {
  const parts = fmt("en-US", tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(ms);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute") + get("second") / 60;
}

/** El día de `ms` en la zona `tz` («2026-10-14»). */
export function dayKey(ms: number, tz?: string): string {
  return fmt("en-CA", tz, { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

/** «14:48»; si cae en otro día que `ref`, «13/10 22:40». */
export function clockText(ms: number, locale: string, tz?: string, ref?: number): string {
  const time = fmt(locale, tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(ms);
  if (ref === undefined || dayKey(ms, tz) === dayKey(ref, tz)) return time;
  return `${fmt(locale, tz, { day: "2-digit", month: "2-digit" }).format(ms)} ${time}`;
}

/**
 * Las horas en punto que se marcan en el eje de `from` a `to`: cada 1, 2, 3, 12 o 24 horas según
 * el largo. Ninguna pegada a los bordes (menos del 4 % del ancho).
 */
export function hourTicks(from: number, to: number, tz?: string): number[] {
  const span = to - from;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const hours = span / HOUR;
  const every = hours <= 4 ? 1 : hours <= 13 ? 2 : hours <= 26 ? 3 : hours <= 80 ? 12 : 24;
  // Hora por hora desde la primera en punto, y la hora de pared de cada una se pregunta a la zona:
  // así un día con cambio de hora no corre las marcas.
  const m = minuteOfDay(from, tz);
  const out: number[] = [];
  let t = from + ((60 - (m % 60)) % 60) * MINUTE;
  for (let i = 0; t < to && i < 24 * 8; i++, t += HOUR) {
    const local = minuteOfDay(t, tz);
    if (Math.round(local) % 60 !== 0 || Math.round(local / 60) % every) continue;
    const f = (t - from) / span;
    if (f > 0.04 && f < 0.96) out.push(t);
  }
  return out;
}
