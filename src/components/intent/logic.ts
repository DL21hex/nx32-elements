/**
 * Lógica pura de `<nx-intent>`: qué trámite nombra un texto y qué datos trae (una fecha, un mes,
 * una hora, un monto, una de las opciones). Sin DOM y sin modelos: palabras clave que manda el
 * servidor y un lector de fechas y cifras en español. Lo escrito se compara plegado (sin tildes ni
 * mayúsculas), así «vacasiones» no, pero «vacaciones», «Vacaciónes» y «VACACIONES» sí.
 */
import { dayOf, isoOf, jsDay, todayOf, validDay, ymd } from "../../core/days";
import { nxFormat } from "../../core/locale";
import { foldText } from "../../core/text";
import type { IntentDef, IntentMatch, IntentOption, IntentSlot } from "./types";

const MS = 864e5;
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTH_ALIASES: Record<string, number> = { setiembre: 9, sept: 9, ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
const WEEKDAYS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** El texto como se compara: plegado, con un espacio a cada lado y los espacios juntos. */
export function normalizeIntentText(text: string): string {
  return ` ${foldText(String(text ?? "")).replace(/\s+/g, " ").trim()} `;
}

/** ¿`keyword` aparece en `t` (ya normalizado) como comienzo de palabra? Una frase cuenta entera. */
export function hasKeyword(t: string, keyword: string): boolean {
  const k = foldText(String(keyword ?? "")).replace(/\s+/g, " ").trim();
  if (!k) return false;
  return new RegExp(`[^a-z0-9]${esc(k)}`).test(t);
}

/** Cuánto pesa una palabra o frase: una por palabra (una frase que coincide dice más). */
const weight = (keyword: string) => foldText(String(keyword)).trim().split(/\s+/).filter(Boolean).length;

/** Qué tanto nombra `t` a la intención: 0 si no la nombra o si la descarta. */
export function scoreIntent(t: string, intent: IntentDef): number {
  if (!intent || !Array.isArray(intent.keywords)) return 0;
  if (Array.isArray(intent.exclude) && intent.exclude.some((k) => hasKeyword(t, k))) return 0;
  let s = 0;
  for (const k of intent.keywords) if (hasKeyword(t, k)) s += weight(k);
  if (!s) return 0;
  // Las palabras de sus opciones solo desempatan («certificado para el banco» frente a otro trámite con «banco»).
  for (const slot of intent.slots ?? []) for (const o of slot.options ?? []) if ((o.keywords ?? []).some((k) => hasKeyword(t, k))) s += 0.25;
  return s;
}

// ---------------------------------------------------------------- fechas, meses, horas y montos

/**
 * Una fecha en el texto: «hoy», «mañana», «pasado mañana», un día de la semana (el próximo, nunca
 * hoy), «el 14», «14 de octubre (de 2026)», «14/10» o «2026-10-14». El día entero o `null`.
 */
export function findDate(t: string, today: number): number | null {
  if (/ pasado manana /.test(t)) return today + 2;
  const noMorning = t.replace(/ (en|por|de) la manana /g, " ");
  if (/ manana /.test(noMorning)) return today + 1;
  if (/ hoy /.test(t)) return today;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return validDay(+iso[1], +iso[2], +iso[3]);
  const [ty, tm] = ymd(today);
  const named = new RegExp(`(?:^|[^0-9])(\\d{1,2}) de (${[...MONTHS, ...Object.keys(MONTH_ALIASES)].join("|")})(?: de (\\d{4}))?`).exec(t);
  if (named) {
    const m = monthNumber(named[2])!;
    let y = named[3] ? +named[3] : ty;
    let d = validDay(y, m, +named[1]);
    if (!named[3] && d !== null && d < today) d = validDay((y = ty + 1), m, +named[1]);
    return d;
  }
  const slash = /(?:^|[^0-9])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![0-9])/.exec(t);
  if (slash) {
    let y = slash[3] ? +slash[3] : ty;
    if (y < 100) y += 2000;
    let d = validDay(y, +slash[2], +slash[1]);
    if (!slash[3] && d !== null && d < today) d = validDay(ty + 1, +slash[2], +slash[1]);
    return d;
  }
  const wd = new RegExp(` (${WEEKDAYS.join("|")}) `).exec(t);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1]);
    let d = today + 1;
    while (jsDay(d) !== target) d++;
    return d;
  }
  const bare = / el (\d{1,2}) /.exec(t);
  if (bare) {
    let d = validDay(ty, tm, +bare[1]);
    if (d === null || d < today) d = validDay(tm === 12 ? ty + 1 : ty, tm === 12 ? 1 : tm + 1, +bare[1]);
    return d;
  }
  return null;
}

