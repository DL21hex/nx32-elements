/**
 * Festivos de Colombia, días hábiles y puentes de vacaciones. Una fecha es un día entero
 * (`core/days`), así que no hay horas ni zonas que muevan un festivo.
 *
 * Lo usan `<nx-recurrence>` (saltar o correr festivos) y `<nx-timeline>` (las marcas del eje), y lo
 * exporta `nx32-elements/core` para la app: `workdaysBetween` cuenta los días hábiles de un rango y
 * `suggestBreaks` busca las fechas de vacaciones que más descanso dan con los días disponibles.
 */
import { dayOf, dayOfISO, isoOf, jsDay, ymd } from "./days";

/** Un festivo: la fecha en ISO y su nombre. */
export interface Holiday {
  date: string;
  name: string;
}

/**
 * De dónde salen los festivos: `"co"` (por defecto) los de Colombia; una lista de fechas ISO o de
 * `Holiday`; una función que da los de cada año; `null` o `[]`, ninguno.
 */
export type HolidaySource = "co" | null | readonly (string | Holiday)[] | ((year: number) => readonly (string | Holiday)[]);

/** El domingo de Pascua de un año (algoritmo anónimo gregoriano, Meeus/Jones/Butcher), como día. */
export function easterDay(y: number): number {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const n = h + l - 7 * Math.floor((a + 11 * h + 22 * l) / 451) + 114;
  return dayOf(y, Math.floor(n / 31), (n % 31) + 1);
}

/** El mismo día si es lunes, o el lunes siguiente (Ley 51 de 1983, «Emiliani»). */
const toMonday = (d: number): number => d + ((8 - jsDay(d)) % 7);

/**
 * Los festivos de Colombia de un año, en orden y con su nombre: los fijos, los que se corren al
 * lunes siguiente y los que dependen de la Pascua (Jueves y Viernes Santo fijos; Ascensión, Corpus
 * Christi y Sagrado Corazón corridos al lunes). Desde 2026, también la Virgen de Chiquinquirá
 * (Ley 2578 de 2026: 9 de julio, corrido al lunes). Dos que caen el mismo día cuentan una vez.
 */
export function colombiaHolidayList(year: number): Holiday[] {
  const e = easterDay(year);
  const f = (m: number, d: number) => dayOf(year, m, d);
  const all: [number, string][] = [
    [f(1, 1), "Año Nuevo"],
    [toMonday(f(1, 6)), "Reyes Magos"],
    [toMonday(f(3, 19)), "San José"],
    [e - 3, "Jueves Santo"],
    [e - 2, "Viernes Santo"],
    [f(5, 1), "Día del Trabajo"],
    [toMonday(e + 39), "Ascensión del Señor"],
    [toMonday(e + 60), "Corpus Christi"],
    [toMonday(e + 68), "Sagrado Corazón"],
    [toMonday(f(6, 29)), "San Pedro y San Pablo"],
    [f(7, 20), "Día de la Independencia"],
    [f(8, 7), "Batalla de Boyacá"],
    [toMonday(f(8, 15)), "Asunción de la Virgen"],
    [toMonday(f(10, 12)), "Día de la Raza"],
    [toMonday(f(11, 1)), "Todos los Santos"],
    [toMonday(f(11, 11)), "Independencia de Cartagena"],
    [f(12, 8), "Inmaculada Concepción"],
    [f(12, 25), "Navidad"],
  ];
  if (year >= 2026) all.push([toMonday(f(7, 9)), "Virgen de Chiquinquirá"]);
  const byDay = new Map<number, string>();
  for (const [d, name] of all) if (!byDay.has(d)) byDay.set(d, name);
  return [...byDay].sort((a, b) => a[0] - b[0]).map(([d, name]) => ({ date: isoOf(d), name }));
}

/** Los festivos de Colombia de un año, solo las fechas ISO y en orden. */
export const colombiaHolidays = (year: number): string[] => colombiaHolidayList(year).map((h) => h.date);

/**
 * Un buscador de festivos: el nombre del festivo de un día (`""` si la fuente no lo nombra) o
 * `null` si no es festivo. Guarda cada año que consulta, así recorrer un rango largo no recalcula.
 */
