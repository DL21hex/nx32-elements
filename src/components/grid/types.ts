/**
 * `<nx-grid>`: tipos. Todo es JSON (BDUI): columnas, filas, filtros, orden y agrupación.
 */
export type GridColumnType = "text" | "number" | "money" | "date" | "time" | "status" | "timeline";
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
  /** Por defecto `text`. `date` espera texto ISO (`2026-03-12`); `time`, la hora del día como
   *  «HH:MM» de 24 horas (`"07:30"`, `"19:05"`), y editable entiende «730», «7:30 pm», «ahora»,
   *  «+20» o «-10» (ver `readTime`). `timeline` dibuja los pasos de su proceso (`sequence`) sobre
   *  una línea de horas (`hours`), con la hora de ahora; no se edita y su valor lo pone la tabla:
   *  cómo va el proceso (`idle`, `live`, `done` o `review`, ver `SequenceState`), con su nombre y
   *  tono en `options` (por defecto, `labels.stateIdle`…). Por él se filtra y se cuenta (atajos). */
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
  /** Fija a la izquierda: no se va al desplazar la tabla a lo ancho (el nombre de la persona en una
   *  tabla con muchas columnas). Las fijas van primero, en su orden, y con ellas la de las casillas.
   *  Si la tabla mide menos de 640 px no se fija (taparía casi todo). */
  sticky?: boolean;
  /** Un círculo con las iniciales del valor antes del texto (nombres de personas). Con `true`, cada
   *  persona tiene su color (sale del texto: la misma, siempre el mismo); con `"neutral"`, todos van
   *  en gris, para una columna que se lee mucho y no debe competir con los tonos de la tabla. */
  avatar?: boolean | "neutral";
  /** Con `avatar`: la clave de la fila que trae las iniciales (`"iniciales"`), hasta tres letras.
   *  Sin ella, o en una fila que no las trae, salen del texto: la primera letra de las dos primeras
   *  palabras. Con dos nombres y dos apellidos eso da dos nombres («Luis Fernando Ortega Salas»
   *  es LF, no LO), y partir un nombre completo a ciegas no tiene arreglo («Ana Dolores de la Hoz
   *  Pertuz»): quien tiene nombres y apellidos por separado manda las iniciales. */
  initials?: string;
  /** Un punto de color antes de cada valor, en vez de la píldora: para clasificar sin gritar (el
   *  tipo de contrato, la sede). El color es el `tone` de su opción o, sin tono, uno de ocho por el
   *  lugar de la opción en `options` (el mismo valor, siempre el mismo color). El punto se repite en
   *  el panel de filtros, en la lista del filtro de la columna y en el chip del filtro puesto. Sin
   *  `dot`, las opciones con tono siguen en píldora, y llevan su punto en los filtros y el chip. */
  dot?: boolean;
  /** Las columnas con el mismo nombre de `sequence` son los pasos de un proceso, en el orden en que
   *  se declararon (primera caja → último pallet → salida). En cada fila, un paso vacío con uno
   *  posterior ya registrado se ve «Faltante» (`labels.stepMissing`), y un valor anterior al del
   *  paso previo, en ámbar (`labels.stepOrder`). Se recalcula al editar. Horas, fechas y números.
   *  En un proceso de horas editables, la celda del paso que sigue se ve «--:--», la cabecera de
   *  cada paso dice cuántas filas lo tienen, y al escribir se ve qué hora se entendió, con los
   *  pasos vecinos (ver `readTime`: «2» después de las 06:31 son las 14:00). Una columna
   *  `timeline` con el mismo `sequence` lo dibuja. */
  sequence?: string;
  /** `timeline`: las horas que abarca la línea, `["04:00", "23:00"]` por defecto. Lo que cae
   *  fuera queda en el borde. */
  hours?: [string, string];
  /** En la lista (`narrow`, cuando la tabla mide menos de 480 px), el lugar de la columna en su
   *  renglón: `title` (arriba, el nombre), `meta` (debajo, hasta dos, separadas por «·»), `end`
   *  (arriba a la derecha: un estado, un monto) o `end-meta` (debajo a la derecha). Si ninguna
   *  columna lo trae, la tabla elige (ver `narrow`); si alguna lo trae, solo van esas. */
  list?: GridListSlot;
}

