/** `<nx-tabs>`: tipos. */

/** Una pestaña. Si no se pasa `tabs`, salen de los hijos con `data-tab`. */
export interface TabItem {
  /** La clave (`value` del componente). */
  value: string;
  label: string;
  /** Un contador al lado («Documentos 12»). */
  count?: number;
  /** Errores de un formulario en esa pestaña: un contador en rojo (gana sobre `count`). */
  errors?: number;
  disabled?: boolean;
  /** Una línea de estado debajo de la etiqueta («Falta la talla de calzado»). Se ve en el índice
   *  vertical; en la tira horizontal queda solo su punto y el lector la dice. */
  status?: string;
  /** El color del punto del estado (el texto ya lo dice). Sin él, gris. */
  tone?: TabTone;
  /** Un ícono registrado (`registerIcons`) antes de la etiqueta, en el índice vertical. */
  icon?: string;
}

export type TabTone = "neutral" | "info" | "success" | "warning" | "danger";

/** `horizontal` (por defecto): la tira arriba. `vertical`: el índice al lado de los paneles; en un
 *  contenedor angosto vuelve a ser la tira. */
export type TabsOrientation = "horizontal" | "vertical";

/** `nx-tabs-change`. */
export interface TabsChangeDetail {
  value: string;
  previous: string | null;
}
/** @deprecated El nombre de antes (el evento era `nx-tab-change`): usa `TabsChangeDetail`. */
export type TabChangeDetail = TabsChangeDetail;

export interface TabsLabels {
  /** Para el lector de pantalla, en lugar del contador de errores: «{n} por corregir». */
  errors: string;
}
