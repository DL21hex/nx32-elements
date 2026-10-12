/**
 * Los filtros del tablero: por dimensión, los valores elegidos. Todo es texto, así un valor viaja
 * igual en un atributo (`data-nx-filter="mes:2026-08"`), en JSON y en la URL. Una dimensión sin
 * valores no se guarda.
 */
export type BoardFilters = Record<string, string[]>;

/**
 * Una dimensión por la que se puede filtrar: su nombre para los chips y, si hace falta, el nombre
 * de cada valor (`{AT: "Accidente de trabajo"}`). Lo que no esté aquí sale del `data-nx-label` de la
 * marca que se tocó, o del valor tal cual.
 */
export interface BoardDimension {
  id: string;
  label?: string;
  values?: Record<string, string>;
  /**
   * Un dato sensible (el diagnóstico). Con `restricted` en el tablero, filtrar por ella reserva los
   * paneles `personal`: una lista de nombres filtrada por diagnóstico diría quién tiene qué.
   */
  sensitive?: boolean;
}

export interface BoardLabels {
  /** Nombre del renglón de chips para el lector de pantalla. */
  filters: string;
  /** El botón que quita todos los filtros. */
  clear: string;
  /** El nombre accesible de cada chip. `{dimension}` y `{value}`. */
  remove: string;
  /** Lo que dice el renglón cuando no hay filtros. Vacío: el renglón no se pinta. */
  hint: string;
  /** El aviso de un panel reservado. `{dimension}`: las dimensiones sensibles filtradas. */
  reserved: string;
  /** Une dos o más nombres en el aviso («diagnóstico y área»). */
  and: string;
}

export interface BoardChangeDetail {
  filters: BoardFilters;
  /** Las dimensiones que cambiaron: un panel cuya única dimensión es una de estas no se vuelve a pedir. */
  changed: string[];
  /** Si los paneles `personal` quedaron reservados (no pedir sus datos). */
  reserved: boolean;
}