export function holidayLookup(src: HolidaySource | undefined = "co"): (day: number) => string | null {
  if (src === null || (Array.isArray(src) && !src.length)) return () => null;
  const toMap = (list: readonly (string | Holiday)[] | null | undefined) => {
    const m = new Map<number, string>();
    for (const h of list ?? []) {
      const iso = typeof h === "string" ? h : h && typeof h === "object" ? h.date : null;
      const d = dayOfISO(iso);
      if (d !== null && !m.has(d)) m.set(d, typeof h === "string" ? "" : String(h.name ?? ""));
    }
    return m;
  };
  if (src !== "co" && typeof src !== "function") {
    const all = toMap(src as readonly (string | Holiday)[]);
    return (d) => all.get(d) ?? null;
  }
  const perYear = src === "co" ? colombiaHolidayList : src;
  const cache = new Map<number, Map<number, string>>();
  return (d) => {
    const y = ymd(d)[0];
    let m = cache.get(y);
    if (!m) {
      let list: readonly (string | Holiday)[] | null = null;
      try {
        list = perYear(y);
      } catch {
        list = null;
      }
      cache.set(y, (m = toMap(list)));
    }
    return m.get(d) ?? null;
  };
}

/** El calendario laboral: los festivos y los días de la semana que se trabajan (JS: 0 domingo … 6 sábado). */
export interface WorkCalendar {
  holidays?: HolidaySource;
  /** Por defecto de lunes a viernes. Con sábado: `[1, 2, 3, 4, 5, 6]`. */
  workdays?: readonly number[];
}

const MON_FRI = [1, 2, 3, 4, 5];

/** ¿Se trabaja ese día? Una función que se puede llamar muchas veces sin recalcular festivos. */
export function workdayTest(cal: WorkCalendar = {}): (day: number) => boolean {
  const isHoliday = holidayLookup(cal.holidays);
  const week = new Set((cal.workdays?.length ? cal.workdays : MON_FRI).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6));
  if (!week.size) for (const n of MON_FRI) week.add(n);
  return (d) => week.has(jsDay(d)) && isHoliday(d) === null;
}

/** Cuántos días hábiles hay entre dos fechas ISO, las dos incluidas. `0` si el rango no vale. */
export function workdaysBetween(start: string, end: string, cal?: WorkCalendar): number {
  const a = dayOfISO(start);
  const b = dayOfISO(end);
  if (a === null || b === null || b < a || b - a > 3660) return 0;
  const works = workdayTest(cal);
  let n = 0;
  for (let d = a; d <= b; d++) if (works(d)) n++;
  return n;
}

/** El descanso de verdad de unas vacaciones: los días pedidos más los no hábiles pegados a cada lado. */
export interface RestSpan {
  /** Primer y último día de descanso (ISO). */
  from: string;
  to: string;
  /** Días de descanso seguidos, contando fines de semana y festivos. */
  days: number;
  /** El día en que se vuelve a trabajar. */
  back: string;
}

/** Hasta dónde llega el descanso de unas vacaciones entre `start` y `end` (ISO, incluidos). */
export function restAround(start: string, end: string, cal?: WorkCalendar): RestSpan | null {
  const s = dayOfISO(start);
  const e = dayOfISO(end);
  if (s === null || e === null || e < s) return null;
  const works = workdayTest(cal);
  return spanOf(s, e, works);
}

function spanOf(s: number, e: number, works: (d: number) => boolean): RestSpan {
  let a = s;
  let b = e;
  // Tope: ningún tramo de días no hábiles seguidos pasa de un mes (un calendario sin días hábiles no cuelga).
  for (let i = 0; i < 31 && !works(a - 1); i++) a--;
  for (let i = 0; i < 31 && !works(b + 1); i++) b++;
  return { from: isoOf(a), to: isoOf(b), days: b - a + 1, back: isoOf(b + 1) };
}

/** Una opción de vacaciones: qué fechas pedir y cuánto se descansa. */
export interface BreakSuggestion {
  /** Primer y último día que se piden (ISO). */
  start: string;
  end: string;
  /** Días hábiles que se gastan. */
  workdays: number;
  /** El descanso: del primer al último día libre seguido, y el día en que se vuelve. */
  from: string;
  to: string;
  days: number;
  back: string;
  /** `"longest"`: el descanso más largo que rinde el doble; `"bridge"`: el mejor puente corto de su mes. */
  kind: "longest" | "bridge";
}

