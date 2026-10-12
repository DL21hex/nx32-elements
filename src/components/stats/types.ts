export type StatTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Una cifra con su contexto: qué es, cuánto, una nota y, si ayuda, una forma (la tendencia, una
 * barra de avance o un anillo). Un valor numérico sale con el locale (`format`, `currency`).
 */
export interface StatItem {
  id?: string;
  label: string;
  value: string | number;
  format?: "number" | "money" | "percent";
  currency?: string;
  /** Una línea debajo («Catorcena 19 · 2026»). */
  note?: string;
  /** Una pastilla junto a la etiqueta («Sin abrir»). */
  badge?: { label: string; tone?: StatTone };
  /** La serie de la minigráfica (los últimos valores, del más viejo al más nuevo). */
  trend?: number[];
  /** Una meta: una línea punteada en la minigráfica (en la unidad de `trend`). */
  goal?: number;
  /** El cambio frente a otro periodo: una flecha, el cambio y con qué se compara. */
  delta?: StatDelta;
  /** Una barra: `value` de `max`. */
  meter?: { value: number; max: number };
  /** Un anillo: `value` de `max`, con un texto corto en el centro («7d»). */
  ring?: { value: number; max: number; text?: string };
  href?: string;
  newTab?: boolean;
}

export interface StatsLabels {
  /** Nombre del grupo para el lector de pantalla. */
  group: string;
  /** Lo que lee el lector en vez de la flecha. */
  up: string;
  down: string;
  same: string;
  /** Puntos porcentuales: `{n}`. */
  points: string;
}

/**
 * El cambio de una cifra. `value` es una fracción en `percent` (0,12 → «12 %»), una diferencia de
 * fracciones en `points` (0,003 → «0,3 pp») o un número en `number`. `polarity` dice si subir es
 * malo (`up-bad`: el ausentismo, el costo), bueno (`up-good`: las ventas) o ninguna (`neutral`).
 */
export interface StatDelta {
  value: number;
  format?: "percent" | "points" | "number";
  /** Con qué se compara («frente a oct 24 – sep 25»). */
  label?: string;
  polarity?: "up-bad" | "up-good" | "neutral";
}

export interface StatsSelectDetail {
  item: StatItem;
  href: string;
}
