/**
 * `<nx-date>`: la lógica sin DOM. Qué días no se pueden elegir (`unavailable`), cómo se lee una
 * fecha escrita a mano y cómo se escribe de vuelta. Pura: la usa también `<nx-form>` para validar
 * un campo de fecha sin cargar el calendario.
 */
import { dayOfISO, isoOf, jsDay, validDay } from "../../core/days";
import type { DateUnavailable, DateUnavailableDay } from "./types";

/** Lo que no se puede elegir, ya limpio: cada fecha con su motivo (`""` sin motivo) y los días de
 *  la semana (0 domingo … 6 sábado, como `Date#getDay`). */
export interface Unavailable {
  dates: Map<string, string>;
  weekdays: Set<number>;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** `unavailable` como llegue (objeto o JSON) → limpio, o `null` si no bloquea nada. Las fechas que
 *  no son ISO válidas y los días fuera de 0–6 se descartan en silencio: no hay nada que pintar. */
export function cleanUnavailable(v: unknown): Unavailable | null {
  let raw = v;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isObj(raw)) return null;
  const dates = new Map<string, string>();
  for (const d of Array.isArray(raw.dates) ? (raw.dates as (string | DateUnavailableDay)[]) : []) {
    const date = typeof d === "string" ? d : isObj(d) ? d.date : undefined;
    if (dayOfISO(date) === null) continue;
    const label = isObj(d) && typeof d.label === "string" ? d.label.trim() : "";
    dates.set(date as string, label);
  }
  const weekdays = new Set<number>();
  for (const w of Array.isArray(raw.weekdays) ? raw.weekdays : []) if (Number.isInteger(w) && w >= 0 && w <= 6) weekdays.add(w as number);
  return dates.size || weekdays.size ? { dates, weekdays } : null;
}

/** El mismo `unavailable` en su forma pública (para pasarlo a otro elemento como JSON). */
export function plainUnavailable(u: Unavailable | null): DateUnavailable | undefined {
  if (!u) return undefined;
  return {
    dates: [...u.dates].map(([date, label]) => (label ? { date, label } : date)),
    weekdays: [...u.weekdays].sort((a, b) => a - b),
  };
}

/** Por qué no se puede elegir el día: su motivo, `""` si está bloqueado sin motivo, o `null` si se
 *  puede elegir. */
export function blockedReason(u: Unavailable | null, iso: string): string | null {
  if (!u) return null;
  const why = u.dates.get(iso);
  if (why !== undefined) return why;
  const day = dayOfISO(iso);
  return day !== null && u.weekdays.has(jsDay(day)) ? "" : null;
}

/** Un límite de fecha: ISO o «today». */
export function limitOf(v: unknown, today: string): string | null {
  if (v === "today") return today;
  return dayOfISO(v) !== null ? (v as string) : null;
}

/** El orden de día, mes y año en las fechas de este locale (`dmy` en español, `mdy` en EE. UU.). */
export function orderOf(locale: string): "dmy" | "mdy" | "ymd" {
  try {
    const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(Date.UTC(2026, 10, 25, 12)));
    const seq = parts.filter((p) => p.type === "day" || p.type === "month" || p.type === "year").map((p) => p.type[0]).join("");
    return seq === "mdy" || seq === "ymd" ? seq : "dmy";
  } catch {
    return "dmy";
  }
}

/**
 * Lo que se escribió → ISO, o `""` si no es una fecha. Entiende ISO («2026-10-25», también con hora),
 * «25/10/2026», «25-10-2026», «25.10.2026», «25/10/26» (años de dos cifras: 20xx) y «25102026».
 * Día y mes van en el orden del locale (mes primero en inglés de EE. UU.).
 */
export function parseDay(text: string, locale = "es-CO"): string {
  const t = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(t);
  if (iso) {
    const d = validDay(+iso[1], +iso[2], +iso[3]);
    return d === null ? "" : isoOf(d);
  }
  const m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(t) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (!m) return "";
  const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const [day, month] = orderOf(locale) === "mdy" ? [+m[2], +m[1]] : [+m[1], +m[2]];
  if (year < 1) return "";
  const d = validDay(year, month, day);
  return d === null ? "" : isoOf(d);
}

/** ISO → como se escribe en este locale, con números («25/10/2026»). */
export function writeDay(iso: string, locale = "es-CO"): string {
  const day = dayOfISO(iso);
  if (day === null) return "";
  const [y, m, d] = iso.split("-");
  const o = orderOf(locale);
  return o === "mdy" ? `${m}/${d}/${y}` : o === "ymd" ? `${y}-${m}-${d}` : `${d}/${m}/${y}`;
}

/** La guía del formato para el placeholder: «dd/mm/aaaa» (o «mm/dd/aaaa»). */
export function patternOf(locale: string, letters: { day: string; month: string; year: string }): string {
  const o = orderOf(locale);
  const [d, m, y] = [letters.day.repeat(2), letters.month.repeat(2), letters.year.repeat(4)];
  return o === "mdy" ? `${m}/${d}/${y}` : o === "ymd" ? `${y}-${m}-${d}` : `${d}/${m}/${y}`;
}
