/**
 * Una acción sobre un registro: un botón (o un enlace) y, debajo, qué hace. Con `href` es un
 * enlace: navega (o descarga) y no emite nada; sin él, un botón que emite `nx-actions-action`.
 */
export interface ActionItem {
  id: string;
  label: string;
  /** Qué hace, en una o dos líneas: va debajo del botón. */
  description?: string;
  /** Nombre de un ícono registrado (`registerIcons`). */
  icon?: string;
  /** Destructiva: el botón va en rojo. */
  danger?: boolean;
  disabled?: boolean;
  /** Un enlace en vez de un botón (`<nx-button href>`): rutas relativas o URLs seguras. */
  href?: string;
  /** Con `href`: en otra pestaña. */
  newTab?: boolean;
  /** Con `href`: descarga en vez de navegar; un texto es el nombre del archivo. */
  download?: boolean | string;
}

export interface ActionsLabels {
  /** Nombre de la lista para el lector de pantalla. */
  group: string;
}

export interface ActionsActionDetail {
  id: string;
  item: ActionItem;
}
