/** `<nx-date>`: tipos. Todo es JSON: lo que no se puede elegir viene del backend. */

/** Un día que no se puede elegir, con su motivo («Festivo: Día de la Raza»). */
export interface DateUnavailableDay {
  date: string;
  label?: string;
}

/** Lo que no se puede elegir: fechas concretas (festivos, cierres; ISO o `{date, label}`) y días de
 *  la semana (0 domingo … 6 sábado, como `Date#getDay`). */
export interface DateUnavailable {
  dates?: (string | DateUnavailableDay)[];
  weekdays?: number[];
}

export interface DateLabels {
  /** Las letras del formato en el placeholder: «dd/mm/aaaa». */
  day: string;
  month: string;
  year: string;
  /** El botón que abre el calendario. */
  open: string;
  dialog: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  /** Un día bloqueado sin motivo. */
  unavailable: string;
  /** Un día fuera de `min`/`max`. */
  outOfRange: string;
  /** Lo escrito no es una fecha. */
  invalid: string;
}

export interface DateChangeDetail {
  /** ISO («2026-10-25») o `""` sin fecha. */
  value: string;
}
