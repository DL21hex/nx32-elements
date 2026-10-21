/** `<nx-entries>`: tipos. Todo es JSON: la lista y su esquema pueden venir del backend. */
import type { FormField, FormSection, FormValue } from "../form/types";

export type EntryTone = "neutral" | "info" | "success" | "warning" | "danger";

/** Una etiqueta corta del registro («Beneficiaria de la EPS»), con un ícono registrado si ayuda. */
export interface EntryTag {
  label: string;
  icon?: string;
}

/** Un aviso del registro, con su acción («Falta el certificado escolar» · «Subir certificado»). */
export interface EntryNote {
  text: string;
  /** `warning` por defecto. */
  tone?: EntryTone;
  /** El botón: avisa con `nx-entries-action` y este texto. */
  action?: string;
}

/**
 * Un registro de la lista: una persona del núcleo familiar, un trabajo anterior, un estudio, una
 * sesión abierta, una autorización.
 */
export interface EntryItem {
  id: string;
  /** La primera línea («Sofía Pérez Gómez», «Analista de compensación»). */
  title: string;
  /** La segunda («Hija · 13 años · TI 1.036.950.331»). */
  meta?: string;
  /** La tercera, más tenue («mar 2017 – ene 2021 · 3 años y 10 meses»). */
  detail?: string;
  /** La cara: un nombre (sus iniciales, con el color que sale del nombre) o la dirección de una foto. */
  avatar?: string;
  /** Sin `avatar`, un ícono registrado (`registerIcons`) en el lugar de la cara. */
  icon?: string;
  /** Un estado en píldora junto al título («Afiliación en trámite»). */
  badge?: string;
  badgeTone?: EntryTone;
  tags?: (string | EntryTag)[];
  /** Lo que lo respalda, con un visto («Registro civil de nacimiento», «Certificado laboral»). */
  proof?: string;
  /** Un aviso con su acción, dentro del registro. */
  note?: EntryNote;
  /** No se edita ni se quita aquí: un candado, y este texto como explicación («Lo registra
   *  Talento Humano»). */
  locked?: boolean | string;
  /** `false`: se edita pero no se quita (la sesión de este equipo, una autorización necesaria). */
  removable?: boolean;
  /** Lo que pasa al quitarlo, en la confirmación («Talento Humano tramitará su retiro de la EPS»). */
  removeText?: string;
  /** Los valores del formulario al editarlo (las claves del esquema). */
  values?: Record<string, FormValue>;
}

/** `list` (por defecto): uno debajo del otro. `cards`: tarjetas en una rejilla. `timeline`: una
 *  línea de tiempo vertical (una trayectoria), sin caras. */
export type EntriesLayout = "list" | "cards" | "timeline";

/** El esquema del panel para agregar y editar: campos de `<nx-form>` o sus secciones. */
export type EntriesSchema = FormField[] | FormSection[];

export interface EntriesLabels {
  /** El botón de agregar si no hay `add-label`, y el título del panel nuevo. */
  add: string;
  /** El nombre del botón de editar: «Editar {title}». */
  edit: string;
  /** El nombre del botón de quitar: «Quitar {title}». */
  remove: string;
  /** La pregunta antes de quitar: «¿Quitar «{title}»?». */
  confirmRemove: string;
  /** El botón que confirma. */
  confirm: string;
  cancel: string;
  /** El botón del panel al editar y al agregar. */
  save: string;
  create: string;
  empty: string;
  /** El candado de un registro bloqueado sin texto propio. */
  locked: string;
}

/** `nx-entries-edit`: se pidió agregar (`id: null`) o editar. Cancelable: con `preventDefault()` el
 *  panel no se abre (la app abre el suyo). */
export interface EntriesEditDetail {
  id: string | null;
  item: EntryItem | null;
}

/** `nx-entries-open`: el panel ya está abierto, con su formulario (para llenarlo desde un
 *  documento con `fill()` o agregarle herramientas en su `slot="tools"`). */
export interface EntriesOpenDetail {
  id: string | null;
  form: HTMLElement;
}

/** `nx-entries-save`: el formulario del panel se envió bien. Cancelable: con `preventDefault()` el
 *  panel sigue abierto (la app guarda en su servidor y luego llama `close()`, o pone `errors`). */
export interface EntriesSaveDetail {
  id: string | null;
  item: EntryItem | null;
  values: Record<string, FormValue>;
  /** De dónde vino cada dato que no escribió la persona (`fill()`). */
  sources: Record<string, string>;
}

/** `nx-entries-remove`: se confirmó quitar. Cancelable: con `preventDefault()` se queda. */
export interface EntriesRemoveDetail {
  id: string;
  item: EntryItem;
}

/** `nx-entries-action`: la acción del aviso de un registro. */
export interface EntriesActionDetail {
  id: string;
  action: string;
  item: EntryItem;
}
