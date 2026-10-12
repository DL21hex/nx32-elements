import type { ChartFormat } from "../../core/chart";

export type PhasesFormat = ChartFormat;

/**
 * Un tramo: del día `from` al día `to` (enteros, desde 1), quién (`label`) y, si ayuda, la regla
 * (`note`), el color (`slot`, 1–8) y lo causado en ese tramo (`value`).
 */
export interface Phase {
  id?: string;
  /** El primer día del tramo (entero ≥ 1). */
  from: number;
  /** El último día del tramo (entero ≥ `from`). */
  to: number;
  label: string;
  /** La regla del tramo («66,67 % del salario»). */
  note?: string;
  /** El color: 1–8 de `--nx-chart-*`. Si no viene, por posición. */
  slot?: number;
  /** Lo causado en el tramo (un monto, con `format` y `currency`). */
  value?: number;
}

/** Cuánto de un tramo ya pasó con `today` y cuánto falta. */
export interface PhaseProgress {
  /** Días del tramo. */
  days: number;
  /** Días que ya pasaron (con hoy). */
  done: number;
  /** Días que faltan. */
  left: number;
}

export interface PhasesLabels {
  /** La etiqueta de la línea de hoy: «hoy · día {n}». */
  today: string;
  /** Hoy en el resumen para el lector: «hoy, día {n}». */
  todayAria: string;
  /** Un tick del eje: «día {n}». */
  day: string;
  /** El rango de un tramo: «días {from} a {to}». */
  range: string;
  /** Lo que falta de un tramo: «faltan {n} días». */
  pending: string;
  /** Lo que falta cuando es un solo día: «falta 1 día». */
  pendingOne: string;
  /** Un tramo que todavía no empieza. */
  notStarted: string;
  /** Sin tramos. */
  empty: string;
  /** Nombre de la lista para el lector de pantalla. */
  group: string;
}
