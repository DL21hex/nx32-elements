/**
 * La lógica de `<nx-bars>`, sin DOM: limpiar los ítems y calcular lo que se pinta (el máximo de la
 * escala, la parte de cada barra en el total, el acumulado y lo que queda fuera del tope).
 */
import type { BarItem, BarSeries } from "./types";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Ítems válidos: con `id`, `label` y un valor finito. Las partes negativas o no numéricas valen 0. */
export function cleanBars(v: unknown): BarItem[] {
  let o = v;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(o)) return [];
  const out: BarItem[] = [];
  const seen = new Set<string>();
  for (const x of o) {
    if (!x || typeof x !== "object") continue;
    const it = x as Partial<BarItem>;
    const id = typeof it.id === "string" || typeof it.id === "number" ? String(it.id) : "";
    if (!id || seen.has(id) || typeof it.label !== "string" || !finite(it.value)) continue;
    seen.add(id);
    const clean: BarItem = { id, label: it.label, value: it.value };
    if (typeof it.code === "string" && it.code) clean.code = it.code;
    if (typeof it.note === "string" && it.note) clean.note = it.note;
    if (typeof it.extra === "string" && it.extra) clean.extra = it.extra;
    if (Array.isArray(it.parts)) clean.parts = it.parts.map((p) => (finite(p) && p > 0 ? p : 0));
    out.push(clean);
  }
  return out;
}

/** Series válidas (con `id` y `label`), hasta 8: la paleta no se repite. */
export function cleanSeries(v: unknown): BarSeries[] {
  let o = v;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(o)) return [];
  return o
    .filter((s): s is BarSeries => !!s && typeof s === "object" && (typeof s.id === "string" || typeof s.id === "number") && typeof s.label === "string")
    .slice(0, 8)
    .map((s) => ({ id: String(s.id), label: s.label, ...(finite(s.slot) && s.slot >= 1 && s.slot <= 8 ? { slot: Math.floor(s.slot) } : {}) }));
}

export interface BarsLayout {
  /** Las barras que se ven (las primeras `limit`). */
  shown: BarItem[];
  /** Las que quedan fuera del tope. */
  hidden: BarItem[];
  /** La suma de todas (también las ocultas): la base de «del total». */
  total: number;
  /** El valor que llena la escala: el mayor entre las barras, la referencia y `max`. */
  max: number;
  /** El % acumulado al final de cada barra que se ve (Pareto), sobre el total de todas. */
  cumulative: number[];
}

/** Lo que se pinta con estos ítems. Los valores negativos cuentan como 0 en la escala. */
export function layoutBars(items: readonly BarItem[], opts: { limit?: number | null; reference?: number | null; max?: number | null } = {}): BarsLayout {
  const limit = finite(opts.limit) && opts.limit > 0 ? Math.floor(opts.limit) : items.length;
  // El tope no deja una sola barra afuera: «y 1 más» ocupa lo mismo que la barra.
  const cut = items.length - limit === 1 ? items.length : limit;
  const shown = items.slice(0, cut);
  const hidden = items.slice(cut);
  const total = items.reduce((s, it) => s + Math.max(0, it.value), 0);
  let max = Math.max(0, ...shown.map((it) => it.value));
  if (finite(opts.reference)) max = Math.max(max, opts.reference);
  if (finite(opts.max) && opts.max > 0) max = Math.max(max, opts.max);
  let acc = 0;
  const cumulative = shown.map((it) => {
    acc += Math.max(0, it.value);
    return total ? acc / total : 0;
  });
  return { shown, hidden, total, max: max || 1, cumulative };
}

/** El largo de una barra en % de la escala (entre 0 y 100). */
export function barPct(value: number, max: number): number {
  if (!finite(value) || !finite(max) || max <= 0 || value <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}