/** El lugar de una columna en el renglón de la lista (`GridColumn.list`). */
export type GridListSlot = "title" | "meta" | "end" | "end-meta";

/** Qué hace la tabla cuando mide menos de 480 px: se pinta como lista (`list`, por omisión) o
 *  sigue siendo tabla (`table`: para las que se llenan celda por celda). */
export type GridNarrow = "list" | "table";

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
  /** En la lista (sin cabecera): el selector del orden, «Ordenar por {col}». */
  sortBy: string;
  /** La primera opción del selector del orden: las filas como llegan. */
  noSort: string;
  /** El botón del sentido del orden. */
  sortAsc: string;
  sortDesc: string;
  /** En la lista, el botón que cierra la hoja de «Filtros»: «Ver {rows}» (el conteo de la tabla). */
  seeRows: string;
  export: string;
  exporting: string;
  exported: string;
  /** Exportar desde la matriz salió bien: «Se exportó la matriz». */
  exportedMatrix: string;
  exportError: string;
  /** «{n} filas». Con «singular|plural» («{n} empleado|{n} empleados»), el singular para 1. */
  rows: string;
  /** «{n} de {total} filas». Con «singular|plural», elige por el total. */
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
  /** Sin filas porque los filtros o la búsqueda no dejan ninguna. */
  empty: string;
  /** Sin filas porque no hay datos (nada filtrado): lo que la app quiera decir ahí («Carga el
   *  catálogo con la carga masiva»). */
  noRows: string;
  loading: string;
  loadError: string;
  retry: string;
  /** El origen mandó más filas de las que caben (`client-only`): «Se muestran las primeras
   *  {shown} de {total} filas…». */
  truncated: string;
  presets: string;
  /** El segmento sin atajo, junto al título («Todos»). */
  presetsAll: string;
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
  /** Un paso de un proceso (`sequence`) vacío, con uno posterior ya registrado. */
  stepMissing: string;
  /** Un paso con valor anterior al del paso previo: «Antes de «{step}»». */
  stepOrder: string;
  /** Lo escrito en una celda de hora no se entiende. */
  timeInvalid: string;
  /** Bajo una celda de hora vacía, mientras se escribe: cómo se escribe. */
  timeHint: string;
  /** Bajo una celda de hora con valor que se vació: al confirmar queda sin hora. */
  timeEmpty: string;
  /** El botón que pone la hora de ahora: «Ahora · {time}». */
  timeNowButton: string;
  /** El botón que deja la celda de hora sin hora. */
  timeClear: string;
  /** Se escribió «ahora». */
  timeIsNow: string;
  /** Una hora sin a. m./p. m. que se tomó de la tarde por el orden: {step} y {time} del paso anterior. */
  timeAfternoon: string;
  /** «+20»: {d} (la duración) después de {step} ({time}). */
  timeAfter: string;
  /** «-10»: hace {d}. */
  timeAgo: string;
  /** La hora queda antes del paso anterior ({step}, {time}). */
  timeBeforePrev: string;
  /** La hora queda después del paso siguiente ({step}, {time}). */
  timeAfterNext: string;
  /** La hora es más tarde que ahora ({time}). */
  timeFuture: string;
  /** «+20» sin un paso anterior con hora. */
  timeNoPrev: string;
  /** El paso que sigue en una fila (la celda «--:--»). */
  stepNext: string;
  /** La cabecera de un paso: {n} de {total} filas lo tienen ({step}). */
  stepCount: string;
  /** Cómo va un proceso (`timeline`): sin empezar, en curso, terminado, por revisar. */
  stateIdle: string;
  stateLive: string;
  stateDone: string;
  stateReview: string;
  /** La línea de `timeline`: la hora de ahora ({time}). */
  timelineNow: string;
  /** Una celda que se está guardando (`save()`). */
  saving: string;
  /** Se guardó (`save()`, se anuncia). */
  saved: string;
  /** No se guardó (`save()`): la celda vuelve a su valor y se anuncia con el motivo. */
  saveError: string;
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
  /** El selector «Tabla | Matriz» (con `matrix`): su nombre y sus dos opciones. */
  layout: string;
  layoutTable: string;
  layoutMatrix: string;
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

