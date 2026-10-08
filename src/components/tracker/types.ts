import type { HolidaySource } from "../../core/holidays";

export type TrackerTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Un paso del camino de una solicitud: hecho, en el que está, por venir o donde se cayó. */
export interface TrackerStep {
  label: string;
  /** Una línea debajo («Ayer, 4:12 p. m.», «Marcela Ruiz»). */
  detail?: string;
  state: "done" | "current" | "todo" | "failed";
}

export interface TrackerAction {
  label: string;
  href: string;
  newTab?: boolean;
  /** El botón principal de la tarjeta (uno). */
  primary?: boolean;
}

/**
 * Los días de unas vacaciones (pedidas o sugeridas): la tira va del primer al último día de
 * descanso —con los fines de semana y festivos pegados— y marca los que se piden.
 */
export interface TrackerDays {
  start: string;
  end: string;
}

export interface TrackerItem {
  id: string;
  title: string;
  subtitle?: string;
  /** Un ícono registrado (`registerIcons`) o de la librería. */
  icon?: string;
  /** Sobre el título («Para ti»): una sugerencia, no una solicitud. */
  eyebrow?: string;
  status?: { label: string; tone?: TrackerTone };
  steps?: TrackerStep[];
  days?: TrackerDays;
  /** El título lleva aquí (el detalle de la solicitud). */
  href?: string;
  actions?: TrackerAction[];
}

export interface TrackerLabels {
  /** Leyenda de la tira de días. */
  daysAsked: string;
  daysFree: string;
  /** Nombre de la lista para el lector de pantalla. */
  list: string;
}

export interface TrackerSelectDetail {
  item: TrackerItem;
  action: TrackerAction | null;
  href: string;
}

export type TrackerHolidays = HolidaySource;
