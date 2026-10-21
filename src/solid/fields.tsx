/** `<Fields>` para SolidJS: envuelve `<nx-fields>`. Por qué `prop:` y `bool:`, en `./index.tsx`. */
import { splitProps, type JSX } from "solid-js";
import "./jsx";
import "../components/fields/index";
import type { NxFields } from "../components/fields/fields";
import type { FieldFormat, FieldInput, FieldInputType, FieldItem, FieldOption, FieldPending, FieldsActionDetail, FieldsLabels, FieldsNoteIcon, FieldsPendingDetail, FieldsVariant, FieldValue } from "../components/fields/types";

export type { NxFields, FieldFormat, FieldInput, FieldInputType, FieldItem, FieldOption, FieldPending, FieldsActionDetail, FieldsLabels, FieldsNoteIcon, FieldsPendingDetail, FieldsVariant, FieldValue };

/** Sin hijos: todo lo pinta el componente. */
export interface FieldsProps extends Omit<JSX.HTMLAttributes<NxFields>, "children"> {
  items?: FieldItem[];
  variant?: FieldsVariant;
  /** Columnas de la rejilla (1 a 4; 2 por defecto). */
  columns?: number;
  heading?: string;
  /** El botón al lado del título («Editar»). */
  action?: string;
  /** Una línea bajo el título («Lo administra Talento Humano»). */
  note?: string;
  /** El ícono de la nota: `lock` (por defecto) o `info`. */
  noteIcon?: FieldsNoteIcon;
  /** Cada valor se vuelve un campo en su sitio. Lee lo escrito con `ref.values`. */
  editing?: boolean;
  /** Errores por clave, debajo de cada campo. */
  errors?: Record<string, string>;
  locale?: string;
  currency?: string;
  labels?: Partial<FieldsLabels>;
  onAction?: (e: CustomEvent<FieldsActionDetail>) => void;
  /** La acción de un cambio en revisión («Cancelar solicitud»). */
  onPending?: (e: CustomEvent<FieldsPendingDetail>) => void;
  children?: never;
}

export function Fields(props: FieldsProps): JSX.Element {
  // `children` se separa y no se pasa: Solid no debe adueñarse del contenido que pinta el componente.
  const [local, rest] = splitProps(props, ["items", "variant", "columns", "heading", "action", "note", "noteIcon", "editing", "errors", "locale", "currency", "labels", "onAction", "onPending", "children"]);
  return (
    <nx-fields
      {...rest}
      prop:items={local.items}
      prop:errors={local.errors}
      prop:labels={local.labels}
      attr:variant={local.variant}
      attr:columns={local.columns === undefined ? undefined : String(local.columns)}
      attr:heading={local.heading}
      attr:action={local.action}
      attr:note={local.note}
      attr:note-icon={local.noteIcon}
      attr:locale={local.locale}
      attr:currency={local.currency}
      bool:editing={!!local.editing}
      on:nx-fields-action={(e) => e.target === e.currentTarget && local.onAction?.(e)}
      on:nx-fields-pending={(e) => e.target === e.currentTarget && local.onPending?.(e)}
    />
  );
}
