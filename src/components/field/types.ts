/** `<nx-field>`: tipos. */

export interface FieldLabels {
  /** Al lado de la etiqueta de un campo que se puede dejar vacío (`optional`). */
  optional: string;
  /** Para el lector de pantalla, en lugar del «—» de un campo vacío en lectura. */
  empty: string;
  /** El candado de un campo que no se edita aquí (`locked`). */
  locked: string;
  /** Para el lector de pantalla, junto al chip de origen sin `source-detail`: «Dato de {source}». */
  source: string;
}

/** Cuántas de las seis columnas de `.nx-form-grid` ocupa el campo. */
export type FieldSpan = 1 | 2 | 3 | 4 | 5 | 6;

export interface FieldActionDetail {
  /** El texto del botón (`action`). */
  action: string;
}
