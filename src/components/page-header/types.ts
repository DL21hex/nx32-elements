/** El tono del cambio de una cifra de la cabecera (el mismo vocabulario que `<nx-stats>`). */
export type PageHeaderTone = "neutral" | "info" | "success" | "warning" | "danger";

/**
 * Una cifra de la cabecera: qué es y cuánto («Activos 1.284»), y si ayuda, su cambio («+12 este
 * mes») con un tono. Un `value` numérico sale con el locale de la página.
 */
export interface PageHeaderKpi {
  id?: string;
  label: string;
  value: string | number;
  /** El cambio o un dato corto junto al valor («+12», «3 nuevas»). */
  delta?: string;
  /** El color del cambio (por defecto `neutral`): la palabra ya dice si es bueno o malo. */
  tone?: PageHeaderTone;
  /** Una línea más al pasar el mouse (`title`). */
  hint?: string;
}

/**
 * Un enlace de la cabecera a una página relacionada o a un archivo («Reporte de ausentismo»,
 * «Descargar la plantilla»). Un `<a>` de verdad: `newTab` abre en otra pestaña y `download`
 * descarga (un texto es el nombre del archivo).
 */
export interface PageHeaderLink {
  label: string;
  href: string;
  /** Nombre de un ícono registrado (`registerIcons`). */
  icon?: string;
  newTab?: boolean;
  download?: boolean | string;
}

export interface PageHeaderLabels {
  /** Nombre de las cifras para el lector de pantalla. */
  kpis: string;
  /** Nombre de los enlaces para el lector de pantalla. */
  links: string;
}
