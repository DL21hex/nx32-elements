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
}

export interface StatsSelectDetail {
  item: StatItem;
  href: string;
}