export interface BreakOptions {
  /** Desde qué día se pueden pedir (ISO, incluido) y hasta cuál buscar. */
  from: string;
  to: string;
  /** Días hábiles disponibles. Se toma la parte entera. */
  available: number;
  /** Lo mínimo que tiene sentido pedir (3 por defecto). */
  minWorkdays?: number;
  /** Lo máximo de un puente corto (5 por defecto). */
  maxBridge?: number;
  /** Cuántas opciones devolver (4 por defecto). */
  limit?: number;
  calendar?: WorkCalendar;
}

/**
 * Las fechas de vacaciones que más descanso dan. Primero el descanso más largo que rinde al menos
 * el doble de lo que gasta («9 días hábiles → 18 de descanso»); después, por cada mes del rango,
 * el puente corto (hasta `maxBridge` días) con más descanso por día pedido, sin pisar al primero.
 * Se piden en orden de fecha, salvo el más largo, que va primero.
 *
 * Recorre cada día hábil del rango y cada final posible hasta gastar lo disponible: con un rango
 * de un año y 30 días disponibles son unas 7.000 opciones, que se miden con una tabla de días
 * hábiles precalculada (sin volver a buscar festivos).
 */
export function suggestBreaks(opts: BreakOptions): BreakSuggestion[] {
  const from = dayOfISO(opts.from);
  const to = dayOfISO(opts.to);
  const available = Math.min(90, Math.floor(Number(opts.available) || 0));
  const min = Math.max(1, Math.floor(opts.minWorkdays ?? 3));
  const maxBridge = Math.max(min, Math.floor(opts.maxBridge ?? 5));
  const limit = Math.max(1, Math.floor(opts.limit ?? 4));
  if (from === null || to === null || to < from || to - from > 731 || available < min) return [];

  const works = workdayTest(opts.calendar);
  // La tabla de días hábiles, con margen para que el descanso se extienda a los lados.
  const pad = 40;
  const base = from - pad;
  const isWork = new Uint8Array(to - from + 2 * pad + 1);
  for (let i = 0; i < isWork.length; i++) isWork[i] = works(base + i) ? 1 : 0;
  const w = (d: number) => (d < base || d >= base + isWork.length ? works(d) : isWork[d - base] === 1);

  interface Cand {
    s: number;
    e: number;
    k: number;
    a: number;
    b: number;
    rest: number;
  }
  const cands: Cand[] = [];
  for (let s = from; s <= to; s++) {
    if (!w(s)) continue;
    let a = s;
    for (let i = 0; i < 31 && !w(a - 1); i++) a--;
    let k = 0;
    for (let e = s; e <= to; e++) {
      if (!w(e)) continue;
      if (++k > available) break;
      if (k < min) continue;
      let b = e;
      for (let i = 0; i < 31 && !w(b + 1); i++) b++;
      cands.push({ s, e, k, a, b, rest: b - a + 1 });
    }
  }
  if (!cands.length) return [];

  const ratio = (c: Cand) => c.rest / c.k;
  const longest = cands.filter((c) => ratio(c) >= 2).sort((x, y) => y.rest - x.rest || x.k - y.k || x.s - y.s)[0];
  const overlaps = (c: Cand, d: Cand) => c.a <= d.b && d.a <= c.b;
  const out: { c: Cand; kind: BreakSuggestion["kind"] }[] = longest ? [{ c: longest, kind: "longest" }] : [];

  const byMonth = new Map<string, Cand>();
  for (const c of cands) {
    if (c.k > maxBridge || ratio(c) < 1.5 || (longest && overlaps(c, longest))) continue;
    const [y, m] = ymd(c.s);
    const key = `${y}-${m}`;
    const best = byMonth.get(key);
    if (!best || ratio(c) > ratio(best) || (ratio(c) === ratio(best) && (c.rest > best.rest || (c.rest === best.rest && c.s < best.s)))) byMonth.set(key, c);
  }
  const bridges = [...byMonth.values()].sort((x, y) => x.s - y.s);
  // Dos puentes de meses vecinos pueden pisarse (fin de mes y comienzo del siguiente): queda el primero.
  for (const c of bridges) if (!out.some((o) => overlaps(o.c, c))) out.push({ c, kind: "bridge" });

  return out.slice(0, limit).map(({ c, kind }) => ({
    start: isoOf(c.s),
    end: isoOf(c.e),
    workdays: c.k,
    from: isoOf(c.a),
    to: isoOf(c.b),
    days: c.rest,
    back: isoOf(c.b + 1),
    kind,
  }));
}
