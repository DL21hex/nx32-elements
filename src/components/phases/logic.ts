/**
 * La lógica de `<nx-phases>`, sin DOM: los tramos limpios y en orden, cuánto de cada uno ya pasó,
 * dónde cae un día en el eje y los ticks por defecto.
 *
 * El eje va del comienzo del día 1 al final del día `total`: cada día ocupa `1 / total` del ancho.
 * Un tramo cubre del comienzo de su `from` al final de su `to`; hoy cuenta como pasado, así que la
 * línea de hoy va al final de su día. Un tick marca el comienzo de su día, salvo el último (`total`),
 * que va al final del eje.
 */
import type { Phase, PhaseProgress } from "./types";

const day = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1;

/**
 * Los tramos válidos (días enteros desde 1, `to ≥ from`, con nombre), ordenados por `from`. Un tramo
 * que se monta sobre el anterior empieza donde ese termina (o se descarta si queda vacío), y con
 * `total` lo que pasa del eje se corta.
 */
export function cleanPhases(input: unknown, total?: number | null): Phase[] {
  const max = day(total) ? total : Infinity;
  const list = (Array.isArray(input) ? input : [])
    .filter((p): p is Phase => !!p && typeof p === "object" && typeof p.label === "string" && day(p.from) && day(p.to) && p.to >= p.from)
    .sort((a, b) => a.from - b.from);
  const out: Phase[] = [];
  let last = 0;
  for (const p of list) {
    const from = Math.max(p.from, last + 1);
    const to = Math.min(p.to, max);
    if (from > to) continue;
    out.push(from === p.from && to === p.to ? p : { ...p, from, to });
    last = to;
  }
  return out;
}

/** El último día del eje: `total` si es un día válido, si no el mayor `to` (0 sin tramos). */
export function axisTotal(phases: readonly Phase[], total?: number | null): number {
  if (day(total)) return total;
  return phases.reduce((m, p) => Math.max(m, p.to), 0);
}

/**
 * Cuántos días del tramo ya pasaron con `today` (hoy incluido) y cuántos faltan. Sin `today`, todo
 * pasó.
 */
export function phaseProgress(p: Phase, today?: number | null): PhaseProgress {
  const days = p.to - p.from + 1;
  if (typeof today !== "number" || !Number.isFinite(today)) return { days, done: days, left: 0 };
  const done = Math.min(days, Math.max(0, Math.floor(today) - p.from + 1));
  return { days, done, left: days - done };
}

/** El comienzo del día `d` en el eje, en % (día 1 → 0). */
export function dayStart(d: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, ((d - 1) / total) * 100));
}

/** El final del día `d` en el eje, en % (día `total` → 100). */
export function dayEnd(d: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, (d / total) * 100));
}

/** Dónde va un tick: al comienzo de su día; el último día, al final del eje. */
export function tickPos(d: number, total: number): number {
  return d >= total && total > 1 ? 100 : dayStart(d, total);
}

/**
 * Los ticks del eje. Con `given`, esos (días enteros dentro del eje, sin repetir, en orden). Sin
 * ellos: el día 1, el último y el comienzo de cada tramo que no quede a menos de `minGap` % de otro
 * (los extremos mandan).
 */
export function axisTicks(phases: readonly Phase[], total: number, given?: readonly number[] | null, minGap = 8): number[] {
  if (!(total >= 1)) return [];
  if (Array.isArray(given) && given.length) {
    return [...new Set(given.filter((d) => day(d) && d <= total))].sort((a, b) => a - b);
  }
  const keep = total > 1 ? [1, total] : [1];
  for (const p of phases) {
    const at = tickPos(p.from, total);
    if (keep.every((k) => Math.abs(tickPos(k, total) - at) >= minGap)) keep.push(p.from);
  }
  return [...new Set(keep)].sort((a, b) => a - b);
}

/** Lee una lista de días: un arreglo, JSON (`[1,90]`) o separada por comas (`1, 90, 180`). */
export function parseTicks(v: unknown): number[] {
  if (Array.isArray(v)) return v.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (typeof v !== "string" || !v.trim()) return [];
  const s = v.trim();
  if (s.startsWith("[")) {
    try {
      return parseTicks(JSON.parse(s));
    } catch {
      return [];
    }
  }
  return s.split(/[\s,;]+/).map(Number).filter((n) => Number.isFinite(n));
}
