export type AlertSeverity = "critical" | "serious" | "warning" | "info";

/**
 * Lo que se hace con un asunto: un enlace (`href`, `newTab`), un filtro del tablero (`filter`, con
 * la sintaxis de `data-nx-filter`: `"est:Sin radicar"`) o, sin ninguno de los dos, un botón que solo
 * avisa (`nx-alerts-action`). Con `href`, el `filter` se ignora.
 */
export interface AlertAction {
  label: string;
  href?: string;
  newTab?: boolean;
  filter?: string;
}

/** Un asunto por atender: su gravedad, qué es, el detalle y qué hacer. */
export interface AlertItem {
  id: string;
  /** `critical` (urgente), `serious` (pronto), `warning` (seguimiento) o `info` (aviso). Otra → `info`. */
  severity: AlertSeverity;
  title: string;
  /** El detalle: quién, desde cuándo, qué falta. */
  text?: string;
  /** Un dato corto junto al título («Día 197»). */
  meta?: string;
  action?: AlertAction;
}

export interface AlertsLabels {
  /** Nombre de la lista para el lector de pantalla. */
  group: string;
  /** Sin asuntos (si el autor no puso `empty`). */
  empty: string;
  critical: string;
  serious: string;
  warning: string;
  info: string;
  /** El botón que despliega el resto: `{n}` es cuántos faltan. */
  more: string;
  less: string;
}

export interface AlertsActionDetail {
  item: AlertItem;
}
