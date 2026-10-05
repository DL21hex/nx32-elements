/**
 * `<nx-grid>`: tipos. Todo es JSON (BDUI): columnas, filas, filtros, orden y agrupación.
 */
export type GridColumnType = "text" | "number" | "money" | "date" | "status";
export type GridTone = "neutral" | "info" | "success" | "warning" | "danger";
/** Cómo compara la grilla lo escrito al buscar y filtrar (`accents`). `"fold"` (por omisión): sin
 *  tildes ni mayúsculas, «porteria» encuentra «Portería». `"exact"`: sin mayúsculas pero con sus
 *  tildes y su ñ, «pena» no encuentra «PEÑA» (para datos de un ERP en mayúsculas, con la regla del
 *  servidor). */
export type GridAccents = "fold" | "exact";

export interface GridOption {
  value: string;
  label?: string;
  tone?: GridTone;
}

export interface GridColumn {
  key: string;
  label: string;
  /** Por defecto `text`. `date` espera texto ISO (`2026-03-12`). */
  type?: GridColumnType;
  /** Ancho en px (por defecto según el tipo). */
  width?: number;
  editable?: boolean;
  /** `status`: los valores posibles, con su etiqueta y tono. */
  options?: GridOption[];
  /** `false` para no mostrar las barras en el filtro de la columna (montos, números y fechas). */
  histogram?: boolean;
  /** Filtro de la columna (el embudo de la cabecera). Por defecto sale del tipo: montos y números
   *  → rango, fechas → fechas, estados y texto con pocos valores → lista, el resto → «contiene».
   *  Un valor lo fuerza; `false` lo quita. */
  filter?: false | "list" | "range" | "date" | "text";
  /** Símbolo de `money` (por defecto `$`). */
  currency?: string;
  /** Panel de filtros: `true` la incluye, `false` la excluye (por defecto, las columnas con pocas
   *  opciones distintas). */
  facet?: boolean;
  /** El valor se ve como enlace: un clic (o Enter) emite `nx-grid-open` con la fila. */
  link?: boolean;
  /** La clave de la fila que trae la dirección del enlace (`"detalle_url"`). Si la fila la trae, la
   *  celda es un `<a href>` de verdad: abrir en otra pestaña (Ctrl/⌘+clic, la rueda), copiar el
   *  enlace y el menú del navegador funcionan, y abrir la fila (Enter, doble clic) lo sigue en vez
   *  de emitir `nx-grid-open`. Sin dirección (o con una que no es segura, como `javascript:`), la
   *  celda se comporta como `link`. Implica `link`. */
  href?: string;
  /** Con `href`: el enlace abre en otra pestaña (`target="_blank"`, `rel="noopener noreferrer"`). */
  newTab?: boolean;
  /** Empieza escondida: «Columnas» la muestra, y «Restablecer columnas» (o volver a la tabla
   *  original) la vuelve a esconder. Una vista guardada recuerda lo que eligió la persona. */
  hidden?: boolean;
  /** Un círculo con las iniciales del valor antes del texto (nombres de personas). Con `true`, cada
   *  persona tiene su color (sale del texto: la misma, siempre el mismo); con `"neutral"`, todos van
   *  en gris, para una columna que se lee mucho y no debe competir con los tonos de la tabla. */
  avatar?: boolean | "neutral";
  /** Con `avatar`: la clave de la fila que trae las iniciales (`"iniciales"`), hasta tres letras.
   *  Sin ella, o en una fila que no las trae, salen del texto: la primera letra de las dos primeras
   *  palabras. Con dos nombres y dos apellidos eso da dos nombres («Abel Andres Hernandez Carrillo»
   *  es AA, no AH), y partir un nombre completo a ciegas no tiene arreglo («Abel Dario de Luquez
   *  Epinayu»): quien tiene nombres y apellidos por separado manda las iniciales. */
  initials?: string;
}

