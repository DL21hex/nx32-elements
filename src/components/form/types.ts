/** `<nx-form>`: tipos del esquema. Todo es JSON: un formulario entero puede venir del backend. */

/** El control de cada campo. `text` por defecto. */
export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "select"
  | "radio"
  | "segmented"
  | "checkbox"
  | "checkboxes"
  | "readonly"
  | "rows"
  | "file";

/** El valor de un campo: texto (también las fechas, en ISO «2026-10-13»), número, sí/no, una lista
 *  (casillas), las filas de un campo `rows`, el `File` de un campo `file` o `null` si está vacío. */
export type FormValue = string | number | boolean | string[] | FormRow[] | File | null;

/** Una fila de un campo `rows`: el valor de cada uno de sus campos. */
export type FormRow = Record<string, string | number | boolean | string[] | null>;

/** Una columna en la que busca un `select` con buscador (`<nx-select>`). */
export interface FormSearchField {
  key: string;
  label: string;
  /** `digits`: se compara solo por dígitos («1.143.456.789» o «1143456789»). */
  kind?: "text" | "digits";
}

export interface FormOption {
  value: string;
  /** El texto que se ve (sin él, `value`). */
  label?: string;
  /** Otras columnas en las que busca un `select` con buscador (`search`): `{cedula: "1143456789"}`. */
  [column: string]: unknown;
  /** Lo habitual de esta opción: al elegirla, llena estos campos si están vacíos o los llenó el
   *  sistema («Soldador» → área, centro de costo, clase de riesgo). Nunca pisa lo que escribió la persona. */
  fills?: Record<string, FormValue>;
}

/** Una regla de `when`, por clave: un valor (igual a), una lista (alguno de), `{not}` (ninguno de) o
 *  `{filled}` (tiene o no tiene valor). Todas las claves tienen que cumplirse. */
export type FormRule = FormValue | FormValue[] | { not: FormValue | FormValue[] } | { filled: boolean };
export type FormCondition = Record<string, FormRule>;

/** Un enlace debajo de un campo («Descargar formato»): con aspecto de botón secundario y siempre en
 *  otra pestaña (no se pierde lo escrito, y el router de la app no lo intercepta). */
export interface FormLink {
  /** El texto del enlace (su nombre accesible). Siempre texto, nunca HTML. */
  label: string;
  /** Pasa por `safeHref`: rutas relativas, http(s), mailto y tel. */
  href: string;
}

export interface FormField {
  /** La clave del dato: en `values`, en `errors` y en el `name` del control. Única en el formulario. */
  key: string;
  label: string;
  type?: FormFieldType;
  required?: boolean;
  /** La ayuda debajo del campo. */
  hint?: string;
  placeholder?: string;
  /** Cuántas de las seis columnas ocupa (1 a 6; sin él, la fila entera). */
  span?: number;
  /** El valor con el que empieza. */
  value?: FormValue;
  /** Para `select`, `radio`, `segmented` y `checkboxes`: textos sueltos u opciones. */
  options?: (string | FormOption)[];
  /** El campo aparece solo si se cumple. Oculto, no se valida ni sale en `values`. */
  when?: FormCondition;
  /** Números y montos: límites. Fechas: ISO o «today». */
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  /** Una expresión regular que tiene que cumplir el texto entero, con su mensaje. */
  pattern?: string;
  patternMessage?: string;
  /** Filas de un `textarea` (3 por defecto). */
  rows?: number;
  /** Montos: moneda ISO o símbolo (si no, la del formulario). */
  currency?: string;
  /** Números, montos y porcentajes: decimales. */
  decimals?: number;
  /** Letra monoespaciada (códigos, cuentas). */
  mono?: boolean;
  /** El `autocomplete` del navegador («given-name», «email»…). Por defecto, apagado. */
  autocomplete?: string;
  /** `select` con buscador (`<nx-select>`): `true`, o las columnas en las que busca. Con más de 12
   *  opciones, o con `source`, lo tiene solo. */
  search?: boolean | FormSearchField[];
  /** `select`: busca en el servidor mientras se escribe (`GET ?q=`), del mismo origen. */
  source?: string;
  /** `rows`: los campos de cada fila (sin filas adentro). `min` y `max` cuentan filas. */
  fields?: FormField[];
  /** `rows`: el botón para agregar una fila («Agregar beneficiario»). */
  addLabel?: string;
  /** `file`: los tipos que sirven, con la sintaxis de `<input accept>` («.pdf,image/*»). */
  accept?: string;
  /** `file`: el tamaño máximo, en bytes (20 MB por defecto). */
  maxSize?: number;
  /** Un enlace debajo del campo, después de la ayuda (un formato para descargar, el reglamento).
   *  Se ve también en lectura y se va con el campo cuando `when` lo oculta. No es un dato: no sale en
   *  `values`, no se valida ni marca cambios. Sin `label` o con un `href` inseguro, se descarta (con
   *  un aviso). En un campo de una fila (`rows`) no se pinta. */
  link?: FormLink;
}