/** Cómo se ve la tabla: sus filas (`table`) o la matriz de dos columnas (`matrix`). */
export type GridLayout = "table" | "matrix";

/** La matriz (`matrix`): cruza dos columnas de pocos valores (Área × Estado) y en cada cruce dice
 *  cuántas filas hay, o la suma o el promedio de una columna numérica. */
export interface GridMatrix {
  /** La columna de las filas de la matriz. Sin ella (o si no sirve), la primera que se pueda cruzar. */
  rows?: string;
  /** La columna de las columnas. Sin ella, la siguiente que se pueda cruzar. */
  cols?: string;
  /** `count` (por omisión): cuántas filas; `sum` y `avg`, de la columna numérica `value`. */
  agg?: "count" | "sum" | "avg";
  /** Con `sum` o `avg`: la columna (`number` o `money`) que se suma o promedia. */
  value?: string;
}

/**
 * `nx-grid-columns`: cambió la disposición de las columnas. `columns`, todas las de la tabla;
 * `hidden` y `widths`, las ocultas (por `key`) y los anchos que eligió la persona (px, por `key`),
 * los mismos de `view`. Sale cuando la persona esconde o muestra una columna («Columnas», «Volver a
 * las columnas de la tabla»), cambia un ancho (un arrastre, una vez al soltar; Ctrl+←/→, doble clic
 * o Supr) o elige en «Vistas» una que los cambia, y con `removeColumn()`. No sale por lo que asigna
 * la app (`columns`, `view`, `applyView()`) ni por la vista predeterminada al abrir: la app ya lo
 * sabe, y un recuerdo guardado al oír eso se pisaría con el arranque.
 */
export interface GridColumnsDetail {
  columns: GridColumn[];
  hidden: string[];
  widths: Record<string, number>;
}

/** `nx-grid-layout`: la persona pasó entre la tabla y la matriz, o cambió la matriz. */
export interface GridLayoutDetail {
  layout: GridLayout;
  matrix: GridMatrix | null;
}

/** Un cruce de la matriz. Con `source`, el servidor manda una por cruce que tenga filas
 *  (`GROUP BY` de las dos columnas); los que no vienen valen cero. `""` es «sin dato». */
export interface GridMatrixCell {
  /** El valor de la columna de las filas (`GridMatrix.rows`), como texto. */
  row: string;
  /** El valor de la columna de las columnas. */
  col: string;
  /** Lo que vale el cruce: el conteo, la suma o el promedio. */
  value: number;
  /** Cuántas filas tiene el cruce. Con `avg` hace falta para los totales (un promedio no se suma). */
  count?: number;
  /** El nombre que se ve, si el valor es un código (el id de una subdivisión). */
  rowLabel?: string;
  colLabel?: string;
}

/** Lo que responde `source`: un bloque de filas y, opcionalmente, los agregados con los filtros aplicados. */
/**
 * La respuesta de `source` a `{offset, limit, sort, filters, search?}`. `total`: cuántas filas
 * tiene la consulta entera (no solo esta página).
 *
 * `search` se busca POR PALABRAS, la misma regla de la tabla con las filas en el navegador: se
 * separa por espacios y quedan las filas en las que cada palabra (todas, en cualquier orden) está
 * dentro del texto de alguna columna visible, sin mayúsculas y sin tildes (o con ellas, si la tabla
 * lleva `accents="exact"`). «jose martinez» encuentra «JOSE LUIS MARTINEZ». Un servidor que busca
 * la frase entera encuentra menos que la tabla con `client-max`, y la persona ve resultados distintos
 * según dónde se filtró.
 *
 * Con `client-max`, si la primera página dice que puede caber, la tabla pide una vez la consulta
 * completa: `{offset: 0, limit: client-max + 1, sort: null, filters: []}`. La fuente contesta las
 * filas (hasta `client-max + 1`) o, si ya sabe que son más que el tope, solo el número:
 * `{rows: [], total: N}`, sin leerlas. La tabla sigue en el servidor si `total` pasa del tope, si
 * llegan más filas que el tope o si llegan menos que `total`; si no, sigue en el navegador con esas.
 */