/** Una acción de fila: un botón (o un enlace) en la columna de acciones, fija a la derecha. */
export interface GridAction {
  /** Lo que llega en `nx-grid-action` (`detail.action`). */
  key: string;
  /** El nombre de la acción: el texto del botón, o su `aria-label` y su `title` si lleva ícono. */
  label: string;
  /** Un ícono del registro (`registerIcons`): el botón queda solo con el ícono. */
  icon?: string;
  /** `danger` para lo que borra o revoca. */
  tone?: "neutral" | "danger";
  /** La clave de la fila que trae la dirección: la acción es un `<a href>` (abrir el PDF, ir a otra
   *  pantalla) y no emite nada. Una fila sin dirección (o con una que no es segura) no la muestra. */
  href?: string;
  /** Con `href`: abre en otra pestaña. */
  newTab?: boolean;
  /** Con `href`: el enlace descarga (`download`). */
  download?: boolean;
  /** La clave de la fila que dice si la acción aplica: solo se muestra donde vale verdadero
   *  (`false`, `0`, `""`, `"0"`, `"false"`, `null` o sin la clave, no). Sin `when`, en todas. */
  when?: string;
}

export type GridRow = Record<string, unknown>;

/** Un tramo de fechas relativo a hoy: al asignar los filtros (una vista guardada, otro día), `min`
 *  y `max` se recalculan. */
export type GridDateRel = "past" | "last30" | "next30" | "month" | "lastMonth" | "year";

/** Un filtro serializable. `range`: `min` incluido, `max` excluido (números o fechas ISO). */
export type GridFilter =
  | { key: string; op: "in"; values: string[] }
  | { key: string; op: "notIn"; values: string[] }
  | { key: string; op: "range"; min?: number | string; max?: number | string; rel?: GridDateRel }
  | { key: string; op: "contains"; value: string };

export interface GridSort {
  key: string;
  dir: 1 | -1;
}

/** Las barras del filtro de una columna: `counts` sobre todas las filas, `filtered` tras los filtros. */
export interface GridHistogram {
  kind: "bins" | "categories";
  labels: string[];
  counts: number[];
  filtered: number[];
  /** `bins`: los bordes (n + 1) para armar el filtro `range`. `categories`: los valores. */
  edges?: (number | string)[];
  values?: string[];
}

export interface GridLabels {
  filters: string;
  groupBy: string;
  noGroup: string;
  export: string;
  exporting: string;
  exported: string;
  exportError: string;
  rows: string;
  of: string;
  cells: string;
  sum: string;
  avg: string;
  min: string;
  max: string;
  total: string;
  clear: string;
  remove: string;
  search: string;
  searchTable: string;
  clearSearch: string;
  more: string;
  less: string;
  empty: string;
  loading: string;
  loadError: string;
  retry: string;
  presets: string;
  selected: string;
  selectedOne: string;
  selectAll: string;
  clearSelection: string;
  selectRow: string;
  undo: string;
  redo: string;
  undone: string;
  redone: string;
  /** Se anuncia si la fila que se editaba deja de estar en los datos (o su columna) y lo escrito se descarta. */
  editLost: string;
  views: string;
  columns: string;
  saveView: string;
  resize: string;
  gone: string;
  filterBy: string;
  filterOn: string;
  left: string;
  done: string;
  reset: string;
  allValues: string;
  allMatching: string;
  only: string;
  onlyValue: string;
  exceptValue: string;
  searchIn: string;
  enterOnly: string;
  noValues: string;
  moreValues: string;
  from: string;
  to: string;
  fromValue: string;
  toValue: string;
  noMin: string;
  noMax: string;
  amountHint: string;
  anyDate: string;
  between: string;
  past: string;
  last30: string;
  next30: string;
  month: string;
  lastMonth: string;
  year: string;
  barHint: string;
  contains: string;
  containsHint: string;
  /** `containsHint` con `accents="exact"`. */
  containsHintExact: string;
  containsValue: string;
  matches: string;
  moreFilters: string;
  relax: string;
  /** La cabecera (para lectores de pantalla) de la columna de acciones. */
  actions: string;
  /** El nombre del menú de una celda cuando solo trae las acciones de la fila. */
  rowActions: string;
}

/** Una faceta que manda el backend (modo `source`). */
export interface GridFacetData {
  key: string;
  label: string;
  options: { value: string; label?: string; count: number }[];
}

/** Un atajo: un filtro con nombre, en una tarjeta con su conteo sobre la tabla («Contratos que
 *  vencen · 12»). Tocarla aplica sus filtros; otra vez, vuelve a los de antes. */
