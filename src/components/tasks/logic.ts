/**
 * Lógica pura de `<nx-tasks>`: validar lo que llega, leer una tarea escrita en una línea («Llamar a
 * Laura mañana, urgente»), agrupar por fecha, las cifras de la cabecera y el resumen de lo pedido.
 * Sin DOM.
 *
 * Las fechas las lee el mismo lector de `<nx-intent>` (`findDateSpan`), y los nombres se juntan
 * como en `<nx-thread>` (`threadNames`): un solo «mañana» y un solo «Laura y Héctor» en la librería.
 */
import { dayOfISO, isoOf, todayOf } from "../../core/days";
import { safeHref } from "../../core/dom";
import { foldText } from "../../core/text";
import { findDateSpan } from "../intent/logic";
import { threadNames } from "../thread/logic";
import type { TaskDraft, TaskGroupId, TaskItem, TaskLink, TaskLinkTone, TaskRequest, TaskRequestPerson, TasksLabels, TasksPerson } from "./types";

/** Largo máximo de un título (lo que pase se corta). */
export const TASK_MAX_TITLE = 300;

const str = (v: unknown, max = 300): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const idOf = (v: unknown): string | undefined => (typeof v === "number" && Number.isFinite(v) ? String(v) : str(v, 128));
const isoDay = (v: unknown): string | undefined => {
  const d = dayOfISO(v);
  return d === null ? undefined : isoOf(d);
};
const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

/** Reemplaza `{clave}` en un texto de `labels`. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
/** «1 vencida|{n} vencidas»: la forma de `n`. */
export const plural = (text: string, n: number): string => fill(text.split("|")[n === 1 ? 0 : 1] ?? text, { n });

// ---------------------------------------------------------------- validar

/** Las tareas válidas (`id` y `title`), en su orden, sin `id` repetidos. */
export function cleanTaskItems(v: unknown): TaskItem[] {
  const seen = new Set<string>();
  const out: TaskItem[] = [];
  for (const o of list(v)) {
    const id = idOf(o.id);
    const title = str(o.title, TASK_MAX_TITLE);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const t: TaskItem = { id, title };
    const due = isoDay(o.due);
    const by = str(o.by, 120);
    const href = safeHref(o.href);
    if (due) t.due = due;
    if (by) t.by = by;
    if (o.urgent === true) t.urgent = true;
    if (o.done === true) t.done = true;
    if (href) t.href = href;
    out.push(t);
  }
  return out;
}

const TONES = new Set<TaskLinkTone>(["warning", "info", "neutral"]);

/** Lo que otros módulos esperan (`id`, `title` y un `href` seguro), sin `id` repetidos. */
export function cleanTaskLinks(v: unknown): TaskLink[] {
  const seen = new Set<string>();
  const out: TaskLink[] = [];
  for (const o of list(v)) {
    const id = idOf(o.id);
    const title = str(o.title, TASK_MAX_TITLE);
    const href = safeHref(o.href);
    if (!id || !title || !href || seen.has(id)) continue;
    seen.add(id);
    const l: TaskLink = { id, title, kind: str(o.kind, 40) ?? "", action: str(o.action, 40) ?? "", href };
    if (TONES.has(o.tone as TaskLinkTone)) l.tone = o.tone as TaskLinkTone;
    const meta = str(o.meta, 160);
    if (meta) l.meta = meta;
    if (o.newTab === true) l.newTab = true;
    out.push(l);
  }
  return out;
}