export interface FormSection {
  /** Para el índice y para enlazar (por defecto, su posición). */
  id?: string;
  heading?: string;
  description?: string;
  fields: FormField[];
}

/** De dónde vino un dato: el chip junto a la etiqueta («Cédula») y su detalle («Leído del código de
 *  barras de la cédula»). */
export interface FormSource {
  label: string;
  detail?: string;
}

/** `edit` (por defecto) o `read`: la misma rejilla, con los valores como texto. */
export type FormMode = "edit" | "read";

/** `cards` (por defecto): cada sección en su tarjeta. `plain`: sin tarjetas, separadas por una línea
 *  (dentro de un panel o de otra tarjeta). */
export type FormVariant = "cards" | "plain";

export interface FormLabels {
  submit: string;
  cancel: string;
  optional: string;
  empty: string;
  locked: string;
  source: string;
  /** La primera opción de una lista sin elegir. */
  pick: string;
  yes: string;
  no: string;
  required: string;
  choose: string;
  check: string;
  email: string;
  /** Aviso de un dominio mal escrito: «¿Quisiste decir {email}?». */
  emailTypo: string;
  /** El botón que lo corrige: «Usar {domain}». */
  emailFix: string;
  url: string;
  tel: string;
  number: string;
  min: string;
  max: string;
  date: string;
  dateMin: string;
  dateMax: string;
  minLength: string;
  maxLength: string;
  pattern: string;
  /** El pie: «Faltan {n} datos obligatorios» (y en singular). */
  missing: string;
  missingOne: string;
  /** El pie, con todo lleno pero algo por corregir. */
  invalid: string;
  invalidOne: string;
  ready: string;
  next: string;
  /** El índice. */
  sections: string;
  complete: string;
  progress: string;
  sectionMissing: string;
  sectionErrors: string;
  /** Después de llenar: «{n} datos de {source}». */
  filled: string;
  filledOne: string;
  /** «… · respeté {n} que ya escribiste». */
  kept: string;
  undo: string;
  undone: string;
  /** El detalle del origen de lo que llena una opción: «Lo habitual para {option}». */
  usual: string;
  draftSaving: string;
  draftSaved: string;
  draftRestored: string;
  startOver: string;
  /** Tiempos del borrador. */
  justNow: string;
  secondsAgo: string;
  minutesAgo: string;
  atTime: string;
  /** Se anuncia al enviar con datos por llenar: «Faltan {n} datos. Empieza por {label}.» */
  goTo: string;
  /** Filas: el botón por defecto, quitar una, la lista vacía y los límites. */
  addRow: string;
  removeRow: string;
  noRows: string;
  rowsMin: string;
  rowsMax: string;
  /** El nombre de una fila para el lector de pantalla: «{label} {n}». */
  rowName: string;
  /** Archivo: el botón, la invitación a soltarlo, el tope («Hasta {max}»), quitarlo y los errores
   *  («{accept}» son los tipos que sirven; «{max}», el tope). */
  fileChoose: string;
  fileDrop: string;
  fileMax: string;
  fileRemove: string;
  fileBadType: string;
  fileTooBig: string;
  /** Para el lector de pantalla, tras el texto de un enlace (`link`): «(se abre en otra pestaña)». */
  newTab: string;
}

export interface FormChangeDetail {
  /** La clave del campo (en una fila, la del campo `rows`). */
  key: string;
  value: FormValue;
  values: Record<string, FormValue>;
  /** En una fila: su posición y el campo que cambió (sin ellos, se agregó o se quitó una fila). */
  row?: number;
  field?: string;
}

/** `nx-form-dirty`: los cambios sin guardar aparecieron o desaparecieron. */
export interface FormDirtyDetail {
  dirty: boolean;
}

export interface FormFillDetail {
  /** Las claves que cambiaron (también las que llenó una opción con `fills`). */
  keys: string[];
  source: FormSource | null;
}

export interface FormSubmitDetail {
  values: Record<string, FormValue>;
  /** De dónde vino cada dato que no escribió la persona (`{area: "REQ-118"}`): para la bitácora. */
  sources: Record<string, string>;
}
