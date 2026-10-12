/**
 * La lógica de los filtros cruzados, sin DOM: leer una marca, aplicar un clic, decir si una marca
 * está elegida o atenuada y filtrar filas. La usan `<nx-board>` y la app que calcula en el cliente.
 */
import type { BoardFilters } from "./types";

/** Un par dimensión–valor de una marca. */
export type FilterPair = [dimension: string, value: string];

function decode(s: string): string {
  if (!s.includes("%")) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Los pares de `data-nx-filter`: `"tipo:AT"`, o varios separados por coma (`"area:emp,mes:2026-08"`,
 * una celda que es un área en un mes). Se corta en el primer «:» de cada par, así un valor puede
 * llevar «:» («08:00»); una coma dentro de un valor va como `%2C`.
 */
export function parseFilter(spec: string | null | undefined): FilterPair[] {
  if (!spec) return [];
  const out: FilterPair[] = [];
  for (const part of spec.split(",")) {
    const i = part.indexOf(":");
    if (i <= 0) continue;
    const dim = decode(part.slice(0, i).trim());
    const value = decode(part.slice(i + 1).trim());
    if (dim && value && !out.some(([d]) => d === dim)) out.push([dim, value]);
  }
  return out;
}

/** El par escrito para `data-nx-filter` (con «,» y «%» codificados). */
export function filterSpec(pairs: readonly FilterPair[]): string {
  const enc = (s: string) => s.replace(/%/g, "%25").replace(/,/g, "%2C");
  return pairs.map(([d, v]) => `${enc(d)}:${enc(v)}`).join(",");
}

/** Filtros limpios desde lo que llegue (JSON, un objeto armado a mano): texto, sin repetidos ni vacíos. */
export function normalizeFilters(v: unknown): BoardFilters {
  let o = v;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return {};
    }
  }
  const out: BoardFilters = {};
  if (!o || typeof o !== "object" || Array.isArray(o)) return out;
  for (const [dim, vals] of Object.entries(o)) {
    const list = (Array.isArray(vals) ? vals : [vals]).filter((x) => typeof x === "string" || typeof x === "number").map(String);
    const uniq = [...new Set(list)].filter((x) => x !== "");
    if (dim && uniq.length) out[dim] = uniq;
  }
  return out;
}

/**
 * Lo que hace un clic en una marca. Sin sumar: si la marca ya es lo único elegido en sus
 * dimensiones, se quita; si no, sus dimensiones quedan solo con ella. Sumando (Ctrl, Cmd o Mayús),
 * cada par entra o sale de lo elegido. Devuelve filtros nuevos y las dimensiones que cambiaron.
 */
export function applyPairs(filters: BoardFilters, pairs: readonly FilterPair[], add = false): { filters: BoardFilters; changed: string[] } {
  const next: BoardFilters = Object.fromEntries(Object.entries(filters).map(([d, v]) => [d, [...v]]));
  if (!pairs.length) return { filters: next, changed: [] };
  if (add) {
    for (const [d, v] of pairs) {
      const cur = next[d] ?? [];
      next[d] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    }
  } else {
    const only = pairs.every(([d, v]) => next[d]?.length === 1 && next[d][0] === v);
    for (const [d, v] of pairs) next[d] = only ? [] : [v];
  }
  for (const d of Object.keys(next)) if (!next[d].length) delete next[d];
  return { filters: next, changed: changedDims(filters, next) };
}

/** Las dimensiones cuyos valores difieren entre `a` y `b`. */
export function changedDims(a: BoardFilters, b: BoardFilters): string[] {
  const dims = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...dims].filter((d) => {
    const x = a[d] ?? [], y = b[d] ?? [];
    return x.length !== y.length || x.some((v) => !y.includes(v));
  });
}

/**
 * El estado de una marca: `on` si todos sus pares están elegidos, `off` si alguna de sus
 * dimensiones tiene algo elegido que no es ella (se atenúa), `null` si nada la toca.
 */
export function markState(filters: BoardFilters, pairs: readonly FilterPair[]): "on" | "off" | null {
  if (!pairs.length) return null;
  let touched = false;
  for (const [d, v] of pairs) {
    const sel = filters[d];
    if (!sel?.length) continue;
    touched = true;
    if (!sel.includes(v)) return "off";
  }
  if (!touched) return null;
  return pairs.every(([d, v]) => filters[d]?.includes(v)) ? "on" : null;
}

/** Los filtros sin las dimensiones de `except`: lo que pide un panel que no se filtra a sí mismo. */
export function filtersWithout(filters: BoardFilters, except?: string | readonly string[] | null): BoardFilters {
  const ex = dimList(except);
  const out: BoardFilters = {};
  for (const [d, v] of Object.entries(filters)) if (!ex.includes(d)) out[d] = [...v];
  return out;
}

/** `"tipo"`, `"tipo mes"` o `["tipo", "mes"]` → `["tipo", "mes"]`. */
export function dimList(v: string | readonly string[] | null | undefined): string[] {
  if (!v) return [];
  return (typeof v === "string" ? v.split(/[\s,]+/) : [...v]).map((s) => s.trim()).filter(Boolean);
}

/**
 * Si una fila pasa los filtros (menos los de `except`). La fila trae un campo por dimensión (`tipo`,
 * `area`…), comparado como texto; si el campo es una lista, basta con que uno de sus valores esté
 * elegido. Una fila sin el campo no pasa un filtro de esa dimensión.
 */
export function matchesFilters(row: Record<string, unknown>, filters: BoardFilters, except?: string | readonly string[] | null): boolean {
  const ex = dimList(except);
  for (const [d, vals] of Object.entries(filters)) {
    if (ex.includes(d) || !vals.length) continue;
    const field = row[d];
    const list = Array.isArray(field) ? field : [field];
    if (!list.some((x) => x != null && vals.includes(String(x)))) return false;
  }
  return true;
}