/** Lo pedido (`id`, `title` y al menos una persona con `name`), sin `id` repetidos. */
export function cleanTaskRequests(v: unknown): TaskRequest[] {
  const seen = new Set<string>();
  const out: TaskRequest[] = [];
  for (const o of list(v)) {
    const id = idOf(o.id);
    const title = str(o.title, TASK_MAX_TITLE);
    const people = list(o.people)
      .slice(0, 100)
      .map((p): TaskRequestPerson | null => {
        const name = str(p.name, 80);
        return name ? (p.done === true ? { name, done: true } : { name }) : null;
      })
      .filter((p): p is TaskRequestPerson => !!p);
    if (!id || !title || !people.length || seen.has(id)) continue;
    seen.add(id);
    const r: TaskRequest = { id, title, people };
    const due = isoDay(o.due);
    const href = safeHref(o.href);
    if (due) r.due = due;
    if (href) r.href = href;
    out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- leer lo escrito

/** Lo que se sabe de un «para Nombre»: la persona y cuántas palabras del nombre usa, o `null` si
 *  `people-source` no dio una sola coincidencia fuerte (se deja el texto como está). */
export type ParaMatch = { person: TasksPerson; used: number } | null;

export interface TaskParseOptions {
  /** «Hoy» (`YYYY-MM-DD` o el día entero de `core/days`); sin él, la fecha local. */
  today?: string | number | null;
  /** Las personas elegidas con «@»: su `@Nombre` en el texto las nombra. */
  people?: readonly TasksPerson[];
  /** «para laura» → lo que respondió `people-source` (`paraKey`). Lo que falta se pide (`ask`). */
  resolved?: ReadonlyMap<string, ParaMatch>;
  /** Lo que la persona quitó de lo entendido: queda en el título. */
  keepDate?: boolean;
  keepUrgent?: boolean;
  /** Para la mayúscula del comienzo. */
  locale?: string;
}

export interface TaskParse extends TaskDraft {
  /** Un «para Nombre» que todavía no se le preguntó a `people-source`: la clave para `resolved`. */
  ask?: string;
}

/** Las palabras que quedan colgando al final de un título («Llamar a Laura el» → «Llamar a Laura»). */
const DANGLING = new Set(["a", "al", "para", "el", "la", "los", "las", "de", "del", "en", "con", "y", "e", "o", "u", "por", "que", "es"]);
/** Lo que va pegado antes de una fecha («para el viernes», «antes del 14»): sale con ella. */
const BEFORE_DATE = new Set(["para", "el", "este", "esta", "hasta", "antes", "del", "de", "a", "al", "en", "desde", "proximo", "proxima"]);
/** Lo que va antes de «urgente» («es urgente», «muy urgente»). */
const BEFORE_URGENT = new Set(["es", "muy", "super"]);
/** Lo que no es un nombre después de «para» («para el», «para mi jefe»). */
const NOT_A_NAME = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "mi", "mis", "tu", "tus", "su", "sus", "que", "hoy", "manana", "pasado", "ya", "todos", "todas", "cada", "este", "esta", "ese", "esa", "nosotros", "ellos", "ellas", "ti", "usted", "ustedes", "lo", "le", "les", "eso", "esto", "antes", "despues"]);

/** La clave de un «para Nombre» en `resolved`: sus palabras plegadas. */
export const paraKey = (words: readonly string[]): string => words.join(" ");

/**
 * La palabra anterior a `i` en `f` (texto plegado, con espacios donde no hay letras): `[inicio, fin)`
 * o `null` si no hay.
 */
function wordBefore(f: string, i: number): [number, number] | null {
  let e = i;
  while (e > 0 && f[e - 1] === " ") e--;
  let s = e;
  while (s > 0 && f[s - 1] !== " ") s--;
  return s < e ? [s, e] : null;
}

/**
 * Lo que dice una línea: el título, la fecha, «urgente» y para quién. Lo reconocido sale del título,
 * y del final se quitan las palabras que quedan colgando («a», «para», «el», «de»…) y las comas; la
 * primera letra va en mayúscula. Se compara plegado (sin tildes ni mayúsculas).
 *
 * - **Personas**: `@Laura Gómez` de las elegidas con «@» (`people`), y «para Laura» si `resolved`
 *   dice que es una sola persona (si todavía no se sabe, `ask` dice qué preguntar).
 * - **Fecha**: «hoy», «mañana», «pasado mañana», un día de la semana (el próximo), «el 14», «14/10» o
 *   «14 de octubre», con lo que va pegado antes («para el viernes», «antes del 14»).
 * - **Urgente**: «urgente», «urgentemente» («es urgente», «muy urgente»).
 */
