/** `<nx-grid>`: la hora del día (`type: "time"`) y los pasos de un proceso (`sequence`). Lógica
 *  pura, sin DOM. */
import type { GridColumn, GridRow } from "./types";

/** «HH:MM» de 00:00 a 23:59: como se guarda, se compara (como texto ordena bien) y se ve. */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isTime = (v: unknown): v is string => typeof v === "string" && HHMM.test(v);

const pad = (n: number) => String(n).padStart(2, "0");

/** La hora de `d` como «HH:MM» (la del reloj del equipo). */
export function clockTime(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Palabras que piden la hora de ahora. */
const NOW = new Set(["ahora", "now", "ya"]);

/** Lo que alguien va escribiendo antes de «ahora», «hace 10», «+20» o «-10»: todavía no es un error. */
const PARTIAL = /^(a|ah|aho|ahor|n|no|y|h|ha|hac|hace|\+|-)$/;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Un paso vecino de un proceso, para leer la hora en contexto: su hora («HH:MM») y su nombre. */
export interface TimeStep {
  value: string;
  label: string;
}
/** Con qué se lee una hora: el paso con hora anterior y el siguiente del mismo proceso, y el reloj. */
export interface TimeContext {
  prev?: TimeStep | null;
  next?: TimeStep | null;
  now?: () => Date;
}
/**
 * Lo que se entendió de lo que alguien escribe en una celda de hora:
 * - `empty`: vacío (la celda queda sin hora).
 * - `partial`: va escribiendo una palabra o un signo («aho», «+»): todavía no es un error.
 * - `bad`: no se entiende (`unknown`), o «+20» sin un paso anterior con hora (`noPrev`).
 * - `ok`: la hora («HH:MM») y cómo se llegó a ella (`how`): tal cual (`typed`), de la tarde por el
 *   orden del proceso (`afternoon`), la de ahora (`now`), `minutes` después del paso anterior
 *   (`after`) o hace `minutes` (`ago`). `warn`: queda antes del paso anterior (`beforePrev`),
 *   después del siguiente (`afterNext`) o más tarde que ahora (`future`).
 */
export type TimeReading =
  | { kind: "empty" }
  | { kind: "partial" }
  | { kind: "bad"; why: "unknown" | "noPrev" }
  | {
      kind: "ok";
      value: string;
      how: "typed" | "afternoon" | "now" | "after" | "ago";
      minutes?: number;
      warn?: "beforePrev" | "afterNext" | "future";
    };

/** Una duración como se escribe: «20» (minutos), «90», «1:30», «1h30», «1h», «20 min». */
function parseDuration(s: string): number | null {
  const t = s.trim().replace(/\s*(minutos?|min|m)$/, "");
  let m = /^(\d{1,3})$/.exec(t);
  if (m) return Number(m[1]);
  m = /^(\d{1,2})\s*[:h]\s*(\d{1,2})?$/.exec(t);
  if (!m) return null;
  const mins = m[2] ? Number(m[2]) : 0;
  return mins > 59 ? null : Number(m[1]) * 60 + mins;
}

/** La hora escrita, sin contexto: minutos desde la medianoche y si no hay duda de a. m./p. m. */
function readClock(text: string): { min: number; fixed: boolean } | null {
  let t = text;
  // «a. m.», «a.m.», «am», «a», y lo mismo con p (sin confundir el punto que separa la hora).
  let half: "a" | "p" | null = null;
  const m = /\s*([ap])\.?\s*(m\.?)?$/.exec(t);
  if (m && /\d/.test(t.slice(0, m.index))) {
    half = m[1] as "a" | "p";
    t = t.slice(0, m.index).trim();
  }
  let h: number;
  let min: number;
  let first: string;
  const parts = t.split(/\s*[:.,h;\s]\s*/).filter((p) => p !== "");
  if (parts.length === 1) {
    // Sin separador: «7», «19», «730», «0730», «1430».
    const d = parts[0];
    if (!/^\d{1,4}$/.test(d)) return null;
    first = d.length <= 2 ? d : d.slice(0, -2);
    h = Number(first);
    min = d.length <= 2 ? 0 : Number(d.slice(-2));
  } else {
    // «7:30», «7.5» (7:05, como «7:5»), «09:30:00» (los segundos se ignoran).
    if (parts.length > 3 || !parts.every((p) => /^\d{1,2}$/.test(p))) return null;
    first = parts[0];
    h = Number(parts[0]);
    min = Number(parts[1]);
  }
  if (half) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (half === "p" ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  // «19:30», «07:30», «0:15», «12» o con a. m./p. m.: no hay duda. «7:30» o «730» pueden ser de la tarde.
  const fixed = half !== null || h === 0 || h >= 12 || (first.length === 2 && first[0] === "0");
  return { min: h * 60 + min, fixed };
}

/**
 * Lee lo que alguien escribe en una celda de hora, con el proceso a la vista (ver `TimeReading`).
 *
 * Se escribe como se dice o como se teclea rápido: «7:30», «7.30», «7h30», «730», «0730», «7» (7:00),
 * «19» (19:00), «7:30 pm», «7:30 p. m.», «730p», «12 am» (00:00), «09:30:00» (de Excel, sin los
 * segundos), «ahora», «+20» (20 min después del paso anterior, también «+1:30») y «-10» o «hace 10»
 * (hace 10 min).
 *
 * Una hora sin a. m./p. m. y sin cero adelante («2», «150», «7:30») es la que encaja en el proceso: si
 * tal cual queda antes del paso anterior y la de la tarde no, es la de la tarde («2» después de las
 * 06:31 son las 14:00). Las horas de un proceso no cruzan la medianoche.
 */
export function readTime(text: string, ctx: TimeContext = {}): TimeReading {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return { kind: "empty" };
  if (PARTIAL.test(t)) return { kind: "partial" };
  const now = toMin(clockTime((ctx.now ?? (() => new Date()))()));
  const prev = ctx.prev && isTime(ctx.prev.value) ? { m: toMin(ctx.prev.value), ...ctx.prev } : null;
  const next = ctx.next && isTime(ctx.next.value) ? { m: toMin(ctx.next.value), ...ctx.next } : null;
  let min: number;
  let how: "typed" | "afternoon" | "now" | "after" | "ago" = "typed";
  let minutes: number | undefined;
  let rel: RegExpExecArray | null;
  if (NOW.has(t)) {
    min = now;
    how = "now";
  } else if ((rel = /^\+\s*(.+)$/.exec(t))) {
    const d = parseDuration(rel[1]);
    if (d === null) return { kind: "bad", why: "unknown" };
    if (!prev) return { kind: "bad", why: "noPrev" };
    min = prev.m + d;
    how = "after";
    minutes = d;
  } else if ((rel = /^(?:-|hace\s+)\s*(.+)$/.exec(t))) {
    const d = parseDuration(rel[1]);
    if (d === null) return { kind: "bad", why: "unknown" };
    min = now - d;
    how = "ago";
    minutes = d;
  } else {
    const c = readClock(t);
    if (!c) return { kind: "bad", why: "unknown" };
    min = c.min;
    if (!c.fixed) {
      // La que encaja entre el paso anterior y el siguiente, y que ya pasó (con 15 min de margen).
      const pm = c.min + 720;
      const fits = (x: number) => (!prev || x >= prev.m) && (!next || x <= next.m);
      const past = (x: number) => x <= now + 15;
      if (!(fits(c.min) && past(c.min)) && ((fits(pm) && past(pm)) || (!fits(c.min) && fits(pm)))) {
        min = pm;
        how = "afternoon";
      }
    }
  }
  if (min < 0 || min >= 1440) return { kind: "bad", why: "unknown" };
  const warn = prev && min < prev.m ? "beforePrev" : next && min > next.m ? "afterNext" : min > now + 15 ? "future" : undefined;
  return { kind: "ok", value: fromMin(min), how, ...(minutes !== undefined ? { minutes } : {}), ...(warn ? { warn } : {}) };
}

/**
 * Lo que alguien escribe (o pega) en una celda de hora, como «HH:MM» (ver `readTime`). `null` si
 * está vacío; `undefined` si no se entiende (la celda no cambia y se avisa). `steps`: el paso
 * anterior y el siguiente del proceso, para entender «2» como las 14:00 o «+20».
 */
export function parseTime(text: string, now: () => Date = () => new Date(), steps: Pick<TimeContext, "prev" | "next"> = {}): string | null | undefined {
  const r = readTime(text, { ...steps, now });
  return r.kind === "ok" ? r.value : r.kind === "empty" ? null : undefined;
}

/** Cómo va un paso de un proceso en una fila (ver `sequenceMarks`). */
export type StepMark = { kind: "missing" } | { kind: "order"; after: string };

/** Los pasos de cada proceso (`sequence`): las columnas que lo comparten, en el orden en que se
 *  declararon (el de la tabla original, aunque la persona las mueva o esconda). La columna
 *  `timeline` de un proceso lo dibuja: no es un paso. */
export function sequences(cols: readonly GridColumn[]): GridColumn[][] {
  const by = new Map<string, GridColumn[]>();
  for (const c of cols) if (c.sequence && c.type !== "timeline") by.set(c.sequence, [...(by.get(c.sequence) ?? []), c]);
  return [...by.values()].filter((s) => s.length > 1);
}

const empty = (v: unknown) => v === null || v === undefined || v === "";

/** Un valor que se puede comparar con el del paso anterior: número, o texto que ordena como tal
 *  (horas «HH:MM», fechas ISO). */
function comparable(v: unknown): number | string | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return typeof v === "string" && v ? v : null;
}

/**
 * Lo que dicen los pasos de un proceso de una fila (clave de columna → marca):
 * - **missing**: el paso está vacío pero uno POSTERIOR ya tiene valor («Faltante»): se saltó.
 * - **order**: el valor es ANTERIOR al del último paso previo con valor (una hora mal escrita, o
 *   un paso registrado en la fila equivocada). `after` es la etiqueta de ese paso.
 * Un paso vacío al final del proceso no se marca: todavía no ha ocurrido.
 */
export function sequenceMarks(row: GridRow, seqs: readonly (readonly GridColumn[])[]): Map<string, StepMark> {
  const out = new Map<string, StepMark>();
  for (const steps of seqs) {
    let lastFilled = -1;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (!empty(row[steps[i].key])) {
        lastFilled = i;
        break;
      }
    }
    let prev: { v: number | string; label: string } | null = null;
    steps.forEach((c, i) => {
      const v = row[c.key];
      if (empty(v)) {
        if (i < lastFilled) out.set(c.key, { kind: "missing" });
        return;
      }
      const cur = comparable(v);
      if (cur === null) return;
      if (prev && typeof prev.v === typeof cur && cur < prev.v) out.set(c.key, { kind: "order", after: prev.label });
      prev = { v: cur, label: c.label };
    });
  }
  return out;
}

