/** Una fila del mapa: su nombre, una nota corta («420 personas») y, si se quiere, su total y su cambio. */
export interface HeatRow {
  id: string;
  label: string;
  note?: string;
  /** El valor de la fila en todo el periodo (no siempre es la suma: una tasa no se suma). */
  total?: number;
  /** El cambio de `total` frente a la comparación, en la misma unidad (en `percent`, puntos). */
  delta?: number;
}

export interface HeatColumn {
  id: string;
  label: string;
}

export type HeatScale = "sequential" | "diverging";
export type HeatPolarity = "up-bad" | "up-good";

export interface HeatmapLabels {
  empty: string;
  /** El encabezado de la columna de totales. */
  total: string;
  /** El nombre accesible de una celda: `{row}`, `{column}`, `{value}`. */
  cell: string;
  /** Una celda sin dato. */
  noData: string;
  /** El nombre de la escala para el lector de pantalla. */
  scale: string;
  /** Puntos porcentuales: `{n}`. */
  points: string;
}

export interface HeatmapSelectDetail {
  /** La fila (al tocar una celda o el nombre de la fila) o `null` (al tocar una columna). */
  row: HeatRow | null;
  column: HeatColumn | null;
  value: number | null;
}