export function parseTask(text: string, opts: TaskParseOptions = {}): TaskParse {
  const s = String(text ?? "")
    .normalize("NFC")
    .slice(0, 1000);
  const today = typeof opts.today === "number" ? opts.today : todayOf(opts.today);
  // El texto plegado, del mismo largo: cada posición es la misma letra que en `s` (lo demás, espacio).
  let f = "";
  for (let i = 0; i < s.length; i++) {
    const c = foldText(s[i]);
    f += c.length === 1 && /[a-z0-9/-]/.test(c) ? c : " ";
  }
  const used = new Uint8Array(s.length);
  const take = (a: number, b: number) => {
    used.fill(1, a, b);
    f = f.slice(0, a) + " ".repeat(b - a) + f.slice(b);
  };
  const people: TasksPerson[] = [];
  const add = (p: TasksPerson) => {
    if (!people.some((x) => x.id === p.id)) people.push(p);
  };

  // Las personas del «@»: el texto exacto que puso la lista («@Laura Gómez»), como palabra entera; el
  // nombre más largo primero (`@Laura Gómez` antes que `@Laura`), y en el orden en que se escribieron.
  const found: [number, TasksPerson][] = [];
  for (const p of [...(opts.people ?? [])].sort((a, b) => b.name.length - a.name.length)) {
    const needle = `@${p.name}`;
    for (let i = s.indexOf(needle); i >= 0; i = s.indexOf(needle, i + 1)) {
      const end = i + needle.length;
      if ((i > 0 && !/[\s(,;:]/.test(s[i - 1])) || /[\p{L}\p{N}_]/u.test(s[end] ?? "") || used[i]) continue;
      take(i, end);
      found.push([i, p]);
    }
  }
  for (const [, p] of found.sort((a, b) => a[0] - b[0])) add(p);

  // La fecha, con lo que va pegado antes («para el viernes»).
  let due: string | undefined;
  if (!opts.keepDate) {
    const span = findDateSpan(` ${f} `, today);
    if (span && span.day !== null) {
      let a = span.start - 1;
      for (let n = 0; n < 2; n++) {
        const w = wordBefore(f, a);
        if (!w || !BEFORE_DATE.has(f.slice(w[0], w[1]))) break;
        a = w[0];
      }
      take(a, span.end - 1);
      due = isoOf(span.day);
    }
  }

  // «urgente».
  let urgent = false;
  if (!opts.keepUrgent) {
    const m = /(?:^| )(urgente(?:mente)?)(?= |$)/.exec(f);
    if (m) {
      let a = m.index + m[0].length - m[1].length;
      const w = wordBefore(f, a);
      if (w && BEFORE_URGENT.has(f.slice(w[0], w[1]))) a = w[0];
      take(a, m.index + m[0].length);
      urgent = true;
    }
  }

  // «para Nombre»: el último que parezca un nombre.
  let ask: string | undefined;
  let para: { at: number; words: [number, number][] } | null = null;
  for (const m of f.matchAll(/(?:^| )para +([a-z]{2,})(?: +([a-z]{2,}))?(?= |$)/g)) {
    const at = m.index + (m[0].startsWith(" ") ? 1 : 0);
    const w1 = m.index + m[0].indexOf(m[1], at - m.index + 4);
    if (NOT_A_NAME.has(m[1])) continue;
    const words: [number, number][] = [[w1, w1 + m[1].length]];
    if (m[2] && !NOT_A_NAME.has(m[2]) && !DANGLING.has(m[2])) {
      const w2 = m.index + m[0].length - m[2].length;
      words.push([w2, w2 + m[2].length]);
    }
    para = { at, words };
  }
  if (para) {
    const key = paraKey(para.words.map(([a, b]) => f.slice(a, b)));
    const hit = opts.resolved?.get(key);
    if (hit === undefined) ask = key;
    else if (hit) {
      take(para.at, para.words[Math.min(hit.used, para.words.length) - 1][1]);
      add(hit.person);
    }
  }

  const out: TaskParse = { title: cleanTitle(s, used, opts.locale), urgent, people };
  if (due) out.due = due;
  if (ask) out.ask = ask;
  return out;
}

/** El título: lo no reconocido, sin espacios de más, sin lo que cuelga y con mayúscula inicial. */
function cleanTitle(s: string, used: Uint8Array, locale?: string): string {
  let t = "";
  for (let i = 0; i < s.length; i++) t += used[i] ? " " : s[i];
  t = t
    .replace(/\s+/g, " ")
    .replace(/ ([,;:.!?)])/g, "$1")
    .replace(/([(¿¡]) /g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1");
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(/^[\s,;:.·\-–—]+|[\s,;:.·\-–—]+$/g, "");
    const m = /(?:^|\s)(\p{L}+)$/u.exec(t);
    if (m && DANGLING.has(foldText(m[1]))) t = t.slice(0, m.index);
  }
  const first = t.search(/\p{L}/u);
  if (first >= 0) {
    let up: string;
    try {
      up = t[first].toLocaleUpperCase(locale || "es-CO");
    } catch {
      up = t[first].toUpperCase();
    }
    t = t.slice(0, first) + up + t.slice(first + 1);
  }
  return t.slice(0, TASK_MAX_TITLE);
}

/**
 * ¿«para {words}» nombra a una sola persona de `people`? Una palabra cuenta si es una palabra
 * entera del nombre (sin tildes ni mayúsculas): «para laura» con una sola Laura sí; con dos, solo si
 * la segunda palabra («para laura gomez») deja una. `used`: cuántas palabras de lo escrito son el
 * nombre.
 */
export function strongMatch(words: readonly string[], people: readonly TasksPerson[]): ParaMatch {
  const [w1, w2] = words;
  if (!w1) return null;
  const seen = new Set<string>();
  const cands: { p: TasksPerson; t: string[]; i: number }[] = [];
  for (const p of people) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const t = foldText(p.name).split(/[^a-z0-9]+/).filter(Boolean);
    const i = t.indexOf(w1);
    if (i >= 0) cands.push({ p, t, i });
  }
  const second = (c: (typeof cands)[number]) => !!w2 && c.t[c.i + 1] === w2;
  if (cands.length === 1) return { person: cands[0].p, used: second(cands[0]) ? 2 : 1 };
  const two = cands.filter(second);
  return two.length === 1 ? { person: two[0].p, used: 2 } : null;
}