function monthNumber(word: string): number | null {
  const i = MONTHS.indexOf(word);
  return i >= 0 ? i + 1 : MONTH_ALIASES[word] ?? null;
}

/** Un mes en el texto («en diciembre», «de agosto de 2025»), como «2026-12». Sin año: el próximo o el último que pasó. */
export function findMonth(t: string, today: number, direction: "future" | "past" = "future"): string | null {
  const re = new RegExp(` (${[...MONTHS, "setiembre", "sept"].join("|")})(?: de (\\d{4}))? `);
  const found = re.exec(t);
  const word = found ? found[1] : / fin de ano /.test(t) ? "diciembre" : null;
  if (!word) return null;
  const year = found?.[2];
  const month = monthNumber(word)!;
  const [ty, tm] = ymd(today);
  let y = year ? +year : ty;
  if (!year) {
    if (direction === "future" && month < tm) y = ty + 1;
    if (direction === "past" && month > tm) y = ty - 1;
  }
  return `${y}-${String(month).padStart(2, "0")}`;
}

/** Una hora («a las 3», «3 pm», «15:30», «en la mañana» → 08:00, «en la tarde» → 14:00), como «HH:MM». */
export function findTime(t: string): string | null {
  const fmt = (h: number, m: number) => (h >= 0 && h < 24 && m >= 0 && m < 60 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null);
  const ampm = (h: number, mark: string | undefined) => {
    const p = mark?.[0];
    if (p === "p" && h < 12) return h + 12;
    if (p === "a" && h === 12) return 0;
    // Sin a. m. ni p. m., «a las 3» es de la tarde: nadie pide un permiso a las 3 de la madrugada.
    if (!p && h >= 1 && h < 7) return h + 12;
    return h;
  };
  const at = / (?:a|desde) las? (\d{1,2})(?:[:.h](\d{2}))? ?(am|pm|a\. ?m|p\. ?m)?/.exec(t);
  if (at) return fmt(ampm(+at[1], at[3]), at[2] ? +at[2] : 0);
  const marked = / (\d{1,2})(?::(\d{2}))? ?(am|pm|a\. ?m|p\. ?m)\.?(?= )/.exec(t);
  if (marked) return fmt(ampm(+marked[1], marked[3]), marked[2] ? +marked[2] : 0);
  const clock = /(?:^|[^0-9])(\d{1,2}):(\d{2})(?![0-9])/.exec(t);
  if (clock) return fmt(+clock[1], +clock[2]);
  if (/ (en|por|de) la manana /.test(t)) return "08:00";
  if (/ (al )?mediodia /.test(t)) return "12:00";
  if (/ (en|por|de) la tarde /.test(t)) return "14:00";
  return null;
}

