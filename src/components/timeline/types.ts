import type { Holiday } from "../../core/holidays";

/**
 * Cómo se pinta un carril: `bars` (una barra por día cuyo alto es su `value`: pagos), `ranges`
 * (una franja de `start` a `end`: vacaciones, incapacidades) o `points` (una marca en un día:
 * permisos, consignaciones).
 */
export type TimelineLaneKind = "bars" | "ranges" | "points";

export interface TimelineLane {
  id: string;
  label: string;
  kind?: TimelineLaneKind;
  /** La forma de las marcas de un carril `points`: punto (por defecto) o rombo. */
  shape?: "dot" | "diamond";
}

/**
 * En qué va una marca. Sin `state`, la cinta lo deduce de la fecha: `done` hasta hoy y `upcoming`
 * después. `pending`: espera una decisión; `rejected`: no salió; `draft`: lo que se está eligiendo.
 */
export type TimelineState = "done" | "upcoming" | "pending" | "rejected" | "draft";

export type TimelineTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface TimelineItem {
  /** Para `highlight`, el foco y el evento. Sin él, la posición en `items`. */
  id?: string;
  /** El `id` de su carril. Una marca de un carril que no existe no se pinta. */
  lane: string;
  /** El día de una barra o un punto (ISO). */
  date?: string;
  /** El primer y el último día de una franja (ISO, los dos incluidos). Sin `end`, un solo día. */
  start?: string;
  end?: string;
  /** El alto de una barra (el neto de un pago). Las barras de un carril se miden contra la más alta. */
  value?: number;
  /** La parte de `value` que va resaltada arriba de la barra (una prima, unos intereses). */
  extra?: number;
  state?: TimelineState;
  /** El color de una franja o un punto, si no basta el del estado. */
  tone?: TimelineTone;
  /** Lo que es («Quincena del 16 al 30 de septiembre»): título de la lente y nombre accesible. */
  label: string;
  /** Las líneas de la lente («Pagada el miércoles 30», «$ 1.882.000 netos»). Texto plano. */
  detail?: string[];
  /** El pie de la lente cuando la marca lleva a algún lado («Abrir el desprendible»). */
  action?: string;
  /** Adónde lleva: la marca es un `<a href>` de verdad. */
  href?: string;
  /** Un texto corto sobre la marca, siempre a la vista («en 7 días»). Úsese para una o dos. */
  caption?: string;
}

/** Una entrada de la leyenda: la muestra de una marca y lo que significa. */
export interface TimelineLegendItem {
  mark: "bar" | "bar-upcoming" | "bar-extra" | "range" | "range-pending" | "range-draft" | "point" | "point-pending" | "diamond" | "holiday";
  label: string;
}

/** `"co"` (por defecto): los festivos de Colombia. Una lista de fechas ISO o de `{date, name}`. `null`, ninguno. */
export type TimelineHolidays = "co" | null | (string | Holiday)[];

export interface TimelineLabels {
  /** Nombre del grupo para el lector de pantalla cuando no hay `heading`. */
  region: string;
  /** La línea de hoy. `{date}`: la fecha corta. */
  today: string;
  /** La lente de un festivo. */
  holiday: string;
  /** Lo que dice el lector de pantalla al llegar a la cinta. */
  hint: string;
  /** Estados, para el nombre accesible de cada marca. */
  done: string;
  upcoming: string;
  pending: string;
  rejected: string;
  draft: string;
}

export interface TimelineSelectDetail {
  item: TimelineItem;
  href: string | null;
}