export interface GridPreset {
  id: string;
  label: string;
  /** Una línea corta bajo el nombre: «próximos 30 días». */
  hint?: string;
  /** Todos los filtros del atajo (reemplazan a los que haya). Un tramo con `rel` se recalcula cada día.
   *  Con `href` no se usan (puede ir vacío). */
  filters: GridFilter[];
  /** El atajo lleva a otra página en vez de filtrar: es un `<a href>` de verdad (Ctrl/⌘+clic abre
   *  otra pestaña, el router de la app lo navega), con ↗ en lugar de la flecha, y nunca queda
   *  marcado. Su conteo solo lo manda el servidor (`presets` de la respuesta): la tabla no tiene con
   *  qué contarlo. Una dirección que no es segura (`javascript:`) quita el atajo. No va en el menú. */
  href?: string;
  /** El tono del atajo: su conteo va en ese color y, marcado, la tarjeta también. Para el atajo que
   *  señala algo por resolver («Sin jefe asignado» en `warning`); los demás, sin tono. */
  tone?: GridTone;
  /** Va en el menú «Vistas», en el grupo «Seguimiento», en vez de una tarjeta: para lo que se mira
   *  de vez en cuando («Ingresos recientes»). Sin conteo: ni la tabla lo cuenta ni el servidor tiene
   *  que mandarlo. Se marca y se quita igual que una tarjeta. */
  menu?: boolean;
}

/** Lo que responde `source`: un bloque de filas y, opcionalmente, los agregados con los filtros aplicados. */
export interface GridPage {
  rows: GridRow[];
  total: number;
  histograms?: Record<string, GridHistogram>;
  facets?: GridFacetData[];
  /** Cuántas filas deja cada atajo (`GridPreset.id` → conteo), sobre todos los datos, no sobre lo
   *  filtrado. Los del menú (`menu`) no llevan conteo. */
  presets?: Record<string, number>;
  totals?: Record<string, number>;
}

/** `nx-grid-error`: un bloque del servidor no llegó (se vuelve a pedir más tarde, con más espera cada vez). */
export interface GridErrorDetail {
  offset: number;
  limit: number;
  error: string;
}

/** `nx-grid-action`: la persona pulsó el botón de una acción de fila (las que son enlace no emiten). */
export interface GridActionDetail {
  /** La `key` de la acción. */
  action: string;
  id: string;
  row: GridRow;
}

/** `nx-grid-export`: cómo terminó una exportación (botón o `exportXlsx()`). */
export interface GridExportDetail {
  ok: boolean;
  /** Filas que llevó el archivo (0 si falló). */
  count: number;
  filename: string;
  error?: string;
}

/** De dónde viene un cambio (en `nx-grid-change`). */
export type GridChangeSource = "edit" | "paste" | "delete" | "undo" | "redo";

export interface GridChange {
  id: string;
  key: string;
  value: unknown;
  old: unknown;
}

/** El estado de la tabla que se puede guardar: filtros, orden, agrupación, columnas ocultas y anchos. */
export interface GridView {
  filters: GridFilter[];
  sort: GridSort | null;
  groupBy: string;
  /** Las columnas ocultas (por `key`). */
  hidden: string[];
  /** Los anchos que eligió la persona, en px (por `key`). */
  widths: Record<string, number>;
}

/** Una vista guardada con nombre (`views-storage`). */
export interface GridSavedView extends GridView {
  id: string;
  name: string;
  /** Se aplica al abrir la tabla (solo una puede tenerlo). */
  default?: boolean;
}

/** Los textos del menú de vistas y del selector de columnas (se cargan con ellos). */
export interface GridViewLabels {
  /** El grupo del menú «Vistas» con los atajos `menu`. */
  viewTracking: string;
  viewModified: string;
  viewEmpty: string;
  viewSaveNew: string;
  viewSaveChanges: string;
  viewEdit: string;
  viewDelete: string;
  viewDeleteYes: string;
  viewReset: string;
  viewName: string;
  viewDefault: string;
  viewSave: string;
  viewCancel: string;
  viewDuplicate: string;
  viewConfirm: string;
  viewUntitled: string;
  columnsTitle: string;
  columnsReset: string;
  /** `columnsReset` cuando la tabla esconde columnas de arranque (`hidden`): restablecer no las muestra. */
  columnsResetDefault: string;
  columnsHint: string;
}