/** Un monto («5 millones», «2,5 millones», «500 mil», «$ 3.500.000», «3500000»). */
export function findAmount(t: string): number | null {
  const num = (s: string) => parseFloat(s.replace(",", "."));
  const big = /(?:^|[^0-9.,])(\d+(?:[.,]\d+)?) ?(millones|millon|mill|mm)(?= )/.exec(t);
  if (big) return Math.round(num(big[1]) * 1e6);
  const k = /(?:^|[^0-9.,])(\d+(?:[.,]\d+)?) ?(mil|k)(?= )/.exec(t);
  if (k) return Math.round(num(k[1]) * 1e3);
  const sep = /\$ ?(\d[\d.,]*)|(?:^|[^0-9.,])(\d{1,3}(?:[.,]\d{3})+)(?![0-9])|(?:^|[^0-9.,])(\d{5,})(?![0-9])/.exec(t);
  if (sep) {
    const raw = (sep[1] ?? sep[2] ?? sep[3]).replace(/[.,](?=\d{3}(?:[.,]|$))/g, "").replace(",", ".");
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  return null;
}

/** La opción que nombra el texto (por sus palabras; si ninguna, la `default`). */
export function findOption(t: string, options: readonly IntentOption[] | undefined): IntentOption | null {
  if (!Array.isArray(options)) return null;
  let best: IntentOption | null = null;
  let bestScore = 0;
  for (const o of options) {
    if (!o || typeof o.value !== "string") continue;
    let s = 0;
    for (const k of o.keywords ?? []) if (hasKeyword(t, k)) s += weight(k);
    if (s > bestScore) (best = o), (bestScore = s);
  }
  return best ?? options.find((o) => o && o.default) ?? null;
}

// ---------------------------------------------------------------- lo entendido

const formats = new Map<string, Intl.DateTimeFormat>();
function dtf(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = formats.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
    } catch {
      f = new Intl.DateTimeFormat("es-CO", { ...opts, timeZone: "UTC" });
    }
    formats.set(key, f);
  }
  return f;
}
/** «viernes 9 de octubre» (sin la coma que pone Intl entre el día de la semana y el número). */
export const dateText = (day: number, locale: string): string => dtf(locale, { weekday: "long", day: "numeric", month: "long" }).format(day * MS).replace(",", "");
const monthText = (ym: string, locale: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return dtf(locale, { month: "long", year: "numeric" }).format(dayOf(y, m, 1) * MS);
};
const timeText = (hhmm: string, locale: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  return dtf(locale, { hour: "numeric", minute: "2-digit" }).format(Date.UTC(2000, 0, 1, h, m));
};

/** Agrega los datos a la URL como parámetros (respeta los que ya traiga y el `#`). */
export function withParams(href: string, params: Record<string, string>): string {
  const entries = Object.entries(params).filter(([k, v]) => k && v !== "");
  if (!entries.length) return href;
  const hash = href.indexOf("#");
  const base = hash >= 0 ? href.slice(0, hash) : href;
  const tail = hash >= 0 ? href.slice(hash) : "";
  const q = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `${base}${base.includes("?") ? "&" : "?"}${q}${tail}`;
}

export interface UnderstandOptions {
  today?: string | null;
  locale?: string;
  currency?: string | null;
}

/** Qué pide el texto: el trámite que más nombra (empate: el primero de la lista) y sus datos. */
export function understand(text: string, intents: readonly IntentDef[], opts: UnderstandOptions = {}): IntentMatch | null {
  const t = normalizeIntentText(text);
  if (t.trim().length < 2 || !Array.isArray(intents)) return null;
  let best: IntentDef | null = null;
  let bestScore = 0;
  for (const it of intents) {
    if (!it || typeof it.id !== "string" || typeof it.href !== "string") continue;
    const s = scoreIntent(t, it);
    if (s > bestScore) (best = it), (bestScore = s);
  }
  if (!best) return null;
  const locale = opts.locale || "es-CO";
  const today = todayOf(opts.today);
  const params: Record<string, string> = {};
  const chips = [best.label];
  let chosen: IntentOption | null = null;
  for (const slot of (best.slots ?? []) as IntentSlot[]) {
    if (!slot || typeof slot.name !== "string") continue;
    let value: string | null = null;
    let shown: string | null = null;
    if (slot.type === "date") {
      const d = findDate(t, today);
      if (d !== null) (value = isoOf(d)), (shown = dateText(d, locale));
    } else if (slot.type === "month") {
      const m = findMonth(t, today, slot.direction);
      if (m) (value = m), (shown = monthText(m, locale));
    } else if (slot.type === "time") {
      const hm = findTime(t);
      if (hm) (value = hm), (shown = timeText(hm, locale));
    } else if (slot.type === "amount") {
      const n = findAmount(t);
      if (n !== null) (value = String(n)), (shown = opts.currency ? nxFormat(locale).money(n, { currency: opts.currency }) : nxFormat(locale).number(n));
    } else if (slot.type === "option") {
      const o = findOption(t, slot.options);
      if (o) {
        value = o.value;
        shown = o.label;
        if (o.href) chosen = o;
      }
    }
    if (value === null) continue;
    params[slot.name] = value;
    if (shown) chips.push(slot.label ? `${slot.label} ${shown}` : shown);
  }
  // La opción con su propio destino (un PDF) manda: los demás datos no se le agregan.
  const href = chosen?.href ?? withParams(best.href, params);
  return { intent: best, params, chips, href, newTab: !!(chosen ? chosen.newTab ?? best.newTab : best.newTab) };
}