// ---------------------------------------------------------------- grupos, cifras y fechas

/** El grupo de una fecha frente a `today`: vencida, hoy, los próximos 6 días, más adelante o sin fecha. */
export function taskGroup(due: string | undefined, today: number): TaskGroupId {
  const d = dayOfISO(due);
  if (d === null) return "none";
  return d < today ? "late" : d === today ? "today" : d <= today + 6 ? "soon" : "later";
}

/** El orden de los grupos. */
export const TASK_GROUPS: readonly TaskGroupId[] = ["late", "today", "soon", "later", "none"];

/**
 * Las tareas por grupo (solo los que tienen alguna), y las hechas aparte. Dentro de un grupo: las
 * urgentes primero, después por fecha y, a igual fecha, en el orden en que llegaron.
 */
export function groupTasks(items: readonly TaskItem[], today: number): { groups: { id: TaskGroupId; items: TaskItem[] }[]; done: TaskItem[] } {
  const by = new Map<TaskGroupId, { t: TaskItem; d: number; i: number }[]>();
  const done: TaskItem[] = [];
  items.forEach((t, i) => {
    if (t.done) return void done.push(t);
    const g = taskGroup(t.due, today);
    let arr = by.get(g);
    if (!arr) by.set(g, (arr = []));
    arr.push({ t, d: dayOfISO(t.due) ?? Infinity, i });
  });
  const groups = TASK_GROUPS.filter((g) => by.has(g)).map((id) => ({
    id,
    items: by
      .get(id)!
      .sort((a, b) => Number(!a.t.urgent) - Number(!b.t.urgent) || a.d - b.d || a.i - b.i)
      .map((x) => x.t),
  }));
  return { groups, done };
}

