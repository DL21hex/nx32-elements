/** `<Tasks>` para SolidJS: envuelve `<nx-tasks>`. Por qué `prop:`, `attr:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/tasks/index";
import type { NxTasks } from "../components/tasks/tasks";
import type { TaskDraft, TaskItem, TaskLink, TaskRequest, TasksCommitDetail, TasksLabels, TasksOpenDetail, TasksOptionsDetail, TasksPerson, TasksSettleResult, TasksUndoDetail } from "../components/tasks/types";

export type { NxTasks, TaskDraft, TaskItem, TaskLink, TaskRequest, TasksCommitDetail, TasksLabels, TasksOpenDetail, TasksOptionsDetail, TasksPerson, TasksSettleResult, TasksUndoDetail };

/**
 * `settle(key, resultado)` se llama sobre el elemento: con `ref` (`let tareas!: NxTasks;
 * <Tasks ref={tareas} … />`), o con `e.currentTarget` leído antes del primer `await` del manejador.
 */
export interface TasksProps extends Omit<JSX.HTMLAttributes<NxTasks>, "children"> {
  /** Las tareas: `{id, title, due?, by?, urgent?, done?, href?}`. */
  items?: TaskItem[];
  /** Lo que otros módulos esperan: `{id, title, kind, tone?, meta?, action, href, newTab?}`. */
  links?: TaskLink[];
  /** Lo que se pidió a otros: `{id, title, due?, people: [{name, done?}], href?}`. */
  requests?: TaskRequest[];
  heading?: string;
  /** Nivel del título (2); las secciones van uno abajo. */
  headingLevel?: number;
  /** «Hoy», `YYYY-MM-DD` (la fecha local si no se da). */
  today?: string;
  /** `?q=` → personas, para el `@` y el «para Nombre». */
  peopleSource?: string;
  /** «Más opciones» (con lo escrito como parámetros). */
  optionsHref?: string;
  /** El enlace del pie y su texto («Ver todos»). */
  moreHref?: string;
  moreLabel?: string;
  /** Botón de dictado (aparece solo si el navegador puede). */
  voice?: boolean;
  /** Milisegundos para deshacer (7000); 0 registra al instante. */
  undo?: number;
  locale?: string;
  labels?: Partial<TasksLabels>;
  /** Un cambio que ya no se puede deshacer: guárdelo y conteste con `settle(e.detail.key, …)`. */
  onCommit?: (e: CustomEvent<TasksCommitDetail>) => void;
  onUndo?: (e: CustomEvent<TasksUndoDetail>) => void;
  /** Cancelable: no se sigue el enlace (una tarea, algo de otro módulo o lo pedido). */
  onOpen?: (e: CustomEvent<TasksOpenDetail>) => void;
  /** «Más opciones», cancelable: no se va a `optionsHref` (p. ej. para abrir un cajón con el borrador). */
  onOptions?: (e: CustomEvent<TasksOptionsDetail>) => void;
  /** Sin hijos: el componente pinta todo su contenido. */
  children?: never;
}

export function Tasks(props: TasksProps): JSX.Element {
  const [local, rest] = splitProps(props, ["items", "links", "requests", "heading", "headingLevel", "today", "peopleSource", "optionsHref", "moreHref", "moreLabel", "voice", "undo", "locale", "labels", "onCommit", "onUndo", "onOpen", "onOptions", "children"]);
  return (
    <nx-tasks
      {...rest}
      prop:items={local.items}
      prop:links={local.links}
      prop:requests={local.requests}
      prop:labels={local.labels}
      attr:heading={local.heading}
      attr:heading-level={local.headingLevel === undefined ? undefined : String(local.headingLevel)}
      attr:today={local.today}
      attr:people-source={local.peopleSource}
      attr:options-href={local.optionsHref}
      attr:more-href={local.moreHref}
      attr:more-label={local.moreLabel}
      attr:undo={local.undo === undefined ? undefined : String(local.undo)}
      attr:locale={local.locale}
      bool:voice={!!local.voice}
      on:nx-tasks-commit={(e) => e.target === e.currentTarget && local.onCommit?.(e)}
      on:nx-tasks-undo={(e) => e.target === e.currentTarget && local.onUndo?.(e)}
      on:nx-tasks-open={(e) => e.target === e.currentTarget && local.onOpen?.(e)}
      on:nx-tasks-options={(e) => e.target === e.currentTarget && local.onOptions?.(e)}
    />
  );
}
