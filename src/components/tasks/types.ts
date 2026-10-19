/**
 * `<nx-tasks>`: tipos. Todo es JSON (BDUI): las tareas de quien mira, lo que otros módulos esperan
 * de él y lo que él pidió. Lo que sale son eventos: cada cambio llega a la app cuando ya no se puede
 * deshacer (`nx-tasks-commit`), y la app responde con `settle(key, resultado)`.
 */

/** Una tarea propia (o que alguien le pidió a quien mira: `by`). */
export interface TaskItem {
  id: string;
  title: string;
  /** Fecha límite, `YYYY-MM-DD`. Sin ella, va en «Sin fecha». */
  due?: string;
  /** Quién la pidió («Laura Gómez»). Sin él, es propia. */
  by?: string;
  urgent?: boolean;
  /** Hecha: va al final, en «Hechas hoy». */
  done?: boolean;
  /** A dónde lleva el título. Pasa por `safeHref()`. */
  href?: string;
}

/** El tono de la etiqueta de algo que espera en otro módulo. */
export type TaskLinkTone = "warning" | "info" | "neutral";

/** Algo que otro módulo espera de quien mira (una firma, una aprobación). Se resuelve allá. */
export interface TaskLink {
  id: string;
  title: string;
  /** El texto de la etiqueta: «Firma», «Aprobación» (sin él, no hay etiqueta). */
  kind: string;
  tone?: TaskLinkTone;
  /** Una línea más: «Compras · desde ayer». */
  meta?: string;
  /** El texto del enlace: «Firmar» (sin él, `labels.open`). */
  action: string;
  href: string;
  /** Abre en otra pestaña. */
  newTab?: boolean;
}

/** Una de las personas a las que se le pidió algo. */
export interface TaskRequestPerson {
  name: string;
  done?: boolean;
}

/** Algo que quien mira le pidió a otros: una tarea para cada uno. */
export interface TaskRequest {
  id: string;
  title: string;
  due?: string;
  people: TaskRequestPerson[];
  href?: string;
}

/** Una persona de `people-source` (la misma forma que en `<nx-thread>`). */
export interface TasksPerson {
  id: string;
  name: string;
  /** Una línea más: el cargo, el área. */
  detail?: string;
  /** URL de la foto. Pasa por `safeImageSrc()`. */
  avatar?: string;
}

/** Lo que se entendió de lo escrito en el campo de captura. */
export interface TaskDraft {
  title: string;
  due?: string;
  urgent: boolean;
  /** A quiénes se les pide (vacío: es para quien escribe). */
  people: TasksPerson[];
}

/** El detalle de `nx-tasks-commit`: un cambio que ya no se puede deshacer. La app lo guarda y
 *  contesta con `settle(key, …)`. */
export type TasksCommitDetail =
  | { key: string; type: "create"; title: string; due?: string; urgent: boolean; people: TasksPerson[] }
  | { key: string; type: "done"; id: string; done: boolean };

/** El detalle de `nx-tasks-undo`: un cambio que se deshizo antes de enviarse. */
export interface TasksUndoDetail {
  key: string;
  type: "create" | "done";
}

/** El detalle de `nx-tasks-open` (cancelable: no se sigue el enlace). */
export type TasksOpenDetail =
  | { kind: "task"; item: TaskItem }
  | { kind: "link"; item: TaskLink }
  | { kind: "request"; item: TaskRequest };

/** El detalle de `nx-tasks-options` (cancelable: no se va a `options-href`). */
export interface TasksOptionsDetail {
  draft: TaskDraft;
}

/** Lo que la app contesta a un `nx-tasks-commit`: el `id` (y `href`) definitivo de lo creado, o el
 *  error que se le muestra a la persona (el cambio se revierte). */
export type TasksSettleResult = { id?: string; href?: string } | { error: string };

/** El grupo de una tarea según su fecha frente a `today`. */
export type TaskGroupId = "late" | "today" | "soon" | "later" | "none";

export interface TasksLabels {
  /** El título si no hay `heading`. */
  heading: string;
  /** El nombre de la lista de cifras de la cabecera. */
  summary: string;
  /** Cifras de la cabecera, «uno|varios» con `{n}`. */
  countLate: string;
  countToday: string;
  countWaiting: string;
  countAsked: string;
  /** El campo de captura. */
  placeholder: string;
  add: string;
  options: string;
  /** «Entendí:» antes de lo que se leyó. */
  understood: string;
  /** La pista bajo el campo vacío. */
  hint: string;
  /** Se intentó agregar algo sin título («urgente mañana»). */
  needTitle: string;
  forMe: string;
  /** «Para {names}». */
  forPeople: string;
  /** Con varias personas: «una tarea para cada uno». */
  each: string;
  noDate: string;
  urgent: string;
  /** El botón que quita algo de lo entendido: «Quitar {name}». */
  remove: string;
  /** Unión de los dos últimos nombres y el resto («{n} más»). */
  and: string;
  moreNames: string;
  /** Los grupos de las tareas. */
  groupLate: string;
  groupToday: string;
  groupSoon: string;
  groupLater: string;
  groupNone: string;
  /** «Hechas hoy ({n})». */
  doneToday: string;
  /** El botón redondo: «Marcar como hecha: {title}». El mismo en una hecha, con `aria-pressed`. */
  markDone: string;
  /** Las fechas: «venció hace {n} días», «venció ayer», «vence hoy», «vence mañana», «vence el {date}». */
  dueLate: string;
  dueYesterday: string;
  dueToday: string;
  dueTomorrow: string;
  dueOn: string;
  /** «pidió {name}». */
  by: string;
  /** Secciones: lo que otros módulos esperan y lo que se pidió. */
  links: string;
  requests: string;
  /** El enlace de un `TaskLink` sin `action`. */
  open: string;
  /** Lo pedido: «{done} de {total} hechas», «falta {names}» / «faltan {names}», «pendiente», «hecha». */
  progress: string;
  missingOne: string;
  missingMany: string;
  pending: string;
  done: string;
  /** La barra de estado. */
  added: string;
  /** «Le pediste «{title}» a {names}». */
  asked: string;
  markedDone: string;
  reopened: string;
  undo: string;
  undone: string;
  /** «No se guardó «{title}»: {message}». */
  failed: string;
  dismiss: string;
  /** Sin nada pendiente. */
  empty: string;
  /** El enlace del pie si no hay `more-label`. */
  more: string;
  /** El nombre de la lista de sugerencias del `@`. */
  people: string;
  /** Mientras se dicta: «Escuchando: {text}». */
  listening: string;
}
