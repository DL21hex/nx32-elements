import type { ChartFormat } from "../../core/chart";

export type PartsFormat = ChartFormat;

/**
 * Una parte del todo: quién la pone (`label`), cuánto (`value`) y, si ayuda, la regla que la explica
 * (`note`, debajo del nombre). El color es `slot` (1–8, la paleta de los gráficos); si no viene, sale
 * de la posición.
 */
export interface PartItem {
  id: string;
  label: string;
  value: number;
  /** La regla, debajo del nombre («Días 1 y 2 · 66,67 % del salario»). */
  note?: string;
  /** El color: 1–8 de `--nx-chart-*`. Si no viene, por posición. */
  slot?: number;
}

/** Una parte lista para pintar: el ítem, su color y, si es «Otros», lo que plegó. */
export interface ShownPart {
  item: PartItem;
  slot: string;
  /** Las partes que se plegaron en «Otros» (solo en esa). */
  others?: PartItem[];
}

export interface PartsLabels {
  /** Nombre de la lista para el lector de pantalla. */
  group: string;
  /** Sin partes o con todo en cero. */
  empty: string;
  /** La parte que junta lo que pasa de ocho. */
  other: string;
  /** Renglón del monto en el tooltip. */
  value: string;
  /** Renglón del porcentaje en el tooltip. */
  share: string;
}

export interface PartsSelectDetail {
  item: PartItem;
}