export interface GridPage {
  rows: GridRow[];
  total: number;
  histograms?: Record<string, GridHistogram>;
  facets?: GridFacetData[];
  /** Cuántas filas deja cada atajo (`GridPreset.id` → conteo), sobre todos los datos, no sobre lo
   *  filtrado. Los del menú (`menu`) no llevan conteo. */
  presets?: Record<string, number>;
  totals?: Record<string, number>;
  /** La respuesta a una petición con `matrix` (la tabla en modo matriz): los cruces. */
  matrix?: GridMatrixCell[];
}

/**
 * `nx-grid-error`: un bloque del servidor no llegó. Se vuelve a pedir más tarde, con más espera cada
 * vez (y una variación al azar; con `Retry-After`, lo que pidió el servidor), solo si el fallo puede
 * pasar solo (la red, el plazo `timeout` vencido, un 5xx, un 408 o un 429); otro 4xx no se repite:
 * lo arregla la persona o la app (`retrying: false`). Sale una vez por intento: para avisar una sola
 * vez por fallo, la app mira `attempt === 1`. También sale si falla `refresh()` con las filas en el
 * navegador: entonces las filas de antes se quedan, y no se repite (`retrying: false`).
 */
export interface GridErrorDetail {
  offset: number;
  limit: number;
  /** El fallo en una línea (`HTTP 500`, o el mensaje de la red), como antes de la 0.17.0. */
  error: string;
  /** El estado HTTP; 0 si no hubo respuesta (la red, el plazo vencido, una respuesta que no se pudo leer). */
  status: number;
  /** Lo que dice el servidor (el `error` o el `message` de su JSON) o, si no dice nada, `error`. */
  message: string;
  /** El cuerpo de la respuesta: el JSON leído, el texto si no es JSON, o `null`. */
  body: unknown;
  /** Qué intento de este bloque fue (1 el primero). */
  attempt: number;
  /** Si la tabla lo volverá a pedir sola. */
  retrying: boolean;
}

/**
 * `nx-grid-truncated`: el origen mandó más filas de las que caben en el navegador (`client-only`,
 * hasta `client-max` o 20.000) y la tabla se quedó con las primeras. `shown`: las que tiene;
 * `total`: las del origen (su `total`, o las filas que llegaron si no lo dice o dice menos). La
 * tabla lo dice también con un aviso y en su conteo («20.000 de 25.300 filas»).
 */
export interface GridTruncatedDetail {
  shown: number;
  total: number;
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
  /** Filas que llevó el archivo (0 si falló). En la matriz, las de su eje (sin la de «Total»). */
  count: number;
  filename: string;
  /** Qué se exportó: la tabla (sus filas) o la matriz como se ve. */
  layout: GridLayout;
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
  /** Si se ve la tabla o la matriz (solo con `matrix`). */
  layout?: GridLayout;
  /** Las columnas y la medida de la matriz, si se ve. */
  matrix?: GridMatrix;
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

/** Los textos de la matriz (se cargan con ella). */
export interface GridMatrixLabels {
  /** «Filas» y «Columnas»: qué columna va en cada eje. */
  matrixRows: string;
  matrixCols: string;
  /** El botón que intercambia los dos ejes. */
  matrixSwap: string;
  /** «Mostrar» y sus opciones: cuántas filas, o la suma o el promedio de una columna ({col}). */
  matrixShow: string;
  matrixCount: string;
  matrixSum: string;
  matrixAvg: string;
  /** Los totales de cada fila y columna, y el general. */
  matrixTotal: string;
  /** Un cruce o un valor vacío: «(Sin dato)». */
  matrixBlank: string;
  /** Una celda para el lector de pantalla: «{row}, {col}: {value}». */
  matrixCell: string;
  /** Un cruce sin filas: «ninguna». */
  matrixNone: string;
  /** Bajo la matriz: qué hace tocarla. */
  matrixHint: string;
}
