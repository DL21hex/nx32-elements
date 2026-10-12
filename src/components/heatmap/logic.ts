/**
 * La lógica de `<nx-heatmap>`, sin DOM: limpiar filas, columnas y valores, el dominio de la escala
 * y la intensidad de cada celda.
 */
import type { HeatColumn, HeatRow, HeatScale } from "./types";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function parse(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** Filas válidas (con `id` y `label`), sin repetidas. */
export function cleanRows(v: unknown): HeatRow[] {
  const o = parse(v);
  if (!Array.isArray(o)) return [];
  const seen = new Set<string>();
  const out: HeatRow[] = [];
  for (const x of o) {
    if (!x || typeof x !== "object") continue;
    const r = x as Partial<HeatRow>;
    const id = typeof r.id === "string" || typeof r.id === "number" ? String(r.id) : "";
    if (!id || seen.has(id) || typeof r.label !== "string") continue;
    seen.add(id);
    const row: HeatRow = { id, label: r.label };
    if (typeof r.note === "string" && r.note) row.note = r.note;
    if (finite(r.total)) row.total = r.total;
    if (finite(r.delta)) row.delta = r.delta;
    out.push(row);
  }
  return out;
}

/** Columnas válidas (con `id` y `label`), sin repetidas. */
export function cleanColumns(v: unknown): HeatColumn[] {
  const o = parse(v);
  if (!Array.isArray(o)) return [];
  const seen = new Set<string>();
  const out: HeatColumn[] = [];
  for (const x of o) {
    if (!x || typeof x !== "object") continue;
    const c = x as Partial<HeatColumn>;
    const id = typeof c.id === "string" || typeof c.id === "number" ? String(c.id) : "";
    if (!id || seen.has(id) || typeof c.label !== "string") continue;
    seen.add(id);
    out.push({ id, label: c.label });
  }
  return out;
}

/** La matriz filas × columnas: lo que falta o no es número queda en `null`. */
export function cleanValues(v: unknown, rows: number, cols: number): (number | null)[][] {
  const o = parse(v);
  const m = Array.isArray(o) ? o : [];
  return Array.from({ length: rows }, (_, r) => {
    const line = Array.isArray(m[r]) ? (m[r] as unknown[]) : [];
    return Array.from({ length: cols }, (_, c) => (finite(line[c]) ? (line[c] as number) : null));
  });
}

export interface HeatDomain {
  min: number;
  max: number;
  /** El centro de una escala divergente. */
  mid: number;
}

/**
 * El dominio de la escala. Secuencial: de `min` (0, o el menor si hay negativos) a `max` (el mayor).
 * Divergente: simétrico alrededor de `mid` (0), hasta la mayor distancia.
 */
export function heatDomain(values: readonly (readonly (number | null)[])[], scale: HeatScale, o: { min?: number | null; max?: number | null; mid?: number | null } = {}): HeatDomain {
  const all = values.flat().filter(finite);
  const mid = finite(o.mid) ? o.mid : 0;
  if (scale === "diverging") {
    const far = Math.max(0, ...all.map((v) => Math.abs(v - mid)));
    const span = finite(o.max) ? Math.max(Math.abs(o.max - mid), 1e-12) : far || 1;
    return { min: mid - span, max: mid + span, mid };
  }
  const min = finite(o.min) ? o.min : Math.min(0, ...all);
  let max = finite(o.max) ? o.max : Math.max(min, ...all);
  if (max <= min) max = min + 1;
  return { min, max, mid };
}

/**
 * Cuánto pesa una celda en la escala: `t` entre 0 y 1 (lo lejos que está del extremo débil) y el
 * lado (`1` hacia el color fuerte, `-1` hacia el polo negativo de una divergente). `null` sin dato.
 */
export function intensity(v: number | null, d: HeatDomain, scale: HeatScale): { t: number; side: 1 | -1 } | null {
  if (!finite(v)) return null;
  if (scale === "diverging") {
    const span = d.max - d.mid || 1;
    const x = (v - d.mid) / span;
    return { t: Math.min(1, Math.abs(x)), side: x < 0 ? -1 : 1 };
  }
  const t = (v - d.min) / (d.max - d.min || 1);
  return { t: Math.min(1, Math.max(0, t)), side: 1 };
}

/** El porcentaje del color fuerte en la mezcla (6 en el extremo débil, para que no se pierda contra el fondo). */
export function mixPct(t: number): number {
  return Math.round(6 + 94 * Math.min(1, Math.max(0, t)));
}

/**
 * La celda siguiente con las flechas, en una grilla donde la fila -1 son los encabezados de
 * columna y la columna -1 los de fila (la esquina no existe). Devuelve `null` si no hay a dónde ir.
 */
export function moveCell(r: number, c: number, key: string, rows: number, cols: number, ctrl = false): [number, number] | null {
  let nr = r, nc = c;
  if (key === "ArrowRight") nc++;
  else if (key === "ArrowLeft") nc--;
  else if (key === "ArrowDown") nr++;
  else if (key === "ArrowUp") nr--;
  else if (key === "Home") (ctrl ? (nr = 0, nc = 0) : (nc = r < 0 ? 0 : -1));
  else if (key === "End") (ctrl ? (nr = rows - 1, nc = cols - 1) : (nc = cols - 1));
  else return null;
  if (nr < -1 || nr >= rows || nc < -1 || nc >= cols) return null;
  if (nr === -1 && nc === -1) return null;
  return [nr, nc];
}