/** Cómo va un proceso en una fila: sin empezar (`idle`), en curso (`live`), con todos sus pasos
 *  (`done`) o con algo que revisar (`review`: un paso «Faltante» o fuera de orden). Es el valor de
 *  la columna `timeline` del proceso, por el que se filtra y se cuenta. */
export type SequenceState = "idle" | "live" | "done" | "review";

export function sequenceState(row: GridRow, steps: readonly GridColumn[]): SequenceState {
  if (sequenceMarks(row, [steps]).size) return "review";
  const n = steps.filter((c) => !empty(row[c.key])).length;
  return n === 0 ? "idle" : n === steps.length ? "done" : "live";
}

/** El paso que sigue en una fila: el primero vacío después del último con valor (el primero, si no
 *  hay ninguno). `null` si el proceso ya llegó al último paso. */
export function nextStep(row: GridRow, steps: readonly GridColumn[]): GridColumn | null {
  for (let i = steps.length - 1; i >= 0; i--) if (!empty(row[steps[i].key])) return steps[i + 1] ?? null;
  return steps[0] ?? null;
}

/** El paso con valor anterior y el siguiente a `col` en su proceso, como contexto para leer una
 *  hora (`readTime`). `values` pisa lo que trae la fila (lo que se pegó antes en la misma fila). */
export function stepsAround(row: GridRow, steps: readonly GridColumn[], col: GridColumn, values?: Record<string, unknown>): Pick<TimeContext, "prev" | "next"> {
  const at = steps.indexOf(col);
  if (at < 0) return {};
  const val = (c: GridColumn) => (values && Object.hasOwn(values, c.key) ? values[c.key] : row[c.key]);
  let prev: TimeStep | null = null;
  let next: TimeStep | null = null;
  for (let i = at - 1; i >= 0 && !prev; i--) if (isTime(val(steps[i]))) prev = { value: val(steps[i]) as string, label: steps[i].label };
  for (let i = at + 1; i < steps.length && !next; i++) if (isTime(val(steps[i]))) next = { value: val(steps[i]) as string, label: steps[i].label };
  return { prev, next };
}