export interface TaskCounts {
  late: number;
  today: number;
  /** Lo que espera en otros módulos. */
  waiting: number;
  /** Lo pedido a otros que todavía no está hecho por todos. */
  asked: number;
}

/** Las cifras de la cabecera. */
export function taskCounts(items: readonly TaskItem[], links: readonly TaskLink[], requests: readonly TaskRequest[], today: number): TaskCounts {
  let late = 0;
  let now = 0;
  for (const t of items) {
    if (t.done) continue;
    const g = taskGroup(t.due, today);
    if (g === "late") late++;
    else if (g === "today") now++;
  }
  return { late, today: now, waiting: links.length, asked: requests.filter((r) => r.people.some((p) => !p.done)).length };
}

const MS = 864e5;
const dtfs = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: string, year: boolean): Intl.DateTimeFormat {
  const key = `${locale}|${year}`;
  let f = dtfs.get(key);
  if (!f) {
    const o: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
    if (year) o.year = "numeric";
    try {
      f = new Intl.DateTimeFormat(locale, o);
    } catch {
      f = new Intl.DateTimeFormat("es-CO", o);
    }
    dtfs.set(key, f);
  }
  return f;
}

/** «vie 23 oct» (con el año si no es el de `today`): sin la coma ni el «de» que pone Intl en es. */
export function taskShortDate(day: number, today: number, locale = "es-CO"): string {
  const year = new Date(day * MS).getUTCFullYear() !== new Date(today * MS).getUTCFullYear();
  return dtf(locale, year)
    .formatToParts(day * MS)
    .map((p) => (p.type === "literal" ? " " : p.value))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export type TaskDueLabels = Pick<TasksLabels, "dueLate" | "dueYesterday" | "dueToday" | "dueTomorrow" | "dueOn">;

/** «venció hace 3 días», «venció ayer», «vence hoy», «vence mañana», «vence el vie 23 oct». `tone`:
 *  `late` (vencida) o `today`. `null` sin fecha. */
export function taskDueText(due: string | undefined, today: number, locale: string, L: TaskDueLabels): { text: string; tone: "late" | "today" | null } | null {
  const d = dayOfISO(due);
  if (d === null) return null;
  if (d < today) return { text: d === today - 1 ? L.dueYesterday : fill(L.dueLate, { n: today - d }), tone: "late" };
  if (d === today) return { text: L.dueToday, tone: "today" };
  if (d === today + 1) return { text: L.dueTomorrow, tone: null };
  return { text: fill(L.dueOn, { date: taskShortDate(d, today, locale) }), tone: null };
}

export type TaskRequestLabels = Pick<TasksLabels, "progress" | "missingOne" | "missingMany" | "pending" | "done" | "and" | "moreNames">;

/**
 * Cómo va lo pedido: con varias personas, «2 de 3 hechas · falta Andrés Pérez» (o «faltan A y
 * B»); con una, «Daniela Henao · pendiente» o «… · hecha». `late`: venció y alguien no ha terminado.
 */
export function requestSummary(r: TaskRequest, today: number, L: TaskRequestLabels): { done: number; total: number; text: string; late: boolean } {
  const total = r.people.length;
  const missing = r.people.filter((p) => !p.done).map((p) => p.name);
  const done = total - missing.length;
  const d = dayOfISO(r.due);
  const late = d !== null && d < today && missing.length > 0;
  if (total === 1) return { done, total, text: `${r.people[0].name} · ${done ? L.done : L.pending}`, late };
  const names = threadNames(missing, L.and, L.moreNames);
  const text = fill(L.progress, { done, total }) + (missing.length ? ` · ${fill(missing.length === 1 ? L.missingOne : L.missingMany, { names })}` : "");
  return { done, total, text, late };
}

/** «Laura», «Laura y Andrés», «Laura, Andrés y 2 más» (la unión de `<nx-thread>`). */
export const taskNames = (names: readonly string[], and: string, more: string): string => threadNames(names, and, more);
