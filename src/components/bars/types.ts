import type { ChartFormat } from "../../core/chart";

/** Una barra: un nombre y un valor, y si va apilada, sus partes (en el orden de `series`). */
export interface BarItem {
  id: string;
  label: string;
  value: number;
  /** Un código antes del nombre, en letra de máquina («M54.5», el CIE-10). */
  code?: string;
  /** Una nota para el tooltip («148 incapacidades»). */
  note?: string;
  /** Las partes de la barra apilada, alineadas con `series` (suman `value`). */
  parts?: number[];
  /** Un texto corto a la derecha del valor («45 d», «paga en 138 días»). */
  extra?: string;
}

/** Una serie de una barra apilada: su nombre en la leyenda y, si se quiere fijo, su color (1–8). */
export interface BarSeries {
  id: string;
  label: string;
  slot?: number;
}

export type BarsOrientation = "horizontal" | "vertical";
export type BarsRamp = "categorical" | "ordinal";
export type { ChartFormat };

export interface BarsLabels {
  /** Sin datos. */
  empty: string;
  /** Lo que queda fuera de `limit`. `{n}` y `{share}`. */
  more: string;
  /** Encabezado de la columna del valor. */
  value: string;
  /** Encabezado y renglón del tooltip del % acumulado. */
  cumulative: string;
  /** Renglón del tooltip con la parte del total. */
  share: string;
  /** El nombre accesible de una barra: `{label}`, `{value}`, `{share}`. */
  item: string;
}

export interface BarsSelectDetail {
  item: BarItem;
}
