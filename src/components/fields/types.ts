/** `<nx-fields>`: tipos. */

/** Cómo se muestra el valor al leer. `text` por defecto. */
export type FieldFormat = "text" | "number" | "money" | "date";

/** El control al editar. Sin `input.type`, sale del formato: `money`, `number`, `date` o `text`. */
export type FieldInputType = "text" | "email" | "tel" | "url" | "number" | "money" | "date" | "select" | "textarea";

export interface FieldOption {
  value: string;
  label?: string;
}

export interface FieldInput {
  type?: FieldInputType;
  /** Para `select`: textos sueltos o `{value, label}`. */
  options?: (string | FieldOption)[];
  required?: boolean;
  placeholder?: string;
  /** Una ayuda debajo del campo («Vacío si es un solo día»). */
  hint?: string;
  /** Filas de un `textarea` (3 por defecto). */
  rows?: number;
}

export interface FieldItem {
  /** La clave del dato: en `values`, en `errors` y en el `name` del campo. Por defecto `f1`, `f2`… */
  key?: string;
  label: string;
  value?: string | number | null;
  /** Ocupa la fila entera (correo, dirección, observaciones). */
  wide?: boolean;
  format?: FieldFormat;
  /** Moneda del monto (ISO, «COP», o un símbolo); si falta, la del componente. */
  currency?: string;
  /** El valor es un enlace (a otro registro). */
  href?: string;
  /** Un botón para copiar el valor (códigos, cuentas, correos). */
  copy?: boolean;
  /** Letra monoespaciada (códigos). */
  mono?: boolean;
  /** Lo que no se cambia aquí: un candado («No se edita aquí») al leer, en el resumen (junto a la
   *  etiqueta) y al editar, donde sigue como texto. */
  readonly?: boolean;
  /** El control al editar. */
  input?: FieldInput;
  /** El dato ya se comprobó (un correo o un celular con su código): «✓ Verificado», o este texto. */
  verified?: boolean | string;
  /** Se ve como «••••••••» con «Mostrar» (un salario, una cuenta): quien mira la pantalla de al
   *  lado no lo lee sin que la persona quiera. */
  masked?: boolean;
  /** Un cambio pedido que todavía no se aplica: el valor nuevo, una línea y, si se puede, su acción
   *  («Cancelar solicitud», que avisa con `nx-fields-pending`). Debajo del valor de hoy. */
  pending?: FieldPending;
}

/** Un cambio en revisión («Davivienda •••• 0937», «Nómina lo revisa antes del 25 oct»). */
export interface FieldPending {
  value?: string | number | null;
  text?: string;
  action?: string;
}

/** `grid` (por defecto): etiqueta arriba y valor abajo, en columnas. `summary`: una franja de datos clave. */
export type FieldsVariant = "grid" | "summary";

export type FieldValue = string | number | null;

export interface FieldsLabels {
  /** Para el lector de pantalla, en lugar del «—» de un dato vacío. */
  empty: string;
  /** `aria-label` del botón de copiar: «Copiar {label}». */
  copy: string;
  copied: string;
  /** El candado de un dato que no se edita aquí. */
  readonly: string;
  /** La opción vacía de una lista. */
  choose: string;
  required: string;
  email: string;
  number: string;
  /** El botón de un dato oculto (`masked`) y lo que el lector dice en su lugar. */
  show: string;
  hide: string;
  hidden: string;
  verified: string;
  /** El título de un cambio en revisión: «En revisión». */
  pending: string;
  /** Un dato obligatorio vacío, al leer: «Falta», y el botón que lleva a llenarlo. */
  missing: string;
  add: string;
}

export interface FieldsActionDetail {
  /** El texto del botón de la cabecera que se pulsó. */
  action: string;
  /** Desde «Agregar» de un dato que falta: su clave (la app entra a editar y lo enfoca). */
  key?: string;
}

/** `nx-fields-pending`: la acción de un cambio en revisión. */
export interface FieldsPendingDetail {
  key: string;
  action: string;
  item: FieldItem;
}

/** El ícono de la nota bajo el título: candado (por defecto) o información. */
export type FieldsNoteIcon = "lock" | "info";
